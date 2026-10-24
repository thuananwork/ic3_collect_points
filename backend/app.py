import os, socket, sys

# Đảm bảo mã hóa UTF-8 cho console output trên Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from src.config.settings import Config
from src.utils.helpers import get_server_ip
from src.config.database import db_session, engine as _engine, Base
from src.models.models_db import UserDB
from src.routes.auth import auth_bp
from src.routes.api import api_bp
from src.utils.schema_upgrade import ensure_schema
from src.utils import lan_guard

# Nạp các biến môi trường
load_dotenv()

# Cấu hình Flask App & Thư mục Static chứa giao diện Frontend đã build
app = Flask(__name__, static_folder='../frontend/dist')
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

# Học sinh cùng mạng chỉ được gửi điểm; mọi thứ khác chỉ nhận từ chính laptop giáo viên
lan_guard.install(app)

# Tự động tạo bảng và kiểm tra schema
Base.metadata.create_all(bind=_engine)
ensure_schema(_engine)

# Đảm bảo có tài khoản giáo viên mặc định
try:
    teacher_exists = db_session.query(UserDB).filter(UserDB.user_id == 1).first()
    if not teacher_exists:
        teacher = UserDB(
            user_id=1,
            email='teacher@ic3.local',
            username='teacher',
            full_name='Giáo viên',
            role='teacher',
            is_approved=True
        )
        db_session.add(teacher)
        db_session.commit()
except Exception as _e:
    db_session.rollback()
    print("[!] Lỗi khởi tạo tài khoản giáo viên mặc định:", _e)

# Cấu hình bảo mật Session Cookies
app.config.update(
    SESSION_COOKIE_SECURE=Config.SESSION_COOKIE_SECURE,
    SESSION_COOKIE_HTTPONLY=Config.SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SAMESITE=Config.SESSION_COOKIE_SAMESITE
)

# Bật CORS cho phép kết nối giữa Frontend và Backend
CORS(app, resources={
    r"/api/save-score": {"origins": "*", "supports_credentials": False},
    r"/*": {"origins": [Config.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"], "supports_credentials": True}
})

@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()

# Đăng ký các module định tuyến (Blueprints)
app.register_blueprint(auth_bp)
app.register_blueprint(api_bp)

# Cấu hình phục vụ tải các tệp tin batch script
@app.route('/scripts/<path:filename>')
def serve_script_file(filename):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    scripts_dir = os.path.abspath(os.path.join(backend_dir, '../scripts'))
    return send_from_directory(scripts_dir, filename)

# Định tuyến bổ trợ phục vụ giao diện Single Page Application (SPA) của React
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    flask_debug = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    from src.utils.helpers import get_server_hostname
    hostname = get_server_hostname()
    ip = get_server_ip()
    print("Backend starting at:")
    print(f"  → Hostname: http://{hostname}:5000 (ổn định, không đổi)")
    print(f"  → IP:       http://{ip}:5000 (có thể đổi khi restart)")
    print(f"  → Debug:    {flask_debug}")
    if flask_debug:
        app.run(host='0.0.0.0', port=5000, debug=True)
    else:
        try:
            from waitress import serve
        except ImportError:
            print("[!] Chưa cài waitress (pip install -r requirements.txt), tạm dùng server của Flask.")
            app.run(host='0.0.0.0', port=5000, debug=False)
        else:
            threads = int(os.getenv('WAITRESS_THREADS', '16'))
            print(f"  → Server:   waitress ({threads} luồng)")
            serve(app, host='0.0.0.0', port=5000, threads=threads)
