"""Thử giao diện web cấp tài khoản bằng thư mục tác giả tạm (không đụng khoá thật)."""
import base64
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'backend'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'captaikhoan'))

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:  # pragma: no cover
    Ed25519PrivateKey = None

MACHINE = 'B5C5-A8C8-0CC0-A787-B083'
MACHINE2 = 'A1B2-C3D4-E5F6-0718-293A'


@unittest.skipIf(Ed25519PrivateKey is None, 'thiếu cryptography')
class WebToolTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        os.environ['IC3_AUTHOR_DIR'] = cls.tmp
        import captaikhoan as ck
        import captaikhoan_web as web
        cls.web = web
        key = Ed25519PrivateKey.generate()
        os.makedirs(os.path.join(cls.tmp, 'secrets'))
        with open(os.path.join(cls.tmp, 'secrets', 'signing.key'), 'w') as f:
            f.write(ck.lic.b64e(key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())))
        cls.httpd = web.make_server()
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = 'http://127.0.0.1:%d' % cls.httpd.server_port

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        os.environ.pop('IC3_AUTHOR_DIR', None)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def post(self, path, body, token=True):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['X-Token'] = self.httpd.token
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode(), headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def issue(self, **kw):
        body = dict(holder='Nguyễn Văn A', user='', email='', password='MatKhau-123', months=2, max_machines=4, machines=MACHINE)
        body.update(kw)
        return self.post('/api/issue', body)[1]

    def test_page_needs_token(self):
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(self.base + '/')
        self.assertEqual(cm.exception.code, 403)
        with urllib.request.urlopen('%s/?t=%s' % (self.base, self.httpd.token)) as r:
            html = r.read().decode()
        self.assertIn(self.httpd.token, html)
        self.assertNotIn('__TOKEN__', html)

    def test_api_without_token_refused(self):
        self.assertEqual(self.post('/api/issue', {}, token=False)[0], 403)

    def test_issue_download_edit_list(self):
        res = self.issue(email='A@Truong.vn')
        self.assertTrue(res['ok'], res)
        self.assertEqual(res['info']['user'], 'nguyenvana')
        self.assertEqual(res['info']['email'], 'a@truong.vn')
        self.assertEqual(res['info']['machines'], [MACHINE])
        with urllib.request.urlopen('%s/download?t=%s&f=%s' % (self.base, self.httpd.token, urllib.parse.quote(res['rel']))) as r:
            raw = r.read()
        # sửa: thêm một máy, gia hạn
        out = self.post('/api/edit', {'data': base64.b64encode(raw).decode(), 'add': MACHINE2, 'remove': [], 'months': 6, 'max_machines': ''})[1]
        self.assertTrue(out['ok'], out)
        self.assertEqual(len(out['info']['machines']), 2)
        self.assertEqual(out['info']['email'], 'a@truong.vn')
        self.assertGreater(out['info']['days_left'], 150)
        rows = self.post('/api/list', {})[1]['rows']
        self.assertGreaterEqual(len(rows), 2)

    def test_any_machine_issue_and_switch(self):
        res = self.issue(machines='', any_machine=True, holder='Khach Tu Do')
        self.assertTrue(res['ok'], res)
        self.assertTrue(res['info']['any_machine'])
        self.assertEqual(res['info']['machines'], [])
        with urllib.request.urlopen('%s/download?t=%s&f=%s' % (self.base, self.httpd.token, urllib.parse.quote(res['rel']))) as r:
            raw = base64.b64encode(r.read()).decode()
        # thêm mã máy khi đang không ràng buộc thì bị từ chối
        self.assertFalse(self.post('/api/edit', {'data': raw, 'add': MACHINE})[1]['ok'])
        # chuyển sang ràng buộc mà không có mã máy: từ chối
        self.assertFalse(self.post('/api/edit', {'data': raw, 'any_machine': 'no'})[1]['ok'])
        # chuyển sang ràng buộc kèm mã máy
        out = self.post('/api/edit', {'data': raw, 'any_machine': 'no', 'add': MACHINE})[1]
        self.assertTrue(out['ok'], out)
        self.assertFalse(out['info']['any_machine'])
        self.assertEqual(out['info']['machines'], [MACHINE])
        # và quay lại không ràng buộc
        back = self.post('/api/edit', {'data': raw, 'months': 2})[1]  # chỉ gia hạn, vẫn không ràng buộc
        self.assertTrue(back['ok'] and back['info']['any_machine'])

    def test_bound_issue_still_needs_machine(self):
        self.assertFalse(self.issue(machines='', any_machine=False)['ok'])

    def test_validation_errors(self):
        self.assertFalse(self.issue(password='ngan')['ok'])
        self.assertFalse(self.issue(machines='')['ok'])
        self.assertFalse(self.issue(machines='sai')['ok'])
        self.assertFalse(self.issue(email='khong-phai-email')['ok'])
        self.assertFalse(self.issue(holder='')['ok'])
        self.assertFalse(self.post('/api/edit', {'data': base64.b64encode(b'rac').decode(), 'add': MACHINE})[1]['ok'])

    def test_download_cannot_escape_capphat(self):
        for rel in ('../secrets/signing.key', '..\\secrets\\signing.key', '/etc/passwd'):
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen('%s/download?t=%s&f=%s' % (self.base, self.httpd.token, urllib.parse.quote(rel)))
            self.assertEqual(cm.exception.code, 404)

    def test_wrong_host_header_refused(self):
        req = urllib.request.Request('%s/?t=%s' % (self.base, self.httpd.token), headers={'Host': 'evil.example'})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertEqual(cm.exception.code, 403)


if __name__ == '__main__':
    unittest.main()
