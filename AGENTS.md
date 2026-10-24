# AGENTS.md: quy tắc làm việc trong dự án IC3 Manager

Dành cho mọi người và mọi AI sửa code ở đây (Antigravity, Claude, Cursor, Codex...). Đọc hết file này trước khi sửa. Mô tả tính năng nằm ở [README.md](README.md), file này chỉ nói **cách làm đúng** và **những điều không được làm**.

## 1. Dự án là gì

Hệ thống quản lý phòng máy tin học: giáo viên giám sát điểm thực hành (iSpring/GMetrix gửi về), giao đề trắc nghiệm lý thuyết, xếp chỗ ngồi. Học sinh vào làm bài **không cần tài khoản**.

- Backend: Flask 3 + Flask-Login + SQLAlchemy 2. Cổng 5000. Chạy SQLite mặc định, hỗ trợ SQL Server.
- Frontend: React + TypeScript + Vite. Cổng 5173. Gọi API qua `frontend/src/api/index.ts`.
- Giao diện, thông báo lỗi, tên biến nghiệp vụ dùng tiếng Việt. Giữ nguyên như vậy.

## 2. Chạy và kiểm tra

Windows: chạy `run.bat` (tạo/cập nhật CSDL, mở backend và frontend). macOS: `run.command`. Chạy tay:

```bash
cd backend
venv\Scripts\activate            # Windows. run.command dùng .venv ở thư mục gốc
pip install -r requirements.txt
copy .env.example .env           # rồi điền giá trị, xem mục 6
python setup_database.py         # tạo bảng, quyền mặc định, tài khoản admin
python app.py

cd ../frontend && npm install && npm run dev
```

- `DATABASE_URL` trống, hoặc thiếu `pyodbc`, thì dùng SQLite tại `backend/ic3manager.db`.
- `npm run build` chạy `tsc -b`. Ngày 20/10/2026 còn 4 lỗi TypeScript có sẵn (`QuizPortal.tsx`, `TeacherQuizzes.tsx`, `StudentPortalRegistration.tsx`). Đừng gán nhầm cho thay đổi của mình, nhưng cũng đừng thêm lỗi mới. Kiểm tra bằng `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`.
- Sau khi sửa Python, chạy `python -m py_compile <file>`.

## 3. Cấu trúc backend

- `backend/app.py`: tạo app, CORS, phục vụ file tĩnh, `/scripts/*`, `/quizzes/*`, SPA.
- `src/routes/`: blueprint `api_bp` (`api.py`, `api_*.py`), `quiz_bp` (`quiz.py` cùng `quiz_admin.py`, `quiz_student.py`, `quiz_teacher.py`), `auth_bp`, `admin_bp`.
- `src/controllers/`: xử lý nghiệp vụ cho `api_bp` (điểm, máy, trường lớp, Excel, Google Sheets).
- `src/middleware/auth.py`: `permission_required(...)`. `src/models/models_db.py`: toàn bộ bảng. `src/utils/db_helpers.py`: hàm truy vấn dùng chung. `src/utils/rate_limit.py`: giới hạn tần suất.
- `setup_database.py` tạo schema đầy đủ cho CSDL mới. `migrations/migration_vN.py` là các script nâng cấp tay.
- 10 quyền: `choose_class`, `get_scores`, `manage_seating`, `set_target`, `manage_gsheet`, `excel_mode`, `trac_nghiem_ly_thuyet`, `bai_giang_dien_tu`, `tai_lieu_on_tap`, `cong_cu_tien_ich`. `role == 'admin'` có mọi quyền.

## 4. Quy tắc dữ liệu và quyền sở hữu (không được vi phạm)

1. **Trường học dùng chung, lớp học thuộc riêng từng giáo viên.** Lớp có `ClassDB.user_id`. Mọi truy vấn `ClassDB` xuất phát từ người dùng đã đăng nhập **phải lọc `ClassDB.user_id == int(current_user.id)`**. Ngoại lệ: admin, và chỗ cố ý như `get_teacher_classroom` trong `quiz.py`. Học sinh, máy tính (`ComputerDB`), trạng thái lớp đang chọn (`UserActiveStateDB`) đều đi theo lớp hoặc user, nên cũng phải đi qua lớp của chính user.
2. Chỉ người tạo trường (`SchoolDB.user_id`) hoặc admin mới xóa trường, và không xóa khi trường còn lớp.
3. `@login_required` chỉ nói "đã đăng nhập". Nó **không** nói người này được động vào dữ liệu đó. Thêm route mới thì phải có `@permission_required(...)` hoặc kiểm tra `role` / sở hữu trong hàm, và phải nghĩ tới việc user A đưa id của user B.
4. Không tin `class_id`, `student_id`, `attempt_id`, `quiz_id` do client gửi lên. Đối chiếu với CSDL (học sinh thuộc lớp đó, lượt thi đúng token, đề đang được giao...).
5. **SQLite ở đây không bật khóa ngoại** (không có `PRAGMA foreign_keys`). `ondelete='CASCADE'` không có tác dụng trên SQLite, xóa hàng loạt sẽ để lại dữ liệu mồ côi. Xóa bảng con thủ công khi cần. Code phải chạy được cả trên SQL Server (dùng `Unicode`, `UnicodeText` cho chữ tiếng Việt).
6. Migration: chưa có tài liệu về thứ tự các `migrations/migration_vN.py`. Đọc script trước khi chạy, **sao lưu CSDL trước**, và không chạy trên dữ liệu thật khi chưa hiểu nó làm gì.

