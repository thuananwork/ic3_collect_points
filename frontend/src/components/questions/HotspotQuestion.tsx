import React from 'react';
import './css/HotspotQuestion.css';
import './css/QuestionCommon.css';

interface HotspotQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  getMediaUrl: (url?: string) => string;
  onClick?: (e: any) => void;
  showAnswerGuide?: boolean;
}

export const HotspotQuestion: React.FC<HotspotQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  getMediaUrl,
  onClick,
  showAnswerGuide,
}) => {
  const imageUrl = question?.image_url || question?.media_url;
  if (!imageUrl) return null;

  const isGuideVisible = showAnswerGuide !== undefined ? showAnswerGuide : isChecked;

  // Support both single marker and array of markers
  const studentMarkers = userAnswer 
    ? (Array.isArray(userAnswer) ? userAnswer : [userAnswer])
    : [];

  // Helper: Get all selectable zones
  const getSelectableZones = (): any[] => {
    if (question?.options) {
      if (Array.isArray(question.options) && question.options.some((o: any) => o.x !== undefined)) {
        return question.options;
      }
      if (typeof question.options === 'object' && Array.isArray(question.options.zones)) {
        return question.options.zones;
      }
    }
    const ca = question?.correct_answer;
    if (ca) {
      return Array.isArray(ca) ? ca : (ca.x !== undefined ? [ca] : []);
    }
    return [];
  };

  // Helper: Get correct zones (with is_correct true, or from correct_answer)
  const getCorrectZones = (): any[] => {
    if (question?.options) {
      if (Array.isArray(question.options) && question.options.some((o: any) => o.is_correct !== undefined)) {
        return question.options.filter((o: any) => o.is_correct === true);
      }
      if (typeof question.options === 'object' && Array.isArray(question.options.zones)) {
        return question.options.zones.filter((o: any) => o.is_correct === true);
      }
    }
    const ca = question?.correct_answer;
    if (ca) {
      return Array.isArray(ca) ? ca : (ca.x !== undefined ? [ca] : []);
    }
    return [];
  };

  const selectableZones = getSelectableZones();
  const correctZones = getCorrectZones();

  const getHotspotMode = (): 'click' | 'zone' => {
    if (question?.options && typeof question.options === 'object' && question.options.mode) {
      return question.options.mode;
    }
    // Fallback for legacy database entries
    if (selectableZones.length > 1) {
      return 'zone';
    }
    return 'click';
  };

  const hotspotMode = getHotspotMode();
  const hasZones = hotspotMode === 'zone';

  // Helper: Check if a zone is selected by the student
  const isZoneSelected = (zone: any): boolean => {
    if (studentMarkers.length === 0) return false;
    const zx = parseFloat(zone.x);
    const zy = parseFloat(zone.y);
    const zw = parseFloat(zone.w || zone.width || 0);
    const zh = parseFloat(zone.h || zone.height || 0);
    
    return studentMarkers.some((pt: any) => {
      const px = parseFloat(pt.x);
      const py = parseFloat(pt.y);
      return px >= zx && px <= zx + zw && py >= zy && py <= zy + zh;
    });
  };

  // Helper: Check if a zone is correct
  const isZoneCorrect = (zone: any): boolean => {
    if (zone.is_correct !== undefined) {
      return zone.is_correct === true;
    }
    return correctZones.some((c: any) => {
      return parseFloat(c.x) === parseFloat(zone.x) && 
             parseFloat(c.y) === parseFloat(zone.y) &&
             parseFloat(c.w || c.width || 0) === parseFloat(zone.w || zone.width || 0) &&
             parseFloat(c.h || c.height || 0) === parseFloat(zone.h || zone.height || 0);
    });
  };

  // Intercept zone clicks and compute coordinates relative to the main image wrapper
  const handleZoneClickInternal = (_zone: any, e: React.MouseEvent<HTMLDivElement>) => {
    if (isChecked || !onClick) return;
    
    const container = e.currentTarget.closest('.hotspot-student-image-wrapper');
    if (!container) return;
    
    const mockEvent = {
      currentTarget: container,
      clientX: e.clientX,
      clientY: e.clientY,
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    
    onClick(mockEvent);
  };

  return (
    <div className="hotspot-interactive-container" style={{ width: '100%' }}>
      <div 
        className="hotspot-student-image-wrapper" 
        style={{ 
          position: 'relative', 
          display: 'inline-block', 
          cursor: 'default'
        }}
      >
        <img
          src={getMediaUrl(imageUrl)}
          alt="Hotspot interactive play"
          className="hotspot-interactive-img"
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          onClick={(!hasZones && onClick && !isChecked) ? (e) => onClick(e) : undefined}
        />

        {/* 1. Render zone-based hotspot overlay */}
        {hasZones && selectableZones.map((zone: any, idx: number) => {
          const isSelected = isZoneSelected(zone);
          const isCorrect = isZoneCorrect(zone);
          const zoneWidth = zone.width !== undefined ? zone.width : zone.w;
          const zoneHeight = zone.height !== undefined ? zone.height : zone.h;

          // Determine classes based on status and review mode
          let zoneClass = 'hotspot-selectable-zone';
          if (isSelected) zoneClass += ' selected';
          if (isGuideVisible) {
            zoneClass += ' review-mode';
            if (isCorrect) {
              zoneClass += ' correct';
            } else if (isSelected) {
              zoneClass += ' incorrect';
            }
          }

          return (
            <div
              key={idx}
              className={zoneClass}
              style={{
                position: 'absolute',
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zoneWidth}%`,
                height: `${zoneHeight}%`,
                borderRadius: '4px',
                pointerEvents: isChecked ? 'none' : 'auto'
              }}
              onClick={(e) => handleZoneClickInternal(zone, e)}
            >
              {isGuideVisible && isCorrect && (
                <span className="hotspot-zone-badge correct-badge">✓ Đúng</span>
              )}
              {isGuideVisible && isSelected && !isCorrect && (
                <span className="hotspot-zone-badge incorrect-badge">✗ Sai</span>
              )}
            </div>
          );
        })}

        {/* 2. Legacy Point-based Marker (only render if no zones are configured) */}
        {!hasZones && studentMarkers.map((pt: any, idx: number) => (
          <div
            key={idx}
            className="student-hotspot-marker"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`
            }}
          >
            <span className="marker-radar" />
            <span className="marker-core" />
          </div>
        ))}

        {/* 3. Legacy correct zones overlay in Review Mode (only if no zones are configured) */}
        {!hasZones && isGuideVisible &&
          correctZones.map((zone: any, idx: number) => {
            const isCorrectZone = zone.is_correct !== false; 
            const zoneWidth = zone.width !== undefined ? zone.width : zone.w;
            const zoneHeight = zone.height !== undefined ? zone.height : zone.h;

            return (
              <div
                key={idx}
                className={`hotspot-correct-zone ${isCorrectZone ? 'is-correct' : 'is-wrong'}`}
                style={{
                  position: 'absolute',
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zoneWidth}%`,
                  height: `${zoneHeight}%`,
                  border: isCorrectZone ? '2.5px dashed #16a34a' : '2px dashed #ef4444',
                  background: isCorrectZone ? 'rgba(22, 163, 74, 0.5)' : 'rgba(239, 68, 68, 0.08)',
                  borderRadius: '4px',
                  pointerEvents: 'none'
                }}
              />
            );
          })}
      </div>
    </div>
  );
};
