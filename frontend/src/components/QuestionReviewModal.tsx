import React, { useState, useEffect } from 'react';
import { X, Lock, RotateCcw, Eye, BookOpen } from 'lucide-react';
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
  explanation?: string;
  points: number;
}

interface QuestionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
}

const QuestionReviewModal: React.FC<QuestionReviewModalProps> = ({ isOpen, onClose, question }) => {
  // Trạng thái lưu câu trả lời thử nghiệm của học sinh
  const [userAnswer, setUserAnswer] = useState<any>(null);

  // Trạng thái hiển thị đáp án đúng & lời giải (giáo viên đối chiếu)
  const [showAnswerGuide, setShowAnswerGuide] = useState<boolean>(false);

  const renderedOptions = question ? pruneOptions(question.options, question.question_type) : [];

  // State phụ cho ghép nối (Matching) - phải khai báo trước early return
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);

  const isSplit = !!(question?.image_url && ['single_choice', 'multiple_choice', 'true_false', 'short_answer'].includes(question.question_type));
  const [zoomedMediaUrl, setZoomedMediaUrl] = useState<string | null>(null);

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

  const resetUserAnswer = () => {
    if (!question) return;
    const qType = question.question_type;
    if (qType === 'single_choice' || qType === 'true_false') {
      setUserAnswer(null);
    } else if (qType === 'multiple_choice') {
      setUserAnswer([]);
    } else if (qType === 'short_answer') {
      setUserAnswer('');
    } else if (qType === 'multi_true_false') {
      setUserAnswer({});
    } else if (qType === 'matching') {
      setUserAnswer({});
    } else if (qType === 'ordering') {
      // Khởi tạo thứ tự ban đầu từ options
      if (Array.isArray(renderedOptions)) {
        setUserAnswer(renderedOptions.map(opt => opt.id));
      } else {
        setUserAnswer([]);
      }
    } else if (qType === 'hotspot') {
      setUserAnswer(null);
    } else {
      setUserAnswer(null);
    }
    setSelectedLeftId(null);
  };

  // Khởi tạo/Reset câu trả lời tạm thời khi câu hỏi thay đổi hoặc modal mở ra
  useEffect(() => {
    if (question) {
      resetUserAnswer();
      setShowAnswerGuide(false);
    }
  }, [question, isOpen]);

  if (!isOpen || !question) return null;

  // --- LOGIC CHO TỪNG DẠNG CÂU HỎI ---

  // 1 & 2. Trắc nghiệm 1 đáp án / Nhiều đáp án
  const handleSelectChoice = (optionId: string) => {
    if (question.question_type === 'single_choice') {
      setUserAnswer(optionId);
    } else if (question.question_type === 'multiple_choice') {
      let current = Array.isArray(userAnswer) ? [...userAnswer] : [];
      if (current.includes(optionId)) {
        current = current.filter(id => id !== optionId);
      } else {
        current.push(optionId);
      }
      setUserAnswer(current);
    }
  };

  // 3. Đúng/Sai (True/False)
  const handleSelectTF = (val: 'T' | 'F') => {
    setUserAnswer(val);
  };

  // 4. Đúng/Sai nhiều ý (Multi True/False)
  const handleSelectMultiTF = (stmtId: string, val: 'T' | 'F') => {
    const current = { ...(userAnswer || {}) };
    current[stmtId] = val;
    setUserAnswer(current);
  };

  // 5. Nối cột (Matching)
  const handleSelectMatchingItem = (side: 'left' | 'right', itemId: string) => {
    if (side === 'left') {
      setSelectedLeftId(itemId);
    } else {
      if (selectedLeftId) {
        const current = { ...(userAnswer || {}) };
        current[selectedLeftId] = itemId;
        setUserAnswer(current);
        setSelectedLeftId(null);
      }
    }
  };

  const removeMatchingPair = (leftId: string) => {
    const current = { ...(userAnswer || {}) };
    delete current[leftId];
    setUserAnswer(current);
  };

  // 6. Sắp xếp thứ tự (Ordering)
  const moveOrderItem = (index: number, direction: 'up' | 'down') => {
    if (!Array.isArray(userAnswer)) return;
    const nextSeq = [...userAnswer];
    if (direction === 'up' && index > 0) {
      const temp = nextSeq[index];
      nextSeq[index] = nextSeq[index - 1];
      nextSeq[index - 1] = temp;
    } else if (direction === 'down' && index < nextSeq.length - 1) {
      const temp = nextSeq[index];
      nextSeq[index] = nextSeq[index + 1];
      nextSeq[index + 1] = temp;
    }
    setUserAnswer(nextSeq);
  };

  // 7. Hotspot
  const handleHotspotClick = (e: React.MouseEvent<HTMLImageElement>) => {
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
      setUserAnswer({ x, y });
    } else {
      const currentPoints = Array.isArray(userAnswer) ? [...userAnswer] : [];
      if (currentPoints.length < maxSelections) {
        currentPoints.push({ x, y });
      } else {
        currentPoints.shift();
        currentPoints.push({ x, y });
      }
      setUserAnswer(currentPoints);
    }
  };

  return (
    <div className="review-modal-backdrop">
      <div className="review-modal-wrapper">
        {/* THANH ĐIỀU KHIỂN PHÍA TRÊN MODAL CỦA ADMIN */}
        <div className="review-modal-topbar">
          <div className="topbar-left">
            <span className="review-tag"><Eye size={14} /> XEM TRƯỚC HỌC SINH</span>
            <span className="question-type-label">
              Dạng: {
                question.question_type === 'single_choice' ? 'Trắc nghiệm 1 đáp án' :
                  question.question_type === 'multiple_choice' ? 'Trắc nghiệm nhiều đáp án' :
                    question.question_type === 'true_false' ? 'Đúng / Sai' :
                      question.question_type === 'short_answer' ? 'Trả lời ngắn' :
                        question.question_type === 'multi_true_false' ? 'Đúng/Sai nhiều ý' :
                          question.question_type === 'matching' ? 'Nối cột' :
                            question.question_type === 'ordering' ? 'Sắp xếp thứ tự' :
                              question.question_type === 'hotspot' ? 'Hotspot (Click ảnh)' : ''
              }
            </span>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className={`btn-topbar-action btn-show-ans ${showAnswerGuide ? 'active' : ''}`}
              onClick={() => setShowAnswerGuide(!showAnswerGuide)}
              title="Xem đáp án đúng & lời giải"
            >
              <BookOpen size={15} /> {showAnswerGuide ? 'Ẩn đáp án đúng' : 'Hiện đáp án đúng'}
            </button>
            <button
              type="button"
              className="btn-topbar-action btn-reset"
              onClick={resetUserAnswer}
              title="Làm lại từ đầu"
            >
              <RotateCcw size={15} /> Làm lại
            </button>
            <button type="button" className="btn-topbar-close" onClick={onClose} title="Đóng màn hình xem trước">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* LAPTOP / PC MOCKUP BROWSER WINDOW */}
        <div className="browser-mockup">
          {/* Windows/Mac control panel bar */}
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

          {/* CHÍNH DIỆN MÀN HÌNH HỌC SINH LÀM BÀI */}
          <div className="browser-viewport">
            <div className="exam-viewport-wrapper" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* TOP HEADER BAR */}
              <div className="exam-topbar">
                <div className="topbar-left">
                  <div className="topbar-quiz-info">
                    <span className="current-q-label">
                      {" Câu  "}<strong className="text-primary-blue">1</strong>/5
                    </span>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: '20%' }}
                      ></div>
                    </div>
                    <span className="topbar-quiz-title">
                      ĐỀ ÔN TẬP TIN HỌC QUỐC TẾ IC3 GS6
                    </span>
                  </div>
                </div>

                <div className="topbar-right">
                  <div className="timer-wrapper">
                    <span className="timer-label">Thời gian còn lại:</span>
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
              <div className="exam-main-workspace">
                {/* LEFT MAIN PANE */}
                <div className="workspace-left-container">

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
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onSelect={(optId) => handleSelectChoice(optId)}
                                />
                              )}

                              {/* 2. Trắc nghiệm nhiều lựa chọn (Checkbox) */}
                              {question.question_type === 'multiple_choice' && (
                                <MultipleChoiceQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onSelect={(optId) => handleSelectChoice(optId)}
                                />
                              )}

                              {/* 3. Đúng/Sai đơn lẻ (True/False) */}
                              {question.question_type === 'true_false' && (
                                <TrueFalseQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onSelect={(val) => handleSelectTF(val)}
                                />
                              )}

                              {/* 4. Đúng/Sai nhiều ý (Multi True/False Grid) */}
                              {question.question_type === 'multi_true_false' && (
                                <MultiTrueFalseQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onSelect={(optId, val) => handleSelectMultiTF(optId, val)}
                                />
                              )}

                              {/* 5. Trả lời ngắn / Điền từ */}
                              {question.question_type === 'short_answer' && (
                                <ShortAnswerQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onAnswerChange={(val) => setUserAnswer(val)}
                                />
                              )}

                              {/* 6. Nối cột (matching) */}
                              {question.question_type === 'matching' && (
                                <MatchingQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  selectedLeftId={selectedLeftId}
                                  onSelectSide={(side, itemId) => handleSelectMatchingItem(side, itemId)}
                                  onClearPair={(itemId) => removeMatchingPair(itemId)}
                                  showAnswerGuide={showAnswerGuide}
                                  disabled={false}
                                />
                              )}

                              {/* 7. Sắp xếp thứ tự (ordering) */}
                              {question.question_type === 'ordering' && (
                                <OrderingQuestion
                                  question={question}
                                  userAnswer={userAnswer}
                                  isChecked={showAnswerGuide}
                                  onMoveItem={(idx, direction) => moveOrderItem(idx, direction)}
                                  showAnswerGuide={showAnswerGuide}
                                />
                              )}

                              {/* 8. Click chọn điểm trên hình ảnh (hotspot) */}
                              {question.question_type === 'hotspot' && (
                                <div>
                                  <HotspotQuestion
                                    question={question}
                                    userAnswer={userAnswer}
                                    isChecked={showAnswerGuide}
                                    getMediaUrl={getMediaUrl}
                                    onClick={handleHotspotClick}
                                    showAnswerGuide={showAnswerGuide}
                                  />
                                  {userAnswer && (() => {
                                    const points = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
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
                <div className="exam-sidebar-new">
                  <div className="sidebar-header-action">
                    <button
                      type="button"
                      className="sidebar-submit-btn bg-ic3-primary"
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>NỘP BÀI</span>
                    </button>
                  </div>

                  <div className="sidebar-navigator-scroll">
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

export default QuestionReviewModal;
