import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, BookOpen } from 'lucide-react';
import { API_BASE_URL } from '../api';
import '../pages/css/StudentPortalExam.css';
import './css/QuestionReviewModal.css';

// Import modular question components
import { SingleChoiceQuestion } from './questions/SingleChoiceQuestion';
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion';
import { TrueFalseQuestion } from './questions/TrueFalseQuestion';
import { MultiTrueFalseQuestion } from './questions/MultiTrueFalseQuestion';
import { ShortAnswerQuestion } from './questions/ShortAnswerQuestion';
import { MatchingQuestion } from './questions/MatchingQuestion';
import { OrderingQuestion } from './questions/OrderingQuestion';
import { HotspotQuestion } from './questions/HotspotQuestion';

const getMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const isVideoUrl = (url: string) => {
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi', '.quicktime'];
  const lowercase = url.toLowerCase();
  return videoExts.some(ext => lowercase.endsWith(ext)) || lowercase.includes('/video/') || lowercase.includes('/videos/');
};

const pruneOptions = (options: any, type: string) => {
  if (type === 'multi_true_false') {
    if (options && typeof options === 'object' && !Array.isArray(options) && Array.isArray(options.statements)) {
      return options.statements;
    }
  }
  let renderedOptions = Array.isArray(options) ? options : [];
  const isChoiceType = type === 'single_choice' || type === 'multiple_choice';
  if (isChoiceType && renderedOptions.length > 4) {
    const hasEmptyExtraOptions = renderedOptions.slice(4).every((opt: any) =>
      !opt.text || opt.text.trim() === '' || opt.text.toLowerCase() === 'none' || opt.text.toLowerCase() === 'nan'
    );
    if (hasEmptyExtraOptions) {
      renderedOptions = renderedOptions.slice(0, 4);
    }
  }
  return renderedOptions;
};


interface Question {
  question_id?: number;
  question_type: string;
  question_text: string;
  image_url: string;
  video_url?: string;
  sound_enabled?: boolean;
  options: any;
  correct_answer: any;
  points: number;
}

interface QuestionSlideViewProps {
  question: Question;
}

