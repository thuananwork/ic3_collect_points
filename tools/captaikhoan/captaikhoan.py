"""CapTaiKhoan: công cụ của TÁC GIẢ để cấp file account.lic cho đồng nghiệp (không gửi công cụ này cho ai).

  CapTaiKhoan.py keygen                tạo cặp khoá ký (chạy MỘT lần, cất kỹ secrets/signing.key)
  CapTaiKhoan.py issue                 cấp account.lic mới (hỏi từng thông tin)
  CapTaiKhoan.py edit FILE.lic         sửa tài khoản đã cấp (thêm/bớt máy, gia hạn) mà KHÔNG cần mật khẩu
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
    limit = args.max_machines
    if limit is None:
        limit = lic.DEFAULT_MACHINES if not sys.stdin.isatty() else int(_ask('Số máy tối đa của tài khoản này', str(lic.DEFAULT_MACHINES)))
    if not 1 <= limit <= lic.MAX_MACHINES:
        print('[!] Số máy tối đa phải từ 1 đến %d.' % lic.MAX_MACHINES)
        return 1
    machines = list(args.machines or [])
    if not machines:
        print('Nhập mã máy (đồng nghiệp lấy ở màn hình đăng nhập), mỗi dòng một mã, tối đa %d. Dòng trống để kết thúc.' % limit)
        while len(machines) < limit:
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
    if not 1 <= len(cleaned) <= limit:
        print('[!] Cần từ 1 đến %d mã máy khác nhau (đang có %d).' % (limit, len(cleaned)))
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


def _clean_codes(codes):
    out = []
    for m in codes:
        norm = lic.normalize_machine_code(m)
        if len(norm) != 20:
            return None, m
        out.append('-'.join(norm[i:i + 4] for i in range(0, 20, 4)))
    return out, None


def cmd_edit(args):
    """Sửa tài khoản đã cấp: giữ nguyên tên đăng nhập và mật khẩu (băm), đổi danh sách máy / hạn rồi ký lại."""
    private = _load_private()
    if private is None:
        return 1
    with open(args.file, 'rb') as f:
        raw = f.read()
    state, payload = lic.parse_licence(raw, lic.read_pubkey())
    if payload is None:
        print('[!] Không đọc được file (%s). Phải là file do chính khoá của bạn cấp.' % state)
        return 1
    machines = list(payload['machines'])
    if args.add or args.remove or args.months is None:
        # Chế độ hỏi tay khi không truyền tham số nào
        if not (args.add or args.remove or args.months is not None or args.max_machines is not None):
            print('Tài khoản %s (%s), %d máy: %s' % (payload['holder'], payload['user'], len(machines), ', '.join(machines)))
            add = input('Mã máy cần THÊM (cách nhau bằng dấu cách, Enter để bỏ qua): ').split()
            rem = input('Mã máy cần BỎ (Enter để bỏ qua): ').split()
            mo = input('Gia hạn thêm bao nhiêu tháng (Enter để không đổi): ').strip()
            args.add, args.remove = add, rem
            args.months = int(mo) if mo else None
    add, bad = _clean_codes(args.add)
    rem, bad2 = _clean_codes(args.remove)
    if add is None or rem is None:
        print('[!] Mã máy "%s" không đúng dạng (cần 20 ký tự chữ/số).' % (bad or bad2))
        return 1
    machines = [m for m in machines if lic.normalize_machine_code(m) not in {lic.normalize_machine_code(r) for r in rem}]
    for m in add:
        if m not in machines:
            machines.append(m)
    limit = args.max_machines if args.max_machines is not None else max(lic.DEFAULT_MACHINES, len(machines))
    if not 1 <= limit <= lic.MAX_MACHINES:
        print('[!] Số máy tối đa phải từ 1 đến %d.' % lic.MAX_MACHINES)
        return 1
    if not 1 <= len(machines) <= limit:
        print('[!] Sau khi sửa còn %d máy, cần từ 1 đến %d. Dùng --max-machines để nâng giới hạn.' % (len(machines), limit))
        return 1
    today = datetime.date.today()
    expires = datetime.date.fromisoformat(payload['expires'])
    if args.months is not None:
        expires = max(expires, add_months(today, args.months)) if args.months > 0 else expires
    new_payload = dict(payload, machines=machines, expires=expires.isoformat(), issued=today.isoformat())
    out_dir = args.out or os.path.join(author_dir(), 'CapPhat', _slug(payload.get('holder', 'user')) + '_' + today.strftime('%Y%m%d') + '_sua')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'account.lic')
    with open(out, 'wb') as f:
        f.write(lic.sign_licence(new_payload, private))
    print('[+] Đã ký lại: %s' % out)
    print('    Người dùng : %s (%s), mật khẩu giữ nguyên' % (payload.get('holder', ''), payload['user']))
    print('    Số máy     : %d (tối đa %d)' % (len(machines), limit))
    print('    Hết hạn    : %s' % expires.isoformat())
    print('Gửi file mới thay cho file cũ; file cũ vẫn dùng được đến hết hạn của nó.')
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
    p.add_argument('--max-machines', type=int, dest='max_machines')
    p.add_argument('--out')
    e = sub.add_parser('edit')
    e.add_argument('file')
    e.add_argument('--add', nargs='+', default=[], help='mã máy cần thêm')
    e.add_argument('--remove', nargs='+', default=[], help='mã máy cần bỏ')
    e.add_argument('--months', type=int, help='gia hạn: hết hạn = hôm nay + số tháng (hoặc ngày hết hạn cũ nếu còn xa hơn)')
    e.add_argument('--max-machines', type=int, dest='max_machines', help='số máy tối đa (mặc định giữ số hiện có, ít nhất 4)')
    e.add_argument('--out')
    s = sub.add_parser('show')
    s.add_argument('file')
    args = ap.parse_args(argv)
    if args.cmd is None:
        print(__doc__)
        choice = input('Chọn: 1 = tạo khoá (lần đầu), 2 = cấp account.lic mới, 3 = xem một file, 4 = sửa tài khoản đã cấp: ').strip()
        if choice == '4':
            return cmd_edit(ap.parse_args(['edit', input('Đường dẫn file account.lic cũ: ').strip().strip('"')]))
        if choice == '1':
            return cmd_keygen(args)
        if choice == '2':
            args = ap.parse_args(['issue'])
            return cmd_issue(args)
        if choice == '3':
            return cmd_show(ap.parse_args(['show', input('Đường dẫn file .lic: ').strip().strip('"')]))
        return 0
    try:
        return {'keygen': cmd_keygen, 'issue': cmd_issue, 'edit': cmd_edit, 'show': cmd_show}[args.cmd](args)
    except (EOFError, KeyboardInterrupt):
        print('\nĐã huỷ.')
        return 1


if __name__ == '__main__':
    code = main()
    if sys.stdin and sys.stdin.isatty() and len(sys.argv) == 1:
        input('\nBấm Enter để đóng...')
    sys.exit(code)
