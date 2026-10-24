import os
import json
import re
from flask import request, jsonify
from src.auth_stub import current_user
from src.config.settings import Config
from src.config.database import db_session
from src.models.models_db import ClassDB, StudentDB, WorkstationDB
from src.utils.db_helpers import (
    get_pc_key, get_or_create_computer, get_or_create_workstation,
    sync_student_scores_to_workstations, get_req_data
)

def get_scoring_class():
    c = db_session.query(ClassDB).filter(
        ClassDB.user_id == int(current_user.id),
        ClassDB.is_scoring == True
    ).first()
    return c.class_name if c else ""

def api_dashboard_info(active_class):
    if not active_class:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
    
    scoring_class = get_scoring_class()
    is_scoring_active = (scoring_class == active_class)
    
    cls = db_session.query(ClassDB).filter(
        ClassDB.user_id == int(current_user.id),
        ClassDB.class_name == active_class
    ).first()
    
    student_list_raw = ""
    if cls:
        students = db_session.query(StudentDB).filter(StudentDB.class_id == cls.class_id).all()
        workstations = db_session.query(WorkstationDB).filter(
            WorkstationDB.class_id == cls.class_id,
            WorkstationDB.is_draft == False
        ).all()
        ws_map = {ws.student_id: ws for ws in workstations if ws.student_id is not None}
        
        roster_lines = ["Họ và tên\tVị trí\tBài giao\tMục tiêu"]
        for s in students:
            ws = ws_map.get(s.student_id)
            pc_name = ws.computer.pc_name if ws else ""
            ot = ws.assigned_exam_code if ws else ""
            target = str(ws.target_score) if ws and ws.target_score is not None else ""
            roster_lines.append(f"{s.full_name}\t{pc_name}\t{ot}\t{target}")
        student_list_raw = "\n".join(roster_lines)
        
    return jsonify({
        "class_name": active_class,
        "is_scoring_active": is_scoring_active,
        "scoring_class": scoring_class,
        "student_list_raw": student_list_raw
    })

def api_seating_info(active_class):
    if not active_class:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
        
    cls = db_session.query(ClassDB).filter(
        ClassDB.user_id == int(current_user.id),
        ClassDB.class_name == active_class
    ).first()
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    has_draft = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == True
    ).first() is not None
    
    use_draft = (current_user.role == 'admin' and has_draft)
    
    workstations = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == use_draft
    ).all()
    
    mapping = {}
    targets = {}
    otConfigs = {}
    for ws in workstations:
        pc_key = get_pc_key(ws.computer.pc_name)
        mapping[pc_key] = ws.student.full_name if ws.student else ""
        targets[pc_key] = str(ws.target_score if ws.target_score is not None else (ws.student.default_target_score if ws.student else ""))
        otConfigs[pc_key] = ws.assigned_exam_code or ""
        
    return jsonify({
        "class_name": active_class,
        "is_draft": has_draft,
        "mapping": mapping,
        "targets": targets,
        "otConfigs": otConfigs
    })

def api_muctieu_info(active_class):
    if not active_class:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
        
    cls = db_session.query(ClassDB).filter(
        ClassDB.user_id == int(current_user.id),
        ClassDB.class_name == active_class
    ).first()
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    workstations = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == False
    ).all()
    
    students = {}
    for ws in workstations:
        pc_key = get_pc_key(ws.computer.pc_name)
        name = ws.student.full_name if ws.student else ""
        parts = name.strip().split(" ")
        if len(parts) > 1:
            ten = parts.pop()
            ho = " ".join(parts)
        else:
            ho = name
            ten = ""
            
        students[pc_key] = {
            'ho': ho,
            'ten': ten,
            'fullName': name,
            'mucTieu': str(ws.target_score if ws.target_score is not None else (ws.student.default_target_score if ws.student else "")),
            'baiLam': ws.assigned_exam_code or ""
        }
        
    return jsonify({
        "class_name": active_class,
        "students": students
    })

