"""Giao diện web cấp tài khoản (công cụ của TÁC GIẢ, không gửi cho ai).

Mở bằng CapTaiKhoan.bat: chạy một máy chủ nhỏ CHỈ trên máy bạn (127.0.0.1), tự mở trình duyệt.
Đóng tab trình duyệt thì chương trình tự tắt sau ít giây. Dùng lại logic của captaikhoan.py.
"""
import argparse
import base64
import contextlib
import datetime
import io
import json
import os
import secrets
import sys
import tempfile
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import captaikhoan as ck  # noqa: E402

lic = ck.lic
HERE = os.path.dirname(os.path.abspath(__file__))
IDLE_SECONDS = 150  # tab nền bị trình duyệt làm chậm nhịp ping, nên để rộng


def _run(func, **kwargs):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            code = func(argparse.Namespace(**kwargs))
    except Exception as exc:
        return False, '%s\n[!] Lỗi: %s' % (buf.getvalue(), exc)
    return code == 0, buf.getvalue()


def capphat_dir():
    return os.path.join(ck.author_dir(), 'CapPhat')


def _rel(path):
    return os.path.relpath(path, capphat_dir()).replace('\\', '/')


def _safe(rel):
    """Đường dẫn tương đối trong CapPhat -> đường dẫn thật, hoặc None nếu thoát ra ngoài."""
    base = os.path.realpath(capphat_dir())
    full = os.path.realpath(os.path.join(base, rel))
    return full if full == base or full.startswith(base + os.sep) else None


def info_of(raw):
    """Thông tin một account.lic (không có mật khẩu). Trả về (info, lỗi)."""
    state, payload = lic.parse_licence(raw, ck.author_pubkey())
    if payload is None:
        return None, 'Không đọc được file (%s). Phải là file do chính khoá của bạn cấp.' % lic.MESSAGES.get(state, state)
    left = lic.days_left(payload)
    return {
        'holder': payload.get('holder', ''), 'user': payload['user'], 'email': payload.get('email', ''),
        'machines': payload['machines'], 'any_machine': bool(payload.get('any_machine')), 'issued': payload['issued'], 'expires': payload['expires'],
        'days_left': left, 'expired': left < 0,
    }, None


def issue(d):
    holder = str(d.get('holder', '')).strip()
    user = str(d.get('user', '')).strip() or ck._slug(holder)
    password = str(d.get('password', ''))
    machines = [m for m in str(d.get('machines', '')).replace(',', ' ').split() if m]
    if not holder:
        return {'ok': False, 'text': 'Cần nhập tên đồng nghiệp.'}
    if len(password) < 8:
        return {'ok': False, 'text': 'Mật khẩu cần ít nhất 8 ký tự.'}
    any_machine = bool(d.get('any_machine'))
    if not machines and not any_machine:
        return {'ok': False, 'text': 'Cần ít nhất một mã máy (hoặc chọn "không ràng buộc máy").'}
    try:
        months, limit = int(d.get('months') or 4), int(d.get('max_machines') or lic.DEFAULT_MACHINES)
    except (TypeError, ValueError):
        return {'ok': False, 'text': 'Số tháng và số máy phải là số.'}
    if months < 1 or months > 60:
        return {'ok': False, 'text': 'Số tháng từ 1 đến 60.'}
    ok, text = _run(ck.cmd_issue, holder=holder, user=user, password=password, machines=machines, months=months,
                    max_machines=limit, out=None, email=str(d.get('email', '')).strip(), any_machine=any_machine)
    return _result(ok, text)


def _result(ok, text):
    res = {'ok': ok, 'text': text.strip()}
    if ok:
        for line in text.splitlines():
            if line.startswith('[+] Đã cấp: ') or line.startswith('[+] Đã ký lại: '):
                path = line.split(': ', 1)[1].strip()
                res['rel'] = _rel(path)
                with open(path, 'rb') as f:
                    res['info'], _ = info_of(f.read())
    else:
        res['text'] = res['text'].replace('[!] ', '')
    return res


def inspect(d):
    try:
        raw = base64.b64decode(d.get('data', ''))
    except Exception:
        return {'ok': False, 'text': 'File không đọc được.'}
    info, err = info_of(raw)
    return {'ok': info is not None, 'info': info, 'text': err or ''}


