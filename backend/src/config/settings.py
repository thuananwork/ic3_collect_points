import os
from dotenv import load_dotenv

load_dotenv()

def _load_secret_key():
    key = os.getenv('SECRET_KEY')
    if not key:
        import secrets
        key = secrets.token_hex(32)
        print("[CẢNH BÁO] Chưa đặt SECRET_KEY trong backend/.env - đang dùng khoá ngẫu nhiên tạm thời, "
              "mọi phiên đăng nhập sẽ mất khi khởi động lại.")
    return key


class Config:
    SECRET_KEY = _load_secret_key()
    STORAGE_PATH = 'storage'
    DANHSACH_PATH = os.path.join(STORAGE_PATH, 'danhsach')
    SCORES_PATH = os.path.join(STORAGE_PATH, 'scores')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Security Configuration
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB Limit
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    @staticmethod
    def init_app(app):
        pass
