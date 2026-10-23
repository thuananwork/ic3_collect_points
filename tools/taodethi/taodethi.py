#!/usr/bin/env python3
"""TaoDeThi: keo file de thi .exe (Sameshow/Flash) vao day, tao ra file *_LAN.exe cho hoc sinh lam bai.

Cach dung:
  * Keo mot hay nhieu file de (hoac ca thu muc) tha len bieu tuong TaoDeThi.exe.
  * Hoac mo TaoDeThi.exe khong tham so de chon file trong hop thoai.
  * Dong lenh: TaoDeThi.exe [--out-dir THU_MUC] [--no-pause] file1.exe file2.exe ...

File *_LAN.exe bat luu ket qua bai thi vao bo nho cuc bo cua Flash; script thu diem tren may hoc sinh doc ket qua
do roi gui ve may giao vien. File tao ra KHONG chua dia chi IP. File goc khong bao gio bi sua.
Chi dung thu vien chuan cua Python.
"""
import argparse
import os
import struct
import sys
import tempfile
import zlib

FOOTER_MAGIC = b'\x56\x34\x12\xfa'
SUFFIX = '_LAN'


class PatchError(Exception):
    """Loi co the doc hieu duoc voi tung file; khong lam dung ca dot."""


def _parse(data):
    """Tach goi de ra cac phan. Nem PatchError neu khong phai file Sameshow dang .exe."""
    try:
        if data[:2] != b'MZ':
            raise PatchError('khong phai file .exe cua Windows')
        pe = struct.unpack_from('<I', data, 0x3C)[0]
        if data[pe:pe + 4] != b'PE\0\0':
            raise PatchError('khong phai file .exe cua Windows')
        nsec = struct.unpack_from('<H', data, pe + 6)[0]
        opt = struct.unpack_from('<H', data, pe + 20)[0]
        off, end = pe + 24 + opt, 0
        for i in range(nsec):
            _, _, _, rs, ro = struct.unpack_from('<8sIIII', data, off + i * 40)
            end = max(end, ro + rs)
        start = data.find(b'CWS', end)
        if start == -1 or data[-8:-4] != FOOTER_MAGIC:
            raise PatchError('khong phai bai thi Sameshow/Flash (khong thay goi de ben trong)')
        d = zlib.decompressobj()
        d.decompress(data[start + 8:-8])
        rest = d.unused_data
        swf_len = (len(data) - 8 - start) - len(rest)
        marker = rest.find(b'.quz')
        if marker == -1:
            raise PatchError('khong thay goi .quz trong file')
        marker += 4
        head, pkg = rest[:marker], rest[marker + 4:]
        z = zlib.decompressobj()
        xml = z.decompress(pkg).decode('utf-8')
        blob = z.unused_data
    except PatchError:
        raise
    except (struct.error, zlib.error, UnicodeDecodeError, IndexError):
        raise PatchError('file bi hong hoac khong dung dinh dang bai thi Sameshow')
    return {'start': start, 'swf_len': swf_len, 'head': head, 'xml': xml, 'blob': blob}


def patch(data):
    """Tra ve noi dung file moi (bat localcache). Khong sua `data`."""
    p = _parse(data)
    xml = p['xml']
    if 'localcache="true"' in xml:
        new = xml
    elif 'localcache="false"' in xml:
        new = xml.replace('localcache="false"', 'localcache="true"')
    else:
        raise PatchError('khong thay thuoc tinh localcache trong goi de')
    comp = zlib.compress(new.encode('utf-8'), 9)
    start = p['start']
    overlay = data[start:start + p['swf_len']] + p['head'] + struct.pack('>I', len(comp)) + comp + p['blob']
    return data[:start] + overlay + FOOTER_MAGIC + struct.pack('<I', len(overlay))


def verify(original, patched):
    """Doi chieu file moi voi file goc. Nem PatchError neu co gi khac ngoai co luu ket qua."""
    a, b = _parse(original), _parse(patched)
    if a['start'] != b['start'] or original[:a['start']] != patched[:b['start']]:
        raise PatchError('kiem tra that bai: phan chuong trinh bi thay doi')
    if a['head'] != b['head'] or a['blob'] != b['blob']:
        raise PatchError('kiem tra that bai: noi dung cau hoi bi thay doi')
    if 'localcache="true"' not in b['xml']:
        raise PatchError('kiem tra that bai: chua bat luu ket qua')
    if b['xml'] != a['xml'].replace('localcache="false"', 'localcache="true"'):
        raise PatchError('kiem tra that bai: cau hinh de bi thay doi ngoai y muon')


