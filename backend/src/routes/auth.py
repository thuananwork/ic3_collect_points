from flask import Blueprint, request, jsonify, session, url_for, redirect
from flask_login import login_user, logout_user, login_required, current_user
from src.models.user import get_user_by_id, verify_local_user, get_or_create_google_user
import os
import re
from src.utils.rate_limit import limiter

auth_bp = Blueprint('auth', __name__)

# Chặn dò mật khẩu: tối đa 20 lần sai / 5 phút cho mỗi IP và 10 lần sai / 5 phút cho mỗi tên đăng nhập
LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_FAILS_IP = 20
LOGIN_MAX_FAILS_USER = 10
# Chống đăng ký hàng loạt: tối đa 5 lần / giờ / IP
REGISTER_MAX_PER_HOUR = 5
MIN_PASSWORD_LEN = 6
MAX_AVATAR_BYTES = 5 * 1024 * 1024

@auth_bp.route('/api/auth/status')
def status():
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "role": current_user.role,
                "permissions": current_user.permissions,
                "type": current_user.type,
                "avatar_url": current_user.avatar_url,
                "email": current_user.email
            }
        })
    return jsonify({"authenticated": False})

@auth_bp.route('/api/auth/login/local', methods=['POST'])
def login_local():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username') or '').strip()[:100]
    password = str(data.get('password') or '')

    ip_key = f"login:{request.remote_addr}"
    user_key = f"login-user:{username.lower()}"
    if (limiter.count(ip_key, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILS_IP
            or limiter.count(user_key, LOGIN_WINDOW_SECONDS) >= LOGIN_MAX_FAILS_USER):
        return jsonify({"status": "error", "message": "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút."}), 429

    try:
        user = verify_local_user(username, password)
        if user:
            import uuid
            token = uuid.uuid4().hex
            
            # Save token to database
            from src.config.database import db_session
            from src.models.models_db import UserDB
            user_db = db_session.query(UserDB).filter(UserDB.user_id == int(user.id)).first()
            if user_db:
                user_db.session_token = token
                db_session.commit()
                
            session['session_token'] = token
            login_user(user)
            limiter.clear(user_key)
            return jsonify({
                "status": "success",
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "role": user.role,
                    "permissions": user.permissions,
                    "avatar_url": user.avatar_url,
                    "email": user.email
                }
            })
        else:
            limiter.record(ip_key)
            limiter.record(user_key)
            return jsonify({"status": "error", "message": "Tên đăng nhập hoặc mật khẩu không chính xác."}), 401
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 403

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    if not limiter.allow(f"register:{request.remote_addr}", REGISTER_MAX_PER_HOUR, 3600):
        return jsonify({"status": "error", "message": "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau."}), 429

    data = request.get_json(silent=True) or {}
    username = str(data.get('username') or '').strip()
    password = str(data.get('password') or '')
    name = str(data.get('name') or username).strip()[:100] or username

    if not username or not password:
        return jsonify({"status": "error", "message": "Vui lòng nhập đầy đủ thông tin."}), 400
    if not re.fullmatch(r'\S{3,50}', username):
        return jsonify({"status": "error", "message": "Tên đăng nhập phải dài 3-50 ký tự và không chứa khoảng trắng."}), 400
    if len(password) < MIN_PASSWORD_LEN or len(password) > 128:
        return jsonify({"status": "error", "message": f"Mật khẩu phải có từ {MIN_PASSWORD_LEN} đến 128 ký tự."}), 400
        
    from src.config.database import db_session
    from src.models.models_db import UserDB
    from werkzeug.security import generate_password_hash
    
    # Check if username or email already exists
    user_exists = db_session.query(UserDB).filter(
        (UserDB.username == username) | (UserDB.email == username)
    ).first()
    if user_exists:
        return jsonify({"status": "error", "message": "Tên đăng nhập hoặc email đã tồn tại."}), 400
        
    email = username if '@' in username else f"{username}@local.ic3"
    
    new_user = UserDB(
        email=email,
        username=username,
        password_hash=generate_password_hash(password),
        role='user',
        full_name=name,
        is_approved=False
    )
    
    db_session.add(new_user)
    db_session.commit()
    
    try:
        from src.utils.helpers import send_registration_notification
        send_registration_notification(username, name, "local")
    except Exception as e:
        print(f"Lỗi gửi email thông báo đăng ký: {e}")
    return jsonify({"status": "success", "message": "Đăng ký thành công! Tài khoản của bạn đang chờ Admin phê duyệt."})

