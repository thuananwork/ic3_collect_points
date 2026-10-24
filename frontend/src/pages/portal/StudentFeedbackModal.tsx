import React from 'react';
import '../css/StudentFeedbackModal.css';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  isCorrect: boolean;
  explanation: string;
  onCloseAndNext: () => void;
}

export const StudentFeedbackModal: React.FC<StudentFeedbackModalProps> = ({
  isOpen,
  isCorrect,
  explanation,
  onCloseAndNext,
}) => {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });

  // Reset position when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCloseAndNext();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isOpen, onCloseAndNext]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only drag on left click
    if ((e.target as HTMLElement).tagName === 'BUTTON') return; // Prevent drag on button click
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <div className="feedback-modal-overlay" onClick={onCloseAndNext}>
      <div
        className={`feedback-modal-card ${isCorrect ? 'correct' : 'incorrect'} ${isDragging ? 'dragging' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          top: `calc(50% + ${position.y}px)`,
          left: `calc(50% + ${position.x}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="feedback-status-title">
          {isCorrect ? 'ĐÁP ÁN ĐÚNG' : 'ĐÁP ÁN SAI'}
        </div>
        {explanation && (
          <div className="feedback-explanation-text">
            {explanation}
          </div>
        )}
        <button
          type="button"
          className="feedback-modal-ok-btn"
          onClick={onCloseAndNext}
        >
          OK
        </button>
      </div>
    </div>
  );
};
