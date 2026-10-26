import os
import sys
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker, declarative_base

# Đảm bảo mã hóa UTF-8 cho console output trên Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

DATABASE_URL = os.getenv('DATABASE_URL')

# Kiểm tra xem có thể nạp pyodbc hay không. Nếu không, chuyển sang SQLite
use_sqlite = False
try:
    import pyodbc
except ImportError:
    use_sqlite = True

if use_sqlite or not DATABASE_URL:
    # Trên macOS hoặc khi thiếu pyodbc, tự động chuyển sang dùng SQLite cục bộ
    # Dùng đường dẫn tuyệt đối để tránh lỗi khi chạy từ các CWD khác nhau (ví dụ: chạy từ thư mục root của dự án)
    from src.utils.paths import data_dir
    db_path = os.path.join(data_dir(), "ic3manager.db")
    db_url = f"sqlite:///{db_path}"
    if not DATABASE_URL:
        print(f"[*] Sử dụng SQLite cục bộ tại {db_path} (mặc định).")
    else:
        print(f"[*] Fallback: Sử dụng SQLite cục bộ tại {db_path} do thiếu thư viện kết nối SQL Server (pyodbc).")
else:
    # Hàm chuyển đổi chuỗi kết nối (hỗ trợ cả dạng URL và dạng ODBC thô)
    def get_sqlalchemy_url(conn_str):
        if conn_str.strip().startswith("DRIVER="):
            return f"mssql+pyodbc:///?odbc_connect={urllib.parse.quote_plus(conn_str)}"
        return conn_str
    db_url = get_sqlalchemy_url(DATABASE_URL)

# Khởi tạo engine phù hợp với từng hệ CSDL
if db_url.startswith("sqlite:"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )
else:
    # Khởi tạo engine với pool_pre_ping để tự động khôi phục kết nối bị ngắt cho SQL Server
    engine = create_engine(
        db_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

db_session = scoped_session(
    sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
)

Base = declarative_base()
Base.query = db_session.query_property()

