import React from 'react';
import { PlayCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface LevelPageProps {
  selectedLevelId: string | null;
  programLevels: any;
  quizzes: any[];
  onBack: () => void;
  onSelectQuiz: (quiz: any, mode: 'training' | 'testing' | 'practice') => void;
  isLoading?: boolean;
}

const LevelPage: React.FC<LevelPageProps> = ({
  selectedLevelId,
  programLevels,
  quizzes,
  onBack,
  onSelectQuiz,
  isLoading = false
}) => {
  let levelInfo = null;
  if (programLevels) {
    for (const progKey in programLevels) {
      const found = programLevels[progKey]?.levels?.find((l: any) => l.id === selectedLevelId);
      if (found) {
        levelInfo = found;
        break;
      }
    }
  }
  const levelName = levelInfo ? levelInfo.name : 'Cấp độ ôn luyện';

  return (
    <div className="level-page-container animate-fade-in">
      {/* Back Button */}
      <button className="btn-back-to-portal" onClick={onBack}>
        &larr; Quay lại chọn cấp độ
      </button>

      {/* Level Header Title */}
      <div className="level-header-title-box">
        <h2>{levelName}</h2>
        <p>Chọn chủ đề để bắt đầu Học tập hoặc kiểm tra kiến thức.</p>
      </div>

      {/* Quizzes List Section */}
      <div className="quizzes-list-section-premium">
        <style>{`
          @keyframes skeleton-shimmer {
            0% { opacity: 0.35; }
            50% { opacity: 0.75; }
            100% { opacity: 0.35; }
          }
          .skeleton-pulse {
            animation: skeleton-shimmer 1.5s infinite ease-in-out;
          }
        `}</style>
        {isLoading ? (
          <div className="level-quizzes-flex-list skeleton-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="level-quiz-card-modern" style={{ minHeight: '150px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="quiz-card-content">
                  <div style={{ height: '22px', width: '55%', background: 'var(--text-secondary, #475569)', opacity: 0.15, marginBottom: '12px', borderRadius: '4px' }} />
                  <div style={{ height: '14px', width: '80%', background: 'var(--text-secondary, #475569)', opacity: 0.08, borderRadius: '4px' }} />
                </div>
                <div className="quiz-card-actions-row" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <div style={{ height: '36px', flex: 1, background: 'var(--text-secondary, #475569)', opacity: 0.08, borderRadius: '8px' }} />
                  <div style={{ height: '36px', flex: 1, background: 'var(--text-secondary, #475569)', opacity: 0.08, borderRadius: '8px' }} />
                  <div style={{ height: '36px', flex: 1, background: 'var(--text-secondary, #475569)', opacity: 0.08, borderRadius: '8px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="empty-level-quizzes glass">
            <p>Các bộ đề ôn luyện cho cấp độ này đang được giáo viên biên soạn và sẽ sớm xuất hiện.</p>
          </div>
        ) : (
          <div className="level-quizzes-flex-list">
            {quizzes.map((quiz) => (
              <div key={quiz.quiz_id} className="level-quiz-card-modern">
                <div className="quiz-card-content">
                  <h4>{quiz.title}</h4>
                  <p className="quiz-subtitle">{quiz.description || 'Ôn Tập Toàn Diện Kiến Thức IC3 GS6'}</p>
                </div>
                <div className="quiz-card-actions-row">
                  <button 
                    className="btn-mode-action btn-learn"
                    onClick={() => onSelectQuiz(quiz, 'training')}
                  >
                    <PlayCircle size={22} />
                    <span>Trainning</span>
                  </button>
                  <button 
                    className="btn-mode-action btn-test"
                    onClick={() => onSelectQuiz(quiz, 'testing')}
                  >
                    <CheckCircle2 size={22} />
                    <span>Testing</span>
                  </button>
                  <button 
                    className="btn-mode-action btn-practice"
                    onClick={() => onSelectQuiz(quiz, 'practice')}
                  >
                    <RefreshCw size={22} />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LevelPage;
