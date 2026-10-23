"""Kiem thu TaoDeThi tren de thi that.

  IC3_DE_MAU   thu muc chua cac file GS6*.exe goc. Khong co thi cac ca can de that bi bo qua.
  IC3_OLD_PATCH  (tuy chon) duong dan scripts/patch_sameshow_exe.py cua ic3-manager, de doi chieu tung byte voi
                 script cu da duoc thu that tren Flash.

    python -B -m unittest tests.test_taodethi -v
"""
import glob
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools', 'taodethi'))
import taodethi as t  # noqa: E402

SAMPLES = os.environ.get('IC3_DE_MAU', '')
OLD_PATCH = os.environ.get('IC3_OLD_PATCH', '')


def _read(path):
    with open(path, 'rb') as f:
        return f.read()


def _originals():
    return sorted(p for p in glob.glob(os.path.join(SAMPLES, '*.exe')) if not p.upper().endswith('_LAN.EXE')) if SAMPLES else []


class RealExams(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = _originals()
        if not cls.files:
            raise unittest.SkipTest('khong co IC3_DE_MAU')

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='taodethi_')
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def test_matches_old_script_byte_for_byte(self):
        """Ban moi phai cho ket qua giong het script cu (da thu that: nop bai thi diem ve may giao vien)."""
        if not OLD_PATCH or not os.path.isfile(OLD_PATCH):
            self.skipTest('khong co IC3_OLD_PATCH')
        import importlib.util
        spec = importlib.util.spec_from_file_location('old_patch', OLD_PATCH)
        old = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(old)
        for src in self.files:
            data = _read(src)
            self.assertEqual(t.patch(data), old.patch(data), os.path.basename(src))

    def test_original_untouched_and_output_verified(self):
        for src in self.files:
            work = os.path.join(self.tmp, os.path.basename(src))
            shutil.copy(src, work)
            before = _read(work)
            status, msg, out = t.process(work)
            self.assertEqual(status, 'DA TAO', msg)
            self.assertEqual(_read(work), before)
            t.verify(before, _read(out))

    def test_batch_mixed_inputs_does_not_stop(self):
        a, b = self.files[0], self.files[-1]
        d = os.path.join(self.tmp, 'in')
        os.makedirs(d)
        shutil.copy(a, d)
        shutil.copy(b, d)
        junk = os.path.join(d, 'khong_phai_de.exe')
        with open(junk, 'wb') as f:
            f.write(b'MZ' + b'\0' * 200)
        text = os.path.join(d, 'ghi_chu.exe')
        with open(text, 'wb') as f:
            f.write(b'hello')
        lines = []
        res = t.run(t.expand([d]), out=lines.append)
        st = {name: s for name, s, _ in res}
        self.assertEqual(st['khong_phai_de.exe'], 'BO QUA')
        self.assertEqual(st['ghi_chu.exe'], 'BO QUA')
        self.assertEqual(sum(1 for s in st.values() if s == 'DA TAO'), len(set([os.path.basename(a), os.path.basename(b)])))

    def test_already_lan_is_skipped(self):
        src = self.files[0]
        work = os.path.join(self.tmp, os.path.basename(src))
        shutil.copy(src, work)
        _, _, out = t.process(work)
        status, _, outp = t.process(out)
        self.assertEqual(status, 'BO QUA')
        self.assertIsNone(outp)

    def test_out_dir_collisions_get_unique_names(self):
        src = self.files[0]
        a = os.path.join(self.tmp, 'a')
        b = os.path.join(self.tmp, 'b')
        for d in (a, b):
            os.makedirs(d)
            shutil.copy(src, d)
        outdir = os.path.join(self.tmp, 'out')
        res = t.run([os.path.join(a, os.path.basename(src)), os.path.join(b, os.path.basename(src))], out_dir=outdir, out=lambda s: None)
        self.assertEqual([s for _, s, _ in res], ['DA TAO', 'DA TAO'])
        self.assertEqual(len(os.listdir(outdir)), 2)


class NoSampleNeeded(unittest.TestCase):
    def test_garbage_is_skipped_not_crashed(self):
        for blob in (b'', b'MZ', b'hello world', b'MZ' + b'\0' * 64, os.urandom(4096)):
            with self.assertRaises(t.PatchError):
                t.patch(blob)

    def test_missing_file_reports_error(self):
        status, _, out = t.process(os.path.join(tempfile.gettempdir(), 'khong_co_file_nay.exe'))
        self.assertEqual(status, 'LOI')
        self.assertIsNone(out)


if __name__ == '__main__':
    unittest.main()
