import os
import sys
from dotenv import load_dotenv

# Đảm bảo mã hóa UTF-8 cho console output trên Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Nạp các biến môi trường từ file .env
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def check_dependencies():
    missing = []
    try:
        import sqlalchemy
    except ImportError:
        missing.append("sqlalchemy")
    
    use_sqlite = False
    try:
        import pyodbc
    except ImportError:
        use_sqlite = True
        
    if not DATABASE_URL:
        use_sqlite = True
        
    if missing:
        print("[-] Thiếu các thư viện Python để kết nối.")
        print(f"[*] Vui lòng chạy lệnh sau để cài đặt: pip install {' '.join(missing)}")
        sys.exit(1)

def run_setup():
    use_sqlite = False
    try:
        import pyodbc
    except ImportError:
        use_sqlite = True
        
    if not DATABASE_URL:
        use_sqlite = True

    from sqlalchemy import create_engine, text
    db_name = "IC3ManagerMultiTenant"

    if use_sqlite:
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(backend_dir, "ic3manager.db")
        target_url = f"sqlite:///{db_path}"
        print(f"[*] Đang khởi tạo CSDL SQLite cục bộ tại {db_path}...")
    else:
        check_dependencies()
        import urllib.parse
        
        def get_sqlalchemy_url(conn_str):
            if conn_str.strip().startswith("DRIVER="):
                return f"mssql+pyodbc:///?odbc_connect={urllib.parse.quote_plus(conn_str)}"
            return conn_str

        master_conn_str = DATABASE_URL
        if db_name in DATABASE_URL:
            master_conn_str = DATABASE_URL.replace(db_name, "master")
        elif "database=IC3ManagerMultiTenant" in DATABASE_URL:
            master_conn_str = DATABASE_URL.replace("database=IC3ManagerMultiTenant", "database=master")
        elif "DATABASE=IC3ManagerMultiTenant" in DATABASE_URL:
            master_conn_str = DATABASE_URL.replace("DATABASE=IC3ManagerMultiTenant", "DATABASE=master")
            
        master_url = get_sqlalchemy_url(master_conn_str)
            
        try:
            engine_master = create_engine(master_url, connect_args={'timeout': 5})
            with engine_master.connect() as conn:
                conn.execution_options(isolation_level="AUTOCOMMIT")
                result = conn.execute(text(f"SELECT database_id FROM sys.databases WHERE name = '{db_name}'"))
                db_exists = result.fetchone()
                
                if not db_exists:
                    print(f"[*] Đang tạo database '{db_name}' trên SQL Server...")
                    conn.execute(text(f"CREATE DATABASE {db_name}"))
                    print(f"[+] Tạo database '{db_name}' thành công!")
                else:
                    print(f"[+] Database '{db_name}' đã tồn tại.")
        except Exception as e:
            print(f"[-] Không thể kết nối tới SQL Server để khởi tạo Database: {e}")
            print("[*] Vui lòng kiểm tra lại dịch vụ SQL Server và chuỗi kết nối DATABASE_URL.")
            sys.exit(1)
            
        target_conn_str = DATABASE_URL
        if "master" in DATABASE_URL.lower():
            target_conn_str = DATABASE_URL.replace("master", db_name).replace("MASTER", db_name)
        elif "database=master" in DATABASE_URL.lower():
            target_conn_str = DATABASE_URL.replace("database=master", f"database={db_name}")
        elif "DATABASE=master" in DATABASE_URL.lower():
            target_conn_str = DATABASE_URL.replace("DATABASE=master", f"DATABASE={db_name}")
            
        target_url = get_sqlalchemy_url(target_conn_str)
        print(f"[*] Đang thiết lập cấu trúc bảng trong CSDL '{db_name}'...")

    try:
        if use_sqlite:
            engine_db = create_engine(target_url, connect_args={"check_same_thread": False})
        else:
            engine_db = create_engine(target_url)
            
        with engine_db.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            
            from src.models.models_db import Base
            Base.metadata.create_all(bind=engine_db)
            print("[+] Khởi tạo cấu trúc bảng thành công!")

            # Tạo tài khoản giáo viên mặc định nếu chưa có
            teacher_exists = conn.execute(text("SELECT 1 FROM users WHERE user_id = 1")).fetchone()
            if not teacher_exists:
                conn.execute(text("""
                    INSERT INTO users (email, username, full_name, role, is_approved)
                    VALUES ('teacher@ic3.local', 'teacher', 'Giáo viên', 'teacher', 1)
                """))
                print("[+] Đã tạo tài khoản giáo viên mặc định thành công!")

        print("[+] Thiết lập cơ sở dữ liệu hoàn tất thành công!")
        
    except Exception as e:
        print(f"[-] Lỗi trong quá trình thiết lập CSDL: {e}")
        sys.exit(1)

if __name__ == '__main__':
    run_setup()
