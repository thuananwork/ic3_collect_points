from functools import wraps
from flask import jsonify
from src.auth_stub import current_user

def permission_required(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            u = current_user() if callable(current_user) else current_user
            if not u.is_authenticated:
                return jsonify({"status": "error", "message": "Unauthorized"}), 401
            if not u.has_permission(permission):
                return jsonify({"status": "error", "message": f"Bạn không có quyền truy cập tính năng này ({permission})"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        u = current_user() if callable(current_user) else current_user
        if not u.is_authenticated:
            return jsonify({"status": "error", "message": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function
