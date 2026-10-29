"""Trang "Danh sach" (mo phong Google Sheets): moi lop mot tab.

Cot OT1..OT5 tu dien tu diem da nhan (cao nhat moi hoc sinh) va co the sua tay;
cac o sua tay luu trong bang sheet_cells (xoa o = tro lai tu dong).
"""
from decimal import Decimal
from flask import request, jsonify, Response
import re
import time
from html import escape

from src.auth_stub import current_user
from src.config.database import db_session
from src.models.models_db import ClassDB, StudentDB, ScoreDB, SheetCellDB

# Diem toi da tung cot OT theo khoi
OT_MAX = {
    6: {'OT1': 45, 'OT2': 45, 'OT3': 58},
    7: {'OT1': 45, 'OT2': 45, 'OT3': 45, 'OT4': 45, 'OT5': 33},
    8: {'OT1': 45, 'OT2': 45, 'OT3': 45, 'OT4': 45, 'OT5': 28},
}
MANUAL_ONLY = ['FLA1', 'FLA2', 'GMT1', 'GMT2']
ALL_KEYS_EXTRA = ['SLHT'] + MANUAL_ONLY
THRESHOLD = 0.9
MAX_VALUE_LEN = 20


def ot_max_for(grade):
    """Khoi khac 6/7/8 dung cau hinh nhu khoi 8 (5 cot)."""
    return OT_MAX.get(grade) or OT_MAX[8]


def valid_keys(grade):
    return list(ot_max_for(grade).keys()) + ALL_KEYS_EXTRA


def split_name(full_name):
    parts = (full_name or '').split()
    if not parts:
        return '', ''
    return ' '.join(parts[:-1]), parts[-1]


def _my_class(class_id):
    try:
        cid = int(class_id)
    except (TypeError, ValueError):
        return None
    return db_session.query(ClassDB).filter(
        ClassDB.class_id == cid, ClassDB.user_id == int(current_user.id)
    ).first()


