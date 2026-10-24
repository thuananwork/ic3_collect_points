import os
import json
import re
import time
from flask import request, jsonify
from flask_login import current_user
from src.config.settings import Config
from src.config.database import db_session
from src.models.models_db import ClassDB, StudentDB, WorkstationDB, ScoreDB
from src.utils.helpers import load_json, save_json
from src.utils.db_helpers import get_pc_key, get_or_create_computer, get_req_data

SCORES_PATH = Config.SCORES_PATH

def handle_get_excel_data():
    from src.utils.db_helpers import get_teacher_active_school_id
    school_id = get_teacher_active_school_id(int(current_user.id))
    
    query = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if school_id:
        query = query.filter(ClassDB.school_id == school_id)
    classes_db = query.all()
    classes = [c.class_name for c in classes_db]
    classes.sort()
    
    lop = request.args.get('lop', '').strip()
    if not lop and classes:
        lop = classes[0]
        
    grid = []
    headers_data = ["STT", "HỌ", "TÊN", "LỚP", "VỊ TRÍ", "CẤM", "Ghi chú buổi học", "OT1", "OT2", "OT3", "OT4", "OT5", "SL HT TH", "FLA GM1", "FLA GM2", "GMT1", "GMT2", "TRẠNG THÁI"]
    grid.append(headers_data)
    
    if lop:
        query_cls = db_session.query(ClassDB).filter(ClassDB.class_name == lop, ClassDB.user_id == int(current_user.id))
        if school_id:
            query_cls = query_cls.filter(ClassDB.school_id == school_id)
        cls = query_cls.first()
        
        loaded_from_json = False
        if cls:
            s_dir = os.path.join(SCORES_PATH, f"class_{cls.class_id}")
            tong_path = os.path.join(s_dir, "diem_tong.json")
            if os.path.exists(tong_path):
                try:
                    raw_list = load_json(tong_path)
                    for idx, st in enumerate(raw_list[:59]):
                        row = [""] * 18
                        row[0] = str(st.get('STT') or (idx + 1))
                        name = st.get('name', '').strip()
                        parts = name.split(" ")
                        if len(parts) > 1:
                            ten = parts[-1]
                            ho = " ".join(parts[:-1])
                        else:
                            ho = name
                            ten = ""
                            
                        row[1] = ho
                        row[2] = ten
                        row[3] = lop
                        row[4] = st.get('pc', st.get('VỊ TRÍ', ''))
                        row[5] = st.get('CẤM', '')
                        row[6] = st.get('Ghi chú buổi học', '')
                        row[7] = str(st.get('OT1', ''))
                        row[8] = str(st.get('OT2', ''))
                        row[9] = str(st.get('OT3', ''))
                        row[10] = str(st.get('OT4', ''))
                        row[11] = str(st.get('OT5', ''))
                        row[12] = str(st.get('SL HT TH', ''))
                        row[13] = str(st.get('FLA GM1', ''))
                        row[14] = str(st.get('FLA GM2', ''))
                        row[15] = str(st.get('GMT1', ''))
                        row[16] = str(st.get('GMT2', ''))
                        row[17] = st.get('TRẠNG THÁI', st.get('Trạng thái', ''))
                        grid.append(row)
                    loaded_from_json = True
                except Exception as e:
                    print(f"Error loading diem_tong: {e}")
                
        if not loaded_from_json or len(grid) < 2:
            # Fallback to database query if json file is empty/nonexistent
            if cls:
                workstations = db_session.query(WorkstationDB).filter(
                    WorkstationDB.class_id == cls.class_id,
                    WorkstationDB.is_draft == False
                ).all()
                
                scores_db = db_session.query(ScoreDB).filter(ScoreDB.class_id == cls.class_id).all()
                scores = {}
                for s in scores_db:
                    pc_key = get_pc_key(s.computer.pc_name)
                    ot = s.exam_code or "OT1"
                    sc = float(s.score_achieved)
                    if sc.is_integer(): sc = int(sc)
                    if pc_key not in scores:
                        scores[pc_key] = {}
                    if ot not in scores[pc_key] or sc > scores[pc_key][ot]:
                        scores[pc_key][ot] = sc
                
                stt = 1
                for ws in sorted(workstations, key=lambda w: int(get_pc_key(w.computer.pc_name)) if get_pc_key(w.computer.pc_name).isdigit() else 999):
                    pc_key = get_pc_key(ws.computer.pc_name)
                    name = ws.student.full_name if ws.student else ""
                    parts = name.split(" ")
                    if len(parts) > 1:
                        ten = parts[-1]
                        ho = " ".join(parts[:-1])
                    else:
                        ho = name
                        ten = ""
                        
                    pc_scores = scores.get(pc_key, {})
                    
                    row = [""] * 18
                    row[0] = str(stt)
                    row[1] = ho
                    row[2] = ten
                    row[3] = lop
                    try:
                        pc_num_formatted = f"PC{int(pc_key):02d}"
                    except ValueError:
                        pc_num_formatted = pc_key
                    row[4] = pc_num_formatted
                    row[7] = str(pc_scores.get('OT1', ''))
                    row[8] = str(pc_scores.get('OT2', ''))
                    row[9] = str(pc_scores.get('OT3', ''))
                    row[10] = str(pc_scores.get('OT4', ''))
                    row[11] = str(pc_scores.get('OT5', ''))
                    grid.append(row)
                    stt += 1
                    
        while len(grid) < 60:
            row = [""] * 18
            row[0] = str(len(grid))
            grid.append(row)
            
    return jsonify({
        "status": "success",
        "classes": classes,
        "selectedClass": lop,
        "grid": grid,
        "timestamp": time.strftime('%H:%M:%S %d/%m/%Y')
    })

