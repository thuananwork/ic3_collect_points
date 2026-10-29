"""Kiem thu check_release.py: bat duoc cac so suat khi gui ban phat hanh."""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools', 'release'))
import check_release as cr  # noqa: E402


def make_release(root):
    for rel in cr.REQUIRED:
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(b'x')


class CheckRelease(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        make_release(self.root)

    def add(self, rel, data=b'x'):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)

    def test_clean_release_passes(self):
        self.assertEqual(cr.check(self.root), [])

    def test_missing_required_file(self):
        os.remove(os.path.join(self.root, 'TaoDeThi.exe'))
        self.assertTrue(any('TaoDeThi.exe' in p for p in cr.check(self.root)))

    def test_source_and_secrets_are_caught(self):
        for rel in ('src/app.py', 'ui/assets/index.js.map', 'Data/ic3manager.db', 'secrets/signing.key',
                    'account.lic', 'backend/.env', 'tests/test_x.txt'):
            with self.subTest(rel=rel):
                self.add(rel)
                self.assertTrue(cr.check(self.root), rel)
                shutil.rmtree(os.path.join(self.root, rel.split('/')[0]), ignore_errors=True) if '/' in rel else os.remove(os.path.join(self.root, rel))
                make_release(self.root)
                self.assertEqual(cr.check(self.root), [])

    def test_sourcemap_reference_and_private_key_text(self):
        self.add('he_thong/ui/assets/app.js', b'var a=1;\n//# sourceMappingURL=app.js.map')
        self.assertTrue(any('sourceMappingURL' in p for p in cr.check(self.root)))
        self.add('he_thong/ui/assets/app.js', b'ok')
        self.add('he_thong/scripts/x.txt', b'-----BEGIN PRIVATE KEY-----')
        self.assertTrue(any('PRIVATE KEY' in p for p in cr.check(self.root)))

    def test_stray_top_level_file_is_caught(self):
        self.add('README.txt')
        self.assertTrue(any('ngoài cùng' in p for p in cr.check(self.root)))
        os.remove(os.path.join(self.root, 'README.txt'))
        self.assertEqual(cr.check(self.root), [])

    def test_missing_folder(self):
        self.assertTrue(cr.check(os.path.join(self.root, 'khong-co')))


if __name__ == '__main__':
    unittest.main()
