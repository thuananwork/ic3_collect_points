import json
from datetime import datetime, timedelta
from flask import request, jsonify
from flask_login import login_required, current_user

from src.config.database import db_session
from src.models.models_db import ClassDB, StudentDB, ClassQuizDB, QuizAttemptDB, WorkstationDB
from src.middleware.auth import permission_required
from .quiz import quiz_bp, get_teacher_classroom

# --- TEACHER ENDPOINTS ---

@quiz_bp.route('/api/teacher/classes/<int:class_id>/practice', methods=['GET', 'PUT'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def toggle_class_practice(class_id):
    classroom = get_teacher_classroom(class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học không thuộc quản lý của bạn"}), 403
        
    if request.method == 'GET':
        return jsonify({
            "status": "success",
            "class_id": classroom.class_id,
            "class_name": classroom.class_name,
            "practice_enabled": bool(classroom.practice_enabled)
        })
        
    data = request.get_json() or {}
    practice_enabled = bool(data.get('practice_enabled', False))
    scope = data.get('scope', 'class') # 'class' or 'grade'
    
    classroom.practice_enabled = practice_enabled
    
    # Update workstations ban status accordingly (linked ban)
    ban_status = not practice_enabled
    db_session.query(WorkstationDB).filter(WorkstationDB.class_id == classroom.class_id).update({WorkstationDB.ban_training: ban_status})
    
    if scope == 'grade':
        other_classes = db_session.query(ClassDB).filter(
            ClassDB.user_id == classroom.user_id,
            ClassDB.school_id == classroom.school_id,
            ClassDB.school_level == classroom.school_level,
            ClassDB.grade_level == classroom.grade_level,
            ClassDB.class_id != classroom.class_id
        ).all()
        for oc in other_classes:
            oc.practice_enabled = practice_enabled
            
        other_class_ids = [oc.class_id for oc in other_classes]
        if other_class_ids:
            db_session.query(WorkstationDB).filter(WorkstationDB.class_id.in_(other_class_ids)).update({WorkstationDB.ban_training: ban_status})
            
    db_session.commit()
    msg = f"Đã {'cho phép' if practice_enabled else 'chặn'} tự luyện tập cho {'Khối ' + str(classroom.grade_level) if scope == 'grade' else 'Lớp ' + classroom.class_name} thành công!"
    return jsonify({"status": "success", "message": msg})



@quiz_bp.route('/api/teacher/class-quizzes', methods=['POST'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def assign_class_quiz():
    data = request.get_json() or {}
    class_id = data.get('class_id')
    quiz_id = data.get('quiz_id')
    time_limit = data.get('time_limit')
    quiz_mode = data.get('quiz_mode')
    
    if not class_id or not quiz_id:
        return jsonify({"status": "error", "message": "Thiếu thông tin lớp hoặc đề thi"}), 400
        
    classroom = get_teacher_classroom(class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học không thuộc quản lý của bạn"}), 403
        
    # Deactivate existing active class_quizzes for this class (only one active quiz per class at a time)
    db_session.query(ClassQuizDB).filter(
        ClassQuizDB.class_id == class_id,
        ClassQuizDB.status == 'active'
    ).update({ClassQuizDB.status: 'completed'})
    
    try:
        time_limit_val = int(time_limit) if time_limit is not None else None
    except:
        time_limit_val = None
        
    if quiz_mode not in ('training', 'testing', 'practice'):
        quiz_mode = None

    try:
        random_count = int(data.get('random_question_count')) if data.get('random_question_count') not in (None, '') else None
    except (TypeError, ValueError):
        random_count = None
    if random_count is not None and random_count <= 0:
        random_count = None
        
    custom_pin = data.get('pin_code')
    if custom_pin and len(str(custom_pin).strip()) == 5 and str(custom_pin).strip().isalnum():
        pin_code = str(custom_pin).strip().upper()
    else:
        import random
        import string
        pin_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        
    cq = ClassQuizDB(
        class_id=class_id,
        quiz_id=quiz_id,
        assigned_by=int(current_user.id),
        status='active',
        assigned_at=datetime.utcnow(),
        time_limit_override=time_limit_val,
        quiz_mode_override=quiz_mode,
        pin_code=pin_code,
        random_question_count=random_count
    )
    db_session.add(cq)
    db_session.commit()
    
    return jsonify({
        "status": "success",
        "message": "Đã giao đề trắc nghiệm thành công",
        "class_quiz_id": cq.class_quiz_id,
        "pin_code": pin_code
    })


@quiz_bp.route('/api/teacher/class-quizzes/<int:class_quiz_id>/status', methods=['PUT'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def update_class_quiz_status(class_quiz_id):
    cq = db_session.query(ClassQuizDB).filter(ClassQuizDB.class_quiz_id == class_quiz_id).first()
    if not cq:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    classroom = get_teacher_classroom(cq.class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học không thuộc quản lý của bạn"}), 403
        
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('active', 'completed'):
        return jsonify({"status": "error", "message": "Trạng thái không hợp lệ"}), 400
        
    cq.status = status
    db_session.commit()
    
    return jsonify({"status": "success", "message": f"Đã cập nhật trạng thái đề thi thành công: {status}"})


@quiz_bp.route('/api/teacher/class-quizzes/active', methods=['GET'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def get_teacher_class_quizzes():
    school_id_param = request.args.get('school_id')
    if school_id_param:
        try:
            active_school_id = int(school_id_param)
        except ValueError:
            from src.utils.db_helpers import get_teacher_active_school_id
            active_school_id = get_teacher_active_school_id(int(current_user.id))
    else:
        from src.utils.db_helpers import get_teacher_active_school_id
        active_school_id = get_teacher_active_school_id(int(current_user.id))
        
    query = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if active_school_id:
        query = query.filter(ClassDB.school_id == active_school_id)
    classes = query.all()
    class_ids = [c.class_id for c in classes]
    
    if not class_ids:
        return jsonify([])
        
    active_quizzes = db_session.query(ClassQuizDB).filter(
        ClassQuizDB.class_id.in_(class_ids),
        ClassQuizDB.assigned_by.isnot(None)
    ).order_by(ClassQuizDB.assigned_at.desc()).limit(10).all()
    
    res = []
    for cq in active_quizzes:
        res.append({
            "class_quiz_id": cq.class_quiz_id,
            "class_id": cq.class_id,
            "class_name": cq.classroom.class_name,
            "quiz_id": cq.quiz_id,
            "quiz_title": cq.quiz.title,
            "status": cq.status,
            "assigned_at": cq.assigned_at.strftime('%Y-%m-%d %H:%M:%S'),
            "time_limit": cq.time_limit_override if cq.time_limit_override is not None else cq.quiz.time_limit,
            "quiz_mode": cq.quiz_mode_override if cq.quiz_mode_override is not None else (cq.quiz.quiz_mode or "testing"),
            "pin_code": cq.pin_code
        })
    return jsonify(res)


@quiz_bp.route('/api/teacher/class-quizzes/<int:class_quiz_id>/proctor', methods=['GET'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def get_live_proctor(class_quiz_id):
    cq = db_session.query(ClassQuizDB).filter(ClassQuizDB.class_quiz_id == class_quiz_id).first()
    if not cq:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    classroom = get_teacher_classroom(cq.class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học không thuộc quản lý của bạn"}), 403
        
    students = db_session.query(StudentDB).filter(StudentDB.class_id == cq.class_id).all()
    attempts = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.class_quiz_id == class_quiz_id).order_by(QuizAttemptDB.attempt_id.asc()).all()
    attempts_map = {att.student_id: att for att in attempts}
    
    # Get all class_quiz_ids that share the same quiz_id to count all attempts & max score
    all_cq_ids = [x[0] for x in db_session.query(ClassQuizDB.class_quiz_id).filter(ClassQuizDB.quiz_id == cq.quiz_id).all()]
    all_attempts = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.class_quiz_id.in_(all_cq_ids)).all()
    
    student_attempts_info = {}
    for att in all_attempts:
        s_id = att.student_id
        if s_id not in student_attempts_info:
            student_attempts_info[s_id] = {
                "attempts": [],
                "completed_scores": []
            }
        student_attempts_info[s_id]["attempts"].append(att)
        if att.status in ('submitted', 'auto_submitted') and att.score_achieved is not None:
            student_attempts_info[s_id]["completed_scores"].append(float(att.score_achieved))
            
    from src.models.models_db import QuestionDB
    total_q = db_session.query(QuestionDB).filter(QuestionDB.quiz_id == cq.quiz_id).count()
    
    from sqlalchemy.orm import joinedload
    # Pre-fetch all active workstations for the class, eager loading their computers
    workstations = db_session.query(WorkstationDB).options(joinedload(WorkstationDB.computer)).filter(
        WorkstationDB.class_id == cq.class_id,
        WorkstationDB.is_draft == False
    ).all()
    workstations_map = {ws.student_id: ws for ws in workstations if ws.student_id is not None}
    
    proctor_data = []
    for st in students:
        att = attempts_map.get(st.student_id)
        answered_count = 0
        if att and att.answers_json:
            try:
                answers = json.loads(att.answers_json)
                if isinstance(answers, dict):
                    answered_count = sum(1 for k, v in answers.items() if v is not None and v != "" and v != [])
            except:
                pass
                
        ws = workstations_map.get(st.student_id)
        pc_name = ws.computer.pc_name if ws and ws.computer else "Chưa xếp máy"
        workstation_id = ws.workstation_id if ws else None
        ban_training = ws.ban_training if ws else False
        
        target_score = ws.target_score if ws and ws.target_score is not None else (st.default_target_score if st else None)
        
        st_info = student_attempts_info.get(st.student_id, {"attempts": [], "completed_scores": []})
        attempt_count = len(st_info["attempts"])
        max_score = max(st_info["completed_scores"]) if st_info["completed_scores"] else None
        
        proctor_data.append({
            "student_id": st.student_id,
            "full_name": st.full_name,
            "pc_name": pc_name,
            "has_attempt": att is not None,
            "attempt_id": att.attempt_id if att else None,
            "status": att.status if att else "not_started",
            "score_achieved": float(att.score_achieved) if att else None,
            "duration_seconds": att.duration_seconds if att else 0,
            "cheat_warnings_count": att.cheat_warnings_count if att else 0,
            "answered_count": answered_count,
            "total_questions": total_q,
            "started_at": att.started_at.strftime('%Y-%m-%d %H:%M:%S') if att and att.started_at else None,
            "completed_at": att.completed_at.strftime('%Y-%m-%d %H:%M:%S') if att and att.completed_at else None,
            "target_score": target_score,
            "workstation_id": workstation_id,
            "ban_training": ban_training,
            "attempt_count": attempt_count,
            "max_score": max_score
        })
        
    return jsonify({
        "class_quiz_id": class_quiz_id,
        "quiz_title": cq.quiz.title,
        "class_name": cq.classroom.class_name,
        "time_limit": cq.time_limit_override if cq.time_limit_override is not None else cq.quiz.time_limit,
        "quiz_mode": cq.quiz_mode_override if cq.quiz_mode_override is not None else (cq.quiz.quiz_mode or "testing"),
        "pin_code": cq.pin_code,
        "proctor_students": proctor_data
    })


@quiz_bp.route('/api/teacher/class-quizzes/<int:class_quiz_id>/pin', methods=['PUT'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def update_class_quiz_pin(class_quiz_id):
    cq = db_session.query(ClassQuizDB).filter(ClassQuizDB.class_quiz_id == class_quiz_id).first()
    if not cq:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    classroom = get_teacher_classroom(cq.class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học không thuộc quản lý của bạn"}), 403
        
    data = request.get_json() or {}
    pin_code = data.get('pin_code')
    if not pin_code:
        return jsonify({"status": "error", "message": "Mã PIN không được để trống"}), 400
        
    pin_code = str(pin_code).strip()
    if not pin_code.isalnum() or len(pin_code) != 5:
        return jsonify({"status": "error", "message": "Mã PIN phải gồm đúng 5 ký tự chữ hoặc số"}), 400
        
    cq.pin_code = pin_code.upper()
    db_session.commit()
    
    return jsonify({"status": "success", "message": "Đã cập nhật mã PIN thành công", "pin_code": pin_code})


@quiz_bp.route('/api/teacher/classes/practice', methods=['GET'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def get_teacher_classes_practice():
    from src.utils.db_helpers import get_teacher_active_school_id
    active_school_id = get_teacher_active_school_id(int(current_user.id))
    query = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if active_school_id:
        query = query.filter(ClassDB.school_id == active_school_id)
    classes = query.all()
        
    res = []
    for c in classes:
        res.append({
            "class_id": c.class_id,
            "class_name": c.class_name,
            "grade_level": c.grade_level,
            "practice_enabled": bool(c.practice_enabled)
        })
    return jsonify(res)


@quiz_bp.route('/api/teacher/attempts/<int:attempt_id>', methods=['DELETE'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def delete_student_attempt(attempt_id):
    attempt = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.attempt_id == attempt_id).first()
    if not attempt:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt làm bài"}), 404
        
    class_id = attempt.class_quiz.class_id if attempt.class_quiz else None
    if not class_id:
        return jsonify({"status": "error", "message": "Lượt thi không có thông tin lớp học hợp lệ"}), 400
        
    classroom = get_teacher_classroom(class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học của lượt thi này không thuộc quản lý của bạn"}), 403
        
    try:
        db_session.delete(attempt)
        db_session.commit()
        return jsonify({"status": "success", "message": "Đã hủy lượt làm bài thành công!"})
    except Exception as e:
        db_session.rollback()
        return jsonify({"status": "error", "message": f"Lỗi khi hủy lượt làm bài: {str(e)}"}), 500


@quiz_bp.route('/api/teacher/workstations/<int:workstation_id>/ban-training', methods=['PUT'])
@login_required
@permission_required('trac_nghiem_ly_thuyet')
def toggle_workstation_ban_training(workstation_id):
    ws = db_session.query(WorkstationDB).filter(WorkstationDB.workstation_id == workstation_id).first()
    if not ws:
        return jsonify({"status": "error", "message": "Không tìm thấy thông tin máy trạm"}), 404
        
    classroom = get_teacher_classroom(ws.class_id)
    if not classroom:
        return jsonify({"status": "error", "message": "Lớp học chứa máy trạm này không thuộc quản lý của bạn"}), 403
        
    data = request.get_json() or {}
    ban_training = bool(data.get('ban_training', False))
    
    try:
        ws.ban_training = ban_training
        db_session.commit()
        msg = f"Đã {'khóa' if ban_training else 'mở'} ôn luyện cho máy thành công!"
        return jsonify({"status": "success", "message": msg})
    except Exception as e:
        db_session.rollback()
        return jsonify({"status": "error", "message": f"Lỗi khi cập nhật trạng thái cấm máy: {str(e)}"}), 500

