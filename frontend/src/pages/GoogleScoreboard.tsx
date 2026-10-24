import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGsheetTabs, fetchGsheet } from '../api';
import './css/GoogleScoreboard.css';

interface GSheetStudent {
  [key: string]: any;
}

const THRESHOLDS: any = {
  6: { normal: { G: 41, K: 35, TB: 23 }, ot5: { G: 30, K: 25, TB: 17 } },
  7: { normal: { G: 41, K: 35, TB: 23 }, ot5: { G: 30, K: 25, TB: 17 } },
  8: { normal: { G: 36, K: 30, TB: 20 }, ot5: { G: 26, K: 22, TB: 14 } }
};

const SCORE_KEYS = ['Điểm OT1','Điểm OT2','Điểm OT3','Điểm OT4','Điểm OT5','SL HT TH','FLA GM1','FLA GM2','GMT1','GMT2'];
const SCORE_LABELS = ['OT1','OT2','OT3','OT4','OT5','SL HT','FLA GM1','FLA GM2','GMT1','GMT2'];

const GoogleScoreboard: React.FC = () => {
  const [tabs, setTabs] = useState<string[]>([]);
  const [currentClass, setCurrentClass] = useState<string>('');
  const [currentData, setCurrentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tabCache, setTabCache] = useState<{ [tab: string]: any }>({});
  
  // Filtering & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [detailCollapsed, setDetailCollapsed] = useState(false);

  // Grouped tabs for sidebar
  const [openGrades, setOpenGrades] = useState<{ [grade: string]: boolean }>({ '7': true });

  // Toast
  const [toastShow, setToastShow] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchTabs();
  }, []);

  const fetchTabs = async () => {
    try {
      const res = await getGsheetTabs();
      setTabs(res.data.tabs || []);
    } catch (err) {
      console.error('Error fetching Google Sheet tabs:', err);
      showToast('Không thể kết nối API Google Sheets');
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2500);
  };

  const getGradeNum = (cls: string) => {
    const num = parseInt(cls.charAt(0));
    return isNaN(num) ? 7 : num;
  };

  const classify = (score: any, colName: string) => {
    if (score === '' || score === null || score === undefined) return null;
    const s = parseFloat(score);
    if (isNaN(s)) return null;

    const gradeNum = getGradeNum(currentClass);
    const th = THRESHOLDS[gradeNum] || THRESHOLDS[7];
    const isOT5 = colName.toUpperCase().includes('OT5');
    const t = isOT5 ? th.ot5 : th.normal;

    if (s >= t.G) return 'G';
    if (s >= t.K) return 'K';
    if (s >= t.TB) return 'TB';
    return 'Y';
  };

  const worstGrade = (st: GSheetStudent) => {
    let worst: string | null = null;
    const ord: any = { Y: 1, TB: 2, K: 3, G: 4 };
    
    SCORE_KEYS.forEach(k => {
      const val = st[k];
      const g = classify(val, k);
      if (g) {
        if (!worst || ord[g] < ord[worst]) {
          worst = g;
        }
      }
    });
    return worst;
  };

  const loadClass = async (cls: string, force = false) => {
    if (!cls) return;
    
    setCurrentClass(cls);
    setSelectedIdx(null);
    setSearchQuery('');
    setActiveFilter(null);

    if (!force && tabCache[cls]) {
      setCurrentData(tabCache[cls]);
      return;
    }

    setLoading(true);
    setCurrentData(null);

    try {
      const res = await fetchGsheet(cls);
      if (res.data.error) {
        showToast(res.data.error);
        return;
      }
      
      const newCache = { ...tabCache, [cls]: res.data };
      setTabCache(newCache);
      setCurrentData(res.data);
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const toggleGrade = (grade: string) => {
    setOpenGrades(prev => ({
      ...prev,
      [grade]: !prev[grade]
    }));
  };

  // Group tabs by grade
  const gradeGroups: { [grade: string]: string[] } = {};
  tabs.forEach(tab => {
    const match = tab.match(/^\d+/);
    const g = match ? match[0] : 'Khác';
    if (!gradeGroups[g]) gradeGroups[g] = [];
    gradeGroups[g].push(tab);
  });

  // Calculate statistics
  const getStats = () => {
    if (!currentData || !currentData.students) return { total: 0, scored: 0, avg: '—', counts: { G: 0, K: 0, TB: 0, Y: 0 } };
    
    const sts = currentData.students;
    const counts = { G: 0, K: 0, TB: 0, Y: 0 };
    let scored = 0;
    let totalScore = 0;
    let scoreCount = 0;

    sts.forEach((st: any) => {
      const wg = worstGrade(st);
      if (wg) {
        (counts as any)[wg]++;
        scored++;
      }
      SCORE_KEYS.forEach(k => {
        const v = parseFloat(st[k]);
        if (!isNaN(v)) {
          totalScore += v;
          scoreCount++;
        }
      });
    });

    return {
      total: sts.length,
      scored,
      avg: scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : '—',
      counts
    };
  };

  const stats = getStats();

  const getFilteredStudents = () => {
    if (!currentData || !currentData.students) return [];
    
    return currentData.students.map((st: any, idx: number) => {
      const name = `${st['HỌ'] || ''} ${st['TÊN'] || ''}`.trim();
      const wg = worstGrade(st) || '';
      return {
        ...st,
        _fullName: name,
        _worstGrade: wg,
        _index: idx
      };
    }).filter((st: any) => {
      const matchQuery = st._fullName.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchFilter = !activeFilter || st._worstGrade === activeFilter;
      return matchQuery && matchFilter;
    });
  };

  const filteredStudents = getFilteredStudents();

  // Selected student details
  const selectedStudent = selectedIdx !== null && currentData?.students ? currentData.students[selectedIdx] : null;

  return (
    <div className="google-scoreboard-page" style={{ background: 'var(--gray-100)', minHeight: '100vh', position: 'relative' }}>
      
      {/* TOPBAR */}
      <div className="topbar">
        <a href="/" className="logo-badge" title="Về trang chủ">IC3</a>
        <div className="page-title">
          📊 Bảng Điểm Online
          <span className="sub">Google Sheets</span>
        </div>
        <div className="sep"></div>

        <button 
          className="btn" 
          onClick={() => loadClass(currentClass, true)} 
          disabled={!currentClass || loading}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style={{ marginRight: '6px' }}>
            <path d="M4 10a6 6 0 1 0 1.6-4" strokeLinecap="round"/>
            <path d="M4 4v3h3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Làm mới
        </button>
        <Link to="/" className="btn">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style={{ marginRight: '6px' }}>
            <path d="M13 4L7 10l6 6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Trang chủ
        </Link>

        <div className="spacer"></div>
        {currentData?.timestamp && (
          <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 600 }}>
            🕐 Cập nhật: {currentData.timestamp}
          </span>
        )}
      </div>

      {/* LAYOUT CONTAINER */}
      <div className="layout">

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sb-section">
            <div className="sb-title">Chọn lớp học</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.keys(gradeGroups).sort().map(grade => {
                const isOpen = openGrades[grade];
                const classes = gradeGroups[grade];
                return (
                  <div className="grade-group" key={grade}>
                    <div className={`grade-header ${isOpen ? 'open' : ''}`} onClick={() => toggleGrade(grade)}>
                      <span className="grade-dot"></span>
                      Khối {grade}
                      <span className="grade-count">{classes.length} lớp</span>
                      <span className="grade-arrow">▶</span>
                    </div>
                    <div className={`grade-classes ${isOpen ? 'open' : ''}`} style={{ display: isOpen ? 'block' : 'none' }}>
                      {classes.map(c => (
                        <button 
                          key={c}
                          className={`class-btn ${currentClass === c ? 'active' : ''}`}
                          onClick={() => loadClass(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONTENT VIEW */}
        <div className="content">
          
          {/* Empty State */}
          {!currentClass && (
            <div className="state">
              <div className="state-icon">📋</div>
              <h2>Chọn một lớp để xem điểm</h2>
              <p>Sử dụng danh sách bên trái để chọn khối và lớp.</p>
            </div>
          )}

          {/* Loading State */}
          {loading && <div style={{ width: '100%', minHeight: '60vh', background: 'var(--bg-color)' }} />}

          {/* Score content */}
          {currentClass && !loading && currentData && (
            <>
              {/* Stats chip bar */}
              <div className="stats-bar">
                <div className="stat-chip blue">
                  <div className="stat-num">{stats.total}</div>
                  <div className="stat-lbl">Học sinh</div>
                </div>
                <div className="stat-chip green">
                  <div className="stat-num">{stats.scored}</div>
                  <div className="stat-lbl">Có điểm</div>
                </div>
                <div className="stat-chip amber">
                  <div className="stat-num">{stats.avg}</div>
                  <div className="stat-lbl">Điểm TB</div>
                </div>

                {/* Distribution Filter Pills */}
                <div className="dist-mini">
                  <div 
                    className={`dist-pill dg ${activeFilter === 'G' ? 'active' : ''}`}
                    onClick={() => setActiveFilter(activeFilter === 'G' ? null : 'G')}
                  >
                    <span className="dot"></span>Giỏi {stats.counts.G}
                  </div>
                  <div 
                    className={`dist-pill dk ${activeFilter === 'K' ? 'active' : ''}`}
                    onClick={() => setActiveFilter(activeFilter === 'K' ? null : 'K')}
                  >
                    <span className="dot"></span>Khá {stats.counts.K}
                  </div>
                  <div 
                    className={`dist-pill dtb ${activeFilter === 'TB' ? 'active' : ''}`}
                    onClick={() => setActiveFilter(activeFilter === 'TB' ? null : 'TB')}
                  >
                    <span className="dot"></span>TB {stats.counts.TB}
                  </div>
                  <div 
                    className={`dist-pill dy ${activeFilter === 'Y' ? 'active' : ''}`}
                    onClick={() => setActiveFilter(activeFilter === 'Y' ? null : 'Y')}
                  >
                    <span className="dot"></span>Yếu {stats.counts.Y}
                  </div>
                </div>
              </div>

              {/* Filtering Toolbar */}
              <div className="toolbar">
                <div className="search-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input 
                    type="text" 
                    placeholder="Tìm học sinh..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  className="btn" 
                  onClick={() => setDetailCollapsed(!detailCollapsed)}
                  style={{ marginLeft: 'auto' }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="14" height="14" rx="2"/>
                    <path d="M12 3v14" strokeLinecap="round"/>
                  </svg>
                  {detailCollapsed ? 'Hiện Chi tiết' : 'Ẩn Chi tiết'}
                </button>
              </div>

              {/* TABLE CONTAINER */}
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>STT</th>
                      <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Họ và tên</th>
                      <th>Vị trí</th>
                      {SCORE_KEYS.map((k, idx) => (
                        <th key={k}>{SCORE_LABELS[idx]}</th>
                      ))}
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st: any) => {
                      const status = st['Trạng thái'] || st['TRẠNG THÁI'] || '';
                      
                      let statusCls = 'sbadge-na';
                      if (status) {
                        const sl = status.toLowerCase();
                        if (sl.includes('đủ điều kiện') || sl.includes('du dieu kien')) statusCls = 'sbadge-g';
                        else if (sl.includes('bồi dưỡng') || sl.includes('boi duong')) statusCls = 'sbadge-tb';
                        else if (sl.includes('chưa') || sl.includes('chua')) statusCls = 'sbadge-y';
                      }

                      return (
                        <tr 
                          key={st._index} 
                          className={st._index === selectedIdx ? 'sel' : ''}
                          onClick={() => setSelectedIdx(st._index)}
                        >
                          <td className="stt-cell">{st['STT'] || st._index + 1}</td>
                          <td className="name-cell">{st._fullName || <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>—</span>}</td>
                          <td style={{ textAlign: 'center' }}>
                            {st['VỊ TRÍ'] ? <span className="pc-badge">{st['VỊ TRÍ']}</span> : <span className="pc-badge empty">—</span>}
                          </td>
                          
                          {/* Score Cells */}
                          {SCORE_KEYS.map(k => {
                            const val = st[k];
                            const g = classify(val, k);
                            return (
                              <td key={k} style={{ textAlign: 'center' }}>
                                {g ? (
                                  <span className={`sbadge sbadge-${g.toLowerCase()}`}>{val}</span>
                                ) : (
                                  <span className="sbadge sbadge-na">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Status Cell */}
                          <td style={{ textAlign: 'center' }}>
                            {status ? (
                              <span className={`status-chip ${statusCls}`}>{status}</span>
                            ) : (
                              <span style={{ color: 'var(--gray-500)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={SCORE_KEYS.length + 4} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                          Không tìm thấy học sinh phù hợp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* DETAILS PANEL (RIGHT) */}
        <div className={`detail-panel ${detailCollapsed ? 'collapsed' : ''}`} style={{ display: currentClass ? 'block' : 'none' }}>
          <div className="dp-section">
            <div className="dp-title">Chi tiết học sinh</div>
            {selectedStudent ? (
              <div>
                <div className="avatar">
                  {String(selectedStudent['TÊN'] || '?').charAt(0).toUpperCase()}
                </div>
                <div className="dp-name">
                  {`${selectedStudent['HỌ'] || ''} ${selectedStudent['TÊN'] || ''}`.trim() || '—'}
                </div>
                <div className="dp-sub">
                  Lớp {currentClass} · {selectedStudent['VỊ TRÍ'] || 'Chưa xếp máy'}
                </div>
                <div style={{ marginTop: '14px' }}>
                  <div className="dp-row">
                    <span className="dp-lbl">Trạng thái</span>
                    <span className="dp-val">{selectedStudent['Trạng thái'] || selectedStudent['TRẠNG THÁI'] || '—'}</span>
                  </div>
                  <div className="dp-row">
                    <span className="dp-lbl">Ghi chú</span>
                    <span className="dp-val">{selectedStudent['Ghi chú buổi học'] || selectedStudent['GHI CHÚ'] || '—'}</span>
                  </div>
                  <div className="dp-row">
                    <span className="dp-lbl">Số lần HT thực hành</span>
                    <span className="dp-val">{selectedStudent['SL HT TH'] || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dp-empty">Nhấn vào một học sinh trong bảng để xem chi tiết.</div>
            )}
          </div>

          {selectedStudent && (
            <div className="dp-section">
              <div className="dp-title">Bảng điểm chi tiết</div>
              <div className="score-grid">
                {SCORE_KEYS.map((k, idx) => {
                  const val = selectedStudent[k];
                  if (val === '' || val === null || val === undefined) return null;
                  const g = classify(val, k);
                  const color = g === 'G' ? 'var(--green)' : g === 'K' ? 'var(--blue)' : g === 'TB' ? 'var(--amber)' : 'var(--red)';
                  return (
                    <div className="score-card" key={k}>
                      <div className="sc-label">{SCORE_LABELS[idx]}</div>
                      <div className="sc-val" style={{ color }}>{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* TOAST MESSAGE */}
      <div className={`toast ${toastShow ? 'show' : ''}`}>{toastMsg}</div>

    </div>
  );
};

export default GoogleScoreboard;
