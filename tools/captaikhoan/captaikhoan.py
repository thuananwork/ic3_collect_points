"""CapTaiKhoan: công cụ của TÁC GIẢ để cấp file account.lic cho đồng nghiệp (không gửi công cụ này cho ai).

  CapTaiKhoan.py keygen                tạo cặp khoá ký (chạy MỘT lần, cất kỹ secrets/signing.key)
  CapTaiKhoan.py issue                 cấp account.lic mới (hỏi từng thông tin)
  CapTaiKhoan.py show FILE.lic         xem nội dung một file account.lic (không hiện mật khẩu)

Khoá riêng secrets/signing.key mất là không cấp được nữa; lộ là ai cũng tự cấp được. Sao lưu ở nơi an toàn.
"""
import argparse
import datetime
import getpass
import json
import os
import re
import secrets
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.abspath(os.path.join(_HERE, '..', '..', 'backend'))
if os.path.isdir(_BACKEND):
    sys.path.insert(0, _BACKEND)

from src.utils import licence as lic  # noqa: E402


def author_dir():
    """Thư mục chứa secrets/ và CapPhat/: gốc repo khi chạy từ mã nguồn, thư mục chứa .exe khi đã biên dịch."""
    override = os.environ.get('IC3_AUTHOR_DIR')
    if override:
        return override
    if '__compiled__' in globals() or getattr(sys, 'frozen', False):
        return os.path.dirname(os.path.abspath(sys.argv[0]))
    return os.path.abspath(os.path.join(_HERE, '..', '..'))


def key_path():
    return os.path.join(author_dir(), 'secrets', 'signing.key')


def add_months(day, months):
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    last = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return datetime.date(year, month, min(day.day, last))


def cmd_keygen(_args):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    path = key_path()
    if os.path.exists(path):
        print('[!] Đã có khoá ký: %s\n    Không ghi đè để khỏi mất khả năng cấp lại cho người đang dùng.' % path)
        return 1
    key = Ed25519PrivateKey.generate()
    private = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='ascii') as f:
        f.write(lic.b64e(private))
    pub_text = lic.b64e(public)
    with open(os.path.join(os.path.dirname(path), 'pubkey.txt'), 'w', encoding='ascii') as f:
        f.write(pub_text)
    config = os.path.join(_BACKEND, 'src', 'config')
    if os.path.isdir(config):
        with open(os.path.join(config, 'pubkey.txt'), 'w', encoding='ascii') as f:
            f.write(pub_text)
        print('[+] Đã ghi khoá công khai vào backend\\src\\config\\pubkey.txt (commit file này, nó KHÔNG phải bí mật).')
    print('[+] Đã tạo khoá ký: %s' % path)
    print('    GIỮ BÍ MẬT file này, sao lưu ra nơi an toàn, KHÔNG đưa cho ai và KHÔNG commit.')
    return 0


def _load_private():
    try:
        with open(key_path(), 'r', encoding='ascii') as f:
            return lic.b64d(f.read().strip())
    except OSError:
        print('[!] Chưa có khoá ký (%s). Chạy "CapTaiKhoan keygen" trước.' % key_path())
        return None


def _slug(text):
    return re.sub(r'[^a-z0-9_.-]+', '', text.lower().replace(' ', '')) or 'user'


def _ask(prompt, default=None, secret=False):
    shown = '%s%s: ' % (prompt, ' [%s]' % default if default else '')
    value = getpass.getpass(shown) if secret else input(shown)
    value = value.strip()
    return value or default