const QuestionSlideView: React.FC<QuestionSlideViewProps> = ({ question }) => {
  // Trạng thái lưu câu trả lời thử nghiệm của học sinh
  const [slideUserAnswer, setSlideUserAnswer] = useState<any>(null);

  const renderedOptions = pruneOptions(question.options, question.question_type);

  // Trạng thái hiển thị đáp án đúng & lời giải (giáo viên đối chiếu) - Lưu trữ trong localStorage để đồng bộ tất cả câu hỏi
  const [slideShowAnswerGuide, setSlideShowAnswerGuide] = useState<boolean>(() => {
    return localStorage.getItem('admin_show_answer_guide') === 'true';
  });

  // State phụ cho ghép nối (Matching)
  const [slideSelectedLeftId, setSlideSelectedLeftId] = useState<string | null>(null);

  const isSplit = !!(question?.image_url && ['single_choice', 'multiple_choice', 'true_false', 'short_answer'].includes(question.question_type));
  const [zoomedMediaUrl, setZoomedMediaUrl] = useState<string | null>(null);

  // Scale-to-fit: measure container and auto-scale the browser mockup
  const paneRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(0.7); // Start with a safe, readable default

  useEffect(() => {
    const calcScale = () => {
      const pane = paneRef.current;
      if (!pane) return;

      const containerH = pane.clientHeight;
      const containerW = pane.clientWidth;

      // Ignore zero or tiny sizes to prevent collapsing to minimum scale during layout transitions
      if (containerH < 150 || containerW < 150) {
        return;
      }

      const mockupNaturalH = 604;
      const mockupNaturalW = 1100;

      const scaleH = containerH / mockupNaturalH;
      const scaleW = containerW / mockupNaturalW;
      const newScale = Math.min(scaleH, scaleW, 1); // Never scale up beyond 1
      setViewScale(Math.max(newScale, 0.5)); // Set a highly readable minimum scale of 0.5
    };

    // Calculate immediately
    calcScale();
    
    // Also calculate after transitions settle
    const timer = setTimeout(calcScale, 150);

    window.addEventListener('resize', calcScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calcScale);
    };
  }, []);

  // Khởi tạo/Reset câu trả lời tạm thời khi câu hỏi thay đổi
  useEffect(() => {
    if (question) {
      const qType = question.question_type;
      if (qType === 'single_choice' || qType === 'true_false') {
        setSlideUserAnswer(null);
      } else if (qType === 'multiple_choice') {
        setSlideUserAnswer([]);
      } else if (qType === 'short_answer') {
        setSlideUserAnswer('');
      } else if (qType === 'multi_true_false' || qType === 'matching') {
        setSlideUserAnswer({});
      } else if (qType === 'ordering') {
        if (Array.isArray(renderedOptions)) {
          setSlideUserAnswer(renderedOptions.map(opt => opt.id));
        } else {
          setSlideUserAnswer([]);
        }
      } else {
        setSlideUserAnswer(null);
      }
      setSlideSelectedLeftId(null);
    }
  }, [question]);

  // Nghe phím Escape để đóng nhanh Lightbox phóng to
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedMediaUrl(null);
      }
    };
    if (zoomedMediaUrl) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomedMediaUrl]);

  const handleSlideSelectChoice = (optionId: string) => {
    if (question.question_type === 'single_choice') {
      setSlideUserAnswer(optionId);
    } else if (question.question_type === 'multiple_choice') {
      let current = Array.isArray(slideUserAnswer) ? [...slideUserAnswer] : [];
      if (current.includes(optionId)) {
        current = current.filter(id => id !== optionId);
      } else {
        current.push(optionId);
      }
      setSlideUserAnswer(current);
    }
  };

  const handleSlideSelectTF = (val: 'T' | 'F') => {
    setSlideUserAnswer(val);
  };

  const handleSlideSelectMultiTF = (stmtId: string, val: 'T' | 'F') => {
    const current = { ...(slideUserAnswer || {}) };
    current[stmtId] = val;
    setSlideUserAnswer(current);
  };

  const handleSlideSelectMatchingItem = (side: 'left' | 'right', itemId: string) => {
    if (side === 'left') {
      setSlideSelectedLeftId(itemId);
    } else {
      if (slideSelectedLeftId) {
        const current = { ...(slideUserAnswer || {}) };
        current[slideSelectedLeftId] = itemId;
        setSlideUserAnswer(current);
        setSlideSelectedLeftId(null);
      }
    }
  };

  const removeSlideMatchingPair = (leftId: string) => {
    const current = { ...(slideUserAnswer || {}) };
    delete current[leftId];
    setSlideUserAnswer(current);
  };

  const moveSlideOrderItem = (index: number, direction: 'up' | 'down') => {
    if (!Array.isArray(slideUserAnswer)) return;
    const nextSeq = [...slideUserAnswer];
    if (direction === 'up' && index > 0) {
      const temp = nextSeq[index];
      nextSeq[index] = nextSeq[index - 1];
      nextSeq[index - 1] = temp;
    } else if (direction === 'down' && index < nextSeq.length - 1) {
      const temp = nextSeq[index];
      nextSeq[index] = nextSeq[index + 1];
      nextSeq[index + 1] = temp;
    }
    setSlideUserAnswer(nextSeq);
  };

  const handleSlideHotspotClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    let maxSelections = 1;
    if (question.options) {
      if (Array.isArray(question.options)) {
        const correctZones = question.options.filter((o: any) => o.is_correct === true);
        maxSelections = correctZones.length > 0 ? correctZones.length : 1;
      } else if (typeof question.options === 'object') {
        if (question.options.mode === 'zone') {
          const zonesList = Array.isArray(question.options.zones) ? question.options.zones : [];
          const correctZones = zonesList.filter((o: any) => o.is_correct === true);
          maxSelections = correctZones.length > 0 ? correctZones.length : 1;
        } else {
          maxSelections = question.options.max_selections || 1;
        }
      }
    }

    if (maxSelections <= 1) {
      setSlideUserAnswer({ x, y });
    } else {
      const currentPoints = Array.isArray(slideUserAnswer) ? [...slideUserAnswer] : [];
      if (currentPoints.length < maxSelections) {
        currentPoints.push({ x, y });
      } else {
        currentPoints.shift();
        currentPoints.push({ x, y });
      }
      setSlideUserAnswer(currentPoints);
    }
  };

  return (
    <div className="slide-view-pane" ref={paneRef} style={{ position: 'relative' }}>
      {/* Floating Action Buttons */}
      <div className="slide-view-floating-actions" style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        display: 'flex',
        gap: '8px'
      }}>
        <button
          type="button"
          className={`btn-topbar-action btn-show-ans ${slideShowAnswerGuide ? 'active' : ''}`}
          onClick={() => {
            const nextVal = !slideShowAnswerGuide;
            setSlideShowAnswerGuide(nextVal);
            localStorage.setItem('admin_show_answer_guide', String(nextVal));
          }}
          title="Xem đáp án đúng & lời giải"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: slideShowAnswerGuide ? 'rgba(34, 197, 94, 0.9)' : 'rgba(30, 41, 59, 0.75)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s'
          }}
        >
          <BookOpen size={13} /> {slideShowAnswerGuide ? 'Ẩn đáp án' : 'Hiện đáp án'}
        </button>

      </div>

      <div className="slide-view-scrollable" style={{ width: '100%', height: '100%', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="slide-view-viewport-container" style={{
          width: `${1100 * viewScale}px`,
          height: `${604 * viewScale}px`,
          position: 'relative',
          display: 'block',
          overflow: 'hidden'
        }}>
          {/* LAPTOP / PC MOCKUP BROWSER WINDOW */}
          <div
            ref={mockupRef}
            className="browser-mockup"
            style={{
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              transform: `scale(${viewScale})`,
              transformOrigin: 'top left',
              width: '1100px',
              height: '604px',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          >
            <div className="browser-header">
              <div className="browser-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>

              <div className="browser-tabs">
                <div className="browser-tab active">
                  <span className="tab-title">Cổng Luyện Thi IC3 - Học sinh</span>
                  <span className="tab-close"><X size={10} /></span>
                </div>
              </div>

              <div className="browser-address-bar">
                <span className="address-lock"><Lock size={11} /></span>
                <span className="address-url">https://thuanan.edu.vn/student/quiz/ic3-testing-portal</span>
              </div>
            </div>

            <div className="browser-viewport" style={{ height: '560px', display: 'flex', overflow: 'hidden' }}>
              <div className="exam-viewport-wrapper" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* TOP HEADER BAR */}
                <div className="exam-topbar">
                  <div className="topbar-left">
                    <div className="topbar-quiz-info">
                      <span className="current-q-label" style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        {" Câu  "}<strong className="text-primary-blue" style={{ display: 'inline' }}>1</strong>/5
                      </span>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: '20%' }}
                        ></div>
                      </div>
                      <span className="topbar-quiz-title">
                        ĐỀ ÔN TẬP
                      </span>
                    </div>
                  </div>

                  <div className="topbar-right">
                    <div className="timer-wrapper">
                      <span className="timer-label">thời gian:</span>
                      <span className="timer-value">
                        44:52
                      </span>
                    </div>

                    <div className="user-info-tag">
                      <div className="user-avatar-placeholder">HS</div>
                      <div className="user-details">
                        <span className="user-name">Học Sinh Thử Nghiệm</span>
                        <span className="user-status">Đang thi</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BLUE DIVIDER LINE */}
                <div className="topbar-bottom-divider"></div>

                {/* WORKSPACE AREA */}
                <div className="exam-main-workspace" style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100% - 60px)' }}>
                  {/* LEFT MAIN PANE */}
                  <div className="workspace-left-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>

                    {/* QUIZ PANE (ACTIVE QUESTION) */}
                    <div className="quiz-main-area-new">
                      <div className="quiz-center-container">
                        <button
                          type="button"
                          disabled
                          className="circular-nav-btn prev-btn"
                          title="Câu trước"
                        >
                          <i className="fa-solid fa-chevron-left text-xl"></i>
                        </button>

                        <div className="question-content-wrapper">
                          <div className={`question-pane-content-wrap ${isSplit ? 'portrait-split-layout' : ''}`}>
                            <div className="question-core-section">
                              <div className="exam-question-text">{question.question_text || 'Đang soạn câu hỏi...'}</div>

                              {question.image_url && question.question_type !== 'hotspot' && !isSplit && (
                                <div className="exam-question-image">
                                  <img
                                    src={getMediaUrl(question.image_url)}
                                    alt="Question Visual Element"
                                    style={{ cursor: 'zoom-in' }}
                                    onClick={() => setZoomedMediaUrl(getMediaUrl(question.image_url))}
                                  />
                                </div>
                              )}

                              {question.video_url && (
                                <div className="exam-question-video" style={{ margin: '1rem 0', textAlign: 'center' }}>
                                  <video
                                    src={getMediaUrl(question.video_url)}
                                    controls
                                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', cursor: 'zoom-in' }}
                                    onClick={() => setZoomedMediaUrl(getMediaUrl(question.video_url))}
                                  />
                                </div>
                              )}

                              <div className="exam-question-choices">
                                {/* 1. Trắc nghiệm 1 lựa chọn (Radio) */}
                                {question.question_type === 'single_choice' && (
                                  <SingleChoiceQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onSelect={(optId) => handleSlideSelectChoice(optId)}
                                  />
                                )}

                                {/* 2. Trắc nghiệm nhiều lựa chọn (Checkbox) */}
                                {question.question_type === 'multiple_choice' && (
                                  <MultipleChoiceQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onSelect={(optId) => handleSlideSelectChoice(optId)}
                                  />
                                )}

                                {/* 3. Đúng/Sai đơn lẻ (True/False) */}
                                {question.question_type === 'true_false' && (
                                  <TrueFalseQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onSelect={(val) => handleSlideSelectTF(val)}
                                  />
                                )}

                                {/* 4. Đúng/Sai nhiều ý (Multi True/False Grid) */}
                                {question.question_type === 'multi_true_false' && (
                                  <MultiTrueFalseQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onSelect={(optId, val) => handleSlideSelectMultiTF(optId, val)}
                                  />
                                )}

                                {/* 5. Trả lời ngắn / Điền từ */}
                                {question.question_type === 'short_answer' && (
                                  <ShortAnswerQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onAnswerChange={(val) => setSlideUserAnswer(val)}
                                  />
                                )}

                                {/* 6. Nối cột (matching) */}
                                {question.question_type === 'matching' && (
                                  <MatchingQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    selectedLeftId={slideSelectedLeftId}
                                    onSelectSide={(side, itemId) => handleSlideSelectMatchingItem(side, itemId)}
                                    onClearPair={(itemId) => removeSlideMatchingPair(itemId)}
                                    showAnswerGuide={slideShowAnswerGuide}
                                    disabled={false}
                                  />
                                )}

                                {/* 7. Sắp xếp thứ tự (ordering) */}
                                {question.question_type === 'ordering' && (
                                  <OrderingQuestion
                                    question={question}
                                    userAnswer={slideUserAnswer}
                                    isChecked={slideShowAnswerGuide}
                                    onMoveItem={(idx, direction) => moveSlideOrderItem(idx, direction)}
                                    showAnswerGuide={slideShowAnswerGuide}
                                    onUpdateOrder={(newOrder) => setSlideUserAnswer(newOrder)}
                                  />
                                )}

                                {/* 8. Click chọn điểm trên hình ảnh (hotspot) */}
                                {question.question_type === 'hotspot' && (
                                  <div>
                                    <HotspotQuestion
                                      question={question}
                                      userAnswer={slideUserAnswer}
                                      isChecked={slideShowAnswerGuide}
                                      getMediaUrl={getMediaUrl}
                                      onClick={handleSlideHotspotClick}
                                      showAnswerGuide={slideShowAnswerGuide}
                                    />
                                    {slideUserAnswer && (() => {
                                      const points = Array.isArray(slideUserAnswer) ? slideUserAnswer : [slideUserAnswer];
                                      return (
                                        <div className="hotspot-coords-feedback" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                                          {points.map((pt: any, idx: number) => (
                                            <span key={idx} style={{ marginRight: '12px' }}>
                                              {points.length > 1 ? `Điểm ${idx + 1}: ` : 'Tọa độ bạn chọn: '}
                                              <b>X={pt.x}%, Y={pt.y}%</b>
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ONLY render image here in split layout (on the right) */}
                            {question.image_url && question.question_type !== 'hotspot' && isSplit && (
                              <div className="student-question-image-box" style={{ flex: 1, minWidth: '180px', maxWidth: '480px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img
                                  src={getMediaUrl(question.image_url)}
                                  alt="Question Graphic Preview"
                                  style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', cursor: 'zoom-in', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                  onClick={() => setZoomedMediaUrl(getMediaUrl(question.image_url))}
                                />
                              </div>
                            )}
                          </div>

                        </div>

                        <button
                          type="button"
                          disabled
                          className="circular-nav-btn next-btn"
                          title="Câu tiếp theo"
                        >
                          <i className="fa-solid fa-chevron-right text-xl"></i>
                        </button>
                      </div>
                    </div>

                    {/* FOOTER BAR */}
                    <div className="exam-footer">
                      <div className="footer-quiz-mode">
                        <button
                          type="button"
                          className="footer-btn btn-summary-toggle"
                        >
                          <i className="fa-solid fa-list-ul"></i>
                          <span>Mục lục</span>
                        </button>

                        <button
                          type="button"
                          className="footer-btn btn-flag-toggle"
                        >
                          <i className="fa-regular fa-flag"></i>
                          <span>Đánh dấu</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDEBAR */}
                  <div className="exam-sidebar-new" style={{ height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div className="sidebar-header-action">
                      <button
                        type="button"
                        className="sidebar-submit-btn bg-ic3-primary"
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>NỘP BÀI</span>
                      </button>
                    </div>

                    <div className="sidebar-navigator-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                      <div className="grid-navigator-container">
                        <span className="navigator-grid-box active">1</span>
                        <span className="navigator-grid-box inactive">2</span>
                        <span className="navigator-grid-box inactive">3</span>
                        <span className="navigator-grid-box inactive">4</span>
                        <span className="navigator-grid-box inactive">5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM LIGHTBOX MODAL OVERLAY */}
      {zoomedMediaUrl && (
        <div
          className="premium-lightbox-overlay"
          onClick={() => setZoomedMediaUrl(null)}
        >
          <div className="premium-lightbox-container" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="premium-lightbox-close"
              onClick={() => setZoomedMediaUrl(null)}
            >
              <X size={20} />
            </button>
            {isVideoUrl(zoomedMediaUrl) ? (
              <video
                src={zoomedMediaUrl}
                controls
                autoPlay
                className="premium-lightbox-content"
                style={{ maxWidth: '90vw', maxHeight: '80vh' }}
              />
            ) : (
              <img
                src={zoomedMediaUrl}
                alt="Zoomed Media Preview"
                className="premium-lightbox-content"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSlideView;
