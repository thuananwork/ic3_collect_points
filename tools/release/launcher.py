"""Chương trình khởi động: file ic3_collect_points.exe nằm ngoài cùng, mọi thứ còn lại nằm trong thư mục he_thong.

Nó chỉ làm một việc: mở he_thong\app\ic3_collect_points_core.exe với thư mục gốc là he_thong (để account.lic, Data, scripts,
ui nằm gọn trong he_thong). Cửa sổ đen của chương trình chính hiện ra như bình thường.
"""
import os
import subprocess
import sys

CORE = os.path.join('he_thong', 'app', 'ic3_collect_points_core.exe')


def _candidates():
    seen = []
    try:
        seen.append(os.path.dirname(os.path.abspath(sys.argv[0])))
    except Exception:
        pass
    try:
        seen.append(__compiled__.containing_dir)  # noqa: F821  (Nuitka cung cấp khi đã biên dịch)
    except Exception:
        pass
    seen.append(os.path.dirname(os.path.abspath(sys.executable)))
    seen.append(os.getcwd())
    return seen


def find_base():
    for base in _candidates():
        if os.path.isfile(os.path.join(base, CORE)):
            return base
    return None


def error(text):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, text, 'ic3_collect_points', 0x10)
    except Exception:
        print(text)


def main():
    base = find_base()
    if base is None:
        error('Không tìm thấy thư mục "he_thong" cạnh ic3_collect_points.exe.\n'
              'Hãy giải nén đầy đủ file .zip rồi mở lại, đừng tách riêng file exe ra chỗ khác.')
        return 1
    root = os.path.join(base, 'he_thong')
    env = dict(os.environ, IC3_APP_ROOT=root)
    core = os.path.join(base, CORE)
    flags = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)
    try:
        subprocess.Popen([core], cwd=root, env=env, creationflags=flags)
    except OSError as exc:
        error('Không mở được chương trình chính:\n%s' % exc)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
