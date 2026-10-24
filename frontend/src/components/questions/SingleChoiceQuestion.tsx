import React from 'react';
import { pruneOptions } from './utils';
import './css/QuestionCommon.css';

interface SingleChoiceQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  onSelect: (optId: string) => void;
}

export const SingleChoiceQuestion: React.FC<SingleChoiceQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  onSelect,
}) => {
  const options = pruneOptions(question?.options, question?.question_type);

  return (
    <div className="options-interactive-grid">
      {options.map((opt: any) => {
        const isSelected = userAnswer === opt.id;
        const isCorrectAnswer = question.correct_answer === opt.id;

        let cardClass = '';
        if (isSelected) cardClass += ' selected';
        if (isChecked) {
          if (isCorrectAnswer) cardClass += ' checked-correct';
          else if (isSelected) cardClass += ' checked-incorrect';
        }

        return (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className={`option ${cardClass}`}
              style={{ flex: 1 }}
              onClick={() => onSelect(opt.id)}
            >
              <div className="radio-circle flex-shrink-0"></div>
              <div className="flex-1 text-zinc-800 dark:text-zinc-200">
                {opt.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
