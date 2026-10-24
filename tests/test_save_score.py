"""Automated test suite for POST /api/save-score.

Kiem thu endpoint cong khai /api/save-score voi tat ca cac truong hop
thanh cong, that bai, bao mat (traversal, payload size, rate limit)
va bao ve thong tin loi (khong ro ri traceback/exception).
"""

import os
import sys
import shutil
import tempfile
import unittest
from unittest.mock import patch
from werkzeug.test import EnvironBuilder

# 1. Thiet lap moi truong doc lap truoc khi nap backend
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_TEMP_DIR = tempfile.mkdtemp(prefix="ic3_test_save_score_")
_TEMP_BACKEND = os.path.join(_TEMP_DIR, "backend")
shutil.copytree(
    os.path.join(_REPO_ROOT, "backend"),
    _TEMP_BACKEND,
    ignore=shutil.ignore_patterns("venv", ".venv", "*.db", "__pycache__", ".env", ".env.*", "storage", "data")
)
_TEMP_SCORES = os.path.join(_TEMP_DIR, "scores")
os.makedirs(_TEMP_SCORES, exist_ok=True)

# Dat thu muc backend tam thoi vao sys.path de import
sys.path.insert(0, _TEMP_BACKEND)

# Thiet lap DATABASE_URL tro toi SQLite tam thoi
_TEMP_DB_PATH = os.path.join(_TEMP_BACKEND, "ic3manager.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEMP_DB_PATH}"

# Import backend va cac model sau khi da thiet lap moi truong
import src.models.models_db as models_db
from src.config.database import engine, db_session, Base
from src.models.models_db import (
    UserDB, SchoolDB, ClassDB, StudentDB, ComputerDB,
    WorkstationDB, ScoreDB, UserActiveStateDB
)
import src.controllers.score_controller as score_controller
from src.controllers.score_controller import (
    _safe_name_part,
    SAVE_SCORE_MAX_BYTES,
    SAVE_SCORE_MAX_SECONDS,
)
from src.utils.rate_limit import limiter

# Chot an toan: setUp xoa sach nhieu bang, tuyet doi khong duoc chay tren CSDL that
# (so voi engine.url.database vi str(engine.url) ma hoa phan tram duong dan tren Windows)
assert engine.url.database and os.path.realpath(_TEMP_DIR) in os.path.realpath(engine.url.database),     "Bộ test phải chạy trên CSDL tạm"

# Tao toan bo bang trong CSDL tam
Base.metadata.create_all(engine)

# Nap app va ghi de SCORES_PATH sang thu muc tam
from app import app
score_controller.SCORES_PATH = _TEMP_SCORES


class TestSaveScore(unittest.TestCase):
    """Bo kiem thu cho POST /api/save-score."""

    @classmethod
    def tearDownClass(cls):
        """Don dep ket noi CSDL va xoa toan bo thu muc tam."""
        db_session.remove()
        engine.dispose()
        if os.path.exists(_TEMP_DIR):
            shutil.rmtree(_TEMP_DIR, ignore_errors=True)

    def setUp(self):
        """Lam sach du lieu truoc moi test case."""
        db_session.rollback()
        db_session.query(ScoreDB).delete()
        db_session.query(WorkstationDB).delete()
        db_session.query(StudentDB).delete()
        db_session.query(ComputerDB).delete()
        db_session.query(UserActiveStateDB).delete()
        db_session.query(ClassDB).delete()
        db_session.query(SchoolDB).delete()
        db_session.query(UserDB).filter(UserDB.username != "admin").delete()
        db_session.commit()

        # Lam sach file diem trong thu muc tam
        for item in os.listdir(_TEMP_SCORES):
            p = os.path.join(_TEMP_SCORES, item)
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
            else:
                try:
                    os.remove(p)
                except OSError as exc:
                    _ = exc

        limiter.reset()
        self.client = app.test_client()

    def tearDown(self):
        """Ket thuc moi test case: rollback va reset limiter."""
        db_session.rollback()
        limiter.reset()

    def _create_teacher_school_class_student(self):
        """Ham tien ich tao giao vien, truong, lop va hoc sinh."""
        teacher = UserDB(
            email="giaovien_test@example.com",
            username="teacher_test",
            full_name="Giao Vien Test",
            role="teacher",
            is_approved=True
        )
        db_session.add(teacher)
        db_session.flush()

        school = SchoolDB(
            user_id=teacher.user_id,
            school_name="Truong THCS Test"
        )
        db_session.add(school)
        db_session.flush()

        classroom = ClassDB(
            user_id=teacher.user_id,
            school_id=school.school_id,
            class_name="6A1",
            academic_year="2025-2026",
            school_level="THCS",
            grade_level=6,
            is_active=True,
            is_scoring=True
        )
        db_session.add(classroom)
        db_session.flush()

        student = StudentDB(
            class_id=classroom.class_id,
            student_code="HS01",
            full_name="Nguyen Van A"
        )
        db_session.add(student)
        db_session.commit()

        # Luu dang so nguyen de tranh DetachedInstanceError sau khi context ket thuc
        teacher_id = int(teacher.user_id)
        class_id = int(classroom.class_id)
        student_id = int(student.student_id)

        return teacher_id, class_id, student_id

    def _count_score_files(self):
        """Dem so file .html diem trong thu muc scores."""
        total = 0
        for root, _, files in os.walk(_TEMP_SCORES):
            for f in files:
                if f.endswith(".html"):
                    total += 1
        return total

    # --- Unit test _safe_name_part ---

    def test_safe_name_part_unit(self):
        """Kiem tra don vi ham _safe_name_part voi cac chuoi dac biet."""
        self.assertEqual(_safe_name_part("../../etc/passwd"), "..-..-etc-passwd")
        self.assertEqual(_safe_name_part("a_b"), "a-b")
        self.assertEqual(_safe_name_part(""), "x")
        long_val = "a" * 100
        res_long = _safe_name_part(long_val)
        self.assertEqual(res_long, "a" * 40)
        self.assertEqual(len(res_long), 40)

        # Cac ky tu phan cach duong dan phai bi thay the
        self.assertNotIn("/", _safe_name_part("a/b/c"))
        self.assertNotIn("\\", _safe_name_part(r"a\b\c"))
        self.assertNotIn("_", _safe_name_part("a_b_c"))

    # --- Happy Paths ---

    def test_options_cors(self):
        """OPTIONS tra ve 200 va day du header CORS."""
        resp = self.client.options("/api/save-score")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")
        methods = resp.headers.get("Access-Control-Allow-Methods", "")
        self.assertIn("POST", methods)
        self.assertIn("OPTIONS", methods)
        headers = resp.headers.get("Access-Control-Allow-Headers", "")
        self.assertIn("Content-Type", headers)
        self.assertIn("Authorization", headers)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "success")

    def test_save_score_standalone_happy_path(self):
        """Che do doc lap: gui du form fields va body sp/ut/lt luu thanh cong."""
        teacher_id, class_id, student_id = self._create_teacher_school_class_student()

        payload = {
            "class_id": str(class_id),
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": "600",
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.decode("utf-8"), "OK")

        # 1. ScoreDB ton tai dung thong tin (exam_code normalized thanh OT1)
        score_row = db_session.query(ScoreDB).first()
        self.assertIsNotNone(score_row)
        self.assertEqual(score_row.class_id, class_id)
        self.assertEqual(score_row.student_id, student_id)
        self.assertEqual(score_row.exam_code, "OT1")
        self.assertEqual(float(score_row.score_achieved), 80.0)
        self.assertEqual(score_row.duration_seconds, 600)

        # 2. ComputerDB duoc tao
        comp_row = db_session.query(ComputerDB).filter_by(
            user_id=teacher_id, pc_name="PC01"
        ).first()
        self.assertIsNotNone(comp_row)

        # 3. WorkstationDB mapping duoc tao/cap nhat
        ws_row = db_session.query(WorkstationDB).filter_by(
            class_id=class_id, computer_id=comp_row.computer_id, is_draft=False
        ).first()
        self.assertIsNotNone(ws_row)
        self.assertEqual(ws_row.student_id, student_id)

        # 4. Ghi 1 file .html trong thu muc class_<id>
        class_dir = os.path.join(_TEMP_SCORES, f"class_{class_id}")
        self.assertTrue(os.path.isdir(class_dir))
        files = [f for f in os.listdir(class_dir) if f.endswith(".html")]
        self.assertEqual(len(files), 1)

    def test_save_score_fallback_happy_path(self):
        """Che do fallback: khong co form fields, nhan dien qua IP va UserActiveStateDB."""
        teacher_id, class_id, student_id = self._create_teacher_school_class_student()

        # May tinh co ip 127.0.0.1 (remote_addr mac dinh cua test client)
        comp = ComputerDB(
            user_id=teacher_id,
            pc_name="PC05",
            ip_address="127.0.0.1"
        )
        db_session.add(comp)
        db_session.flush()

        ws = WorkstationDB(
            class_id=class_id,
            computer_id=comp.computer_id,
            student_id=student_id,
            is_draft=False
        )
        db_session.add(ws)

        active_state = UserActiveStateDB(
            user_id=teacher_id,
            scoring_class_id=class_id
        )
        db_session.add(active_state)
        db_session.commit()

        comp_id = int(comp.computer_id)

        body = "sp=95&ut=450&lt=OT02"
        resp = self.client.post(
            "/api/save-score",
            data=body,
            content_type="application/x-www-form-urlencoded"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.decode("utf-8"), "OK")

        score_row = db_session.query(ScoreDB).first()
        self.assertIsNotNone(score_row)
        self.assertEqual(score_row.class_id, class_id)
        self.assertEqual(score_row.computer_id, comp_id)
        self.assertEqual(score_row.student_id, student_id)
        self.assertEqual(score_row.exam_code, "OT2")
        self.assertEqual(float(score_row.score_achieved), 95.0)
        self.assertEqual(score_row.duration_seconds, 450)

        # File html duoc tao
        self.assertEqual(self._count_score_files(), 1)

    # --- Bad cases: kiem tra status code, khong tao ScoreDB, khong ghi file ---

    def test_bad_score_digits_too_long(self):
        """sp vuot qua 6 chu so -> 400 ERR: Invalid score."""
        _, class_id, student_id = self._create_teacher_school_class_student()

        payload = {
            "class_id": str(class_id),
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "1234567",  # 7 chu so
            "ut": "600",
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ERR: Invalid score", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_bad_duration_exceeds_max_seconds(self):
        """ut lon hon 7 ngay (604800s) -> 400 ERR: Invalid duration."""
        _, class_id, student_id = self._create_teacher_school_class_student()

        payload = {
            "class_id": str(class_id),
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": str(SAVE_SCORE_MAX_SECONDS + 1),  # 604801s
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ERR: Invalid duration", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_duration_at_exact_max_accepted(self):
        """ut dung bang 604800s duoc chap nhan thanh cong."""
        _, class_id, student_id = self._create_teacher_school_class_student()

        payload = {
            "class_id": str(class_id),
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": str(SAVE_SCORE_MAX_SECONDS),  # dung 604800s
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.decode("utf-8"), "OK")
        score_row = db_session.query(ScoreDB).first()
        self.assertIsNotNone(score_row)
        self.assertEqual(score_row.duration_seconds, 604800)
        self.assertEqual(self._count_score_files(), 1)

    def test_bad_pc_name_regex_violations(self):
        """pc_name vi pham regex (qua dai, khoang trang, ../x, unicode) -> 400."""
        _, class_id, student_id = self._create_teacher_school_class_student()

        invalid_names = [
            "PC_TOOLONG_12345678",  # > 15 ky tu
            "PC 01",                # co dau cach
            "../x",                 # traversal / slash
            "M\u00e1y01",           # chu unicode 'Máy01'
            "PC@HOME!",             # ky tu dac biet
        ]

        for bad_name in invalid_names:
            payload = {
                "class_id": str(class_id),
                "student_id": str(student_id),
                "pc_name": bad_name,
                "sp": "80",
                "ut": "600",
                "lt": "OT01"
            }
            resp = self.client.post("/api/save-score", data=payload)
            self.assertEqual(resp.status_code, 400, f"pc_name {bad_name} phai tra ve 400")
            self.assertIn("ERR: Invalid pc_name", resp.data.decode("utf-8"))
            self.assertEqual(db_session.query(ScoreDB).count(), 0)
            self.assertEqual(self._count_score_files(), 0)

    def test_bad_non_numeric_class_or_student_id(self):
        """class_id hoac student_id khong phai so -> 400 ERR: Invalid class_id/student_id."""
        self._create_teacher_school_class_student()

        test_cases = [
            ("not_a_number", "1"),
            ("1", "not_a_number"),
            ("abc", "xyz"),
        ]

        for cid, sid in test_cases:
            payload = {
                "class_id": cid,
                "student_id": sid,
                "pc_name": "PC01",
                "sp": "80",
                "ut": "600",
                "lt": "OT01"
            }
            resp = self.client.post("/api/save-score", data=payload)
            self.assertEqual(resp.status_code, 400)
            self.assertIn("ERR: Invalid class_id/student_id", resp.data.decode("utf-8"))
            self.assertEqual(db_session.query(ScoreDB).count(), 0)
            self.assertEqual(self._count_score_files(), 0)

    def test_bad_student_not_in_class(self):
        """Hoc sinh khong thuoc ve lop hoc -> 400 ERR: Student not in class."""
        teacher_id, _, student_1_id = self._create_teacher_school_class_student()

        # Lop thu hai
        class_2 = ClassDB(
            user_id=teacher_id,
            class_name="6A2",
            academic_year="2025-2026",
            school_level="THCS",
            grade_level=6,
            is_active=True,
            is_scoring=True
        )
        db_session.add(class_2)
        db_session.commit()
        class_2_id = int(class_2.class_id)

        # Gui student_1 (lop 1) vao class_2
        payload = {
            "class_id": str(class_2_id),
            "student_id": str(student_1_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": "600",
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ERR: Student not in class", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_bad_class_id_not_exist_no_active_classes(self):
        """class_id khong ton tai va khong co lop active nao -> 400 ERR: No active classes."""
        payload = {
            "class_id": "999999",
            "student_id": "1",
            "pc_name": "PC01",
            "sp": "80",
            "ut": "600",
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ERR: No active classes", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_class_id_khong_ton_tai_voi_mot_lop_dang_nhan_diem(self):
        """class_id khong ton tai nhung co dung MOT lop dang bat nhan diem -> diem ghi vao lop do (khong bi tu choi).

        Chu y: ban offline, mot lop bat nhan diem tai mot thoi diem. Khi lam ban online voi nhieu lop thi
        cung luc, hanh vi nay phai doi: ma lop sai thi tu choi.
        """
        teacher_id, class_id, student_id = self._create_teacher_school_class_student()
        db_session.add(UserActiveStateDB(user_id=teacher_id, scoring_class_id=class_id))
        db_session.commit()

        payload = {
            "class_id": "999999",
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": "600",
            "lt": "OT01"
        }
        resp = self.client.post("/api/save-score", data=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.decode("utf-8"), "OK")
        rows = db_session.query(ScoreDB).all()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].class_id, class_id)
        self.assertEqual(self._count_score_files(), 1)

    def test_bad_payload_too_large_with_content_length(self):
        """Body lon hon 2 MB co Content-Length -> 413 ERR: Payload too large."""
        _, class_id, _ = self._create_teacher_school_class_student()

        large_chunk = b"A" * (SAVE_SCORE_MAX_BYTES + 1024)
        body = b"class_id=" + str(class_id).encode() + b"&junk=" + large_chunk

        resp = self.client.post(
            "/api/save-score",
            data=body,
            content_type="application/x-www-form-urlencoded"
        )
        self.assertEqual(resp.status_code, 413)
        self.assertIn("ERR: Payload too large", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_bad_payload_too_large_without_content_length(self):
        """Body lon hon 2 MB khong co Content-Length (chunked) -> 413 ERR: Payload too large."""
        _, class_id, _ = self._create_teacher_school_class_student()

        large_chunk = b"A" * (SAVE_SCORE_MAX_BYTES + 1024)
        body = b"class_id=" + str(class_id).encode() + b"&junk=" + large_chunk

        builder = EnvironBuilder(
            path="/api/save-score",
            method="POST",
            data=body,
            content_type="application/x-www-form-urlencoded"
        )
        env = builder.get_environ()
        del env["CONTENT_LENGTH"]
        env["wsgi.input_terminated"] = True

        resp = self.client.open(environ_overrides=env)
        self.assertEqual(resp.status_code, 413)
        self.assertIn("ERR: Payload too large", resp.data.decode("utf-8"))
        self.assertEqual(db_session.query(ScoreDB).count(), 0)
        self.assertEqual(self._count_score_files(), 0)

    def test_rate_limit_exceeded(self):
        """Vuot gioi han 60 requests / 60 giay tren cung 1 IP -> request thu 61 bi 429."""
        limiter.reset()

        # Gui 60 requests hop le hoac bat hop le
        for i in range(60):
            r = self.client.post("/api/save-score", data=b"empty")
            self.assertNotEqual(r.status_code, 429, f"Request {i+1} khong duoc bi rate limit")

        # Request thu 61 phai bi chan
        r61 = self.client.post("/api/save-score", data=b"empty")
        self.assertEqual(r61.status_code, 429)
        self.assertIn("ERR: Too many requests", r61.data.decode("utf-8"))

        limiter.reset()

    def test_exam_code_path_traversal_and_special_chars(self):
        """lt chua ../, ..\\, /, \\, NUL, hoac chuoi dai phai an toan, file khong thoat khoi thu muc."""
        _, class_id, student_id = self._create_teacher_school_class_student()
        class_dir = os.path.join(_TEMP_SCORES, f"class_{class_id}")

        test_codes = [
            "../../hack",
            r"..\..\hack",
            "exam/2026",
            r"exam\2026",
            "exam\x00secret",
            "VERY_LONG_" + ("A" * 200),
        ]

        for idx, code in enumerate(test_codes):
            payload = {
                "class_id": str(class_id),
                "student_id": str(student_id),
                "pc_name": f"PC{idx:02d}",
                "sp": "75",
                "ut": "300",
                "lt": code
            }
            resp = self.client.post("/api/save-score", data=payload)
            # Ket qua phai la 200 hoac 4xx, tuyet doi khong 500
            self.assertIn(resp.status_code, (200, 400), f"Code {code!r} gay ra status {resp.status_code}")

            # Kiem tra file da ghi (neu co) phai nam ben trong class_dir
            if os.path.exists(class_dir):
                for fname in os.listdir(class_dir):
                    fpath = os.path.realpath(os.path.join(class_dir, fname))
                    # File phai nam trong class_dir
                    self.assertTrue(
                        fpath.startswith(os.path.realpath(class_dir) + os.sep),
                        f"File {fpath} da thoat ra ngoai thu muc lop!"
                    )
                    # Ten file khong duoc chua ky tu phan cach hoac NUL
                    self.assertNotIn("/", fname)
                    self.assertNotIn("\\", fname)
                    self.assertNotIn("\x00", fname)
                    self.assertNotIn("../", fname)
                    self.assertNotIn("..\\", fname)

    def test_traversal_khong_ghi_file_ngoai_thu_muc_lop(self):
        """Moi file .html chi nam trong class_<id>, khong co file nao o noi khac trong thu muc tam."""
        _, class_id, student_id = self._create_teacher_school_class_student()
        payload = {"class_id": str(class_id), "student_id": str(student_id),
                   "pc_name": "PC01", "sp": "75", "ut": "300", "lt": "../../../hack"}

        def _all_html():
            found = set()
            for root, _, files in os.walk(_TEMP_DIR):
                found.update(os.path.join(root, f) for f in files if f.endswith(".html"))
            return found

        before = _all_html()
        self.assertEqual(self.client.post("/api/save-score", data=payload).status_code, 200)
        new_html = sorted(_all_html() - before)
        class_dir = os.path.realpath(os.path.join(_TEMP_SCORES, f"class_{class_id}"))
        self.assertEqual(len(new_html), 1)
        self.assertTrue(os.path.realpath(new_html[0]).startswith(class_dir + os.sep))

    def test_empty_body_and_garbage_bytes(self):
        """Body rong va chuoi byte invalid UTF-8 khong duoc lam sap 500 hoac lo traceback."""
        # 1. Body rong
        resp1 = self.client.post(
            "/api/save-score",
            data=b"",
            content_type="application/x-www-form-urlencoded"
        )
        self.assertNotEqual(resp1.status_code, 500)
        body1 = resp1.data.decode("utf-8", errors="ignore")
        self.assertNotIn("Traceback", body1)
        self.assertNotIn("Exception", body1)

        # 2. Garbage bytes khong hop le UTF-8
        garbage = b"\xff\xfe\x80\x81\x00\x01\x82\x90\xaa"
        resp2 = self.client.post(
            "/api/save-score",
            data=garbage,
            content_type="application/x-www-form-urlencoded"
        )
        self.assertNotEqual(resp2.status_code, 500)
        body2 = resp2.data.decode("utf-8", errors="ignore")
        self.assertNotIn("Traceback", body2)
        self.assertNotIn("Exception", body2)

    def test_server_error_500_response_body_is_exactly_err(self):
        """Khi xay ra loi 500 (commit that bai), body tra ve phai dung bang 'ERR', khong lo traceback."""
        _, class_id, student_id = self._create_teacher_school_class_student()

        payload = {
            "class_id": str(class_id),
            "student_id": str(student_id),
            "pc_name": "PC01",
            "sp": "80",
            "ut": "600",
            "lt": "OT01"
        }

        with patch.object(db_session, "commit", side_effect=RuntimeError("Database failure simulation")):
            resp = self.client.post("/api/save-score", data=payload)
            self.assertEqual(resp.status_code, 500)
            self.assertEqual(resp.data.decode("utf-8"), "ERR")


if __name__ == "__main__":
    unittest.main()
