import React from 'react';
import { X } from 'lucide-react';

interface ShortAnswerQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
}

export const ShortAnswerQuestionEditor: React.FC<ShortAnswerQuestionEditorProps> = ({
  question,
  onChange
}) => {
  return (
    <div style={{ width: '100%', marginBottom: '1rem', background: '#ffffff', border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '4px', boxSizing: 'border-box' }}>
      <p className="editor-hint" style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>💡 Nhập các từ khóa/đáp án được chấp nhận bên dưới. Học sinh chỉ cần nhập trùng 1 trong các từ này sẽ được điểm.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {(Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer || '']).map((ans: string, index: number) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={ans}
              onChange={(e) => {
                const current = Array.isArray(question.correct_answer)
                  ? [...question.correct_answer]
                  : [question.correct_answer || ''];
                current[index] = e.target.value;
                onChange({ ...question, correct_answer: current });
              }}
              placeholder={`Đáp án đúng ${index + 1}...`}
              className="storyline-textarea"
              style={{ minHeight: 'unset', padding: '0.4rem 0.65rem' }}
            />
            <button
              type="button"
              className="storyline-media-btn"
              style={{ color: '#ef4444', flexShrink: 0 }}
              onClick={() => {
                const current = Array.isArray(question.correct_answer)
                  ? [...question.correct_answer]
                  : [question.correct_answer || ''];
                if (current.length <= 1) return;
                const next = current.filter((_, idx) => idx !== index);
                onChange({ ...question, correct_answer: next });
              }}
              disabled={(Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer]).length <= 1}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        
        <button
          type="button"
          className="btn-add-option-row"
          style={{ marginTop: '0.5rem', width: 'fit-content' }}
          onClick={() => {
            const current = Array.isArray(question.correct_answer)
              ? [...question.correct_answer]
              : [question.correct_answer || ''];
            onChange({ ...question, correct_answer: [...current, ''] });
          }}
        >
          + Thêm đáp án chấp nhận
        </button>
      </div>
    </div>
  );
};

export default ShortAnswerQuestionEditor;
