import re
from flask import request
from src.config.database import db_session
from src.models.models_db import ComputerDB, WorkstationDB, ScoreDB, UserActiveStateDB, ClassDB

def get_teacher_active_class_object(user_id):
    state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == user_id).first()
    if state and state.active_class_id:
        return db_session.query(ClassDB).filter(ClassDB.class_id == state.active_class_id, ClassDB.user_id == user_id).first()
    return None

def get_teacher_scoring_class_object(user_id):
    state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == user_id).first()
    if state and state.scoring_class_id:
        return db_session.query(ClassDB).filter(ClassDB.class_id == state.scoring_class_id, ClassDB.user_id == user_id).first()
    return None

def get_teacher_active_school_id(user_id):
    state = db_session.query(UserActiveStateDB).filter(UserActiveStateDB.user_id == user_id).first()
    if state and state.active_school_id:
        return state.active_school_id
    return None

def get_pc_key(pc_name):
    match = re.search(r'\d+', pc_name)
    if match:
        return str(int(match.group()))
    return pc_name

def get_or_create_computer(user_id, pc_identifier):
    try:
        pc_num = int(re.sub(r'[^0-9]', '', str(pc_identifier)))
        pc_name = f"PC{pc_num:02d}"
    except ValueError:
        pc_name = str(pc_identifier)
        
    comp = db_session.query(ComputerDB).filter(
        ComputerDB.user_id == user_id,
        ComputerDB.pc_name == pc_name
    ).first()
    if not comp:
        comp = ComputerDB(
            user_id=user_id,
            pc_name=pc_name,
            ip_address="0.0.0.0",
            status="offline"
        )
        db_session.add(comp)
        db_session.flush()
    return comp

def get_or_create_workstation(class_id, computer_id, is_draft):
    ws = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == class_id,
        WorkstationDB.computer_id == computer_id,
        WorkstationDB.is_draft == is_draft
    ).first()
    if not ws:
        ws = WorkstationDB(
            class_id=class_id,
            computer_id=computer_id,
            is_draft=is_draft,
            student_id=None,
            target_score=None,
            assigned_exam_code=None
        )
        db_session.add(ws)
        db_session.flush()
    return ws

def sync_student_scores_to_workstations(class_id, is_draft):
    workstations = db_session.query(WorkstationDB).filter(
        WorkstationDB.class_id == class_id,
        WorkstationDB.is_draft == is_draft
    ).all()
    for ws in workstations:
        if ws.student_id:
            db_session.query(ScoreDB).filter(
                ScoreDB.class_id == class_id,
                ScoreDB.student_id == ws.student_id
            ).update({ScoreDB.computer_id: ws.computer_id})
    db_session.flush()

def get_req_data():
    if request.is_json:
        return request.get_json()
    return request.form
