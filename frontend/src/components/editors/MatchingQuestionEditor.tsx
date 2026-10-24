import React from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { uploadQuestionImage, API_BASE_URL } from '../../api';

interface MatchingQuestionEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  addMatchingItem: () => void;
  removeMatchingItem: (index: number) => void;
  updateMatchingItemText: (side: 'left' | 'right', index: number, text: string) => void;
}

const getMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const parseTextWithImage = (text: string) => {
  if (!text) return { image: null, text: '' };

  // 1. Check markdown image format: ![alt](url)
  const mdMatch = text.match(/!\[.*?\]\((.*?)\)/);
  if (mdMatch) {
    const imageUrl = mdMatch[1];
    const remainingText = text.replace(mdMatch[0], '').trim();
    return { image: imageUrl, text: remainingText };
  }

  // 2. Check html img tag: <img src="url" .../>
  const htmlMatch = text.match(/<img\s+[^>]*src=["'](.*?)["'][^>]*>/);
  if (htmlMatch) {
    const imageUrl = htmlMatch[1];
    const remainingText = text.replace(text.match(/<img\s+[^>]*>/)?.[0] || '', '').trim();
    return { image: imageUrl, text: remainingText };
  }

  // 3. Check inline URL prefix/suffix: if it contains an image URL (e.g., /uploads/questions/xxx.png)
  const urlRegex = /(?:https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|svg)|(?:\/uploads\/[^\s]+?\.(?:png|jpe?g|gif|webp|svg)))/i;
  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    const imageUrl = urlMatch[0];
    const remainingText = text.replace(imageUrl, '').replace(/^[|:-\s]+|[|:-\s]+$/g, '').trim();
    return { image: imageUrl, text: remainingText };
  }

  return { image: null, text: text };
};

export const MatchingQuestionEditor: React.FC<MatchingQuestionEditorProps> = ({
  question,
  addMatchingItem,
  removeMatchingItem,
  updateMatchingItemText
}) => {
  const triggerImageUpload = (side: 'left' | 'right', index: number, currentText: string) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const res = await uploadQuestionImage(formData);
        const imageUrl = res.data?.image_url || res.data?.url;
        if (imageUrl) {
          let cleanText = currentText;
          if (currentText.includes('|')) {
            const parts = currentText.split('|');
            const firstPart = parts[0].trim();
            if (firstPart.startsWith('/uploads/') || firstPart.startsWith('http')) {
              cleanText = parts.slice(1).join('|').trim();
            }
          }
          const newText = `${imageUrl} | ${cleanText}`;
          updateMatchingItemText(side, index, newText);
        }
      } catch (err) {
        console.error('Lỗi upload ảnh dòng nối cột:', err);
        alert('Không thể tải ảnh lên.');
      }
    };
    fileInput.click();
  };

  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      <table className="storyline-table">
        <thead>
          <tr>
            <th className="col-correct" style={{ width: '80px', textAlign: 'center' }}>Liên kết</th>
            <th className="col-choice">Phát biểu</th>
            <th className="col-choice">Đáp án tương ứng</th>
          </tr>
        </thead>
        <tbody>
          {question.options?.left && question.options.left.map((item: any, index: number) => (
            <tr key={item.id}>
              <td className="col-correct">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingLeft: '4px' }}>
                  <span className="storyline-grab-handle">⋮</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#64748b' }}>🔗 {item.id}</span>
                </div>
              </td>
              <td className="col-choice">
                <div className="storyline-input-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  {(() => {
                    const parsed = parseTextWithImage(item.text);
                    return (
                      <>
                        {parsed.image && (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <img
                              src={getMediaUrl(parsed.image)}
                              alt="Thumbnail"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateMatchingItemText('left', index, parsed.text);
                              }}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', borderRadius: '50%', border: 'none', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', cursor: 'pointer' }}
                              title="Xóa ảnh"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        )}
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => updateMatchingItemText('left', index, e.target.value)}
                          placeholder={`Nhập phát biểu ${item.id.replace('L', '')}...`}
                          className="storyline-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => triggerImageUpload('left', index, item.text)}
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          title="Tải ảnh lên cho phát biểu này"
                        >
                          <ImageIcon size={16} />
                        </button>
                      </>
                    );
                  })()}
                </div>
              </td>
              <td className="col-choice">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                  {(() => {
                    const rightItem = question.options.right?.[index];
                    const rightText = rightItem?.text || '';
                    const parsed = parseTextWithImage(rightText);
                    return (
                      <>
                        {parsed.image && (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <img
                              src={getMediaUrl(parsed.image)}
                              alt="Thumbnail"
                              style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateMatchingItemText('right', index, parsed.text);
                              }}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', borderRadius: '50%', border: 'none', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', cursor: 'pointer' }}
                              title="Xóa ảnh"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        )}
                        <input
                          type="text"
                          value={rightText}
                          onChange={(e) => updateMatchingItemText('right', index, e.target.value)}
                          placeholder={`Nhập đáp án tương ứng ${(rightItem?.id || item.id).replace('R', '').replace('L', '')}...`}
                          className="storyline-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => triggerImageUpload('right', index, rightText)}
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          title="Tải ảnh lên cho đáp án này"
                        >
                          <ImageIcon size={16} />
                        </button>
                      </>
                    );
                  })()}
                  <button
                    type="button"
                    className="storyline-delete-btn"
                    onClick={() => removeMatchingItem(index)}
                    disabled={question.options.left.length <= 1}
                    title="Xóa cặp nối cột"
                    style={{ marginLeft: '4px', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr style={{ cursor: 'pointer' }} onClick={addMatchingItem}>
            <td className="col-correct"></td>
            <td className="col-choice" colSpan={2} style={{ fontStyle: 'italic', color: '#888', fontSize: '0.82rem', padding: '0.65rem' }}>
              Bấm vào đây để thêm cặp nối cột mới...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MatchingQuestionEditor;