## 5. Endpoint công khai (không đăng nhập) và cách giữ an toàn

Công khai có chủ đích: cổng học sinh `/api/public/*`, `/api/save-score` (iSpring, GMetrix, đề offline gửi điểm), `/nhan_ip` (file `.bat` trên máy học sinh), `/scripts/*`. Với các endpoint này:

- Kiểm tra mọi tham số (kiểu, độ dài, regex tên máy, phạm vi điểm), giới hạn kích thước body.
- Giới hạn tần suất bằng `src/utils/rate_limit.py` (đã dùng cho nhập PIN, `/api/save-score`, `/nhan_ip`).
- Lượt thi dùng `session_token` do server cấp lúc bắt đầu. Lưu, nộp, xem kết quả đều phải gửi lại token (`api/index.ts` đã làm tự động).
- Không trả đáp án đúng hoặc giải thích khi bài chưa nộp. Khi giáo viên đang giao đề, chế độ làm bài do giáo viên quyết định, học sinh không tự chọn ôn luyện.
- Tên file ghi ra đĩa từ dữ liệu client phải được làm sạch và kiểm tra nằm trong thư mục đích (xem `_safe_name_part` trong `score_controller.py`).
- Hạn chế đã biết: điểm do máy học sinh tự báo về, nên vẫn có thể bị làm giả.
- `/quizzes/*` yêu cầu đăng nhập (file đề offline chứa đáp án).
- Đăng nhập (`/api/auth/login/local`) và đăng ký (`/api/auth/register`) cũng có giới hạn tần suất; tài khoản bị thu hồi phê duyệt thì phiên đang mở mất hiệu lực (`load_user` trong `app.py`). Giữ các giới hạn này khi sửa luồng đăng nhập.

## 6. Bí mật và cấu hình

- Không viết mật khẩu, khóa API, token vào code, tài liệu, test, ảnh chụp. Dùng `backend/.env` (đã gitignore). Mẫu ở `backend/.env.example`.
- Biến chính: `SECRET_KEY` (thiếu thì sinh ngẫu nhiên và mất phiên đăng nhập mỗi lần khởi động), `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `GSHEET_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `TEST_ADMIN_PASSWORD`, `TEST_TEACHER_PASSWORD`.
- Đổi hoặc xóa mật khẩu một tài khoản: `python reset_password.py <username|email>` (thêm `--clear` để bỏ mật khẩu local).
- Tuyệt đối không in giá trị bí mật ra log hay câu trả lời.

## 7. Kiểm thử

- Chưa có unit test. Có một bộ E2E Playwright: `tests/run_tests.py`. Cần backend (5000) và frontend (5173) đang chạy, cùng `TEST_ADMIN_PASSWORD` và `TEST_TEACHER_PASSWORD`.
- **Cảnh báo:** E2E xóa toàn bộ `quiz_attempts` và các ca thi đang hoạt động trong CSDL nơi nó chạy. Chỉ chạy trên **bản sao** của DB, không chạy trên dữ liệu thật.
- Sửa API công khai hoặc phân quyền thì viết thêm ca xấu: token sai, user khác, id của người khác, body quá lớn, vượt giới hạn tần suất, tên file chứa `../`. Cách làm gọn: sao chép `backend/` ra thư mục tạm, tạo bảng bằng `Base.metadata.create_all(engine)` rồi dùng `app.test_client()`.
- Sau khi sửa code, chạy lại các ca đó trên cả bản cũ lẫn bản mới để chắc test thật sự bắt được lỗi.

## 8. Quy ước khi sửa code

- Sửa nhỏ, đúng phạm vi yêu cầu. Không refactor hay định dạng lại cả file.
- Phần lớn file dùng kết thúc dòng CRLF. Giữ nguyên kiểu có sẵn của từng file.
- Không thêm thư viện mới nếu không cần. Thêm thì ghi vào `requirements.txt` hoặc `package.json`.
- Không commit CSDL thật, dữ liệu học sinh, file điểm, ảnh chụp chứa tên.
- Không để file thử nghiệm ở thư mục gốc. Đặt chúng trong `scratch/` và xoá khi không còn dùng.

## 9. Tình trạng repo cần biết

- Git đang theo dõi `backend/venv` (hơn 2.000 file), `backend/ic3manager.db` và `storage/` (file điểm, ảnh đại diện). Nên chuyển sang `.gitignore` và gỡ khỏi git (`git rm -r --cached`) sau khi chắc đã sao lưu.
- Tài liệu và độ tin cậy: xem [docs/README.md](docs/README.md). `docs/system_overview.md`, `docs/ke_hoach_cu/implementation_plan.md` là tài liệu cũ hoặc tham khảo, **không phải** quy chuẩn. Khi tài liệu mâu thuẫn với code, tin code, rồi cập nhật tài liệu.
