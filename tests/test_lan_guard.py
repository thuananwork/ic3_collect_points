"""Kiểm thử chốt chặn LAN: học sinh chỉ gọi được ba đường gửi điểm, giáo viên dùng được mọi thứ từ chính laptop."""
import os
import sys
import unittest

_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, _BACKEND)

from flask import Flask  # noqa: E402
from src.utils import lan_guard  # noqa: E402

STUDENT = '192.168.1.57'
OWN_LAN = '192.168.1.182'


def make_app():
    app = Flask(__name__)

    @app.route('/')
    def index():
        return 'giao dien'

    @app.route('/api/dashboard-info')
    def dash():
        return 'du lieu'

    @app.route('/api/action', methods=['POST'])
    def action():
        return 'da sua'

    @app.route('/api/export-excel')
    def excel():
        return 'excel'

    @app.route('/api/save-score', methods=['POST', 'OPTIONS'])
    def save():
        return 'OK'

    @app.route('/nhan_ip')
    def nhan_ip():
        return 'OK'

    @app.route('/tools/ThuDiem_Flash.ps1')
    def tool():
        return 'script'

    lan_guard.install(app)
    return app


class LanGuardTest(unittest.TestCase):
    def setUp(self):
        # Giả lập laptop có địa chỉ LAN riêng, không phụ thuộc máy đang chạy test
        self._saved = lan_guard.own_addresses
        lan_guard.own_addresses = lambda force=False: frozenset({lan_guard._normalize(OWN_LAN)})
        self.client = make_app().test_client()

    def tearDown(self):
        lan_guard.own_addresses = self._saved

    def call(self, method, path, addr):
        return self.client.open(path, method=method, environ_overrides={'REMOTE_ADDR': addr})

    def test_student_can_use_only_the_three_paths(self):
        self.assertEqual(self.call('POST', '/api/save-score', STUDENT).status_code, 200)
        self.assertEqual(self.call('OPTIONS', '/api/save-score', STUDENT).status_code, 200)
        self.assertEqual(self.call('GET', '/nhan_ip', STUDENT).status_code, 200)
        self.assertEqual(self.call('GET', '/tools/ThuDiem_Flash.ps1', STUDENT).status_code, 200)

    def test_student_blocked_everywhere_else(self):
        for method, path in [
            ('GET', '/'), ('GET', '/api/dashboard-info'), ('POST', '/api/action'),
            ('GET', '/api/export-excel'), ('GET', '/choose-school'), ('GET', '/assets/index.js'),
            ('GET', '/api/save-score/'), ('GET', '/tools/'), ('GET', '/scripts/lay_ip.bat'),
        ]:
            r = self.call(method, path, STUDENT)
            self.assertEqual(r.status_code, 403, '%s %s phai bi chan' % (method, path))
            self.assertEqual(r.get_json()['status'], 'error')

    def test_teacher_on_loopback_can_do_everything(self):
        for addr in ('127.0.0.1', '::1', '::ffff:127.0.0.1'):
            self.assertEqual(self.call('GET', '/', addr).status_code, 200)
            self.assertEqual(self.call('POST', '/api/action', addr).status_code, 200)
            self.assertEqual(self.call('GET', '/api/export-excel', addr).status_code, 200)

    def test_teacher_opening_via_own_lan_address(self):
        # Giáo viên gõ http://<IP LAN của laptop>:5000 ngay trên laptop: địa chỉ nguồn là IP LAN của chính máy
        self.assertEqual(self.call('GET', '/', OWN_LAN).status_code, 200)
        self.assertEqual(self.call('POST', '/api/action', OWN_LAN).status_code, 200)

    def test_garbage_and_missing_address_are_blocked(self):
        for addr in ('', 'khong-phai-ip', '999.1.1.1'):
            self.assertEqual(self.call('GET', '/api/dashboard-info', addr).status_code, 403)

    def test_lookalike_addresses_are_not_local(self):
        for addr in ('127.0.0.2.5', '192.168.1.183', '10.0.0.1'):
            self.assertEqual(self.call('GET', '/', addr).status_code, 403, addr)
        # 127.0.0.2 vẫn là loopback thật theo chuẩn, giáo viên không dùng nhưng không phải học sinh
        self.assertTrue(lan_guard.is_local_request('127.0.0.2', own=frozenset()))


if __name__ == '__main__':
    unittest.main()
