import React from 'react';
import { X } from 'lucide-react';

interface MultiTrueFalseQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  updateOptionText: (index: number, text: string) => void;
  addMultiTFStatement: () => void;
  removeMultiTFStatement: (index: number) => void;
  toggleMultiTFCorrect: (id: string, val: 'T' | 'F') => void;
}

export const MultiTrueFalseQuestionEditor: React.FC<MultiTrueFalseQuestionEditorProps> = ({
  question,
  onChange,
  updateOptionText,
  addMultiTFStatement,
  removeMultiTFStatement,
  toggleMultiTFCorrect
}) => {
  const options = question.options || {};
  const isLegacy = Array.isArray(options);
  const columnLeft = isLegacy ? 'Đúng' : (options.columnLeft ?? 'Đúng');
  const columnRight = isLegacy ? 'Sai' : (options.columnRight ?? 'Sai');
  const statements = isLegacy ? options : (options.statements || []);

  // Local state to prevent cursor jumping/input lock
  const [localColumnLeft, setLocalColumnLeft] = React.useState(columnLeft);
  const [localColumnRight, setLocalColumnRight] = React.useState(columnRight);

  // Sync local state when question changes
  React.useEffect(() => {
    setLocalColumnLeft(columnLeft);
  }, [columnLeft]);

  React.useEffect(() => {
    setLocalColumnRight(columnRight);
  }, [columnRight]);


  const handlePresetChange = (left: string, right: string) => {
    setLocalColumnLeft(left);
    setLocalColumnRight(right);
    onChange({
      ...question,
      options: {
        columnLeft: left,
        columnRight: right,
        statements: statements
      }
    });
  };

  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      {/* Hàng nút Chọn nhanh nhãn cột (Preset Chips) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', padding: '0 4px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginRight: '4px' }}>
          Chọn nhanh nhãn cột:
        </span>
        {[
          { left: 'Đúng', right: 'Sai' },
          { left: 'Có', right: 'Không' },
          { left: 'Mạnh', right: 'Yếu' },
          { left: 'Lớn', right: 'Nhỏ' },
        ].map((preset) => {
          const isActive = localColumnLeft === preset.left && localColumnRight === preset.right;
          return (
            <button
              key={`${preset.left}-${preset.right}`}
              type="button"
              onClick={() => handlePresetChange(preset.left, preset.right)}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary-color, #3b82f6)' : '#cbd5e1',
                background: isActive ? 'rgba(59, 130, 246, 0.1)' : '#f8fafc',
                color: isActive ? 'var(--primary-color, #3b82f6)' : '#334155',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px'
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              {preset.left} / {preset.right}
            </button>
          );
        })}
      </div>


      <table className="storyline-table">
        <thead>
          <tr>
            <th className="col-correct" style={{ width: '160px', textAlign: 'center' }}>Đáp án</th>
            <th className="col-choice">Phát biểu độc lập</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((opt: any, index: number) => (
            <tr key={opt.id}>
              <td className="col-correct" style={{ width: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingLeft: '4px' }}>
                  <span className="storyline-grab-handle">⋮</span>
                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className={`btn-tf-toggle ${question.correct_answer?.[opt.id] === 'T' ? 'active-true' : ''}`}
                      onClick={() => toggleMultiTFCorrect(opt.id, 'T')}
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        fontSize: '0.75rem', 
                        borderRadius: '3px', 
                        cursor: 'pointer', 
                        border: '1px solid #cbd5e1', 
                        background: question.correct_answer?.[opt.id] === 'T' ? 'rgba(22, 163, 74, 0.15)' : 'transparent', 
                        color: question.correct_answer?.[opt.id] === 'T' ? '#16a34a' : '#64748b',
                        fontWeight: 'bold',
                        minWidth: '55px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={localColumnLeft}
                    >
                      {localColumnLeft}
                    </button>
                    <button
                      type="button"
                      className={`btn-tf-toggle ${question.correct_answer?.[opt.id] === 'F' ? 'active-false' : ''}`}
                      onClick={() => toggleMultiTFCorrect(opt.id, 'F')}
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        fontSize: '0.75rem', 
                        borderRadius: '3px', 
                        cursor: 'pointer', 
                        border: '1px solid #cbd5e1', 
                        background: question.correct_answer?.[opt.id] === 'F' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', 
                        color: question.correct_answer?.[opt.id] === 'F' ? '#ef4444' : '#64748b',
                        fontWeight: 'bold',
                        minWidth: '55px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={localColumnRight}
                    >
                      {localColumnRight}
                    </button>
                  </div>
                </div>
              </td>
              <td className="col-choice">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    placeholder={`Phát biểu số ${opt.id}`}
                    className="storyline-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="storyline-delete-btn"
                    onClick={() => removeMultiTFStatement(index)}
                    disabled={statements.length <= 1}
                    title="Xóa phát biểu"
                    style={{ marginLeft: '8px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr style={{ cursor: 'pointer' }} onClick={addMultiTFStatement}>
            <td className="col-correct"></td>
            <td className="col-choice" style={{ fontStyle: 'italic', color: '#888', fontSize: '0.82rem', padding: '0.65rem' }}>
              Bấm vào đây để thêm phát biểu mới...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MultiTrueFalseQuestionEditor;
