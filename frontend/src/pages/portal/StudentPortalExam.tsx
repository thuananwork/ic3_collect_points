import React from 'react';
import { X } from 'lucide-react';
import { StudentPortalCheatBlocker } from './StudentPortalCheatBlocker';
import { StudentFeedbackModal } from './StudentFeedbackModal';
import { StudentExamLayout } from './StudentExamLayout';
import { API_BASE_URL } from '../../api';
import '../css/StudentPortalExam.css';

// Modular Question Components
import { SingleChoiceQuestion } from '../../components/questions/SingleChoiceQuestion';
import { MultipleChoiceQuestion } from '../../components/questions/MultipleChoiceQuestion';
import { TrueFalseQuestion } from '../../components/questions/TrueFalseQuestion';
import { MultiTrueFalseQuestion } from '../../components/questions/MultiTrueFalseQuestion';
import { ShortAnswerQuestion } from '../../components/questions/ShortAnswerQuestion';
import { MatchingQuestion } from '../../components/questions/MatchingQuestion';
import { OrderingQuestion } from '../../components/questions/OrderingQuestion';
import { HotspotQuestion } from '../../components/questions/HotspotQuestion';

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


interface StudentPortalExamProps {
  quizToStart: any;
  students: any[];
  selectedStudentId: any;
  timeLeft: number;
  formatTime: (sec: number) => string;
  handleManualSubmit: () => void;
  questions: any[];
  answers: any;
  setAnswers: React.Dispatch<React.SetStateAction<any>>;
  activeQIndex: number;
  setActiveQIndex: React.Dispatch<React.SetStateAction<number>>;
  checkedQuestions: Record<number, boolean>;
  setCheckedQuestions: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  quizMode: string;
  selectedLeftId: string | null;

  // Handlers
  handleSelectSingleChoice: (qId: number, optId: string) => void;
  handleSelectMultipleChoice: (qId: number, optId: string) => void;
  handleSelectTrueFalse: (qId: number, val: 'T' | 'F') => void;
  handleSelectMultiTF: (qId: number, optId: string, val: 'T' | 'F') => void;
  handleSelectMatchingSide: (qId: number, side: 'left' | 'right', itemId: string) => void;
  clearMatchingPair: (qId: number, itemId: string) => void;
  moveOrderItem: (qId: number, idx: number, direction: 'up' | 'down') => void;
  handleHotspotClick: (qId: number, e: any) => void;
  checkAnswerClient: (type: string, correct: any, chosen: any) => boolean;

  // Cheat warnings props
  showCheatBlocker: boolean;
  cheatWarnings: number;
  blockerReason: string;
  requestFullscreen: () => void;

  isReviewMode?: boolean;
  onExitReview?: () => void;
}