def _num(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        v = float(v)
    return int(v) if float(v) == int(v) else round(float(v), 2)


def purge_orphan_cells(class_id):
    """Xoa o nhap tay cua hoc sinh da bi xoa khoi lop (tranh gan nham khi id bi dung lai)."""
    alive = db_session.query(StudentDB.student_id).filter(StudentDB.class_id == class_id)
    db_session.query(SheetCellDB).filter(
        SheetCellDB.class_id == class_id, ~SheetCellDB.student_id.in_(alive)
    ).delete(synchronize_session=False)


def api_sheet_classes():
    school_id = request.args.get('school_id', type=int)
    q = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if school_id:
        q = q.filter(ClassDB.school_id == school_id)
    rows = sorted(q.all(), key=lambda c: (c.grade_level, c.class_name))
    return jsonify({"status": "success", "classes": [
        {"class_id": c.class_id, "class_name": c.class_name, "grade_level": c.grade_level}
        for c in rows]})


def api_sheet_data():
    cls = _my_class(request.args.get('class_id'))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
    max_map = ot_max_for(cls.grade_level)
    purge_orphan_cells(cls.class_id)
    db_session.commit()
    students = db_session.query(StudentDB).filter(StudentDB.class_id == cls.class_id).all()

    best = {}
    scores = db_session.query(ScoreDB).filter(
        ScoreDB.class_id == cls.class_id, ScoreDB.student_id.isnot(None)).all()
    for s in scores:
        code = (s.exam_code or '').upper()
        if code not in max_map:
            continue
        val = _num(s.score_achieved)
        key = (s.student_id, code)
        if key not in best or val > best[key]:
            best[key] = val

    manual = {}
    for c in db_session.query(SheetCellDB).filter(SheetCellDB.class_id == cls.class_id).all():
        manual.setdefault(c.student_id, {})[c.col_key] = c.value

    out = []
    for st in students:
        ho, ten = split_name(st.full_name)
        auto = {k: best[(st.student_id, k)] for k in max_map if (st.student_id, k) in best}
        out.append({"student_id": st.student_id, "ho": ho, "ten": ten,
                    "auto": auto, "manual": manual.get(st.student_id, {})})
    return jsonify({"status": "success", "class_id": cls.class_id, "class_name": cls.class_name,
                    "grade_level": cls.grade_level, "ot_cols": list(max_map.keys()),
                    "max": max_map, "students": out})


def _apply_cell(cls, student_ids, student_id, key, value, keys):
    """Ghi 1 o. Tra ve loi (str) hoac None."""
    if key not in keys:
        return "Cột không hợp lệ cho khối này"
    if student_id not in student_ids:
        return "Học sinh không thuộc lớp"
    value = ('' if value is None else str(value)).strip().replace(',', '.')
    if len(value) > MAX_VALUE_LEN:
        return "Giá trị quá dài"
    row = db_session.query(SheetCellDB).filter(
        SheetCellDB.class_id == cls.class_id, SheetCellDB.student_id == student_id,
        SheetCellDB.col_key == key).first()
    if value == '':
        if row:
            db_session.delete(row)
    elif row:
        row.value = value
    else:
        db_session.add(SheetCellDB(class_id=cls.class_id, student_id=student_id,
                                   col_key=key, value=value))
    return None


def _save(cells_in, class_id):
    cls = _my_class(class_id)
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
    if not isinstance(cells_in, list) or len(cells_in) > 5000:
        return jsonify({"status": "error", "message": "Dữ liệu không hợp lệ"}), 400
    keys = valid_keys(cls.grade_level)
    ids = {r[0] for r in db_session.query(StudentDB.student_id).filter(
        StudentDB.class_id == cls.class_id).all()}
    for c in cells_in:
        try:
            sid = int(c.get('student_id'))
        except (TypeError, ValueError, AttributeError):
            return jsonify({"status": "error", "message": "Dữ liệu không hợp lệ"}), 400
        err = _apply_cell(cls, ids, sid, c.get('col'), c.get('value'), keys)
        if err:
            db_session.rollback()
            return jsonify({"status": "error", "message": err}), 400
    db_session.commit()
    return jsonify({"status": "success", "saved": len(cells_in)})


def api_sheet_cell():
    d = request.get_json(silent=True) or {}
    return _save([d], d.get('class_id'))


def api_sheet_cells():
    d = request.get_json(silent=True) or {}
    return _save(d.get('cells'), d.get('class_id'))


def _fnum(v):
    try:
        return float(str(v).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def build_table(cls):
    """Bang diem cua mot lop: (tieu de, cac dong) giong man hinh Danh sach."""
    max_map = ot_max_for(cls.grade_level)
    students = db_session.query(StudentDB).filter(StudentDB.class_id == cls.class_id).all()
    students.sort(key=lambda s: (split_name(s.full_name)[1].lower(), split_name(s.full_name)[0].lower()))
    best = {}
    for s in db_session.query(ScoreDB).filter(
            ScoreDB.class_id == cls.class_id, ScoreDB.student_id.isnot(None)).all():
        code = (s.exam_code or '').upper()
        if code in max_map:
            v = _num(s.score_achieved)
            if best.get((s.student_id, code), -1) < v:
                best[(s.student_id, code)] = v
    manual = {}
    for c in db_session.query(SheetCellDB).filter(SheetCellDB.class_id == cls.class_id).all():
        manual.setdefault(c.student_id, {})[c.col_key] = c.value

    heads = ['STT', 'HỌ', 'TÊN'] + list(max_map) + ['SL HT TH', 'FLA GMT 1', 'FLA GMT 2', 'GMT 1', 'GMT 2']
    rows = []
    for i, st in enumerate(students, 1):
        ho, ten = split_name(st.full_name)
        m = manual.get(st.student_id, {})
        vals, cnt = [], 0
        for k, mx in max_map.items():
            v = m.get(k)
            if v is None:
                v = best.get((st.student_id, k), '')
            n = _fnum(v)
            if n is not None and n > mx * THRESHOLD:
                cnt += 1
            vals.append(v)
        sl = m.get('SLHT', cnt if cnt else '')
        rows.append([i, ho, ten] + vals + [sl] + [m.get(k, '') for k in MANUAL_ONLY])
    if rows:
        # Hai hang thong ke cuoi bang, giong man hinh Danh sach
        ot_n = len(max_map)
        over, avg = ['', 'Số em > 90%', ''], ['', 'Điểm TB', '']
        for ci in range(3, len(heads)):
            nums = [n for n in (_fnum(r[ci]) for r in rows) if n is not None]
            if ci < 3 + ot_n:
                mx = list(max_map.values())[ci - 3]
                over.append(sum(1 for n in nums if n > mx * THRESHOLD))
            else:
                over.append('')
            avg.append(round(sum(nums) / len(nums), 1) if nums else '')
        rows += [over, avg]
    return heads, rows


def api_sheet_export():
    from urllib.parse import quote
    cls = _my_class(request.args.get('class_id'))
    if not cls:
        return jsonify({"status": "error", "message": "Lớp không tồn tại"}), 404
    heads, rows = build_table(cls)
    h = ['<html><head><meta charset="utf-8"></head><body><table border="1">',
         '<tr>' + ''.join(f'<th>{escape(x)}</th>' for x in heads) + '</tr>']
    for row in rows:
        h.append('<tr>' + ''.join(f'<td>{escape(str(x))}</td>' for x in row) + '</tr>')
    h.append('</table></body></html>')
    fname = f"Danh_Sach_{cls.class_name}.xls".replace(' ', '_')
    return Response(''.join(h), mimetype="application/vnd.ms-excel", headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(fname)}",
        "Cache-Control": "no-cache"})


