import json
from datetime import datetime, timedelta
# pyrefly: ignore [missing-import]
from flask import Blueprint, request, jsonify
# pyrefly: ignore [missing-import]
from flask_login import login_required, current_user

from src.config.database import db_session
from src.models.models_db import QuizDB, QuestionDB, ClassQuizDB, QuizAttemptDB, ClassDB, StudentDB, ScoreDB, WorkstationDB, SchoolDB, KnowledgeArticleDB
from src.utils.db_helpers import get_or_create_computer
from src.middleware.auth import permission_required

quiz_bp = Blueprint('quiz', __name__)

# --- HELPERS ---

def check_answer(q_type, correct, student):
    if correct is None or student is None:
        return False
    
    # Handle string-encoded JSONs if passed raw
    if isinstance(correct, str):
        try:
            correct = json.loads(correct)
        except:
            pass
    if isinstance(student, str):
        try:
            student = json.loads(student)
        except:
            pass

    if q_type in ('single_choice', 'true_false'):
        return str(correct).strip().lower() == str(student).strip().lower()
        
    elif q_type == 'multiple_choice':
        if not isinstance(correct, list) or not isinstance(student, list):
            return False
        c_sorted = sorted([str(x).strip().lower() for x in correct])
        s_sorted = sorted([str(x).strip().lower() for x in student])
        return c_sorted == s_sorted
        
    elif q_type in ('matching', 'multi_true_false'):
        if not isinstance(correct, dict) or not isinstance(student, dict):
            return False
        for k, v in correct.items():
            if str(k) not in student:
                return False
            if str(v).strip().lower() != str(student[str(k)]).strip().lower():
                return False
        return True
        
    elif q_type == 'ordering':
        if not isinstance(correct, list) or not isinstance(student, list):
            return False
        c_list = [str(x).strip().lower() for x in correct]
        s_list = [str(x).strip().lower() for x in student]
        return c_list == s_list
        
    elif q_type == 'hotspot':
        # Normalize correct zones: support both single {x,y,w,h} and array [{x,y,w,h}, ...]
        if isinstance(correct, dict) and 'x' in correct:
            correct_zones = [correct]
        elif isinstance(correct, list):
            correct_zones = correct
        else:
            return False
        
        # Normalize student answer: support both single {x,y} and array [{x,y}, ...]
        if isinstance(student, dict) and 'x' in student:
            student_points = [student]
        elif isinstance(student, list):
            student_points = student
        else:
            return False
        
        if not student_points or not correct_zones:
            return False
        
        try:
            # Each student point must land inside a correct zone
            # Each zone can only be matched once
            matched_zone_indices = set()
            for pt in student_points:
                sx = float(pt.get('x', 0))
                sy = float(pt.get('y', 0))
                found = False
                for zi, zone in enumerate(correct_zones):
                    if zi in matched_zone_indices:
                        continue
                    cx = float(zone.get('x', 0))
                    cy = float(zone.get('y', 0))
                    cw = float(zone.get('w', 0))
                    ch = float(zone.get('h', 0))
                    if cx <= sx <= cx + cw and cy <= sy <= cy + ch:
                        matched_zone_indices.add(zi)
                        found = True
                        break
                if not found:
                    return False
            return len(matched_zone_indices) == len(correct_zones)
        except:
            return False

    elif q_type == 'short_answer':
        if isinstance(correct, list):
            return any(str(ans).strip().lower() == str(student).strip().lower() for ans in correct)
        return str(correct).strip().lower() == str(student).strip().lower()
            
    return str(correct) == str(student)



def get_teacher_classroom(classroom_id):
    """Trả về lớp nếu thuộc giáo viên đang đăng nhập (admin được phép mọi lớp), ngược lại trả None."""
    if not current_user.is_authenticated:
        return None
    classroom = db_session.query(ClassDB).filter(ClassDB.class_id == classroom_id).first()
    if classroom is None:
        return None
    if getattr(current_user, 'role', None) == 'admin' or classroom.user_id == int(current_user.id):
        return classroom
    return None


def delete_expired_student_data():
    try:
        limit_time = datetime.utcnow() - timedelta(hours=48)
        
        # 1. Delete expired attempts
        db_session.query(QuizAttemptDB).filter(
            QuizAttemptDB.started_at < limit_time
        ).delete(synchronize_session=False)
        
        # 2. Delete expired scores generated by quizzes
        db_session.query(ScoreDB).filter(
            ScoreDB.created_at < limit_time,
            ScoreDB.exam_code.like("Quiz:%")
        ).delete(synchronize_session=False)
        
        # 3. Delete expired proctor sessions (class quizzes) older than 48 hours
        db_session.query(ClassQuizDB).filter(
            ClassQuizDB.assigned_at < limit_time
        ).delete(synchronize_session=False)
        
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        print(f"[Cleanup] Error deleting expired student data: {e}")


# --- REGISTER SUB-MODULES FOR DECORATORS ---
from . import quiz_admin, quiz_teacher, quiz_student
