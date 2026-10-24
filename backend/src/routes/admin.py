from flask import Blueprint, request, jsonify
from flask_login import login_required
from src.config.database import db_session
from src.models.models_db import UserDB, PermissionDB, UserPermissionDB, KnowledgeArticleDB
from src.models.user import LEGACY_TO_SQL_PERM, SQL_TO_LEGACY_PERM
from src.middleware.auth import permission_required
from werkzeug.security import generate_password_hash
import os

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/api/admin/users', methods=['GET'])
@login_required
@permission_required('all')
def get_users():
    users_db = db_session.query(UserDB).all()
    sanitized_users = {}
    for u in users_db:
        db_perms = [p.permission_id for p in u.permissions]
        perms = [SQL_TO_LEGACY_PERM[p] for p in db_perms if p in SQL_TO_LEGACY_PERM]
        
        # Legacy compatibility: automatically grant parent permission if any sub-permission is granted
        if perms:
            perms.append('nhan_diem_thuc_hanh')
            
        sanitized_users[str(u.user_id)] = {
            "type": "google" if u.google_id else "local",
            "role": u.role,
            "name": u.full_name or u.username or str(u.user_id),
            "email": u.email,
            "username": u.username,
            "permissions": perms,
            "approved": bool(u.is_approved) if u.role != "admin" else True,
            "allow_training_ban": bool(u.allow_training_ban if u.allow_training_ban is not None else True)
        }
    return jsonify(sanitized_users)

@admin_bp.route('/api/admin/users', methods=['POST'])
@login_required
@permission_required('all')
def update_users():
    data = request.get_json()
    action = data.get('action')
    
    if action == 'add_local':
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return jsonify({"status": "error", "message": "Vui lòng cung cấp tên đăng nhập và mật khẩu."}), 400
            
        # Check if username or email already exists
        exists = db_session.query(UserDB).filter(
            (UserDB.username == username) | (UserDB.email == username)
        ).first()
        if exists:
            return jsonify({"status": "error", "message": "Tên đăng nhập đã tồn tại."}), 400
            
        email = f"{username}@local.ic3"
        new_user = UserDB(
            email=email,
            username=username,
            password_hash=generate_password_hash(password),
            role='user',
            full_name=username,
            is_approved=True
        )
        db_session.add(new_user)
        db_session.commit()
        return jsonify({"status": "success", "message": f"Đã thêm tài khoản nội bộ: {username}"})
    
    elif action == 'add_google':
        email = data.get('email')
        if not email:
            return jsonify({"status": "error", "message": "Vui lòng cung cấp email Google."}), 400
            
        exists = db_session.query(UserDB).filter(UserDB.email == email).first()
        if exists:
            return jsonify({"status": "error", "message": "Email Google đã tồn tại."}), 400
            
        new_user = UserDB(
            email=email,
            google_id=email,
            username=None,
            password_hash=None,
            role='user',
            full_name=email,
            is_approved=True
        )
        db_session.add(new_user)
        db_session.commit()
        return jsonify({"status": "success", "message": f"Đã cấp quyền cho email Google: {email}"})
    
    elif action == 'toggle_approval':
        user_id_str = data.get('user_id')
        try:
            u_id = int(user_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "ID người dùng không hợp lệ"}), 400
            
        user = db_session.query(UserDB).filter(UserDB.user_id == u_id).first()
        if user and user.role != 'admin':
            current_status = bool(user.is_approved)
            user.is_approved = not current_status
            db_session.commit()
            status_str = "ĐÃ PHÊ DUYỆT" if not current_status else "ĐÃ HỦY PHÊ DUYỆT"
            return jsonify({"status": "success", "message": f"Thay đổi trạng thái tài khoản {user.full_name}: {status_str}"})
            
    elif action == 'toggle_allow_training_ban':
        user_id_str = data.get('user_id')
        try:
            u_id = int(user_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "ID người dùng không hợp lệ"}), 400
            
        user = db_session.query(UserDB).filter(UserDB.user_id == u_id).first()
        if user and user.role != 'admin':
            current_status = bool(user.allow_training_ban if user.allow_training_ban is not None else True)
            user.allow_training_ban = not current_status
            db_session.commit()
            status_str = "ĐƯỢC PHÉP CẤM" if not current_status else "BỊ CHẶN QUYỀN CẤM"
            return jsonify({"status": "success", "message": f"Thay đổi quyền cấm ôn luyện của {user.full_name}: {status_str}"})
            
    elif action == 'update_permissions':
        user_id_str = data.get('user_id')
        new_perms = data.get('permissions', [])
        try:
            u_id = int(user_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "ID người dùng không hợp lệ"}), 400
            
        user = db_session.query(UserDB).filter(UserDB.user_id == u_id).first()
        if user:
            if user.role != 'admin':
                # Delete existing permissions
                db_session.query(UserPermissionDB).filter(UserPermissionDB.user_id == u_id).delete()
                
                # Insert new permissions
                for perm in new_perms:
                    sql_perm = LEGACY_TO_SQL_PERM.get(perm)
                    if sql_perm:
                        # Ensure perm exists in DB first
                        up = UserPermissionDB(user_id=u_id, permission_id=sql_perm)
                        db_session.add(up)
                db_session.commit()
            return jsonify({"status": "success", "message": f"Đã cập nhật quyền cho {user.full_name or user.username}"})
            
    elif action == 'delete_user':
        user_id_str = data.get('user_id')
        try:
            u_id = int(user_id_str)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "ID người dùng không hợp lệ"}), 400
            
        user = db_session.query(UserDB).filter(UserDB.user_id == u_id).first()
        if user and user.role != 'admin':
            db_session.delete(user)
            db_session.commit()
            return jsonify({"status": "success", "message": f"Đã xóa người dùng {user.full_name or user.username}"})

    return jsonify({"status": "error", "message": "Thao tác không hợp lệ"}), 400


