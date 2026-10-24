import React, { useRef, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';

interface HotspotQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  getMediaUrl: (url?: string) => string;
}

// Helper: normalize zones from options or correct_answer
const getInitialZones = (question: any): Array<{ x: number; y: number; w: number; h: number; is_correct?: boolean }> => {
  if (question.options) {
    if (Array.isArray(question.options) && question.options.some((o: any) => o.x !== undefined)) {
      return question.options.map((o: any) => ({
        ...o,
        is_correct: o.is_correct !== false
      }));
    }
    if (typeof question.options === 'object' && Array.isArray(question.options.zones)) {
      return question.options.zones.map((o: any) => ({
        ...o,
        is_correct: o.is_correct !== false
      }));
    }
  }
  const ca = question.correct_answer;
  if (!ca) return [];
  const list = Array.isArray(ca) ? ca : (ca.x !== undefined ? [ca] : []);
  return list.map((z: any) => ({ ...z, is_correct: true }));
};

const getInitialMode = (question: any, zonesList: any[]): 'click' | 'zone' => {
  if (question.options && typeof question.options === 'object' && question.options.mode) {
    return question.options.mode;
  }
  // Fallback for legacy database entries
  if (zonesList.length > 1) {
    return 'zone';
  }
  return 'click';
};

export const HotspotQuestionEditor: React.FC<HotspotQuestionEditorProps> = ({
  question,
  onChange,
  getMediaUrl
}) => {
  const hotspotImageRef = useRef<HTMLImageElement>(null);
  const [drawingHotspot, setDrawingHotspot] = useState<{ startX: number; startY: number; tempRect?: { x: number; y: number; w: number; h: number } } | null>(null);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [activeDrawType, setActiveDrawType] = useState<'correct' | 'incorrect'>('correct');

  const zones = getInitialZones(question);
  const hotspotMode = getInitialMode(question, zones);

  // Handle Delete/Backspace to delete selected zone
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedZoneIndex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
          return;
        }
        removeZone(selectedZoneIndex);
        setSelectedZoneIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedZoneIndex, zones]);

  // Global mousemove and mouseup listeners to draw rect
  React.useEffect(() => {
    if (!drawingHotspot) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!hotspotImageRef.current) return;
      const rect = hotspotImageRef.current.getBoundingClientRect();
      
      let currentX = ((e.clientX - rect.left) / rect.width) * 100;
      let currentY = ((e.clientY - rect.top) / rect.height) * 100;
      
      currentX = Math.max(0, Math.min(100, currentX));
      currentY = Math.max(0, Math.min(100, currentY));

      const x = Math.min(drawingHotspot.startX, currentX);
      const y = Math.min(drawingHotspot.startY, currentY);
      const w = Math.abs(drawingHotspot.startX - currentX);
      const h = Math.abs(drawingHotspot.startY - currentY);

      setDrawingHotspot(prev => {
        if (!prev) return null;
        return {
          ...prev,
          tempRect: {
            x: parseFloat(x.toFixed(2)),
            y: parseFloat(y.toFixed(2)),
            w: parseFloat(w.toFixed(2)),
            h: parseFloat(h.toFixed(2))
          }
        };
      });
    };

    const handleGlobalMouseUp = () => {
      setDrawingHotspot(prev => {
        if (prev?.tempRect && prev.tempRect.w > 1 && prev.tempRect.h > 1) {
          const newZones = [...zones, { ...prev.tempRect, is_correct: activeDrawType === 'correct' }];
          updateZones(newZones, hotspotMode);
          setSelectedZoneIndex(newZones.length - 1);
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [drawingHotspot, zones, question, onChange, activeDrawType, hotspotMode]);

  // Save options and correct_answer together
  const updateZones = (newZones: any[], mode: 'click' | 'zone') => {
    const correctZones = newZones
      .filter((z: any) => z.is_correct !== false)
      .map((z: any) => ({
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        width: z.w,
        height: z.h
      }));

    onChange({
      ...question,
      options: {
        mode: mode,
        zones: newZones
      },
      correct_answer: correctZones.length > 0 ? (correctZones.length === 1 ? correctZones[0] : correctZones) : null
    });
  };

  const handleModeChange = (newMode: 'click' | 'zone') => {
    updateZones(zones, newMode);
  };

  const toggleZoneCorrectness = (index: number) => {
    const newZones = zones.map((zone, idx) => {
      if (idx === index) {
        return {
          ...zone,
          is_correct: !zone.is_correct
        };
      }
      return zone;
    });
    updateZones(newZones, hotspotMode);
  };

  // Edit coordinates of a zone directly
  const handleZoneCoordinateChange = (index: number, key: 'x' | 'y' | 'w' | 'h', val: number) => {
    const newZones = zones.map((zone, idx) => {
      if (idx === index) {
        const rounded = parseFloat(Math.max(0, Math.min(100, val)).toFixed(1));
        return {
          ...zone,
          [key]: rounded
        };
      }
      return zone;
    });
    updateZones(newZones, hotspotMode);
  };

  const handleHotspotMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!hotspotImageRef.current) return;
    const rect = hotspotImageRef.current.getBoundingClientRect();
    let startX = ((e.clientX - rect.left) / rect.width) * 100;
    let startY = ((e.clientY - rect.top) / rect.height) * 100;
    
    startX = Math.max(0, Math.min(100, startX));
    startY = Math.max(0, Math.min(100, startY));

    setSelectedZoneIndex(null);

    setDrawingHotspot({
      startX,
      startY,
      tempRect: undefined
    });
  };

  const removeZone = (index: number) => {
    const newZones = zones.filter((_, idx) => idx !== index);
    updateZones(newZones, hotspotMode);
  };

  const clearAllZones = () => {
    updateZones([], hotspotMode);
    setSelectedZoneIndex(null);
  };

  const correctZonesCount = zones.filter(z => z.is_correct !== false).length;
  const incorrectZonesCount = zones.filter(z => z.is_correct === false).length;

  return (
    <div style={{ width: '100%', marginBottom: '1rem', fontFamily: 'inherit' }}>
      {!question.image_url ? (
        <div style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
          ⚠️ Vui lòng nhập <strong>Đường dẫn ảnh minh họa</strong> hoặc đính kèm ảnh ở trên trước khi vẽ cấu hình các vùng Hotspot.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Dashboard Panel Header & Switcher */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  🎯 Vẽ & Cấu hình Vùng Chọn Hotspot:
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Hiện có: <span style={{ color: '#22c55e', fontWeight: 700 }}>{correctZonesCount} vùng Đúng</span>, <span style={{ color: '#dc2626', fontWeight: 700 }}>{incorrectZonesCount} vùng Sai</span>.
                </div>
              </div>

              {/* Mode Toggle & Type Switcher (Stacked vertically) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                
                {/* 1. Hotspot Mode selection (Click vs Zone) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                    Loại câu hỏi Hotspot:
                  </span>
                  <div>
                    <select
                      value={hotspotMode}
                      onChange={(e) => handleModeChange(e.target.value as 'click' | 'zone')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#1e293b',
                        cursor: 'pointer',
                        width: '100%',
                        maxWidth: '350px'
                      }}
                    >
                      <option value="click">🎯 Click tự do chọn Điểm (Hotspot Cũ)</option>
                      <option value="zone">🔲 Click chọn Vùng có sẵn (Hotspot Mới)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Mode Selector Button Group (Only relevant/active in Predefined Zones mode) */}
                {hotspotMode === 'zone' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
                      Chế độ vẽ:
                    </span>
                    <div style={{
                      display: 'flex',
                      background: '#e2e8f0',
                      padding: '3px',
                      borderRadius: '8px',
                      gap: '2px',
                      width: 'fit-content'
                    }}>
                      <button
                        type="button"
                        onClick={() => setActiveDrawType('correct')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: activeDrawType === 'correct' ? '#22c55e' : 'transparent',
                          color: activeDrawType === 'correct' ? '#ffffff' : '#475569',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <CheckCircle size={12} /> Vùng ĐÚNG
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setActiveDrawType('incorrect')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: activeDrawType === 'incorrect' ? '#ef4444' : 'transparent',
                          color: activeDrawType === 'incorrect' ? '#ffffff' : '#475569',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <AlertTriangle size={12} /> Vùng SAI
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Workspace Area */}
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'flex-start',
            flexWrap: 'wrap'
          }}>
            {/* Left Workspace: Canvas */}
            <div style={{
              flex: '2 1 500px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              
              {/* Informative Guidance banner */}
              {hotspotMode === 'click' ? (
                <div style={{
                  fontSize: '0.78rem',
                  color: '#2563eb',
                  padding: '8px 12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  🎯 <b>Chế độ Click tự do (Đặt Radar):</b> Học sinh click ở bất cứ điểm nào trên hình để đặt tiêu điểm. Hệ thống tự động kiểm tra xem điểm click đó có nằm trong các vùng đúng khoanh bên dưới không. <i>(Lưu ý: Chỉ cần vẽ các vùng ĐÚNG, các vùng SAI sẽ bị bỏ qua).</i>
                </div>
              ) : (
                <div style={{
                  fontSize: '0.78rem',
                  color: activeDrawType === 'correct' ? '#15803d' : '#b91c1c',
                  padding: '8px 12px',
                  background: activeDrawType === 'correct' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${activeDrawType === 'correct' ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  {activeDrawType === 'correct' 
                    ? '🟢 Hãy kéo thả chuột trên hình để tạo vùng đúng (viền màu xanh lá).' 
                    : '🔴 Hãy kéo thả chuột trên hình để tạo vùng nhiễu (viền màu đỏ nét đứt).'}
                </div>
              )}

              <div
                className="hotspot-image-wrapper"
                onMouseDown={handleHotspotMouseDown}
                style={{
                  position: 'relative',
                  cursor: 'crosshair',
                  display: 'inline-block',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  userSelect: 'none',
                  maxWidth: '100%',
                  backgroundColor: '#f8fafc'
                }}
              >
                <img
                  ref={hotspotImageRef}
                  src={getMediaUrl(question.image_url)}
                  alt="Hotspot Work Area"
                  style={{ display: 'block', maxWidth: '100%', width: 'auto', height: 'auto' }}
                  draggable={false}
                />
                
                {/* Overlay zones */}
                {zones.map((zone, idx) => {
                  const isCorrect = zone.is_correct !== false;
                  const isSelected = selectedZoneIndex === idx;
                  const borderColor = isCorrect ? '#22c55e' : '#ef4444';
                  const bgColor = isCorrect ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.08)';

                  return (
                    <div
                      key={idx}
                      className={`hotspot-rect-overlay ${isSelected ? 'selected' : ''}`}
                      style={{
                        position: 'absolute',
                        border: isSelected ? `2.5px solid ${borderColor}` : `2px dashed ${borderColor}`,
                        background: isSelected ? (isCorrect ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)') : bgColor,
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.w}%`,
                        height: `${zone.h}%`,
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        boxShadow: isSelected ? `0 0 10px ${borderColor}` : 'none',
                        zIndex: isSelected ? 10 : 2,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedZoneIndex(idx);
                      }}
                    >
                      <span style={{
                        fontSize: '9px',
                        background: borderColor,
                        color: 'white',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        fontWeight: 600
                      }}>
                        {isCorrect ? 'ĐÚNG' : 'SAI'} {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeZone(idx);
                          if (isSelected) setSelectedZoneIndex(null);
                        }}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          zIndex: 11
                        }}
                        title="Xóa vùng này"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Temp drawing rect */}
                {drawingHotspot?.tempRect && (
                  <div
                    style={{
                      position: 'absolute',
                      border: '2px dashed #2563eb',
                      background: 'rgba(37, 99, 235, 0.2)',
                      left: `${drawingHotspot.tempRect.x}%`,
                      top: `${drawingHotspot.tempRect.y}%`,
                      width: `${drawingHotspot.tempRect.w}%`,
                      height: `${drawingHotspot.tempRect.h}%`,
                      pointerEvents: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right Workspace: List of zones & Adjust Size inputs */}
            <div style={{
              flex: '1 1 290px',
              display: 'flex',
              flexDirection: 'column',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              boxSizing: 'border-box',
              maxHeight: '450px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Danh sách vùng chọn ({zones.length}):
                </h4>
                {zones.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllZones}
                    style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      background: '#fee2e2',
                      color: '#cc1e1e',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Xóa hết
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {zones.map((zone, originalIdx) => {
                  const isCorrect = zone.is_correct !== false;
                  const isSelected = selectedZoneIndex === originalIdx;
                  const borderCol = isCorrect ? '#22c55e' : '#ef4444';
                  const bgCol = isCorrect ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)';
                  
                  return (
                    <div
                      key={originalIdx}
                      onClick={() => setSelectedZoneIndex(isSelected ? null : originalIdx)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isSelected ? '6px' : '0px',
                        padding: '6px 10px',
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : bgCol,
                        border: isSelected ? '1px solid #3b82f6' : `1px solid ${borderCol}33`,
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Row: classification, index, and quick buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        <span style={{
                          background: borderCol,
                          color: '#fff',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.66rem',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>
                          {isCorrect ? 'ĐÚNG' : 'SAI'}
                        </span>
                        
                        <span style={{ flex: 1, color: '#334155', fontWeight: isSelected ? 700 : 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          Vùng #{originalIdx + 1}: X={zone.x}%, Y={zone.y}%{!isSelected && `, W=${zone.w}%, H=${zone.h}%`}
                        </span>

                        {hotspotMode === 'zone' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleZoneCorrectness(originalIdx);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Đổi loại (Đúng <-> Sai)"
                            onMouseOver={(e) => e.currentTarget.style.color = '#3b82f6'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeZone(originalIdx);
                            if (isSelected) setSelectedZoneIndex(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Xóa vùng này"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Bottom Row: Editable inputs to fine-tune X, Y, Width, Height */}
                      {isSelected && (
                        <div 
                          onClick={(e) => e.stopPropagation()} // prevent toggle select when clicking input fields
                          style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap',
                            gap: '4px 8px',
                            borderTop: '1px dashed #cbd5e1',
                            paddingTop: '6px',
                            marginTop: '2px',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>X:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={zone.x}
                              onChange={(e) => handleZoneCoordinateChange(originalIdx, 'x', parseFloat(e.target.value))}
                              style={{ width: '42px', padding: '1px 2px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>%</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Y:</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={zone.y}
                              onChange={(e) => handleZoneCoordinateChange(originalIdx, 'y', parseFloat(e.target.value))}
                              style={{ width: '42px', padding: '1px 2px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>%</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>W:</span>
                            <input
                              type="number"
                              min={0.1}
                              max={100}
                              step={0.1}
                              value={zone.w}
                              onChange={(e) => handleZoneCoordinateChange(originalIdx, 'w', parseFloat(e.target.value))}
                              style={{ width: '42px', padding: '1px 2px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>%</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>H:</span>
                            <input
                              type="number"
                              min={0.1}
                              max={100}
                              step={0.1}
                              value={zone.h}
                              onChange={(e) => handleZoneCoordinateChange(originalIdx, 'h', parseFloat(e.target.value))}
                              style={{ width: '42px', padding: '1px 2px', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '3px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {zones.length === 0 && (
                  <div style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '0.78rem',
                    border: '1px dashed #e2e8f0',
                    borderRadius: '8px'
                  }}>
                    Chưa vẽ vùng nào. Hãy click và kéo thả chuột trên hình bên trái để tạo!
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default HotspotQuestionEditor;
