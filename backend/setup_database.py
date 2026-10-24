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
    
    # Kiểm tra xem có thể dùng SQLite làm phương án dự phòng
    use_sqlite = False
    try:
        import pyodbc
    except ImportError:
        use_sqlite = True
        
    if not DATABASE_URL:
        use_sqlite = True
        
    if not use_sqlite:
        pass
        
    if missing:
        print("[-] Thiếu các thư viện Python để kết nối.")
        print(f"[*] Vui lòng chạy lệnh sau để cài đặt: pip install {' '.join(missing)}")
        sys.exit(1)

def run_setup():
    # Kiểm tra xem có phải chạy SQLite (macOS hoặc thiếu pyodbc hoặc thiếu DATABASE_URL)
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
        
        # Hàm chuyển đổi chuỗi kết nối (hỗ trợ cả dạng URL và dạng ODBC thô)
        def get_sqlalchemy_url(conn_str):
            if conn_str.strip().startswith("DRIVER="):
                return f"mssql+pyodbc:///?odbc_connect={urllib.parse.quote_plus(conn_str)}"
            return conn_str

        # 1. Kết nối tạm vào CSDL master để tạo DB nếu chưa có trên SQL Server
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
                
                # Kiểm tra xem database đã tồn tại chưa
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
            
        # 2. Kết nối trực tiếp vào CSDL để tạo các bảng
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
        # Khởi tạo engine phù hợp với từng hệ CSDL
        if use_sqlite:
            engine_db = create_engine(target_url, connect_args={"check_same_thread": False})
        else:
            engine_db = create_engine(target_url)
            
        with engine_db.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            
            # Khởi tạo các bảng tự động qua SQLAlchemy nếu dùng SQLite
            statements = []
            if use_sqlite:
                from src.models.models_db import Base
                Base.metadata.create_all(bind=engine_db)
                print("[+] Khởi tạo cấu trúc bảng SQLite thành công!")
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN session_token VARCHAR(100) NULL;"))
                    print("[+] Đã thêm cột session_token vào bảng users (SQLite)")
                except Exception as e:
                    pass
            else:
                # Khởi tạo các bảng theo chuẩn tiếng Anh đa người dùng cho SQL Server
                statements = [
                # 1. Bảng users
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE users (
                        user_id INT IDENTITY(1,1) PRIMARY KEY,
                        email VARCHAR(100) UNIQUE NOT NULL,
                        google_id VARCHAR(100) NULL,
                        username VARCHAR(50) NULL,
                        password_hash VARCHAR(255) NULL,
                        full_name NVARCHAR(100) NOT NULL,
                        avatar_url NVARCHAR(255) NULL,
                        role VARCHAR(50) DEFAULT 'user',
                        is_approved BIT DEFAULT 0,
                        allow_training_ban BIT DEFAULT 1,
                        session_token VARCHAR(100) NULL,
                        created_at DATETIME DEFAULT GETDATE()
                    );
                    CREATE UNIQUE INDEX UQ_users_username ON users(username) WHERE username IS NOT NULL;
                    CREATE UNIQUE INDEX UQ_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
                END
                """,
                
                # 1b. Di cư thêm cột avatar_url nếu bảng users đã tồn tại nhưng chưa có cột này
                """
                IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'avatar_url')
                    BEGIN
                        ALTER TABLE users ADD avatar_url NVARCHAR(255) NULL;
                    END
                END
                """,
                
                # 1c. Di cư thêm cột session_token nếu bảng users đã tồn tại nhưng chưa có cột này
                """
                IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'session_token')
                    BEGIN
                        ALTER TABLE users ADD session_token VARCHAR(100) NULL;
                    END
                END
                """,
                
                # 2. Bảng permissions
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[permissions]') AND type in (N'U'))
                CREATE TABLE permissions (
                    permission_id VARCHAR(50) PRIMARY KEY,
                    description NVARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """,
                
                # 3. Bảng user_permissions
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_permissions]') AND type in (N'U'))
                CREATE TABLE user_permissions (
                    user_id INT CONSTRAINT FK_user_permissions_users FOREIGN KEY REFERENCES users(user_id) ON DELETE CASCADE,
                    permission_id VARCHAR(50) CONSTRAINT FK_user_permissions_permissions FOREIGN KEY REFERENCES permissions(permission_id) ON DELETE CASCADE,
                    created_at DATETIME DEFAULT GETDATE(),
                    PRIMARY KEY (user_id, permission_id)
                )
                """,

                # 3b. Bảng schools
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[schools]') AND type in (N'U'))
                CREATE TABLE schools (
                    school_id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id INT CONSTRAINT FK_schools_users FOREIGN KEY REFERENCES users(user_id) ON DELETE CASCADE,
                    school_name NVARCHAR(150) NOT NULL,
                    address NVARCHAR(255) NULL,
                    school_logo VARCHAR(255) NULL,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """,
                
                # 4. Bảng classes
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[classes]') AND type in (N'U'))
                CREATE TABLE classes (
                    class_id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id INT CONSTRAINT FK_classes_users FOREIGN KEY REFERENCES users(user_id) ON DELETE CASCADE,
                    class_name VARCHAR(50) NOT NULL,
                    academic_year VARCHAR(20) NOT NULL,
                    school_level VARCHAR(30) NOT NULL,
                    grade_level INT NOT NULL,
                    school_id INT NULL CONSTRAINT FK_classes_schools FOREIGN KEY REFERENCES schools(school_id) ON DELETE NO ACTION,
                    is_active BIT DEFAULT 0,
                    is_scoring BIT DEFAULT 0,
                    practice_enabled BIT DEFAULT 1,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """,

                # 4b. Di cư thêm cột school_id nếu bảng classes đã tồn tại nhưng chưa có cột này
                """
                IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[classes]') AND type in (N'U'))
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[classes]') AND name = 'school_id')
                    BEGIN
                        ALTER TABLE classes ADD school_id INT NULL;
                        ALTER TABLE classes ADD CONSTRAINT FK_classes_schools FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE NO ACTION;
                    END
                END
                """,
                
                # 4c. Di cư thêm cột practice_enabled nếu bảng classes đã tồn tại nhưng chưa có cột này
                """
                IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[classes]') AND type in (N'U'))
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[classes]') AND name = 'practice_enabled')
                    BEGIN
                        ALTER TABLE classes ADD practice_enabled BIT DEFAULT 1;
                    END
                END
                """,
                
                # 5. Bảng students
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[students]') AND type in (N'U'))
                CREATE TABLE students (
                    student_id INT IDENTITY(1,1) PRIMARY KEY,
                    student_code VARCHAR(50) NULL,
                    class_id INT CONSTRAINT FK_students_classes FOREIGN KEY REFERENCES classes(class_id) ON DELETE CASCADE,
                    full_name NVARCHAR(100) NOT NULL,
                    default_target_score INT DEFAULT 35,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """,
                
                # 6. Bảng computers
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[computers]') AND type in (N'U'))
                CREATE TABLE computers (
                    computer_id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id INT CONSTRAINT FK_computers_users FOREIGN KEY REFERENCES users(user_id) ON DELETE CASCADE,
                    pc_name VARCHAR(20) NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    mac_address VARCHAR(17) NULL,
                    status VARCHAR(20) DEFAULT 'offline',
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_computers_user_pc UNIQUE (user_id, pc_name)
                )
                """,
                
                # 7. Bảng workstations
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[workstations]') AND type in (N'U'))
                CREATE TABLE workstations (
                    workstation_id INT IDENTITY(1,1) PRIMARY KEY,
                    class_id INT CONSTRAINT FK_workstations_classes FOREIGN KEY REFERENCES classes(class_id) ON DELETE CASCADE,
                    computer_id INT CONSTRAINT FK_workstations_computers FOREIGN KEY REFERENCES computers(computer_id) ON DELETE NO ACTION,
                    student_id INT NULL CONSTRAINT FK_workstations_students FOREIGN KEY REFERENCES students(student_id) ON DELETE NO ACTION,
                    target_score INT NULL,
                    assigned_exam_code VARCHAR(50) NULL,
                    is_draft BIT DEFAULT 0,
                    created_at DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_workstation_seating UNIQUE (class_id, computer_id, is_draft)
                )
                """,
                
                # 8. Bảng scores
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[scores]') AND type in (N'U'))
                CREATE TABLE scores (
                    score_id INT IDENTITY(1,1) PRIMARY KEY,
                    class_id INT CONSTRAINT FK_scores_classes FOREIGN KEY REFERENCES classes(class_id) ON DELETE NO ACTION,
                    student_id INT NULL CONSTRAINT FK_scores_students FOREIGN KEY REFERENCES students(student_id) ON DELETE SET NULL,
                    computer_id INT CONSTRAINT FK_scores_computers FOREIGN KEY REFERENCES computers(computer_id) ON DELETE NO ACTION,
                    exam_code VARCHAR(50) NOT NULL,
                    score_achieved DECIMAL(5,2) NOT NULL,
                    duration_seconds INT NULL,
                    raw_html_content NVARCHAR(MAX) NULL,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """,
                
                # 9. Bảng knowledge_articles
                """
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[knowledge_articles]') AND type in (N'U'))
                CREATE TABLE knowledge_articles (
                    article_id INT IDENTITY(1,1) PRIMARY KEY,
                    title NVARCHAR(255) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    image_url VARCHAR(255) NULL,
                    description NVARCHAR(MAX) NULL,
                    summary NVARCHAR(MAX) NULL,
                    content NVARCHAR(MAX) NULL,
                    created_at DATETIME DEFAULT GETDATE()
                )
                """
            ]
            
            if not use_sqlite:
                for stmt in statements:
                    conn.execute(text(stmt))
            
            # 3. Chèn dữ liệu quyền hệ thống mặc định (đã loại bỏ ký tự N bên ngoài chuỗi python)
            permissions = [
                ('choose_class', 'Quyền chọn lớp học hoạt động'),
                ('get_scores', 'Quyền xem bảng điểm học sinh'),
                ('manage_seating', 'Quyền cấu hình sơ đồ máy tính chỗ ngồi'),
                ('set_target', 'Quyền thiết lập điểm mục tiêu học sinh'),
                ('manage_gsheet', 'Quyền quản lý Scoreboard Google Sheets'),
                ('excel_mode', 'Quyền thao tác tính năng chỉnh sửa Excel-grid'),
                ('trac_nghiem_ly_thuyet', 'Quyền giao đề & giám sát trắc nghiệm lý thuyết'),
                ('bai_giang_dien_tu', 'Quyền quản lý bài giảng điện tử'),
                ('tai_lieu_on_tap', 'Quyền quản lý tài liệu ôn tập'),
                ('cong_cu_tien_ich', 'Quyền truy cập công cụ tiện ích')
            ]
            
            for perm_id, desc in permissions:
                exists = conn.execute(text("SELECT 1 FROM permissions WHERE permission_id = :perm_id"), {"perm_id": perm_id}).fetchone()
                if not exists:
                    conn.execute(text("""
                        INSERT INTO permissions (permission_id, description) VALUES (:perm_id, :desc)
                    """), {"perm_id": perm_id, "desc": desc})
                
            # 3b. Chèn dữ liệu bài viết mặc định nếu bảng trống
            count_articles = conn.execute(text("SELECT COUNT(1) FROM knowledge_articles")).fetchone()[0]
            if count_articles == 0:
                print("[*] Đang chèn các bài viết tin học mặc định...")
                default_articles = [
                    (
                        "Cách đánh số trang bất kỳ trong Word 2010, 2013, 2016",
                        "Word",
                        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=60",
                        "Hướng dẫn chi tiết cách đánh số trang từ trang bất kỳ trong Microsoft Word bằng cách tạo ngắt phần (Section Break) và hủy liên kết phần trước đó.",
                        "Bước 1: Đánh Số Trang Cho Toàn Bộ Văn Bản. Bước 2: Tạo Section mới ở trang muốn bắt đầu đánh số. Bước 3: Tắt liên kết Link to Previous...",
                        """<h3>📌 Các bước thực hành chi tiết</h3>
<ol>
  <li>Mở phần mềm Microsoft Word và truy cập tài liệu cần chỉnh sửa.</li>
  <li>Định vị con trỏ soạn thảo tại vị trí mong muốn thực hiện thao tác.</li>
  <li>Sử dụng các thanh công cụ trên Ribbon để kích hoạt tính năng thích hợp.</li>
  <li>Kiểm tra lại định dạng hiển thị để đảm bảo văn bản trông chuyên nghiệp nhất.</li>
</ol>
<blockquote>
  <strong>Mẹo hay:</strong> Sử dụng các tổ hợp phím tắt như Ctrl + S thường xuyên để lưu lại công việc của bạn nhé!
</blockquote>"""
                    ),
                    (
                        "Cách ghép nhiều file Word thành 1 file duy nhất giữ nguyên định dạng",
                        "Word",
                        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=60",
                        "Sử dụng công cụ Text from File có sẵn trong Word giúp bạn gộp nhiều tài liệu văn bản thành một file duy nhất mà không bị lỗi layout hay font chữ.",
                        None,
                        """<h3>📌 Hướng dẫn gộp tài liệu</h3>
<ol>
  <li>Mở tài liệu Word chính bạn muốn gộp các tài liệu khác vào.</li>
  <li>Đặt con trỏ tại vị trí muốn chèn nội dung tiếp theo.</li>
  <li>Chọn tab <strong>Insert</strong> > nhấp mũi tên cạnh nút <strong>Object</strong> > chọn <strong>Text from File</strong>.</li>
  <li>Chọn các tệp tin Word cần gộp và nhấn <strong>Insert</strong>.</li>
</ol>"""
                    ),
                    (
                        "Tạo Mục lục tự động trong Word chỉn chu, chuyên nghiệp & nhanh chóng",
                        "Word",
                        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=500&auto=format&fit=crop&q=60",
                        "Bằng cách phân cấp Heading 1, 2, 3 và sử dụng tính năng Table of Contents, bạn có thể tạo ngay trang mục lục tự động cập nhật số trang chỉ bằng 1 click.",
                        None,
                        """<h3>📌 Cách tạo mục lục tự động</h3>
<ol>
  <li>Bôi đen tiêu đề và gán các cấp độ Heading (Heading 1, Heading 2,...) trong tab <strong>Home</strong>.</li>
  <li>Đặt con trỏ tại trang bạn muốn chèn mục lục.</li>
  <li>Chọn tab <strong>References</strong> > nhấn nút <strong>Table of Contents</strong> > chọn mẫu phù hợp.</li>
  <li>Để cập nhật số trang, nhấp chuột phải vào mục lục chọn <strong>Update Field</strong>.</li>
</ol>"""
                    ),
                    (
                        "Hướng dẫn nhanh 03 cách xóa trang trắng thừa trong Word chi tiết nhất",
                        "Word",
                        "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=500&auto=format&fit=crop&q=60",
                        "Tìm hiểu cách sử dụng phím Backspace, tổ hợp Ctrl + Shift + 8 (Show/Hide Paragraph marks) để xác định nguyên nhân và xóa bỏ trang trắng cứng đầu.",
                        None,
                        """<h3>📌 Các cách xóa trang trắng thừa</h3>
<ol>
  <li><strong>Sử dụng Backspace:</strong> Di chuyển con trỏ xuống cuối trang trắng và nhấn liên tục phím Backspace/Delete.</li>
  <li><strong>Sử dụng Show/Hide:</strong> Nhấn <code>Ctrl + Shift + 8</code> để hiện các ký hiệu Paragraph, tìm Page Break thừa và nhấn Delete.</li>
  <li><strong>Sử dụng Navigation Pane:</strong> Bật Navigation Pane, chọn tab Pages, click vào trang trắng và nhấn Delete.</li>
</ol>"""
                    ),
                    (
                        "10 phím tắt Excel thần thánh giúp nhân đôi tốc độ xử lý bảng tính",
                        "Excel",
                        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
                        "Từ phím Ctrl + T để tạo bảng nhanh, Alt + = để tính tổng SUM tự động đến Ctrl + Shift + L để bật tắt bộ lọc dữ liệu nhanh chóng.",
                        None,
                        """<h3>📊 Hướng dẫn tính toán trên bảng tính</h3>
<ol>
  <li>Nhấp vào ô muốn hiển thị kết quả công thức tính toán.</li>
  <li>Gõ dấu bằng <code>=</code> để bắt đầu nhập hàm.</li>
  <li>Chọn vùng dữ liệu nguồn cần quét (ví dụ: A1:D10).</li>
  <li>Nhấn Enter và sử dụng AutoFill kéo xuống các dòng còn lại nếu cần.</li>
</ol>
<blockquote>
  <strong>Lưu ý quan trọng:</strong> Luôn kiểm tra xem kiểu dữ liệu có trùng khớp không để tránh lỗi <code>#VALUE!</code> đáng tiếc.
</blockquote>"""
                    ),
                    (
                        "Cách sử dụng hàm VLOOKUP và XLOOKUP cơ bản dễ hiểu nhất kèm ví dụ",
                        "Excel",
                        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60",
                        "So sánh chi tiết cú pháp và tính năng giữa hàm dò tìm truyền thống VLOOKUP và hàm XLOOKUP thế hệ mới giúp sửa lỗi tìm ngược và tìm gần đúng.",
                        None,
                        """<h3>📌 Hướng dẫn hàm dò tìm</h3>
<ol>
  <li><strong>Hàm VLOOKUP:</strong> Cú pháp <code>=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])</code>.</li>
  <li><strong>Hàm XLOOKUP:</strong> Cú pháp <code>=XLOOKUP(lookup_value, lookup_array, return_array)</code> (tối ưu hơn, không lỗi tìm ngược).</li>
