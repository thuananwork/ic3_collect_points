import React from 'react';
import { PlayCircle, CheckCircle2, ChevronLeft, RefreshCw } from 'lucide-react';
import '../css/StudentPortalLevel.css';

interface StudentPortalLevelProps {
  selectedLevelId: string | null;
  programLevels: any;
  quizzes: any[];
  onBack: () => void;
  onSelectQuiz: (quiz: any, mode: 'training' | 'testing' | 'practice') => void;
}

export const StudentPortalLevel: React.FC<StudentPortalLevelProps> = ({
  selectedLevelId,
  programLevels,
  quizzes,
  onBack,
  onSelectQuiz
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
      <button className="btn-back-level-minimal" onClick={onBack}>
        <ChevronLeft size={18} />
        Quay lại chọn cấp độ
      </button>

      {/* Header */}
      <div className="level-header-title-box">
        <h2>{levelName}</h2>
        <p>Chọn chủ đề bạn muốn học. Có thể học lý thuyết hoặc làm bài kiểm tra ngay lập tức.</p>
      </div>

      {/* Quiz List */}
      <div className="level-quizzes-flex-list">
        {quizzes.length === 0 ? (
          <div className="empty-level-quizzes">
            <p>Các bộ đề ôn luyện cho cấp độ này đang được giáo viên biên soạn.</p>
            <p style={{ marginTop: '12px' }}>Vui lòng quay lại sau nhé!</p>
          </div>
        ) : (
          quizzes.map((quiz) => (
            <div key={quiz.quiz_id} className="level-quiz-card-modern">
              <div className="quiz-card-content">
                <h4>{quiz.title}</h4>
                <p className="quiz-subtitle">
                  {quiz.description || 'Ôn tập toàn diện kiến thức và kỹ năng thực hành IC3 GS6.'}
                </p>
              </div>

              <div className="quiz-card-actions-row">
                <button
                  className="btn-mode-action btn-learn"
                  onClick={() => onSelectQuiz(quiz, 'training')}
                >
                  <PlayCircle size={22} />
                  Trainning
                </button>
                <button
                  className="btn-mode-action btn-test"
                  onClick={() => onSelectQuiz(quiz, 'testing')}
                >
                  <CheckCircle2 size={22} />
                  Testing
                </button>
                <button
                  className="btn-mode-action btn-practice"
                  onClick={() => onSelectQuiz(quiz, 'practice')}
                >
                  <RefreshCw size={22} />
                  Practice
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};