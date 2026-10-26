"""Kiểm tra thư mục phát hành trước khi gửi cho đồng nghiệp: đủ file cần có, không lọt mã nguồn / khoá / dữ liệu.

    python check_release.py <thư mục phát hành>

Thoát 0 nếu đạt, 1 nếu có lỗi. Không chứng minh được "an toàn tuyệt đối", chỉ chặn những sơ suất dễ mắc nhất.
"""
import os
import sys

REQUIRED = [
    'ic3_collect_points.exe',
    'TaoDeThi.exe',
    'LICENSE.txt',
    'HUONG_DAN.txt',
    os.path.join('ui', 'index.html'),
    os.path.join('scripts', 'ThuDiem_Flash.ps1'),
    os.path.join('src', 'config', 'pubkey.txt'),
]
FORBIDDEN_EXT = {'.py', '.pyc', '.pyi', '.map', '.db', '.sqlite', '.key', '.pem', '.env', '.lic', '.ts', '.tsx', '.sol'}
FORBIDDEN_NAMES = {'signing.key', 'account.lic', '.env', 'state.json', 'captaikhoan.exe', 'captaikhoan.py'}
FORBIDDEN_DIRS = {'.git', 'secrets', 'capphat', 'node_modules', '__pycache__', 'tests', '.agent', '.claude'}
TEXT_EXT = {'.js', '.css', '.html', '.json', '.txt', '.bat', '.ps1', '.md'}
SECRET_MARKERS = ('BEGIN PRIVATE KEY', 'BEGIN RSA PRIVATE KEY', 'BEGIN OPENSSH PRIVATE KEY', 'sourceMappingURL=')


def check(root):
    problems = []
    if not os.path.isdir(root):
        return ['không có thư mục %s' % root]
    for rel in REQUIRED:
        if not os.path.exists(os.path.join(root, rel)):
            problems.append('thiếu: %s' % rel)
    count = 0
    for folder, dirs, files in os.walk(root):
        for d in list(dirs):
            if d.lower() in FORBIDDEN_DIRS:
                problems.append('thư mục không được có: %s' % os.path.relpath(os.path.join(folder, d), root))
        for name in files:
            count += 1
            path = os.path.join(folder, name)
            rel = os.path.relpath(path, root)
            ext = os.path.splitext(name)[1].lower()
            if name.lower() in FORBIDDEN_NAMES or ext in FORBIDDEN_EXT:
                # Nuitka có thể kèm vài file .py của thư viện bên thứ ba trong gói; chỉ chấp nhận ngoài thư mục src/
                problems.append('file không được có: %s' % rel)
                continue
            if ext in TEXT_EXT and os.path.getsize(path) < 8 * 1024 * 1024:
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        text = f.read()
                except OSError:
                    continue
                for marker in SECRET_MARKERS:
                    if marker in text:
                        problems.append('chứa "%s": %s' % (marker, rel))
    if count == 0:
        problems.append('thư mục trống')
    return problems


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    problems = check(argv[1])
    if problems:
        print('[!] KHÔNG ĐẠT (%d vấn đề):' % len(problems))
        for p in problems[:60]:
            print('    - ' + p)
        return 1
    print('[+] Kiểm tra bản phát hành: đạt.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
