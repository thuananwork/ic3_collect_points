from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Numeric, Text, Unicode, UnicodeText
from sqlalchemy.orm import relationship
from src.config.database import Base

class UserDB(Base):
    __tablename__ = 'users'
    
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(100), unique=True, nullable=False)
    google_id = Column(String(100), unique=True, nullable=True)
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
    permissions = relationship('PermissionDB', secondary='user_permissions', back_populates='users')
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
    share_codes = relationship('ShareCodeDB', back_populates='school', cascade='all, delete-orphan')


class ShareCodeDB(Base):
    __tablename__ = 'share_codes'
    
    code_id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='NO ACTION'), nullable=False)
    school_id = Column(Integer, ForeignKey('schools.school_id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    # Relationships
    creator = relationship('UserDB')
    school = relationship('SchoolDB', back_populates='share_codes')


class PermissionDB(Base):
    __tablename__ = 'permissions'
    
    permission_id = Column(String(50), primary_key=True)
    description = Column(Unicode(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship('UserDB', secondary='user_permissions', back_populates='permissions')


class UserPermissionDB(Base):
    __tablename__ = 'user_permissions'
    
    user_id = Column(Integer, ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    permission_id = Column(String(50), ForeignKey('permissions.permission_id', ondelete='CASCADE'), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    class_quizzes = relationship('ClassQuizDB', back_populates='classroom', cascade='all, delete-orphan')


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
    quiz_attempts = relationship('QuizAttemptDB', back_populates='student', cascade='all, delete-orphan')


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


class QuizDB(Base):
    __tablename__ = 'quizzes'
    
    quiz_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Unicode(200), nullable=False)
    description = Column(UnicodeText, nullable=True)
    time_limit = Column(Integer, nullable=False, default=45)
    is_published = Column(Boolean, nullable=False, default=False)
    school_level = Column(Unicode(30), nullable=True)
    grade_level = Column(Integer, nullable=True)
    quiz_mode = Column(Unicode(30), nullable=False, default='testing')
    allow_practice = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    questions = relationship('QuestionDB', back_populates='quiz', cascade='all, delete-orphan')
    class_quizzes = relationship('ClassQuizDB', back_populates='quiz', cascade='all, delete-orphan')


class QuestionDB(Base):
    __tablename__ = 'questions'
    
    question_id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.quiz_id', ondelete='CASCADE'), nullable=False, index=True)
    question_type = Column(String(50), nullable=False)
    question_text = Column(UnicodeText, nullable=False)
    image_url = Column(Unicode(255), nullable=True)
    options_json = Column(UnicodeText, nullable=False)
    correct_answer_json = Column(UnicodeText, nullable=False)
    points = Column(Integer, nullable=False, default=10)
    explanation = Column(UnicodeText, nullable=True)

    # Relationships
    quiz = relationship('QuizDB', back_populates='questions')


class ClassQuizDB(Base):
    __tablename__ = 'class_quizzes'
    
    class_quiz_id = Column(Integer, primary_key=True, autoincrement=True)
    class_id = Column(Integer, ForeignKey('classes.class_id', ondelete='CASCADE'), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey('quizzes.quiz_id', ondelete='CASCADE'), nullable=False, index=True)
    assigned_by = Column(Integer, ForeignKey('users.user_id', ondelete='NO ACTION'), nullable=True)
    status = Column(String(20), default='active')
    assigned_at = Column(DateTime, default=datetime.utcnow)
    time_limit_override = Column(Integer, nullable=True)
    quiz_mode_override = Column(Unicode(30), nullable=True)
    pin_code = Column(String(10), nullable=True)
    # Số câu bốc ngẫu nhiên cho mỗi học sinh (None = làm toàn bộ đề)
    random_question_count = Column(Integer, nullable=True)

    # Relationships
    classroom = relationship('ClassDB', back_populates='class_quizzes')
    quiz = relationship('QuizDB', back_populates='class_quizzes')
    teacher = relationship('UserDB')
    attempts = relationship('QuizAttemptDB', back_populates='class_quiz', cascade='all, delete-orphan')


class QuizAttemptDB(Base):
    __tablename__ = 'quiz_attempts'
    
    attempt_id = Column(Integer, primary_key=True, autoincrement=True)
    class_quiz_id = Column(Integer, ForeignKey('class_quizzes.class_quiz_id', ondelete='CASCADE'), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey('students.student_id', ondelete='NO ACTION'), nullable=False, index=True)
    score_achieved = Column(Numeric(5, 2), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    answers_json = Column(UnicodeText, nullable=True)
    cheat_warnings_count = Column(Integer, default=0)
    status = Column(String(20), default='inprogress')
    quiz_mode = Column(String(30), nullable=True)
    session_token = Column(String(100), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    class_quiz = relationship('ClassQuizDB', back_populates='attempts')
    student = relationship('StudentDB', back_populates='quiz_attempts')


class KnowledgeArticleDB(Base):
    __tablename__ = 'knowledge_articles'
    
    article_id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Unicode(255), nullable=False)
    category = Column(String(50), nullable=False)
    image_url = Column(String(255), nullable=True)
    description = Column(UnicodeText, nullable=True)
    summary = Column(UnicodeText, nullable=True)
    content = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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


