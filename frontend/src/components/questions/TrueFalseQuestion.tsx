import React from 'react';
import './css/TrueFalseQuestion.css';

interface TrueFalseQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  onSelect: (val: 'T' | 'F') => void;
}

export const TrueFalseQuestion: React.FC<TrueFalseQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  onSelect,
}) => {
  return (
    <div className="tf-interactive-row">
      {['T', 'F'].map((val, idx) => {
        const isSelected = userAnswer === val;
        const isCorrectAnswer = question.correct_answer === val;

        let cardClass = '';
        if (isSelected) cardClass += ' selected';
        if (isChecked) {
          if (isCorrectAnswer) cardClass += ' checked-correct';
          else if (isSelected) cardClass += ' checked-incorrect';
        }

        return (
          <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div
              className={`tf-interactive-card ${cardClass}`}
              style={{ flex: 1 }}
              onClick={() => onSelect(val as 'T' | 'F')}
            >
              <span className="tf-indicator-bullet" />
              <span>{question.options?.[idx]?.text || (val === 'T' ? 'Đúng' : 'Sai')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