def output_name(path, out_dir=None, taken=()):
    base = os.path.splitext(os.path.basename(path))[0] + SUFFIX + '.exe'
    folder = out_dir or os.path.dirname(os.path.abspath(path))
    cand = os.path.join(folder, base)
    n = 2
    while out_dir and (cand in taken):
        cand = os.path.join(folder, os.path.splitext(base)[0] + '_%d.exe' % n)
        n += 1
    return cand


def process(path, out_dir=None, taken=()):
    """Xu ly mot file. Tra ve (trang_thai, thong_diep, duong_dan_ra). Khong nem loi ra ngoai."""
    name = os.path.basename(path)
    try:
        if not os.path.isfile(path):
            return 'LOI', 'khong tim thay file', None
        if os.path.splitext(name)[0].upper().endswith(SUFFIX):
            return 'BO QUA', 'da la ban %s, khong vá lai' % SUFFIX, None
        with open(path, 'rb') as f:
            original = f.read()
        patched = patch(original)
        verify(original, patched)
        out = output_name(path, out_dir, taken)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        fd, tmp = tempfile.mkstemp(suffix='.tmp', dir=os.path.dirname(out))
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(patched)
            os.replace(tmp, out)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
        return 'DA TAO', os.path.basename(out), out
    except PatchError as e:
        return 'BO QUA', str(e), None
    except OSError as e:
        return 'LOI', 'khong doc/ghi duoc file (%s)' % (e.strerror or e), None


def expand(args):
    """Thu muc -> cac file .exe ben trong (khong de quy); file giu nguyen."""
    files = []
    for a in args:
        if os.path.isdir(a):
            for n in sorted(os.listdir(a)):
                p = os.path.join(a, n)
                if os.path.isfile(p) and n.lower().endswith('.exe'):
                    files.append(p)
        else:
            files.append(a)
    return files


def run(files, out_dir=None, out=print):
    results, taken = [], set()
    for f in files:
        status, msg, outp = process(f, out_dir, taken)
        if outp:
            taken.add(outp)
        results.append((os.path.basename(f), status, msg))
        out('[%-7s] %s -> %s' % (status, os.path.basename(f), msg))
    made = sum(1 for _, s, _ in results if s == 'DA TAO')
    bad = sum(1 for _, s, _ in results if s == 'LOI')
    out('')
    out('Xong: %d file da tao, %d bo qua, %d loi.' % (made, len(results) - made - bad, bad))
    return results


def _pick_files():
    try:
        import tkinter
        from tkinter import filedialog
        root = tkinter.Tk()
        root.withdraw()
        files = filedialog.askopenfilenames(title='Chon cac file de thi .exe', filetypes=[('Bai thi', '*.exe')])
        root.destroy()
        return list(files)
    except Exception:
        return []


def _gui_report(lines, ok):
    try:
        import tkinter
        from tkinter import messagebox
        root = tkinter.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        (messagebox.showinfo if ok else messagebox.showwarning)('TaoDeThi', '\n'.join(lines))
        root.destroy()
    except Exception:
        pass


def main(argv=None):
    ap = argparse.ArgumentParser(description='Tao file de thi *_LAN.exe cho hoc sinh')
    ap.add_argument('files', nargs='*')
    ap.add_argument('--out-dir', help='gom tat ca file tao ra vao mot thu muc (mac dinh: canh file goc)')
    ap.add_argument('--no-pause', action='store_true', help='khong cho bam phim khi xong')
    ap.add_argument('--cli', action='store_true', help='chay kieu dong lenh (in ra man hinh) thay vi hop thoai')
    a = ap.parse_args(argv)
    gui = not a.cli
    lines = []
    out = print if a.cli else lines.append
    files = expand(a.files) or expand(_pick_files())
    if not files:
        out('Chua co file nao. Hay keo file de thi (.exe) tha len bieu tuong TaoDeThi.exe.')
        code = 2
    else:
        res = run(files, a.out_dir, out)
        code = 1 if any(s == 'LOI' for _, s, _ in res) else 0
    if gui:
        _gui_report(lines or ['Xong.'], code == 0)
    elif not a.no_pause and sys.stdin and sys.stdin.isatty():
        try:
            input('\nBam Enter de dong...')
        except EOFError:
            pass
    return code


if __name__ == '__main__':
    sys.exit(main())