</ol>"""
                    ),
                    (
                        "Hướng dẫn thiết kế Slide PowerPoint chuyên nghiệp bằng công cụ Morph",
                        "Powerpoint",
                        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=60",
                        "Làm thế nào để tạo hiệu ứng chuyển động Morph 3D cực mượt mà cho các đối tượng, văn bản và hình khối trên các slide thuyết trình của bạn.",
                        None,
                        """<h3>🎨 Cách thiết kế slide ấn tượng và lôi cuốn</h3>
<ol>
  <li>Chọn layout slide phù hợp với nội dung trình bày (Title, Content, Comparison).</li>
  <li>Sử dụng không quá 3 font chữ trong toàn bộ slide để tránh gây rối mắt.</li>
  <li>Áp dụng hiệu ứng chuyển động một cách tinh tế, tránh quá lạm dụng.</li>
  <li>Tập trung vào hình ảnh minh họa chất lượng cao thay vì nhồi nhét quá nhiều chữ.</li>
</ol>
<blockquote>
  <strong>Nguyên tắc vàng:</strong> 1 Slide - 1 Thông điệp chính để người nghe dễ dàng ghi nhớ.
</blockquote>"""
                    ),
                    (
                        "Tìm hiểu về bài thi IC3 Spark dành cho học sinh Tiểu học",
                        "IC3 Spark",
                        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=60",
                        "IC3 Spark là chứng chỉ tin học quốc tế công nhận kỹ năng sử dụng máy tính và mạng internet cơ bản của học sinh cấp tiểu học.",
                        None,
                        """<h3>📌 Cấu trúc bài thi IC3 Spark</h3>