@auth_bp.route('/api/auth/logout')
@login_required
def logout():
    logout_user()
    return jsonify({"status": "success"})

def get_frontend_url():
    frontend_url = os.getenv('FRONTEND_URL')
    if frontend_url:
        return frontend_url.rstrip('/')
    # Che do phat trien (run_dev.bat dat IC3_DEV=1): giao dien chay o Vite, cong 5173.
    # Che do thuong (run.bat): Flask phuc vu san frontend/dist, nen quay ve chinh dia chi dang truy cap.
    request_host = request.host.split(':')[0]
    if os.getenv('IC3_DEV') != '1':
        dist_index = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'frontend', 'dist', 'index.html')
        if os.path.isfile(dist_index):
            return f"{request.scheme}://{request.host}"
    return f"http://{request_host}:5173"

# Google Auth will still need some redirects but they will be initiated by the frontend
@auth_bp.route('/api/auth/login/google')
def login_google():
    from src.services.oauth import oauth
    try:
        redirect_uri = url_for('auth.authorize_google', _external=True)
        return oauth.google.authorize_redirect(redirect_uri)
    except Exception as e:
        print(f"Google Auth Redirection Error: {e}")
        e_str = str(e).lower()
        if "connection" in e_str or "resolution" in e_str or "dns" in e_str or "network" in e_str or "max retries" in e_str:
            return redirect(get_frontend_url() + '/login?error=network_error')
        return redirect(get_frontend_url() + '/login?error=auth_failed')

@auth_bp.route('/authorize')
def authorize_google():
    from src.services.oauth import oauth
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            return redirect(get_frontend_url() + '/login?error=google_info')
        
        email = user_info.get('email')
        name = user_info.get('name')
        if not email or user_info.get('email_verified') is False:
            return redirect(get_frontend_url() + '/login?error=google_info')
        
        from src.config.database import db_session
        from src.models.models_db import UserDB
        
        user_db = db_session.query(UserDB).filter(UserDB.email == email).first()
        
        if not user_db:
            # Lần đầu đăng nhập bằng Google -> Tự động đăng ký ở trạng thái chờ phê duyệt
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
            try:
                from src.utils.helpers import send_registration_notification
                send_registration_notification(email, name, "google")
            except Exception as e:
                print(f"Lỗi gửi email thông báo đăng ký Google: {e}")
            return redirect(get_frontend_url() + '/login?error=pending_approval')
            
        # Kiểm tra nếu tài khoản Google hiện tại chưa được Admin duyệt
        is_approved = user_db.is_approved or user_db.role == 'admin'
        if not is_approved:
            return redirect(get_frontend_url() + '/login?error=pending_approval')
            
        user = get_or_create_google_user(email, name)
        if user:
            import uuid
            token = uuid.uuid4().hex
            
            # Save token to database
            from src.config.database import db_session
            from src.models.models_db import UserDB
            user_db = db_session.query(UserDB).filter(UserDB.user_id == int(user.id)).first()
            if user_db:
                user_db.session_token = token
                db_session.commit()
                
            session['session_token'] = token
            login_user(user)
            return redirect(get_frontend_url() + '/')
        else:
            return redirect(get_frontend_url() + '/login?error=unauthorized')
    except Exception as e:
        print(f"Google Auth Error: {e}")
        e_str = str(e).lower()
        if "connection" in e_str or "resolution" in e_str or "dns" in e_str or "network" in e_str or "max retries" in e_str:
            return redirect(get_frontend_url() + '/login?error=network_error')
        return redirect(get_frontend_url() + '/login?error=auth_failed')

