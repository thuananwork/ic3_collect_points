import os
import glob
import re
import time
import urllib.parse
from flask import request, jsonify, Response
from flask_login import current_user
from src.config.settings import Config
from src.config.database import db_session
from src.models.models_db import ClassDB, ComputerDB, WorkstationDB, ScoreDB, StudentDB
from src.utils.helpers import normalize_ot
from src.utils.rate_limit import limiter
from src.utils.db_helpers import (
    get_pc_key, get_or_create_computer, get_or_create_workstation,
    sync_student_scores_to_workstations, get_req_data
)

SCORES_PATH = Config.SCORES_PATH

# /api/save-score là endpoint công khai (iSpring/GMetrix/đề standalone gửi về), nên giới hạn:
SAVE_SCORE_MAX_BYTES = 2 * 1024 * 1024        # 2 MB / lần gửi
SAVE_SCORE_RATE = (60, 60)                    # tối đa 60 lần / 60 giây / IP
SAVE_SCORE_MAX_SECONDS = 7 * 24 * 3600
PC_NAME_RE = re.compile(r'^[A-Za-z0-9_-]{1,15}$')


def _safe_name_part(value, max_len=40):
    """Làm sạch một thành phần tên file: bỏ mọi ký tự có thể thoát khỏi thư mục (/ \\ .. ...) và dấu '_'."""
    cleaned = re.sub(r'[^\w.\-]|_', '-', str(value))
    return cleaned[:max_len] or 'x'

def handle_get_data(ten_lop, parse_danh_sach=None, parse_scores_regex=None):
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    is_admin = getattr(request, 'is_admin', False)
    has_draft = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == True
    ).first() is not None
    
    use_draft = is_admin and has_draft
    
    workstations = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == use_draft
    ).all()
    
    mapping = {}
    targets = {}
    ots = {}
    
    for ws in workstations:
        pc_key = get_pc_key(ws.computer.pc_name)
        student_name = ws.student.full_name if ws.student else ""
        mapping[pc_key] = student_name
        targets[pc_key] = str(ws.target_score if ws.target_score is not None else (ws.student.default_target_score if ws.student else ""))
        ots[pc_key] = ws.assigned_exam_code or ""
        
    # Query scores
    scores_db = db_session.query(ScoreDB).filter(ScoreDB.class_id == cls.class_id).all()
    scores = {}
    for s in scores_db:
        pc_key = get_pc_key(s.computer.pc_name)
        ot = s.exam_code or "OT1"
        sc = float(s.score_achieved)
        if sc.is_integer():
            sc = int(sc)
            
        if pc_key not in scores:
            scores[pc_key] = {'score': '', 'timeSpent': '', 'lastOT': '', 'scoresByOT': {}, 'max': 0}
            
        if ot not in scores[pc_key]['scoresByOT']:
            scores[pc_key]['scoresByOT'][ot] = []
        scores[pc_key]['scoresByOT'][ot].append(sc)
        
    for pc_key, s_data in scores.items():
        all_sc_list = []
        for ot_name, ot_scores in s_data['scoresByOT'].items():
            all_sc_list.extend(ot_scores)
            
        s_data['score'] = '|'.join(map(str, all_sc_list))
        s_data['max'] = max(all_sc_list) if all_sc_list else 0
        
        # Find score record with highest score for dur / lastOT metadata
        pc_scores = [s for s in scores_db if get_pc_key(s.computer.pc_name) == pc_key]
        if pc_scores:
            best_score = max(pc_scores, key=lambda x: x.score_achieved)
            total_seconds = best_score.duration_seconds or 0
            dur = f"{total_seconds//3600:02d}-{(total_seconds%3600)//60:02d}-{total_seconds%60:02d}"
            s_data['timeSpent'] = dur
            s_data['lastOT'] = best_score.exam_code
            
    # Build frontend-compatible JSON response
    data_list = []
    for pc_key in sorted(mapping.keys(), key=lambda x: int(x) if x.isdigit() else 999):
        data_list.append({
            'pc': pc_key,
            'name': mapping[pc_key],
            'scores': scores.get(pc_key, {}),
            'target': targets.get(pc_key, ''),
            'ot': ots.get(pc_key, '')
        })
        
    return jsonify({
        'status': 'success',
        'data': data_list,
        'mapping': mapping,
        'scores': scores,
        'targets': targets,
        'otConfigs': ots,
        'isDraft': has_draft
    })