<ul>
  <li><strong>Máy tính căn bản (Computing Fundamentals):</strong> Phần cứng, phần mềm, hệ điều hành.</li>
  <li><strong>Các ứng dụng chính (Key Applications):</strong> Word, Excel, PowerPoint căn bản.</li>
  <li><strong>Cuộc sống trực tuyến (Living Online):</strong> Trình duyệt web, email, an toàn mạng.</li>
</ul>"""
                    ),
                    (
                        "Cấu trúc bài thi tin học quốc tế IC3 GS6 mới nhất",
                        "IC3 GS6",
                        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60",
                        "Tìm hiểu 3 cấp độ (Level 1, Level 2, Level 3) của phiên bản IC3 GS6 mới nhất và thang điểm để đạt chứng chỉ quốc tế.",
                        None,
                        """<h3>📌 Cấu trúc 3 Cấp độ IC3 GS6</h3>
<ul>
  <li><strong>Level 1:</strong> Nhận biết công nghệ, sử dụng cơ bản và kỹ năng trực tuyến nền tảng.</li>
  <li><strong>Level 2:</strong> Kỹ năng làm việc số, cộng tác trực tuyến và sáng tạo nội dung số.</li>
  <li><strong>Level 3:</strong> Giải quyết vấn đề nâng cao, an toàn thông tin và tư duy số chuyên sâu.</li>
