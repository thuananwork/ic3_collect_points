import os
from dotenv import load_dotenv

load_dotenv()

def _load_secret_key():
    """SECRET_KEY phải đặt trong backend/.env. Thiếu thì sinh khoá tạm (phiên đăng nhập mất khi khởi động lại)."""
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
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB Limit for file uploads (supports video/audio)
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # OAuth
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    GOOGLE_DISCOVERY_URL = os.getenv('GOOGLE_DISCOVERY_URL')
    
    # Google Sheets Configuration
    GSHEET_API_KEY = os.getenv('GSHEET_API_KEY')
    GSHEET_ID = os.getenv('GSHEET_ID', '1bkicUIab6trv0aL9v_IoXndDhuGCx0h0OY-9TJpdC28')
    GSHEET_GRADES = {
        6: ['6.1','6.2','6.3','6.4','6.5','6.6','6.7','6.8','6.9','6.10'],
        7: ['7.1','7.2','7.3','7.4','7.5','7.6','7.7','7.8'],
        8: ['8.1','8.2','8.3','8.4','8.5','8.6','8.7','8.8']
    }
    GSHEET_TABS = ['6.1','6.2','6.3','6.4','6.5','6.6','6.7','6.8','6.9','6.10','7.1','7.2','7.3','7.4','7.5','7.6','7.7','7.8','8.1','8.2','8.3','8.4','8.5','8.6','8.7','8.8']

    @staticmethod
    def init_app(app):
        pass