@admin_bp.route('/api/admin/articles', methods=['GET'])
@login_required
@permission_required('all')
def admin_get_articles():
    try:
        articles = db_session.query(KnowledgeArticleDB).order_by(KnowledgeArticleDB.created_at.desc()).all()
        result = []
        for art in articles:
            result.append({
                "id": art.article_id,
                "title": art.title,
                "category": art.category,
                "image": art.image_url or "",
                "description": art.description or "",
                "summary": art.summary or "",
                "content": art.content or ""
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route('/api/admin/articles', methods=['POST'])
@login_required
@permission_required('all')
def admin_create_article():
    try:
        data = request.get_json() or {}
        title = data.get('title')
        category = data.get('category')
        image_url = data.get('image')
        description = data.get('description')
        summary = data.get('summary')
        content = data.get('content')
        
        if not title or not category:
            return jsonify({"status": "error", "message": "Tiêu đề và danh mục không được để trống."}), 400
            
        new_art = KnowledgeArticleDB(
            title=title,
            category=category,
            image_url=image_url,
            description=description,
            summary=summary,
            content=content
        )
        db_session.add(new_art)
        db_session.commit()
        return jsonify({
            "status": "success", 
            "message": "Đã tạo bài viết mới thành công.",
            "article": {
                "id": new_art.article_id,
                "title": new_art.title,
                "category": new_art.category,
                "image": new_art.image_url or "",
                "description": new_art.description or "",
                "summary": new_art.summary or "",
                "content": new_art.content or ""
            }
        })
    except Exception as e:
        db_session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route('/api/admin/articles/<int:article_id>', methods=['PUT'])
@login_required
@permission_required('all')
def admin_update_article(article_id):
    try:
        art = db_session.query(KnowledgeArticleDB).filter(KnowledgeArticleDB.article_id == article_id).first()
        if not art:
            return jsonify({"status": "error", "message": "Không tìm thấy bài viết."}), 404
            
        data = request.get_json() or {}
        title = data.get('title')
        category = data.get('category')
        image_url = data.get('image')
        description = data.get('description')
        summary = data.get('summary')
        content = data.get('content')
        
        if title:
            art.title = title
        if category:
            art.category = category
        if image_url is not None:
            art.image_url = image_url
        if description is not None:
            art.description = description
        if summary is not None:
            art.summary = summary
        if content is not None:
            art.content = content
            
        db_session.commit()
        return jsonify({"status": "success", "message": "Đã cập nhật bài viết thành công."})
    except Exception as e:
        db_session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@admin_bp.route('/api/admin/articles/<int:article_id>', methods=['DELETE'])
@login_required
@permission_required('all')
def admin_delete_article(article_id):
    try:
        art = db_session.query(KnowledgeArticleDB).filter(KnowledgeArticleDB.article_id == article_id).first()
        if not art:
            return jsonify({"status": "error", "message": "Không tìm thấy bài viết."}), 404
            
        db_session.delete(art)
        db_session.commit()
        return jsonify({"status": "success", "message": "Đã xóa bài viết thành công."})
    except Exception as e:
        db_session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


