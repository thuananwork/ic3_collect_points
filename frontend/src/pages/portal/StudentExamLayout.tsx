import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { checkAnswerClient } from '../../utils/scoring';

interface StudentExamLayoutProps {
  quizTitle: string;
  studentName: string;
  timeLeft: string;
  timeLeftRaw: number;
  activeQuestionIndex: number;
  totalQuestions: number;
  questions: any[];
  answers: any;
  flaggedQuestions: Set<number>;
  isViewingSummary: boolean;
  setIsViewingSummary: (val: boolean) => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onGoToQuestion: (index: number) => void;
  onToggleFlag: () => void;
  onSubmitExam: () => void;
  cheatBlocker?: React.ReactNode;
  extraFooterRight?: React.ReactNode;
  children: React.ReactNode;
  isReviewMode?: boolean;
  onExitReview?: () => void;
  checkedQuestions?: Record<number, boolean>;
}

export const StudentExamLayout: React.FC<StudentExamLayoutProps> = ({
  quizTitle,
  studentName,
  timeLeft,
  timeLeftRaw,
  activeQuestionIndex,
  totalQuestions,
  questions,
  answers,
  flaggedQuestions,
  isViewingSummary,
  setIsViewingSummary,
  onPrevQuestion,
  onNextQuestion,
  onGoToQuestion,
  onToggleFlag,
  onSubmitExam,
  cheatBlocker,
  extraFooterRight,
  children,
  isReviewMode = false,
  onExitReview,
  checkedQuestions
}) => {
  const progressPercent = totalQuestions > 0 ? ((activeQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const isTimeCritical = timeLeftRaw <= 300; // <= 5 minutes

  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Helper to check if a question is answered
  const isQuestionAnswered = (q: any) => {
    const ans = answers[q.question_id];
    if (ans === undefined || ans === '' || ans === null) return false;
    if (typeof ans === 'object') {
      return Object.keys(ans).length > 0;
    }
    return true;
  };

  return (
    <div className="exam-viewport-wrapper">
      {/* CHEAT OVERLAY BLOCKER */}
      {cheatBlocker}

      {/* TOP HEADER BAR */}
      <div className="exam-topbar">
        <div className="topbar-left">
          {!isViewingSummary ? (
            <div className="topbar-quiz-info">
              <span className="current-q-label">
                {" Câu  "}<strong className="text-primary-blue">{activeQuestionIndex + 1}</strong>/{totalQuestions}
              </span>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="topbar-quiz-title">
                {quizTitle}
              </span>
            </div>
          ) : (
            <div className="topbar-summary-title">
              <h1 className="summary-title-text">MỤC LỤC</h1>
            </div>
          )}
        </div>

        <div className="topbar-right">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-exam-theme-toggle"
            title={theme === 'light' ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {!isReviewMode && (
            <div className="timer-wrapper">
              <span className="timer-label">Thời gian còn lại:</span>
              <span className={`timer-value ${isTimeCritical ? 'critical' : ''}`}>
                {timeLeft}
              </span>
            </div>
          )}

          {/* Hide user info tag when viewing summary table, matching TN1DapAn.html */}
          {!isViewingSummary && (
            <div className="user-info-tag">
              <div className="user-avatar-placeholder">HS</div>
              <div className="user-details">
                <span className="user-name">{studentName}</span>
                <span className="user-status">{isReviewMode ? 'Xem lại' : 'Đang thi'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BLUE DIVIDER LINE */}
      <div className="topbar-bottom-divider"></div>

      {/* WORKSPACE AREA */}
      <div className="exam-main-workspace">
        {/* LEFT MAIN PANE */}
        <div className="workspace-left-container">

          {/* 1. QUIZ PANE (ACTIVE QUESTION) */}
          {!isViewingSummary ? (
            <div className="quiz-main-area-new" style={{ position: 'relative' }}>
              <div className="quiz-center-container">
                <button
                  type="button"
                  onClick={onPrevQuestion}
                  disabled={activeQuestionIndex === 0}
                  className="circular-nav-btn prev-btn"
                  title="Câu trước"
                >
                  <i className="fa-solid fa-chevron-left text-xl"></i>
                </button>

                <div className="question-content-wrapper">
                  {children}
                </div>

                <button
                  type="button"
                  onClick={onNextQuestion}
                  disabled={activeQuestionIndex === totalQuestions - 1}
                  className="circular-nav-btn next-btn"
                  title="Câu tiếp theo"
                >
                  <i className="fa-solid fa-chevron-right text-xl"></i>
                </button>
              </div>


            </div>
          ) : (
            /* 2. SUMMARY MODE (MỤC LỤC TABLE) */
            <div className="summary-table-area-new">
              <div className="summary-table-content-max">
                <p className="summary-instruction">
                  Kích vào nội dung câu hỏi để xem lại hoặc chỉnh sửa đáp án.
                </p>

                <div className="summary-table-card">
                  <table className="summary-table">
                    <thead>
                      <tr className="summary-table-header-row">
                        <th className="th-question">Câu hỏi</th>
                        <th className="th-answered">Đã trả lời</th>
                        <th className="th-unanswered">Chưa trả lời</th>
                        <th className="th-flagged">Đánh dấu</th>
                      </tr>
                    </thead>
                    <tbody className="summary-table-body">
                      {questions.map((q, idx) => {
                        const answered = isQuestionAnswered(q);
                        const flagged = flaggedQuestions.has(idx);

                        return (
                          <tr
                            key={q.question_id || idx}
                            className="summary-tr"
                            onClick={() => {
                              onGoToQuestion(idx);
                              setIsViewingSummary(false);
                            }}
                          >
                            <td className="td-question">
                              <span className="td-question-text">
                                {idx + 1}. {q.question_text || q.question}
                              </span>
                            </td>
                            <td className="td-answered">
                              {isReviewMode ? (
                                checkAnswerClient(q.question_type, q.correct_answer, answers[q.question_id]) ? (
                                  <span className="checkmark-icon" style={{ color: '#16a34a' }}>✓</span>
                                ) : (
                                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.25rem' }}>✗</span>
                                )
                              ) : (
                                answered && <span className="checkmark-icon">✓</span>
                              )}
                            </td>
                            <td className="td-unanswered">
                              {isReviewMode ? (
                                !answered && (
                                  <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>Chưa làm</span>
                                )
                              ) : (
                                !answered && (
                                  <div className="empty-answer-box"></div>
                                )
                              )}
                            </td>
                            <td className="td-flagged">
                              {flagged && (
                                <i className="fa-solid fa-flag text-amber-500 text-lg"></i>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {/* FOOTER BAR */}
          <div className="exam-footer">
            {!isViewingSummary ? (
              <div className="footer-quiz-mode" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setIsViewingSummary(true)}
                    className="footer-btn btn-summary-toggle"
                  >
                    <i className="fa-solid fa-list-ul"></i>
                    <span>Mục lục</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleFlag}
                    className={`footer-btn btn-flag-toggle ${flaggedQuestions.has(activeQuestionIndex) ? 'flagged-active' : ''}`}
                  >
                    <i className={flaggedQuestions.has(activeQuestionIndex) ? "fa-solid fa-flag text-amber-500" : "fa-regular fa-flag"}></i>
                    <span>
                      {flaggedQuestions.has(activeQuestionIndex) ? "Bỏ đánh dấu" : "Đánh dấu"}
                    </span>
                  </button>
                </div>

                {extraFooterRight && (
                  <div className="footer-right-actions" style={{ display: 'flex', alignItems: 'center' }}>
                    {extraFooterRight}
                  </div>
                )}
              </div>
            ) : (
              <div className="footer-summary-mode">
                <button
                  type="button"
                  onClick={() => setIsViewingSummary(false)}
                  className="footer-btn btn-back-to-quiz"
                >
                  Quay lại
                </button>

                {isReviewMode ? (
                  <button
                    type="button"
                    onClick={onExitReview}
                    className="footer-btn btn-submit-summary"
                    style={{ backgroundColor: '#4a86e8', color: '#fff' }}
                  >
                    Quay lại Phiếu Điểm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSubmitExam}
                    className="footer-btn btn-submit-summary bg-ic3-primary"
                  >
                    Nộp bài
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR (hides when viewing summary) */}
        {!isViewingSummary && (
          <div className="exam-sidebar-new">
            <div className="sidebar-header-action">
              {isReviewMode ? (
                <button
                  type="button"
                  onClick={onExitReview}
                  className="sidebar-submit-btn"
                  style={{ backgroundColor: '#4a86e8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <i className="fa-solid fa-square-poll-vertical"></i>
                  <span>PHIẾU ĐIỂM</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmitExam}
                  className="sidebar-submit-btn bg-ic3-primary"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>NỘP BÀI</span>
                </button>
              )}
            </div>

            <div className="sidebar-navigator-scroll">
              <div className="grid-navigator-container">
                {questions.map((q, idx) => {
                  const flagged = flaggedQuestions.has(idx);
                  const isChecked = !!(checkedQuestions && checkedQuestions[q.question_id]);
                  const correctnessRevealed = isReviewMode || isChecked;

                  let boxClass = "navigator-grid-box";
                  if (idx === activeQuestionIndex) {
                    boxClass += " active";
                    if (correctnessRevealed) {
                      boxClass += " active-review";
                    }
                  } else {
                    boxClass += " inactive";
                  }

                  if (correctnessRevealed) {
                    const isCorrect = checkAnswerClient(
                      q.question_type,
                      q.correct_answer,
                      answers[q.question_id]
                    );
                    if (!isCorrect) {
                      // Câu chưa làm hoặc sai thì viền đỏ
                      boxClass += " incorrect-item";
                    } else {
                      // Câu làm đúng thì viền xanh lá
                      boxClass += " answered-item";
                    }
                  } else {
                    // Khi chưa nộp bài hoặc chưa bấm kiểm tra, tất cả đều để mặc định không màu
                  }

                  if (flagged) {
                    boxClass += " flagged-item";
                  }

                  return (
                    <button
                      key={q.question_id || idx}
                      type="button"
                      onClick={() => onGoToQuestion(idx)}
                      className={boxClass}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
