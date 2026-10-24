import os
from dotenv import load_dotenv

load_dotenv()

def _load_secret_key():
    # Phiên đăng nhập không dùng khoá này nữa (app.py tự tạo khoá ngẫu nhiên mỗi lần chạy); giữ cho tương thích
    import secrets
    return os.getenv('SECRET_KEY') or secrets.token_hex(32)


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
