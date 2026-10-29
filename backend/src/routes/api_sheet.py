from src.middleware.auth import login_required, permission_required
from src.controllers import sheet_controller as c
from .api import api_bp


@api_bp.route('/api/sheet-classes', methods=['GET'])
@login_required
@permission_required('laydiem')
def sheet_classes():
    return c.api_sheet_classes()


@api_bp.route('/api/sheet-data', methods=['GET'])
@login_required
@permission_required('laydiem')
def sheet_data():
    return c.api_sheet_data()


@api_bp.route('/api/sheet-cell', methods=['POST'])
@login_required
@permission_required('laydiem')
def sheet_cell():
    return c.api_sheet_cell()


@api_bp.route('/api/sheet-cells', methods=['POST'])
@login_required
@permission_required('laydiem')
def sheet_cells():
    return c.api_sheet_cells()


@api_bp.route('/api/sheet-export', methods=['GET'])
@login_required
@permission_required('laydiem')
def sheet_export():
    return c.api_sheet_export()


@api_bp.route('/api/sheet-export-all', methods=['GET'])
@login_required
@permission_required('laydiem')
def sheet_export_all():
    return c.api_sheet_export_all()


@api_bp.route('/api/sheet-copy', methods=['POST'])
@login_required
@permission_required('laydiem')
def sheet_copy():
    return c.api_sheet_copy()
