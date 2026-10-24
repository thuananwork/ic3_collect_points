import os
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from src.config.settings import Config
from src.utils.helpers import load_json, save_json, parse_danh_sach, parse_scores_regex
from src.middleware.auth import permission_required

# Import domain controllers
from src.controllers.school_class_controller import (
    handle_set_scoring as ctrl_handle_set_scoring
)
from src.controllers.computer_controller import (
    handle_generate_bat as ctrl_handle_generate_bat,
    handle_nhan_ip as ctrl_handle_nhan_ip,
    handle_clear_ip_mapping as ctrl_handle_clear_ip_mapping,
    handle_get_ip_mapping as ctrl_handle_get_ip_mapping
)
from src.controllers.workstation_controller import (
    api_dashboard_info as ctrl_api_dashboard_info,
    api_seating_info as ctrl_api_seating_info,
    api_muctieu_info as ctrl_api_muctieu_info,
    handle_update_pc_mapping as ctrl_handle_update_pc_mapping,
    handle_save_target as ctrl_handle_save_target,
    handle_save_name as ctrl_handle_save_name,
    handle_save_ot as ctrl_handle_save_ot,
    handle_save_bulk_target as ctrl_handle_save_bulk_target,
    handle_save_bulk_ot as ctrl_handle_save_bulk_ot,
    handle_save_list as ctrl_handle_save_list,
    handle_publish_data as ctrl_handle_publish_data
)
from src.controllers.score_controller import (
    handle_get_data as ctrl_handle_get_data,
    handle_save_score as ctrl_handle_save_score,
    handle_save_manual_score as ctrl_handle_save_manual_score,
    handle_delete_scores as ctrl_handle_delete_scores
)

# Khởi tạo Blueprint cho toàn bộ API chính
api_bp = Blueprint('api', __name__)

STORAGE_PATH = Config.STORAGE_PATH
DANHSACH_PATH = Config.DANHSACH_PATH
SCORES_PATH = Config.SCORES_PATH

def get_active_class():
    if current_user.is_authenticated:
        from src.utils.db_helpers import get_teacher_active_class_object
        c = get_teacher_active_class_object(int(current_user.id))
        return c.class_name if c else ""
    return ""

def get_scoring_class():
    if current_user.is_authenticated:
        from src.utils.db_helpers import get_teacher_scoring_class_object
        c = get_teacher_scoring_class_object(int(current_user.id))
        return c.class_name if c else ""
    return ""

# --- API ROUTES ---

@api_bp.route('/api/init')
def api_init():
    active = get_active_class()
    return jsonify({
        "active_class": active,
        "is_authenticated": current_user.is_authenticated,
        "user": {
            "name": current_user.name,
            "role": current_user.role
        } if current_user.is_authenticated else None
    })

@api_bp.route('/api/dashboard-info')
@login_required
@permission_required('laydiem')
def api_dashboard_info():
    ten_lop = get_active_class()
    return ctrl_api_dashboard_info(ten_lop)

@api_bp.route('/api/seating-info')
@login_required
@permission_required('chongoi')
def api_seating_info():
    ten_lop = get_active_class()
    return ctrl_api_seating_info(ten_lop)

@api_bp.route('/api/muctieu-info')
@login_required
@permission_required('muctieu')
def api_muctieu_info():
    ten_lop = get_active_class()
    return ctrl_api_muctieu_info(ten_lop)

# Quyền cần có cho từng action (chỉ cần một trong các quyền liệt kê; admin luôn được).
# Khớp với trang đang gọi: Dashboard dùng "laydiem", sơ đồ chỗ ngồi dùng "chongoi", mục tiêu dùng "muctieu".
ACTION_PERMISSIONS = {
    'get_data': ('laydiem', 'chongoi', 'muctieu'),
    'update_pc_mapping': ('chongoi', 'laydiem'),
    'save_target': ('laydiem', 'muctieu'),
    'save_ot': ('laydiem', 'muctieu'),
    'save_bulk_target': ('laydiem', 'muctieu'),
    'save_bulk_ot': ('laydiem', 'muctieu'),
    'save_list': ('laydiem',),
    'save_name': ('laydiem',),
    'save_manual_score': ('laydiem',),
    'delete_scores': ('laydiem',),
    'clear_ip_mapping': ('laydiem',),
    'generate_bat': ('laydiem',),
    'set_scoring': ('laydiem',),
    'publish': ('laydiem',),
}


@api_bp.route('/api/action', methods=['POST'])
@login_required
def api_dispatcher_post():
    data = request.get_json(silent=True) or {}
    action = data.get('action')

    required = ACTION_PERMISSIONS.get(action)
    if required is not None and not any(current_user.has_permission(p) for p in required):
        return jsonify({"status": "error", "message": f"Bạn không có quyền thực hiện thao tác này ({action})"}), 403

    ten_lop = get_active_class()
    
    if action == 'get_data':
        return ctrl_handle_get_data(ten_lop, parse_danh_sach, parse_scores_regex)
    if action == 'update_pc_mapping':
        return ctrl_handle_update_pc_mapping(ten_lop)
    if action == 'save_target':
        return ctrl_handle_save_target(ten_lop)
    if action == 'save_ot':
        return ctrl_handle_save_ot(ten_lop)
    if action == 'save_bulk_target':
        return ctrl_handle_save_bulk_target(ten_lop)
    if action == 'save_bulk_ot':
        return ctrl_handle_save_bulk_ot(ten_lop)
    if action == 'save_list':
        return ctrl_handle_save_list(ten_lop)
    if action == 'save_name':
        return ctrl_handle_save_name(ten_lop)
    if action == 'save_manual_score':
        return ctrl_handle_save_manual_score(ten_lop)
    if action == 'delete_scores':
        return ctrl_handle_delete_scores(ten_lop)
    if action == 'clear_ip_mapping':
        return ctrl_handle_clear_ip_mapping()
    if action == 'generate_bat':
        return ctrl_handle_generate_bat()
    if action == 'set_scoring':
        return ctrl_handle_set_scoring()
    if action == 'publish':
        return ctrl_handle_publish_data(ten_lop)

    return jsonify({"status": "error", "message": "Action not found"}), 404

@api_bp.route('/tools/ThuDiem_Flash.ps1')
def route_tool_thudiem():
    from src.controllers.computer_controller import handle_tool_thudiem
    return handle_tool_thudiem()

@api_bp.route('/nhan_ip')
def route_nhan_ip():
    return ctrl_handle_nhan_ip()

@api_bp.route('/api/save-score', methods=['POST', 'OPTIONS'])
def route_save_score():
    if request.method == 'OPTIONS':
        resp = jsonify({"status": "success"})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return resp
        
    res = ctrl_handle_save_score(get_scoring_class, get_active_class)
    from flask import Response
    if isinstance(res, tuple):
        content, status = res
        resp = Response(content, status=status)
    elif isinstance(res, Response):
        resp = res
    else:
        resp = Response(res)
        
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return resp


@api_bp.route('/api/ip-mapping', methods=['GET'])
@login_required
@permission_required('laydiem')
def api_ip_mapping():
    return ctrl_handle_get_ip_mapping()

# Import sub-modules to register routes under api_bp
from . import api_school_class, api_excel_gsheet, api_operation_tools