def cmd_issue(args):
    private = _load_private()
    if private is None:
        return 1
    holder = args.holder or _ask('Tên đồng nghiệp (để ghi nhớ)')
    if not holder:
        print('[!] Cần nhập tên.')
        return 1
    user = args.user or _ask('Tên đăng nhập', _slug(holder))
    password = args.password
    generated = False
    if not password:
        password = _ask('Mật khẩu (Enter để tự sinh)', None, secret=True)
    if not password:
        password = secrets.token_urlsafe(9)
        generated = True
    if len(password) < 8:
        print('[!] Mật khẩu cần ít nhất 8 ký tự.')
        return 1
    machines = list(args.machines or [])
    if not machines:
        print('Nhập mã máy (đồng nghiệp lấy ở màn hình đăng nhập), mỗi dòng một mã, tối đa %d. Dòng trống để kết thúc.' % lic.MAX_MACHINES)
        while len(machines) < lic.MAX_MACHINES:
            m = input('  Mã máy %d: ' % (len(machines) + 1)).strip()
            if not m:
                break
            machines.append(m)
    cleaned = []
    for m in machines:
        norm = lic.normalize_machine_code(m)
        if len(norm) != 20:
            print('[!] Mã máy "%s" không đúng dạng (cần 20 ký tự chữ/số, vd A1B2-C3D4-E5F6-0718-293A).' % m)
            return 1
        cleaned.append('-'.join(norm[i:i + 4] for i in range(0, 20, 4)))
    cleaned = list(dict.fromkeys(cleaned))
    if not 1 <= len(cleaned) <= lic.MAX_MACHINES:
        print('[!] Cần từ 1 đến %d mã máy khác nhau.' % lic.MAX_MACHINES)
        return 1
    months = args.months
    if months is None:
        months = int(_ask('Số tháng hiệu lực', '4'))
    today = datetime.date.today()
    expires = add_months(today, months)
    payload = {
        'v': 1, 'product': lic.PRODUCT, 'holder': holder, 'user': user,
        'pw': lic.hash_password(password),
        'issued': today.isoformat(), 'expires': expires.isoformat(), 'machines': cleaned,
    }
    out_dir = args.out or os.path.join(author_dir(), 'CapPhat', _slug(holder) + '_' + today.strftime('%Y%m%d'))
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'account.lic')
    with open(out, 'wb') as f:
        f.write(lic.sign_licence(payload, private))
    print('\n[+] Đã cấp: %s' % out)
    print('    Người dùng : %s (%s)' % (holder, user))
    print('    Hết hạn    : %s (%d tháng)' % (expires.isoformat(), months))
    print('    Số máy     : %d' % len(cleaned))
    if generated:
        print('    Mật khẩu   : %s   <- chỉ hiện một lần, gửi riêng (không gửi chung với file)' % password)
    print('Gửi file account.lic cho đồng nghiệp; đồng nghiệp đặt vào thư mục phần mềm hoặc chọn file ở màn hình đăng nhập.')
    return 0


def cmd_show(args):
    pub = lic.read_pubkey()
    with open(args.file, 'rb') as f:
        raw = f.read()
    state, payload = lic.parse_licence(raw, pub)
    if payload is None:
        print('Không đọc được: %s - %s' % (state, lic.MESSAGES.get(state, '')))
        return 1
    print(json.dumps({k: v for k, v in payload.items() if k != 'pw'}, ensure_ascii=False, indent=2))
    print('Còn %d ngày.' % lic.days_left(payload))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='Cấp account.lic (công cụ của tác giả)')
    sub = ap.add_subparsers(dest='cmd')
    sub.add_parser('keygen')
    p = sub.add_parser('issue')
    p.add_argument('--holder')
    p.add_argument('--user')
    p.add_argument('--password')
    p.add_argument('--machines', nargs='+')
    p.add_argument('--months', type=int)
    p.add_argument('--out')
    s = sub.add_parser('show')
    s.add_argument('file')
    args = ap.parse_args(argv)
    if args.cmd is None:
        print(__doc__)
        choice = input('Chọn: 1 = tạo khoá (lần đầu), 2 = cấp account.lic mới, 3 = xem một file: ').strip()
        if choice == '1':
            return cmd_keygen(args)
        if choice == '2':
            args = ap.parse_args(['issue'])
            return cmd_issue(args)
        if choice == '3':
            return cmd_show(ap.parse_args(['show', input('Đường dẫn file .lic: ').strip().strip('"')]))
        return 0
    try:
        return {'keygen': cmd_keygen, 'issue': cmd_issue, 'show': cmd_show}[args.cmd](args)
    except (EOFError, KeyboardInterrupt):
        print('\nĐã huỷ.')
        return 1


if __name__ == '__main__':
    code = main()
    if sys.stdin and sys.stdin.isatty() and len(sys.argv) == 1:
        input('\nBấm Enter để đóng...')
    sys.exit(code)
