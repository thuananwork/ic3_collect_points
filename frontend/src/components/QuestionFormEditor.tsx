import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, X, ListChecks, Video, Volume2, VolumeX, ChevronDown, HelpCircle, CheckSquare, ToggleLeft, GitCommit, ListOrdered, Crosshair } from 'lucide-react';
import { uploadQuestionImage, API_BASE_URL } from '../api';
import './css/QuestionFormEditor.css';

const QUESTION_TYPES = [
  { value: 'single_choice', label: 'Trắc nghiệm 1 đáp án (A/B/C/D)' },
  { value: 'multiple_choice', label: 'Trắc nghiệm nhiều đáp án' },
  { value: 'true_false', label: 'Đúng / Sai (2 lựa chọn)' },
  { value: 'multi_true_false', label: 'Đúng / Sai nhiều ý độc lập' },
  { value: 'matching', label: 'Nối cột (Nối ý bên Trái với Phải)' },
  { value: 'ordering', label: 'Sắp xếp thứ tự (Kéo thả xếp hạng)' },
  { value: 'hotspot', label: 'Click chọn điểm trên hình ảnh (Hotspot)' },
  { value: 'short_answer', label: 'Trả lời ngắn / Điền từ' }
];

const getQuestionTypeIcon = (type: string) => {
  switch (type) {
    case 'single_choice':
      return <HelpCircle size={16} className="type-icon-prefix single_choice" />;
    case 'multiple_choice':
      return <CheckSquare size={16} className="type-icon-prefix multiple_choice" />;
    case 'true_false':
      return <ToggleLeft size={16} className="type-icon-prefix true_false" />;
    case 'multi_true_false':
      return <ListChecks size={16} className="type-icon-prefix multi_true_false" />;
    case 'matching':
      return <GitCommit size={16} className="type-icon-prefix matching" />;
    case 'ordering':
      return <ListOrdered size={16} className="type-icon-prefix ordering" />;
    case 'hotspot':
      return <Crosshair size={16} className="type-icon-prefix hotspot" />;
    case 'short_answer':
      return <CheckSquare size={16} className="type-icon-prefix short_answer" />;
    default:
      return <HelpCircle size={16} className="type-icon-prefix" />;
  }

};

const getPlaceholderText = (type: string) => {
  switch (type) {
    case 'single_choice':
      return 'Nhập nội dung câu hỏi trắc nghiệm 1 đáp án tại đây...';
    case 'multiple_choice':
      return 'Nhập nội dung câu hỏi trắc nghiệm nhiều đáp án tại đây...';
    case 'true_false':
      return 'Nhập nội dung câu hỏi đúng / sai tại đây...';
    case 'multi_true_false':
      return 'Nhập nội dung câu hỏi đúng / sai nhiều phát biểu độc lập tại đây...';
    case 'matching':
      return 'Nhập nội dung câu hỏi nối cột tại đây...';
    case 'ordering':
      return 'Nhập nội dung câu hỏi sắp xếp thứ tự tại đây...';
    case 'hotspot':
      return 'Nhập nội dung câu hỏi click chọn điểm trên hình (Hotspot) tại đây...';
    case 'short_answer':
      return 'Nhập nội dung câu hỏi trả lời ngắn / điền từ tại đây...';
    default:
      return 'Nhập nội dung câu hỏi tại đây...';
  }

};

// Import subcomponents for question type editors
import ChoiceQuestionEditor from './editors/ChoiceQuestionEditor';
import TrueFalseQuestionEditor from './editors/TrueFalseQuestionEditor';
import MultiTrueFalseQuestionEditor from './editors/MultiTrueFalseQuestionEditor';
import MatchingQuestionEditor from './editors/MatchingQuestionEditor';
import OrderingQuestionEditor from './editors/OrderingQuestionEditor';
import ShortAnswerQuestionEditor from './editors/ShortAnswerQuestionEditor';
import HotspotQuestionEditor from './editors/HotspotQuestionEditor';

const getMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};



interface QuestionFormEditorProps {
  question: any;
  onChange: (updatedQuestion: any) => void;
  onSave: () => void;
  onPreview: () => void;
  onTypeChange: (type: string) => void;
}

