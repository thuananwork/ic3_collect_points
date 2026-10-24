import React, { useState, useEffect } from 'react';
import { X, Move } from 'lucide-react';
import { API_BASE_URL } from '../../api';
import './css/MatchingQuestion.css';
import './css/QuestionCommon.css';

interface MatchingQuestionProps {
  question: any;
  userAnswer: any;
  selectedLeftId: string | null;
  onSelectSide: (side: 'left' | 'right', itemId: string) => void;
  onClearPair: (itemId: string) => void;
  showAnswerGuide?: boolean;
  disabled?: boolean;
}

interface DragState {
  isDragging: boolean;
  leftId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  text: string;
  fromSlotId?: string;
}

// Badge color for incorrect pair indicators
const BADGE_COLOR = '#3b82f6';

const getMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const parseTextWithImage = (text: string) => {
  if (!text) return { image: null, text: '' };

  // 1. Check markdown image format: ![alt](url)
  const mdMatch = text.match(/!\[.*?\]\((.*?)\)/);
  if (mdMatch) {
    const imageUrl = mdMatch[1];
    const remainingText = text.replace(mdMatch[0], '').trim();
    return { image: imageUrl, text: remainingText };
  }

  // 2. Check html img tag: <img src="url" .../>
  const htmlMatch = text.match(/<img\s+[^>]*src=["'](.*?)["'][^>]*>/);
  if (htmlMatch) {
    const imageUrl = htmlMatch[1];
    const remainingText = text.replace(text.match(/<img\s+[^>]*>/)?.[0] || '', '').trim();
    return { image: imageUrl, text: remainingText };
  }

  // 3. Check inline URL prefix/suffix: if it contains an image URL (e.g., /uploads/questions/xxx.png)
  const urlRegex = /(?:https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|svg)|(?:\/uploads\/[^\s]+?\.(?:png|jpe?g|gif|webp|svg)))/i;
  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    const imageUrl = urlMatch[0];
    const remainingText = text.replace(imageUrl, '').replace(/^[|:-\s]+|[|:-\s]+$/g, '').trim();
    return { image: imageUrl, text: remainingText };
  }

  return { image: null, text: text };
};

