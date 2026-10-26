"""Kiểm thử giấy phép account.lic: ký/kiểm, hết hạn, sai máy, chỉnh sửa, khoá khi sai mật khẩu, chỉnh lùi đồng hồ, và luồng đăng nhập qua Flask."""
import datetime
import os
import shutil
import sys
import tempfile
import time
import unittest

_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, _BACKEND)

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402
from flask import Flask  # noqa: E402

from src.utils import licence as lic  # noqa: E402
from src.utils import lan_guard  # noqa: E402

MACHINE = 'AAAA-BBBB-CCCC-DDDD-EEEE'
OTHER = '1111-2222-3333-4444-5555'
DAY = 86400


def new_keys():
    k = Ed25519PrivateKey.generate()
    priv = k.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    pub = k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return priv, pub


def make_payload(machines=(MACHINE,), user='gv01', password='MatKhau-Manh-1', days=120, **extra):
    today = datetime.date.today()
    p = {'v': 1, 'product': lic.PRODUCT, 'holder': 'Thầy A', 'user': user, 'pw': lic.hash_password(password),
         'issued': today.isoformat(), 'expires': (today + datetime.timedelta(days=days)).isoformat(),
         'machines': list(machines)}
    p.update(extra)
    return p


class CoreTest(unittest.TestCase):
    def setUp(self):
        self.priv, self.pub = new_keys()
        self.tmp = tempfile.mkdtemp()
        self.local = lic.LocalState(self.tmp, machine=MACHINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def raw(self, **kw):
        return lic.sign_licence(make_payload(**kw), self.priv)

    def test_valid_licence(self):
        state, p = lic.check_licence(self.raw(), self.pub, MACHINE)
        self.assertEqual(state, lic.OK)
        self.assertEqual(p['user'], 'gv01')
        self.assertNotIn('MatKhau', str(p))  # mat khau khong nam trong tep

    def test_machine_code_comparison_ignores_dashes_and_case(self):
        self.assertEqual(lic.check_licence(self.raw(), self.pub, 'aaaabbbbccccddddeeee')[0], lic.OK)

    def test_wrong_machine(self):
        self.assertEqual(lic.check_licence(self.raw(), self.pub, OTHER)[0], lic.WRONG_MACHINE)

    def test_up_to_four_machines(self):
        four = [MACHINE, OTHER, '2222-3333-4444-5555-6666', '3333-4444-5555-6666-7777']
        self.assertEqual(lic.check_licence(self.raw(machines=four), self.pub, four[3])[0], lic.OK)

    def test_six_machines_allowed_when_author_signs_them(self):
        six = [MACHINE] + ['%04d-0000-0000-0000-0000' % i for i in range(1, 6)]
        self.assertEqual(lic.check_licence(self.raw(machines=six), self.pub, six[5])[0], lic.OK)

    def test_hard_ceiling_rejected_even_if_signed(self):
        too_many = [MACHINE] + ['%04d-0000-0000-0000-0000' % i for i in range(1, lic.MAX_MACHINES + 1)]
        self.assertEqual(lic.check_licence(self.raw(machines=too_many), self.pub, MACHINE)[0], lic.INVALID)

    def test_zero_machines_rejected(self):
        self.assertEqual(lic.check_licence(self.raw(machines=[]), self.pub, MACHINE)[0], lic.INVALID)

    def test_expiry_boundary(self):
        raw = self.raw(days=0)  # het han cuoi ngay hom nay
        today_end = datetime.datetime.combine(datetime.date.today(), datetime.time(23, 59, 0)).timestamp()
        self.assertEqual(lic.check_licence(raw, self.pub, MACHINE, today_end)[0], lic.OK)
        self.assertEqual(lic.check_licence(raw, self.pub, MACHINE, today_end + 120)[0], lic.EXPIRED)

    def test_tampered_payload_or_signature(self):
        import json
        doc = json.loads(self.raw().decode())
        forged = lic.b64e(lic.b64d(doc['payload']).replace(b'gv01', b'gv02'))
        self.assertEqual(lic.check_licence(json.dumps({'payload': forged, 'sig': doc['sig']}).encode(), self.pub, MACHINE)[0], lic.INVALID)
        bad_sig = lic.b64e(b'x' * 64)
        self.assertEqual(lic.check_licence(json.dumps({'payload': doc['payload'], 'sig': bad_sig}).encode(), self.pub, MACHINE)[0], lic.INVALID)

    def test_signed_by_someone_else(self):
        other_priv, _ = new_keys()
        raw = lic.sign_licence(make_payload(), other_priv)
        self.assertEqual(lic.check_licence(raw, self.pub, MACHINE)[0], lic.INVALID)

    def test_garbage_and_missing_pubkey(self):
        for junk in (b'', b'khong phai json', b'{}', b'{"payload":1,"sig":2}', b'\xff\xfe'):
            self.assertEqual(lic.check_licence(junk, self.pub, MACHINE)[0], lic.INVALID)
        self.assertEqual(lic.check_licence(self.raw(), None, MACHINE)[0], lic.NO_PUBKEY)

    def test_password_hash(self):
        rec = lic.hash_password('abc12345')
        self.assertTrue(lic.verify_password('abc12345', rec))
        self.assertFalse(lic.verify_password('abc12346', rec))
        self.assertFalse(lic.verify_password('', rec))
        self.assertNotEqual(lic.hash_password('abc12345')['hash'], rec['hash'])  # muoi khac nhau
        self.assertFalse(lic.verify_password('x', {'algo': 'md5'}))

    def test_login_success_and_wrong_user_or_password(self):
        raw = self.raw()
        now = time.time()
        self.assertEqual(lic.login(raw, self.pub, MACHINE, 'gv01', 'MatKhau-Manh-1', self.local, now), (True, lic.OK, 0))
        self.assertEqual(lic.login(raw, self.pub, MACHINE, 'gv01', 'sai', self.local, now)[1], 'bad_credentials')
        self.assertEqual(lic.login(raw, self.pub, MACHINE, 'gv99', 'MatKhau-Manh-1', self.local, now)[1], 'bad_credentials')

    def test_lockout_after_five_failures_and_recovery(self):
        raw = self.raw()
        now = time.time()
        for i in range(lic.MAX_FAILS):
            ok, code, _ = lic.login(raw, self.pub, MACHINE, 'gv01', 'sai%d' % i, self.local, now)
            self.assertFalse(ok)
        # dung mat khau luc nay cung bi khoa
        ok, code, wait = lic.login(raw, self.pub, MACHINE, 'gv01', 'MatKhau-Manh-1', self.local, now + 1)
        self.assertEqual((ok, code), (False, 'locked'))
        self.assertGreater(wait, 0)
        # het thoi gian khoa thi dang nhap lai duoc va xoa bo dem
        ok, code, _ = lic.login(raw, self.pub, MACHINE, 'gv01', 'MatKhau-Manh-1', self.local, now + lic.LOCK_BASE_SECONDS + 5)
        self.assertTrue(ok)
        self.assertNotIn('fails', self.local.load())

    def test_lockout_grows_but_is_capped(self):
        raw = self.raw()
        now = time.time()
        for i in range(lic.MAX_FAILS + 12):
            now += lic.LOCK_MAX_SECONDS + 1
            lic.login(raw, self.pub, MACHINE, 'gv01', 'sai', self.local, now)
        self.assertLessEqual(lic.lock_remaining(self.local.load(), now), lic.LOCK_MAX_SECONDS)

    def test_clock_rollback_detected(self):
        raw = self.raw()
        now = time.time()
        self.assertTrue(lic.login(raw, self.pub, MACHINE, 'gv01', 'MatKhau-Manh-1', self.local, now + 10 * DAY)[0])
        ok, code, _ = lic.login(raw, self.pub, MACHINE, 'gv01', 'MatKhau-Manh-1', self.local, now)
        self.assertEqual((ok, code), (False, lic.CLOCK_ROLLBACK))

    def test_state_file_tampering_is_ignored(self):
        self.local.save({'fails': 4})
        with open(self.local.path, 'r', encoding='utf-8') as f:
            text = f.read().replace('"fails": 4', '"fails": 0').replace('"fails":4', '"fails":0')
        with open(self.local.path, 'w', encoding='utf-8') as f:
            f.write(text)
        self.assertEqual(self.local.load(), {})


class FlaskFlowTest(unittest.TestCase):
    """Luong dang nhap day du qua Flask: guard + /api/auth/*."""

    def setUp(self):
        from src.routes import auth as auth_mod
        self.auth = auth_mod
        self.priv, self.pub = new_keys()
        self.root = tempfile.mkdtemp()
        self.state = tempfile.mkdtemp()
        self._env = {k: os.environ.get(k) for k in ('IC3_APP_ROOT', 'IC3_STATE_DIR')}
        os.environ['IC3_APP_ROOT'] = self.root
        os.environ['IC3_STATE_DIR'] = self.state
        self._orig = (lic.read_pubkey, lic.machine_code, lan_guard.own_addresses)
        lic.read_pubkey = lambda: self.pub
        lic.machine_code = lambda raw=None: MACHINE
        lan_guard.own_addresses = lambda force=False: frozenset()

        app = Flask(__name__)
        app.secret_key = 'test'
        app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
        lan_guard.install(app)
        auth_mod.install_guard(app)
        app.register_blueprint(auth_mod.auth_bp)

        @app.route('/api/dashboard-info')
        def dash():
            return 'bang diem'

        @app.route('/api/save-score', methods=['POST'])
        def save():
            return 'OK'

        @app.route('/nhan_ip')
        def nhan_ip():
            return 'OK'

        @app.route('/')
        def index():
            return 'spa'

        @app.route('/lay_ip.bat')
        def lay_ip():
            return 'bat'

        self.c = app.test_client()

    def tearDown(self):
        lic.read_pubkey, lic.machine_code, lan_guard.own_addresses = self._orig
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(self.root, ignore_errors=True)
        shutil.rmtree(self.state, ignore_errors=True)

    def put_licence(self, **kw):
        with open(os.path.join(self.root, 'account.lic'), 'wb') as f:
            f.write(lic.sign_licence(make_payload(**kw), self.priv))

    def post(self, path, **kw):
        return self.c.post(path, environ_overrides={'REMOTE_ADDR': '127.0.0.1'}, **kw)

    def get(self, path, addr='127.0.0.1'):
        return self.c.get(path, environ_overrides={'REMOTE_ADDR': addr})

    def login(self, pw='MatKhau-Manh-1', user='gv01'):
        return self.post('/api/auth/login', json={'username': user, 'password': pw})

    def test_no_licence_everything_locked_but_status_shows_machine_code(self):
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)
        st = self.get('/api/auth/status').get_json()
        self.assertFalse(st['authenticated'])
        self.assertEqual(st['machine_code'], MACHINE)
        self.assertEqual(st['licence']['state'], lic.MISSING)
        self.assertEqual(self.get('/').status_code, 200)  # trang dang nhap van tai duoc
        self.assertEqual(self.get('/lay_ip.bat').status_code, 401)  # tep phat cho hoc sinh can dang nhap

    def test_login_flow(self):
        self.put_licence()
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)
        self.assertEqual(self.login('sai').status_code, 401)
        r = self.login()
        self.assertEqual(r.status_code, 200)
        body = r.get_json()
        self.assertTrue(body['authenticated'])
        self.assertGreater(body['licence']['days_left'], 100)
        self.assertEqual(self.get('/api/dashboard-info').status_code, 200)
        self.post('/api/auth/logout')
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)

    def test_lockout_over_http(self):
        self.put_licence()
        for _ in range(lic.MAX_FAILS):
            self.assertEqual(self.login('sai').status_code, 401)
        r = self.login()
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.get_json()['code'], 'locked')

    def test_expired_licence_blocks_login_and_active_session(self):
        self.put_licence(days=30)
        self.assertEqual(self.login().status_code, 200)
        self.put_licence(days=-1)  # het han giua chung
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)
        r = self.login()
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.get_json()['code'], lic.EXPIRED)

    def test_student_endpoints_need_valid_licence_not_login(self):
        self.assertEqual(self.c.post('/api/save-score', environ_overrides={'REMOTE_ADDR': '192.168.1.57'}).status_code, 403)
        self.put_licence()
        self.assertEqual(self.c.post('/api/save-score', environ_overrides={'REMOTE_ADDR': '192.168.1.57'}).status_code, 200)
        self.assertEqual(self.get('/nhan_ip', '192.168.1.57').status_code, 200)
        self.assertEqual(self.get('/api/dashboard-info', '192.168.1.57').status_code, 403)  # van bi lan_guard chan

    def test_upload_licence(self):
        good = lic.sign_licence(make_payload(), self.priv)
        bad_machine = lic.sign_licence(make_payload(machines=[OTHER]), self.priv)
        expired = lic.sign_licence(make_payload(days=-3), self.priv)
        other_priv, _ = new_keys()
        forged = lic.sign_licence(make_payload(), other_priv)
        for blob, code in ((bad_machine, lic.WRONG_MACHINE), (expired, lic.EXPIRED), (forged, lic.INVALID), (b'rac', lic.INVALID)):
            r = self.post('/api/auth/licence', data=blob, content_type='application/octet-stream')
            self.assertEqual(r.status_code, 400)
            self.assertEqual(r.get_json()['code'], code)
            self.assertFalse(os.path.exists(os.path.join(self.root, 'account.lic')))
        r = self.post('/api/auth/licence', data=good, content_type='application/octet-stream')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()['licence']['state'], lic.OK)
        self.assertEqual(self.login().status_code, 200)

    def test_session_from_old_user_does_not_survive_new_licence_user(self):
        self.put_licence(user='gv01')
        self.assertEqual(self.login().status_code, 200)
        self.put_licence(user='gv02')  # tep bi doi sang tai khoan khac
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)

    def test_clock_rollback_blocks_everything(self):
        self.put_licence()
        self.assertEqual(self.login().status_code, 200)
        local = lic.LocalState(self.state, machine=MACHINE)
        local.save({'last_seen': time.time() + 30 * DAY})
        self.assertEqual(self.get('/api/dashboard-info').status_code, 401)
        self.assertEqual(self.get('/api/auth/status').get_json()['licence']['state'], lic.CLOCK_ROLLBACK)


if __name__ == '__main__':
    unittest.main()
