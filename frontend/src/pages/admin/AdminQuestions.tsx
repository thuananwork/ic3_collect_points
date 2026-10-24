import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, Sparkles, X, Upload, ListChecks, Download } from 'lucide-react';
import { getQuizDetail, getQuizzes, createQuestion, updateQuestion, deleteQuestion, importQuizQuestionsExcel, batchDeleteQuestions } from '../../api';
import { encodeId, slugify } from '../../utils/scoring';
import ConfirmModal from '../../components/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import QuestionReviewModal from '../../components/QuestionReviewModal';
import QuestionSlideView from '../../components/QuestionSlideView';
import QuestionFormEditor from '../../components/QuestionFormEditor';
import '../../components/css/QuestionReviewModal.css';
import './css/AdminQuestions.css';

interface Question {
  question_id?: number;
  question_type: string;
  question_text: string;
  image_url: string;
  video_url?: string;
  sound_enabled?: boolean;
  options: any;
  correct_answer: any;
  explanation: string;
  points: number;
}

interface QuizDetails {
  quiz_id: number;
  title: string;
  description: string;
  time_limit: number;
  questions: Question[];
}

const WIZARD_TYPES = [
  {
    value: 'single_choice',
    label: 'Trắc nghiệm 1 đáp án',
    desc: 'Lựa chọn duy nhất một câu trả lời chính xác từ danh sách.',
    category: 'graded',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <line x1="20" y1="25" x2="140" y2="25" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="35" x2="100" y2="35" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="30" cy="55" r="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2"/>
        <circle cx="30" cy="55" r="3" fill="#3b82f6"/>
        <line x1="45" y1="55" x2="130" y2="55" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="30" cy="75" r="6" fill="white" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="45" y1="75" x2="130" y2="75" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    value: 'multiple_choice',
    label: 'Trắc nghiệm nhiều đáp án',
    desc: 'Chọn nhiều phương án trả lời đúng từ danh sách.',
    category: 'graded',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <line x1="20" y1="25" x2="140" y2="25" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="35" x2="100" y2="35" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <rect x="24" y="49" width="12" height="12" rx="2" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2"/>
        <path d="M28 55L30 57L33 52" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="45" y1="55" x2="130" y2="55" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round"/>
        <rect x="24" y="69" width="12" height="12" rx="2" fill="white" stroke="#cbd5e1" strokeWidth="2"/>
        <line x1="45" y1="75" x2="130" y2="75" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    value: 'true_false',
    label: 'Đúng / Sai',
    desc: 'Lựa chọn nhận định đưa ra là chính xác hay không chính xác.',
    category: 'graded',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <line x1="20" y1="25" x2="140" y2="25" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="35" x2="80" y2="35" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <rect x="24" y="52" width="12" height="12" rx="2" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2"/>
        <path d="M28 58L30 60L33 55" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <line x1="45" y1="58" x2="80" y2="58" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"/>
        <rect x="94" y="52" width="12" height="12" rx="2" fill="white" stroke="#94a3b8" strokeWidth="2"/>
        <line x1="115" y1="58" x2="140" y2="58" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    value: 'multi_true_false',
    label: 'Đúng / Sai nhiều ý',
    desc: 'Kiểm tra nhiều nhận định cùng lúc, mỗi nhận định chọn độc lập.',
    category: 'graded',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <line x1="18" y1="22" x2="142" y2="22" stroke="#cbd5e1" strokeWidth="3"/>
        <line x1="18" y1="42" x2="70" y2="42" stroke="#94a3b8" strokeWidth="3"/>
        <circle cx="100" cy="42" r="5" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5"/>
        <circle cx="100" cy="42" r="2.5" fill="#3b82f6"/>
        <circle cx="130" cy="42" r="5" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
        <line x1="18" y1="62" x2="80" y2="62" stroke="#cbd5e1" strokeWidth="3"/>
        <circle cx="100" cy="62" r="5" fill="white" stroke="#cbd5e1" strokeWidth="1.5"/>
        <circle cx="130" cy="62" r="5" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5"/>
        <circle cx="130" cy="62" r="2.5" fill="#3b82f6"/>
        <text x="96" y="33" fontSize="7" fontWeight="bold" fill="#3b82f6">T</text>
        <text x="127" y="33" fontSize="7" fontWeight="bold" fill="#ef4444">F</text>
      </svg>
    )
  },
  {
    value: 'short_answer',
    label: 'Trả lời ngắn / Điền từ',
    desc: 'Điền từ khóa hoặc câu trả lời ngắn vào ô văn bản.',
    category: 'graded',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <line x1="20" y1="25" x2="140" y2="25" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <line x1="20" y1="35" x2="100" y2="35" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round"/>
        <rect x="20" y="52" width="120" height="24" rx="4" fill="white" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="28" y="68" fontSize="11" fontFamily="monospace" fontWeight="bold" fill="#3b82f6">abc</text>
        <line x1="52" y1="58" x2="52" y2="70" stroke="#3b82f6" strokeWidth="1.5"/>
      </svg>
    )
  },
  {
    value: 'ordering',
    label: 'Sắp xếp thứ tự',
    desc: 'Sắp xếp các mục theo thứ tự logic, quy trình hoặc thời gian.',
    category: 'interactive',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <rect x="25" y="22" width="110" height="15" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1.2"/>
        <text x="32" y="32" fontSize="8" fontWeight="bold" fill="#94a3b8">1</text>
        <line x1="45" y1="30" x2="120" y2="30" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="25" y="42" width="110" height="15" rx="3" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.2"/>
        <text x="32" y="52" fontSize="8" fontWeight="bold" fill="#3b82f6">2</text>
        <line x1="45" y1="50" x2="120" y2="50" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="25" y="62" width="110" height="15" rx="3" fill="white" stroke="#cbd5e1" strokeWidth="1.2"/>
        <text x="32" y="72" fontSize="8" fontWeight="bold" fill="#94a3b8">3</text>
        <line x1="45" y1="70" x2="120" y2="70" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    value: 'matching',
    label: 'Nối cột',
    desc: 'Nối các khái niệm bên trái với các ý phù hợp bên phải.',
    category: 'interactive',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <rect x="20" y="24" width="40" height="14" rx="3" fill="white" stroke="#3b82f6" strokeWidth="1"/>
        <line x1="25" y1="31" x2="50" y2="31" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
        <rect x="100" y="24" width="40" height="14" rx="3" fill="white" stroke="#3b82f6" strokeWidth="1"/>
        <line x1="105" y1="31" x2="130" y2="31" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
        <path d="M 60 31 L 100 31" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,3" fill="none"/>
        <rect x="20" y="54" width="40" height="14" rx="3" fill="white" stroke="#8b5cf6" strokeWidth="1"/>
        <line x1="25" y1="61" x2="50" y2="61" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
        <rect x="100" y="54" width="40" height="14" rx="3" fill="white" stroke="#8b5cf6" strokeWidth="1"/>
        <line x1="105" y1="61" x2="130" y2="61" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
        <path d="M 60 61 L 100 61" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3,3" fill="none"/>
      </svg>
    )
  },
  {
    value: 'hotspot',
    label: 'Hotspot (Chọn vùng ảnh)',
    desc: 'Nhấp chọn một hoặc nhiều khu vực cụ thể trên hình ảnh.',
    category: 'interactive',
    svg: (
      <svg viewBox="0 0 160 100" className="wizard-svg">
        <rect x="10" y="10" width="140" height="80" rx="6" fill="#f8fafc" stroke="#3b82f6" strokeWidth="1.5"/>
        <rect x="18" y="18" width="124" height="64" rx="4" fill="#eff6ff" stroke="#cbd5e1" strokeWidth="1"/>
        <circle cx="110" cy="32" r="5" fill="#f59e0b"/>
        <polygon points="25,75 55,40 85,75" fill="#93c5fd" opacity="0.7"/>
        <polygon points="65,75 90,50 120,75" fill="#60a5fa" opacity="0.8"/>
        <rect x="45" y="38" width="22" height="22" rx="2" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2"/>
        <circle cx="56" cy="49" r="2" fill="#ef4444"/>
      </svg>
    )
  }
];