def handle_save_score(get_scoring_class=None, get_active_class=None):
    try:
        if not limiter.allow(f"score:{request.remote_addr}", *SAVE_SCORE_RATE):
            return "ERR: Too many requests", 429
        if request.content_length is not None and request.content_length > SAVE_SCORE_MAX_BYTES:
            return "ERR: Payload too large", 413
        raw_bytes = request.get_data()
        if len(raw_bytes) > SAVE_SCORE_MAX_BYTES:
            return "ERR: Payload too large", 413
        raw_text = raw_bytes.decode('utf-8', errors='ignore')
        data = urllib.parse.unquote(raw_text)
        
        # 1. Parse score (sp)
        score = "0"
        m_sp = re.search(r'[?&]sp=(\d+)', '&' + data, re.IGNORECASE)
        if m_sp: score = m_sp.group(1)
        if len(score) > 6:
            return "ERR: Invalid score", 400
        
        # 2. Parse duration (ut)
        total_seconds = 0
        m_ut = re.search(r'[?&]ut=(\d+)', '&' + data, re.IGNORECASE)
        if m_ut: total_seconds = int(m_ut.group(1))
        if total_seconds > SAVE_SCORE_MAX_SECONDS:
            return "ERR: Invalid duration", 400
        
        # 3. Parse OT exam code
        ot_raw = ""
        m_lt = re.search(r'[?&]lt=([^&]*)', '&' + data, re.IGNORECASE)
        if m_lt: ot_raw = m_lt.group(1)
        
        if not ot_raw:
            m_ot = re.search(r'(OT\d+|GM\d+)', data, re.IGNORECASE)
            if m_ot: ot_raw = m_ot.group(1)
            
        ot_final = normalize_ot(ot_raw)
        
        # Check if form data contains class_id, student_id, pc_name
        class_id_val = request.form.get('class_id')
        student_id_val = request.form.get('student_id')
        pc_name_val = request.form.get('pc_name')
        
        # Fallback to query params from data string if form is empty
        if not class_id_val or not student_id_val or not pc_name_val:
            parsed_params = urllib.parse.parse_qs(data)
            if 'class_id' in parsed_params:
                class_id_val = parsed_params['class_id'][0]
            if 'student_id' in parsed_params:
                student_id_val = parsed_params['student_id'][0]
            if 'pc_name' in parsed_params:
                pc_name_val = parsed_params['pc_name'][0]

        target_class = None
        target_computer = None
        student_id = None

        if class_id_val and student_id_val and pc_name_val:
            # Standalone submission: direct identity mapping (đã kiểm tra dữ liệu đầu vào)
            if not PC_NAME_RE.match(str(pc_name_val)):
                return "ERR: Invalid pc_name", 400
            try:
                class_id_int = int(class_id_val)
                student_id_int = int(student_id_val)
            except ValueError:
                return "ERR: Invalid class_id/student_id", 400
            target_class = db_session.query(ClassDB).filter(ClassDB.class_id == class_id_int).first()
            if target_class:
                student_row = db_session.query(StudentDB).filter(
                    StudentDB.student_id == student_id_int,
                    StudentDB.class_id == target_class.class_id
                ).first()
                if not student_row:
                    return "ERR: Student not in class", 400
                target_computer = get_or_create_computer(target_class.user_id, pc_name_val)
                student_id = student_id_int
                
                # Update workstation mapping
                ws = db_session.query(WorkstationDB).filter(
                    WorkstationDB.class_id == target_class.class_id,
                    WorkstationDB.computer_id == target_computer.computer_id,
                    WorkstationDB.is_draft == False
                ).first()
                if ws:
                    ws.student_id = student_id
                else:
                    new_ws = WorkstationDB(
                        class_id=target_class.class_id,
                        computer_id=target_computer.computer_id,
                        student_id=student_id,
                        is_draft=False
                    )
                    db_session.add(new_ws)

        if not target_class or not target_computer:
            # Fallback if no matching computer IP exists: identify by matching sender IP or GMetrix username
            ip_hs = request.remote_addr
            
            from src.models.models_db import UserActiveStateDB
            active_states = db_session.query(UserActiveStateDB).all()
            scoring_class_ids = [state.scoring_class_id for state in active_states if state.scoring_class_id]
            active_class_ids = [state.active_class_id for state in active_states if state.active_class_id]
            
            scoring_classes = []
            if scoring_class_ids:
                scoring_classes = db_session.query(ClassDB).filter(ClassDB.class_id.in_(scoring_class_ids)).all()
            if not scoring_classes and active_class_ids:
                scoring_classes = db_session.query(ClassDB).filter(ClassDB.class_id.in_(active_class_ids)).all()
                
            for cls in scoring_classes:
                comp = db_session.query(ComputerDB).filter(
                    ComputerDB.user_id == cls.user_id,
                    ComputerDB.ip_address == ip_hs
                ).first()
                if comp:
                    target_class = cls
                    target_computer = comp
                    break
                    
            # Fallback if no matching computer IP exists: parse PC name from GMetrix user string
            if not target_computer:
                pc_num = 0
                m_user = re.search(r'USER_NAME=([^&]*)', data, re.IGNORECASE)
                if m_user:
                    digits = re.sub(r'[^0-9]', '', m_user.group(1))
                    pc_num = int(digits) if digits else 0
                    
                if pc_num > 0 and scoring_classes:
                    pc_name_1 = f"PC{pc_num:02d}"
                    pc_name_2 = str(pc_num)
                    for cls in scoring_classes:
                        comp = db_session.query(ComputerDB).filter(
                            ComputerDB.user_id == cls.user_id,
                            (ComputerDB.pc_name == pc_name_1) | (ComputerDB.pc_name == pc_name_2)
                        ).first()
                        if comp:
                            target_class = cls
                            target_computer = comp
                            break
                            
            if not target_class:
                if scoring_classes:
                    target_class = scoring_classes[0]
                else:
                    return "ERR: No active classes", 400
                    
            if not target_computer:
                target_computer = get_or_create_computer(target_class.user_id, "PC01")
                
            # Find workstation to link student
            ws = db_session.query(WorkstationDB).filter(
                WorkstationDB.class_id == target_class.class_id,
                WorkstationDB.computer_id == target_computer.computer_id,
                WorkstationDB.is_draft == False
            ).first()
            student_id = ws.student_id if ws else None
            
        # 6. Insert score to DB
        new_score = ScoreDB(
            class_id=target_class.class_id,
            student_id=student_id,
            computer_id=target_computer.computer_id,
            exam_code=ot_final,
            score_achieved=float(score),
            duration_seconds=total_seconds,
            raw_html_content=raw_text
        )
        db_session.add(new_score)
        db_session.commit()
        
        # Backward compatibility file log
        s_dir = os.path.join(SCORES_PATH, f"class_{target_class.class_id}")
        os.makedirs(s_dir, exist_ok=True)
        dur_str = f"{total_seconds//3600:02d}-{(total_seconds%3600)//60:02d}-{total_seconds%60:02d}"
        prefix = f"PC{_safe_name_part(get_pc_key(target_computer.pc_name)).zfill(2)}"
        fn = f"{prefix}_{_safe_name_part(ot_final)}_Diem_{score}_{dur_str}_{int(time.time())}.html"
        out_path = os.path.realpath(os.path.join(s_dir, fn))
        if not out_path.startswith(os.path.realpath(s_dir) + os.sep):
            return "ERR: Invalid file name", 400
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(raw_text)
            
        return "OK"
    except Exception as e:
        print(f"Error saving score: {e}")
        return "ERR", 500

