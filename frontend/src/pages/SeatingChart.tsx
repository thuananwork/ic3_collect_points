import React from 'react';
import useSeatingState from '../hooks/useSeatingState';
import '../assets/css/bootstrap.min.css';
import './css/Dashboard.css';
import './css/SeatingCommon.css';

const SeatingChart: React.FC = () => {
  const {
    tenLop,
    loading,
    isChanged,
    presenting,
    showSwapModal,
    showPasteModal,
    swapCandidate,
    pasteData,
    toastShow,
    toastContent,
    toastTitle,
    toastBg,
    activeStudents,
    pcCounts,
    setToastShow,
    setPasteData,
    setShowPasteModal,
    handleNameChange,
    handleMetaChange,
    handlePCChange,
    confirmSwap,
    cancelSwap,
    deleteStudent,
    addNewStudent,
    confirmExcelPaste,
    saveChanges,
    togglePresent,
  } = useSeatingState('seating');

  if (loading) return <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }} />;

  const getByPc = (pcNum: number) => {
    return activeStudents.find(s => s.currentPc === pcNum) || null;
  };

  const rows = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className={`seating-chart-container-page ${presenting ? 'presenting' : ''}`} style={{ background: presenting ? 'var(--white)' : 'var(--gray-100)', height: presenting ? '100vh' : '100%', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div className="header" style={{ display: presenting ? 'none' : 'flex', padding: '8px 20px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, background: 'linear-gradient(90deg, #1557b0, #4285f4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🪑 SƠ ĐỒ CHỖ NGỒI - LỚP {tenLop}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-green" onClick={togglePresent} style={{ padding: '12px 20px', fontSize: '16px' }}>📺 Trình chiếu</button>
          <button
            className="btn btn-primary"
            onClick={saveChanges}
            disabled={!isChanged}
            style={{ padding: '12px 20px', fontSize: '16px' }}
          >
            {isChanged ? '💾 Lưu thay đổi (Có sửa đổi!)' : '💾 Lưu sơ đồ'}
          </button>
        </div>
      </div>

      <div className="main-container" style={{ display: 'flex', gap: '20px', padding: presenting ? '0' : '0 20px 20px 20px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* LEFT PANEL: Student list PC editor */}
        <div className="left-panel" style={{ width: '380px', background: 'var(--white)', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: presenting ? 'none' : 'flex', flexDirection: 'column', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
          <div className="panel-header" style={{ background: 'var(--gray-50)', padding: '12px 15px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px', borderBottom: '1px solid var(--gray-300)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Chỉnh sửa vị trí</span>
              <span style={{ fontSize: '13px', opacity: 0.8 }}>{activeStudents.length} học sinh</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm btn-primary" onClick={addNewStudent} style={{ flex: 1, fontSize: '13px', padding: '6px' }}>➕ Thêm học sinh</button>
              <button className="btn btn-sm btn-green" onClick={() => setShowPasteModal(true)} style={{ flex: 1, fontSize: '13px', padding: '6px' }}>📋 Dán từ Excel</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ minWidth: '480px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="editor-header" style={{ display: 'flex', padding: '10px 15px', background: 'var(--gray-100)', borderBottom: '1px solid var(--gray-300)', fontWeight: 600, fontSize: '13px', color: 'var(--gray-700)' }}>
                <div className="h-name" style={{ flex: 1.8, minWidth: '180px' }}>Họ tên</div>
                <div className="h-pc" style={{ width: '55px', textAlign: 'center', marginRight: '5px' }}>Vị trí</div>
                <div className="h-ot" style={{ flex: 1, minWidth: '95px', textAlign: 'center', marginRight: '5px' }}>Bài làm</div>
                <div className="h-target" style={{ flex: 1, minWidth: '70px', textAlign: 'center', marginRight: '5px' }}>Mục tiêu</div>
                <div style={{ width: '24px' }}></div>
              </div>

              <div className="list-container" style={{ flex: 1, overflowY: 'auto' }}>
                {activeStudents.map((st) => {
                  const isDup = pcCounts[st.currentPc] > 1;
                  const changed = st.currentPc !== st.originalPc || st.currentOt !== st.originalOt || st.currentTarget !== st.originalTarget || st.id.toString().startsWith('new_');

                  let rowBg = 'var(--white)';
                  if (isDup) rowBg = 'rgba(217, 48, 37, 0.12)';
                  else if (changed) rowBg = 'rgba(227, 116, 0, 0.12)';

                  return (
                    <div className="edit-row" style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', padding: '10px 15px', alignItems: 'center', fontSize: '14px', background: rowBg }} key={st.id}>
                      <div className="er-name" style={{ flex: 1.8, minWidth: '180px', paddingRight: '10px' }}>
                        <input
                          type="text"
                          placeholder="Nhập tên HS..."
                          value={st.fullName}
                          onChange={(e) => handleNameChange(st.id, e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid var(--gray-400)', borderRadius: '4px', textAlign: 'left', fontSize: '14px', fontWeight: 500 }}
                        />
                      </div>
                      <div className="er-pc" style={{ width: '55px', marginRight: '5px' }}>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={st.currentPc}
                          onChange={(e) => handlePCChange(st.id, e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid var(--gray-400)', borderRadius: '4px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--blue-dk)' }}
                        />
                      </div>
                      <div className="er-ot" style={{ flex: 1, minWidth: '95px', marginRight: '5px' }}>
                        <input
                          type="text"
                          value={st.currentOt}
                          placeholder="Bài làm"
                          onChange={(e) => handleMetaChange(st.id, e.target.value, 'Ot')}
                          style={{ width: '100%', padding: '6px', border: '1px solid var(--gray-400)', borderRadius: '4px', textAlign: 'center', fontSize: '14px' }}
                        />
                      </div>
                      <div className="er-target" style={{ flex: 1, minWidth: '70px', marginRight: '5px' }}>
                        <input
                          type="text"
                          value={st.currentTarget}
                          placeholder="Mục tiêu"
                          onChange={(e) => handleMetaChange(st.id, e.target.value, 'Target')}
                          style={{ width: '100%', padding: '6px', border: '1px solid var(--gray-400)', borderRadius: '4px', textAlign: 'center', fontSize: '14px' }}
                        />
                      </div>
                      <button className="btn-ix" title="Xóa học sinh này" onClick={() => deleteStudent(st.id)} style={{ padding: '4px 8px', background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Seating Table Layout */}
        <div className="right-panel" style={{ flex: 1, background: 'var(--white)', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', padding: presenting ? '1px' : '20px', border: presenting ? 'none' : '1px solid var(--gray-300)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="table-scroll-wrapper">
            <table className="sodo-table">
              <colgroup>
                {[1, 2, 3].map((section, idx) => (
                  <React.Fragment key={section}>
                    {idx > 0 && <col style={{ width: '3%' }} />}
                    <col style={{ width: presenting ? '20%' : '14%' }} />
                    <col style={{ width: presenting ? '8.5%' : '8%' }} />
                    <col style={{ width: presenting ? '8.5%' : '8%' }} />
                  </React.Fragment>
                ))}
              </colgroup>
              <thead>
                <tr>
                  {[1, 2, 3].map((section, idx) => (
                    <React.Fragment key={section}>
                      {idx > 0 && <th className="col-empty"></th>}
                      <th className="col-ho">Họ</th>
                      <th className="col-ten">Tên</th>
                      <th className="col-pc">Vị trí</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr key={row}>
                      {[0, 1, 2].map((sectionIdx) => {
                        const pcNum = row + 1 + sectionIdx * 20;
                        const student = getByPc(pcNum);

                        return (
                          <React.Fragment key={sectionIdx}>
                            {sectionIdx > 0 && (
                              <td className="col-empty"></td>
                            )}
                            <td
                              className="dp-ho"
                              style={{
                                padding: presenting ? '3px 6px' : '12px 6px',
                                fontWeight: 400,
                              }}
                            >
                              {student ? student.ho : ''}
                            </td>
                            <td
                              className="dp-ten"
                              style={{
                                padding: presenting ? '3px 6px' : '12px 6px',
                                fontWeight: 500,
                              }}
                            >
                              {student ? student.ten : ''}
                            </td>
                            <td
                              className="col-pc"
                              style={{
                                padding: presenting ? '3px 6px' : '12px 6px',
                              }}
                            >
                              PC{String(pcNum).padStart(2, '0')}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FLOAT EXIT FULLSCREEN BUTTON */}
      {presenting && (
        <div id="presentExitBtn" style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 10000 }}>
          <button
            onClick={togglePresent}
            className="present-exit-btn"
          >
            ❌ Thoát
          </button>
        </div>
      )}

      {/* SWAP CONFIRM MODAL */}
      {showSwapModal && (
        <div className="modal-bg open" id="swapModalBg">
          <div className="custom-modal">
            <div className="modal-title">⚠️ Có sự trùng lặp máy!</div>
            <div id="swapModalBody" style={{ fontSize: '15px', lineHeight: 1.5, marginBottom: '20px' }}>
              Máy <b>PC{String(swapCandidate?.newPc).padStart(2, '0')}</b> hiện tại đang có học sinh <b>{swapCandidate?.target?.fullName}</b> ngồi.<br /><br />
              Thầy có muốn <b>Giao hoán (Swap)</b> chỗ của <b>{swapCandidate?.mover?.fullName}</b> và <b>{swapCandidate?.target?.fullName}</b> không?
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={cancelSwap}>Hủy bỏ</button>
              <button className="btn btn-primary" onClick={confirmSwap}>Đồng ý Đổi Chỗ</button>
            </div>
          </div>
        </div>
      )}

      {/* PASTE MODAL */}
      {showPasteModal && (
        <div className="modal-bg open" id="pasteModalBg">
          <div className="custom-modal" style={{ width: '500px' }}>
            <div className="modal-title">Dán dữ liệu từ Excel</div>
            <div style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--gray-700)' }}>
              Dán bảng chứa <b>Tên HS, Vị trí (PC...), Bài làm, Mục tiêu</b>. Hệ thống tự động phân tích.<br />
            </div>
            <textarea
              id="pasteData"
              className="textarea"
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              style={{ height: '150px', fontFamily: 'monospace', padding: '10px', border: '2px solid #ccc', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
              placeholder="Nguyễn Văn A    PC05    OT1    35&#10;Hoặc chỉ cập nhật:&#10;Nguyễn Văn B    OT3    29"
            />
            <div className="modal-foot" style={{ marginTop: '15px' }}>
              <button className="btn" onClick={() => setShowPasteModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={confirmExcelPaste}>Cập nhật vị trí</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST MESSAGE BANNER */}
      {toastShow && (
        <div
          id="toastMsg"
          style={{ display: 'block', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 99999, width: '380px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
        >
          <div className="toast-title" style={{ backgroundColor: toastBg, color: 'white', padding: '0', margin: '0', display: 'flex' }}>
            <div style={{ padding: '14px 20px', fontSize: '18px', fontWeight: 600, flex: 1 }}>
              {toastTitle}
            </div>
            <button onClick={() => setToastShow(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', padding: '14px 20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ background: 'var(--white)', padding: '20px 25px', fontSize: '17px', color: 'var(--gray-900)', textAlign: 'left', borderTop: '1px solid var(--gray-200)' }}>
            <div dangerouslySetInnerHTML={{ __html: toastContent }} />
          </div>
        </div>
      )}

    </div>
  );
};

export default SeatingChart;
