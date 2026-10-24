import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getExcelData, saveExcelData } from '../api';

const EXCEL_GREEN = '#217346';
const EXCEL_BG = '#f3f3f3';
const EXCEL_SELECT = 'rgba(33, 115, 70, 0.15)';

const COL_HEADERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'];

const ExcelInput: React.FC = () => {
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [grid, setGrid] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  
  // Selection states
  const [focusedCell, setFocusedCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [isAllSelected, setIsAllSelected] = useState(false);
  
  // Toast notifications
  const [toastShow, setToastShow] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [timestamp, setTimestamp] = useState('—');

  // Input refs for keyboard navigation
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (lop?: string) => {
    setLoading(true);
    try {
      const res = await getExcelData(lop);
      if (res.data.status === 'success') {
        setClasses(res.data.classes || []);
        setSelectedClass(res.data.selectedClass || '');
        setGrid(res.data.grid || []);
        setTimestamp(res.data.timestamp || '—');
        
        // Reset selections
        setFocusedCell(null);
        setSelectedRow(null);
        setSelectedCol(null);
        setIsAllSelected(false);
      }
    } catch (err) {
      console.error(err);
      showToast('Không thể kết nối máy chủ để tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2500);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    // Row 0 is header row, don't allow modifying
    if (r === 0) return;
    
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = val;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!selectedClass) {
      showToast('Chưa chọn lớp!');
      return;
    }
    
    setLoading(true);
    try {
      const res = await saveExcelData(selectedClass, grid);
      if (res.data.status === 'success') {
        showToast(`💾 Đã lưu sổ điểm lớp ${selectedClass}!`);
        // Refresh to fetch any recalculated stats or sync names
        fetchData(selectedClass);
      } else {
        showToast('Lỗi lưu sổ điểm');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kết nối lưu dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      setIsAllSelected(true);
      setSelectedRow(null);
      setSelectedCol(null);
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      setGrid(prev => {
        return prev.map((row, rowIdx) => {
          if (rowIdx === 0) return row; // Keep header row intact
          return row.map((cell, colIdx) => {
            const isSel = isAllSelected || 
                          (selectedRow === rowIdx) || 
                          (selectedCol === colIdx) ||
                          (focusedCell?.r === rowIdx && focusedCell?.c === colIdx);
            return isSel ? '' : cell;
          });
        });
      });
      return;
    }

    let targetR = r;
    let targetC = c;

    if (e.key === 'ArrowRight') targetC = Math.min(c + 1, 17);
    else if (e.key === 'ArrowLeft') targetC = Math.max(c - 1, 0);
    else if (e.key === 'ArrowDown') targetR = Math.min(r + 1, 59);
    else if (e.key === 'ArrowUp') targetR = Math.max(r - 1, 0);
    else return;

    e.preventDefault();
    setIsAllSelected(false);
    setSelectedRow(null);
    setSelectedCol(null);
    setFocusedCell({ r: targetR, c: targetC });

    const nextRef = inputRefs.current[`${targetR}-${targetC}`];
    if (nextRef) {
      nextRef.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent, startR: number, startC: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/);
    
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      
      lines.forEach((line, i) => {
        if (!line.trim() && i === lines.length - 1) return;
        const columns = line.split('\t');
        
        columns.forEach((val, j) => {
          const r = startR + i;
          const c = startC + j;
          // Stay within limits, and do not modify header row
          if (r > 0 && r < 60 && c >= 0 && c < 18) {
            copy[r][c] = val.trim();
          }
        });
      });
      
      return copy;
    });

    showToast('Đã dán dữ liệu thành công');
  };

  const selectRowHeader = (r: number) => {
    setIsAllSelected(false);
    setSelectedCol(null);
    if (selectedRow === r) {
      setSelectedRow(null);
    } else {
      setSelectedRow(r);
      const firstRef = inputRefs.current[`${r}-0`];
      if (firstRef) firstRef.focus();
    }
  };

  const selectColHeader = (c: number) => {
    setIsAllSelected(false);
    setSelectedRow(null);
    if (selectedCol === c) {
      setSelectedCol(null);
    } else {
      setSelectedCol(c);
      const firstRef = inputRefs.current[`1-${c}`];
      if (firstRef) firstRef.focus();
    }
  };

  const isCellSelectedVisual = (r: number, c: number) => {
    if (r === 0) return false;
    if (isAllSelected) return true;
    if (selectedRow === r) return true;
    if (selectedCol === c) return true;
    return false;
  };

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: '#eef2f7',
      minHeight: '100vh',
      padding: '15px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      
      {/* EXCEL BOX */}
      <div style={{
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '92vh',
        overflow: 'hidden'
      }}>
        
        {/* TOP CONTROLS */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ margin: 0, color: EXCEL_GREEN, fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💚 Excel Online: Nhập Điểm Thủ Công
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#444' }}>Lớp:</span> 
              <select 
                value={selectedClass} 
                onChange={(e) => fetchData(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {timestamp !== '—' && (
              <span style={{ fontSize: '13px', color: '#666', fontWeight: 500 }}>
                🕐 {timestamp}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => fetchData(selectedClass)}
              style={{
                background: '#e8f5e9',
                color: EXCEL_GREEN,
                border: `1px solid ${EXCEL_GREEN}`,
                padding: '10px 20px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Tải lại
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              style={{
                background: EXCEL_GREEN,
                color: 'white',
                border: 'none',
                padding: '10px 25px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '15px',
                boxShadow: '0 2px 6px rgba(33,115,70,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              💾 LƯU SỔ ĐIỂM
            </button>
            <Link 
              to="/" 
              style={{
                background: '#eee',
                color: '#444',
                border: '1px solid #ccc',
                padding: '10px 20px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ← Về trang chủ
            </Link>
          </div>
        </div>

        {/* EXCEL WORKSPACE GRID */}
        <div style={{
          overflow: 'auto',
          border: '1px solid #bbb',
          background: '#fff',
          flexGrow: 1,
          position: 'relative'
        }}>
          <table style={{
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            minWidth: '1950px',
            width: '100%'
          }}>
            <thead>
              <tr style={{ height: '26px' }}>
                <th style={{
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 25,
                  background: EXCEL_BG,
                  border: '1px solid #bbb',
                  width: '50px'
                }}></th>
                {COL_HEADERS.map((col, idx) => (
                  <th 
                    key={col} 
                    onClick={() => selectColHeader(idx)}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      background: selectedCol === idx ? '#d2e3fc' : EXCEL_BG,
                      border: '1px solid #bbb',
                      fontSize: '13px',
                      color: '#444',
                      fontWeight: 'normal',
                      cursor: 'pointer',
                      textAlign: 'center',
                      userSelect: 'none'
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, rIdx) => {
                const isHeaderRow = rIdx === 0;
                return (
                  <tr 
                    key={rIdx} 
                    style={{ 
                      height: '38px', 
                      background: isHeaderRow ? '#f2f2f2' : (selectedRow === rIdx ? EXCEL_SELECT : 'transparent') 
                    }}
                  >
                    {/* Row index header */}
                    <td 
                      onClick={() => !isHeaderRow && selectRowHeader(rIdx)}
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 15,
                        background: selectedRow === rIdx ? '#d2e3fc' : EXCEL_BG,
                        border: '1px solid #bbb',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        cursor: 'pointer',
                        color: '#555',
                        fontSize: '13px',
                        userSelect: 'none'
                      }}
                    >
                      {rIdx}
                    </td>

                    {/* Column inputs */}
                    {row.map((cellVal, cIdx) => {
                      const widthClass = cIdx === 1 ? '200px' : cIdx === 2 ? '110px' : (cIdx >= 7 && cIdx <= 11) ? '80px' : cIdx === 5 ? '70px' : cIdx === 17 ? '160px' : '90px';
                      const isVisSelected = isCellSelectedVisual(rIdx, cIdx);
                      
                      return (
                        <td 
                          key={cIdx} 
                          style={{ 
                            border: '1px solid #ddd', 
                            padding: 0,
                            width: widthClass,
                            background: isVisSelected ? EXCEL_SELECT : 'transparent' 
                          }}
                        >
                          <input
                            ref={el => { inputRefs.current[`${rIdx}-${cIdx}`] = el; }}
                            type="text"
                            value={cellVal || ''}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                            onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                            onFocus={() => setFocusedCell({ r: rIdx, c: cIdx })}
                            disabled={isHeaderRow && rIdx === 0}
                            spellCheck={false}
                            autoComplete="off"
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              outline: 'none',
                              padding: '0 10px',
                              fontSize: isHeaderRow ? '14px' : '15px',
                              fontWeight: isHeaderRow ? 'bold' : 'normal',
                              textAlign: isHeaderRow || (cIdx >= 7 && cIdx <= 11) ? 'center' : 'left',
                              color: isHeaderRow ? '#000' : '#222',
                              background: 'transparent',
                              boxSizing: 'border-box',
                              cursor: 'cell',
                              position: 'relative'
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* TOAST MESSAGE */}
      <div 
        style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#202124',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '30px',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 9999,
          opacity: toastShow ? 1 : 0,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'opacity 0.3s ease'
        }}
      >
        {toastMsg}
      </div>

    </div>
  );
};

export default ExcelInput;
