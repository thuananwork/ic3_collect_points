import React from 'react';
import './css/ShortAnswerQuestion.css';
import './css/QuestionCommon.css';

interface ShortAnswerQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  onAnswerChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showAnswerGuide?: boolean;
}

export const ShortAnswerQuestion: React.FC<ShortAnswerQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  onAnswerChange,
  disabled = false,
  placeholder = "Nhập câu trả lời của bạn vào đây...",
  showAnswerGuide,
}) => {
  const isGuideVisible = showAnswerGuide !== undefined ? showAnswerGuide : isChecked;

  return (
    <div className="short-answer-interactive-box" style={{ width: '100%' }}>
      <input
        type="text"
        className="student-short-input"
        value={userAnswer || ''}
        disabled={disabled || isChecked}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder={placeholder}
      />
      {isGuideVisible && question.correct_answer && (
        <div className="answer-guide-box success-light" style={{ marginTop: '1.25rem' }}>
          <strong>Đáp án đúng được chấp nhận:</strong>
          <div className="guide-ans-list">
            {Array.isArray(question.correct_answer) ? (
              question.correct_answer.map((ans: any, idx: number) => <span key={idx} className="badge-ans">{ans}</span>)
            ) : (
              <span className="badge-ans">{question.correct_answer}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