def edit(d):
    try:
        raw = base64.b64decode(d.get('data', ''))
    except Exception:
        return {'ok': False, 'text': 'File không đọc được.'}
    add = [m for m in str(d.get('add', '')).replace(',', ' ').split() if m]
    remove = [m for m in d.get('remove', []) if isinstance(m, str)]
    months, limit = d.get('months'), d.get('max_machines')
    mode = d.get('any_machine')  # None = giữ, 'yes' = bỏ ràng buộc, 'no' = ràng buộc lại
    mode = mode if mode in ('yes', 'no') else None
    try:
        months = int(months) if months not in (None, '') else None
        limit = int(limit) if limit not in (None, '') else None
    except (TypeError, ValueError):
        return {'ok': False, 'text': 'Số tháng và số máy phải là số.'}
    if not (add or remove or months or limit or mode):
        return {'ok': False, 'text': 'Chưa có gì để sửa.'}
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'account.lic')
        with open(src, 'wb') as f:
            f.write(raw)
        ok, text = _run(ck.cmd_edit, file=src, add=add, remove=remove, months=months or 0, max_machines=limit, out=None, any_machine=mode)
    return _result(ok, text)


def listing():
    rows = []
    base = capphat_dir()
    if os.path.isdir(base):
        for name in os.listdir(base):
            path = os.path.join(base, name, 'account.lic')
            if os.path.isfile(path):
                with open(path, 'rb') as f:
                    info, _ = info_of(f.read())
                if info:
                    info['rel'] = _rel(path)
                    info['mtime'] = os.path.getmtime(path)
                    rows.append(info)
    rows.sort(key=lambda r: r['mtime'], reverse=True)
    return {'ok': True, 'rows': rows}


def open_folder(d):
    target = _safe(os.path.dirname(str(d.get('rel', 'x/account.lic')))) or capphat_dir()
    if hasattr(os, 'startfile') and os.path.isdir(target):
        os.startfile(target)  # Windows
    return {'ok': True}


class Handler(BaseHTTPRequestHandler):
    server_version = 'CapTaiKhoan'

    def log_message(self, *args):
        pass

    def _host_ok(self):
        return self.headers.get('Host', '') in ('127.0.0.1:%d' % self.server.server_port, 'localhost:%d' % self.server.server_port)

    def _send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        elif isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(url.query)
        if not self._host_ok() or q.get('t', [''])[0] != self.server.token:
            return self._send(403, 'Không được phép', 'text/plain; charset=utf-8')
        if url.path == '/':
            with open(os.path.join(HERE, 'captaikhoan_web.html'), 'r', encoding='utf-8') as f:
                html = f.read().replace('__TOKEN__', self.server.token)
            return self._send(200, html, 'text/html; charset=utf-8')
        if url.path == '/download':
            full = _safe(q.get('f', [''])[0])
            if not full or not os.path.isfile(full) or os.path.basename(full) != 'account.lic':
                return self._send(404, 'Không có file', 'text/plain; charset=utf-8')
            with open(full, 'rb') as f:
                data = f.read()
            return self._send(200, data, 'application/octet-stream', {'Content-Disposition': 'attachment; filename="account.lic"'})
        self._send(404, 'Không có', 'text/plain; charset=utf-8')

    def do_POST(self):
        if not self._host_ok() or self.headers.get('X-Token') != self.server.token:
            return self._send(403, {'ok': False, 'text': 'Không được phép'})
        try:
            size = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(min(size, 2_000_000)) or b'{}')
        except (ValueError, OSError):
            return self._send(400, {'ok': False, 'text': 'Dữ liệu gửi lên không đúng'})
        routes = {'/api/issue': issue, '/api/inspect': inspect, '/api/edit': edit, '/api/open': open_folder,
                  '/api/list': lambda _d: listing()}
        if self.path == '/api/ping':
            self.server.last_ping = time.time()
            return self._send(200, {'ok': True})
        fn = routes.get(self.path)
        if fn is None:
            return self._send(404, {'ok': False, 'text': 'Không có'})
        try:
            self._send(200, fn(data))
        except Exception as exc:
            self._send(200, {'ok': False, 'text': 'Lỗi: %s' % exc})


def make_server(port=0):
    httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    httpd.token = secrets.token_urlsafe(24)
    httpd.last_ping = time.time()
    return httpd


def main():
    import webbrowser
    httpd = make_server()
    url = 'http://127.0.0.1:%d/?t=%s' % (httpd.server_port, httpd.token)

    def watchdog():
        while True:
            time.sleep(3)
            if time.time() - httpd.last_ping > IDLE_SECONDS:
                os._exit(0)

    threading.Thread(target=watchdog, daemon=True).start()
    webbrowser.open(url)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
