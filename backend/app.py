import os, socket, sys

# Đảm bảo mã hóa UTF-8 cho console output trên Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, request, send_from_directory
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
from dotenv import load_dotenv

from src.config.settings import Config
from src.utils.helpers import get_server_ip
from src.models.user import get_user_by_id, init_admin
from src.config.database import db_session
from src.routes.auth import auth_bp
from src.routes.admin import admin_bp
from src.routes.api import api_bp
from src.routes.quiz import quiz_bp

# Nạp các biến môi trường
load_dotenv()

# Cho phép chạy Google OAuth trên HTTP ở môi trường phát triển (Local)
# Mạng LAN trường học chạy HTTP nên cần cờ này để đăng nhập Google; tách riêng khỏi chế độ debug
if (os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
        or os.getenv('ALLOW_INSECURE_OAUTH', 'False').lower() in ('true', '1', 't')):
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Cấu hình Flask App & Thư mục Static chứa giao diện Frontend đã build
app = Flask(__name__, static_folder='../frontend/dist')
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

# Bổ sung cột mới cho CSDL cũ (nếu thiếu)
from src.config.database import engine as _engine
from src.utils.schema_upgrade import ensure_schema
ensure_schema(_engine)

# Cấu hình bảo mật Session Cookies
app.config.update(
    SESSION_COOKIE_SECURE=Config.SESSION_COOKIE_SECURE,
    SESSION_COOKIE_HTTPONLY=Config.SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SAMESITE=Config.SESSION_COOKIE_SAMESITE
)

# Bật CORS cho phép kết nối giữa Frontend và Backend, hỗ trợ offline standalone quiz (file:// có origin 'null')
CORS(app, resources={
    r"/api/public/*": {"origins": [Config.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173", "null"], "supports_credentials": True},
    r"/api/save-score": {"origins": "*", "supports_credentials": False},
    r"/*": {"origins": [Config.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"], "supports_credentials": True}
})

# Thiết lập cơ chế Quản lý phiên đăng nhập Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    user = get_user_by_id(user_id)
    # Tài khoản bị thu hồi phê duyệt thì phiên đang mở cũng mất hiệu lực
    if user is not None and not getattr(user, 'approved', False):
        return None
    return user

@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()

import datetime

_last_cleanup_time = None

@app.before_request
def before_request():
    global _last_cleanup_time
    
    # Check concurrent logins
    if current_user.is_authenticated:
        from flask import session, jsonify, redirect
        session_token = session.get('session_token')
        db_session_token = getattr(current_user, 'session_token', None)
        
        if not db_session_token:
            import uuid
            new_token = uuid.uuid4().hex
            from src.models.models_db import UserDB
            user_db = db_session.query(UserDB).filter(UserDB.user_id == int(current_user.id)).first()
            if user_db:
                user_db.session_token = new_token
                db_session.commit()
                current_user.session_token = new_token
            session['session_token'] = new_token
        elif session_token != db_session_token:
            from flask_login import logout_user
            logout_user()
            session.clear()
            if request.path.startswith('/api/'):
                return jsonify({
                    "status": "error",
                    "message": "Tài khoản của bạn đã được đăng nhập ở trình duyệt khác.",
                    "code": "concurrent_login"
                }), 401
            from src.routes.auth import get_frontend_url
            return redirect(get_frontend_url() + '/login?error=concurrent_login')

    request.is_admin = current_user.is_authenticated and current_user.role == 'admin'
    
    # Tự động dọn dẹp các tài khoản chưa duyệt quá 2 ngày (Chạy tối đa 1 lần mỗi 15 phút)
    now = datetime.datetime.now()
    if _last_cleanup_time is None or (now - _last_cleanup_time).total_seconds() > 900:
        _last_cleanup_time = now
        try:
            from src.models.models_db import UserDB
            limit = datetime.datetime.utcnow() - datetime.timedelta(days=2)
            deleted_count = db_session.query(UserDB).filter(
                UserDB.is_approved == False,
                UserDB.role != 'admin',
                UserDB.created_at < limit
            ).delete(synchronize_session=False)
            if deleted_count > 0:
                db_session.commit()
                print(f"[Cleanup] Đã tự động xóa vĩnh viễn {deleted_count} tài khoản chưa duyệt đăng ký quá 2 ngày.")
        except Exception as e:
            db_session.rollback()
            print("[Cleanup] Lỗi dọn dẹp tài khoản chưa duyệt:", e)


# Đăng ký các module định tuyến (Blueprints)
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(api_bp)
app.register_blueprint(quiz_bp)

# Tích hợp dịch vụ đăng nhập Google OAuth
from src.services.oauth import init_oauth
init_oauth(app)

# Khởi tạo tài khoản Quản trị mặc định (nếu chưa tồn tại)
init_admin()

# Cấu hình thư mục lưu trữ ảnh đại diện
AVATAR_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'storage', 'avatars')
os.makedirs(AVATAR_UPLOAD_FOLDER, exist_ok=True)

@app.route('/uploads/avatars/<filename>')
def serve_avatar(filename):
    return send_from_directory(AVATAR_UPLOAD_FOLDER, filename)

# Cấu hình thư mục lưu trữ ảnh câu hỏi
IMAGES_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'storage', 'images')
os.makedirs(IMAGES_UPLOAD_FOLDER, exist_ok=True)

@app.route('/uploads/images/<filename>')
@app.route('/uploads/questions/<filename>')
def serve_question_image(filename):
    return send_from_directory(IMAGES_UPLOAD_FOLDER, filename)

# Cấu hình phục vụ tải các tệp tin batch script và đề thi trắc nghiệm (.quiz)
@app.route('/scripts/<path:filename>')
def serve_script_file(filename):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    scripts_dir = os.path.abspath(os.path.join(backend_dir, '../scripts'))
    return send_from_directory(scripts_dir, filename)

@app.route('/quizzes/<path:filename>')
@login_required
def serve_quiz_file(filename):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    quizzes_dir = os.path.abspath(os.path.join(backend_dir, '../quizzes'))
    return send_from_directory(quizzes_dir, filename, as_attachment=True)

# Định tuyến bổ trợ phục vụ giao diện Single Page Application (SPA) của React
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    flask_debug = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    from src.utils.helpers import get_server_hostname
    hostname = get_server_hostname()
    ip = get_server_ip()
    print(f"Backend starting at:")
    print(f"  → Hostname: http://{hostname}:5000 (ổn định, không đổi)")
    print(f"  → IP:       http://{ip}:5000 (có thể đổi khi restart)")
    print(f"  → Debug:    {flask_debug}")
    if flask_debug:
        # Chế độ phát triển: server của Flask có tự nạp lại và hiện lỗi chi tiết
        app.run(host='0.0.0.0', port=5000, debug=True)
    else:
        # Chạy thật (phòng máy nhiều học sinh cùng lúc): dùng waitress, nhiều luồng và ổn định hơn
        try:
            from waitress import serve
        except ImportError:
            print("[!] Chưa cài waitress (pip install -r requirements.txt), tạm dùng server của Flask.")
            app.run(host='0.0.0.0', port=5000, debug=False)
        else:
            threads = int(os.getenv('WAITRESS_THREADS', '16'))
            print(f"  → Server:   waitress ({threads} luồng)")
            serve(app, host='0.0.0.0', port=5000, threads=threads)