def handle_save_manual_score(ten_lop):
    data = get_req_data()
    pc = data.get('pc')
    score = data.get('score')
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    comp = get_or_create_computer(int(current_user.id), pc)
    
    ws = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.computer_id == comp.computer_id,
        WorkstationDB.is_draft == False
    ).first()
    student_id = ws.student_id if ws else None
    
    ot_type = "MANUAL"
    if ws and ws.assigned_exam_code:
        parts = ws.assigned_exam_code.split(',')
        ot_type = normalize_ot(parts[0])
        
    new_score = ScoreDB(
        class_id=cls.class_id,
        student_id=student_id,
        computer_id=comp.computer_id,
        exam_code=ot_type,
        score_achieved=float(score),
        duration_seconds=0,
        raw_html_content="Manual"
    )
    db_session.add(new_score)
    db_session.commit()
    return jsonify({"status": "success"})

def handle_delete_scores(ten_lop):
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if cls:
        db_session.query(ScoreDB).filter(ScoreDB.class_id == cls.class_id).delete()
        db_session.commit()
        
        # Also delete physical backward compatibility scores files
        s_dir = os.path.join(SCORES_PATH, f"class_{cls.class_id}")
        if os.path.exists(s_dir):
            for f in glob.glob(os.path.join(s_dir, "*.html")):
                try: os.remove(f)
                except: pass
    return jsonify({"status": "success"})

