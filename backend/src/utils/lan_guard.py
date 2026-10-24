"""Chốt chặn mạng LAN cho bản offline (ic3_collect_points).

Máy học sinh cùng mạng với laptop giáo viên nhưng KHÔNG được mở giao diện hay gọi API của giáo viên.
Từ máy khác chỉ cho đúng ba đường mà phía học sinh cần:
  - /api/save-score            file đề _LAN.exe / ThuDiem_Flash.ps1 gửi điểm về
  - /nhan_ip                   lay_ip.bat đăng ký máy học sinh
  - /tools/ThuDiem_Flash.ps1   lay_ip.bat tải script theo dõi điểm
Mọi đường khác chỉ nhận từ chính laptop này (127.0.0.1 hoặc địa chỉ riêng của máy).
"""
import ipaddress
import socket
import time

LAN_ALLOWED_PATHS = frozenset({
    '/api/save-score',
    '/nhan_ip',
    '/tools/ThuDiem_Flash.ps1',
})

_OWN_TTL = 30  # giây; laptop đổi mạng thì địa chỉ đổi, nên không lưu lâu
_own_cache = {'at': 0.0, 'addrs': frozenset()}


def _normalize(addr):
    """Chuẩn hoá địa chỉ IP (bỏ zone id, đổi ::ffff:a.b.c.d về IPv4)."""
    if not addr:
        return None
    try:
        ip = ipaddress.ip_address(str(addr).split('%')[0])
    except ValueError:
        return None
    if getattr(ip, 'ipv4_mapped', None):
        ip = ip.ipv4_mapped
    return ip


def own_addresses(force=False):
    """Các địa chỉ IP của chính máy này (để giáo viên mở bằng http://<IP-LAN-của-laptop>:5000 vẫn vào được)."""
    now = time.monotonic()
    if not force and now - _own_cache['at'] < _OWN_TTL and _own_cache['addrs']:
        return _own_cache['addrs']
    found = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            ip = _normalize(info[4][0])
            if ip:
                found.add(ip)
    except OSError:
        pass
    try:
        # Địa chỉ đang dùng để ra mạng (không gửi gói tin nào, chỉ hỏi hệ điều hành)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            ip = _normalize(s.getsockname()[0])
            if ip:
                found.add(ip)
        finally:
            s.close()
    except OSError:
        pass
    _own_cache['at'] = now
    _own_cache['addrs'] = frozenset(found)
    return _own_cache['addrs']


def is_local_request(remote_addr, own=None):
    ip = _normalize(remote_addr)
    if ip is None:
        return False
    if ip.is_loopback:
        return True
    return ip in (own if own is not None else own_addresses())


def is_allowed(path, remote_addr, own=None):
    if path in LAN_ALLOWED_PATHS:
        return True
    return is_local_request(remote_addr, own)


def install(app):
    """Gắn chốt chặn vào Flask app (chạy trước mọi route)."""
    from flask import jsonify, request

    @app.before_request
    def _lan_guard():
        if is_allowed(request.path, request.remote_addr):
            return None
        return jsonify({
            'status': 'error',
            'message': 'Chỉ máy giáo viên được dùng giao diện này.',
        }), 403

    return app