def handle_update_pc_mapping(active_class):
    data = get_req_data()
    changes = data.get('changes', {})
    if isinstance(changes, str): changes = json.loads(changes)
    deletes = data.get('deletes', [])
    if isinstance(deletes, str): deletes = json.loads(deletes)
    news = data.get('new_students', [])
    if isinstance(news, str): news = json.loads(news)
    user_targets = data.get('user_targets', {})
    if isinstance(user_targets, str): user_targets = json.loads(user_targets)
    user_ots = data.get('user_ots', {})
    if isinstance(user_ots, str): user_ots = json.loads(user_ots)
    user_names = data.get('user_names', {})
    if isinstance(user_names, str): user_names = json.loads(user_names)
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    is_admin = getattr(request, 'is_admin', False)
    use_draft = is_admin
    
    has_draft = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == True
    ).first() is not None
    
    if is_admin and not has_draft:
        official_ws = db_session.query(WorkstationDB).filter(
            WorkstationDB.class_id == cls.class_id,
            WorkstationDB.is_draft == False
        ).all()
        for ows in official_ws:
            dws = WorkstationDB(
                class_id=cls.class_id,
                computer_id=ows.computer_id,
                student_id=ows.student_id,
                target_score=ows.target_score,
                assigned_exam_code=ows.assigned_exam_code,
                is_draft=True
            )
            db_session.add(dws)
        db_session.flush()

    existing_ws = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == use_draft
    ).all()
    
    ws_map = {}
    for ws in existing_ws:
        pc_key = get_pc_key(ws.computer.pc_name)
        ws_map[pc_key] = {
            'student_id': ws.student_id,
            'target_score': ws.target_score,
            'assigned_exam_code': ws.assigned_exam_code
        }
        
    def normalize_pc_key(pc):
        try:
            return str(int(re.sub(r'[^0-9]', '', str(pc))))
        except ValueError:
            return str(pc)

    for pc in deletes:
        pc_key = normalize_pc_key(pc)
        if pc_key in ws_map:
            del ws_map[pc_key]

    temp_map = {}
    for old_pc, new_pc in changes.items():
        old_pc_key = normalize_pc_key(old_pc)
        new_pc_key = normalize_pc_key(new_pc)
        if old_pc_key in ws_map:
            temp_map[new_pc_key] = ws_map[old_pc_key]
            
    for old_pc in changes.keys():
        old_pc_key = normalize_pc_key(old_pc)
        if old_pc_key in ws_map:
            del ws_map[old_pc_key]
            
    for new_pc_key, data in temp_map.items():
        ws_map[new_pc_key] = data

    for st in news:
        pc_key = normalize_pc_key(st['pc'])
        name = st['fullName'].strip()
        if name:
            student = db_session.query(StudentDB).filter(
                StudentDB.class_id == cls.class_id,
                StudentDB.full_name == name
            ).first()
            if not student:
                student = StudentDB(class_id=cls.class_id, full_name=name)
                db_session.add(student)
                db_session.flush()
            ws_map[pc_key] = {
                'student_id': student.student_id,
                'target_score': ws_map.get(pc_key, {}).get('target_score'),
                'assigned_exam_code': ws_map.get(pc_key, {}).get('assigned_exam_code')
            }

    student_ws_lookup = {}
    for p, data in ws_map.items():
        if data.get('student_id'):
            student_ws_lookup[data['student_id']] = {
                'target_score': data.get('target_score'),
                'assigned_exam_code': data.get('assigned_exam_code'),
                'old_pc': p
            }

    for pc, name in user_names.items():
        pc_key = normalize_pc_key(pc)
        name = name.strip()
        if name:
            student = db_session.query(StudentDB).filter(
                StudentDB.class_id == cls.class_id,
                StudentDB.full_name == name
            ).first()
            if not student:
                student = StudentDB(class_id=cls.class_id, full_name=name)
                db_session.add(student)
                db_session.flush()
            
            student_info = student_ws_lookup.get(student.student_id)
            if student_info and student_info['old_pc'] != pc_key:
                ws_map[pc_key] = {
                    'student_id': student.student_id,
                    'target_score': student_info['target_score'],
                    'assigned_exam_code': student_info['assigned_exam_code']
                }
                old_p = student_info['old_pc']
                if ws_map.get(old_p, {}).get('student_id') == student.student_id:
                    del ws_map[old_p]
            else:
                ws_map[pc_key] = {
                    'student_id': student.student_id,
                    'target_score': ws_map.get(pc_key, {}).get('target_score'),
                    'assigned_exam_code': ws_map.get(pc_key, {}).get('assigned_exam_code')
                }
        else:
            if pc_key in ws_map:
                ws_map[pc_key]['student_id'] = None

    for pc, val in user_targets.items():
        pc_key = normalize_pc_key(pc)
        target_val = None
        if val:
            m = re.search(r'\d+', str(val))
            if m:
                target_val = int(m.group())
        if pc_key not in ws_map:
            ws_map[pc_key] = {'student_id': None, 'target_score': None, 'assigned_exam_code': None}
        ws_map[pc_key]['target_score'] = target_val

    for pc, val in user_ots.items():
        pc_key = normalize_pc_key(pc)
        if pc_key not in ws_map:
            ws_map[pc_key] = {'student_id': None, 'target_score': None, 'assigned_exam_code': None}
        ws_map[pc_key]['assigned_exam_code'] = val if val else None

    db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == use_draft
    ).delete()
    db_session.flush()

    for pc_key, data in ws_map.items():
        comp = get_or_create_computer(int(current_user.id), pc_key)
        ws = WorkstationDB(
            class_id=cls.class_id,
            computer_id=comp.computer_id,
            student_id=data['student_id'],
            target_score=data['target_score'],
            assigned_exam_code=data['assigned_exam_code'],
            is_draft=use_draft
        )
        db_session.add(ws)
    db_session.flush()

    sync_student_scores_to_workstations(cls.class_id, use_draft)
    
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_target(active_class):
    data = get_req_data()
    pc = data.get('pc')
    val = data.get('target')
    is_admin = getattr(request, 'is_admin', False)
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    comp = get_or_create_computer(int(current_user.id), pc)
    ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_admin)
    ws.target_score = int(val) if val else None
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_name(active_class):
    data = get_req_data()
    pc = data.get('pc')
    name = data.get('name', '').strip()
    is_admin = getattr(request, 'is_admin', False)
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    comp = get_or_create_computer(int(current_user.id), pc)
    ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_admin)
    
    if name:
        student = db_session.query(StudentDB).filter(
            StudentDB.class_id == cls.class_id,
            StudentDB.full_name == name
        ).first()
        if not student:
            student = StudentDB(class_id=cls.class_id, full_name=name)
            db_session.add(student)
            db_session.flush()
            
        old_ws = db_session.query(WorkstationDB).filter(
            WorkstationDB.class_id == cls.class_id,
            WorkstationDB.student_id == student.student_id,
            WorkstationDB.is_draft == is_admin
        ).first()
        
        if old_ws and old_ws.workstation_id != ws.workstation_id:
            ws.target_score = old_ws.target_score
            ws.assigned_exam_code = old_ws.assigned_exam_code
            
            old_ws.student_id = None
            old_ws.target_score = None
            old_ws.assigned_exam_code = None
            
        ws.student_id = student.student_id
    else:
        ws.student_id = None
        ws.target_score = None
        ws.assigned_exam_code = None
        
    db_session.flush()
    sync_student_scores_to_workstations(cls.class_id, is_admin)
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_ot(active_class):
    data = get_req_data()
    pc = data.get('pc')
    ot = data.get('ot', '').strip()
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    comp = get_or_create_computer(int(current_user.id), pc)
    for is_df in [False, True]:
        ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_df)
        ws.assigned_exam_code = ot if ot else None
        
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_bulk_target(active_class):
    data = get_req_data()
    start = int(data.get('start', 0))
    end = int(data.get('end', 0))
    target = data.get('target', '').strip()
    is_admin = getattr(request, 'is_admin', False)
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    for i in range(start, end + 1):
        comp = get_or_create_computer(int(current_user.id), i)
        ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_admin)
        ws.target_score = int(target) if target else None
        
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_bulk_ot(active_class):
    data = get_req_data()
    start = int(data.get('start', 0))
    end = int(data.get('end', 0))
    ot = data.get('ot', '').strip()
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    for i in range(start, end + 1):
        comp = get_or_create_computer(int(current_user.id), i)
        for is_df in [False, True]:
            ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_df)
            ws.assigned_exam_code = ot if ot else None
            
    db_session.commit()
    return jsonify({"status": "success"})

