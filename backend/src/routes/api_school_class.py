from flask import Blueprint, request, jsonify
from flask_login import login_required

from src.middleware.auth import permission_required
from src.controllers.school_class_controller import (
    api_schools as ctrl_api_schools,
    api_classes as ctrl_api_classes
)
from .api import api_bp

@api_bp.route('/api/schools', methods=['GET', 'POST'])
@login_required
@permission_required('chonlop')
def api_schools():
    return ctrl_api_schools()

@api_bp.route('/api/classes', methods=['GET', 'POST'])
@login_required
@permission_required('chonlop')
def api_classes():
    return ctrl_api_classes()