def handle_save_excel_data(ten_lop):
    data = get_req_data()
    grid_rows = data.get('grid', [])
    if isinstance(grid_rows, str): grid_rows = json.loads(grid_rows)
    
    if not grid_rows:
        return jsonify({"status": "error", "message": "Dữ liệu rỗng"}), 400
        
    from src.utils.db_helpers import get_teacher_active_class_object
    cls = get_teacher_active_class_object(int(current_user.id))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
        
    s_dir = os.path.join(SCORES_PATH, f"class_{cls.class_id}")
    os.makedirs(s_dir, exist_ok=True)
    
    payload = []
    for idx, row in enumerate(grid_rows[1:]):
        if len(row) < 3: continue
        ho = str(row[1]).strip()
        ten = str(row[2]).strip()
        
        if ho or ten:
            student_obj = {
                "STT": row[0] or str(idx + 1),
                "name": f"{ho} {ten}".strip(),
                "pc": row[4] or "",
                "CẤM": row[5] or "",
                "Ghi chú buổi học": row[6] or "",
                "OT1": row[7] or "",
                "OT2": row[8] or "",
                "OT3": row[9] or "",
                "OT4": row[10] or "",
                "OT5": row[11] or "",
                "SL HT TH": row[12] or "",
                "FLA GM1": row[13] or "",
                "FLA GM2": row[14] or "",
                "GMT1": row[15] or "",
                "GMT2": row[16] or "",
                "TRẠNG THÁI": row[17] or ""
            }
            payload.append(student_obj)
            
    tong_path = os.path.join(s_dir, "diem_tong.json")
    save_json(tong_path, payload)
    
    # Save scores to database
    for st in payload:
        name = st["name"]
        pc_str = st["pc"]
        pc_match = re.search(r'\d+', pc_str)
        if not pc_match: continue
        pc_num = int(pc_match.group())
        
        comp = get_or_create_computer(int(current_user.id), pc_num)
        student = db_session.query(StudentDB).filter(
            StudentDB.class_id == cls.class_id,
            StudentDB.full_name == name
        ).first()
        if not student:
            student = StudentDB(class_id=cls.class_id, full_name=name)
            db_session.add(student)
            db_session.flush()
            
        for ot_key in ["OT1", "OT2", "OT3", "OT4", "OT5"]:
            score_val = str(st[ot_key]).strip()
            if score_val and score_val.isdigit():
                # Check if this manual score already exists in database
                existing_score = db_session.query(ScoreDB).filter(
                    ScoreDB.class_id == cls.class_id,
                    ScoreDB.student_id == student.student_id,
                    ScoreDB.computer_id == comp.computer_id,
                    ScoreDB.exam_code == ot_key,
                    ScoreDB.score_achieved == float(score_val)
                ).first()
                
                if not existing_score:
                    new_score = ScoreDB(
                        class_id=cls.class_id,
                        student_id=student.student_id,
                        computer_id=comp.computer_id,
                        exam_code=ot_key,
                        score_achieved=float(score_val),
                        duration_seconds=0,
                        raw_html_content="Manual Excel Grid"
                    )
                    db_session.add(new_score)
                    
                # Backward compatibility dummy html
                fn = f"PC{pc_num:02d}_{ot_key}_Diem_{score_val}_00-00-00_{int(time.time())}.html"
                with open(os.path.join(s_dir, fn), 'w', encoding='utf-8') as f:
                    f.write("Manual Score")
                    
    db_session.commit()
    return jsonify({"status": "success"})
