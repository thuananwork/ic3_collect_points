import re
import unicodedata
from flask import request, jsonify
from src.auth_stub import current_user
from src.config.database import db_session
from src.models.models_db import SchoolDB, ClassDB, UserActiveStateDB
from src.utils.db_helpers import get_req_data, get_teacher_active_class_object

def _is_admin():
    return getattr(current_user, 'role', None) == 'admin'


def remove_accents(input_str):
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    only_ascii = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    only_ascii = only_ascii.replace('đ', 'd').replace('Đ', 'D')
    return only_ascii

def normalize_school_name(name):
    if not name:
        return "Trường Chưa Rõ", "", "Secondary"
    
    cleaned = remove_accents(name).lower().strip()
    
    primary_keywords = ["tieu hoc", "cap 1", "primary"]
    high_keywords = ["thpt", "cap 3", "high school", "trung hoc pho thong"]
    secondary_keywords = ["thcs", "cap 2", "secondary", "trung hoc co so"]
    
    level = "Secondary"
    if any(kw in cleaned for kw in primary_keywords):
        level = "Primary"
    elif any(kw in cleaned for kw in high_keywords):
        level = "High"
    elif any(kw in cleaned for kw in secondary_keywords):
        level = "Secondary"
        
    noise_patterns = [
        r'\btruong thcs\b', r'\btruong tieu hoc\b', r'\btruong thpt\b',
        r'\btrung hoc co so\b', r'\btrung hoc pho thong\b', r'\btieu hoc\b',
        r'\bthcs\b', r'\bthpt\b', r'\bcap 1\b', r'\bcap 2\b', r'\bcap 3\b',
        r'\btruong\b', r'\bschool\b'
    ]
    
    core = cleaned
    for pattern in noise_patterns:
        core = re.sub(pattern, '', core)
        
    core = re.sub(r'[^a-z0-9]', '', core).strip()
    
    prefix = "THCS"
    if level == "Primary":
        prefix = "Tiểu học"
    elif level == "High":
        prefix = "THPT"
    
    orig_clean = name
    orig_noise = [
        r'(?i)\btrường thcs\b', r'(?i)\btrường tiểu học\b', r'(?i)\btrường thpt\b',
        r'(?i)\btrung học cơ sở\b', r'(?i)\btrung học phổ thông\b', r'(?i)\btiểu học\b',
        r'(?i)\bthcs\b', r'(?i)\bthpt\b', r'(?i)\bcấp 1\b', r'(?i)\bcấp 2\b', r'(?i)\bcấp 3\b',
        r'(?i)\btrường\b', r'(?i)\bschool\b'
    ]
    for pattern in orig_noise:
        orig_clean = re.sub(pattern, '', orig_clean)
    
    orig_clean = re.sub(r'^\s*[-:\s]+', '', orig_clean)
    orig_clean = re.sub(r'\s+[-:\s]+\s*$', '', orig_clean)
    orig_clean = re.sub(r'\s+', ' ', orig_clean).strip()
    
    proper_name = orig_clean.title()
    if not proper_name:
        proper_name = "Chưa Rõ"
        
    normalized_full_name = f"{prefix} {proper_name}"
    return normalized_full_name, core, level


def api_schools():
    if request.method == 'POST':
        data = request.get_json() or {}
        action = data.get('action')
        
        if action == 'add_school':
            name = data.get('school_name', '').strip()
            address = data.get('address', '').strip()
            logo = data.get('school_logo', '').strip()
            
            if not name:
                return jsonify({"status": "error", "message": "Tên trường không được để trống"}), 400
                
            norm_name, core, level = normalize_school_name(name)
            
            # Kiểm tra trùng lặp gần đúng
            all_schools = db_session.query(SchoolDB).all()
            for s in all_schools:
                _, s_core, s_level = normalize_school_name(s.school_name)
                if s_core == core and s_level == level:
                    return jsonify({"status": "error", "message": "Trường học này đã được tạo!"}), 400
            
            new_school = SchoolDB(
                user_id=int(current_user.id),
                school_name=norm_name,
                address=address if address else None,
                school_logo=logo if logo else None
            )
            db_session.add(new_school)
            db_session.commit()
            return jsonify({"status": "success"})
            
        if action == 'delete_school':
            school_id_val = data.get('school_id')
            school = db_session.query(SchoolDB).filter(SchoolDB.school_id == school_id_val).first()
            if not school:
                return jsonify({"status": "error", "message": "Không tìm thấy trường học"}), 404
            # Chỉ người tạo trường (hoặc admin) mới được xóa trường
            if not _is_admin() and school.user_id != int(current_user.id):
                return jsonify({"status": "error", "message": "Bạn không có quyền xóa trường học này"}), 403
            # Không xóa trường khi còn lớp của giáo viên khác (tránh mất dữ liệu của người khác)
            other_classes = db_session.query(ClassDB).filter(
                ClassDB.school_id == school.school_id,
                ClassDB.user_id != school.user_id
            ).count()
            if other_classes:
                return jsonify({"status": "error", "message": "Trường này còn lớp của giáo viên khác nên không thể xóa"}), 409
            db_session.query(SchoolDB).filter(
                SchoolDB.school_id == school.school_id
            ).delete()
            db_session.commit()
            return jsonify({"status": "success"})
            
    schools = db_session.query(SchoolDB).order_by(SchoolDB.school_name).all()
    schools_list = []
    for s in schools:
        schools_list.append({
            "school_id": s.school_id,
            "school_name": s.school_name,
            "address": s.address or "",
            "school_logo": s.school_logo or ""
        })
    return jsonify({"schools": schools_list})

