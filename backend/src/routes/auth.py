"""Đăng nhập bằng tài khoản trong account.lic (bản offline, không có máy chủ tài khoản).

Luồng: chưa có/ hết hạn account.lic -> màn hình đăng nhập hiện mã máy để gửi tác giả và cho chọn file .lic;
có account.lic hợp lệ -> nhập tên đăng nhập + mật khẩu. Giao diện/API của giáo viên chỉ mở sau khi đăng nhập.
Ba đường gửi điểm của máy học sinh không cần đăng nhập nhưng cần giấy phép còn hạn trên máy này.
"""
import os
import time

from flask import Blueprint, jsonify, request, session

from src.auth_stub import current_user
from src.utils import licence as lic
from src.utils.lan_guard import LAN_ALLOWED_PATHS
from src.utils.paths import app_dir

auth_bp = Blueprint('auth', __name__)

MAX_LIC_BYTES = 64 * 1024
_PROTECTED_PREFIXES = ('/api/', '/scripts/', '/tools/', '/uploads/', '/lay_ip.bat')


def app_root():
    return app_dir()


def licence_file():
    return os.path.join(app_root(), 'account.lic')


def _read_licence():
    try:
        with open(licence_file(), 'rb') as f:
            return f.read(MAX_LIC_BYTES + 1)
    except OSError:
        return None


def licence_status(now=None):
    """(trạng thái, payload hoặc None) của giấy phép trên máy này, đã tính cả việc chỉnh lùi đồng hồ."""
    now = time.time() if now is None else now
    raw = _read_licence()
    if raw is None:
        return lic.MISSING, None
    if len(raw) > MAX_LIC_BYTES:
        return lic.INVALID, None
    local = lic.LocalState()
    if lic.clock_rolled_back(local.load(), now):
        return lic.CLOCK_ROLLBACK, None
    state, payload = lic.check_licence(raw, lic.read_pubkey(), lic.machine_code(), now)
    if state == lic.OK:
        _touch_clock(local, now)
    return state, payload


def _touch_clock(local, now):
    data = local.load()
    if now - float(data.get('last_seen', 0)) > 300:
        data['last_seen'] = now
        try:
            local.save(data)
        except OSError:
            pass


def is_logged_in(state, payload):
    return state == lic.OK and payload is not None and session.get('lic_user') == payload['user']


def _licence_info(state, payload):
    info = {'state': state, 'message': lic.MESSAGES.get(state, '')}
    if payload is not None and state in (lic.OK, lic.EXPIRED):
        info['holder'] = payload.get('holder', '')
        info['expires'] = payload['expires']
        info['days_left'] = lic.days_left(payload)
    return info


def _status_response(state, payload):
    authed = is_logged_in(state, payload)
    body = {
        'authenticated': authed,
        'machine_code': lic.machine_code(),
        'licence': _licence_info(state, payload),
    }
    if authed:
        u = current_user()
        body['user'] = {
            'id': str(u.id), 'name': payload.get('holder') or u.name, 'role': u.role,
            'permissions': u.permissions, 'email': u.email,
        }
    return jsonify(body)


@auth_bp.route('/api/auth/status')
def status():
    state, payload = licence_status()
    return _status_response(state, payload)


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', ''))[:100]
    password = str(data.get('password', ''))[:200]
    raw = _read_licence()
    if raw is None:
        return jsonify({'status': 'error', 'code': lic.MISSING, 'message': lic.MESSAGES[lic.MISSING]}), 400
    ok, code, wait = lic.login(raw, lic.read_pubkey(), lic.machine_code(), username, password, lic.LocalState())
    if not ok:
        if code == 'locked':
            msg = 'Sai quá nhiều lần. Thử lại sau %d giây.' % wait
        elif code == 'bad_credentials':
            msg = 'Sai tên đăng nhập hoặc mật khẩu.' + (' Tạm khoá %d giây.' % wait if wait else '')
        else:
            msg = lic.MESSAGES.get(code, 'Không đăng nhập được.')
        return jsonify({'status': 'error', 'code': code, 'message': msg, 'wait': wait}), 401 if code in ('bad_credentials', 'locked') else 403
    session.clear()
    session['lic_user'] = username
    state, payload = licence_status()
    return _status_response(state, payload)


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'success'})


@auth_bp.route('/api/auth/licence', methods=['POST'])
def upload_licence():
    """Nhận file account.lic do tác giả cấp. Chỉ ghi khi chữ ký đúng, đúng máy và còn hạn."""
    if 'file' in request.files:
        raw = request.files['file'].read(MAX_LIC_BYTES + 1)
    else:
        raw = request.get_data(cache=False)[:MAX_LIC_BYTES + 1]
    if not raw or len(raw) > MAX_LIC_BYTES:
        return jsonify({'status': 'error', 'code': lic.INVALID, 'message': lic.MESSAGES[lic.INVALID]}), 400
    state, _payload = lic.check_licence(raw, lic.read_pubkey(), lic.machine_code(), time.time())
    if state != lic.OK:
        return jsonify({'status': 'error', 'code': state, 'message': lic.MESSAGES.get(state, '')}), 400
    path = licence_file()
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(raw)
    os.replace(tmp, path)
    session.clear()
    state, payload = licence_status()
    return _status_response(state, payload)


def install_guard(app):
    """Chạy sau lan_guard: chặn mọi API/đường dẫn của giáo viên khi chưa đăng nhập."""

    @app.before_request
    def _auth_guard():
        path = request.path
        if path.startswith('/api/auth/'):
            return None
        if path in LAN_ALLOWED_PATHS:
            state, _ = licence_status()
            if state == lic.OK:
                return None
            return jsonify({'status': 'error', 'code': 'licence', 'message': lic.MESSAGES.get(state, '')}), 403
        if path.startswith(_PROTECTED_PREFIXES):
            state, payload = licence_status()
            if not is_logged_in(state, payload):
                return jsonify({'status': 'error', 'code': 'auth_required', 'licence': state,
                                'message': 'Cần đăng nhập.'}), 401
        return None

    return app
