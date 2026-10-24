import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, LogIn, BookOpen, Sun, Moon } from 'lucide-react';
import {
  getPublicSchools, getPublicClasses, getPublicStudents, getPublicQuizzes,
  startQuizAttempt, submitQuizAttempt, getPublicArticles, getAuthStatus
} from '../api';
import './css/StudentPortal.css';
import { StudentPortalLevel } from './portal/StudentPortalLevel';
import { StudentPortalExam } from './portal/StudentPortalExam';
import { StudentPortalResults } from './portal/StudentPortalResults';
import { StudentPortalRegistration } from './portal/StudentPortalRegistration';
import { useStudentAntiCheat } from '../hooks/useStudentAntiCheat';
import { useStudentExamTimer } from '../hooks/useStudentExamTimer';
import { checkAnswerClient } from '../utils/scoring';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useDevToolsBlocker } from '../hooks/useDevToolsBlocker';
import { useExamLockdown } from '../hooks/useExamLockdown';

interface School {
  school_id: number;
  school_name: string;
}

interface ClassItem {
  class_id: number;
  class_name: string;
  practice_enabled?: boolean;
}

interface Student {
  student_id: number;
  full_name: string;
}

interface Question {
  question_id: number;
  question_type: string;
  question_text: string;
  image_url: string;
  options: any;
  points: number;
  correct_answer?: any;
}

interface DetailedResult {
  question_id: number;
  question_text: string;
  question_type: string;
  image_url: string;
  options: any;
  student_answer: any;
  correct_answer: any;
  points_earned: number;
  is_correct: boolean;
}

// Levels map for programs selection modal
const programLevels: Record<string, { title: string; levels: { id: string; name: string; tag: string }[] }> = {
  Primary: {
    title: 'Chương Trình Tiểu Học (IC3 SPARK)',
    levels: [
      { id: 'Spark_L1', name: 'IC3 Spark L1 - Máy tính căn bản', tag: 'L1' },
      { id: 'Spark_L2', name: 'IC3 Spark L2 - Các ứng dụng chính', tag: 'L2' },
      { id: 'Spark_L3', name: 'IC3 Spark L3 - Cuộc sống trực tuyến', tag: 'L3' }
    ]
  },
  Secondary: {
    title: 'Chương Trình THCS (IC3 GS6)',
    levels: [
      { id: 'GS6_L1', name: 'IC3 GS6 L1 - Level 1', tag: 'L1' },
      { id: 'GS6_L2', name: 'IC3 GS6 L2 - Level 2', tag: 'L2' },
      { id: 'GS6_L3', name: 'IC3 GS6 L3 - Level 3', tag: 'L3' }
    ]
  },
  High: {
    title: 'Chương Trình THPT (MOS)',
    levels: [
      { id: 'MOS_Word', name: 'MOS Word - Soạn thảo văn bản', tag: 'Word' },
      { id: 'MOS_Excel', name: 'MOS Excel - Bảng tính tin học', tag: 'Excel' },
      { id: 'MOS_PowerPoint', name: 'MOS PowerPoint - Trình chiếu', tag: 'Powerpoint' }
    ]
  }
};

const initializeOrderingAnswers = (questionsList: any[], currentAnswers: any) => {
  const newAnswers = { ...currentAnswers };
  if (!questionsList || !Array.isArray(questionsList)) return newAnswers;
  
  questionsList.forEach((q) => {
    if (q.question_type === 'ordering') {
      const qId = q.question_id;
      if (newAnswers[qId] === undefined || newAnswers[qId] === null || (Array.isArray(newAnswers[qId]) && newAnswers[qId].length === 0)) {
        const optionsList = Array.isArray(q.options) ? q.options : [];
        newAnswers[qId] = optionsList.map((opt: any) => opt.id);
      }
    }
  });
  return newAnswers;
};

