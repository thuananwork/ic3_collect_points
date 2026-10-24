from flask import request, jsonify
from flask_login import login_required

from src.middleware.auth import permission_required
from src.controllers.gsheet_controller import (
    handle_gsheet_tabs as ctrl_handle_gsheet_tabs,
    handle_fetch_gsheet as ctrl_handle_fetch_gsheet,
    handle_save_gsheet_targets as ctrl_handle_save_gsheet_targets
)
from src.controllers.excel_mode_controller import (
    handle_get_excel_data as ctrl_handle_get_excel_data,
    handle_save_excel_data as ctrl_handle_save_excel_data
)
from src.controllers.score_controller import (
    handle_export_excel as ctrl_handle_export_excel
)
from .api import api_bp, get_active_class

@api_bp.route('/api/gsheet-tabs', methods=['GET'])
@login_required
@permission_required('scoreboard')
def api_gsheet_tabs():
    return ctrl_handle_gsheet_tabs()

@api_bp.route('/api/fetch-gsheet', methods=['GET'])
@login_required
@permission_required('scoreboard')
def api_fetch_gsheet():
    return ctrl_handle_fetch_gsheet()

@api_bp.route('/api/save-gsheet-targets', methods=['POST'])
@login_required
@permission_required('scoreboard')
def api_save_gsheet_targets():
    ten_lop = get_active_class()
    if not ten_lop:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
    return ctrl_handle_save_gsheet_targets(ten_lop)

@api_bp.route('/api/export-excel', methods=['GET'])
@login_required
@permission_required('laydiem')
def api_export_excel():
    ten_lop = request.args.get('lop', '').strip()
    if not ten_lop:
        ten_lop = get_active_class()
    if not ten_lop:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
    return ctrl_handle_export_excel(ten_lop)

@api_bp.route('/api/excel-data', methods=['GET'])
@login_required
@permission_required('excel-mode')
def api_get_excel_data():
    return ctrl_handle_get_excel_data()

@api_bp.route('/api/save-excel-data', methods=['POST'])
@login_required
@permission_required('excel-mode')
def api_save_excel_data():
    lop = request.args.get('lop', '').strip()
    if not lop:
        lop = get_active_class()
    if not lop:
        return jsonify({"status": "error", "message": "Chưa chọn lớp"}), 400
    return ctrl_handle_save_excel_data(lop)