@auth_bp.route('/api/auth/profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    new_name = data.get('name')
    new_password = data.get('password')
    
    if not new_name or not new_name.strip():
        return jsonify({"status": "error", "message": "Tên hiển thị không được để trống."}), 400
        
    from src.config.database import db_session
    from src.models.models_db import UserDB
    from werkzeug.security import generate_password_hash
    
    try:
        user_key = int(current_user.id)
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "ID người dùng không hợp lệ."}), 400
        
    user_db = db_session.query(UserDB).filter(UserDB.user_id == user_key).first()
    
    if not user_db:
        return jsonify({"status": "error", "message": "Không tìm thấy thông tin tài khoản."}), 404
        
    user_db.full_name = new_name.strip()
    
    if new_password and new_password.strip():
        if user_db.google_id:
            return jsonify({"status": "error", "message": "Tài khoản Google không thể thay đổi mật khẩu."}), 400
        if len(new_password) < 6:
            return jsonify({"status": "error", "message": "Mật khẩu mới phải có ít nhất 6 ký tự."}), 400
        user_db.password_hash = generate_password_hash(new_password)
        
    db_session.commit()
    current_user.name = new_name.strip()
    current_user.avatar_url = user_db.avatar_url or ''
    
    return jsonify({
        "status": "success",
        "message": "Cập nhật thông tin hồ sơ cá nhân thành công!",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "role": current_user.role,
            "permissions": current_user.permissions,
            "type": 'google' if user_db.google_id else 'local',
            "avatar_url": current_user.avatar_url,
            "email": current_user.email
        }
    })

# Cấu hình upload ảnh đại diện
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@auth_bp.route('/api/auth/avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({"status": "error", "message": "Không tìm thấy file tải lên."}), 400
        
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Tên file rỗng."}), 400
        
    file.stream.seek(0, os.SEEK_END)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > MAX_AVATAR_BYTES:
        return jsonify({"status": "error", "message": "Ảnh đại diện quá lớn (tối đa 5 MB)."}), 413

    if file and allowed_file(file.filename):
        from werkzeug.utils import secure_filename
        import time
        
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower()
        new_filename = f"avatar_{current_user.id}_{int(time.time())}.{ext}"
        
        # Đường dẫn lưu file avatar
        avatar_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'storage', 'avatars')
        os.makedirs(avatar_dir, exist_ok=True)
        file_path = os.path.join(avatar_dir, new_filename)
        
        # Lưu file
        file.save(file_path)
        
        # Cập nhật CSDL
        from src.config.database import db_session
        from src.models.models_db import UserDB
        
        try:
            user_key = int(current_user.id)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "ID người dùng không hợp lệ."}), 400
            
        user_db = db_session.query(UserDB).filter(UserDB.user_id == user_key).first()
        if not user_db:
            return jsonify({"status": "error", "message": "Không tìm thấy tài khoản trong CSDL."}), 404
            
        # Xóa file avatar cũ nếu có
        if user_db.avatar_url:
            old_filename = user_db.avatar_url.split('/')[-1]
            old_file_path = os.path.join(avatar_dir, old_filename)
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                except Exception as e:
                    print(f"Không thể xóa avatar cũ: {e}")
                    
        # Lưu đường dẫn tương đối phục vụ ảnh
        db_avatar_url = f"/uploads/avatars/{new_filename}"
        user_db.avatar_url = db_avatar_url
        db_session.commit()
        
        # Cập nhật session user
        current_user.avatar_url = db_avatar_url
        
        return jsonify({
            "status": "success",
            "message": "Cập nhật ảnh đại diện thành công!",
            "avatar_url": db_avatar_url
        })
        
    return jsonify({"status": "error", "message": "Định dạng file không được hỗ trợ. Vui lòng chọn ảnh PNG, JPG hoặc GIF."}), 400



