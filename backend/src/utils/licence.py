"""Giấy phép tài khoản `account.lic` cho ic3_collect_points (chạy offline).

Tác giả cấp `account.lic` bằng CapTaiKhoan: một tệp JSON gồm `payload` (base64) và chữ ký Ed25519 của tác giả.
Phần mềm chỉ giữ KHOÁ CÔNG KHAI, nên không ai sửa được hạn dùng, tên đăng nhập hay danh sách máy mà không bị lộ.

payload (JSON) có các trường:
  v          phiên bản định dạng (1)
  product    "ic3_collect_points"
  holder     tên người được cấp (hiển thị)
  user       tên đăng nhập
  pw         băm mật khẩu scrypt: {algo, n, r, p, salt, hash}  (không lưu mật khẩu)
  issued     ngày cấp  YYYY-MM-DD
  expires    ngày hết hạn YYYY-MM-DD (hết ngày đó thì hết hạn)
  machines   danh sách mã máy được dùng (mặc định 4, tác giả chỉnh tuỳ tài khoản, trần cứng 20)

Giới hạn thật thà: offline thì không thu hồi tức thì được; hạn dùng ngắn (4 tháng) là cách thu hồi.
Đồng hồ máy bị chỉnh lùi sẽ bị phát hiện qua `state.json` nhưng xoá file đó thì qua mặt được.
"""
import base64
import datetime
import hashlib
import hmac
import json
import os
import secrets
import sys
import time

PRODUCT = 'ic3_collect_points'
DEFAULT_MACHINES = 4     # mặc định khi cấp; CapTaiKhoan cho đổi từng tài khoản
MAX_MACHINES = 20        # trần cứng phía phần mềm (chữ ký vẫn là của tác giả)
MAX_FAILS = 5
LOCK_BASE_SECONDS = 60
LOCK_MAX_SECONDS = 15 * 60
CLOCK_SLACK_SECONDS = 24 * 3600
SCRYPT_PARAMS = {'n': 2 ** 14, 'r': 8, 'p': 1}
_SCRYPT_MAXMEM = 128 * 1024 * 1024

HERE = os.path.dirname(os.path.abspath(__file__))
PUBKEY_FILE = os.path.abspath(os.path.join(HERE, '..', 'config', 'pubkey.txt'))

OK = 'ok'
MISSING = 'missing'
INVALID = 'invalid'
EXPIRED = 'expired'
WRONG_MACHINE = 'wrong_machine'
NO_PUBKEY = 'no_pubkey'
CLOCK_ROLLBACK = 'clock_rollback'

MESSAGES = {
    OK: 'Giấy phép hợp lệ.',
    MISSING: 'Chưa có file account.lic. Gửi mã máy cho tác giả để được cấp.',
    INVALID: 'File account.lic không hợp lệ hoặc đã bị sửa.',
    EXPIRED: 'Tài khoản đã hết hạn. Liên hệ tác giả để được cấp file account.lic mới.',
    WRONG_MACHINE: 'account.lic này không được cấp cho máy này. Gửi mã máy cho tác giả.',
    NO_PUBKEY: 'Bản phần mềm này chưa có khoá xác thực của tác giả.',
    CLOCK_ROLLBACK: 'Đồng hồ máy bị chỉnh lùi. Hãy đặt lại đúng ngày giờ rồi mở lại.',
}


# ---------------------------------------------------------------- mã hoá cơ bản
def b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def b64d(text):
    text = str(text)
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, maxmem=_SCRYPT_MAXMEM, dklen=32, **SCRYPT_PARAMS)
    return {'algo': 'scrypt', **SCRYPT_PARAMS, 'salt': b64e(salt), 'hash': b64e(digest)}


def verify_password(password, rec):
    try:
        if rec.get('algo') != 'scrypt':
            return False
        digest = hashlib.scrypt(password.encode('utf-8'), salt=b64d(rec['salt']), n=int(rec['n']), r=int(rec['r']),
                                p=int(rec['p']), maxmem=_SCRYPT_MAXMEM, dklen=32)
        return hmac.compare_digest(digest, b64d(rec['hash']))
    except Exception:
        return False


# ---------------------------------------------------------------- mã máy
def _raw_machine_guid():
    if sys.platform == 'win32':
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography',
                                0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
                return str(winreg.QueryValueEx(k, 'MachineGuid')[0])
        except OSError:
            pass
    for path in ('/etc/machine-id', '/var/lib/dbus/machine-id'):
        try:
            with open(path, 'r', encoding='ascii') as f:
                return f.read().strip()
        except OSError:
            continue
    import uuid
    return str(uuid.getnode())


def machine_code(raw=None):
    """Mã máy dạng XXXX-XXXX-XXXX-XXXX-XXXX (băm từ MachineGuid của Windows, không lộ GUID gốc)."""
    raw = raw if raw is not None else _raw_machine_guid()
    h = hashlib.sha256(('ic3cp|' + raw).encode('utf-8')).hexdigest().upper()[:20]
    return '-'.join(h[i:i + 4] for i in range(0, 20, 4))


def normalize_machine_code(code):
    return ''.join(ch for ch in str(code).upper() if ch.isalnum())


# ---------------------------------------------------------------- ký / kiểm tra giấy phép
def _load_public_key(pubkey):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    return Ed25519PublicKey.from_public_bytes(pubkey)


def read_pubkey():
    try:
        with open(PUBKEY_FILE, 'r', encoding='ascii') as f:
            raw = b64d(f.read().strip())
        return raw if len(raw) == 32 else None
    except (OSError, ValueError):
        return None