export const MatchingQuestion: React.FC<MatchingQuestionProps> = ({
  question,
  userAnswer,
  selectedLeftId,
  onSelectSide,
  onClearPair,
  showAnswerGuide = false,
  disabled = false,
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [activeLeftSelected, setActiveLeftSelected] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Synchronize internal state with parent prop selectedLeftId
  useEffect(() => {
    setActiveLeftSelected(selectedLeftId);
  }, [selectedLeftId]);

  // Click outside listener to close card dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.drag-handle-icon') && !target.closest('.card-target-dropdown-menu')) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Build index map for correct answer pairs
  const correctAnswer = question.correct_answer;
  const pairIndexMap: Record<string, number> = {};
  if (showAnswerGuide && correctAnswer) {
    Object.entries(correctAnswer).forEach(([leftId, rightId], idx) => {
      pairIndexMap[leftId] = idx + 1;
      pairIndexMap[rightId as string] = idx + 1;
    });
  }

  // Mouse Move & Mouse Up global listeners for custom Drag & Drop
  useEffect(() => {
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

      // Find target dropzone row element underneath cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const cardRow = element?.closest('.target-dropzone-row');
      const slotId = cardRow?.getAttribute('data-slot-id');

      if (cardRow) {
        setDragOverSlotId(slotId || null);
      } else {
        setDragOverSlotId(null);
      }
    };

    const handleMouseUp = () => {
      if (dragOverSlotId && dragState.leftId) {
        onSelectSide('right', dragOverSlotId);
      }
      setDragState(null);
      setDragOverSlotId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Apply grabbing style globally
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState, dragOverSlotId, onSelectSide]);

  if (!question?.options?.left) return null;

  const handleMouseDownOnCard = (
    e: React.MouseEvent,
    leftId: string,
    text: string,
    fromSlotId?: string
  ) => {
    if (disabled) return;
    e.preventDefault();

    onSelectSide('left', leftId);

    if (fromSlotId) {
      onClearPair(leftId);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      leftId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
      text,
      fromSlotId,
    });
  };

  // Helper: check if a match is correct
  const isMatchCorrect = (leftId: string): boolean => {
    if (!correctAnswer || !userAnswer) return false;
    return userAnswer[leftId] === correctAnswer[leftId];
  };

  return (
    <div className="matching-drag-drop-workspace">

      <div className="matching-rows-container">
        {question.options.right.map((rightItem: any, idx: number) => {
          // Left card corresponding to this row index
          const leftItem = question.options.left[idx] || null;

          // Correct matching key for this right slot
          const correctLeftKey = correctAnswer
            ? Object.keys(correctAnswer).find((key) => correctAnswer[key] === rightItem.id)
            : null;

          // Student's matched key for this right slot
          const matchedLeftKey = Object.keys(userAnswer || {}).find(
            (key) => userAnswer[key] === rightItem.id
          );

          // If answer guide is active, pre-fill with correct matches, else show student's matches
          const displayLeftKey = showAnswerGuide ? correctLeftKey : matchedLeftKey;
          const displayLeftItem = displayLeftKey
            ? question.options.left.find((l: any) => l.id === displayLeftKey)
            : null;

          // Configs for left card (if exists)
          const isSelected = leftItem ? activeLeftSelected === leftItem.id : false;
          const isLinked = leftItem
            ? (showAnswerGuide ? true : (userAnswer && userAnswer[leftItem.id] !== undefined))
            : false;
          const isBeingDragged = leftItem ? (dragState?.isDragging && dragState.leftId === leftItem.id) : false;
          const isLeftCorrect = leftItem ? (isLinked && isMatchCorrect(leftItem.id)) : false;
          const leftPairIndex = leftItem ? pairIndexMap[leftItem.id] : null;

          // Configs for middle target dropzone
          const isSlotHovered = dragOverSlotId === rightItem.id;
          const hasActiveSelection = !!activeLeftSelected;
          const matchCorrect = showAnswerGuide ? true : (matchedLeftKey ? isMatchCorrect(matchedLeftKey) : false);

          return (
            <div
              key={rightItem.id}
              className={`matching-row-container ${leftItem && activeDropdownId === leftItem.id ? 'dropdown-active' : ''}`}
            >

              {/* Column 1: Left - Available Option Card */}
              <div className="matching-column-left">
                {leftItem ? (
                  <div
                    className={`vocab-card-item ${isSelected ? 'selected' : ''} ${isLinked && !showAnswerGuide ? 'used' : ''} ${isBeingDragged ? 'is-dragging' : ''} ${showAnswerGuide ? 'guide-mode' : ''} ${activeDropdownId === leftItem.id ? 'dropdown-active' : ''}`}
                    onMouseDown={(e) => {
                      if (!isLinked && !disabled) {
                        handleMouseDownOnCard(e, leftItem.id, leftItem.text || '');
                      }
                    }}
                    onClick={() => {
                      if (disabled || showAnswerGuide) return;
                      if (!isLinked) {
                        onSelectSide('left', leftItem.id);
                      } else {
                        onClearPair(leftItem.id);
                      }
                    }}
                    style={{
                      cursor: (disabled || showAnswerGuide) ? 'not-allowed' : isLinked ? 'pointer' : 'grab',
                    }}
                  >
                    {showAnswerGuide && isLinked && !isLeftCorrect && leftPairIndex && (
                      <span className="pair-color-badge" style={{ backgroundColor: BADGE_COLOR }}>
                        {leftPairIndex}
                      </span>
                    )}
                    {(() => {
                      const parsed = parseTextWithImage(leftItem.text);
                      if (parsed.image) {
                        return (
                          <div className="card-content-with-image">
                            <img src={getMediaUrl(parsed.image)} alt="Vocab Icon" className="matching-card-img" />
                            <span className="vocab-card-txt">{parsed.text || '(Trống)'}</span>
                          </div>
                        );
                      }
                      return <span className="vocab-card-txt">{leftItem.text || '(Trống)'}</span>;
                    })()}

                    {!showAnswerGuide && (
                      <span
                        className="drag-handle-icon"
                        onClick={(e) => {
                          if (disabled || isLinked) return;
                          e.stopPropagation();
                          onSelectSide('left', leftItem.id);
                          setActiveDropdownId(activeDropdownId === leftItem.id ? null : leftItem.id);
                        }}
                        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                        title="Chọn Target nhanh"
                      >
                        <Move size={16} />
                      </span>
                    )}

                    {activeDropdownId === leftItem.id && !disabled && !isLinked && (
                      <div className="card-target-dropdown-menu">
                        {question.options.right.map((item: any, rIdx: number) => {
                          const matchedLeftKey = Object.keys(userAnswer || {}).find(
                            (key) => userAnswer[key] === item.id
                          );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`card-target-dropdown-item ${matchedLeftKey ? 'has-match' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSide('left', leftItem.id);
                                onSelectSide('right', item.id);
                                setActiveDropdownId(null);
                              }}
                            >
                              Target {rIdx + 1} {matchedLeftKey ? ' (Đã nối)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="vocab-card-placeholder" />
                )}
              </div>

              {/* Column 2: Middle - Target Dropzone */}
              <div className="matching-column-middle">
                <div
                  className={`target-dropzone-row ${displayLeftItem ? 'has-match' : ''} ${hasActiveSelection ? 'highlight-active' : ''} ${isSlotHovered ? 'drag-over' : ''} ${showAnswerGuide ? 'guide-mode' : ''} ${disabled ? 'is-disabled' : ''}`}
                  data-slot-id={rightItem.id}
                  onClick={() => {
                    if (disabled || showAnswerGuide) return;
                    if (hasActiveSelection && !displayLeftItem) {
                      onSelectSide('right', rightItem.id);
                    }
                  }}
                >
                  <div
                    className={`target-dropzone-box ${displayLeftItem ? 'filled' : 'empty'} ${hasActiveSelection && !displayLeftItem ? 'ready-to-receive' : ''} ${isSlotHovered ? 'drag-over' : ''}`}
                  >
                    {displayLeftItem ? (
                      <div
                        className={`slotted-target-pill ${showAnswerGuide ? (matchCorrect ? 'correct' : 'incorrect') : ''}`}
                        onMouseDown={(e) => {
                          if (!disabled && !showAnswerGuide) {
                            handleMouseDownOnCard(
                              e,
                              displayLeftKey!,
                              displayLeftItem.text || '',
                              rightItem.id
                            );
                          }
                        }}
                        style={{
                          cursor: (disabled || showAnswerGuide) ? 'not-allowed' : 'grab',
                        }}
                      >
                        {(() => {
                          const parsed = parseTextWithImage(displayLeftItem.text);
                          if (parsed.image) {
                            return (
                              <div className="card-content-with-image">
                                <img src={getMediaUrl(parsed.image)} alt="Slotted Icon" className="matching-card-img" />
                                <span className="slotted-target-txt">{parsed.text || '(Trống)'}</span>
                              </div>
                            );
                          }
                          return (
                            <span className="slotted-target-txt">
                              {displayLeftItem.text}
                            </span>
                          );
                        })()}
                        {!showAnswerGuide && (
                          <button
                            type="button"
                            className="btn-target-unlink"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClearPair(displayLeftKey!);
                            }}
                            title="Bỏ ghép nối"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="target-placeholder-text">
                        Target {idx + 1}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 3: Right - Hardcoded/Fixed Definition */}
              <div className="matching-column-right">
                <div className="definition-card-fixed">
                  {(() => {
                    const parsed = parseTextWithImage(rightItem.text);
                    if (parsed.image) {
                      return (
                        <div className="card-content-with-image">
                          <img src={getMediaUrl(parsed.image)} alt="Slot Icon" className="matching-card-img" />
                          <span className="definition-card-txt">{parsed.text || '(Trống)'}</span>
                        </div>
                      );
                    }
                    return (
                      <span className="definition-card-txt">
                        {rightItem.text || '(Trống)'}
                      </span>
                    );
                  })()}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Custom absolute Layer Drag Clone */}
      {dragState && dragState.isDragging && (
        <div
          className="matching-drag-clone"
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
          {(() => {
            const parsed = parseTextWithImage(dragState.text);
            if (parsed.image) {
              return (
                <div className="card-content-with-image">
                  <img src={getMediaUrl(parsed.image)} alt="Drag Icon" className="matching-card-img" />
                  <span className="vocab-card-txt">{parsed.text}</span>
                </div>
              );
            }
            return <span className="vocab-card-txt">{dragState.text}</span>;
          })()}
        </div>
      )}

    </div>
  );
};
