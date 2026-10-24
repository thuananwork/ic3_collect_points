import React from 'react';
import { X } from 'lucide-react';

interface OrderingQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  updateOptionText: (index: number, text: string) => void;
}

export const OrderingQuestionEditor: React.FC<OrderingQuestionEditorProps> = ({
  question,
  onChange,
  updateOptionText
}) => {
  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      <table className="storyline-table">
        <thead>
          <tr>
            <th className="col-correct" style={{ width: '80px', textAlign: 'center' }}>Thứ tự</th>
            <th className="col-choice">Các bước sắp xếp (Thứ tự đúng từ trên xuống dưới)</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(question.options) && question.options.map((opt: any, index: number) => (
            <tr key={opt.id}>
              <td className="col-correct" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: '#64748b' }}>
                #{index + 1}
              </td>
              <td className="col-choice">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    placeholder={`Nhập nội dung bước ${index + 1}...`}
                    className="storyline-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="storyline-delete-btn"
                    onClick={() => {
                      if (question.options.length <= 2) return;
                      const newOpts = question.options.filter((_: any, idx: number) => idx !== index);
                      const sequence = newOpts.map((x: any) => x.id);
                      onChange({ ...question, options: newOpts, correct_answer: sequence });
                    }}
                    disabled={question.options.length <= 2}
                    title="Xóa bước sắp xếp"
                    style={{ marginLeft: '8px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr style={{ cursor: 'pointer' }} onClick={() => {
            const nextId = String(question.options.length + 1);
            const newOpts = [...question.options, { id: nextId, text: '' }];
            const sequence = newOpts.map(x => x.id);
            onChange({ ...question, options: newOpts, correct_answer: sequence });
          }}>
            <td className="col-correct"></td>
            <td className="col-choice" style={{ fontStyle: 'italic', color: '#888', fontSize: '0.82rem', padding: '0.65rem' }}>
              Bấm vào đây để thêm bước sắp xếp mới...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default OrderingQuestionEditor;
