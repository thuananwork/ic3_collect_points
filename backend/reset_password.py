"""Đặt lại hoặc xoá mật khẩu local của một tài khoản.

Cách dùng (chạy trong thư mục backend, dùng đúng môi trường ảo của dự án):
    python reset_password.py <username|email>            # nhập mật khẩu mới (không hiển thị)
    python reset_password.py <username|email> --clear    # xoá mật khẩu local (tài khoản Google)
"""
import getpass
import sys

from dotenv import load_dotenv

load_dotenv()

from werkzeug.security import generate_password_hash

from src.config.database import db_session
from src.models.models_db import UserDB

MIN_LEN = 8


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    clear = "--clear" in sys.argv[1:]
    if len(args) != 1:
        sys.exit(__doc__)

    key = args[0]
    user = db_session.query(UserDB).filter((UserDB.username == key) | (UserDB.email == key)).first()
    if not user:
        sys.exit(f"Không tìm thấy tài khoản: {key}")

    if clear:
        user.password_hash = None
        db_session.commit()
        print(f"Đã xoá mật khẩu local của '{key}'. Tài khoản chỉ còn đăng nhập được bằng Google.")
        return

    pw = getpass.getpass("Mật khẩu mới: ")
    if len(pw) < MIN_LEN:
        sys.exit(f"Mật khẩu phải có ít nhất {MIN_LEN} ký tự.")
    if pw != getpass.getpass("Nhập lại mật khẩu: "):
        sys.exit("Hai lần nhập không khớp.")

    user.password_hash = generate_password_hash(pw)
    db_session.commit()
    print(f"Đã đổi mật khẩu của '{key}'.")


if __name__ == "__main__":
    main()