export const StudentPortalExam: React.FC<StudentPortalExamProps> = (props) => {
  const {
    quizToStart,
    students,
    selectedStudentId,
    timeLeft,
    formatTime,
    handleManualSubmit,
    questions,
    answers,
    setAnswers,
    activeQIndex,
    setActiveQIndex,
    checkedQuestions,
    setCheckedQuestions,
    quizMode,
    selectedLeftId,
    handleSelectSingleChoice,
    handleSelectMultipleChoice,
    handleSelectTrueFalse,
    handleSelectMultiTF,
    handleSelectMatchingSide,
    clearMatchingPair,
    moveOrderItem,
    handleHotspotClick,
    showCheatBlocker,
    cheatWarnings,
    blockerReason,
    requestFullscreen,
    checkAnswerClient,
    isReviewMode = false,
    onExitReview
  } = props;
  const activeQuestion = questions[activeQIndex];
  const isSplit = !!(activeQuestion?.image_url && ['single_choice', 'multiple_choice', 'true_false', 'short_answer'].includes(activeQuestion.question_type));

  // States
  const [zoomedMediaUrl, setZoomedMediaUrl] = React.useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = React.useState<boolean>(false);

  // Flagged questions set state
  const [flaggedQuestions, setFlaggedQuestions] = React.useState<Set<number>>(new Set());

  // Summary view toggle state
  const [isViewingSummary, setIsViewingSummary] = React.useState<boolean>(false);

  // Reset and close feedback modal on question change
  React.useEffect(() => {
    setShowFeedbackModal(false);
  }, [activeQIndex, questions]);

  const isAnswerCorrect = React.useCallback(() => {
    if (!activeQuestion) return false;
    return checkAnswerClient(
      activeQuestion.question_type,
      activeQuestion.correct_answer,
      answers[activeQuestion.question_id]
    );
  }, [activeQuestion, answers, checkAnswerClient]);

  const getExplanationText = React.useCallback(() => {
    if (!activeQuestion) return '';
    const isCorrect = isAnswerCorrect();
    const explanation = activeQuestion.explanation || '';

    const lines = explanation.split('\n');
    if (isCorrect) {
      const correctLine = lines.find((l: string) => l.startsWith('Chính xác:'));
      if (correctLine) {
        return correctLine.replace('Chính xác:', '').trim();
      }
      if (!correctLine && !explanation.includes('Không chính xác:') && explanation.trim()) {
        return explanation.trim();
      }
      return 'Chính xác! Bạn làm tốt lắm';
    } else {
      const incorrectLine = lines.find((l: string) => l.startsWith('Không chính xác:'));
      if (incorrectLine) {
        return incorrectLine.replace('Không chính xác:', '').trim();
      }
      return 'Sai rồi! Bạn nhớ xem lại đáp án đúng nhé';
    }
  }, [activeQuestion, isAnswerCorrect]);

  // Escape key listener to close Lightbox zoom modal
  React.useEffect(() => {
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

  // Toggle flag logic for current active question
  const toggleFlagCurrentQuestion = () => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(activeQIndex)) {
        next.delete(activeQIndex);
      } else {
        next.add(activeQIndex);
      }
      return next;
    });
  };

  const hasSelectedAnswer = React.useCallback((qId: number) => {
    const ans = answers[qId];
    if (ans === undefined || ans === null || ans === '') return false;
    if (typeof ans === 'object' && Object.keys(ans).length === 0) return false;
    return true;
  }, [answers]);

  const handleNextQuestion = React.useCallback(() => {
    if (activeQuestion) {
      const qId = activeQuestion.question_id;
      if ((quizMode === 'training' || quizMode === 'practice') && hasSelectedAnswer(qId) && !checkedQuestions[qId]) {
        if (setCheckedQuestions) {
          setCheckedQuestions(prev => ({
            ...prev,
            [qId]: true
          }));
        }
        setShowFeedbackModal(true);
        return; // Dừng lại để học sinh xem đáp án đúng và lời giải
      }
    }
    setActiveQIndex(idx => Math.min(questions.length - 1, idx + 1));
  }, [activeQuestion, quizMode, checkedQuestions, setCheckedQuestions, setActiveQIndex, questions.length, hasSelectedAnswer]);

  const handleCloseFeedbackModalAndNext = React.useCallback(() => {
    setShowFeedbackModal(false);
    setActiveQIndex(idx => Math.min(questions.length - 1, idx + 1));
  }, [setActiveQIndex, questions.length]);

  // Lắng nghe phím bàn phím để chuyển câu hỏi
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (isViewingSummary) return;
      if (showFeedbackModal) return;

      if (e.key === 'Enter' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextQuestion();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveQIndex(idx => Math.max(0, idx - 1));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isViewingSummary, showFeedbackModal, handleNextQuestion, setActiveQIndex]);

  const studentName = students.find(s => s.student_id === Number(selectedStudentId))?.full_name || 'Học sinh';

  return (
    <>
      {isReviewMode && (
        <style>{`
          /* Highlight the outer circles/boxes of correct answers that the student missed */
          .option.checked-correct:not(.selected) .radio-circle,
          .tf-interactive-card.checked-correct:not(.selected) .tf-indicator-bullet,
          .mtf-radio-wrapper.checked-correct:not(.selected) .radio-circle {
            border: 2px solid #16a34a !important;
            background-color: rgba(22, 163, 74, 0.12) !important;
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.25) !important;
          }
          /* Hide inner check/dot for unselected correct answers */
          .option.checked-correct:not(.selected) .radio-circle::after,
          .tf-interactive-card.checked-correct:not(.selected) .tf-indicator-bullet::after,
          .mtf-radio-wrapper.checked-correct:not(.selected) .radio-circle::after {
            display: none !important;
            content: none !important;
          }

          /* Highlight unselected correct checkboxes */
          .option.checked-correct:not(.selected) .checkbox-square {
            border: 2px solid #16a34a !important;
            background-color: rgba(22, 163, 74, 0.12) !important;
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.25) !important;
          }
          .option.checked-correct:not(.selected) .checkbox-square::after {
            display: none !important;
            content: none !important;
          }
        `}</style>
      )}
      <StudentExamLayout
        quizTitle={quizToStart?.title || 'Bài kiểm tra'}
        studentName={studentName}
        timeLeft={formatTime(timeLeft)}
        timeLeftRaw={timeLeft}
        activeQuestionIndex={activeQIndex}
        totalQuestions={questions.length}
        questions={questions}
        answers={answers}
        flaggedQuestions={flaggedQuestions}
        isViewingSummary={isViewingSummary}
        setIsViewingSummary={setIsViewingSummary}
        onPrevQuestion={() => setActiveQIndex(idx => Math.max(0, idx - 1))}
        onNextQuestion={handleNextQuestion}
        onGoToQuestion={(idx) => setActiveQIndex(idx)}
        onToggleFlag={toggleFlagCurrentQuestion}
        onSubmitExam={handleManualSubmit}
        isReviewMode={isReviewMode}
        onExitReview={onExitReview}
        checkedQuestions={checkedQuestions}
        extraFooterRight={
          !isReviewMode && (quizMode === 'training' || quizMode === 'practice') && activeQuestion ? (
            <button
              type="button"
              className="footer-btn btn-training-submit-nav"
              disabled={
                !checkedQuestions[activeQuestion.question_id] &&
                (answers[activeQuestion.question_id] === undefined ||
                  answers[activeQuestion.question_id] === null ||
                  answers[activeQuestion.question_id] === '' ||
                  (typeof answers[activeQuestion.question_id] === 'object' && Object.keys(answers[activeQuestion.question_id]).length === 0))
              }
              onClick={() => {
                const qId = activeQuestion.question_id;
                if (!checkedQuestions[qId]) {
                  if (setCheckedQuestions) {
                    setCheckedQuestions(prev => ({
                      ...prev,
                      [qId]: true
                    }));
                  }
                  setShowFeedbackModal(true);
                } else {
                  handleNextQuestion();
                }
              }}
              style={{
                padding: '0.65rem 2.5rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                opacity: (
                  !checkedQuestions[activeQuestion.question_id] &&
                  (answers[activeQuestion.question_id] === undefined ||
                    answers[activeQuestion.question_id] === null ||
                    answers[activeQuestion.question_id] === '' ||
                    (typeof answers[activeQuestion.question_id] === 'object' && Object.keys(answers[activeQuestion.question_id]).length === 0))
                ) ? 0.5 : 1,
              }}
            >
              {checkedQuestions[activeQuestion.question_id] ? (
                <>
                  <span>Tiếp tục</span>
                  <i className="fa-solid fa-chevron-right text-sm"></i>
                </>
              ) : (
                <span>Kiểm tra</span>
              )}
            </button>
          ) : null
        }
        cheatBlocker={
          !isReviewMode && showCheatBlocker ? (
            <StudentPortalCheatBlocker
              cheatWarnings={cheatWarnings}
              blockerReason={blockerReason}
              requestFullscreen={requestFullscreen}
            />
          ) : null
        }
      >
        {/* ACTIVE QUESTION PANEL CONTENT */}
        {activeQuestion && (
          <div className={`question-pane-content-wrap ${isSplit ? 'portrait-split-layout' : ''}`}>

            {/* Main Content (Text + Media + Choices) */}
            <div className="question-core-section">

              {/* Question Text */}
              <div className="exam-question-text">{activeQuestion.question_text}</div>

              {/* Image (landscape or inline) */}
              {activeQuestion.image_url && activeQuestion.question_type !== 'hotspot' && !isSplit && (
                <div className="exam-question-image">
                  <img
                    src={getMediaUrl(activeQuestion.image_url)}
                    alt="Question Visual Element"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setZoomedMediaUrl(getMediaUrl(activeQuestion.image_url))}
                  />
                </div>
              )}

              {/* Video Player */}
              {activeQuestion.video_url && (
                <div className="exam-question-video" style={{ margin: '1rem 0', textAlign: 'center' }}>
                  <video
                    src={getMediaUrl(activeQuestion.video_url)}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', cursor: 'zoom-in' }}
                    onClick={() => setZoomedMediaUrl(getMediaUrl(activeQuestion.video_url))}
                  />
                </div>
              )}

              {/* INPUT OPTIONS BASED ON QUESTION TYPE */}
              <div className="exam-question-choices">

                {/* 1. Trắc nghiệm 1 lựa chọn (Radio) */}
                {activeQuestion.question_type === 'single_choice' && (
                  <SingleChoiceQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onSelect={(optId) => handleSelectSingleChoice(activeQuestion.question_id, optId)}
                  />
                )}

                {/* 2. Trắc nghiệm nhiều lựa chọn (Checkbox) */}
                {activeQuestion.question_type === 'multiple_choice' && (
                  <MultipleChoiceQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onSelect={(optId) => handleSelectMultipleChoice(activeQuestion.question_id, optId)}
                  />
                )}

                {/* 3. Đúng/Sai đơn lẻ (True/False) */}
                {activeQuestion.question_type === 'true_false' && (
                  <TrueFalseQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onSelect={(val) => handleSelectTrueFalse(activeQuestion.question_id, val)}
                  />
                )}

                {/* 4. Đúng/Sai nhiều ý (Multi True/False Grid) */}
                {activeQuestion.question_type === 'multi_true_false' && (
                  <MultiTrueFalseQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onSelect={(optId, val) => handleSelectMultiTF(activeQuestion.question_id, optId, val)}
                  />
                )}

                {/* 5. Trả lời ngắn / Điền từ */}
                {activeQuestion.question_type === 'short_answer' && (
                  <ShortAnswerQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onAnswerChange={(val) => setAnswers({ ...answers, [activeQuestion.question_id]: val })}
                  />
                )}

                {/* 6. Nối cột (matching) */}
                {activeQuestion.question_type === 'matching' && (
                  <MatchingQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    selectedLeftId={selectedLeftId}
                    onSelectSide={(side, itemId) => handleSelectMatchingSide(activeQuestion.question_id, side, itemId)}
                    onClearPair={(itemId) => clearMatchingPair(activeQuestion.question_id, itemId)}
                    showAnswerGuide={isReviewMode || (!!checkedQuestions[activeQuestion.question_id] && (quizMode === 'training' || quizMode === 'practice'))}
                    disabled={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                  />
                )}

                {/* 7. Sắp xếp thứ tự (ordering) */}
                {activeQuestion.question_type === 'ordering' && (
                  <OrderingQuestion
                    question={activeQuestion}
                    userAnswer={answers[activeQuestion.question_id]}
                    isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    onMoveItem={(idx, direction) => moveOrderItem(activeQuestion.question_id, idx, direction)}
                    showAnswerGuide={isReviewMode || (!!checkedQuestions[activeQuestion.question_id] && (quizMode === 'training' || quizMode === 'practice'))}
                    onUpdateOrder={(newOrder) => setAnswers({ ...answers, [activeQuestion.question_id]: newOrder })}
                  />
                )}

                {/* 8. Click chọn điểm trên hình ảnh (hotspot) */}
                {activeQuestion.question_type === 'hotspot' && (
                  <div>
                    <HotspotQuestion
                      question={activeQuestion}
                      userAnswer={answers[activeQuestion.question_id]}
                      isChecked={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                      getMediaUrl={getMediaUrl}
                      onClick={isReviewMode ? undefined : (e) => handleHotspotClick(activeQuestion.question_id, e)}
                      showAnswerGuide={isReviewMode || !!checkedQuestions[activeQuestion.question_id]}
                    />
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', height: '36px', alignItems: 'center' }}>
                      {answers[activeQuestion.question_id] && !checkedQuestions[activeQuestion.question_id] && !isReviewMode && (
                        <button
                          type="button"
                          className="btn-clear-hotspot"
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                          }}
                          onClick={() => setAnswers({ ...answers, [activeQuestion.question_id]: null })}
                        >
                          Xóa điểm đã đánh dấu
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* EXPLANATIONS & FEEDBACK FOR TRAINING MODE */}
              {quizMode === 'training' && activeQuestion && (
                <div className="training-action-section" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Matching & Ordering correct positions are now indicated directly on the options via badges */}
                </div>
              )}



            </div>

            {/* Renders image on the right if split layout is enabled */}
            {activeQuestion.image_url && activeQuestion.question_type !== 'hotspot' && isSplit && (
              <div className="question-portrait-media-pane">
                <img
                  src={getMediaUrl(activeQuestion.image_url)}
                  alt="Question Visual Element"
                  style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', cursor: 'zoom-in', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  onClick={() => setZoomedMediaUrl(getMediaUrl(activeQuestion.image_url))}
                />
              </div>
            )}
          </div>
        )}
      </StudentExamLayout>

      {/* PREMIUM LIGHTBOX MODAL OVERLAY - Rendered at root level to prevent parent stacking contexts from overlaying sidebar/footer */}
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
                style={{ maxWidth: '80vw', maxHeight: '80vh' }}
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

      <StudentFeedbackModal
        isOpen={showFeedbackModal}
        isCorrect={isAnswerCorrect()}
        explanation={getExplanationText()}
        onCloseAndNext={handleCloseFeedbackModalAndNext}
      />
    </>
  );
};
