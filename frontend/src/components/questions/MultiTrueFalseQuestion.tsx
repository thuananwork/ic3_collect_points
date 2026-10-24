import React from 'react';
import { pruneOptions } from './utils';
import './css/MultiTrueFalseQuestion.css';

const getMTFColumnLabels = (question: any) => {
  const opts = question?.options;
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    return {
      columnLeft: opts.columnLeft ?? 'Đúng',
      columnRight: opts.columnRight ?? 'Sai'
    };
  }
  return {
    columnLeft: 'Đúng',
    columnRight: 'Sai'
  };
};

interface MultiTrueFalseQuestionProps {
  question: any;
  userAnswer: any;
  isChecked: boolean;
  onSelect: (optId: string, val: 'T' | 'F') => void;
}

export const MultiTrueFalseQuestion: React.FC<MultiTrueFalseQuestionProps> = ({
  question,
  userAnswer,
  isChecked,
  onSelect,
}) => {
  const statements = pruneOptions(question?.options, question?.question_type);
  const columnLabels = getMTFColumnLabels(question);

  return (
    <div className="mtf-interactive-table" style={{ width: '100%' }}>
      <div className="mtf-table-header">
        <span className="col-stmt" style={{ flex: 1, textAlign: 'center' }}>Phát biểu / Hành động</span>
        <span className="col-ans" style={{ width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
          {columnLabels.columnLeft}
        </span>
        <span className="col-ans" style={{ width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
          {columnLabels.columnRight}
        </span>
      </div>
      {statements.map((opt: any) => {
        const userVal = userAnswer?.[opt.id];
        const correctVal = question.correct_answer?.[opt.id];

        return (
          <div key={opt.id} className="mtf-table-row">
            <span className="row-text" style={{ flex: 1, paddingLeft: '8px' }}>{opt.text || '(Trống)'}</span>

            {/* Left column radio circle option */}
            <div
              className="col-ans-cell"
              style={{ width: '120px', display: 'flex', justifyContent: 'center' }}
            >
              <div
                className={`mtf-radio-wrapper ${userVal === 'T' ? 'selected' : ''} ${isChecked && correctVal === 'T' ? 'checked-correct' : isChecked && userVal === 'T' ? 'checked-incorrect' : ''}`}
                onClick={() => onSelect(opt.id, 'T')}
              >
                <div className="radio-circle"></div>
              </div>
            </div>

            {/* Right column radio circle option */}
            <div
              className="col-ans-cell"
              style={{ width: '120px', display: 'flex', justifyContent: 'center' }}
            >
              <div
                className={`mtf-radio-wrapper ${userVal === 'F' ? 'selected' : ''} ${isChecked && correctVal === 'F' ? 'checked-correct' : isChecked && userVal === 'F' ? 'checked-incorrect' : ''}`}
                onClick={() => onSelect(opt.id, 'F')}
              >
                <div className="radio-circle"></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
