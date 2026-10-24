from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from src.config.database import db_session
from src.models.models_db import UserDB, PermissionDB, UserPermissionDB

# Mapping between SQL database permissions and frontend/legacy permission strings
LEGACY_TO_SQL_PERM = {
    'chonlop': 'choose_class',
    'laydiem': 'get_scores',
    'chongoi': 'manage_seating',
    'muctieu': 'set_target',
    'scoreboard': 'manage_gsheet',
    'excel-mode': 'excel_mode',
    'trac_nghiem_ly_thuyet': 'trac_nghiem_ly_thuyet',
    'bai_giang_dien_tu': 'bai_giang_dien_tu',
    'tai_lieu_on_tap': 'tai_lieu_on_tap',
    'cong_cu_tien_ich': 'cong_cu_tien_ich'
}

SQL_TO_LEGACY_PERM = {v: k for k, v in LEGACY_TO_SQL_PERM.items()}

class User(UserMixin):
    def __init__(self, user_db):
        self.id = str(user_db.user_id)
        self.type = 'google' if user_db.google_id else 'local'
        self.role = user_db.role or 'user'
        self.name = user_db.full_name or user_db.username or str(user_db.user_id)
        self.approved = bool(user_db.is_approved) if user_db.role != 'admin' else True
        self.avatar_url = user_db.avatar_url or ''
        self.email = user_db.email or ''
        self.allow_training_ban = bool(user_db.allow_training_ban if user_db.allow_training_ban is not None else True)
        self.session_token = user_db.session_token
        
        # Get permissions and map to legacy strings
        db_perms = [p.permission_id for p in user_db.permissions]
        perms = [SQL_TO_LEGACY_PERM[p] for p in db_perms if p in SQL_TO_LEGACY_PERM]
        
        # Legacy compatibility: automatically grant parent permission if any sub-permission is granted
        if perms:
            perms.append('nhan_diem_thuc_hanh')
            
        self.permissions = perms

    def has_permission(self, permission):
        if self.role == 'admin':
            return True
        
        # Legacy compatibility check
        sub_permissions = ['chonlop', 'laydiem', 'chongoi', 'muctieu', 'scoreboard', 'excel-mode']
        if permission in sub_permissions:
            return 'nhan_diem_thuc_hanh' in self.permissions and permission in self.permissions
            
        return permission in self.permissions

def get_user_by_id(user_id):
    try:
        u_id = int(user_id)
    except (ValueError, TypeError):
        return None
    user_db = db_session.query(UserDB).filter(UserDB.user_id == u_id).first()
    if user_db:
        return User(user_db)
    return None

def verify_local_user(username, password):
    user_db = db_session.query(UserDB).filter(
        (UserDB.username == username) | (UserDB.email == username)
    ).first()
    if user_db:
        if check_password_hash(user_db.password_hash or '', password):
            if not user_db.is_approved and user_db.role != 'admin':
                raise ValueError("Tài khoản của bạn đang chờ Admin phê duyệt.")
            return User(user_db)
    return None

def get_or_create_google_user(email, name):
    user_db = db_session.query(UserDB).filter(UserDB.email == email).first()
    if user_db:
        if user_db.full_name != name:
            user_db.full_name = name
            db_session.commit()
        return User(user_db)
    
    # Create Google user in DB (initially unapproved)
    user_db = UserDB(
        email=email,
        google_id=email,
        username=None,
        password_hash=None,
        full_name=name,
        role='user',
        is_approved=False
    )
    db_session.add(user_db)
    db_session.commit()
    return User(user_db)

def init_admin():
    admin_db = db_session.query(UserDB).filter(UserDB.username == 'admin').first()
    if not admin_db:
        import os, secrets
        admin_pwd = os.getenv('ADMIN_PASSWORD')
        if not admin_pwd:
            admin_pwd = secrets.token_urlsafe(12)
            print(f"[!] Đã tạo tài khoản 'admin' với mật khẩu ngẫu nhiên: {admin_pwd}")
            print("[!] Hãy lưu lại ngay, mật khẩu này sẽ không hiển thị lần nữa.")
        admin_hash = generate_password_hash(admin_pwd)
        admin_db = UserDB(
            email='admin@ic3manager.com',
            username='admin',
            password_hash=admin_hash,
            full_name='Administrator',
            role='admin',
            is_approved=True
        )
        db_session.add(admin_db)
        db_session.commit()
        
        # Grant all database permissions
        perms = db_session.query(PermissionDB).all()
        for p in perms:
            up = UserPermissionDB(user_id=admin_db.user_id, permission_id=p.permission_id)
            db_session.add(up)
        db_session.commit()