def handle_export_excel(ten_lop):
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    filename = f"Bang_Diem_{ten_lop}_{time.strftime('%H-%M_%d-%m-%Y')}.xls"
    
    workstations = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == False
    ).all()
    
    mapping = {}
    targets = {}
    ots = {}
    for ws in workstations:
        pc_key = get_pc_key(ws.computer.pc_name)
        mapping[pc_key] = ws.student.full_name if ws.student else ""
        targets[pc_key] = str(ws.target_score if ws.target_score is not None else (ws.student.default_target_score if ws.student else ""))
        ots[pc_key] = ws.assigned_exam_code or ""
        
    scores_db = db_session.query(ScoreDB).filter(ScoreDB.class_id == cls.class_id).all()
    diem_da_thu = {}
    for s in scores_db:
        pc_key = get_pc_key(s.computer.pc_name)
        ot = s.exam_code or "OT1"
        sc = float(s.score_achieved)
        if sc.is_integer():
            sc = int(sc)
            
        if pc_key not in diem_da_thu:
            diem_da_thu[pc_key] = {'score': '', 'timeSpent': '', 'lastOT': '', 'scoresByOT': {}, 'max': 0}
            
        if ot not in diem_da_thu[pc_key]['scoresByOT']:
            diem_da_thu[pc_key]['scoresByOT'][ot] = []
        diem_da_thu[pc_key]['scoresByOT'][ot].append(sc)
        
    for pc_key, s_data in diem_da_thu.items():
        all_sc_list = []
        for ot_name, ot_scores in s_data['scoresByOT'].items():
            all_sc_list.extend(ot_scores)
        s_data['score'] = '|'.join(map(str, all_sc_list))
        s_data['max'] = max(all_sc_list) if all_sc_list else 0
        
        # Find score record with highest score for dur / lastOT metadata
        pc_scores = [s for s in scores_db if get_pc_key(s.computer.pc_name) == pc_key]
        if pc_scores:
            best_score = max(pc_scores, key=lambda x: x.score_achieved)
            total_seconds = best_score.duration_seconds or 0
            dur = f"{total_seconds//3600:02d}-{(total_seconds%3600)//60:02d}-{total_seconds%60:02d}"
            s_data['timeSpent'] = dur
            s_data['lastOT'] = best_score.exam_code

    html = []
    html.append('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">')
    html.append('<head>')
    html.append('    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">')
    html.append('    <style>')
    html.append('        table { border-collapse: collapse; }')
    html.append('        td, th { border: 1px solid #ccc; padding: 5px; color: #000; font-size: 13pt; }')
    html.append('        .header { background-color: #CCFFCC; text-align: center; font-weight: bold; }')
    html.append('        .center { text-align: center; }')
    html.append('    </style>')
    html.append('</head>')
    html.append('<body>')
    html.append('    <table>')
    html.append('        <thead>')
    html.append('            <tr>')
    html.append('                <th class="header" style="width: 50px;">STT</th>')
    html.append('                <th class="header" style="width: 200px;">Họ</th>')
    html.append('                <th class="header" style="width: 100px;">Tên</th>')
    html.append('                <th class="header" style="width: 80px;">Số máy</th>')
    html.append('                <th class="header" style="width: 180px;">Các lần nộp</th>')
    html.append('                <th class="header" style="width: 120px;">ĐIỂM CẦN ĐẠT</th>')
    html.append('                <th class="header" style="width: 120px;">ĐIỂM CAO NHẤT</th>')
    html.append('                <th class="header" style="width: 120px;">Bài giao</th>')
    html.append('                <th class="header" style="width: 120px;">Bài đã thi</th>')
    html.append('                <th class="header" style="width: 120px;">Thời gian làm</th>')
    html.append('            </tr>')
    html.append('        </thead>')
    html.append('        <tbody>')
    
    stt = 1
    all_pcs = set(mapping.keys()) | set(diem_da_thu.keys())
    all_pcs_sorted = sorted(list(all_pcs), key=lambda x: int(x) if x.isdigit() else 999)
    
    for pc in all_pcs_sorted:
        ten = mapping.get(pc, "")
        parts = ten.strip().split(" ")
        first_name = parts[-1] if parts else ""
        last_name = " ".join(parts[:-1]) if len(parts) > 1 else ""
        
        score_data = diem_da_thu.get(pc, {})
        lan_nop = score_data.get('score', '')
        diem_cao = str(score_data.get('max', ''))
        tg = score_data.get('timeSpent', '')
        target_score = str(targets.get(pc, ''))
        bai_giao = ots.get(pc, '')
        bai_da_thi = score_data.get('lastOT', '')
        
        max_score_style = "font-weight:bold;"
        if target_score != "" and diem_cao != "":
            try:
                if int(diem_cao) < int(target_score):
                    max_score_style += " background-color: #ffcccc; color: #cc0000;"
            except:
                pass
                
        ot_style = ""
        if bai_giao != "" and bai_da_thi != "" and bai_da_thi != "UNKNOWN":
            assigned_arr = [x.strip() for x in bai_giao.split(',')]
            if bai_da_thi not in assigned_arr:
                ot_style = "background-color: #ffcccc; color: #cc0000; font-weight:bold;"
                
        html.append('            <tr>')
        html.append(f'                <td class="center">{stt}</td>')
        html.append(f'                <td>{last_name}</td>')
        html.append(f'                <td>{first_name}</td>')
        try:
            pc_num_formatted = f"PC{int(pc):02d}"
        except ValueError:
            pc_num_formatted = pc
        html.append(f'                <td class="center">{pc_num_formatted}</td>')
        html.append(f'                <td class="center">{lan_nop}</td>')
        html.append(f'                <td class="center">{target_score}</td>')
        html.append(f'                <td class="center" style="{max_score_style}">{diem_cao}</td>')
        html.append(f'                <td class="center">{bai_giao}</td>')
        html.append(f'                <td class="center" style="{ot_style}">{bai_da_thi}</td>')
        html.append(f'                <td class="center">{tg}</td>')
        html.append('            </tr>')
        stt += 1
        
    html.append('        </tbody>')
    html.append('    </table>')
    html.append('</body>')
    html.append('</html>')
    
    response_content = "".join(html)
    return Response(
        response_content,
        mimetype="application/vnd.ms-excel",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache"
        }
    )
