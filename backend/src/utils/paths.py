"""Đường dẫn dùng chung, chạy được cả từ mã nguồn lẫn khi đã biên dịch (Nuitka) thành .exe.

Chạy từ mã nguồn (python app.py):  mọi thứ nằm trong cây dự án như trước.
Đã biên dịch (thư mục phát hành):
  <APP_DIR>/ic3_collect_points.exe   chương trình
  <APP_DIR>/ui/                      giao diện web đã build (chỉ đọc)
  <APP_DIR>/scripts/                 ThuDiem_Flash.ps1 và các tệp phát cho máy học sinh
  <APP_DIR>/account.lic              giấy phép do tác giả cấp
  <APP_DIR>/Data/                    CSDL, danh sách học sinh, điểm (nếu thư mục không ghi được thì dùng %LOCALAPPDATA%)

Biến môi trường (dùng cho kiểm thử): IC3_APP_ROOT, IC3_DATA_DIR, IC3_COMPILED=1.
"""
import os
import sys

PRODUCT_DIRNAME = 'ic3_collect_points'

COMPILED = bool(os.environ.get('IC3_COMPILED')) or bool(getattr(sys, 'frozen', False)) or '__compiled__' in globals()

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
_REPO_DIR = os.path.dirname(_BACKEND_DIR)


def app_dir():
    """Thư mục chứa chương trình (đọc lại biến môi trường mỗi lần để kiểm thử đổi được)."""
    override = os.environ.get('IC3_APP_ROOT')
    if override:
        return os.path.abspath(override)
    if COMPILED:
        return os.path.dirname(os.path.abspath(sys.argv[0]))
    return _REPO_DIR


def _writable_dir(path):
    try:
        os.makedirs(path, exist_ok=True)
        probe = os.path.join(path, '.write_test')
        with open(probe, 'w') as f:
            f.write('ok')
        os.remove(probe)
        return True
    except OSError:
        return False


def data_dir():
    override = os.environ.get('IC3_DATA_DIR')
    if override:
        os.makedirs(override, exist_ok=True)
        return os.path.abspath(override)
    if not COMPILED:
        return _BACKEND_DIR  # giữ nguyên chỗ cũ: backend/ic3manager.db, backend/storage
    preferred = os.path.join(app_dir(), 'Data')
    if _writable_dir(preferred):
        return preferred
    fallback = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), PRODUCT_DIRNAME, 'Data')
    os.makedirs(fallback, exist_ok=True)
    return fallback


def ui_dir():
    return os.path.join(app_dir(), 'ui') if COMPILED else os.path.join(_REPO_DIR, 'frontend', 'dist')


def scripts_dir():
    return os.path.join(app_dir(), 'scripts') if COMPILED else os.path.join(_REPO_DIR, 'scripts')