const QuestionFormEditor: React.FC<QuestionFormEditorProps> = ({
  question,
  onChange,
  onSave,
  onTypeChange
}) => {

  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  const [isUploadingVideo, setIsUploadingVideo] = useState<boolean>(false);

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const explanation = question.explanation || '';

  const parseFeedback = () => {
    let correct = '';
    let incorrect = '';

    const lines = explanation.split('\n');
    const correctLine = lines.find((l: string) => l.startsWith('Chính xác:'));
    if (correctLine) {
      correct = correctLine.replace('Chính xác:', '').trim();
    }

    const incorrectLine = lines.find((l: string) => l.startsWith('Không chính xác:'));
    if (incorrectLine) {
      incorrect = incorrectLine.replace('Không chính xác:', '').trim();
    }

    if (!correctLine && !incorrectLine && explanation.trim()) {
      correct = explanation.trim();
    }

    return { correct, incorrect };
  };

  const { correct: correctVal, incorrect: incorrectVal } = parseFeedback();

  const handleCorrectFeedbackChange = (val: string) => {
    const { incorrect } = parseFeedback();
    const newExpl = `Chính xác: ${val}\nKhông chính xác: ${incorrect}`;
    onChange({ ...question, explanation: newExpl });
  };

  const handleIncorrectFeedbackChange = (val: string) => {
    const { correct } = parseFeedback();
    const newExpl = `Chính xác: ${correct}\nKhông chính xác: ${val}`;
    onChange({ ...question, explanation: newExpl });
  };

  useEffect(() => {

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }

    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };

  }, []);



  const getRenderedOptions = () => {

    const opts = question?.options;
    if (question?.question_type === 'multi_true_false') {
      if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        return Array.isArray(opts.statements) ? opts.statements : [];
      }

    }

    return Array.isArray(opts) ? opts : [];
  };

  const renderedOptions = getRenderedOptions();



  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingVideo(true);

      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadQuestionImage(formData);
      onChange({ ...question, video_url: res.data?.image_url || res.data?.url });
    } catch (err) {
      console.error('Lỗi upload video:', err);
      alert('Không thể tải video lên.');
    } finally {
      setIsUploadingVideo(false);
    }

  };

  const toggleSound = () => {
    onChange({ ...question, sound_enabled: !question.sound_enabled });
  };

  // Generic option updators

  const updateOptionText = (index: number, text: string) => {
    if (!question) return;
    if (question.question_type === 'multi_true_false') {

      const opts = question.options || {};

      const isLegacy = Array.isArray(opts);

      const columnLeft = isLegacy ? 'Đúng' : (opts.columnLeft ?? 'Đúng');

      const columnRight = isLegacy ? 'Sai' : (opts.columnRight ?? 'Sai');

      const statements = isLegacy ? opts : (opts.statements ?? []);

      const newStmts = statements.map((stmt: any, idx: number) =>
        idx === index ? { ...stmt, text } : stmt
      );
      onChange({
        ...question,
        options: {
          columnLeft,
          columnRight,
          statements: newStmts
        }

      });
      return;
    }

    if (!Array.isArray(question.options)) return;

    const newOpts = renderedOptions.map((opt: any, idx: number) =>
      idx === index ? { ...opt, text } : opt
    );
    onChange({ ...question, options: newOpts });
  };

  const addOptionItem = () => {
    if (!question) return;
    if (Array.isArray(question.options)) {

      const nextId = String.fromCharCode(65 + renderedOptions.length); // A, B, C, D, E...

      const newOpts = [...renderedOptions, { id: nextId, text: '' }];
      onChange({ ...question, options: newOpts });
    }

  };

  const removeOptionItem = (index: number) => {
    if (!question || !Array.isArray(question.options)) return;
    if (renderedOptions.length <= 2) return; // keep at least 2 options

    const newOpts = renderedOptions.filter((_: any, idx: number) => idx !== index);
    // adjust correct answer if needed
    let correct = question.correct_answer;

    const removedId = renderedOptions[index]?.id;
    if (question.question_type === 'single_choice' && correct === removedId) {
      correct = newOpts[0]?.id;
    } else if (question.question_type === 'multiple_choice' && Array.isArray(correct)) {
      correct = correct.filter((x: any) => x !== removedId);
    }

    onChange({ ...question, options: newOpts, correct_answer: correct });
  };

  // Multi True/False updators

  const addMultiTFStatement = () => {
    if (!question) return;

    const opts = question.options || {};

    const isLegacy = Array.isArray(opts);

    const columnLeft = isLegacy ? 'Đúng' : (opts.columnLeft ?? 'Đúng');

    const columnRight = isLegacy ? 'Sai' : (opts.columnRight ?? 'Sai');

    const statements = isLegacy ? opts : (opts.statements ?? []);

    const nextId = String(statements.length + 1);

    const newStmts = [...statements, { id: nextId, text: '' }];

    const correct = { ...question.correct_answer, [nextId]: 'T' };
    onChange({
      ...question,
      options: {
        columnLeft,
        columnRight,
        statements: newStmts
      },
      correct_answer: correct
    });
  };

  const removeMultiTFStatement = (index: number) => {
    if (!question) return;

    const opts = question.options || {};

    const isLegacy = Array.isArray(opts);

    const columnLeft = isLegacy ? 'Đúng' : (opts.columnLeft ?? 'Đúng');

    const columnRight = isLegacy ? 'Sai' : (opts.columnRight ?? 'Sai');

    const statements = isLegacy ? opts : (opts.statements ?? []);
    if (statements.length <= 1) return;

    const removedId = statements[index].id;

    const newStmts = statements.filter((_: any, idx: number) => idx !== index);

    const correct = { ...question.correct_answer };
    delete correct[removedId];
    onChange({
      ...question,
      options: {
        columnLeft,
        columnRight,
        statements: newStmts
      },
      correct_answer: correct
    });
  };

  const toggleMultiTFCorrect = (id: string, val: 'T' | 'F') => {
    if (!question) return;

    const correct = { ...question.correct_answer, [id]: val };
    onChange({ ...question, correct_answer: correct });
  };

  // Matching Updators

  const addMatchingItem = () => {
    if (!question) return;

    const left = [...(question.options.left || [])];

    const right = [...(question.options.right || [])];

    const nextLeftId = `L${left.length + 1}`;

    const nextRightId = `R${right.length + 1}`;
    left.push({ id: nextLeftId, text: '' });
    right.push({ id: nextRightId, text: '' });

    const correct = { ...question.correct_answer, [nextLeftId]: nextRightId };
    onChange({
      ...question,
      options: { left, right },
      correct_answer: correct
    });
  };

  const removeMatchingItem = (index: number) => {
    if (!question) return;

    const left = (question.options.left || []).filter((_: any, idx: number) => idx !== index);

    const right = (question.options.right || []).filter((_: any, idx: number) => idx !== index);
    // Rebuild correct answer matches based on remaining indexes

    const correct: any = {};
    left.forEach((l: any, idx: number) => {
      if (right[idx]) {
        correct[l.id] = right[idx].id;
      }

    });
    onChange({
      ...question,
      options: { left, right },
      correct_answer: correct
    });
  };

  const updateMatchingItemText = (side: 'left' | 'right', index: number, text: string) => {
    if (!question) return;

    const left = (question.options.left || []).map((item: any, idx: number) =>
      side === 'left' && idx === index ? { ...item, text } : item
    );

    const right = (question.options.right || []).map((item: any, idx: number) =>
      side === 'right' && idx === index ? { ...item, text } : item
    );
    onChange({ ...question, options: { left, right } });
  };

  // Image Upload handler

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImage(true);

      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadQuestionImage(formData);
      onChange({ ...question, image_url: res.data?.image_url || res.data?.url });
    } catch (err) {
      console.error('Lỗi upload ảnh:', err);
      alert('Không thể tải ảnh lên.');
    } finally {
      setIsUploadingImage(false);
    }

  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        e.preventDefault();
        onSave();
      }

    }

  };

  return (
    <div className="storyline-editor" onKeyDown={handleKeyDown}>
      {/* Title Bar (with integrated premium dropdown type selector) */}
      <div className="storyline-title-bar-wrapper" ref={dropdownRef} style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }}>
        <div
          className="storyline-title-bar"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '12px', userSelect: 'none' }}
          onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getQuestionTypeIcon(question.question_type)}
            <span>
              {question.question_type === 'single_choice' ? 'Câu hỏi Trắc nghiệm 1 đáp án' :
                question.question_type === 'multiple_choice' ? 'Câu hỏi Trắc nghiệm nhiều đáp án' :
                  question.question_type === 'true_false' ? 'Câu hỏi Đúng / Sai' :
                    question.question_type === 'multi_true_false' ? 'Câu hỏi Đúng / Sai nhiều phát biểu độc lập' :
                      question.question_type === 'matching' ? 'Câu hỏi Nối cột' :
                        question.question_type === 'ordering' ? 'Câu hỏi Sắp xếp thứ tự' :
                          question.question_type === 'hotspot' ? 'Câu hỏi Click chọn điểm trên hình (Hotspot)' :
                            question.question_type === 'short_answer' ? 'Câu hỏi Trả lời ngắn / Điền từ' : 'Câu hỏi'}
            </span>
          </div>
          <ChevronDown size={16} style={{ transform: isTypeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </div>
        {isTypeDropdownOpen && (
          <div className="custom-select-options" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, borderTop: 'none', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', maxHeight: '300px', overflowY: 'auto' }}>
            {QUESTION_TYPES.map((t) => (
              <div
                key={t.value}
                className={`custom-select-option ${question.question_type === t.value ? 'selected' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}
                onClick={() => {
                  onTypeChange(t.value);
                  setIsTypeDropdownOpen(false);
                }}
              >
                {getQuestionTypeIcon(t.value)}
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Question Text Row (Unified box as in the Storyline mockup) */}
      <div className="storyline-question-box">
        <textarea
          value={question.question_text}
          onChange={(e) => onChange({ ...question, question_text: e.target.value })}
          placeholder={getPlaceholderText(question.question_type)}
          className="storyline-question-textarea"
        />
        <div className="storyline-question-media-panel">
          {/* Ảnh xem trước nhỏ (Thumbnail) */}
          {question.image_url && question.question_type !== 'hotspot' && (
            <div className="storyline-media-thumbnail-wrapper">
              <img
                src={getMediaUrl(question.image_url)}
                alt="Ảnh câu hỏi"
                className="storyline-media-thumbnail"
              />
              <button
                type="button"
                className="storyline-media-thumbnail-remove"
                onClick={() => onChange({ ...question, image_url: '' })}
                title="Xóa ảnh"
              >
                <X size={10} />
              </button>
            </div>
          )}
          {/* Button 1: Upload hình ảnh */}
          <button
            type="button"
            className="storyline-question-media-btn"
            title="Tải lên hình ảnh"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingImage ? <div className="upload-spinner-small" /> : <ImageIcon size={16} />}
          </button>
          {/* Button 2: Upload video */}
          <button
            type="button"
            className="storyline-question-media-btn"
            title="Tải lên video"
            onClick={() => videoFileInputRef.current?.click()}
          >
            {isUploadingVideo ? <div className="upload-spinner-small" /> : <Video size={16} />}
          </button>
          {/* Button 3: Bật / Tắt tiếng */}
          <button
            type="button"
            className={`storyline-question-media-btn ${question.sound_enabled ? 'sound-active' : ''}`}
            title={question.sound_enabled ? "Tắt âm thanh (Đang bật)" : "Bật âm thanh (Đang tắt)"}
            onClick={toggleSound}
            style={{ color: question.sound_enabled ? '#16a34a' : '#ef4444' }}
          >
            {question.sound_enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />
      {/* Hidden file input for video upload */}
      <input
        type="file"
        ref={videoFileInputRef}
        onChange={handleVideoUpload}
        accept="video/*"
        style={{ display: 'none' }}
      />
      {/* Video Preview if exists */}
      {question.video_url && (
        <div className="editor-video-preview-wrapper" style={{ margin: '0 12px 1.25rem 0', position: 'relative', display: 'inline-block', verticalAlign: 'top' }}>
          <video src={getMediaUrl(question.video_url)} controls style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          <button
            type="button"
            onClick={() => onChange({ ...question, video_url: '' })}
            style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', zIndex: 10 }}
          >
            <X size={10} />
          </button>
        </div>
      )}
      {/* Choices Section */}
      <div className="storyline-section-title">Các lựa chọn đáp án</div>
      {/* RENDER DYNAMIC SUB-EDITORS BY QUESTION TYPE */}
      {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
        <ChoiceQuestionEditor
          question={question}
          onChange={onChange}
          renderedOptions={renderedOptions}
          updateOptionText={updateOptionText}
          addOptionItem={addOptionItem}
          removeOptionItem={removeOptionItem}
        />
      )}
      {question.question_type === 'true_false' && (
        <TrueFalseQuestionEditor
          question={question}
          onChange={onChange}
          updateOptionText={updateOptionText}
        />
      )}
      {question.question_type === 'multi_true_false' && (
        <MultiTrueFalseQuestionEditor
          question={question}
          onChange={onChange}
          updateOptionText={updateOptionText}
          addMultiTFStatement={addMultiTFStatement}
          removeMultiTFStatement={removeMultiTFStatement}
          toggleMultiTFCorrect={toggleMultiTFCorrect}
        />
      )}
      {question.question_type === 'matching' && (
        <MatchingQuestionEditor
          question={question}
          onChange={onChange}
          addMatchingItem={addMatchingItem}
          removeMatchingItem={removeMatchingItem}
          updateMatchingItemText={updateMatchingItemText}
        />
      )}
      {question.question_type === 'ordering' && (
        <OrderingQuestionEditor
          question={question}
          onChange={onChange}
          updateOptionText={updateOptionText}
        />
      )}
      {question.question_type === 'short_answer' && (
        <ShortAnswerQuestionEditor
          question={question}
          onChange={onChange}
        />
      )}
      {question.question_type === 'hotspot' && (
        <HotspotQuestionEditor
          question={question}
          onChange={onChange}
          getMediaUrl={getMediaUrl}
        />
      )}
      {/* FEEDBACK & SCORE SECTION */}
      <div className="storyline-section-title" style={{ marginTop: '1.5rem' }}>Phản hồi & Điểm số</div>
      <div style={{ width: '100%', marginBottom: '1.5rem' }}>
        <table className="storyline-table">
          <thead>
            <tr>
              <th style={{ width: '100px' }}>Kết quả</th>
              <th className="col-feedback-input">Phản hồi</th>
              <th style={{ width: '40px' }}></th>
              <th className="col-score" style={{ width: '80px', textAlign: 'center' }}>Điểm số</th>
            </tr>
          </thead>
          <tbody>
            {/* Correct Feedback Row */}
            <tr>
              <td className="col-label" style={{ fontWeight: 'normal', paddingLeft: '12px', textAlign: 'left' }}>Đúng</td>
              <td className="col-feedback-input">
                <div className="storyline-input-cell">
                  <input
                    type="text"
                    value={correctVal}
                    onChange={(e) => handleCorrectFeedbackChange(e.target.value)}
                    placeholder="Chính xác! Bạn làm tốt lắm"
                    className="storyline-input"
                  />
                </div>
              </td>
              <td className="col-more" style={{ textAlign: 'center' }}>
                <button type="button" className="storyline-more-btn">...</button>
              </td>
              <td className="col-score" style={{ textAlign: 'center' }}>
                <input
                  type="number"
                  value={question.points || 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onChange({ ...question, points: isNaN(val) ? 0 : val });
                  }}
                  className="storyline-score-input"
                  min={0}
                />
              </td>
            </tr>
            {/* Incorrect Feedback Row */}
            <tr>
              <td className="col-label" style={{ fontWeight: 'normal', paddingLeft: '12px', textAlign: 'left' }}>Sai</td>
              <td className="col-feedback-input">
                <div className="storyline-input-cell">
                  <input
                    type="text"
                    value={incorrectVal}
                    onChange={(e) => handleIncorrectFeedbackChange(e.target.value)}
                    placeholder="Sai rồi! Bạn nhớ xem lại đáp án đúng nhé"
                    className="storyline-input"
                  />
                </div>
              </td>
              <td className="col-more" style={{ textAlign: 'center' }}>
                <button type="button" className="storyline-more-btn">...</button>
              </td>
              <td className="col-score" style={{ textAlign: 'center' }}>
                <input
                  type="text"
                  value="0"
                  disabled
                  className="storyline-score-input"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuestionFormEditor;