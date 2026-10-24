import hmac
import json
import random
import uuid
from datetime import datetime, timedelta
from flask import request, jsonify

from src.config.database import db_session
from src.models.models_db import QuizDB, QuestionDB, ClassQuizDB, QuizAttemptDB, StudentDB, ScoreDB, WorkstationDB, SchoolDB, KnowledgeArticleDB, ClassDB
from src.utils.db_helpers import get_or_create_computer
from src.utils.rate_limit import limiter
from .quiz import quiz_bp, check_answer, delete_expired_student_data

# Giới hạn nhập sai mã PIN phòng thi: tối đa PIN_MAX_FAILS lần sai / PIN_WINDOW_SECONDS giây
# cho mỗi cặp (địa chỉ IP, class_quiz) để chặn dò PIN.
PIN_MAX_FAILS = 20
PIN_WINDOW_SECONDS = 300


def _attempt_token_ok(attempt):
    """Chỉ thiết bị đã bắt đầu lượt thi (giữ session_token) mới được lưu/nộp/xem kết quả.

    Token lấy từ JSON body (`session_token`) hoặc query (`token`). Lượt thi cũ chưa có
    token thì cho qua để không làm hỏng dữ liệu đã tồn tại.
    """
    expected = attempt.session_token
    if not expected:
        return True
    supplied = None
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        supplied = body.get('session_token')
    if not supplied:
        supplied = request.args.get('token')
    if not supplied:
        return False
    return hmac.compare_digest(str(supplied).encode('utf-8'), str(expected).encode('utf-8'))


def _token_denied():
    return jsonify({"status": "error", "message": "Phiên làm bài không hợp lệ. Vui lòng vào lại bài thi trên đúng thiết bị đã bắt đầu."}), 403


# Thời gian chờ thêm (giây) sau khi hết giờ trước khi server coi bài nộp là muộn.
# Bù cho độ trễ mạng và lệch đồng hồ giữa máy học sinh và server.
EXAM_GRACE_SECONDS = 30
MAX_CHEAT_WARNINGS = 1000
# Đủ số cảnh báo này thì server tự chốt bài, không phụ thuộc client
CHEAT_AUTO_SUBMIT = 3


def _attempt_limit_seconds(attempt):
    """Giới hạn thời gian làm bài của lượt thi, tính bằng giây (khớp mặc định 45 phút của client)."""
    cq = attempt.class_quiz
    minutes = cq.time_limit_override if cq.time_limit_override is not None else cq.quiz.time_limit
    return int(minutes or 45) * 60


def _attempt_elapsed_seconds(attempt):
    """Số giây đã trôi qua kể từ lúc server tạo lượt thi (không tin đồng hồ của client)."""
    if not attempt.started_at:
        return 0
    return max(0, int((datetime.utcnow() - attempt.started_at).total_seconds()))


def _past_deadline(attempt):
    return _attempt_elapsed_seconds(attempt) > _attempt_limit_seconds(attempt) + EXAM_GRACE_SECONDS


def _server_duration(attempt):
    return min(_attempt_elapsed_seconds(attempt), _attempt_limit_seconds(attempt))


def _attempt_questions(attempt, questions):
    """Lọc đề theo số câu bốc ngẫu nhiên của lượt giao; mỗi lượt thi bốc một bộ khác nhau, cố định theo attempt_id."""
    n = getattr(attempt.class_quiz, 'random_question_count', None)
    if not n or n <= 0 or n >= len(questions):
        return questions
    ordered = sorted(questions, key=lambda q: q.question_id)
    picked = random.Random(attempt.attempt_id * 7919 + 17).sample(ordered, n)
    ids = {q.question_id for q in picked}
    return [q for q in questions if q.question_id in ids]


def _merge_cheat_count(attempt, reported):
    """Số cảnh báo chỉ được tăng, không thể bị client hạ xuống 0."""
    try:
        n = int(reported)
    except (TypeError, ValueError):
        n = 0
    n = max(0, min(n, MAX_CHEAT_WARNINGS))
    return max(attempt.cheat_warnings_count or 0, n)

# --- PUBLIC STUDENT ENDPOINTS ---

@quiz_bp.route('/api/public/quizzes', methods=['GET'])
def public_quizzes():
    quizzes = db_session.query(QuizDB).filter(QuizDB.is_published == True).order_by(QuizDB.created_at.desc()).all()
    res = []
    for q in quizzes:
        res.append({
            "quiz_id": q.quiz_id,
            "title": q.title,
            "description": q.description or "",
            "time_limit": q.time_limit,
            "school_level": q.school_level or "",
            "grade_level": q.grade_level,
            "quiz_mode": q.quiz_mode or "testing",
            "allow_practice": q.allow_practice,
            "question_count": len(q.questions)
        })
    return jsonify(res)

@quiz_bp.route('/api/public/schools', methods=['GET'])
def public_schools():
    schools = db_session.query(SchoolDB).all()
    seen = set()
    res = []
    for s in schools:
        if s.school_name not in seen:
            seen.add(s.school_name)
            res.append({
                "school_id": s.school_id,
                "school_name": s.school_name
            })
    # Sort alphabetically
    res = sorted(res, key=lambda x: x['school_name'])
    return jsonify(res)


@quiz_bp.route('/api/public/schools/<int:school_id>/classes', methods=['GET'])
def public_classes(school_id):
    classes = db_session.query(ClassDB).filter(
        ClassDB.school_id == school_id
    ).all()
    res = []
    for c in classes:
        res.append({
            "class_id": c.class_id,
            "class_name": c.class_name,
            "grade_level": c.grade_level,
            "school_level": c.school_level,
            "practice_enabled": bool(c.practice_enabled)
        })
    res = sorted(res, key=lambda x: x['class_name'])
    return jsonify(res)


@quiz_bp.route('/api/public/classes/<int:class_id>/students', methods=['GET'])
def public_students(class_id):
    students = db_session.query(StudentDB).filter(StudentDB.class_id == class_id).order_by(StudentDB.full_name).all()
    res = []
    for s in students:
        res.append({
            "student_id": s.student_id,
            "full_name": s.full_name
        })
    return jsonify(res)


@quiz_bp.route('/api/public/classes/<int:class_id>/active-quizzes', methods=['GET'])
def public_active_quizzes(class_id):
    # Auto-deactivate any active class quizzes older than 12 hours to prevent duplicates
    try:
        limit_time = datetime.utcnow() - timedelta(hours=12)
        db_session.query(ClassQuizDB).filter(
            ClassQuizDB.status == 'active',
            ClassQuizDB.assigned_at < limit_time
        ).update({ClassQuizDB.status: 'completed'}, synchronize_session=False)
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        print(f"[Active Quiz Cleanup] Error deactivating stale sessions: {e}")

    cq_list = db_session.query(ClassQuizDB).filter(
        ClassQuizDB.class_id == class_id,
        ClassQuizDB.status == 'active',
        ClassQuizDB.assigned_by.isnot(None)
    ).all()
    res = []
    for cq in cq_list:
        res.append({
            "class_quiz_id": cq.class_quiz_id,
            "quiz_id": cq.quiz_id,
            "title": cq.quiz.title,
            "description": cq.quiz.description or "",
            "time_limit": cq.time_limit_override if cq.time_limit_override is not None else cq.quiz.time_limit,
            "has_pin": bool(cq.pin_code)
        })
    return jsonify(res)

@quiz_bp.route('/api/public/active-sessions-exist', methods=['GET'])
def active_sessions_exist():
    try:
        limit_time = datetime.utcnow() - timedelta(hours=12)
        db_session.query(ClassQuizDB).filter(
            ClassQuizDB.status == 'active',
            ClassQuizDB.assigned_at < limit_time
        ).update({ClassQuizDB.status: 'completed'}, synchronize_session=False)
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        print(f"[Active Quiz Cleanup] Error deactivating stale sessions: {e}")

    exists = db_session.query(ClassQuizDB).filter(
        ClassQuizDB.status == 'active',
        ClassQuizDB.assigned_by.isnot(None)
    ).first()
    return jsonify({"exists": bool(exists)})

@quiz_bp.route('/api/public/attempts/start', methods=['POST'])
def start_quiz_attempt():
    # Automatically clean up any quiz attempts and scores older than 48 hours
    delete_expired_student_data()

    data = request.get_json() or {}
    class_quiz_id = data.get('class_quiz_id')
    quiz_id = data.get('quiz_id')
    student_id = data.get('student_id')
    
    if not student_id:
        return jsonify({"status": "error", "message": "Thiếu thông tin học sinh"}), 400
        
    student = db_session.query(StudentDB).filter(StudentDB.student_id == student_id).first()
    if not student:
        return jsonify({"status": "error", "message": "Không tìm thấy học sinh trong danh sách"}), 400

    # Determine quiz_id if not present
    if not quiz_id and class_quiz_id:
        cq_temp = db_session.query(ClassQuizDB).filter(ClassQuizDB.class_quiz_id == class_quiz_id).first()
        if cq_temp:
            quiz_id = cq_temp.quiz_id

    if not quiz_id:
        return jsonify({"status": "error", "message": "Thiếu thông tin đề thi"}), 400

    quiz = db_session.query(QuizDB).filter(QuizDB.quiz_id == quiz_id).first()
    if not quiz:
        return jsonify({"status": "error", "message": "Không tìm thấy đề thi"}), 400

    # Determine effective mode
    requested_mode = data.get('quiz_mode')
    # Đề đang được giáo viên giao (active) thì chế độ do giáo viên quyết định, học sinh
    # không tự chọn ôn luyện/tự luyện để xem đáp án trong lúc đề đang thi.
    cq_active = db_session.query(ClassQuizDB).filter(
        ClassQuizDB.class_id == student.class_id,
        ClassQuizDB.quiz_id == quiz_id,
        ClassQuizDB.status == 'active',
        ClassQuizDB.assigned_by.isnot(None)
    ).first()
    if cq_active:
        effective_mode = cq_active.quiz_mode_override if cq_active.quiz_mode_override is not None else "testing"
    elif requested_mode in ('training', 'testing', 'practice'):
        effective_mode = requested_mode
    else:
        # Check if ClassQuiz exists
        cq_temp = db_session.query(ClassQuizDB).filter(
            ClassQuizDB.class_id == student.class_id,
            ClassQuizDB.quiz_id == quiz_id
        ).first()
        if cq_temp:
            effective_mode = cq_temp.quiz_mode_override if cq_temp.quiz_mode_override is not None else "testing"
        else:
            effective_mode = quiz.quiz_mode or "testing"

    if effective_mode in ('training', 'practice'):
        from src.models.models_db import ClassDB
        classroom = db_session.query(ClassDB).filter(ClassDB.class_id == student.class_id).first()
        practice_enabled_class = bool(classroom.practice_enabled) if classroom else True
        
        ws = db_session.query(WorkstationDB).filter(
            WorkstationDB.class_id == student.class_id,
            WorkstationDB.student_id == student_id,
            WorkstationDB.is_draft == False
        ).first()
        
        is_banned = False
        if practice_enabled_class:
            if ws and ws.ban_training:
                is_banned = True
        else:
            if not ws or ws.ban_training:
                is_banned = True
                
        if is_banned:
            return jsonify({
                "status": "error",
                "message": "Chế độ ôn luyện / tự luyện tập đề thi hiện không được mở cho bạn. Vui lòng liên hệ giáo viên."
            }), 403

    # Check for active teacher-assigned class quiz
    cq_teacher = db_session.query(ClassQuizDB).filter(
        ClassQuizDB.class_id == student.class_id,
        ClassQuizDB.quiz_id == quiz_id,
        ClassQuizDB.status == 'active',
        ClassQuizDB.assigned_by.isnot(None)
    ).first()

    # --- CASE A: Active teacher-assigned class quiz & effective_mode is testing ---
    if cq_teacher and effective_mode == 'testing':
        class_quiz_id = cq_teacher.class_quiz_id

        # Verify PIN code if it is configured for this class quiz
        if cq_teacher.pin_code:
            pin_key = f"pin:{request.remote_addr}:{cq_teacher.class_quiz_id}"
            if limiter.count(pin_key, PIN_WINDOW_SECONDS) >= PIN_MAX_FAILS:
                return jsonify({
                    "status": "error",
                    "pin_required": True,
                    "message": "Nhập sai mã PIN quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."
                }), 429
            provided_pin = data.get('pin_code')
            if not provided_pin:
                return jsonify({
                    "status": "error",
                    "pin_required": True,
                    "message": "Vui lòng nhập mã PIN phòng thi để vào làm bài."
                }), 400
            elif str(provided_pin).strip().upper() != cq_teacher.pin_code.upper():
                limiter.record(pin_key)
                return jsonify({
                    "status": "error",
                    "pin_required": True,
                    "message": "Mã PIN phòng thi không chính xác. Vui lòng nhập lại."
                }), 400
            limiter.clear(pin_key)

        # Clean up expired 'inprogress' attempts for this student to prevent timeout alert upon re-entry
        expired_attempts = db_session.query(QuizAttemptDB).filter(
            QuizAttemptDB.student_id == student_id,
            QuizAttemptDB.status == 'inprogress'
        ).all()
        
        for ea in expired_attempts:
            ea_cq = ea.class_quiz
            if ea_cq and ea_cq.quiz:
                ea_limit_minutes = ea_cq.time_limit_override if ea_cq.time_limit_override is not None else ea_cq.quiz.time_limit
                if not ea_limit_minutes:
                    ea_limit_minutes = 45
                ea_limit_seconds = ea_limit_minutes * 60
                
                elapsed = (datetime.utcnow() - ea.started_at).total_seconds()
                if elapsed > ea_limit_seconds:
                    try:
                        ea.status = 'auto_submitted'
                        ea.completed_at = ea.started_at + timedelta(seconds=ea_limit_seconds)
                        ea.duration_seconds = ea_limit_seconds
                        
                        ea_answers = {}
                        if ea.answers_json:
                            try:
                                ea_answers = json.loads(ea.answers_json)
                            except:
                                pass
                        
                        ea_score = 0.0
                        ea_questions = db_session.query(QuestionDB).filter(QuestionDB.quiz_id == ea_cq.quiz_id).all()
                        for q in ea_questions:
                            student_ans = ea_answers.get(str(q.question_id))
                            try:
                                correct_ans = json.loads(q.correct_answer_json)
                            except:
                                correct_ans = q.correct_answer_json
                            if check_answer(q.question_type, correct_ans, student_ans):
                                ea_score += float(q.points)
                        ea.score_achieved = ea_score
                        
                        ws = db_session.query(WorkstationDB).filter(
                            WorkstationDB.class_id == ea_cq.class_id,
                            WorkstationDB.student_id == student_id,
                            WorkstationDB.is_draft == False
                        ).first()
                        if ws:
                            computer_id = ws.computer_id
                        else:
                            comp = get_or_create_computer(ea_cq.assigned_by, "Quiz")
                            computer_id = comp.computer_id
                            
                        new_score = ScoreDB(
                            class_id=ea_cq.class_id,
                            student_id=student_id,
                            computer_id=computer_id,
                            exam_code=f"Quiz: {ea_cq.quiz.title}"[:50],
                            score_achieved=ea_score,
                            duration_seconds=ea_limit_seconds,
                            raw_html_content=f"Quiz Attempt {ea.attempt_id} auto-submitted (backend cleanup) due to expiration."
                        )
                        db_session.add(new_score)
                        db_session.flush()
                    except Exception as e:
                        print(f"Error auto-submitting expired attempt {ea.attempt_id}: {e}")
                        
        db_session.commit()

        # Check for duplicate student name selection or completed attempts rules
        existing_attempt = db_session.query(QuizAttemptDB).filter(
            QuizAttemptDB.class_quiz_id == class_quiz_id,
            QuizAttemptDB.student_id == student_id
        ).order_by(QuizAttemptDB.attempt_id.desc()).first()

        req_session_token = data.get('session_token')
        attempt = None

        if existing_attempt:
            if existing_attempt.status == 'inprogress':
                # Check session token to see if it matches
                if existing_attempt.session_token and existing_attempt.session_token != req_session_token:
                    return jsonify({
                        "status": "error",
                        "message": "Tên học sinh này đã được đăng ký làm bài trên thiết bị khác. Vui lòng chọn đúng tên của mình hoặc liên hệ Giáo viên."
                    }), 403
                else:
                    attempt = existing_attempt
            else:
                # Allow starting a new attempt
                attempt = None

        if not attempt:
            new_session_token = uuid.uuid4().hex
            attempt = QuizAttemptDB(
                class_quiz_id=class_quiz_id,
                student_id=student_id,
                score_achieved=0,
                duration_seconds=0,
                answers_json="{}",
                cheat_warnings_count=0,
                status='inprogress',
                quiz_mode=effective_mode,
                session_token=new_session_token,
                started_at=datetime.utcnow()
            )
            db_session.add(attempt)
            db_session.commit()
        else:
            # Update mode if it changed
            attempt.quiz_mode = effective_mode
            if not attempt.session_token:
                attempt.session_token = req_session_token or uuid.uuid4().hex
            db_session.commit()
            
        questions_db = _attempt_questions(attempt, db_session.query(QuestionDB).filter(QuestionDB.quiz_id == quiz_id).all())
        questions_list = []
        for q in questions_db:
            try:
                opts = json.loads(q.options_json)
            except:
                opts = q.options_json
                
            q_item = {
                "question_id": q.question_id,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "image_url": q.image_url or "",
                "options": opts,
                "points": q.points
            }
            questions_list.append(q_item)

        # Shuffle questions deterministically
        rnd = random.Random(attempt.attempt_id)
        rnd.shuffle(questions_list)
        
        # Shuffle options deterministically
        for item in questions_list:
            opts = item["options"]
            if isinstance(opts, list):
                opts_copy = list(opts)
                opt_rnd = random.Random(attempt.attempt_id + item["question_id"])
                opt_rnd.shuffle(opts_copy)
                item["options"] = opts_copy
            elif isinstance(opts, dict):
                opts_copy = dict(opts)
                if 'left' in opts_copy and isinstance(opts_copy['left'], list):
                    left_copy = list(opts_copy['left'])
                    left_rnd = random.Random(attempt.attempt_id + item["question_id"] + 1)
                    left_rnd.shuffle(left_copy)
                    opts_copy['left'] = left_copy
                if 'right' in opts_copy and isinstance(opts_copy['right'], list):
                    right_copy = list(opts_copy['right'])
                    right_rnd = random.Random(attempt.attempt_id + item["question_id"] + 2)
                    right_rnd.shuffle(right_copy)
                    opts_copy['right'] = right_copy
                item["options"] = opts_copy
            
        return jsonify({
            "status": "success",
            "attempt_id": attempt.attempt_id,
            "session_token": attempt.session_token,
            "quiz_title": cq_teacher.quiz.title,
            "quiz_description": cq_teacher.quiz.description or "",
            "time_limit": cq_teacher.time_limit_override if cq_teacher.time_limit_override is not None else cq_teacher.quiz.time_limit,
            "quiz_mode": effective_mode,
            "started_at": attempt.started_at.strftime('%Y-%m-%d %H:%M:%S'),
            "cheat_warnings_count": attempt.cheat_warnings_count,
            "answers": json.loads(attempt.answers_json) if attempt.answers_json else {},
            "questions": questions_list
        })

    # --- CASE B: Offline/Practice at home (no active teacher-assigned quiz or training/practice mode selected) ---
    else:
        # Check practice mode constraints on quiz
        if not quiz.allow_practice:
            return jsonify({
                "status": "error",
                "message": "Đề thi này hiện không được kích hoạt cho lớp của bạn. Vui lòng liên hệ Giáo viên để mở đề."
            }), 403

        # Prepare questions with correct answers and explanations directly
        questions_db = db_session.query(QuestionDB).filter(QuestionDB.quiz_id == quiz_id).all()
        questions_list = []
        for q in questions_db:
            try:
                opts = json.loads(q.options_json)
            except:
                opts = q.options_json
            
            try:
                correct = json.loads(q.correct_answer_json)
            except:
                correct = q.correct_answer_json

            q_item = {
                "question_id": q.question_id,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "image_url": q.image_url or "",
                "options": opts,
                "points": q.points,
                "correct_answer": correct,
                "explanation": q.explanation or ""
            }
            questions_list.append(q_item)

        # Shuffle if Testing or Practice mode
        if effective_mode in ('testing', 'practice'):
            offline_seed = random.randint(1, 1000000)
            rnd = random.Random(offline_seed)
            rnd.shuffle(questions_list)
            
            # Shuffle options
            for item in questions_list:
                opts = item["options"]
                if isinstance(opts, list):
                    opts_copy = list(opts)
                    opt_rnd = random.Random(offline_seed + item["question_id"])
                    opt_rnd.shuffle(opts_copy)
                    item["options"] = opts_copy
                elif isinstance(opts, dict):
                    opts_copy = dict(opts)
                    if 'left' in opts_copy and isinstance(opts_copy['left'], list):
                        left_copy = list(opts_copy['left'])
                        left_rnd = random.Random(offline_seed + item["question_id"] + 1)
                        left_rnd.shuffle(left_copy)
                        opts_copy['left'] = left_copy
                    if 'right' in opts_copy and isinstance(opts_copy['right'], list):
                        right_copy = list(opts_copy['right'])
                        right_rnd = random.Random(offline_seed + item["question_id"] + 2)
                        right_rnd.shuffle(right_copy)
                        opts_copy['right'] = right_copy
                    item["options"] = opts_copy

        return jsonify({
            "status": "success",
            "attempt_id": -1,
            "session_token": "local",
            "quiz_title": quiz.title,
            "quiz_description": quiz.description or "",
            "time_limit": quiz.time_limit,
            "quiz_mode": effective_mode,
            "started_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            "cheat_warnings_count": 0,
            "answers": {},
            "questions": questions_list
        })


def _grade_attempt(attempt, answers):
    """Chấm bài (không ghi CSDL). Trả về (tổng điểm, chi tiết từng câu)."""
    quiz_id = attempt.class_quiz.quiz_id
    questions = _attempt_questions(attempt, db_session.query(QuestionDB).filter(QuestionDB.quiz_id == quiz_id).all())
    
    total_score = 0.0
    detailed_results = []
    
    for q in questions:
        q_id_str = str(q.question_id)
        student_ans = answers.get(q_id_str)
        
        try:
            correct_ans = json.loads(q.correct_answer_json)
        except:
            correct_ans = q.correct_answer_json
            
        is_correct = check_answer(q.question_type, correct_ans, student_ans)
        earned_points = float(q.points) if is_correct else 0.0
        total_score += earned_points
        
        detailed_results.append({
            "question_id": q.question_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "image_url": q.image_url or "",
            "options": json.loads(q.options_json) if q.options_json else [],
            "student_answer": student_ans,
            "correct_answer": correct_ans,
            "points_earned": earned_points,
            "is_correct": is_correct
        })

    return total_score, detailed_results


def _finalize_attempt(attempt, answers, cheat_warnings, is_auto):
    """Chốt bài: lưu đáp án, chấm điểm và ghi bảng điểm. Dùng chung cho nộp thường, nộp muộn và tự nộp do vi phạm."""
    # 1. Update attempt answers & meta (thời lượng do server tính)
    attempt.answers_json = json.dumps(answers, ensure_ascii=False)
    attempt.cheat_warnings_count = _merge_cheat_count(attempt, cheat_warnings)
    attempt.duration_seconds = _server_duration(attempt)
    attempt.status = 'auto_submitted' if is_auto else 'submitted'
    attempt.completed_at = datetime.utcnow()

    total_score, detailed_results = _grade_attempt(attempt, answers)
    attempt.score_achieved = total_score
    db_session.flush()
    
    # 3. Log into ScoreDB
    class_id = attempt.class_quiz.class_id
    student_id = attempt.student_id
    quiz_title = attempt.class_quiz.quiz.title
    exam_code = f"Quiz: {quiz_title}"[:50]
    
    # Get workstation or dummy computer
    ws = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == class_id,
        WorkstationDB.student_id == student_id,
        WorkstationDB.is_draft == False
    ).first()
    
    if ws:
        computer_id = ws.computer_id
    else:
        # Fallback to teacher's "Quiz" virtual computer
        teacher_id = attempt.class_quiz.assigned_by
        comp = get_or_create_computer(teacher_id, "Quiz")
        computer_id = comp.computer_id
        
    # Check if a score already exists for this quiz attempt
    new_score = ScoreDB(
        class_id=class_id,
        student_id=student_id,
        computer_id=computer_id,
        exam_code=exam_code,
        score_achieved=total_score,
        duration_seconds=attempt.duration_seconds,
        raw_html_content=f"Quiz Attempt {attempt.attempt_id} details: warnings={attempt.cheat_warnings_count}, status={attempt.status}"
    )
    db_session.add(new_score)
    db_session.commit()

    return total_score, detailed_results


@quiz_bp.route('/api/public/attempts/<int:attempt_id>/save', methods=['POST'])
def save_quiz_attempt(attempt_id):
    if attempt_id <= 0:
        return jsonify({"status": "success", "message": "Đã tự động lưu tiến độ bài làm (offline)"})

    attempt = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.attempt_id == attempt_id).first()
    if not attempt:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    if not _attempt_token_ok(attempt):
        return _token_denied()

    if attempt.status in ('submitted', 'auto_submitted'):
        return jsonify({"status": "error", "message": "Bài thi đã được nộp"}), 400
        
    # Quá giờ: không nhận thêm đáp án (bài sẽ chốt bằng lần lưu cuối trước hạn)
    if _past_deadline(attempt):
        return jsonify({"status": "error", "expired": True, "message": "Đã hết giờ làm bài"}), 409

    data = request.get_json(silent=True) or {}
    answers = data.get('answers', {})
    cheat_warnings = data.get('cheat_warnings_count', attempt.cheat_warnings_count)

    attempt.answers_json = json.dumps(answers, ensure_ascii=False)
    attempt.cheat_warnings_count = _merge_cheat_count(attempt, cheat_warnings)
    attempt.duration_seconds = _server_duration(attempt)
    db_session.commit()

    # Đủ số cảnh báo: server tự chốt bài, kể cả khi client bị sửa để không tự nộp
    if attempt.cheat_warnings_count >= CHEAT_AUTO_SUBMIT and attempt.quiz_mode not in ('training', 'practice'):
        _finalize_attempt(attempt, answers, attempt.cheat_warnings_count, True)
        return jsonify({"status": "success", "auto_submitted": True, "message": "Bài thi đã được tự động nộp do vi phạm quy chế"})

    return jsonify({"status": "success", "message": "Đã tự động lưu tiến độ bài làm"})


@quiz_bp.route('/api/public/attempts/<int:attempt_id>/submit', methods=['POST'])
def submit_quiz_attempt(attempt_id):
    if attempt_id <= 0:
        return jsonify({"status": "success", "message": "Nộp bài thi thành công (offline)"})

    attempt = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.attempt_id == attempt_id).first()
    if not attempt:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    if not _attempt_token_ok(attempt):
        return _token_denied()

    if attempt.status == 'auto_submitted':
        # Đã được chốt tự động (hết giờ/vi phạm): trả lại kết quả để giao diện hiển thị bình thường
        try:
            stored = json.loads(attempt.answers_json) if attempt.answers_json else {}
        except (TypeError, ValueError):
            stored = {}
        total_score, detailed_results = _grade_attempt(attempt, stored)
        return jsonify({
            "status": "success",
            "message": "Bài thi đã được nộp tự động",
            "attempt_id": attempt.attempt_id,
            "score_achieved": total_score,
            "detailed_results": detailed_results
        })

    if attempt.status == 'submitted':
        return jsonify({"status": "error", "message": "Bài thi này đã được nộp trước đó"}), 400
        
    data = request.get_json(silent=True) or {}
    answers = data.get('answers', {})
    cheat_warnings = data.get('cheat_warnings_count', attempt.cheat_warnings_count)
    is_auto = data.get('is_auto_submit', False)

    # Nộp muộn quá thời gian cho phép: bỏ đáp án gửi kèm, chỉ chấm theo
    # bản đã tự lưu trước hạn để không ai làm thêm giờ bằng cách treo đồng hồ.
    if _past_deadline(attempt):
        try:
            answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
        except (TypeError, ValueError):
            answers = {}
        is_auto = True

    total_score, detailed_results = _finalize_attempt(attempt, answers, cheat_warnings, is_auto)

    return jsonify({
        "status": "success",
        "message": "Nộp bài thi thành công",
        "attempt_id": attempt.attempt_id,
        "score_achieved": total_score,
        "detailed_results": detailed_results
    })


@quiz_bp.route('/api/public/articles', methods=['GET'])
def public_articles():
    try:
        articles = db_session.query(KnowledgeArticleDB).order_by(KnowledgeArticleDB.created_at.desc()).all()
        result = []
        for art in articles:
            result.append({
                "id": art.article_id,
                "title": art.title,
                "category": art.category,
                "image": art.image_url or "",
                "description": art.description or "",
                "summary": art.summary or "",
                "content": art.content or ""
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@quiz_bp.route('/api/public/attempts/<int:attempt_id>', methods=['GET'])
def get_attempt_results(attempt_id):
    attempt = db_session.query(QuizAttemptDB).filter(QuizAttemptDB.attempt_id == attempt_id).first()
    if not attempt:
        return jsonify({"status": "error", "message": "Không tìm thấy lượt thi"}), 404
        
    if not _attempt_token_ok(attempt):
        return _token_denied()

    quiz = db_session.query(QuizDB).filter(QuizDB.quiz_id == attempt.class_quiz.quiz_id).first() if attempt.class_quiz else None
    if not quiz:
        return jsonify({"status": "error", "message": "Không tìm thấy đề thi"}), 404
        
    # Get questions
    questions = _attempt_questions(attempt, db_session.query(QuestionDB).filter(QuestionDB.quiz_id == quiz.quiz_id).all())
    
    # Calculate detailed results
    detailed_results = []
    import json as json_lib
    # Chỉ lộ đáp án đúng/giải thích sau khi bài đã nộp; đang làm dở thì không trả về.
    reveal_answers = attempt.status in ('submitted', 'auto_submitted')
    student_answers = {}
    if attempt.answers_json:
        try:
            student_answers = json_lib.loads(attempt.answers_json)
        except (json_lib.JSONDecodeError, TypeError):
            student_answers = {}
    
    for q in questions:
        correct_answer = None
        try:
            correct_answer = json_lib.loads(q.correct_answer_json) if q.correct_answer_json else None
        except (json_lib.JSONDecodeError, TypeError):
            correct_answer = None
        
        if reveal_answers:
            detailed_results.append({
                "question_id": q.question_id,
                "correct_answer": correct_answer,
                "explanation": q.explanation
            })
        else:
            detailed_results.append({"question_id": q.question_id})
        
    return jsonify({
        "status": "success",
        "attempt_id": attempt.attempt_id,
        "score_achieved": float(attempt.score_achieved) if attempt.score_achieved else 0,
        "time_limit": attempt.class_quiz.time_limit_override or quiz.time_limit,
        "started_at": attempt.started_at.strftime('%Y-%m-%d %H:%M:%S') if attempt.started_at else None,
        "completed_at": attempt.completed_at.strftime('%Y-%m-%d %H:%M:%S') if attempt.completed_at else None,
        "duration_seconds": attempt.duration_seconds or 0,
        "cheat_warnings_count": attempt.cheat_warnings_count or 0,
        "quiz_title": quiz.title,
        "quiz_id": quiz.quiz_id,
        "student_id": attempt.student_id,
        "class_id": attempt.class_quiz.class_id if attempt.class_quiz else None,
        "school_id": attempt.class_quiz.classroom.school_id if (attempt.class_quiz and attempt.class_quiz.classroom) else None,
        "quiz_mode": attempt.quiz_mode or "testing",
        "detailed_results": detailed_results,
        "questions": [{
            "question_id": q.question_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": json_lib.loads(q.options_json) if q.options_json else [],
            "image_url": q.image_url,
            "media_url": q.image_url,
            "media_type": "image" if q.image_url else None
        } for q in questions],
        "answers": student_answers
    })
