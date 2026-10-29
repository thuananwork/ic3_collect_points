import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, Copy } from 'lucide-react';
import { getInitData, getSheetClasses, getSheetData, saveSheetCells, sheetExportUrl, sheetExportAllUrl, copySheet } from '../api';

interface SheetClass { class_id: number; class_name: string; grade_level: number }
interface SheetStudent {
  student_id: number; ho: string; ten: string;
  auto: Record<string, number>; manual: Record<string, string>;
}
interface SheetData {
  class_id: number; class_name: string; grade_level: number;
  ot_cols: string[]; max: Record<string, number>; students: SheetStudent[];
}

const THRESHOLD = 0.9;
const EXTRA_COLS: { key: string; label: string }[] = [
  { key: 'SLHT', label: 'SL HT TH' },
  { key: 'FLA1', label: 'FLA GMT 1' },
  { key: 'FLA2', label: 'FLA GMT 2' },
  { key: 'GMT1', label: 'GMT 1' },
  { key: 'GMT2', label: 'GMT 2' },
];
const collator = new Intl.Collator('vi');

const toNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const Sheet: React.FC = () => {
  const [classes, setClasses] = useState<SheetClass[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const msgTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((text: string, err = false) => {
    setMsg({ text, err });
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(null), err ? 4000 : 1500);
  }, []);

  // Danh sách lớp của trường đang chọn; tab mặc định = lớp đang chọn
  useEffect(() => {
    (async () => {
      try {
        const schoolId = Number(localStorage.getItem('active_school_id')) || undefined;
        const [cl, init] = await Promise.all([getSheetClasses(schoolId), getInitData().catch(() => null)]);
        const list: SheetClass[] = cl.data.classes || [];
        setClasses(list);
        const activeName = init?.data?.active_class;
        const pick = list.find((c) => c.class_name === activeName) || list[0];
        setActiveId(pick ? pick.class_id : null);
      } catch {
        flash('Không tải được danh sách lớp', true);
      } finally {
        setLoading(false);
      }
    })();
  }, [flash]);

  const load = useCallback(async (id: number) => {
    try {
      const r = await getSheetData(id);
      setData(r.data);
    } catch {
      flash('Không tải được dữ liệu lớp', true);
    }
  }, [flash]);

  useEffect(() => {
    setData(null);
    setSel(null);
    if (activeId) load(activeId);
  }, [activeId, load]);

  // Cột có thể sửa theo thứ tự hiển thị (sau STT, HỌ, TÊN)
  const cols = useMemo(() => {
    if (!data) return [];
    return [...data.ot_cols.map((k) => ({ key: k, label: k })), ...EXTRA_COLS];
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.students].sort(
      (a, b) => collator.compare(a.ten, b.ten) || collator.compare(a.ho, b.ho) || a.student_id - b.student_id
    );
  }, [data]);

  // Giá trị hiển thị & trạng thái từng ô
  const cell = useCallback((st: SheetStudent, key: string) => {
    if (!data) return { value: '', manual: false, hit: false };
    const m = st.manual[key];
    if (key === 'SLHT') {
      if (m !== undefined) return { value: m, manual: true, hit: false };
      let n = 0;
      for (const k of data.ot_cols) {
        const v = toNum(st.manual[k] !== undefined ? st.manual[k] : st.auto[k]);
        if (v !== null && v > data.max[k] * THRESHOLD) n++;
      }
      return { value: n ? String(n) : '', manual: false, hit: false };
    }
    const isOt = data.ot_cols.includes(key);
    const raw = m !== undefined ? m : isOt && st.auto[key] !== undefined ? String(st.auto[key]) : '';
    const v = toNum(raw);
    return { value: raw, manual: m !== undefined, hit: isOt && v !== null && v > data.max[key] * THRESHOLD };
  }, [data]);

  // Thống kê cả lớp: số em trên 90% (cột OT) và điểm trung bình từng cột
  const stats = useMemo(() => {
    if (!data) return [];
    return cols.map((col) => {
      let n = 0, sum = 0, cnt = 0;
      for (const st of rows) {
        const cv = cell(st, col.key);
        const v = toNum(cv.value);
        if (v === null) continue;
        sum += v; cnt++;
        if (cv.hit) n++;
      }
      return {
        key: col.key,
        over: data.ot_cols.includes(col.key) ? String(n) : '',
        avg: cnt ? (Math.round((sum / cnt) * 10) / 10).toString() : '',
      };
    });
  }, [data, cols, rows, cell]);

  const commit = useCallback(async (updates: { student_id: number; col: string; value: string }[]) => {
    if (!data || !updates.length) return;
    const norm = updates.map((u) => ({ ...u, value: u.value.trim().replace(',', '.') }));
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        students: d.students.map((s) => {
          let manual = s.manual;
          for (const u of norm) {
            if (u.student_id !== s.student_id) continue;
            if (manual === s.manual) manual = { ...manual };
            if (u.value === '') delete manual[u.col];
            else manual[u.col] = u.value;
          }
          return manual === s.manual ? s : { ...s, manual };
        }),
      };
    });
    try {
      await saveSheetCells(data.class_id, norm);
      flash('Đã lưu');
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Lưu thất bại', true);
      load(data.class_id);
    }
  }, [data, flash, load]);

  const focusCell = (r: number, c: number) => {
    const el = refs.current[`${r}:${c}`];
    if (el) { el.focus(); el.select(); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const t = e.currentTarget;
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(Math.min(r + 1, rows.length - 1), c); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(Math.max(r - 1, 0), c); }
    else if (e.key === 'Escape') { t.value = cell(rows[r], cols[c].key).value; t.blur(); }
    else if (e.key === 'ArrowLeft' && t.selectionStart === 0 && t.selectionEnd === 0) { e.preventDefault(); focusCell(r, Math.max(c - 1, 0)); }
    else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length) { e.preventDefault(); focusCell(r, Math.min(c + 1, cols.length - 1)); }
  };

  // Dán nhiều ô từ Excel/Google Sheets, bắt đầu từ ô đang chọn
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\r\n]/.test(text.replace(/[\r\n]+$/, ''))) return; // một ô: dán thường
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    const ups: { student_id: number; col: string; value: string }[] = [];
    lines.forEach((line, i) => {
      const st = rows[r + i];
      if (!st) return;
      line.split('\t').forEach((v, j) => {
        const col = cols[c + j];
        if (col) ups.push({ student_id: st.student_id, col: col.key, value: v });
      });
    });
    commit(ups);
  };

  const resetCell = (r: number, c: number) => {
    commit([{ student_id: rows[r].student_id, col: cols[c].key, value: '' }]);
  };

  const exportAll = () => {
    const a = document.createElement('a');
    a.href = sheetExportAllUrl(Number(localStorage.getItem('active_school_id')) || undefined);
    a.click();
  };

  const copyTo = async (toId: number) => {
    if (!data || !toId) return;
    const target = classes.find((c) => c.class_id === toId);
    if (!target) return;
    if (!window.confirm(`Sao chép các ô đã sửa tay của lớp ${data.class_name} sang lớp ${target.class_name}?\nHọc sinh được ghép theo họ tên; ô cùng vị trí ở lớp ${target.class_name} sẽ bị ghi đè.`)) return;
    try {
      const r = await copySheet(data.class_id, toId);
      const d = r.data;
      flash(`Đã sao chép ${d.copied} ô (${d.students} học sinh)${d.unmatched ? `, ${d.unmatched} học sinh không có ở lớp đích` : ''}`);
    } catch (e: any) {
      flash(e?.response?.data?.message || 'Sao chép thất bại', true);
    }
  };

  const exportXls = () => {
    if (!activeId) return;
    const a = document.createElement('a');
    a.href = sheetExportUrl(activeId);
    a.click();
  };

  const border = '1px solid var(--border-color)';
  const head: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2, background: 'var(--card-bg)', borderBottom: '2px solid var(--border-color)',
    borderRight: border, padding: '8px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
    textAlign: 'center', whiteSpace: 'nowrap',
  };
  const readCell: React.CSSProperties = {
    borderRight: border, borderBottom: border, padding: '0 8px', fontSize: 14, color: 'var(--text-primary)',
    background: 'var(--card-bg)', whiteSpace: 'nowrap', height: 32,
  };

  const selCell = sel && rows[sel.r] && cols[sel.c] ? cell(rows[sel.r], cols[sel.c].key) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', padding: '12px 20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, minHeight: 34 }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Danh sách{data ? ` — Lớp ${data.class_name}` : ''}</h2>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Số <b style={{ color: 'var(--primary-color)' }}>in đậm xanh</b> = đã sửa tay (xóa nội dung ô để trở lại điểm tự động) ·
          ô <span style={{ background: 'rgba(5,150,105,.18)', padding: '0 4px', borderRadius: 3 }}>nền xanh lá</span> = trên 90% điểm tối đa
        </span>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.err ? 'var(--danger)' : 'var(--success)' }}>{msg.text}</span>}
        {data && (
          <select value="" onChange={(e) => copyTo(Number(e.target.value))}
            title="Chỉ sao chép được sang lớp cùng khối"
            style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
            <option value="">⧉ Sao chép sang lớp…</option>
            {classes.filter((c) => c.grade_level === data.grade_level && c.class_id !== data.class_id).map((c) => (
              <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
            ))}
          </select>
        )}
        <button className="btn btn-sm" onClick={exportAll} disabled={!classes.length}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Copy size={14} /> Xuất tất cả lớp
        </button>
        <button className="btn btn-sm btn-green" onClick={exportXls} disabled={!activeId}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Xuất Excel
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border, borderRadius: 8, background: 'var(--card-bg)' }}>
        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Đang tải...</div>
        ) : !classes.length ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Trường này chưa có lớp nào. Vào “Chọn lớp” để tạo lớp.</div>
        ) : !data ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Đang tải...</div>
        ) : !rows.length ? (
          <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Lớp chưa có học sinh. Vào “Chỗ ngồi” hoặc “Mục tiêu” để dán danh sách.</div>
        ) : (
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...head, width: 48, minWidth: 48, left: 0, zIndex: 3 }}>STT</th>
                <th style={{ ...head, width: 170, minWidth: 170, textAlign: 'left', left: 48, zIndex: 3 }}>HỌ</th>
                <th style={{ ...head, width: 90, minWidth: 90, textAlign: 'left', left: 218, zIndex: 3 }}>TÊN</th>
                {cols.map((col) => (
                  <th key={col.key} style={{ ...head, minWidth: col.key === 'SLHT' ? 84 : 78 }}>
                    {col.label}
                    {data.max[col.key] !== undefined && (
                      <div style={{ fontSize: 10, fontWeight: 500 }}>/{data.max[col.key]}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((st, r) => (
                <tr key={st.student_id}>
                  <td style={{ ...readCell, textAlign: 'center', color: 'var(--text-secondary)', position: 'sticky', left: 0, zIndex: 1 }}>{r + 1}</td>
                  <td style={{ ...readCell, position: 'sticky', left: 48, zIndex: 1 }}>{st.ho}</td>
                  <td style={{ ...readCell, fontWeight: 600, position: 'sticky', left: 218, zIndex: 1 }}>{st.ten}</td>
                  {cols.map((col, c) => {
                    const cv = cell(st, col.key);
                    const isSel = sel?.r === r && sel?.c === c;
                    return (
                      <td key={col.key} style={{
                        borderRight: border, borderBottom: border, padding: 0, height: 32,
                        background: cv.hit ? 'rgba(5,150,105,.18)' : 'var(--card-bg)',
                        outline: isSel ? '2px solid var(--primary-color)' : 'none', outlineOffset: -2,
                      }}>
                        <input
                          key={`${st.student_id}|${col.key}|${cv.value}`}
                          ref={(el) => { refs.current[`${r}:${c}`] = el; }}
                          defaultValue={cv.value}
                          inputMode="decimal"
                          onFocus={(e) => { setSel({ r, c }); e.target.select(); }}
                          onBlur={(e) => {
                            if (e.target.value.trim() !== cv.value) {
                              commit([{ student_id: st.student_id, col: col.key, value: e.target.value }]);
                            }
                          }}
                          onKeyDown={(e) => onKeyDown(e, r, c)}
                          onPaste={(e) => onPaste(e, r, c)}
                          style={{
                            width: '100%', height: 32, border: 'none', background: 'transparent', outline: 'none',
                            textAlign: 'center', fontSize: 14, color: cv.manual ? 'var(--primary-color)' : 'var(--text-primary)',
                            fontWeight: cv.manual ? 700 : 400,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[{ label: 'Số em > 90%', pick: 'over' as const }, { label: 'Điểm TB', pick: 'avg' as const }].map((row, i) => (
                <tr key={row.pick}>
                  <td colSpan={3} style={{
                    ...readCell, position: 'sticky', left: 0, bottom: i ? 0 : 32, zIndex: 2, fontWeight: 700,
                    textAlign: 'right', background: 'var(--bg-color)', borderTop: i ? undefined : '2px solid var(--border-color)',
                  }}>{row.label}</td>
                  {stats.map((st) => (
                    <td key={st.key} style={{
                      borderRight: border, borderBottom: border, textAlign: 'center', fontWeight: 700, fontSize: 14, height: 32,
                      position: 'sticky', bottom: i ? 0 : 32, zIndex: 1, background: 'var(--bg-color)',
                      borderTop: i ? undefined : '2px solid var(--border-color)',
                      color: row.pick === 'over' ? 'var(--success)' : 'var(--text-primary)',
                    }}>{st[row.pick]}</td>
                  ))}
                </tr>
              ))}
            </tfoot>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, padding: '6px 0', overflowX: 'auto' }}>
        {classes.map((c) => (
          <button key={c.class_id} onClick={() => setActiveId(c.class_id)}
            style={{
              padding: '6px 18px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13,
              borderRadius: '0 0 8px 8px',
              background: c.class_id === activeId ? 'var(--card-bg)' : 'transparent',
              color: c.class_id === activeId ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: c.class_id === activeId ? 700 : 500,
              borderTop: c.class_id === activeId ? '3px solid var(--primary-color)' : '3px solid transparent',
              boxShadow: c.class_id === activeId ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
            }}>
            {c.class_name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {sel && selCell?.manual && (
          <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => resetCell(sel.r, sel.c)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RotateCcw size={13} /> Trả ô về tự động
          </button>
        )}
      </div>
    </div>
  );
};

export default Sheet;