def handle_save_list(active_class):
    data_req = get_req_data()
    content = data_req.get('data', '')
    if not content: return jsonify({"status": "error", "message": "No data"}), 400
    
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    
    if not cls:
        return jsonify({"status": "error", "message": "Vui lòng chọn lớp học hoạt động trước khi nhập danh sách."}), 400
        
    db_session.query(WorkstationDB).filter(WorkstationDB.class_id == cls.class_id).delete()
    db_session.flush()
        
    lines = content.split('\n')
    seq_pc = 0
    imported_names = set()
    parsed_students = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        cols = [c.strip() for c in line.split('\t')]
        if not cols: continue
        
        first_col = cols[0].lower()
        if first_col in ['họ và tên', 'stt', '#', 'họ']: continue
        
        vi_tri_index = -1
        for i, col in enumerate(cols):
            if re.match(r'^PC\d+', col, re.IGNORECASE):
                vi_tri_index = i
                break
                
        pc_num = 0
        bai_giao = ''
        muc_tieu = ''
        full_name = cols[0].strip()
        
        if len(cols) > 1 and cols[1] and not re.match(r'^(OT|GM|\d+|PC)', cols[1], re.IGNORECASE):
            name_part = cols[1].strip()
            if name_part and name_part not in full_name:
                full_name = (full_name + " " + name_part).strip()
                
        if vi_tri_index != -1:
            pc_num = int(re.sub(r'[^0-9]', '', cols[vi_tri_index]))
            if 1 <= pc_num <= 60:
                if vi_tri_index == 4 and len(cols) >= 28:
                    bai_giao = cols[26]
                    muc_tieu = cols[27]
                elif vi_tri_index == 8 and len(cols) >= 11:
                    bai_giao = cols[9]
                    muc_tieu = cols[10]
                elif len(cols) > vi_tri_index + 1:
                    next_col = cols[vi_tri_index + 1]
                    if re.search(r'(OT|GM|Hoàn thành|Kiểm tra)', next_col, re.IGNORECASE):
                        bai_giao = next_col
                        muc_tieu = cols[vi_tri_index + 2] if len(cols) > vi_tri_index + 2 else ''
        elif 14 <= len(cols) <= 20:
            potential_ot = cols[9] if len(cols) > 9 else ''
            if re.search(r'(OT|GM|Hoàn thành|Kiểm tra)', potential_ot, re.IGNORECASE):
                seq_pc += 1
                pc_num = seq_pc
                bai_giao = potential_ot
                muc_tieu = cols[10] if len(cols) > 10 else ''
        else:
            seq_pc += 1
            pc_num = seq_pc
            
        if len(full_name) <= 1:
            continue
            
        imported_names.add(full_name)
        parsed_students.append({
            'full_name': full_name,
            'pc_num': pc_num,
            'bai_giao': bai_giao,
            'muc_tieu': muc_tieu
        })

    if imported_names:
        db_session.query(StudentDB).filter(
            StudentDB.class_id == cls.class_id,
            ~StudentDB.full_name.in_(list(imported_names))
        ).delete(synchronize_session=False)
    else:
        db_session.query(StudentDB).filter(StudentDB.class_id == cls.class_id).delete(synchronize_session=False)
    db_session.flush()

    for item in parsed_students:
        name = item['full_name']
        pc_num = item['pc_num']
        bai_giao = item['bai_giao']
        muc_tieu = item['muc_tieu']
        
        student = db_session.query(StudentDB).filter(
            StudentDB.class_id == cls.class_id,
            StudentDB.full_name == name
        ).first()
        
        t_val = 35
        if muc_tieu and muc_tieu.isdigit():
            t_val = int(muc_tieu)
            
        if not student:
            student = StudentDB(
                class_id=cls.class_id,
                full_name=name,
                default_target_score=t_val
            )
            db_session.add(student)
            db_session.flush()
        else:
            if muc_tieu and muc_tieu.isdigit():
                student.default_target_score = t_val
                db_session.flush()
            
        if pc_num > 0:
            comp = get_or_create_computer(int(current_user.id), pc_num)
            for is_df in [False, True]:
                ws = get_or_create_workstation(cls.class_id, comp.computer_id, is_df)
                ws.student_id = student.student_id
                if muc_tieu and muc_tieu.isdigit():
                    ws.target_score = t_val
                if bai_giao:
                    ws.assigned_exam_code = bai_giao
                    
    sync_student_scores_to_workstations(cls.class_id, False)
    sync_student_scores_to_workstations(cls.class_id, True)
    db_session.commit()
    
    DANHSACH_PATH = Config.DANHSACH_PATH
    os.makedirs(DANHSACH_PATH, exist_ok=True)
    ds_path = os.path.join(DANHSACH_PATH, f'danhsach_class_{cls.class_id}.txt')
    with open(ds_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    return jsonify({"status": "success"})

def handle_publish_data(active_class):
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == False
    ).delete()
    db_session.flush()
    
    draft_ws = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == True
    ).all()
    
    for dws in draft_ws:
        ows = WorkstationDB(
            class_id=cls.class_id,
            computer_id=dws.computer_id,
            student_id=dws.student_id,
            target_score=dws.target_score,
            assigned_exam_code=dws.assigned_exam_code,
            is_draft=False
        )
        db_session.add(ows)
        
    db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == cls.class_id,
        WorkstationDB.is_draft == True
    ).delete()
    
    db_session.flush()
    sync_student_scores_to_workstations(cls.class_id, False)
    db_session.commit()
    return jsonify({"status": "success"})