const AdminQuestions: React.FC = () => {
  const { quizId: rawQuizId } = useParams<{ quizId: string }>();
  const [resolvedQuizId, setResolvedQuizId] = useState<number>(0);
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showTypeWizard, setShowTypeWizard] = useState(false);
  const [wizardCategory, setWizardCategory] = useState<'graded' | 'interactive'>('graded');
  const { modalConfig, showConfirm, closeConfirmModal } = useConfirmModal();

  // Multi-select state
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

  // View mode and search query
  const [currentViewMode, setCurrentViewMode] = useState<'form' | 'slide'>('form');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedPane, setFocusedPane] = useState<'sidebar' | 'editor'>('sidebar');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    question: Question;
    index: number;
  } | null>(null);

  // Copied question state (supports Copy / Paste)
  const [copiedQuestion, setCopiedQuestion] = useState<Question | null>(null);

  // Context Menu event handler
  const handleContextMenu = (e: React.MouseEvent, q: Question, index: number) => {
    e.preventDefault();
    const menuHeight = 245;
    const menuWidth = 175;
    let y = e.clientY;
    let x = e.clientX;
    if (window.innerHeight - e.clientY < menuHeight) {
      y = e.clientY - menuHeight;
      if (y < 0) y = 10;
    }
    if (window.innerWidth - e.clientX < menuWidth) {
      x = e.clientX - menuWidth;
      if (x < 0) x = 10;
    }
    setContextMenu({ x, y, question: q, index });
  };

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Context Menu action handlers
  const handleCopyQuestion = (q: Question) => {
    setCopiedQuestion({ ...q, question_id: undefined });
    setSuccessMsg('Đã sao chép câu hỏi.');
  };

  const handlePasteQuestion = async () => {
    if (!copiedQuestion || !resolvedQuizId) return;
    const tempId = -Date.now();
    const optimisticPasted = {
      ...copiedQuestion,
      question_id: tempId
    };
    setQuiz(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: [...prev.questions, optimisticPasted]
      };
    });
    loadQuestionForEditing(optimisticPasted);
    setSuccessMsg('Đã dán câu hỏi mới thành công.');
    try {
      const res = await createQuestion(resolvedQuizId, copiedQuestion);
      if (res.data && res.data.question_id) {
        const realPasted = {
          ...copiedQuestion,
          question_id: res.data.question_id
        };
        setQuiz(prev => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.map(item => item.question_id === tempId ? realPasted : item)
          };
        });
        setActiveQuestion(prev => prev && prev.question_id === tempId ? realPasted : prev);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Không thể dán câu hỏi.');
      setQuiz(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.filter(item => item.question_id !== tempId)
        };
      });
      setActiveQuestion(prev => prev && prev.question_id === tempId ? null : prev);
    }
  };

  const handleDuplicateQuestion = async (q: Question) => {
    if (!resolvedQuizId) return;
    const duplicated = { ...q, question_id: undefined };
    const tempId = -Date.now();
    const optimisticDuplicated = {
      ...duplicated,
      question_id: tempId
    };
    setQuiz(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: [...prev.questions, optimisticDuplicated]
      };
    });
    loadQuestionForEditing(optimisticDuplicated);
    setSuccessMsg('Nhân bản câu hỏi thành công.');
    try {
      const res = await createQuestion(resolvedQuizId, duplicated);
      if (res.data && res.data.question_id) {
        const realDuplicated = {
          ...duplicated,
          question_id: res.data.question_id
        };
        setQuiz(prev => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.map(item => item.question_id === tempId ? realDuplicated : item)
          };
        });
        setActiveQuestion(prev => prev && prev.question_id === tempId ? realDuplicated : prev);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Không thể nhân bản câu hỏi.');
      setQuiz(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.filter(item => item.question_id !== tempId)
        };
      });
      setActiveQuestion(prev => prev && prev.question_id === tempId ? null : prev);
    }
  };

  const handleSwapQuestions = async (idx1: number, idx2: number) => {
    if (!quiz || !quiz.questions[idx1] || !quiz.questions[idx2]) return;
    const q1 = quiz.questions[idx1];
    const q2 = quiz.questions[idx2];
    if (!q1.question_id || !q2.question_id) return;
    const originalQuestions = [...quiz.questions];
    const q1Data = {
      question_type: q2.question_type,
      question_text: q2.question_text,
      image_url: q2.image_url,
      options: q2.options,
      correct_answer: q2.correct_answer,
      explanation: q2.explanation,
      points: q2.points,
      video_url: q2.video_url,
      sound_enabled: q2.sound_enabled
    };
    const q2Data = {
      question_type: q1.question_type,
      question_text: q1.question_text,
      image_url: q1.image_url,
      options: q1.options,
      correct_answer: q1.correct_answer,
      explanation: q1.explanation,
      points: q1.points,
      video_url: q1.video_url,
      sound_enabled: q1.sound_enabled
    };
    setQuiz(prev => {
      if (!prev) return null;
      const updatedQs = [...prev.questions];
      updatedQs[idx1] = { ...q1, ...q1Data };
      updatedQs[idx2] = { ...q2, ...q2Data };
      return { ...prev, questions: updatedQs };
    });
    if (activeQuestion?.question_id === q1.question_id) {
      setActiveQuestion(prev => prev ? { ...prev, ...q1Data } : null);
    } else if (activeQuestion?.question_id === q2.question_id) {
      setActiveQuestion(prev => prev ? { ...prev, ...q2Data } : null);
    }
    setSuccessMsg('Đã thay đổi thứ tự câu hỏi.');
    try {
      await updateQuestion(q1.question_id, q1Data);
      await updateQuestion(q2.question_id, q2Data);
      fetchQuizDetails(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Không thể thay đổi thứ tự câu hỏi.');
      setQuiz(prev => {
        if (!prev) return null;
        return { ...prev, questions: originalQuestions };
      });
      if (activeQuestion?.question_id === q1.question_id) {
        const origQ1 = originalQuestions.find(item => item.question_id === q1.question_id);
        if (origQ1) setActiveQuestion(origQ1);
      } else if (activeQuestion?.question_id === q2.question_id) {
        const origQ2 = originalQuestions.find(item => item.question_id === q2.question_id);
        if (origQ2) setActiveQuestion(origQ2);
      }
    }
  };

  // Debounced auto-save effect
  const activeQuestionRef = useRef<Question | null>(null);
  activeQuestionRef.current = activeQuestion;
  const currentActiveIdRef = useRef<number | undefined>(undefined);
  currentActiveIdRef.current = activeQuestion?.question_id;
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!activeQuestion || !resolvedQuizId) return;
    const originalQ = quiz?.questions.find(q => q.question_id === activeQuestion.question_id);
    if (!originalQ) return;
    const isTextChanged = activeQuestion.question_text !== originalQ.question_text;
    const isTypeChanged = activeQuestion.question_type !== originalQ.question_type;
    const isImageChanged = activeQuestion.image_url !== originalQ.image_url;
    const isVideoChanged = activeQuestion.video_url !== originalQ.video_url;
    const isSoundChanged = activeQuestion.sound_enabled !== originalQ.sound_enabled;
    const isExplanationChanged = activeQuestion.explanation !== originalQ.explanation;
    const isPointsChanged = activeQuestion.points !== originalQ.points;
    const isOptionsChanged = JSON.stringify(activeQuestion.options) !== JSON.stringify(originalQ.options);
    const isAnswerChanged = JSON.stringify(activeQuestion.correct_answer) !== JSON.stringify(originalQ.correct_answer);
    const hasChanges = isTextChanged || isTypeChanged || isImageChanged || isVideoChanged || isSoundChanged || isExplanationChanged || isPointsChanged || isOptionsChanged || isAnswerChanged;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    if (!hasChanges) {
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
    const timer = setTimeout(async () => {
      const questionToSave = activeQuestionRef.current;
      if (!questionToSave || !questionToSave.question_id) return;
      try {
        await updateQuestion(questionToSave.question_id, questionToSave);
        setQuiz(prev => {
          if (!prev) return null;
          const updatedQs = prev.questions.map(q =>
            q.question_id === questionToSave.question_id ? { ...questionToSave } : q
          );
          return { ...prev, questions: updatedQs };
        });
      } catch (err) {
        console.error('Lỗi tự động lưu:', err);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const isSwitching = activeQuestion.question_id !== currentActiveIdRef.current;
      const isUnmounting = isUnmountingRef.current;
      if (activeQuestion.question_id && (isSwitching || isUnmounting)) {
        updateQuestion(activeQuestion.question_id, activeQuestion)
          .then(() => {
            setQuiz(prev => {
              if (!prev) return null;
              const updatedQs = prev.questions.map(orig =>
                orig.question_id === activeQuestion.question_id ? { ...activeQuestion } : orig
              );
              return { ...prev, questions: updatedQs };
            });
          })
          .catch(err =>
            console.error('Lỗi tự động lưu ngầm:', err)
          );
      }
    };
  }, [activeQuestion, resolvedQuizId, quiz]);

  // Excel import state and ref
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !resolvedQuizId) return;
    setIsImportingExcel(true);
    setErrorMsg('');
    setSuccessMsg('');
    const startTime = Date.now();
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await importQuizQuestionsExcel(resolvedQuizId, formData);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (res.data.status === 'success') {
        setSuccessMsg(`${res.data.message || 'Nhập câu hỏi từ Excel thành công!'} (${elapsed}s)`);
        fetchQuizDetails();
      } else {
        setErrorMsg(res.data.message || 'Lỗi nhập câu hỏi từ Excel.');
      }
    } catch (err: any) {
      console.error('Lỗi import excel:', err);
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi nhập câu hỏi từ Excel.');
    } finally {
      setIsImportingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    }
  };

  // Selection handlers
  const handleSelectQuestionItem = (q: Question, index: number, event: React.MouseEvent) => {
    if (!quiz?.questions || q.question_id === undefined) return;
    const filtered = quiz.questions.filter(item =>
      (item.question_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.question_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (event.ctrlKey || event.metaKey) {
      setSelectedQuestionIds(prev => {
        const isSelected = prev.includes(q.question_id!);
        if (isSelected) {
          const nextSelected = prev.filter(id => id !== q.question_id);
          if (activeQuestion?.question_id === q.question_id) {
            if (nextSelected.length > 0) {
              const lastId = nextSelected[nextSelected.length - 1];
              const lastQ = quiz.questions.find(orig => orig.question_id === lastId);
              if (lastQ) loadQuestionForEditing(lastQ);
            } else {
              setActiveQuestion(null);
            }
          }
          return nextSelected;
        } else {
          loadQuestionForEditing(q);
          return [...prev, q.question_id!];
        }
      });
    } else if (event.shiftKey && activeQuestion) {
      const prevIdx = filtered.findIndex(item => item.question_id === activeQuestion.question_id);
      if (prevIdx !== -1) {
        const start = Math.min(prevIdx, index);
        const end = Math.max(prevIdx, index);
        const rangeIds = filtered.slice(start, end + 1).map(item => item.question_id!).filter(Boolean);
        setSelectedQuestionIds(rangeIds);
        loadQuestionForEditing(q);
      } else {
        setSelectedQuestionIds([q.question_id]);
        loadQuestionForEditing(q);
      }
    } else {
      setSelectedQuestionIds([q.question_id]);
      loadQuestionForEditing(q);
    }
  };

  useEffect(() => {
    fetchQuizDetails();
  }, [rawQuizId]);

  const fetchQuizDetails = async (silent = false) => {
    if (!rawQuizId) return;
    if (!silent) setLoading(true);
    try {
      let targetQuizId = resolvedQuizId;
      if (!targetQuizId) {
        const quizzesRes = await getQuizzes();
        const quizzesList = quizzesRes.data;
        const matched = quizzesList.find((q: any) => {
          return slugify(q.title) === rawQuizId ||
            encodeId(q.quiz_id) === rawQuizId ||
            String(q.quiz_id) === rawQuizId;
        });
        if (matched) {
          targetQuizId = matched.quiz_id;
          setResolvedQuizId(matched.quiz_id);
        }
      }
      if (targetQuizId) {
        const res = await getQuizDetail(targetQuizId);
        setQuiz(res.data);
        if (res.data.questions && res.data.questions.length > 0) {
          if (!silent) {
            loadQuestionForEditing(res.data.questions[0]);
          } else if (activeQuestionRef.current) {
            const updatedActive = res.data.questions.find((q: any) => q.question_id === activeQuestionRef.current?.question_id);
            if (updatedActive) {
              loadQuestionForEditing(updatedActive);
            }
          }
        } else {
          setActiveQuestion(null);
        }
      } else {
        setErrorMsg('Không tìm thấy bài kiểm tra tương ứng.');
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết đề thi:', err);
      setErrorMsg('Không thể tải chi tiết đề thi.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const initNewQuestion = async (type: string) => {
    if (!resolvedQuizId) return;
    if (activeQuestion && activeQuestion.question_id) {
      const originalQ = quiz?.questions.find(q => q.question_id === activeQuestion.question_id);
      if (originalQ) {
        const isTextChanged = activeQuestion.question_text !== originalQ.question_text;
        const isTypeChanged = activeQuestion.question_type !== originalQ.question_type;
        const isImageChanged = activeQuestion.image_url !== originalQ.image_url;
        const isVideoChanged = activeQuestion.video_url !== originalQ.video_url;
        const isSoundChanged = activeQuestion.sound_enabled !== originalQ.sound_enabled;
        const isExplanationChanged = activeQuestion.explanation !== originalQ.explanation;
        const isPointsChanged = activeQuestion.points !== originalQ.points;
        const isOptionsChanged = JSON.stringify(activeQuestion.options) !== JSON.stringify(originalQ.options);
        const isAnswerChanged = JSON.stringify(activeQuestion.correct_answer) !== JSON.stringify(originalQ.correct_answer);
        const hasChanges = isTextChanged || isTypeChanged || isImageChanged || isVideoChanged || isSoundChanged || isExplanationChanged || isPointsChanged || isOptionsChanged || isAnswerChanged;
        if (hasChanges) {
          try {
            await updateQuestion(activeQuestion.question_id, activeQuestion);
          } catch (err) {
            console.error('Lỗi tự động lưu trước khi thêm câu hỏi mới:', err);
          }
        }
      }
    }
    let defaultOptions: any = [];
    let defaultCorrect: any = null;
    if (type === 'single_choice') {
      defaultOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' }
      ];
      defaultCorrect = 'A';
    } else if (type === 'multiple_choice') {
      defaultOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' }
      ];
      defaultCorrect = [];
    } else if (type === 'true_false') {
      defaultOptions = [
        { id: 'T', text: 'Đúng' },
        { id: 'F', text: 'Sai' }
      ];
      defaultCorrect = 'T';
    } else if (type === 'multi_true_false') {
      defaultOptions = {
        columnLeft: 'Đúng',
        columnRight: 'Sai',
        statements: [
          { id: '1', text: '' },
          { id: '2', text: '' }
        ]
      };
      defaultCorrect = { '1': 'T', '2': 'T' };
    } else if (type === 'matching') {
      defaultOptions = {
        left: [
          { id: 'L1', text: '' },
          { id: 'L2', text: '' }
        ],
        right: [
          { id: 'R1', text: '' },
          { id: 'R2', text: '' }
        ]
      };
      defaultCorrect = { 'L1': 'R1', 'L2': 'R2' };
    } else if (type === 'ordering') {
      defaultOptions = [
        { id: '1', text: '' },
        { id: '2', text: '' },
        { id: '3', text: '' }
      ];
      defaultCorrect = ['1', '2', '3'];
    } else if (type === 'hotspot') {
      defaultOptions = { max_selections: 1 };
      defaultCorrect = { x: 20, y: 20, w: 60, h: 60 };
    } else if (type === 'short_answer') {
      defaultOptions = [];
      defaultCorrect = '';
    }
    const defaultNewQ = {
      question_type: type,
      question_text: '',
      image_url: '',
      options: defaultOptions,
      correct_answer: defaultCorrect,
      explanation: 'Chính xác: Chính xác\nKhông chính xác: Tiếc quá, câu trả lời chưa đúng rồi.',
      points: 1
    };
    const tempId = -Date.now();
    const optimisticNewQ = {
      ...defaultNewQ,
      question_id: tempId
    };
    setQuiz(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: [...prev.questions, optimisticNewQ]
      };
    });
    loadQuestionForEditing(optimisticNewQ);
    try {
      const res = await createQuestion(resolvedQuizId, defaultNewQ);
      if (res.data && res.data.question_id) {
        const realNewQ = {
          ...defaultNewQ,
          question_id: res.data.question_id
        };
        setQuiz(prev => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.map(q => q.question_id === tempId ? realNewQ : q)
          };
        });
        setActiveQuestion(prev => {
          if (prev && prev.question_id === tempId) {
            return realNewQ;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Không thể tự động tạo câu hỏi mới.');
      setQuiz(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.filter(q => q.question_id !== tempId)
        };
      });
      setActiveQuestion(prev => prev && prev.question_id === tempId ? null : prev);
    }
  };

  const loadQuestionForEditing = (q: Question) => {
    let cleanedQ = { ...q };
    if (Array.isArray(cleanedQ.options) && cleanedQ.options.length > 4 && (cleanedQ.question_type === 'single_choice' || cleanedQ.question_type === 'multiple_choice')) {
      const hasEmptyExtraOptions = cleanedQ.options.slice(4).every((opt: any) =>
        !opt.text || opt.text.trim() === '' || opt.text.toLowerCase() === 'none' || opt.text.toLowerCase() === 'nan'
      );
      if (hasEmptyExtraOptions) {
        cleanedQ.options = cleanedQ.options.slice(0, 4);
      }
    }
    setActiveQuestion(cleanedQ);
    setIsEditingExisting(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDeleteQuestion = (qId?: number) => {
    if (!qId) return;
    showConfirm(
      'Xác nhận xóa câu hỏi',
      'Bạn có chắc chắn muốn xóa câu hỏi này?',
      async () => {
        const originalQuestions = quiz?.questions || [];
        const deleteIdx = originalQuestions.findIndex(q => q.question_id === qId);
        let nextActiveQ: Question | null = null;
        if (activeQuestion?.question_id === qId && deleteIdx !== -1 && originalQuestions.length > 1) {
          if (deleteIdx < originalQuestions.length - 1) {
            nextActiveQ = originalQuestions[deleteIdx + 1];
          } else {
            nextActiveQ = originalQuestions[deleteIdx - 1];
          }
        }
        setQuiz(prev => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.filter(q => q.question_id !== qId)
          };
        });
        if (activeQuestion?.question_id === qId) {
          setActiveQuestion(nextActiveQ);
        }
        setSelectedQuestionIds(prev => prev.filter(id => id !== qId));
        try {
          await deleteQuestion(qId);
          fetchQuizDetails(true);
        } catch (err) {
          console.error('Lỗi khi xóa câu hỏi:', err);
          setErrorMsg('Không thể xóa câu hỏi.');
          setQuiz(prev => {
            if (!prev) return null;
            return {
              ...prev,
              questions: originalQuestions
            };
          });
          if (activeQuestion?.question_id === qId) {
            const currentQ = originalQuestions.find(q => q.question_id === qId);
            if (currentQ) setActiveQuestion(currentQ);
          }
        }
      },
      'danger'
    );
  };

  const handleDeleteSelectedQuestions = () => {
    if (selectedQuestionIds.length === 0) return;
    showConfirm(
      'Xác nhận xóa nhiều câu hỏi',
      `Bạn có chắc chắn muốn xóa ${selectedQuestionIds.length} câu hỏi đã chọn?`,
      async () => {
        const originalQuestions = quiz?.questions || [];
        const remainingQuestions = originalQuestions.filter(q => q.question_id && !selectedQuestionIds.includes(q.question_id));
        let nextActiveQ: Question | null = null;
        if (remainingQuestions.length > 0) {
          const currentActiveIdx = originalQuestions.findIndex(q => q.question_id === activeQuestion?.question_id);
          if (currentActiveIdx !== -1) {
            const rightQ = originalQuestions.slice(currentActiveIdx).find(q => q.question_id && !selectedQuestionIds.includes(q.question_id));
            if (rightQ) {
              nextActiveQ = rightQ;
            } else {
              const leftQs = originalQuestions.slice(0, currentActiveIdx).filter(q => q.question_id && !selectedQuestionIds.includes(q.question_id));
              if (leftQs.length > 0) {
                nextActiveQ = leftQs[leftQs.length - 1];
              }
            }
          } else {
            nextActiveQ = remainingQuestions[0];
          }
        }
        setQuiz(prev => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.filter(q => q.question_id && !selectedQuestionIds.includes(q.question_id))
          };
        });
        if (activeQuestion && selectedQuestionIds.includes(activeQuestion.question_id || -1)) {
          setActiveQuestion(nextActiveQ);
        }
        const deletedIdsCopy = [...selectedQuestionIds];
        setSelectedQuestionIds([]);
        try {
          await batchDeleteQuestions(deletedIdsCopy);
          fetchQuizDetails(true);
        } catch (err) {
          console.error('Lỗi khi xóa các câu hỏi:', err);
          setErrorMsg('Không thể xóa một số câu hỏi.');
          setQuiz(prev => {
            if (!prev) return null;
            return {
              ...prev,
              questions: originalQuestions
            };
          });
          setSelectedQuestionIds(deletedIdsCopy);
        }
      },
      'danger'
    );
  };

  // Keyboard navigation for question list (ArrowUp / ArrowDown / Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedPane !== 'sidebar') return;

      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }
      if (!quiz?.questions || quiz.questions.length === 0) return;
      const filtered = quiz.questions.filter(q =>
        (q.question_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.question_type || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length === 0) return;
      const currentIndex = filtered.findIndex(q => q.question_id === activeQuestion?.question_id);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex === -1) {
          loadQuestionForEditing(filtered[0]);
        } else if (currentIndex < filtered.length - 1) {
          loadQuestionForEditing(filtered[currentIndex + 1]);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          loadQuestionForEditing(filtered[currentIndex - 1]);
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedQuestionIds.length > 1) {
          handleDeleteSelectedQuestions();
        } else if (activeQuestion?.question_id) {
          handleDeleteQuestion(activeQuestion.question_id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    quiz,
    searchQuery,
    activeQuestion,
    loadQuestionForEditing,
    selectedQuestionIds,
    handleDeleteSelectedQuestions,
    handleDeleteQuestion,
    focusedPane
  ]);

  // Scroll active question item into view
  useEffect(() => {
    if (activeQuestion) {
      setTimeout(() => {
        const activeEl = document.querySelector('.sidebar-item.active');
        if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }
  }, [activeQuestion?.question_id]);

  const handleTypeChange = (type: string) => {
    if (!activeQuestion) return;
    let defaultOptions: any = [];
    let defaultCorrect: any = null;
    if (type === 'single_choice') {
      defaultOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' }
      ];
      defaultCorrect = 'A';
    } else if (type === 'multiple_choice') {
      defaultOptions = [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' }
      ];
      defaultCorrect = [];
    } else if (type === 'true_false') {
      defaultOptions = [
        { id: 'T', text: 'Đúng' },
        { id: 'F', text: 'Sai' }
      ];
      defaultCorrect = 'T';
    } else if (type === 'multi_true_false') {
      defaultOptions = {
        columnLeft: 'Đúng',
        columnRight: 'Sai',
        statements: [
          { id: '1', text: '' },
          { id: '2', text: '' }
        ]
      };
      defaultCorrect = { '1': 'T', '2': 'T' };
    } else if (type === 'matching') {
      defaultOptions = {
        left: [
          { id: 'L1', text: '' },
          { id: 'L2', text: '' }
        ],
        right: [
          { id: 'R1', text: '' },
          { id: 'R2', text: '' }
        ]
      };
      defaultCorrect = { 'L1': 'R1', 'L2': 'R2' };
    } else if (type === 'ordering') {
      defaultOptions = [
        { id: '1', text: 'Bước A' },
        { id: '2', text: 'Bước B' },
        { id: '3', text: 'Bước C' }
      ];
      defaultCorrect = ['1', '2', '3'];
    } else if (type === 'hotspot') {
      defaultOptions = {};
      defaultCorrect = { x: 20, y: 20, w: 60, h: 60 };
    } else if (type === 'short_answer') {
      defaultOptions = [];
      defaultCorrect = '';
    }
    setActiveQuestion({
      ...activeQuestion,
      question_type: type,
      options: defaultOptions,
      correct_answer: defaultCorrect
    });
  };

  // Save question handler
  const handleSaveQuestion = async () => {
    if (!activeQuestion || !resolvedQuizId) return;
    if (!activeQuestion.question_text.trim()) {
      setErrorMsg('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    if (activeQuestion.question_type === 'hotspot' && !activeQuestion.image_url) {
      setErrorMsg('Dạng câu hỏi Hotspot yêu cầu phải có Ảnh minh họa (Image URL).');
      return;
    }
    let questionToSave = { ...activeQuestion };
    if (questionToSave.question_type === 'short_answer') {
      const rawAns = typeof questionToSave.correct_answer === 'string'
        ? questionToSave.correct_answer
        : (Array.isArray(questionToSave.correct_answer) ? questionToSave.correct_answer.join(' / ') : '');
      const parts = rawAns.split('/').map(x => x.trim()).filter(Boolean);
      questionToSave.correct_answer = parts.length > 1 ? parts : (parts[0] || '');
    }
    try {
      const message = isEditingExisting ? 'Đã cập nhật câu hỏi thành công.' : 'Đã tạo câu hỏi mới thành công.';
      let savedQuestionId = questionToSave.question_id;
      if (isEditingExisting && savedQuestionId) {
        await updateQuestion(savedQuestionId, questionToSave);
      } else {
        const res = await createQuestion(resolvedQuizId, questionToSave);
        if (res.data && res.data.question_id) {
          savedQuestionId = res.data.question_id;
        }
      }
      const resDetails = await getQuizDetail(resolvedQuizId);
      setQuiz(resDetails.data);
      setErrorMsg('');
      setSuccessMsg(message);
      if (savedQuestionId) {
        const updatedQ = resDetails.data.questions.find((q: any) => q.question_id === savedQuestionId);
        if (updatedQ) {
          loadQuestionForEditing(updatedQ);
        } else if (resDetails.data.questions.length > 0) {
          loadQuestionForEditing(resDetails.data.questions[resDetails.data.questions.length - 1]);
        }
      } else if (resDetails.data.questions && resDetails.data.questions.length > 0) {
        loadQuestionForEditing(resDetails.data.questions[resDetails.data.questions.length - 1]);
      } else {
        setActiveQuestion(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi lưu câu hỏi.');
    }
  };

  // Synchronize selection with activeQuestion for single item operations
  useEffect(() => {
    if (activeQuestion?.question_id !== undefined) {
      setSelectedQuestionIds(prev => {
        if (prev.length <= 1 || !prev.includes(activeQuestion.question_id!)) {
          return [activeQuestion.question_id!];
        }
        return prev;
      });
    } else {
      setSelectedQuestionIds([]);
    }
  }, [activeQuestion?.question_id]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner"></div>
        <span style={{ color: 'var(--text-secondary)' }}>Đang tải ngân hàng câu hỏi...</span>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex-center" style={{ height: '70vh', color: 'red' }}>
        Không tìm thấy đề thi hoặc bạn không có quyền truy cập.
      </div>
    );
  }

  const filteredQuestions = quiz.questions.filter(q =>
    (q.question_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.question_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-questions-container">
      <div className="questions-unified-card glass">
        {/* HEADER NAVBAR */}
        <div className="questions-navbar">
          <button className="btn-back" onClick={() => navigate('/admin/quizzes')}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="quiz-info-header">
            <h2>{quiz.title}</h2>
            <span>Cấu trúc: {quiz.questions.length} câu hỏi / {quiz.time_limit} phút</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="file"
              ref={excelFileInputRef}
              onChange={handleExcelImport}
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
            />
            <a
              href="/File_Mau_Import_Cau_Hoi.xlsx"
              download="File_Mau_Import_Cau_Hoi.xlsx"
              className="btn-secondary btn-download-template"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <Download size={16} />
              Tải file mẫu
            </a>
            <button
              type="button"
              className="btn-secondary btn-import-excel"
              onClick={() => excelFileInputRef.current?.click()}
              disabled={isImportingExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            >
              {isImportingExcel ? <div className="upload-spinner-small" /> : <Upload size={16} />}
              Nhập từ Excel
            </button>
            <button className="btn-primary btn-add-q" onClick={() => setShowTypeWizard(true)}>
              <Plus size={16} /> Thêm câu hỏi mới
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ margin: '1rem 1.5rem 0 1.5rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#cc1e1e', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fca5a5', zIndex: 10 }}>
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} style={{ background: 'transparent', border: 'none', color: '#cc1e1e', cursor: 'pointer', fontSize: '1.2rem', padding: 0, lineHeight: 1 }}>&times;</button>
          </div>
        )}
        {successMsg && (
          <div style={{ margin: '1rem 1.5rem 0 1.5rem', padding: '0.75rem 1rem', background: '#dcfce7', color: '#16a34a', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #86efac', zIndex: 10 }}>
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg('')} style={{ background: 'transparent', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '1.2rem', padding: 0, lineHeight: 1 }}>&times;</button>
          </div>
        )}

        <div className="questions-workspace">
          {/* SIDEBAR: QUESTIONS LIST */}
          <div className="questions-sidebar" onMouseDownCapture={() => setFocusedPane('sidebar')}>
            <div className="sidebar-view-tabs">
              <button
                type="button"
                className={`view-tab-btn ${currentViewMode === 'form' ? 'active' : ''}`}
                onClick={() => setCurrentViewMode('form')}
              >
                <ListChecks size={15} /> Soạn thảo
              </button>
              <button
                type="button"
                className={`view-tab-btn ${currentViewMode === 'slide' ? 'active' : ''}`}
                onClick={() => setCurrentViewMode('slide')}
              >
                <Eye size={15} /> Trình chiếu
              </button>
            </div>

            <div className="sidebar-search-box">
              <input
                type="text"
                placeholder="Tìm kiếm câu hỏi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="sidebar-list excel-style">
              {filteredQuestions.length === 0 ? (
                <div className="no-questions-text">
                  {searchQuery ? 'Không tìm thấy câu hỏi phù hợp.' : 'Đề thi chưa có câu hỏi nào.'}
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const originalIdx = quiz.questions.findIndex(origQ => origQ.question_id === q.question_id);
                  const displayIdx = originalIdx !== -1 ? originalIdx + 1 : idx + 1;
                  const isActive = activeQuestion?.question_id === q.question_id;
                  const isSelectedRow = selectedQuestionIds.includes(q.question_id || -1) && !isActive;
                  return (
                    <div
                      key={q.question_id}
                      className={`sidebar-item excel-row ${isActive ? 'active' : ''} ${isSelectedRow ? 'selected-row' : ''}`}
                      onClick={(e) => handleSelectQuestionItem(q, originalIdx !== -1 ? originalIdx : idx, e)}
                      onContextMenu={(e) => handleContextMenu(e, q, originalIdx !== -1 ? originalIdx : idx)}
                    >
                      <div className="item-body">
                        <div className="item-text">
                          {displayIdx}. {q.question_text || '(Trống)'}
                        </div>
                        <span className="item-type-badge-excel">
                          {
                            q.question_type === 'single_choice' ? 'Trắc nghiệm 1 đáp án' :
                              q.question_type === 'multiple_choice' ? 'Trắc nghiệm nhiều đáp án' :
                                q.question_type === 'true_false' ? 'Đúng / Sai' :
                                  q.question_type === 'short_answer' ? 'Trả lời ngắn' :
                                    q.question_type === 'multi_true_false' ? 'Đúng / Sai nhiều ý' :
                                      q.question_type === 'matching' ? 'Nối cột' :
                                        q.question_type === 'ordering' ? 'Sắp xếp' :
                                          q.question_type === 'hotspot' ? 'Hotspot' : q.question_type
                          }
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* EDITOR FORM OR EMPTY STATE */}
          <div className="question-editor-pane" onMouseDownCapture={() => setFocusedPane('editor')}>
            {activeQuestion ? (
              currentViewMode === 'form' ? (
                <QuestionFormEditor
                  question={activeQuestion}
                  onChange={setActiveQuestion}
                  onSave={handleSaveQuestion}
                  onPreview={() => setIsReviewModalOpen(true)}
                  onTypeChange={handleTypeChange}
                />
              ) : (
                <QuestionSlideView question={activeQuestion} />
              )
            ) : (
              <div className="editor-empty-state">
                <Sparkles size={48} className="empty-icon" style={{ opacity: 0.5 }} />
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Chọn một câu hỏi từ danh sách bên trái hoặc nhấn "Thêm câu hỏi mới" để bắt đầu soạn thảo.</p>
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
          onCancel={closeConfirmModal}
          confirmText={modalConfig.confirmText}
        />

        <QuestionReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          question={activeQuestion}
        />

        {contextMenu && createPortal(
          <div
            className="sidebar-context-menu"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              padding: '4px 0',
              zIndex: 9999,
              minWidth: '160px',
              fontFamily: 'inherit'
            }}
          >
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleCopyQuestion(contextMenu.question)}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
            >
              Sao chép
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={handlePasteQuestion}
              disabled={!copiedQuestion}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: !copiedQuestion ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: !copiedQuestion ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: !copiedQuestion ? 0.5 : 1 }}
            >
              Dán
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleDuplicateQuestion(contextMenu.question)}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
            >
              Nhân bản
            </button>
            {selectedQuestionIds.length > 1 && selectedQuestionIds.includes(contextMenu.question.question_id || -1) ? (
              <button
                type="button"
                className="context-menu-item"
                onClick={handleDeleteSelectedQuestions}
                style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}
              >
                Xóa {selectedQuestionIds.length} câu đã chọn
              </button>
            ) : (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => handleDeleteQuestion(contextMenu.question.question_id)}
                style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
              >
                Xóa câu hỏi
              </button>
            )}
            <div style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', margin: '4px 0' }} />
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleSwapQuestions(contextMenu.index, contextMenu.index - 1)}
              disabled={contextMenu.index === 0}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: contextMenu.index === 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: contextMenu.index === 0 ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: contextMenu.index === 0 ? 0.5 : 1 }}
            >
              Di chuyển lên
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleSwapQuestions(contextMenu.index, contextMenu.index + 1)}
              disabled={contextMenu.index === (quiz?.questions.length || 0) - 1}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: contextMenu.index === (quiz?.questions.length || 0) - 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: contextMenu.index === (quiz?.questions.length || 0) - 1 ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: contextMenu.index === (quiz?.questions.length || 0) - 1 ? 0.5 : 1 }}
            >
              Di chuyển xuống
            </button>
          </div>,
          document.body
        )}

        {showTypeWizard && createPortal(
          <div className="type-wizard-overlay" onClick={() => setShowTypeWizard(false)}>
            <div className="type-wizard-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="type-wizard-header">
                <div>
                  <h3>Thêm câu hỏi mới</h3>
                  <p>Chọn loại câu hỏi phù hợp để chèn vào đề thi</p>
                </div>
                <button className="type-wizard-close" onClick={() => setShowTypeWizard(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="type-wizard-body">
                <div className="type-wizard-sidebar">
                  <button
                    type="button"
                    className={`wizard-side-tab ${wizardCategory === 'graded' ? 'active' : ''}`}
                    onClick={() => setWizardCategory('graded')}
                  >
                    Câu hỏi chấm điểm
                  </button>
                  <button
                    type="button"
                    className={`wizard-side-tab ${wizardCategory === 'interactive' ? 'active' : ''}`}
                    onClick={() => setWizardCategory('interactive')}
                  >
                    Câu hỏi tương tác
                  </button>
                </div>
                <div className="type-wizard-content">
                  <div className="type-wizard-grid">
                    {WIZARD_TYPES.filter(t => t.category === wizardCategory).map((t) => (
                      <div
                        key={t.value}
                        className="type-wizard-card"
                        onClick={() => {
                          initNewQuestion(t.value);
                          setShowTypeWizard(false);
                        }}
                      >
                        <div className="type-wizard-preview">
                          {t.svg}
                        </div>
                        <div className="type-wizard-info">
                          <h4>{t.label}</h4>
                          <p>{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      {isImportingExcel && createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              borderRadius: '16px',
              padding: '2.5rem 3rem',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              maxWidth: '400px'
            }}>
              <div className="upload-spinner-small" style={{ width: '48px', height: '48px', margin: '0 auto 1.5rem', borderWidth: '4px' }} />
              <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary, #f1f5f9)', fontSize: '1.1rem' }}>
                Đang nhập câu hỏi từ Excel...
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem' }}>
                Vui lòng chờ, hệ thống đang xử lý dữ liệu
              </p>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default AdminQuestions;
