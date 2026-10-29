from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Numeric, Text, Unicode, UnicodeText
from sqlalchemy.orm import relationship
from src.config.database import Base

class UserDB(Base):
    __tablename__ = 'users'
    
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(100), unique=True, nullable=False)
    username = Column(String(50), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(Unicode(100), nullable=False)
    avatar_url = Column(Unicode(255), nullable=True)
    role = Column(String(50), default='user')
    is_approved = Column(Boolean, default=False)
    allow_training_ban = Column(Boolean, default=True)
    session_token = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classes = relationship('ClassDB', back_populates='teacher', cascade='all, delete-orphan')
    computers = relationship('ComputerDB', back_populates='teacher', cascade='all, delete-orphan')
    schools = relationship('SchoolDB', back_populates='teacher', cascade='all, delete-orphan')


class SchoolDB(Base):
    __tablename__ = 'schools'
    
    school_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
    school_name = Column(Unicode(150), nullable=False)
    address = Column(Unicode(255), nullable=True)
    school_logo = Column(String(255), nullable=True)
    origin_school_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship('UserDB', back_populates='schools')
    classes = relationship('ClassDB', back_populates='school')


class ClassDB(Base):
    __tablename__ = 'classes'
    
    class_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
    class_name = Column(Unicode(50), nullable=False)
    academic_year = Column(String(20), nullable=False)
    school_level = Column(Unicode(30), nullable=False)
    grade_level = Column(Integer, nullable=False)
    school_id = Column(Integer, ForeignKey('schools.school_id', ondelete='NO ACTION'), nullable=True, index=True)
    is_active = Column(Boolean, default=False)
    is_scoring = Column(Boolean, default=False)
    ban_all_training = Column(Boolean, default=False)
    banned_training_quizzes_json = Column(UnicodeText, default='[]')
    last_heartbeat = Column(DateTime, nullable=True)
    practice_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship('UserDB', back_populates='classes')
    school = relationship('SchoolDB', back_populates='classes')
    students = relationship('StudentDB', back_populates='classroom', cascade='all, delete-orphan')
    workstations = relationship('WorkstationDB', back_populates='classroom', cascade='all, delete-orphan')
    scores = relationship('ScoreDB', back_populates='classroom')


class StudentDB(Base):
    __tablename__ = 'students'
    
    student_id = Column(Integer, primary_key=True, autoincrement=True)
    student_code = Column(String(50), nullable=True)
    class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='CASCADE'), nullable=False, index=True)
    full_name = Column(Unicode(100), nullable=False)
    default_target_score = Column(Integer, default=35)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship('ClassDB', back_populates='students')
    workstations = relationship('WorkstationDB', back_populates='student')
    scores = relationship('ScoreDB', back_populates='student')


class ComputerDB(Base):
    __tablename__ = 'computers'
    
    computer_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    pc_name = Column(String(20), nullable=False)
    ip_address = Column(String(45), nullable=False)
    mac_address = Column(String(17), nullable=True)
    status = Column(String(20), default='offline')
    last_updated = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'pc_name', name='UQ_computers_user_pc'),
    )

    # Relationships
    teacher = relationship('UserDB', back_populates='computers')
    workstations = relationship('WorkstationDB', back_populates='computer')
    scores = relationship('ScoreDB', back_populates='computer')


class WorkstationDB(Base):
    __tablename__ = 'workstations'
    
    workstation_id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='CASCADE'), nullable=False, index=True)
    computer_id = Column(Integer, ForeignKey('computers.computer_id', ondelete='NO ACTION'), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey('students.student_id', ondelete='NO ACTION'), nullable=True, index=True)
    target_score = Column(Integer, nullable=True)
    assigned_exam_code = Column(String(50), nullable=True)
    is_draft = Column(Boolean, default=False)
    ban_training = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('class_id', 'computer_id', 'is_draft', name='UQ_workstation_seating'),
    )

    # Relationships
    classroom = relationship('ClassDB', back_populates='workstations')
    computer = relationship('ComputerDB', back_populates='workstations')
    student = relationship('StudentDB', back_populates='workstations')


class ScoreDB(Base):
    __tablename__ = 'scores'
    
    score_id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='NO ACTION'), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey('students.student_id', ondelete='SET NULL'), nullable=True, index=True)
    computer_id = Column(Integer, ForeignKey('computers.computer_id', ondelete='NO ACTION'), nullable=False, index=True)
    exam_code = Column(String(50), nullable=False)
    score_achieved = Column(Numeric(5, 2), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    raw_html_content = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classroom = relationship('ClassDB', back_populates='scores')
    student = relationship('StudentDB', back_populates='scores')
    computer = relationship('ComputerDB', back_populates='scores')


class UserActiveStateDB(Base):
    __tablename__ = 'user_active_states'
    
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    active_school_id = Column(Integer, ForeignKey('schools.school_id', ondelete='SET NULL'), nullable=True)
    active_class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='SET NULL'), nullable=True)
    scoring_class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship('UserDB', foreign_keys=[user_id])
    active_school = relationship('SchoolDB', foreign_keys=[active_school_id])
    active_class = relationship('ClassDB', foreign_keys=[active_class_id])
    scoring_class = relationship('ClassDB', foreign_keys=[scoring_class_id])


class SheetCellDB(Base):
    """O diem nhap tay trong trang "Danh sach" (OT1..OT5, SLHT, FLA1, FLA2, GMT1, GMT2).
    Khong co dong = o tu dong lay tu diem nhan duoc."""
    __tablename__ = 'sheet_cells'
    __table_args__ = (
        UniqueConstraint('class_id', 'student_id', 'col_key', name='UQ_sheet_cells'),
    )

    cell_id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='CASCADE'), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey('students.student_id', ondelete='CASCADE'), nullable=False, index=True)
    col_key = Column(String(10), nullable=False)
    value = Column(Unicode(50), nullable=False)