</ul>"""
                    )
                ]
                for title, category, img, desc, summary, content in default_articles:
                    conn.execute(text("""
                        INSERT INTO knowledge_articles (title, category, image_url, description, summary, content)
                        VALUES (:title, :category, :img, :desc, :summary, :content)
                    """), {"title": title, "category": category, "img": img, "desc": desc, "summary": summary, "content": content})
                print("[+] Đã chèn 9 bài viết tin học mặc định thành công!")

            # 4. Tạo các tài khoản mặc định và gán quyền
            from werkzeug.security import generate_password_hash
            
            # A. Tài khoản admin local
            # Mật khẩu lấy từ biến môi trường ADMIN_PASSWORD (backend/.env).
            #  - Chưa có ADMIN_PASSWORD và admin CHƯA tồn tại: sinh ngẫu nhiên, in ra MỘT LẦN.
            #  - Admin ĐÃ tồn tại và không đặt ADMIN_PASSWORD: giữ nguyên mật khẩu hiện tại.
            import secrets
            admin_pwd = os.getenv('ADMIN_PASSWORD')
            admin_exists = conn.execute(text("SELECT 1 FROM users WHERE username = 'admin'")).fetchone()
            if not admin_pwd and not admin_exists:
                admin_pwd = secrets.token_urlsafe(12)
                print(f"[!] Đã tạo tài khoản 'admin' với mật khẩu ngẫu nhiên: {admin_pwd}")
                print("[!] Hãy lưu lại ngay, mật khẩu này sẽ không hiển thị lần nữa.")
            admin_hash = generate_password_hash(admin_pwd) if admin_pwd else None
            if admin_exists:
                conn.execute(text("""
                    UPDATE users SET email = 'admin@ic3manager.com', role = 'admin', is_approved = 1 WHERE username = 'admin'
                """))
                if admin_hash:
                    conn.execute(text("UPDATE users SET password_hash = :pwd_hash WHERE username = 'admin'"), {"pwd_hash": admin_hash})
            else:
                conn.execute(text("""
                    INSERT INTO users (email, username, password_hash, role, full_name, is_approved) 
                    VALUES ('admin@ic3manager.com', 'admin', :pwd_hash, 'admin', 'Administrator', 1)
                """), {"pwd_hash": admin_hash})

            # B. Tài khoản admin đăng nhập bằng google
            # Mặc định KHÔNG có mật khẩu local (chỉ đăng nhập bằng Google).
            # Muốn có mật khẩu local, đặt GOOGLE_ADMIN_PASSWORD trong backend/.env.
            google_pwd = os.getenv('GOOGLE_ADMIN_PASSWORD')
            google_admin_hash = generate_password_hash(google_pwd) if google_pwd else None
            google_exists = conn.execute(text("SELECT 1 FROM users WHERE email = 'thuanan524@gmail.com'")).fetchone()
            if google_exists:
                conn.execute(text("""
                    UPDATE users SET username = 'thuanan524', google_id = 'thuanan524@gmail.com', role = 'admin', is_approved = 1 WHERE email = 'thuanan524@gmail.com'
                """))
                if google_admin_hash:
                    conn.execute(text("UPDATE users SET password_hash = :pwd_hash WHERE email = 'thuanan524@gmail.com'"), {"pwd_hash": google_admin_hash})
            else:
                conn.execute(text("""
                    INSERT INTO users (email, username, google_id, password_hash, role, full_name, is_approved)
                    VALUES ('thuanan524@gmail.com', 'thuanan524', 'thuanan524@gmail.com', :pwd_hash, 'admin', 'Thuận An Admin', 1)
                """), {"pwd_hash": google_admin_hash})

            # Cấp mọi quyền cho admin
            conn.execute(text("""
                INSERT INTO user_permissions (user_id, permission_id)
                SELECT u.user_id, p.permission_id FROM users u, permissions p
                WHERE u.role = 'admin'
                AND NOT EXISTS (
                    SELECT 1 FROM user_permissions up 
                    WHERE up.user_id = u.user_id AND up.permission_id = p.permission_id
                )
            """))

            # 5. Di cư dữ liệu cũ sang cấu trúc Phương án 2 (Tách Trường học)
            classes_to_migrate = conn.execute(text("SELECT class_id, user_id, class_name FROM classes")).fetchall()
            import re
            for cid, uid, cname in classes_to_migrate:
                match = re.match(r'^(.*?)\s*\((.*?)\)$', cname)
                if match:
                    short_name = match.group(1).strip()
                    school_name = match.group(2).strip()
                    
                    # Tìm hoặc tạo trường học này
                    school_row = conn.execute(text(
                        "SELECT school_id FROM schools WHERE user_id = :uid AND school_name = :sname"
                    ), {"uid": uid, "sname": school_name}).fetchone()
                    
                    if not school_row:
                        conn.execute(text(
                            "INSERT INTO schools (user_id, school_name) VALUES (:uid, :sname)"
                        ), {"uid": uid, "sname": school_name})
                        school_row = conn.execute(text(
                            "SELECT school_id FROM schools WHERE user_id = :uid AND school_name = :sname"
                        ), {"uid": uid, "sname": school_name}).fetchone()
                        
                    sid = school_row[0]
                    
                    # Cập nhật lớp học
                    conn.execute(text(
                        "UPDATE classes SET class_name = :short_name, school_id = :sid WHERE class_id = :cid"
                    ), {"short_name": short_name, "sid": sid, "cid": cid})
            
            # 6. Tự động khởi tạo chỉ mục (indexes) hệ thống để tối ưu hóa hiệu năng
            print("[*] Đang kiểm tra và khởi tạo các chỉ mục CSDL...")
            if use_sqlite:
                sqlite_index_statements = [
                    "CREATE INDEX IF NOT EXISTS IX_questions_quiz_id ON questions(quiz_id);",
                    "CREATE INDEX IF NOT EXISTS IX_quiz_attempts_class_quiz_id ON quiz_attempts(class_quiz_id);",
                    "CREATE INDEX IF NOT EXISTS IX_quiz_attempts_student_id ON quiz_attempts(student_id);",
                    "CREATE INDEX IF NOT EXISTS IX_class_quizzes_class_id ON class_quizzes(class_id);",
                    "CREATE INDEX IF NOT EXISTS IX_class_quizzes_quiz_id ON class_quizzes(quiz_id);",
                    "CREATE INDEX IF NOT EXISTS IX_students_class_id ON students(class_id);",
                    "CREATE INDEX IF NOT EXISTS IX_workstations_class_id ON workstations(class_id);",
                    "CREATE INDEX IF NOT EXISTS IX_workstations_student_id ON workstations(student_id);",
                    "CREATE INDEX IF NOT EXISTS IX_scores_class_id ON scores(class_id);",
                    "CREATE INDEX IF NOT EXISTS IX_scores_student_id ON scores(student_id);"
                ]
                for idx_stmt in sqlite_index_statements:
                    try:
                        conn.execute(text(idx_stmt))
                    except Exception as ex:
                        pass
            else:
                mssql_index_statements = [
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_questions_quiz_id' AND object_id = OBJECT_ID('questions')) CREATE INDEX IX_questions_quiz_id ON questions(quiz_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_quiz_attempts_class_quiz_id' AND object_id = OBJECT_ID('quiz_attempts')) CREATE INDEX IX_quiz_attempts_class_quiz_id ON quiz_attempts(class_quiz_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_quiz_attempts_student_id' AND object_id = OBJECT_ID('quiz_attempts')) CREATE INDEX IX_quiz_attempts_student_id ON quiz_attempts(student_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_class_quizzes_class_id' AND object_id = OBJECT_ID('class_quizzes')) CREATE INDEX IX_class_quizzes_class_id ON class_quizzes(class_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_class_quizzes_quiz_id' AND object_id = OBJECT_ID('class_quizzes')) CREATE INDEX IX_class_quizzes_quiz_id ON class_quizzes(quiz_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_class_id' AND object_id = OBJECT_ID('students')) CREATE INDEX IX_students_class_id ON students(class_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workstations_class_id' AND object_id = OBJECT_ID('workstations')) CREATE INDEX IX_workstations_class_id ON workstations(class_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workstations_student_id' AND object_id = OBJECT_ID('workstations')) CREATE INDEX IX_workstations_student_id ON workstations(student_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scores_class_id' AND object_id = OBJECT_ID('scores')) CREATE INDEX IX_scores_class_id ON scores(class_id);",
                    "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scores_student_id' AND object_id = OBJECT_ID('scores')) CREATE INDEX IX_scores_student_id ON scores(student_id);"
                ]
                for idx_stmt in mssql_index_statements:
                    try:
                        conn.execute(text(idx_stmt))
                    except Exception as ex:
                        print(f"[*] Warning: Không thể tạo chỉ mục MSSQL: {ex}")
            
            print("[+] Thiết lập cấu trúc và dữ liệu mẫu CSDL hoàn tất thành công!")
            print(f"[+] Tên CSDL: {db_name}")
            print("[*] Tài khoản hệ thống đã tạo:")
            print("  1. Local Admin: admin (mật khẩu: ADMIN_PASSWORD trong .env, hoặc mật khẩu ngẫu nhiên đã in ở trên)")
            print("  2. Google Admin: thuanan524@gmail.com (đăng nhập bằng Google)")
            
    except Exception as e:
        print(f"[-] Lỗi trong quá trình thiết lập bảng CSDL: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_setup()