const StudentPortal: React.FC = () => {
  // Khôi phục phiên làm bài một lần duy nhất khi component mount
  const savedSessionRef = useRef<any>(undefined);
  if (savedSessionRef.current === undefined) {
    savedSessionRef.current = (() => {
      try {
        const saved = localStorage.getItem('ic3_exam_session_portal');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.attemptId) {
            // Kiểm tra thời gian thực tế còn lại dựa trên examEndTime
            if (parsed.examEndTime) {
              const realRemaining = Math.max(0, Math.floor((parsed.examEndTime - Date.now()) / 1000));
              if (realRemaining <= 0) {
                localStorage.removeItem('ic3_exam_session_portal');
                return null;
              }
            } else if (parsed.timeLeft > 0) {
              // Fallback nếu không có examEndTime
            } else {
              return null;
            }
            return parsed;
          }
        }
      } catch (e) {
        console.error('Lỗi khi tải phiên làm bài dở:', e);
      }
      return null;
    })();
  }
  const savedSession = savedSessionRef.current;

  // Roster registration states
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Knowledge articles state
  const [articles, setArticles] = useState<any[]>([]);

  // Fetch articles on load
  useEffect(() => {
    const fetchArticlesData = async () => {
      try {
        const res = await getPublicArticles();
        setArticles(res.data);
      } catch (err) {
        console.error("Lỗi khi tải bài viết kiến thức:", err);
      }
    };
    fetchArticlesData();
  }, []);

  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem('ic3_selected_school_id');
      return saved ? Number(saved) : (savedSession ? savedSession.selectedSchoolId : '');
    } catch {
      return savedSession ? savedSession.selectedSchoolId : '';
    }
  });
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem('ic3_selected_class_id');
      return saved ? Number(saved) : (savedSession ? savedSession.selectedClassId : '');
    } catch {
      return savedSession ? savedSession.selectedClassId : '';
    }
  });
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem('ic3_selected_student_id');
      return saved ? Number(saved) : (savedSession ? savedSession.selectedStudentId : '');
    } catch {
      return savedSession ? savedSession.selectedStudentId : '';
    }
  });

  useEffect(() => {
    try {
      if (selectedSchoolId !== '') {
        localStorage.setItem('ic3_selected_school_id', String(selectedSchoolId));
      } else {
        localStorage.removeItem('ic3_selected_school_id');
      }
    } catch (e) {
      console.warn('Unable to write selectedSchoolId to localStorage:', e);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    try {
      if (selectedClassId !== '') {
        localStorage.setItem('ic3_selected_class_id', String(selectedClassId));
      } else {
        localStorage.removeItem('ic3_selected_class_id');
      }
    } catch (e) {
      console.warn('Unable to write selectedClassId to localStorage:', e);
    }
  }, [selectedClassId]);

  useEffect(() => {
    try {
      if (selectedStudentId !== '') {
        localStorage.setItem('ic3_selected_student_id', String(selectedStudentId));
      } else {
        localStorage.removeItem('ic3_selected_student_id');
      }
    } catch (e) {
      console.warn('Unable to write selectedStudentId to localStorage:', e);
    }
  }, [selectedStudentId]);

  // New states for public quiz selection portal
  const [publicQuizzes, setPublicQuizzes] = useState<any[]>([]);
  const [quizToStart, setQuizToStart] = useState<any | null>(savedSession ? savedSession.quizToStart : null);

  // States for unified program quiz wizard modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<'select_level' | 'select_quiz' | 'student_info' | 'enter_pin'>('select_level');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null); // 'Primary' | 'Secondary' | 'High'
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null); // e.g. 'GS6_L1'
  const [filteredLevelQuizzes, setFilteredLevelQuizzes] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'level_page'>('home');
  const [levelQuizMode, setLevelQuizMode] = useState<'training' | 'testing' | 'practice'>('testing');
  const [isModePreselected, setIsModePreselected] = useState<boolean>(false);
  const [comingSoonModal, setComingSoonModal] = useState({ open: false, title: '', desc: '' });

  // Knowledge articles active filter
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Selected article to read in full
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [currentArticlePage, setCurrentArticlePage] = useState(1);

  // Reset pagination on category change
  useEffect(() => {
    setCurrentArticlePage(1);
  }, [activeCategory]);

  // Check if current user is a teacher or admin to bypass anti-cheat glass blocker
  const [isTeacherUser, setIsTeacherUser] = useState(false);
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const res = await getAuthStatus();
        if (res.data && (res.data.role === 'teacher' || res.data.role === 'admin')) {
          setIsTeacherUser(true);
        }
      } catch {
        // Ignored
      }
    };
    checkUserRole();
  }, []);

  const isPreview = (new URLSearchParams(window.location.search).get('preview') === 'true') || isTeacherUser;

  // Chặn DevTools trên luồng học sinh
  const isDevToolsOpen = useDevToolsBlocker(isPreview);

  // Exam taking states
  const [isExamStarted, setIsExamStarted] = useState(!!savedSession);
  const [attemptId, setAttemptId] = useState<number | null>(savedSession ? savedSession.attemptId : null);
  const [sessionToken, setSessionToken] = useState<string | null>(savedSession ? savedSession.sessionToken : null);
  const [questions, setQuestions] = useState<Question[]>(savedSession ? savedSession.questions : []);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    if (savedSession) {
      return initializeOrderingAnswers(savedSession.questions, savedSession.answers || {});
    }
    return {};
  });
  const [activeQIndex, setActiveQIndex] = useState(savedSession ? (savedSession.activeQIndex || 0) : 0);
  const [quizMode, setQuizMode] = useState<'training' | 'testing' | 'practice'>(savedSession ? (savedSession.quizMode || 'testing') : 'testing');
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>(savedSession ? (savedSession.checkedQuestions || {}) : {});
  const [examSubmitted, setExamSubmitted] = useState(false);
  // Khoá copy/dán/in ấn khi đang thi chính thức (không áp dụng ôn luyện hoặc xem trước)
  useExamLockdown(isExamStarted && !examSubmitted && quizMode === 'testing' && !isPreview);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [detailedResults, setDetailedResults] = useState<DetailedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Synchronous timer states
  const [examStartTime, setExamStartTime] = useState<number | null>(() => {
    if (savedSession) {
      return savedSession.examStartTime || (Date.now() - (savedSession.durationSeconds || 0) * 1000);
    }
    return null;
  });
  const [examEndTime, setExamEndTime] = useState<number | null>(() => {
    if (savedSession) {
      return savedSession.examEndTime || (Date.now() + savedSession.timeLeft * 1000);
    }
    return null;
  });
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (savedSession) {
      const end = savedSession.examEndTime || (Date.now() + savedSession.timeLeft * 1000);
      return Math.max(0, Math.floor((end - Date.now()) / 1000));
    }
    return 0;
  });
  const [durationSeconds, setDurationSeconds] = useState<number>(() => {
    if (savedSession) {
      const start = savedSession.examStartTime || (Date.now() - (savedSession.durationSeconds || 0) * 1000);
      const limit = (savedSession.quizToStart?.time_limit || 45) * 60;
      return Math.min(limit, Math.floor((Date.now() - start) / 1000));
    }
    return 0;
  });

  // Theme state for student portal
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  // PIN code states
  const [enteredPin, setEnteredPin] = useState<string>('');

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch (e) {
      console.warn('Unable to write to localStorage (storage access blocked):', e);
    }
  };

  const { modalConfig, showConfirm, showAlert, closeConfirmModal } = useConfirmModal();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Carousel banners
  const banners = [
    {
      image: '/student_banner.png',
      title: 'Học tập IC3 GS6 Hiệu Quả',
      description: 'Ôn tập chuyên sâu - Kiểm tra thực tế - Chứng chỉ quốc tế'
    },
    {
      image: '/student_banner_2.png',
      title: 'Luyện Thi Đạt Chuẩn Quốc Tế',
      description: 'Nâng cao kỹ năng tin học văn phòng với kho bài thi phong phú'
    },
    {
      image: '/student_banner_3.png',
      title: 'Làm Chủ Kỹ Năng Kỹ Thuật Số',
      description: 'Chuẩn bị hành trang tương lai vững vàng cùng IC3 GS6 và MOS'
    }
  ];

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    if (isExamStarted || examSubmitted) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isExamStarted, examSubmitted, banners.length]);

  // Refs for tracking values in listeners and hooks
  const answersRef = useRef<Record<string, any>>({});
  const attemptIdRef = useRef<number | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  // Shared refs for syncing custom hooks
  const sharedDurationRef = useRef(0);
  const sharedCheatWarningsRef = useRef(0);

  // Load schools and public quizzes first
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const schoolRes = await getPublicSchools();
        setSchools(schoolRes.data);

        const quizRes = await getPublicQuizzes();
        const sortedQuizzes = quizRes.data.sort((a: any, b: any) => {
          const extractLastNumber = (title: string) => {
            const matches = title.match(/\d+/g);
            return matches && matches.length > 0 ? parseInt(matches[matches.length - 1], 10) : 0;
          };
          const numA = extractLastNumber(a.title);
          const numB = extractLastNumber(b.title);
          if (numA !== numB) return numA - numB;
          return a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
        });
        setPublicQuizzes(sortedQuizzes);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
      }
    };
    loadInitialData();
  }, []);



  // Load classes when school is selected
  useEffect(() => {
    if (!selectedSchoolId) {
      setClasses([]);
      return;
    }
    const loadClasses = async () => {
      try {
        const res = await getPublicClasses(Number(selectedSchoolId));
        setClasses(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadClasses();
  }, [selectedSchoolId]);

  // Load students when class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    const loadClassData = async () => {
      try {
        const studRes = await getPublicStudents(Number(selectedClassId));
        setStudents(studRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadClassData();
  }, [selectedClassId]);





  // Unified submission trigger called automatically by hooks or auto-submits
  const triggerAutoSubmit = async (reason: string) => {
    showAlert('Thông báo hệ thống', reason, 'warning', 'Đồng ý');

    if (attemptIdRef.current) {
      setLoading(true);
      try {
        if (attemptIdRef.current > 0) {
          const res = await submitQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: sharedCheatWarningsRef.current,
            duration_seconds: sharedDurationRef.current,
            is_auto_submit: true
          });

          setFinalScore(res.data.score_achieved);
          setDetailedResults(res.data.detailed_results);
          if (res.data.detailed_results) {
            const mergedQuestions = questions.map(q => {
              const detail = res.data.detailed_results.find((r: any) => r.question_id === q.question_id);
              return detail ? { ...q, correct_answer: detail.correct_answer, explanation: detail.explanation } : q;
            });
            setQuestions(mergedQuestions);
          }
        } else {
          // Local offline grading
          let totalScore = 0.0;
          const results = questions.map(q => {
            const studentAns = answersRef.current[q.question_id];
            const isCorrect = checkAnswerClient(q.question_type, q.correct_answer, studentAns);
            const earnedPoints = isCorrect ? Number(q.points) : 0.0;
            totalScore += earnedPoints;
            return {
              question_id: q.question_id,
              question_text: q.question_text,
              question_type: q.question_type,
              image_url: q.image_url || '',
              options: q.options,
              student_answer: studentAns,
              correct_answer: q.correct_answer,
              points_earned: earnedPoints,
              is_correct: isCorrect
            };
          });
          setFinalScore(totalScore);
          setDetailedResults(results);
        }
        setExamSubmitted(true);
        setIsExamStarted(false);
        setSessionToken(null);

        // Clear all session tokens for this student
        try {
          if (selectedStudentId) {
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith(`student_session_token_${selectedStudentId}_`)) {
                localStorage.removeItem(key);
              }
            });
          }
        } catch (e) {
          console.error(e);
        }

        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      } catch (err) {
        console.error('Lỗi tự động nộp bài:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBannedKickout = (message: string) => {
    showAlert(
      'Bị chặn ôn luyện',
      message || 'Chế độ ôn luyện (Training) đã bị Giáo viên tạm khóa đối với lớp của bạn.',
      'warning',
      'Đồng ý'
    );
    setIsExamStarted(false);
    setAttemptId(null);
    setQuestions([]);
    setAnswers({});
    setActiveQIndex(0);
    setCheckedQuestions({});
    setExamSubmitted(false);
    setIsReviewMode(false);
    setFinalScore(0);
    setDetailedResults([]);
    setErrorMsg('');
    try {
      localStorage.removeItem('ic3_exam_session_portal');
    } catch (e) {
      console.warn('Unable to remove session from localStorage (storage access blocked):', e);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
  };

  // Wire up modular hook systems
  const {
    cheatWarnings,
    showCheatBlocker,
    blockerReason,
    requestFullscreen
  } = useStudentAntiCheat(
    isExamStarted,
    examSubmitted,
    attemptIdRef,
    answersRef,
    sharedDurationRef,
    triggerAutoSubmit,
    isPreview,
    handleBannedKickout
  );

  useStudentExamTimer(
    isExamStarted,
    examSubmitted,
    quizToStart,
    attemptIdRef,
    answersRef,
    sharedCheatWarningsRef,
    triggerAutoSubmit,
    setTimeLeft,
    durationSeconds,
    setDurationSeconds,
    examStartTime,
    examEndTime,
    handleBannedKickout
  );

  // Sync state values back to shared refs for interval timers
  sharedDurationRef.current = durationSeconds;
  sharedCheatWarningsRef.current = cheatWarnings;

  // Tự động lưu trạng thái thi vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (isExamStarted && attemptId && quizToStart) {
      const stateToSave = {
        quizToStart,
        attemptId,
        sessionToken,
        questions,
        answers,
        activeQIndex,
        quizMode,
        checkedQuestions,
        timeLeft,
        durationSeconds,
        selectedStudentId,
        selectedSchoolId,
        selectedClassId,
        cheatWarnings,
        examStartTime,
        examEndTime
      };
      try {
        localStorage.setItem('ic3_exam_session_portal', JSON.stringify(stateToSave));
      } catch (e) {
        console.warn('Unable to save session to localStorage (storage access blocked):', e);
      }
    }
  }, [
    isExamStarted,
    quizToStart,
    attemptId,
    sessionToken,
    questions,
    answers,
    activeQIndex,
    quizMode,
    checkedQuestions,
    timeLeft,
    durationSeconds,
    selectedStudentId,
    selectedSchoolId,
    selectedClassId,
    cheatWarnings,
    examStartTime,
    examEndTime
  ]);

  // Xóa session làm bài trong localStorage khi kết thúc thi hoặc nộp bài
  useEffect(() => {
    if (!isExamStarted) {
      try {
        localStorage.removeItem('ic3_exam_session_portal');
      } catch (e) {
        console.warn('Unable to remove session from localStorage (storage access blocked):', e);
      }
    }
  }, [isExamStarted]);

  const handleStartQuiz = async (quizId: number, pinVal?: string) => {
    if (!selectedSchoolId || !selectedClassId || !selectedStudentId) {
      setErrorMsg('Vui lòng hoàn thành chọn thông tin Trường, Lớp và Họ tên.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const tokenKey = `student_session_token_${selectedStudentId}_${quizId}`;
      const localToken = localStorage.getItem(tokenKey) || '';

      const res = await startQuizAttempt({
        quiz_id: quizId,
        student_id: Number(selectedStudentId),
        quiz_mode: levelQuizMode,
        session_token: localToken,
        pin_code: pinVal
      });

      if (res.data.session_token) {
        localStorage.setItem(tokenKey, res.data.session_token);
        setSessionToken(res.data.session_token);
      }

      const mode = res.data.quiz_mode || 'testing';
      setQuizMode(mode);
      setCheckedQuestions({});

      setAttemptId(res.data.attempt_id);
      setQuestions(res.data.questions);
      setAnswers(initializeOrderingAnswers(res.data.questions, res.data.answers || {}));

      if (res.data.time_limit) {
        setQuizToStart((prev: any) => {
          if (!prev) return { time_limit: res.data.time_limit };
          return { ...prev, time_limit: res.data.time_limit };
        });
      }

      const limitMinutes = res.data.time_limit || (quizToStart?.time_limit || 45);
      const limitSeconds = limitMinutes * 60;
      let elapsedSeconds = 0;
      if (res.data.started_at) {
        const startedDate = new Date(res.data.started_at.replace(' ', 'T') + 'Z');
        elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedDate.getTime()) / 1000));
      }
      const remainingSeconds = Math.max(0, limitSeconds - elapsedSeconds);
      const now = Date.now();
      const startTimestamp = now - elapsedSeconds * 1000;
      const endTimestamp = now + remainingSeconds * 1000;

      setExamStartTime(startTimestamp);
      setExamEndTime(endTimestamp);
      setTimeLeft(remainingSeconds);
      setDurationSeconds(elapsedSeconds);

      // Activate fullscreen immediately only if testing mode
      setIsExamStarted(true);
      setIsModalOpen(false);
      if (mode === 'testing') {
        requestFullscreen();
      }
    } catch (err: any) {
      console.error(err);
      const isPinReq = err.response?.data?.pin_required || (err.response?.data?.message && (err.response.data.message.includes('PIN') || err.response.data.message.includes('pin')));
      if (isPinReq) {
        setWizardStep('enter_pin');
        setEnteredPin('');
        if (pinVal) {
          setErrorMsg(err.response?.data?.message || 'Mã PIN không chính xác.');
        } else {
          setErrorMsg('');
        }
        setIsModalOpen(true);
      } else {
        setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi bắt đầu thi.');
      }
    } finally {
      setLoading(false);
    }
  };



  const handleManualSubmit = async () => {
    // 1. Tìm câu hỏi chưa trả lời đầu tiên
    let firstUnansweredIdx = -1;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const ans = answers[q.question_id];
      const isAnswered = ans !== undefined && ans !== '' && ans !== null && (typeof ans !== 'object' || Object.keys(ans).length > 0);
      if (!isAnswered) {
        firstUnansweredIdx = i;
        break;
      }
    }

    let confirmText = '';
    if (firstUnansweredIdx !== -1) {
      // Tự động chuyển màn hình sang câu hỏi chưa trả lời đầu tiên
      setActiveQIndex(firstUnansweredIdx);
      confirmText = 'Bạn có câu hỏi chưa làm xong, bạn có chắc chắn tiếp tục nộp bài không';
    } else {
      confirmText = 'Bạn có chắc chắn muốn nộp bài thi không?';
    }

    showConfirm(
      'Xác nhận nộp bài',
      confirmText,
      async () => {
        setLoading(true);
        try {
          if (attemptId) {
            if (attemptId > 0) {
              const res = await submitQuizAttempt(attemptId, {
                answers,
                cheat_warnings_count: cheatWarnings,
                duration_seconds: durationSeconds,
                is_auto_submit: false
              });

              setFinalScore(res.data.score_achieved);
              setDetailedResults(res.data.detailed_results);
              if (res.data.detailed_results) {
                const mergedQuestions = questions.map(q => {
                  const detail = res.data.detailed_results.find((r: any) => r.question_id === q.question_id);
                  return detail ? { ...q, correct_answer: detail.correct_answer, explanation: detail.explanation } : q;
                });
                setQuestions(mergedQuestions);
              }
            } else {
              // Local offline grading
              let totalScore = 0.0;
              const results = questions.map(q => {
                const studentAns = answers[q.question_id];
                const isCorrect = checkAnswerClient(q.question_type, q.correct_answer, studentAns);
                const earnedPoints = isCorrect ? Number(q.points) : 0.0;
                totalScore += earnedPoints;
                return {
                  question_id: q.question_id,
                  question_text: q.question_text,
                  question_type: q.question_type,
                  image_url: q.image_url || '',
                  options: q.options,
                  student_answer: studentAns,
                  correct_answer: q.correct_answer,
                  points_earned: earnedPoints,
                  is_correct: isCorrect
                };
              });
              setFinalScore(totalScore);
              setDetailedResults(results);
            }
            setExamSubmitted(true);
            setIsExamStarted(false);
            setSessionToken(null);

            // Clear all session tokens for this student
            try {
              if (selectedStudentId) {
                Object.keys(localStorage).forEach(key => {
                  if (key.startsWith(`student_session_token_${selectedStudentId}_`)) {
                    localStorage.removeItem(key);
                  }
                });
              }
            } catch (e) {
              console.error(e);
            }

            if (document.fullscreenElement) {
              document.exitFullscreen().catch(console.error);
            }
          }
        } catch (err) {
          console.error(err);
          alert('Có lỗi xảy ra khi nộp bài.');
        } finally {
          setLoading(false);
        }
      },
      'warning',
      'Nộp bài'
    );
  };

  const handleFinishExam = () => {
    setIsExamStarted(false);
    setAttemptId(null);
    setSessionToken(null);
    setQuestions([]);
    setAnswers({});
    setActiveQIndex(0);
    setCheckedQuestions({});
    setExamSubmitted(false);
    setIsReviewMode(false);
    setFinalScore(0);
    setDetailedResults([]);
    setErrorMsg('');
    setCurrentView('level_page');
  };

  const handleRestartQuiz = () => {
    if (quizToStart) {
      setAnswers({});
      setActiveQIndex(0);
      setCheckedQuestions({});
      setExamSubmitted(false);
      setIsReviewMode(false);
      setFinalScore(0);
      setDetailedResults([]);
      setErrorMsg('');
      try {
        localStorage.removeItem('ic3_exam_session_portal');
      } catch (e) {
        console.warn('Unable to remove session from localStorage (storage access blocked):', e);
      }
      handleStartQuiz(quizToStart.quiz_id);
    }
  };

  // --- ANSWERS UPDATORS ---
  const handleSelectSingleChoice = (qId: number, optionId: string) => {
    if (isReviewMode || checkedQuestions[qId]) return;
    setAnswers({ ...answers, [qId]: optionId });
  };

  const handleSelectMultipleChoice = (qId: number, optionId: string) => {
    if (isReviewMode || checkedQuestions[qId]) return;
    let current = answers[qId] || [];
    if (!Array.isArray(current)) current = [];

    if (current.includes(optionId)) {
      current = current.filter((x: string) => x !== optionId);
    } else {
      current.push(optionId);
    }
    setAnswers({ ...answers, [qId]: current });
  };

  const handleSelectTrueFalse = (qId: number, val: 'T' | 'F') => {
    if (isReviewMode || checkedQuestions[qId]) return;
    setAnswers({ ...answers, [qId]: val });
  };

  const handleSelectMultiTF = (qId: number, stmtId: string, val: 'T' | 'F') => {
    if (isReviewMode || checkedQuestions[qId]) return;
    const current = answers[qId] || {};
    const updated = { ...current, [stmtId]: val };
    setAnswers({ ...answers, [qId]: updated });
  };

  // Matching interaction
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);

  const handleSelectMatchingSide = (qId: number, side: 'left' | 'right', itemId: string) => {
    if (isReviewMode || checkedQuestions[qId]) return;
    if (side === 'left') {
      setSelectedLeftId(itemId);
    } else {
      if (selectedLeftId) {
        const current = answers[qId] || {};
        const updated = { ...current, [selectedLeftId]: itemId };
        setAnswers({ ...answers, [qId]: updated });
        setSelectedLeftId(null);
      }
    }
  };

  const clearMatchingPair = (qId: number, leftId: string) => {
    if (isReviewMode || checkedQuestions[qId]) return;
    const current = { ...(answers[qId] || {}) };
    delete current[leftId];
    setAnswers({ ...answers, [qId]: current });
  };

  // Ordering interaction
  const moveOrderItem = (qId: number, idx: number, direction: 'up' | 'down') => {
    if (isReviewMode || checkedQuestions[qId]) return;
    const q = questions[activeQIndex];
    let sequence = answers[qId];

    // If not set yet, initialize sequence of original option IDs
    if (!sequence || !Array.isArray(sequence)) {
      sequence = q.options.map((opt: any) => opt.id);
    }

    const nextSeq = [...sequence];
    if (direction === 'up' && idx > 0) {
      const temp = nextSeq[idx];
      nextSeq[idx] = nextSeq[idx - 1];
      nextSeq[idx - 1] = temp;
    } else if (direction === 'down' && idx < nextSeq.length - 1) {
      const temp = nextSeq[idx];
      nextSeq[idx] = nextSeq[idx + 1];
      nextSeq[idx + 1] = temp;
    }

    setAnswers({ ...answers, [qId]: nextSeq });
  };

  // Hotspot interaction (supports multi-point via max_selections)
  const handleHotspotClick = (qId: number, e: React.MouseEvent<HTMLImageElement>) => {
    if (isReviewMode || checkedQuestions[qId]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    // Find the question to check max_selections
    const q = questions.find(q => q.question_id === qId);
    let maxSelections = 1;
    if (q?.options) {
      if (Array.isArray(q.options)) {
        const correctZones = q.options.filter((o: any) => o.is_correct === true);
        maxSelections = correctZones.length > 0 ? correctZones.length : 1;
      } else if (typeof q.options === 'object') {
        if (q.options.mode === 'zone') {
          const zonesList = Array.isArray(q.options.zones) ? q.options.zones : [];
          const correctZones = zonesList.filter((o: any) => o.is_correct === true);
          maxSelections = correctZones.length > 0 ? correctZones.length : 1;
        } else {
          maxSelections = q.options.max_selections || 1;
        }
      }
    }

    if (maxSelections <= 1) {
      setAnswers({ ...answers, [qId]: { x, y } });
    } else {
      const currentPoints = Array.isArray(answers[qId]) ? [...answers[qId]] : [];
      if (currentPoints.length < maxSelections) {
        currentPoints.push({ x, y });
      } else {
        currentPoints.shift();
        currentPoints.push({ x, y });
      }
      setAnswers({ ...answers, [qId]: currentPoints });
    }
  };

  // Helper to filter public quizzes for a specific program level
  const getQuizzesForLevel = (progId: string, lvlId: string, quizzesList: any[]) => {
    return quizzesList.filter(quiz => {
      const qTitle = quiz.title.toLowerCase();
      const schoolLevel = quiz.school_level || '';
      const grade = quiz.grade_level;

      if (progId === 'Primary') {
        if (schoolLevel !== 'Primary') return false;
        if (lvlId === 'Spark_L1') {
          return grade === 3 || qTitle.includes('l1') || qTitle.includes('level 1') || qTitle.includes('spark 1') || qTitle.includes('căn bản');
        }
        if (lvlId === 'Spark_L2') {
          return grade === 4 || qTitle.includes('l2') || qTitle.includes('level 2') || qTitle.includes('spark 2') || qTitle.includes('ứng dụng');
        }
        if (lvlId === 'Spark_L3') {
          return grade === 5 || qTitle.includes('l3') || qTitle.includes('level 3') || qTitle.includes('spark 3') || qTitle.includes('trực tuyến');
        }
      }

      if (progId === 'Secondary') {
        if (schoolLevel !== 'Secondary') return false;
        if (lvlId === 'GS6_L1') {
          return grade === 6 || qTitle.includes('l1') || qTitle.includes('level 1') || qTitle.includes('gs6 1') || qTitle.includes('gs6 l1') || qTitle.includes('level_1');
        }
        if (lvlId === 'GS6_L2') {
          return grade === 7 || qTitle.includes('l2') || qTitle.includes('level 2') || qTitle.includes('gs6 2') || qTitle.includes('gs6 l2') || qTitle.includes('level_2');
        }
        if (lvlId === 'GS6_L3') {
          return grade === 8 || grade === 9 || qTitle.includes('l3') || qTitle.includes('level 3') || qTitle.includes('gs6 3') || qTitle.includes('gs6 l3') || qTitle.includes('level_3');
        }
      }

      if (progId === 'High') {
        const isHigh = schoolLevel === 'High' || schoolLevel === 'THPT' || schoolLevel === 'MOS';
        if (!isHigh) return false;
        if (lvlId === 'MOS_Word') {
          return qTitle.includes('word') || qTitle.includes('soạn thảo');
        }
        if (lvlId === 'MOS_Excel') {
          return qTitle.includes('excel') || qTitle.includes('bảng tính');
        }
        if (lvlId === 'MOS_PowerPoint') {
          return qTitle.includes('powerpoint') || qTitle.includes('power point') || qTitle.includes('ppt') || qTitle.includes('trình chiếu');
        }
      }

      return false;
    });
  };

  const showComingSoon = (program: string) => {
    const title = program === 'Primary' ? 'Tiểu Học (IC3 SPARK)' : 'THPT (MOS)';
    setComingSoonModal({
      open: true,
      title: title,
      desc: `Chương trình ôn luyện ${title} hiện đang trong quá trình phát triển nội dung và hệ thống hóa câu hỏi. Vui lòng quay lại sau!`
    });
  };

  const handleOpenWizard = (program: string) => {
    if (program !== 'Secondary') {
      showComingSoon(program);
      return;
    }
    setSelectedProgram(program);
    setSelectedLevelId(null);
    setFilteredLevelQuizzes([]);
    setQuizToStart(null);
    setWizardStep('select_level');
    setIsModalOpen(true);
    setIsModePreselected(false);
  };

  const handleSelectLevel = (levelId: string) => {
    setSelectedLevelId(levelId);
    if (selectedProgram) {
      const qz = getQuizzesForLevel(selectedProgram, levelId, publicQuizzes);
      setFilteredLevelQuizzes(qz);
    }
    setIsModalOpen(false);
    setCurrentView('level_page');
  };

  const handleSelectQuiz = (quiz: any, fromPreselected = false) => {
    setQuizToStart(quiz);
    setErrorMsg('');
    setWizardStep('student_info');
    setIsModalOpen(true);
    setIsModePreselected(fromPreselected);
  };

  const handleSelectQuizWithMode = (quiz: any, mode: 'training' | 'testing' | 'practice') => {
    setLevelQuizMode(mode);
    handleSelectQuiz(quiz, true);
  };

  // --- RENDER HELPERS ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isDevToolsOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#c23b22',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          textAlign: 'center',
          padding: '2rem',
          boxSizing: 'border-box'
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            margin: 0
          }}
        >
          DevTools bị cấm sử dụng
        </h1>
        <p
          style={{
            fontSize: '1.25rem',
            margin: 0,
            opacity: 0.9
          }}
        >
          Vui lòng đóng cửa sổ Developer Tools để tiếp tục.
        </p>
      </div>
    );
  }

  // Render registration & public quizzes portal screen
  if (!isExamStarted && !examSubmitted) {
    const filteredArticles = articles.filter(art => {
      if (activeCategory === 'All') return true;
      return art.category.toLowerCase() === activeCategory.toLowerCase();
    });

    const featuredArticle = filteredArticles[0];
    const subArticles = filteredArticles.slice(1);

    // Paginate sub-articles (3 per page)
    const articlesPerPage = 3;
    const totalSubPages = Math.ceil(subArticles.length / articlesPerPage);
    const startIndex = (currentArticlePage - 1) * articlesPerPage;
    const paginatedSubArticles = subArticles.slice(startIndex, startIndex + articlesPerPage);

    return (
      <div className="student-quizzes-portal-container animate-fade-in">
        {/* Header (Glass Navbar) */}
        <header className="portal-header glass">
          <div className="portal-logo">
            <span className="logo-badge">IC3</span>
            <h1>Manager</h1>
          </div>
          <nav className="portal-nav-links">
            <button
              className="nav-link-btn"
              onClick={() => {
                setCurrentView('home');
                setSelectedLevelId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Trang Chủ
            </button>
            <button
              className="nav-link-btn"
              onClick={() => handleOpenWizard('Primary')}
            >
              Tiểu Học
            </button>
            <button
              className="nav-link-btn"
              onClick={() => handleOpenWizard('Secondary')}
            >
              THCS
            </button>
            <button
              className="nav-link-btn"
              onClick={() => handleOpenWizard('High')}
            >
              THPT
            </button>
          </nav>

          <div className="portal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={toggleTheme}
              className="btn-portal-theme-toggle"
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <a
              href="/login"
              className="btn-teacher-login-circle"
              title="Đăng nhập Giáo viên"
            >
              <LogIn size={18} />
            </a>
          </div>
        </header>

        <div className="portal-body-content">
          {currentView === 'home' ? (
            <>
              {/* Hero Banner Carousel Section */}
              <div className="student-portal-banner">
                {banners.map((slide, idx) => (
                  <div
                    key={idx}
                    className={`banner-slide ${idx === currentBannerIndex ? 'active' : ''}`}
                  >
                    <div className="banner-overlay"></div>
                    <img src={slide.image} alt={slide.title} className="banner-img" />
                    <div className="banner-content">
                      <h2>{slide.title}</h2>
                      <p>{slide.description}</p>
                    </div>
                  </div>
                ))}

                {/* Carousel Dots */}
                <div className="carousel-dots">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      className={`carousel-dot ${idx === currentBannerIndex ? 'active' : ''}`}
                      onClick={() => setCurrentBannerIndex(idx)}
                    />
                  ))}
                </div>
              </div>

              {/* Intro & Fast Navigation Card */}
              <div className="student-intro-card glass">
                <h2 className="portal-main-title">Học tập IC3 GS6 và MOS Trực Tuyến</h2>
                <p>Nền tảng ôn tập và kiểm tra toàn diện cho học sinh <strong>Tiểu Học (Spark)</strong>, <strong>THCS (GS6)</strong> và <strong>THPT (MOS)</strong>.</p>
                <div className="intro-buttons-row">
                  <button
                    className="intro-btn btn-primary-spark"
                    onClick={() => handleOpenWizard('Primary')}
                  >
                    Tiểu học (IC3 SPARK)
                  </button>
                  <button
                    className="intro-btn btn-primary-gs6"
                    onClick={() => handleOpenWizard('Secondary')}
                  >
                    THCS (IC3 GS6)
                  </button>
                  <button
                    className="intro-btn btn-primary-mos"
                    onClick={() => handleOpenWizard('High')}
                  >
                    THPT (MOS)
                  </button>
                </div>
              </div>

              {/* Knowledge Blog Section */}
              <div className="portal-knowledge-section glass">
                <div className="knowledge-section-header">
                  <div className="header-left">
                    <BookOpen className="text-highlight" size={24} />
                    <h2>Kiến thức Tin học</h2>
                  </div>
                  <div className="category-tabs">
                    {['All', 'Word', 'Excel', 'PowerPoint', 'IC3 Spark', 'IC3 GS6'].map((cat) => (
                      <button
                        key={cat}
                        className={`category-tab-btn ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}
                      >
                        {cat === 'All' ? 'Tất cả' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredArticles.length === 0 ? (
                  <div className="no-articles-portal">
                    <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <h3>Chưa có bài viết kiến thức nào</h3>
                    <p>Nội dung kiến thức đang được cập nhật thêm.</p>
                  </div>
                ) : (
                  <div className="articles-layout-container">
                    {featuredArticle && (
                      <div
                        className="featured-article-card"
                        onClick={() => setSelectedArticle(featuredArticle)}
                      >
                        <div className="featured-image-wrapper">
                          <img src={featuredArticle.image} alt={featuredArticle.title} />
                          <span className="article-category-badge">{featuredArticle.category}</span>
                        </div>
                        <div className="featured-article-info">
                          <h3>{featuredArticle.title}</h3>
                          <p className="article-desc">{featuredArticle.description}</p>
                          {featuredArticle.summary && (
                            <p className="article-steps-summary">{featuredArticle.summary}</p>
                          )}
                          <span className="btn-read-more">Đọc tiếp <ArrowRight size={14} /></span>
                        </div>
                      </div>
                    )}

                    {paginatedSubArticles.length > 0 && (
                      <div className="sub-articles-grid-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div className="sub-articles-grid">
                          {paginatedSubArticles.map((art) => (
                            <div
                              key={art.id}
                              className="sub-article-card"
                              onClick={() => setSelectedArticle(art)}
                            >
                              <div className="sub-image-wrapper">
                                <img src={art.image || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60'} alt={art.title} />
                                <span className="article-category-badge">{art.category}</span>
                              </div>
                              <div className="sub-article-info">
                                <h4>{art.title}</h4>
                                <span className="btn-read-more-sub">Đọc tiếp <ArrowRight size={12} /></span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {totalSubPages > 1 && (
                          <div className="articles-pagination">
                            <button
                              disabled={currentArticlePage === 1}
                              onClick={() => setCurrentArticlePage(p => Math.max(1, p - 1))}
                              className="btn-pagination-nav"
                            >
                              Trang trước
                            </button>
                            <span className="pagination-info">
                              Trang {currentArticlePage} / {totalSubPages}
                            </span>
                            <button
                              disabled={currentArticlePage === totalSubPages}
                              onClick={() => setCurrentArticlePage(p => Math.min(totalSubPages, p + 1))}
                              className="btn-pagination-nav"
                            >
                              Trang sau
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <StudentPortalLevel
              selectedLevelId={selectedLevelId}
              programLevels={programLevels}
              quizzes={filteredLevelQuizzes}
              onBack={() => {
                if (selectedProgram) {
                  setWizardStep('select_level');
                  setIsModalOpen(true);
                } else {
                  setCurrentView('home');
                  setSelectedLevelId(null);
                }
              }}
              onSelectQuiz={handleSelectQuizWithMode}
            />
          )}
        </div>

        {/* Modularized registration and level quiz selection wizard */}
        <StudentPortalRegistration
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          selectedProgram={selectedProgram}
          selectedLevelId={selectedLevelId}
          filteredLevelQuizzes={filteredLevelQuizzes}
          quizToStart={quizToStart}
          schools={schools}
          classes={classes}
          students={students}
          selectedSchoolId={selectedSchoolId}
          setSelectedSchoolId={setSelectedSchoolId}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          errorMsg={errorMsg}
          loading={loading}
          programLevels={programLevels}
          handleStartQuiz={handleStartQuiz}
          handleSelectLevel={handleSelectLevel}
          handleSelectQuiz={handleSelectQuiz}
          comingSoonModal={comingSoonModal}
          setComingSoonModal={setComingSoonModal}
          enteredPin={enteredPin}
          setEnteredPin={setEnteredPin}
          quizMode={levelQuizMode}
          setQuizMode={setLevelQuizMode}
          isModePreselected={isModePreselected}
        />

        {/* Article Reader Modal */}
        {selectedArticle && createPortal(
          <div className="student-modal-overlay active" onClick={() => setSelectedArticle(null)}>
            <div className="article-reader-modal glass" onClick={(e) => e.stopPropagation()}>
              <div className="reader-modal-header">
                <span className="article-category-badge">{selectedArticle.category}</span>
                <button className="btn-close-modal" onClick={() => setSelectedArticle(null)}>&times;</button>
              </div>
              <div className="reader-modal-body">
                <h2>{selectedArticle.title}</h2>
                <div className="reader-hero-image">
                  <img src={selectedArticle.image} alt={selectedArticle.title} />
                </div>
                <div className="reader-content-text">
                  <p className="highlight-desc">{selectedArticle.description}</p>

                  {selectedArticle.content ? (
                    <div className="article-extended-content" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                  ) : (
                    <>
                      {selectedArticle.category === 'Word' && (
                        <div className="article-extended-content">
                          <h3>📌 Các bước thực hành chi tiết</h3>
                          <ol>
                            <li>Mở phần mềm Microsoft Word và truy cập tài liệu cần chỉnh sửa.</li>
                            <li>Định vị con trỏ soạn thảo tại vị trí mong muốn thực hiện thao tác.</li>
                            <li>Sử dụng các thanh công cụ trên Ribbon để kích hoạt tính năng thích hợp.</li>
                            <li>Kiểm tra lại định dạng hiển thị để đảm bảo văn bản trông chuyên nghiệp nhất.</li>
                          </ol>
                          <blockquote>
                            <strong>Mẹo hay:</strong> Sử dụng các tổ hợp phím tắt như Ctrl + S thường xuyên để lưu lại công việc của bạn nhé!
                          </blockquote>
                        </div>
                      )}

                      {selectedArticle.category === 'Excel' && (
                        <div className="article-extended-content">
                          <h3>📊 Hướng dẫn tính toán trên bảng tính</h3>
                          <ol>
                            <li>Nhấp vào ô muốn hiển thị kết quả công thức tính toán.</li>
                            <li>Gõ dấu bằng <code>=</code> để bắt đầu nhập hàm.</li>
                            <li>Chọn vùng dữ liệu nguồn cần quét (ví dụ: A1:D10).</li>
                            <li>Nhấn Enter và sử dụng AutoFill kéo xuống các dòng còn lại nếu cần.</li>
                          </ol>
                          <blockquote>
                            <strong>Lưu ý quan trọng:</strong> Luôn kiểm tra xem kiểu dữ liệu có trùng khớp không để tránh lỗi <code>#VALUE!</code> đáng tiếc.
                          </blockquote>
                        </div>
                      )}

                      {selectedArticle.category === 'Powerpoint' && (
                        <div className="article-extended-content">
                          <h3>🎨 Cách thiết kế slide ấn tượng và lôi cuốn</h3>
                          <ol>
                            <li>Chọn layout slide phù hợp với nội dung trình bày (Title, Content, Comparison).</li>
                            <li>Sử dụng không quá 3 font chữ trong toàn bộ slide để tránh gây rối mắt.</li>
                            <li>Áp dụng hiệu ứng chuyển động một cách tinh tế, tránh quá lạm dụng.</li>
                            <li>Tập trung vào hình ảnh minh họa chất lượng cao thay vì nhồi nhét quá nhiều chữ.</li>
                          </ol>
                          <blockquote>
                            <strong>Nguyên tắc vàng:</strong> 1 Slide - 1 Thông điệp chính để người nghe dễ dàng ghi nhớ.
                          </blockquote>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="reader-modal-footer">
                <button className="btn-modal-cancel" onClick={() => setSelectedArticle(null)}>Đóng lại</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <footer className="portal-footer">
          <p>IC3 Manager System &copy; 2026 &bull; Designed with creativity by Nguyễn Thuận An</p>
        </footer>
      </div>
    );
  }

  // Render review screen after submission
  if (examSubmitted && !isReviewMode) {
    const totalMaxPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    return (
      <StudentPortalResults
        finalScore={finalScore}
        cheatWarnings={cheatWarnings}
        detailedResults={detailedResults}
        totalMaxPoints={totalMaxPoints}
        onFinish={handleFinishExam}
        onRestart={handleRestartQuiz}
        onReview={() => setIsReviewMode(true)}
      />
    );
  }

  // Active exam page layout
  return (
    <>
      <StudentPortalExam
        quizToStart={quizToStart}
        students={students}
        selectedStudentId={selectedStudentId}
        timeLeft={timeLeft}
        formatTime={formatTime}
        handleManualSubmit={handleManualSubmit}
        questions={questions}
        answers={answers}
        setAnswers={setAnswers}
        activeQIndex={activeQIndex}
        setActiveQIndex={setActiveQIndex}
        checkedQuestions={checkedQuestions}
        setCheckedQuestions={setCheckedQuestions}
        quizMode={quizMode}
        selectedLeftId={selectedLeftId}
        handleSelectSingleChoice={handleSelectSingleChoice}
        handleSelectMultipleChoice={handleSelectMultipleChoice}
        handleSelectTrueFalse={handleSelectTrueFalse}
        handleSelectMultiTF={handleSelectMultiTF}
        handleSelectMatchingSide={handleSelectMatchingSide}
        clearMatchingPair={clearMatchingPair}
        moveOrderItem={moveOrderItem}
        handleHotspotClick={handleHotspotClick}
        checkAnswerClient={checkAnswerClient}
        showCheatBlocker={showCheatBlocker}
        cheatWarnings={cheatWarnings}
        blockerReason={blockerReason}
        requestFullscreen={requestFullscreen}
        isReviewMode={isReviewMode}
        onExitReview={() => setIsReviewMode(false)}
      />
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        mode={modalConfig.mode}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeConfirmModal}
      />
    </>
  );
};

export default StudentPortal;