def api_classes():
    if request.method == 'POST':
        data = request.get_json() or {}
        action = data.get('action')
        
        if action == 'add_class':
            grade = data.get('grade')
            class_name = data.get('suffix', '').strip()
            school_id_val = data.get('school_id')
            
            if not class_name:
                return jsonify({"status": "error", "message": "Tên lớp không được để trống"}), 400
                
            try:
                grade_val = int(grade)
            except (ValueError, TypeError):
                grade_val = 6
                
            # Trường học phải tồn tại
            if not db_session.query(SchoolDB).filter(SchoolDB.school_id == school_id_val).first():
                return jsonify({"status": "error", "message": "Trường học không tồn tại"}), 404

            # Kiểm tra trùng lớp trong cùng trường học
            exists = db_session.query(ClassDB).filter(
                ClassDB.class_name.ilike(class_name),
                ClassDB.school_id == school_id_val
            ).first()
            
            if exists:
                return jsonify({"status": "error", "message": "Lớp học này đã tồn tại trong trường!"}), 400
                
            if grade_val in [3, 4, 5]:
                school_level = "Primary"
            elif grade_val in [10, 11, 12]:
                school_level = "High"
            else:
                school_level = "Secondary"
                
            new_class = ClassDB(
                user_id=int(current_user.id),
                class_name=class_name,
                academic_year="2025-2026",
                school_level=school_level,
                grade_level=grade_val,
                school_id=school_id_val,
                is_active=False,
                is_scoring=False
            )
            db_session.add(new_class)
            db_session.commit()
            return jsonify({"status": "success"})
            
        if action == 'delete_class':
            class_to_del = data.get('class')
            school_id_val = data.get('school_id')
            # Chỉ được xóa lớp do chính mình tạo
            deleted = db_session.query(ClassDB).filter(
                ClassDB.class_name == class_to_del,
                ClassDB.school_id == school_id_val,
                ClassDB.user_id == int(current_user.id)
            ).delete()
            db_session.commit()
            if not deleted:
                return jsonify({"status": "error", "message": "Không tìm thấy lớp hoặc bạn không có quyền xóa lớp này"}), 404
            return jsonify({"status": "success"})
            
        if action == 'select_class':
            ten_lop = data.get('class')
            school_id_val = data.get('school_id')
            
            state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == int(current_user.id)).first()
            if not state:
                state = UserActiveStateDB(user_id=int(current_user.id))
                db_session.add(state)
                
            state.active_school_id = school_id_val
            if ten_lop:
                cls = db_session.query(ClassDB).filter(
                    ClassDB.class_name == ten_lop,
                    ClassDB.school_id == school_id_val,
                    ClassDB.user_id == int(current_user.id)
                ).first()
                if cls:
                    state.active_class_id = cls.class_id
                else:
                    state.active_class_id = None
            else:
                state.active_class_id = None
                
            db_session.commit()
            return jsonify({"status": "success", "class": ten_lop or ""})

    school_id_param = request.args.get('school_id')
    fmt = request.args.get('format', 'counts')  # 'counts' (default) or 'list'
    
    if not school_id_param:
        active_c = get_teacher_active_class_object(int(current_user.id))
        if active_c:
            school_id_param = active_c.school_id
        else:
            state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == int(current_user.id)).first()
            if state:
                school_id_param = state.active_school_id

    # Chỉ liệt kê lớp của chính giáo viên đang đăng nhập
    query = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if school_id_param:
        query = query.filter(ClassDB.school_id == school_id_param)
        
    classes = query.all()
    
    if fmt == 'list':
        result = [{
            "class_id": c.class_id,
            "class_name": c.class_name,
            "grade_level": c.grade_level,
            "school_level": c.school_level,
            "practice_enabled": bool(c.practice_enabled)
        } for c in classes]
        result = sorted(result, key=lambda x: x['class_name'])
        return jsonify(result)
    
    counts = {'3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '10': [], '11': [], '12': []}
    for c in classes:
        grade = str(c.grade_level)
        if grade not in counts:
            counts[grade] = []
        name = c.class_name
        if name not in counts[grade]:
            counts[grade].append(name)
            
    def natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
        
    for g in counts:
        counts[g] = sorted(counts[g], key=natural_sort_key)
        
    active_c = get_teacher_active_class_object(int(current_user.id))
    active_school_id = None
    if active_c:
        active_school_id = active_c.school_id
    else:
        state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == int(current_user.id)).first()
        if state:
            active_school_id = state.active_school_id
        
    return jsonify({
        "counts": counts, 
        "active_class": active_c.class_name if active_c else "",
        "active_school_id": active_school_id
    })

def handle_set_scoring():
    data = get_req_data()
    scoring_class = data.get('class', '').strip()
    
    state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == int(current_user.id)).first()
    active_school_id = state.active_school_id if state else None
    
    cls = None
    if active_school_id and scoring_class:
        cls = db_session.query(ClassDB).filter(
            ClassDB.class_name == scoring_class,
            ClassDB.school_id == active_school_id,
            ClassDB.user_id == int(current_user.id)
        ).first()
        
    if not state:
        state = UserActiveStateDB(user_id=int(current_user.id))
        db_session.add(state)
        
    state.scoring_class_id = cls.class_id if cls else None
    db_session.commit()
    return jsonify({"status": "success"})

