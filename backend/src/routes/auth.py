from flask import Blueprint, jsonify
from src.auth_stub import current_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/status')
def status():
    u = current_user() if callable(current_user) else current_user
    return jsonify({
        "authenticated": True,
        "user": {
            "id": str(u.id),
            "name": u.name,
            "role": u.role,
            "permissions": u.permissions,
            "avatar_url": getattr(u, 'avatar_url', None),
            "email": u.email
        }
    })
