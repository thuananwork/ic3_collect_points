import React from 'react';
import { X } from 'lucide-react';

interface ChoiceQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  renderedOptions: any[];
  updateOptionText: (index: number, text: string) => void;
  addOptionItem: () => void;
  removeOptionItem: (index: number) => void;
}

export const ChoiceQuestionEditor: React.FC<ChoiceQuestionEditorProps> = ({
  question,
  onChange,
  renderedOptions,
  updateOptionText,
  addOptionItem,
  removeOptionItem
}) => {
  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      <table className="storyline-table">
        <thead>
          <tr>
            <th className="col-correct" style={{ width: '85px', textAlign: 'center', lineHeight: '1.3', padding: '10px 4px', fontSize: '0.75rem' }}>
              ĐÁP ÁN<br />ĐÚNG
            </th>
            <th className="col-choice">Câu trả lời</th>
          </tr>
        </thead>
        <tbody>
          {renderedOptions.map((opt: any, index: number) => (
            <tr key={opt.id}>
              <td className="col-correct" style={{ padding: '0.45rem 0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span className="storyline-grab-handle" style={{ cursor: 'grab', color: '#94a3b8', fontSize: '0.85rem', userSelect: 'none', marginLeft: '-6px', marginRight: '4px' }}>⋮</span>
                  <div className="storyline-checkbox-cell" style={{ flexShrink: 0 }}>
                    {question.question_type === 'single_choice' ? (
                      <input
                        type="radio"
                        name="correct-choice"
                        checked={question.correct_answer === opt.id}
                        onChange={() => onChange({ ...question, correct_answer: opt.id })}
                        style={{ margin: 0, flexShrink: 0 }}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={Array.isArray(question.correct_answer) && question.correct_answer.includes(opt.id)}
                        onChange={() => {
                          let current = Array.isArray(question.correct_answer) ? [...question.correct_answer] : [];
                          if (current.includes(opt.id)) {
                            current = current.filter(id => id !== opt.id);
                          } else {
                            current.push(opt.id);
                          }
                          onChange({ ...question, correct_answer: current });
                        }}
                        style={{ margin: 0, flexShrink: 0 }}
                      />
                    )}
                  </div>
                </div>
              </td>
              <td className="col-choice">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    value={
                      opt.text && typeof opt.text === 'string' &&
                      (opt.text.trim().toLowerCase() === String.fromCharCode(97 + index) ||
                       opt.text.trim().toLowerCase() === opt.id.toLowerCase())
                        ? ''
                        : opt.text || ''
                    }
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    placeholder={`Nhập đáp án ${String.fromCharCode(97 + index)}...`}
                    className="storyline-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="storyline-delete-btn"
                    onClick={() => removeOptionItem(index)}
                    disabled={renderedOptions.length <= 2}
                    title="Xóa lựa chọn"
                    style={{ marginLeft: '8px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {/* "Type to add a new choice" interactive row */}
          <tr style={{ cursor: 'pointer' }} onClick={addOptionItem}>
            <td className="col-correct"></td>
            <td className="col-choice" style={{ fontStyle: 'italic', color: '#888', fontSize: '0.82rem', padding: '0.65rem' }}>
              Bấm vào đây để thêm câu trả lời mới...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ChoiceQuestionEditor;
