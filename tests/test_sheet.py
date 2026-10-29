"""Kiem thu trang Danh sach (/api/sheet-*).

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
_TEMP_DIR = tempfile.mkdtemp(prefix="ic3_test_sheet_")
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
    WorkstationDB, ScoreDB, UserActiveStateDB, SheetCellDB
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

# Cac duong gui diem chi nhan khi may co account.lic hop le (xem src/routes/auth.py): dung giay phep gia lap trong thu muc tam
import datetime as _dt
from cryptography.hazmat.primitives import serialization as _ser
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey as _Key
from src.utils import licence as _lic

_key = _Key.generate()
_PRIV = _key.private_bytes(_ser.Encoding.Raw, _ser.PrivateFormat.Raw, _ser.NoEncryption())
_PUB = _key.public_key().public_bytes(_ser.Encoding.Raw, _ser.PublicFormat.Raw)
_TEST_MACHINE = "AAAA-BBBB-CCCC-DDDD-EEEE"
_LIC_ROOT = os.path.join(_TEMP_DIR, "licroot")
os.makedirs(_LIC_ROOT, exist_ok=True)
os.environ["IC3_APP_ROOT"] = _LIC_ROOT
os.environ["IC3_STATE_DIR"] = os.path.join(_TEMP_DIR, "state")
_lic.read_pubkey = lambda: _PUB
_lic.machine_code = lambda raw=None: _TEST_MACHINE
_today = _dt.date.today()
with open(os.path.join(_LIC_ROOT, "account.lic"), "wb") as _f:
    _f.write(_lic.sign_licence({
        "v": 1, "product": _lic.PRODUCT, "holder": "Test", "user": "test",
        "pw": _lic.hash_password("test-password"),
        "issued": _today.isoformat(), "expires": (_today + _dt.timedelta(days=30)).isoformat(),
        "machines": [_TEST_MACHINE],
    }, _PRIV))
score_controller.SCORES_PATH = _TEMP_SCORES



class TestSheet(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        db_session.remove()
        engine.dispose()
        shutil.rmtree(_TEMP_DIR, ignore_errors=True)

    def setUp(self):
        db_session.rollback()
        for m in (SheetCellDB, ScoreDB, WorkstationDB, StudentDB, ComputerDB, UserActiveStateDB, ClassDB, SchoolDB):
            db_session.query(m).delete()
        db_session.commit()
        limiter.reset()
        self.c = app.test_client()
        r = self.c.post('/api/auth/login', json={'username': 'test', 'password': 'test-password'})
        self.assertEqual(r.status_code, 200, r.data)
        sc = SchoolDB(user_id=1, school_name="T")
        db_session.add(sc); db_session.flush()
        self.sid = sc.school_id

    def mk(self, grade, name, students):
        cl = ClassDB(user_id=1, class_name=name, academic_year="2026", school_level="Secondary",
                     grade_level=grade, school_id=self.sid)
        db_session.add(cl); db_session.flush()
        ids = []
        for n in students:
            s = StudentDB(class_id=cl.class_id, full_name=n); db_session.add(s); db_session.flush()
            ids.append(s.student_id)
        comp = db_session.query(ComputerDB).filter_by(user_id=1, pc_name="PC01").first()
        if not comp:
            comp = ComputerDB(user_id=1, pc_name="PC01", ip_address="10.0.0.1")
            db_session.add(comp); db_session.flush()
        self.comp = comp.computer_id
        db_session.commit()
        return cl.class_id, ids

    def score(self, cid, sid, code, val):
        db_session.add(ScoreDB(class_id=cid, student_id=sid, computer_id=self.comp,
                               exam_code=code, score_achieved=val))
        db_session.commit()

    def data(self, cid):
        r = self.c.get(f'/api/sheet-data?class_id={cid}')
        self.assertEqual(r.status_code, 200)
        return r.get_json()

    def test_columns_by_grade(self):
        c6, _ = self.mk(6, "6A", ["Nguyen Van An"])
        c7, _ = self.mk(7, "7A", ["Nguyen Van An"])
        d6, d7 = self.data(c6), self.data(c7)
        self.assertEqual(d6['ot_cols'], ['OT1', 'OT2', 'OT3'])
        self.assertEqual(d6['max'], {'OT1': 45, 'OT2': 45, 'OT3': 58})
        self.assertEqual(d7['ot_cols'], ['OT1', 'OT2', 'OT3', 'OT4', 'OT5'])
        self.assertEqual(d7['max']['OT5'], 33)

    def test_name_split_and_auto_best(self):
        cid, (a,) = self.mk(8, "8A", ["Nguyễn Văn An"])
        self.score(cid, a, "OT1", 30); self.score(cid, a, "OT1", 44.5); self.score(cid, a, "OT1", 40)
        self.score(cid, a, "OT9", 10); self.score(cid, a, "GM1", 10)
        st = self.data(cid)['students'][0]
        self.assertEqual((st['ho'], st['ten']), ("Nguyễn Văn", "An"))
        self.assertEqual(st['auto'], {"OT1": 44.5})

    def test_manual_override_and_clear(self):
        cid, (a,) = self.mk(6, "6A", ["Le Binh"])
        self.score(cid, a, "OT1", 20)
        r = self.c.post('/api/sheet-cell', json={'class_id': cid, 'student_id': a, 'col': 'OT1', 'value': '41'})
        self.assertEqual(r.status_code, 200)
        self.c.post('/api/sheet-cell', json={'class_id': cid, 'student_id': a, 'col': 'FLA1', 'value': '7,5'})
        st = self.data(cid)['students'][0]
        self.assertEqual(st['manual'], {'OT1': '41', 'FLA1': '7.5'})
        self.assertEqual(st['auto'], {'OT1': 20})
        self.c.post('/api/sheet-cell', json={'class_id': cid, 'student_id': a, 'col': 'OT1', 'value': ''})
        self.assertEqual(self.data(cid)['students'][0]['manual'], {'FLA1': '7.5'})

    def test_grade6_rejects_ot4(self):
        cid, (a,) = self.mk(6, "6A", ["Le Binh"])
        r = self.c.post('/api/sheet-cell', json={'class_id': cid, 'student_id': a, 'col': 'OT4', 'value': '1'})
        self.assertEqual(r.status_code, 400)

    def test_other_class_student_rejected(self):
        c1, (a,) = self.mk(6, "6A", ["Le Binh"])
        c2, (b,) = self.mk(6, "6B", ["Tran Cuong"])
        r = self.c.post('/api/sheet-cell', json={'class_id': c1, 'student_id': b, 'col': 'OT1', 'value': '1'})
        self.assertEqual(r.status_code, 400)

    def test_batch_is_atomic(self):
        cid, (a,) = self.mk(6, "6A", ["Le Binh"])
        r = self.c.post('/api/sheet-cells', json={'class_id': cid, 'cells': [
            {'student_id': a, 'col': 'OT1', 'value': '5'},
            {'student_id': a, 'col': 'OT5', 'value': '5'}]})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.data(cid)['students'][0]['manual'], {})
        r = self.c.post('/api/sheet-cells', json={'class_id': cid, 'cells': [
            {'student_id': a, 'col': 'OT1', 'value': '5'}, {'student_id': a, 'col': 'GMT2', 'value': '9'}]})
        self.assertEqual(r.get_json()['saved'], 2)

    def test_unknown_class_404_and_classes_list(self):
        self.assertEqual(self.c.get('/api/sheet-data?class_id=999').status_code, 404)
        self.mk(7, "7B", []); self.mk(6, "6A", [])
        cl = self.c.get(f'/api/sheet-classes?school_id={self.sid}').get_json()['classes']
        self.assertEqual([x['class_name'] for x in cl], ["6A", "7B"])

    def test_orphan_cells_purged(self):
        cid, (a,) = self.mk(6, "6A", ["Le Binh"])
        self.c.post('/api/sheet-cell', json={'class_id': cid, 'student_id': a, 'col': 'GMT1', 'value': '3'})
        db_session.query(StudentDB).filter(StudentDB.student_id == a).delete(synchronize_session=False)
        db_session.commit()
        self.data(cid)
        self.assertEqual(db_session.query(SheetCellDB).count(), 0)

    def test_export(self):
        cid, (a, b) = self.mk(6, "6A", ["Le Binh", "Tran An"])
        self.score(cid, a, "OT1", 44)
        r = self.c.get(f'/api/sheet-export?class_id={cid}')
        self.assertEqual(r.status_code, 200)
        t = r.data.decode('utf-8')
        self.assertLess(t.index('An'), t.index('Binh'))
        self.assertIn('SL HT TH', t)
        self.assertIn('<td>44</td>', t)

    def test_export_all_xlsx(self):
        import io, openpyxl
        c1, (a,) = self.mk(6, "6A", ["Le Binh"])
        self.mk(7, "6A", ["Tran An"])  # trung ten sheet
        self.score(c1, a, "OT3", 58)
        r = self.c.get(f'/api/sheet-export-all?school_id={self.sid}')
        self.assertEqual(r.status_code, 200)
        wb = openpyxl.load_workbook(io.BytesIO(r.data))
        self.assertEqual(wb.sheetnames, ["6A", "6A_2"])
        ws = wb["6A"]
        self.assertEqual([c.value for c in ws[1]][:4], ["STT", "HỌ", "TÊN", "OT1"])
        self.assertEqual(ws["B2"].value, "Le"); self.assertEqual(ws["C2"].value, "Binh")
        self.assertEqual(ws["F2"].value, 58); self.assertEqual(ws["G2"].value, 1)
        self.assertEqual(ws["B3"].value, "Số em > 90%"); self.assertEqual(ws["F3"].value, 1)
        self.assertEqual(ws["B4"].value, "Điểm TB"); self.assertEqual(ws["F4"].value, 58)

    def test_copy_same_grade(self):
        c1, (a, b) = self.mk(6, "6A", ["Le Binh", "Tran An"])
        c2, (x,) = self.mk(6, "6B", ["le  binh"])
        c3, _ = self.mk(7, "7A", ["Le Binh"])
        self.c.post('/api/sheet-cells', json={'class_id': c1, 'cells': [
            {'student_id': a, 'col': 'GMT1', 'value': '8'}, {'student_id': b, 'col': 'GMT1', 'value': '9'}]})
        r = self.c.post('/api/sheet-copy', json={'from_class_id': c1, 'to_class_id': c2}).get_json()
        self.assertEqual((r['copied'], r['unmatched']), (1, 1))
        self.assertEqual(self.data(c2)['students'][0]['manual'], {'GMT1': '8'})
        bad = self.c.post('/api/sheet-copy', json={'from_class_id': c1, 'to_class_id': c3})
        self.assertEqual(bad.status_code, 400)


if __name__ == "__main__":
    unittest.main()