def sign_licence(payload, private_key_bytes):
    """Dùng ở phía tác giả (CapTaiKhoan). Trả về nội dung tệp account.lic (bytes)."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    body = b64e(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8'))
    sig = Ed25519PrivateKey.from_private_bytes(private_key_bytes).sign(body.encode('ascii'))
    return json.dumps({'payload': body, 'sig': b64e(sig)}, indent=0).encode('utf-8')


def parse_licence(raw, pubkey):
    """Kiểm chữ ký và định dạng. Trả về (trạng thái, payload hoặc None)."""
    if pubkey is None:
        return NO_PUBKEY, None
    try:
        doc = json.loads(raw.decode('utf-8'))
        body = doc['payload']
        _load_public_key(pubkey).verify(b64d(doc['sig']), body.encode('ascii'))
        payload = json.loads(b64d(body).decode('utf-8'))
    except Exception:
        return INVALID, None
    try:
        if payload.get('v') != 1 or payload.get('product') != PRODUCT:
            return INVALID, None
        machines = payload['machines']
        if not isinstance(machines, list) or not 1 <= len(machines) <= MAX_MACHINES:
            return INVALID, None
        if not isinstance(payload['user'], str) or not payload['user']:
            return INVALID, None
        datetime.date.fromisoformat(payload['expires'])
        datetime.date.fromisoformat(payload['issued'])
        if payload['pw'].get('algo') != 'scrypt':
            return INVALID, None
    except Exception:
        return INVALID, None
    return OK, payload


def check_licence(raw, pubkey, this_machine, now=None):
    """Trả về (trạng thái, payload). `now` là epoch giây."""
    state, payload = parse_licence(raw, pubkey)
    if state != OK:
        return state, None
    mine = normalize_machine_code(this_machine)
    if mine not in {normalize_machine_code(m) for m in payload['machines']}:
        return WRONG_MACHINE, payload
    now = time.time() if now is None else now
    expires = datetime.date.fromisoformat(payload['expires'])
    end_of_day = datetime.datetime.combine(expires, datetime.time(23, 59, 59)).timestamp()
    if now > end_of_day:
        return EXPIRED, payload
    return OK, payload


def days_left(payload, now=None):
    now = time.time() if now is None else now
    today = datetime.date.fromtimestamp(now)
    return (datetime.date.fromisoformat(payload['expires']) - today).days


# ---------------------------------------------------------------- trạng thái cục bộ (khoá khi sai, chống chỉnh lùi giờ)
def state_dir():
    override = os.environ.get('IC3_STATE_DIR')
    if override:
        return override
    base = os.environ.get('LOCALAPPDATA') or os.path.join(os.path.expanduser('~'), '.local', 'share')
    return os.path.join(base, PRODUCT)


class LocalState:
    """state.json có HMAC theo mã máy: sửa tay thì bị bỏ qua (coi như trống)."""

    def __init__(self, directory=None, machine=None):
        self.path = os.path.join(directory or state_dir(), 'state.json')
        self._key = hashlib.sha256(('state|' + (machine or machine_code())).encode('utf-8')).digest()

    def _mac(self, body):
        return hmac.new(self._key, body.encode('utf-8'), hashlib.sha256).hexdigest()

    def load(self):
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                doc = json.load(f)
            body = json.dumps(doc['data'], sort_keys=True, separators=(',', ':'))
            if hmac.compare_digest(self._mac(body), doc['mac']):
                return dict(doc['data'])
        except Exception:
            pass
        return {}

    def save(self, data):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        body = json.dumps(data, sort_keys=True, separators=(',', ':'))
        tmp = self.path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump({'data': data, 'mac': self._mac(body)}, f)
        os.replace(tmp, self.path)


def clock_rolled_back(state, now):
    last = float(state.get('last_seen', 0))
    return now + CLOCK_SLACK_SECONDS < last


def touch_clock(local, now):
    data = local.load()
    if now > float(data.get('last_seen', 0)):
        data['last_seen'] = now
        local.save(data)


def lock_remaining(state, now):
    return max(0, int(float(state.get('locked_until', 0)) - now))


def login(raw_licence, pubkey, this_machine, username, password, local, now=None):
    """Đăng nhập bằng tài khoản trong account.lic.

    Trả về (ok, mã, số giây phải chờ). mã: ok | locked | bad_credentials | <trạng thái giấy phép>.
    """
    now = time.time() if now is None else now
    data = local.load()
    if clock_rolled_back(data, now):
        return False, CLOCK_ROLLBACK, 0
    wait = lock_remaining(data, now)
    if wait:
        return False, 'locked', wait
    state, payload = check_licence(raw_licence, pubkey, this_machine, now)
    if state != OK:
        return False, state, 0
    # Luôn băm một lần dù sai tên, để thời gian trả lời không lộ tên đăng nhập có đúng hay không
    user_ok = hmac.compare_digest(str(username).encode('utf-8'), payload['user'].encode('utf-8'))
    pw_ok = verify_password(str(password), payload['pw'])
    if user_ok and pw_ok:
        data.pop('fails', None)
        data.pop('locked_until', None)
        data['last_seen'] = max(now, float(data.get('last_seen', 0)))
        local.save(data)
        return True, OK, 0
    fails = int(data.get('fails', 0)) + 1
    data['fails'] = fails
    if fails >= MAX_FAILS:
        rounds = fails - MAX_FAILS
        wait = min(LOCK_MAX_SECONDS, LOCK_BASE_SECONDS * (2 ** rounds))
        data['locked_until'] = now + wait
    local.save(data)
    return False, 'bad_credentials', int(data.get('locked_until', 0) - now) if fails >= MAX_FAILS else 0
