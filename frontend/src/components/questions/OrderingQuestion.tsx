import React from 'react';
import { pruneOptions } from './utils';
import './css/OrderingQuestion.css';
import './css/QuestionCommon.css';

interface OrderingQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  onMoveItem: (idx: number, direction: 'up' | 'down') => void;
  showAnswerGuide?: boolean;
  onUpdateOrder?: (newOrder: string[]) => void;
  disabled?: boolean;
}

export const OrderingQuestion: React.FC<OrderingQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  showAnswerGuide = false,
  onUpdateOrder,
  disabled = false,
}) => {
  const renderedOptions = pruneOptions(question?.options, question?.question_type);
  const seq = Array.isArray(userAnswer) ? userAnswer : renderedOptions.map((opt: any) => opt.id);
  const isGuideVisible = showAnswerGuide !== undefined ? showAnswerGuide : isChecked;

  const [dragState, setDragState] = React.useState<{
    isDragging: boolean;
    index: number;
    optId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    text: string;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, index: number, optId: string, text: string) => {
    if (isChecked || disabled) return;
    e.preventDefault(); // Prevent standard text selection and ghost browser drag shadow

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      index,
      optId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
      text,
    });
  };

  React.useEffect(() => {
    if (!dragState || !dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: e.clientX,
          currentY: e.clientY,
        };
      });

      // Find element under cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const card = element?.closest('.order-interactive-card');
      if (card) {
        const hoverIdxStr = card.getAttribute('data-index');
        if (hoverIdxStr !== null) {
          const hoverIdx = parseInt(hoverIdxStr, 10);
          const draggedIdx = dragState.index;

          if (hoverIdx !== draggedIdx && !isNaN(hoverIdx)) {
            // Swap items
            const newSeq = [...seq];
            const draggedItem = newSeq[draggedIdx];
            newSeq.splice(draggedIdx, 1);
            newSeq.splice(hoverIdx, 0, draggedItem);

            setDragState((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                index: hoverIdx,
              };
            });

            if (onUpdateOrder) {
              onUpdateOrder(newSeq);
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState, seq, onUpdateOrder]);

  return (
    <div className="ordering-interactive-container" style={{ width: '100%' }}>
      <div className="ordering-stack">
        {seq.map((optId: string, idx: number) => {
          const originalOpt = renderedOptions.find((o: any) => o.id === optId);
          
          // Calculate correct position index (1-based) for the incorrect guide badge
          const correctIdx = question.correct_answer ? question.correct_answer.indexOf(optId) : -1;
          const isCorrectPosition = isGuideVisible && correctIdx === idx;
          const isIncorrectPosition = isGuideVisible && correctIdx !== -1 && !isCorrectPosition;
          
          const isDraggingThis = dragState?.isDragging && dragState.optId === optId;

          return (
            <div
              key={optId}
              data-index={idx}
              className={`order-interactive-card ${isCorrectPosition ? 'correct-guide' : ''} ${isIncorrectPosition ? 'incorrect-guide' : ''} ${isDraggingThis ? 'is-dragging' : ''}`}
              onMouseDown={(e) => handleMouseDown(e, idx, optId, originalOpt?.text || '')}
              style={{
                cursor: (isChecked || disabled) ? 'default' : 'grab',
              }}
            >
              {isIncorrectPosition && correctIdx !== -1 && (
                <span className="order-correct-badge">
                  {correctIdx + 1}
                </span>
              )}
              <span className="order-text">{originalOpt?.text || '(Trống)'}</span>
              {!(isChecked || disabled) && (
                <div className="order-drag-handle">
                  <span>↕ Kéo</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Drag Clone */}
      {dragState && dragState.isDragging && (
        <div
          className="order-drag-clone"
          style={{
            position: 'fixed',
            left: `${dragState.currentX - dragState.offsetX}px`,
            top: `${dragState.currentY - dragState.offsetY}px`,
            width: `${dragState.width}px`,
            height: `${dragState.height}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <span className="order-text">{dragState.text}</span>
          <div className="order-drag-handle">
            <span>↕ Kéo</span>
          </div>
        </div>
      )}


    </div>
  );
};
