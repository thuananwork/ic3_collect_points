import os
import re
import random
import string
from datetime import datetime, timedelta
from unicodedata import normalize
from src.config.database import db_session
from src.models.models_db import SchoolDB, ClassDB, StudentDB, ComputerDB, WorkstationDB, ScoreDB, ShareCodeDB

def generate_share_code(user_id, school_id):
    """
    Tạo mã chia sẻ (Share Code) độc nhất cho một trường học, có hiệu lực trong 48 giờ.
    """
    school = db_session.query(SchoolDB).filter(SchoolDB.school_id == school_id).first()
    if not school:
        raise ValueError("Trường học không tồn tại")
        
    # Tạo tiền tố từ tên trường (loại bỏ tiếng Việt có dấu, ký tự đặc biệt)
    normalized_name = normalize('NFKD', school.school_name).encode('ascii', 'ignore').decode('utf-8')
    prefix = re.sub(r'[^a-zA-Z0-9]', '', normalized_name)[:6].upper()
    if not prefix:
        prefix = "SCH"
        
    # Kiểm tra xem đã có mã nào còn hạn cho trường này chưa
    existing = db_session.query(ShareCodeDB).filter(
        ShareCodeDB.school_id == school_id,
        ShareCodeDB.expires_at > datetime.utcnow()
    ).first()
    
    if existing:
        return existing.code
        
    # Sinh mã ngẫu nhiên duy nhất
    while True:
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        code = f"{prefix}_{random_str}"
        
        # Đảm bảo không trùng lặp mã trong DB
        dup = db_session.query(ShareCodeDB).filter(ShareCodeDB.code == code).first()
        if not dup:
            break
            
    expires_at = datetime.utcnow() + timedelta(hours=48)
    share_record = ShareCodeDB(
        code=code,
        user_id=user_id,
        school_id=school_id,
        expires_at=expires_at
    )
    db_session.add(share_record)
    db_session.commit()
    return code

