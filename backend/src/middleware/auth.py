from functools import wraps
from flask import jsonify
from flask_login import current_user

def permission_required(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({"status": "error", "message": "Unauthorized"}), 401
            if not current_user.has_permission(permission):
                return jsonify({"status": "error", "message": f"Bạn không có quyền truy cập tính năng này ({permission})"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