def _col_letter(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def _sheet_name(name, used):
    base = re.sub(r'[\[\]:*?/\\]', '_', str(name)).strip("'")[:31] or 'Lop'
    cand, k = base, 2
    while cand.lower() in used:
        suffix = f'_{k}'
        cand = base[:31 - len(suffix)] + suffix
        k += 1
    used.add(cand.lower())
    return cand


def build_xlsx(sheets):
    """Tao file .xlsx (nhieu sheet) bang zipfile, khong can thu vien ngoai.
    sheets: [(ten, tieu_de, cac_dong)]"""
    import io
    import zipfile
    names, used = [], set()
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for idx, (name, heads, rows) in enumerate(sheets, 1):
            names.append(_sheet_name(name, used))
            out = [f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet {ns}>',
                   '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
                   '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/>'
                   f'<col min="3" max="3" width="12" customWidth="1"/><col min="4" max="{max(len(heads), 4)}" width="11" customWidth="1"/></cols><sheetData>']
            for r, row in enumerate([heads] + rows, 1):
                out.append(f'<row r="{r}">')
                for c, v in enumerate(row, 1):
                    ref = f'{_col_letter(c)}{r}'
                    if v == '' or v is None:
                        continue
                    num = None if r == 1 else _fnum(v)
                    if num is not None and not isinstance(v, bool):
                        out.append(f'<c r="{ref}"><v>{num:g}</v></c>')
                    else:
                        st = ' s="1"' if r == 1 else ''
                        out.append(f'<c r="{ref}" t="inlineStr"{st}><is><t>{escape(str(v))}</t></is></c>')
                out.append('</row>')
            out.append('</sheetData></worksheet>')
            z.writestr(f'xl/worksheets/sheet{idx}.xml', ''.join(out))
        z.writestr('[Content_Types].xml',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   + ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                             for i in range(1, len(sheets) + 1)) + '</Types>')
        z.writestr('_rels/.rels',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml',
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook {ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                   + ''.join(f'<sheet name="{escape(n, quote=True)}" sheetId="{i}" r:id="rId{i}"/>' for i, n in enumerate(names, 1))
                   + '</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + ''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                             for i in range(1, len(sheets) + 1))
                   + f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        z.writestr('xl/styles.xml',
                   f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet {ns}>'
                   '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                   '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                   '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                   '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                   '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
                   '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    return buf.getvalue()


def api_sheet_export_all():
    from urllib.parse import quote
    school_id = request.args.get('school_id', type=int)
    q = db_session.query(ClassDB).filter(ClassDB.user_id == int(current_user.id))
    if school_id:
        q = q.filter(ClassDB.school_id == school_id)
    classes = sorted(q.all(), key=lambda c: (c.grade_level, c.class_name))
    if not classes:
        return jsonify({"status": "error", "message": "Chưa có lớp nào để xuất"}), 404
    sheets = []
    for cls in classes:
        heads, rows = build_table(cls)
        sheets.append((cls.class_name, heads, rows))
    fname = quote(f"Danh_Sach_Tat_Ca_Lop_{time.strftime('%d-%m-%Y')}.xlsx")
    return Response(build_xlsx(sheets),
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}",
                             "Cache-Control": "no-cache"})


def _norm_name(n):
    return ' '.join((n or '').split()).casefold()


def api_sheet_copy():
    """Sao chep o nhap tay sang lop khac CUNG KHOI, ghep hoc sinh theo ho ten."""
    d = request.get_json(silent=True) or {}
    src, dst = _my_class(d.get('from_class_id')), _my_class(d.get('to_class_id'))
    if not src or not dst or src.class_id == dst.class_id:
        return jsonify({"status": "error", "message": "Lớp không hợp lệ"}), 400
    if src.grade_level != dst.grade_level:
        return jsonify({"status": "error", "message": "Chỉ sao chép được giữa các lớp cùng khối"}), 400
    by_name = {}
    for st in db_session.query(StudentDB).filter(StudentDB.class_id == dst.class_id).all():
        by_name.setdefault(_norm_name(st.full_name), st.student_id)
    src_students = {st.student_id: st for st in
                    db_session.query(StudentDB).filter(StudentDB.class_id == src.class_id).all()}
    keys = valid_keys(dst.grade_level)
    ids = set(by_name.values())
    copied = matched = 0
    seen = set()
    for c in db_session.query(SheetCellDB).filter(SheetCellDB.class_id == src.class_id).all():
        st = src_students.get(c.student_id)
        did = by_name.get(_norm_name(st.full_name)) if st else None
        if did is None:
            continue
        seen.add(did)
        if _apply_cell(dst, ids, did, c.col_key, c.value, keys) is None:
            copied += 1
    db_session.commit()
    return jsonify({"status": "success", "copied": copied, "students": len(seen),
                    "unmatched": max(len(src_students) - len(seen), 0)})