def import_share_code(target_user_id, invite_code):
    """
    Nhập mã chia sẻ để sao chép sâu (Deep Clone) dữ liệu trường học từ tài khoản Giáo viên A sang Giáo viên B.
    Nếu Giáo viên B đã nhận trường học này trước đó, tiến hành xóa bản cũ và ghi đè bản mới nhất.
    """
    invite_code = invite_code.strip().upper()
    
    # 1. Tìm mã chia sẻ trong DB
    share_record = db_session.query(ShareCodeDB).filter(ShareCodeDB.code == invite_code).first()
    if not share_record:
        raise ValueError("Mã chia sẻ không tồn tại hoặc không hợp lệ.")
        
    # 2. Kiểm tra xem mã đã hết hạn chưa
    if share_record.expires_at < datetime.utcnow():
        raise ValueError("Mã chia sẻ này đã hết hạn (chỉ có hiệu lực trong vòng 48 giờ).")
        
    source_school = share_record.school
    if not source_school:
        raise ValueError("Dữ liệu trường học gốc không tồn tại hoặc đã bị xóa.")
        
    # Ngăn cản tự nhận dữ liệu của chính mình
    if source_school.user_id == target_user_id:
        raise ValueError("Bạn không thể tự nhận dữ liệu từ trường học do chính mình tạo ra.")
        
    # 3. Dọn dẹp bản sao cũ nếu có (khớp origin_school_id và user_id người nhận)
    old_school = db_session.query(SchoolDB).filter(
        SchoolDB.user_id == target_user_id,
        SchoolDB.origin_school_id == source_school.school_id
    ).first()
    
    if old_school:
        # Xóa điểm trước để tránh lỗi ràng buộc foreign key (ON DELETE NO ACTION)
        class_ids = [c.class_id for c in old_school.classes]
        if class_ids:
            db_session.query(ScoreDB).filter(ScoreDB.class_id.in_(class_ids)).delete(synchronize_session=False)
            
        # Xóa trường học (cascade sẽ tự động xóa classes, students, workstations)
        db_session.query(SchoolDB).filter(SchoolDB.school_id == old_school.school_id).delete(synchronize_session=False)
        db_session.flush()
        
    # 4. Sao chép thông tin trường học
    new_school = SchoolDB(
        user_id=target_user_id,
        school_name=source_school.school_name,
        address=source_school.address,
        school_logo=source_school.school_logo,
        origin_school_id=source_school.school_id
    )
    db_session.add(new_school)
    db_session.flush()
    
    # 5. Sao chép tuần tự các lớp, học sinh, sơ đồ máy và điểm
    for src_class in source_school.classes:
        new_class = ClassDB(
            user_id=target_user_id,
            class_name=src_class.class_name,
            academic_year=src_class.academic_year,
            school_level=src_class.school_level,
            grade_level=src_class.grade_level,
            school_id=new_school.school_id,
            is_active=False,
            is_scoring=False
        )
        db_session.add(new_class)
        db_session.flush()
        
        student_map = {}  # mapping: source_student_id -> new_student_id
        computer_map = {} # mapping: pc_name -> new_computer_id
        
        # Sao chép danh sách học sinh
        for src_student in src_class.students:
            new_student = StudentDB(
                student_code=src_student.student_code,
                class_id=new_class.class_id,
                full_name=src_student.full_name,
                default_target_score=src_student.default_target_score
            )
            db_session.add(new_student)
            db_session.flush()
            student_map[src_student.student_id] = new_student.student_id
            
        # Sao chép sơ đồ chỗ ngồi (workstations)
        for src_ws in src_class.workstations:
            pc_name = src_ws.computer.pc_name
            # Tìm hoặc tạo máy tương ứng cho Giáo viên B
            comp = db_session.query(ComputerDB).filter(
                ComputerDB.user_id == target_user_id,
                ComputerDB.pc_name == pc_name
            ).first()
            if not comp:
                comp = ComputerDB(
                    user_id=target_user_id,
                    pc_name=pc_name,
                    ip_address="0.0.0.0",
                    status="offline"
                )
                db_session.add(comp)
                db_session.flush()
                
            new_st_id = student_map.get(src_ws.student_id) if src_ws.student_id else None
            
            new_ws = WorkstationDB(
                class_id=new_class.class_id,
                computer_id=comp.computer_id,
                student_id=new_st_id,
                target_score=src_ws.target_score,
                assigned_exam_code=src_ws.assigned_exam_code,
                is_draft=src_ws.is_draft
            )
            db_session.add(new_ws)
            db_session.flush()
            computer_map[pc_name] = comp.computer_id
            
        # Sao chép lịch sử điểm số
        for src_score in src_class.scores:
            new_st_id = student_map.get(src_score.student_id) if src_score.student_id else None
            
            pc_name = src_score.computer.pc_name
            comp_id = computer_map.get(pc_name)
            if not comp_id:
                comp = db_session.query(ComputerDB).filter(
                    ComputerDB.user_id == target_user_id,
                    ComputerDB.pc_name == pc_name
                ).first()
                if not comp:
                    comp = ComputerDB(
                        user_id=target_user_id,
                        pc_name=pc_name,
                        ip_address="0.0.0.0",
                        status="offline"
                    )
                    db_session.add(comp)
                    db_session.flush()
                comp_id = comp.computer_id
                computer_map[pc_name] = comp_id
                
            new_score = ScoreDB(
                class_id=new_class.class_id,
                student_id=new_st_id,
                computer_id=comp_id,
                exam_code=src_score.exam_code,
                score_achieved=src_score.score_achieved,
                duration_seconds=src_score.duration_seconds,
                raw_html_content=src_score.raw_html_content,
                created_at=src_score.created_at
            )
            db_session.add(new_score)
            
    db_session.commit()
    return new_school
