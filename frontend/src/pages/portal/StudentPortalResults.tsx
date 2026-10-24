import React from 'react';
import '../css/StudentPortalResults.css';

interface DetailedResult {
  question_id: number;
  question_text: string;
  image_url?: string;
  student_answer: any;
  correct_answer: any;
  is_correct: boolean;
  points_earned: number;
}

interface StudentPortalResultsProps {
  finalScore: number;
  cheatWarnings: number;
  detailedResults: DetailedResult[];
  totalMaxPoints: number;
  onFinish?: () => void;
  onRestart?: () => void;
  onReview?: () => void;
}

export const StudentPortalResults: React.FC<StudentPortalResultsProps> = ({
  finalScore,
  cheatWarnings,
  totalMaxPoints,
  onRestart,
  onReview,
  onFinish
}) => {
  const maxPoints = totalMaxPoints > 0 ? totalMaxPoints : 100;
  const scorePercentage = parseFloat(((finalScore / maxPoints) * 100).toFixed(1));
  const passingPercentage = 90;
  const passingPoints = Math.round(maxPoints * 0.9);
  const isPassed = finalScore >= passingPoints;

  return (
    <div className="student-submitted-container flex-center">
      <div className="submitted-card glass animate-slide-up" style={{ maxWidth: '700px', width: '100%' }}>
        <div className="tab-score-content">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            {isPassed ? (
              <div className="status-circle-icon passed">
                ✓
              </div>
            ) : (
              <div className="status-circle-icon failed">
                ✕
              </div>
            )}
          </div>

          <div className="score-details-row">
            <div className="score-info-text">
              Điểm của bạn: <span className="score-highlight-blue">{scorePercentage}% ({finalScore} điểm)</span>
            </div>
            <div className="score-info-text">
              Điểm đạt: <span className="score-highlight-blue">{passingPercentage}% ({passingPoints} điểm)</span>
            </div>
            <div className="score-warnings-text" style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>
              Số lần thoát màn hình: {cheatWarnings} lần
            </div>
          </div>
        </div>

        <div className="submitted-actions" style={{ marginTop: '2rem' }}>
          <button className="btn-action-review" onClick={onReview}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Đáp án
          </button>
          <button className="btn-action-restart" onClick={onRestart}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Làm Lại
          </button>
          {onFinish && (
            <button className="btn-action-finish" onClick={onFinish}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7M19 12H5"/>
              </svg>
              Chọn bài mới
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

