import React from 'react';

interface TrueFalseQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  updateOptionText: (index: number, text: string) => void;
}

export const TrueFalseQuestionEditor: React.FC<TrueFalseQuestionEditorProps> = ({
  question,
  onChange,
  updateOptionText
}) => {
  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      <table className="storyline-table">
        <thead>
          <tr>
            <th className="col-correct" style={{ width: '85px', textAlign: 'center', lineHeight: '1.3', padding: '10px 4px', fontSize: '0.75rem' }}>
              ĐÁP ÁN<br />ĐÚNG
            </th>
            <th className="col-choice">Lựa chọn</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(question.options) && question.options.map((opt: any, index: number) => (
            <tr key={opt.id}>
              <td className="col-correct" style={{ padding: '0.45rem 0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span className="storyline-grab-handle" style={{ cursor: 'grab', color: '#94a3b8', fontSize: '0.85rem', userSelect: 'none', marginLeft: '-6px', marginRight: '4px' }}>⋮</span>
                  <div className="storyline-checkbox-cell" style={{ flexShrink: 0 }}>
                    <input
                      type="radio"
                      name="tf-correct"
                      checked={question.correct_answer === opt.id}
                      onChange={() => onChange({ ...question, correct_answer: opt.id })}
                      style={{ margin: 0, flexShrink: 0 }}
                    />
                  </div>
                </div>
              </td>
              <td className="col-choice">
                <div className="storyline-input-cell">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    className="storyline-input"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrueFalseQuestionEditor;
