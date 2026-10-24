import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowRight, LogIn, BookOpen, Sun, Moon, ChevronRight, ChevronDown, X } from 'lucide-react';
import {
  getPublicSchools, getPublicClasses, getPublicStudents, getPublicQuizzes,
  startQuizAttempt, saveQuizAttempt, submitQuizAttempt, getPublicArticles,
  getQuizAttemptResults
} from '../api';
import './css/QuizPortal.css';
import './css/StudentPortalResults.css';
import './css/StudentPortalRegistration.css';
import LevelPage from './LevelPage';
import { StudentPortalExam } from './portal/StudentPortalExam';
import ConfirmModal from '../components/ConfirmModal';
import { StudentPortalPinEntry } from './portal/StudentPortalPinEntry';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useDevToolsBlocker } from '../hooks/useDevToolsBlocker';
import { useExamLockdown } from '../hooks/useExamLockdown';

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
  video_url?: string;
  options: any;
  points: number;
  correct_answer?: any;
}



const checkAnswerClient = (qType: string, correct: any, student: any): boolean => {
  if (correct === undefined || correct === null || student === undefined || student === null) {
    return false;
  }

  if (qType === 'single_choice' || qType === 'true_false') {
    return String(correct).trim().toLowerCase() === String(student).trim().toLowerCase();
  }

  if (qType === 'multiple_choice') {
    if (!Array.isArray(correct) || !Array.isArray(student)) return false;
    const cSorted = [...correct].map(x => String(x).trim().toLowerCase()).sort();
    const sSorted = [...student].map(x => String(x).trim().toLowerCase()).sort();
    return JSON.stringify(cSorted) === JSON.stringify(sSorted);
  }

  if (qType === 'matching' || qType === 'multi_true_false') {
    if (typeof correct !== 'object' || typeof student !== 'object') return false;
    const cKeys = Object.keys(correct);
    for (const k of cKeys) {
      if (student[k] === undefined) return false;
      if (String(correct[k]).trim().toLowerCase() !== String(student[k]).trim().toLowerCase()) return false;
    }
    return true;
  }

  if (qType === 'ordering') {
    if (!Array.isArray(correct) || !Array.isArray(student)) return false;
    const cList = correct.map(x => String(x).trim().toLowerCase());
    const sList = student.map(x => String(x).trim().toLowerCase());
    return JSON.stringify(cList) === JSON.stringify(sList);
  }

  if (qType === 'hotspot') {
    // Normalize correct zones
    let correctZones: any[] = [];
    if (Array.isArray(correct)) {
      correctZones = correct;
    } else if (typeof correct === 'object' && correct.x !== undefined) {
      correctZones = [correct];
    } else {
      return false;
    }

    // Normalize student points
    let studentPoints: any[] = [];
    if (Array.isArray(student)) {
      studentPoints = student;
    } else if (typeof student === 'object' && student.x !== undefined) {
      studentPoints = [student];
    } else {
      return false;
    }

    if (!studentPoints.length || !correctZones.length) return false;

    try {
      const matchedIndices = new Set<number>();
      for (const pt of studentPoints) {
        const sx = parseFloat(pt.x);
        const sy = parseFloat(pt.y);
        let found = false;
        for (let zi = 0; zi < correctZones.length; zi++) {
          if (matchedIndices.has(zi)) continue;
          const zone = correctZones[zi];
          const cx = parseFloat(zone.x);
          const cy = parseFloat(zone.y);
          const cw = parseFloat(zone.w);
          const ch = parseFloat(zone.h);
          if (sx >= cx && sx <= cx + cw && sy >= cy && sy <= cy + ch) {
            matchedIndices.add(zi);
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  if (qType === 'short_answer') {
    if (Array.isArray(correct)) {
      return correct.some(ans => String(ans).trim().toLowerCase() === String(student).trim().toLowerCase());
    }
    return String(correct).trim().toLowerCase() === String(student).trim().toLowerCase();
  }

  return String(correct) === String(student);
};

// The articles are now loaded dynamically from the database API.

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

const findProgramForLevel = (levelId: string): string | null => {
  for (const progKey in programLevels) {
    const hasLevel = programLevels[progKey].levels.some(l => l.id === levelId);
    if (hasLevel) return progKey;
  }
  return null;
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

const QuizPortal: React.FC = () => {
  const { levelId, attemptId: routeAttemptId } = useParams<{ levelId?: string; attemptId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Chặn DevTools trên luồng học sinh
  const isPublicPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isDevToolsOpen = useDevToolsBlocker(isPublicPreview);

  // Roster registration states
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Custom dropdown states
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Custom dropdown refs
  const schoolSelectRef = useRef<HTMLDivElement>(null);
  const classSelectRef = useRef<HTMLDivElement>(null);
  const studentSelectRef = useRef<HTMLDivElement>(null);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (schoolSelectRef.current && !schoolSelectRef.current.contains(e.target as Node)) {
        setIsSchoolDropdownOpen(false);
      }
      if (classSelectRef.current && !classSelectRef.current.contains(e.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (studentSelectRef.current && !studentSelectRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  // Khôi phục phiên làm bài một lần duy nhất khi component mount
  const savedSessionRef = useRef<any>(undefined);
  const isStartingQuizRef = useRef(false);
  if (savedSessionRef.current === undefined) {
    savedSessionRef.current = (() => {
      try {
        const saved = localStorage.getItem('ic3_exam_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.attemptId) {
            // Kiểm tra thời gian thực tế còn lại dựa trên examEndTime
            if (parsed.examEndTime) {
              const realRemaining = Math.max(0, Math.floor((parsed.examEndTime - Date.now()) / 1000));
              if (realRemaining <= 0) {
                localStorage.removeItem('ic3_exam_session');
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
  const [publicQuizzes, setPublicQuizzes] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ic3_public_quizzes');
      return saved ? JSON.parse(saved) : [];
    } catch (defaultVal) {
      return [];
    }
  });
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(() => {
    try {
      const saved = localStorage.getItem('ic3_public_quizzes');
      return !saved || JSON.parse(saved).length === 0;
    } catch (defaultVal) {
      return true;
    }
  });
  const [quizToStart, setQuizToStart] = useState<any | null>(savedSession ? savedSession.quizToStart : null);

  // States for unified program quiz wizard modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<'select_level' | 'select_quiz' | 'student_info' | 'enter_pin'>('select_level');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null); // 'Primary' | 'Secondary' | 'High'
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null); // e.g. 'GS6_L1'
  const [filteredLevelQuizzes, setFilteredLevelQuizzes] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'level_page'>('home');
  const [levelQuizMode, setLevelQuizMode] = useState<'training' | 'testing' | 'practice'>('testing');
  const [isModePreselected, setIsModePreselected] = useState<boolean>(false);
  const [comingSoonModal, setComingSoonModal] = useState({ open: false, title: '', desc: '' });

  // Synchronize route levelId parameter with component view states
  useEffect(() => {
    if (levelId) {
      const progKey = findProgramForLevel(levelId);
      if (progKey) {
        setSelectedProgram(progKey);
        setSelectedLevelId(levelId);
        if (publicQuizzes && publicQuizzes.length > 0) {
          const qz = getQuizzesForLevel(progKey, levelId, publicQuizzes);
          setFilteredLevelQuizzes(qz);
        }
        setCurrentView('level_page');
      } else {
        // Invalid level ID, redirect/fallback to home
        navigate('/', { replace: true });
      }
    } else {
      // Home page
      setCurrentView('home');
      setSelectedLevelId(null);
      if (!isModalOpen) {
        setSelectedProgram(null);
        setFilteredLevelQuizzes([]);
      }
    }
  }, [levelId, publicQuizzes, navigate, isModalOpen]);

  // Handle navigation state (e.g. from Back button on level page)
  useEffect(() => {
    if (location.state && (location.state as any).openLevelSelect) {
      const stateObj = location.state as any;
      setSelectedProgram(stateObj.program);
      setWizardStep('select_level');
      setIsModalOpen(true);
      
      // Clear location state so refreshing doesn't keep opening it
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);


  // Knowledge articles active filter
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Selected article to read in full
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [currentArticlePage, setCurrentArticlePage] = useState(1);

  // Reset pagination on category change
  useEffect(() => {
    setCurrentArticlePage(1);
  }, [activeCategory]);

  // Exam taking states
  const [isExamStarted, setIsExamStarted] = useState(!!savedSession);
  const [attemptId, setAttemptId] = useState<number | null>(savedSession ? savedSession.attemptId : null);
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

  const [zoomedMediaUrl, setZoomedMediaUrl] = useState<string | null>(null);

  // Escape key listener to close Lightbox zoom modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedMediaUrl(null);
      }
    };
    if (zoomedMediaUrl) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomedMediaUrl]);

  // Anti-cheat states
  const [cheatWarnings, setCheatWarnings] = useState(savedSession ? (savedSession.cheatWarnings || 0) : 0);
  const [showCheatBlocker, setShowCheatBlocker] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');

  // Timers and duration
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
  const [examSubmitted, setExamSubmitted] = useState(false);
  // Khoá copy/dán/in ấn khi đang thi chính thức (không áp dụng ôn luyện hoặc xem trước)
  useExamLockdown(isExamStarted && !examSubmitted && quizMode === 'testing' && !isPublicPreview);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load attempt results if routeAttemptId is present in URL params
  useEffect(() => {
    if (routeAttemptId === '-1') {
      if (!examSubmitted) {
        navigate(levelId ? `/level/${levelId}` : '/');
      }
      return;
    }

    if (routeAttemptId) {
      if (isStartingQuizRef.current) {
        return;
      }
      // If we are already displaying the submitted results for this attempt, don't refetch
      if (examSubmitted && attemptId === Number(routeAttemptId)) {
        return;
      }
      const loadPastAttempt = async () => {
        setLoading(true);
        try {
          const res = await getQuizAttemptResults(Number(routeAttemptId));
          if (res.data.status === 'success') {
            // Merge detailed_results with questions to set correct_answer and explanation
            if (res.data.detailed_results && res.data.questions) {
              const mergedQuestions = res.data.questions.map((q: any) => {
                const detail = res.data.detailed_results.find((r: any) => r.question_id === q.question_id);
                return detail ? { ...q, correct_answer: detail.correct_answer, explanation: detail.explanation } : q;
              });
              setQuestions(mergedQuestions);
            } else {
              setQuestions(res.data.questions || []);
            }

            setAnswers(res.data.answers || {});
            setAttemptId(res.data.attempt_id);
            setFinalScore(res.data.score_achieved);
            setCheatWarnings(res.data.cheat_warnings_count || 0);
            setDurationSeconds(res.data.duration_seconds || 0);
            setQuizToStart({
              quiz_id: res.data.quiz_id,
              title: res.data.quiz_title,
              time_limit: res.data.time_limit
            });

            // Populate student, class, school, and mode details so "Làm lại" works
            if (res.data.school_id) setSelectedSchoolId(res.data.school_id);
            if (res.data.class_id) setSelectedClassId(res.data.class_id);
            if (res.data.student_id) setSelectedStudentId(res.data.student_id);
            if (res.data.quiz_mode) setLevelQuizMode(res.data.quiz_mode);

            setIsExamStarted(false);
            setExamSubmitted(true);
            setIsModalOpen(false);
          }
        } catch (err: any) {
          console.error('Lỗi khi tải kết quả lượt thi:', err);
          showAlert('Lỗi tải kết quả', err.response?.data?.message || 'Không thể tải kết quả của lượt thi này.', 'danger', 'Đồng ý');
          if (levelId) {
            navigate(`/level/${levelId}`);
          } else {
            navigate('/');
          }
        } finally {
          setLoading(false);
        }
      };
      loadPastAttempt();
    }
  }, [routeAttemptId, levelId, navigate, examSubmitted, attemptId]);

  // Theme state for student portal
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

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

  // Refs for tracking timer values in listeners
  // Khởi tạo refs với giá trị từ savedSession để interval đọc đúng ngay từ tick đầu tiên
  const timerRef = useRef<any>(null);
  const timeLeftRef = useRef(timeLeft);
  const cheatWarningsRef = useRef(cheatWarnings);
  const durationRef = useRef(durationSeconds);
  const answersRef = useRef<Record<string, any>>(answers);
  const attemptIdRef = useRef<number | null>(attemptId);
  const examStartTimeRef = useRef<number | null>(examStartTime);
  const examEndTimeRef = useRef<number | null>(examEndTime);

  useEffect(() => {
    examStartTimeRef.current = examStartTime;
  }, [examStartTime]);

  useEffect(() => {
    examEndTimeRef.current = examEndTime;
  }, [examEndTime]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    cheatWarningsRef.current = cheatWarnings;
  }, [cheatWarnings]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);



  // Tự động lưu trạng thái thi vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (isExamStarted && attemptId && quizToStart) {
      const stateToSave = {
        quizToStart,
        attemptId,
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
        localStorage.setItem('ic3_exam_session', JSON.stringify(stateToSave));
      } catch (e) {
        console.warn('Unable to save session to localStorage (storage access blocked):', e);
      }
    }
  }, [
    isExamStarted,
    quizToStart,
    attemptId,
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
        localStorage.removeItem('ic3_exam_session');
      } catch (e) {
        console.warn('Unable to remove session from localStorage (storage access blocked):', e);
      }
    }
  }, [isExamStarted]);

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
        try {
          localStorage.setItem('ic3_public_quizzes', JSON.stringify(sortedQuizzes));
        } catch (e) {
          console.warn('Unable to write public quizzes to localStorage:', e);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
      } finally {
        setIsLoadingQuizzes(false);
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



  // Handle anti-cheat events when exam is active
  useEffect(() => {
    if (!isExamStarted || examSubmitted) return;

    if (quizMode === 'training') {
      // 3. Countdowns and duration increment
      timerRef.current = setInterval(() => {
        const startTime = examStartTimeRef.current;
        const endTime = examEndTimeRef.current;
        const limit = (quizToStart?.time_limit || 45) * 60;

        if (startTime && endTime) {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          const elapsed = Math.min(limit, Math.floor((now - startTime) / 1000));

          setTimeLeft(remaining);
          setDurationSeconds(elapsed);

          if (remaining <= 0) {
            clearInterval(timerRef.current);
            triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
          }
        } else {
          setDurationSeconds(d => d + 1);
          setTimeLeft(t => {
            if (t <= 1) {
              clearInterval(timerRef.current);
              triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
              return 0;
            }
            return t - 1;
          });
        }
      }, 1000);

      // 4. Auto-save answers every 5 seconds
      const autoSaveInterval = setInterval(() => {
        if (attemptIdRef.current && !examSubmitted) {
          saveQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: 0,
            duration_seconds: durationRef.current
          }).catch(console.error);
        }
      }, 5000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(autoSaveInterval);
      };
    }

    // 1. Tab switching detection
    const handleVisibilityChange = (force?: unknown) => {
      if (force === true || document.visibilityState === 'hidden') {
        const nextWarnings = cheatWarningsRef.current + 1;
        setCheatWarnings(nextWarnings);

        // Auto-save immediately to register warning on server
        if (attemptIdRef.current) {
          saveQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: nextWarnings,
            duration_seconds: durationRef.current
          }).catch(console.error);
        }

        if (nextWarnings >= 3) {
          // Auto submit on 3rd warning
          triggerAutoSubmit('Bạn đã vi phạm quy chế thi (chuyển tab/rời màn hình quá 3 lần). Bài thi đã tự động nộp.');
        } else {
          setBlockerReason(`Bạn đã chuyển tab hoặc rời màn hình làm bài. Cảnh báo vi phạm: ${nextWarnings}/3 lần. Chú ý: quá 3 lần hệ thống sẽ tự động nộp bài!`);
          setShowCheatBlocker(true);
        }
      }
    };

    // 2. Fullscreen change detection
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      if (!isFull && !examSubmitted) {
        const nextWarnings = cheatWarningsRef.current + 1;
        setCheatWarnings(nextWarnings);

        // Auto-save immediately to register warning on server
        if (attemptIdRef.current) {
          saveQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: nextWarnings,
            duration_seconds: durationRef.current
          }).catch(console.error);
        }

        if (nextWarnings >= 3) {
          // Auto submit on 3rd warning
          triggerAutoSubmit('Bạn đã vi phạm quy chế thi (thoát toàn màn hình quá 3 lần). Bài thi đã tự động nộp.');
        } else {
          setBlockerReason(`Yêu cầu bắt buộc chế độ Toàn màn hình (Fullscreen) để làm bài thi. Cảnh báo vi phạm: ${nextWarnings}/3 lần. Chú ý: quá 3 lần hệ thống sẽ tự động nộp bài!`);
          setShowCheatBlocker(true);
        }
      }
    };

    // Mất focus cửa sổ (chuyển sang cửa sổ/màn hình khác) quá 3 giây tính như rời tab
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const handleWindowBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!document.hasFocus() && document.visibilityState !== 'hidden') handleVisibilityChange(true);
      }, 3000);
    };
    const handleWindowFocus = () => { if (blurTimer) clearTimeout(blurTimer); };
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // 3. Countdowns and duration increment
    timerRef.current = setInterval(() => {
      const startTime = examStartTimeRef.current;
      const endTime = examEndTimeRef.current;
      const limit = (quizToStart?.time_limit || 45) * 60;

      if (startTime && endTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        const elapsed = Math.min(limit, Math.floor((now - startTime) / 1000));

        setTimeLeft(remaining);
        setDurationSeconds(elapsed);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
        }
      } else {
        setDurationSeconds(d => d + 1);
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    // 4. Auto-save answers every 5 seconds
    const autoSaveInterval = setInterval(() => {
      if (attemptIdRef.current && !examSubmitted) {
        saveQuizAttempt(attemptIdRef.current, {
          answers: answersRef.current,
          cheat_warnings_count: cheatWarningsRef.current,
          duration_seconds: durationRef.current
        }).catch(console.error);
      }
    }, 5000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (blurTimer) clearTimeout(blurTimer);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(autoSaveInterval);
    };
  }, [isExamStarted, examSubmitted, quizMode]);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setShowCheatBlocker(false);
      }
    } catch (err) {
      console.error('Không thể kích hoạt Fullscreen:', err);
    }
  };

  const handleStartQuiz = async (quizId: number, pinVal?: string, modeOverride?: 'training' | 'testing' | 'practice') => {
    if (!selectedSchoolId || !selectedClassId || !selectedStudentId) {
      setErrorMsg('Vui lòng hoàn thành chọn thông tin Trường, Lớp và Họ tên.');
      isStartingQuizRef.current = false;
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const activeMode = modeOverride || levelQuizMode;

    try {
      const res = await startQuizAttempt({
        quiz_id: quizId,
        student_id: Number(selectedStudentId),
        quiz_mode: activeMode,
        pin_code: pinVal
      });

      const mode = res.data.quiz_mode || 'testing';
      setQuizMode(mode);
      setLevelQuizMode(mode);
      setCheckedQuestions({});

      setAttemptId(res.data.attempt_id);
      setQuestions(res.data.questions);
      setAnswers(initializeOrderingAnswers(res.data.questions, res.data.answers || {}));

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
      setCheatWarnings(res.data.cheat_warnings_count || 0);

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
        const msg = err.response?.data?.message || 'Có lỗi xảy ra khi bắt đầu thi.';
        setErrorMsg(msg);
        showAlert('Lỗi bắt đầu thi', msg, 'danger', 'Đồng ý');
      }
    } finally {
      setLoading(false);
      isStartingQuizRef.current = false;
    }
  };

  const triggerAutoSubmit = async (reason: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    showAlert('Thông báo hệ thống', reason, 'warning', 'Đồng ý');

    if (attemptIdRef.current) {
      setLoading(true);
      try {
        if (attemptIdRef.current > 0) {
          const res = await submitQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: cheatWarningsRef.current,
            duration_seconds: durationRef.current,
            is_auto_submit: true
          });

          setFinalScore(res.data.score_achieved);
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
          questions.forEach(q => {
            const studentAns = answersRef.current[q.question_id];
            const isCorrect = checkAnswerClient(q.question_type, q.correct_answer, studentAns);
            const earnedPoints = isCorrect ? Number(q.points) : 0.0;
            totalScore += earnedPoints;
          });
          setFinalScore(totalScore);
          // Set questions correct answers and explanations directly from existing list
          setQuestions([...questions]); 
        }
        setExamSubmitted(true);
        setIsExamStarted(false);
        setShowCheatBlocker(false);

        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }

        const finalAttemptId = attemptIdRef.current > 0 ? (attemptIdRef.current) : -1;
        const currentLvl = levelId || selectedLevelId;
        if (currentLvl) {
          window.history.pushState(null, '', `/level/${currentLvl}/results/${finalAttemptId}`);
        } else {
          window.history.pushState(null, '', `/results/${finalAttemptId}`);
        }
      } catch (err) {
        console.error('Lỗi tự động nộp bài:', err);
      } finally {
        setLoading(false);
      }
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
        if (timerRef.current) clearInterval(timerRef.current);
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
              questions.forEach(q => {
                const studentAns = answers[q.question_id];
                const isCorrect = checkAnswerClient(q.question_type, q.correct_answer, studentAns);
                const earnedPoints = isCorrect ? Number(q.points) : 0.0;
                totalScore += earnedPoints;
              });
              setFinalScore(totalScore);
              setQuestions([...questions]);
            }
            setExamSubmitted(true);
            setIsExamStarted(false);
            setShowCheatBlocker(false);

            if (document.fullscreenElement) {
              document.exitFullscreen().catch(console.error);
            }

            const finalAttemptId = attemptId > 0 ? attemptId : -1;
            const currentLvl = levelId || selectedLevelId;
            if (currentLvl) {
              window.history.pushState(null, '', `/level/${currentLvl}/results/${finalAttemptId}`);
            } else {
              window.history.pushState(null, '', `/results/${finalAttemptId}`);
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

  const handleRestartQuiz = () => {
    if (quizToStart) {
      setAnswers({});
      setActiveQIndex(0);
      setCheckedQuestions({});
      setExamSubmitted(false);
      setIsReviewMode(false);
      setFinalScore(0);
      setErrorMsg('');
      setCheatWarnings(0);
      setDurationSeconds(0);
      setEnteredPin('');

      try {
        localStorage.removeItem('ic3_exam_session');
      } catch (e) {
        console.warn('Unable to remove session from localStorage (storage access blocked):', e);
      }

      const currentLvl = levelId || selectedLevelId;
      if (currentLvl) {
        window.history.pushState(null, '', `/level/${currentLvl}`);
      } else {
        window.history.pushState(null, '', `/`);
      }

      handleStartQuiz(quizToStart.quiz_id, undefined, levelQuizMode);
    }
  };

  // Auto-restart quiz if the restart flag is set in sessionStorage
  useEffect(() => {
    if (!routeAttemptId) {
      const restartQuizId = sessionStorage.getItem('ic3_restart_quiz_id');
      const restartQuizMode = sessionStorage.getItem('ic3_restart_quiz_mode');
      if (restartQuizId) {
        sessionStorage.removeItem('ic3_restart_quiz_id');
        sessionStorage.removeItem('ic3_restart_quiz_mode');
        
        if (restartQuizMode) {
          setLevelQuizMode(restartQuizMode as 'training' | 'testing' | 'practice');
        }
        
        setTimeout(() => {
          handleStartQuiz(Number(restartQuizId), undefined, restartQuizMode as 'training' | 'testing' | 'practice');
        }, 100);
      }
    }
  }, [routeAttemptId, levelId]);

  const handleGoBackToPortal = () => {
    setIsExamStarted(false);
    setExamSubmitted(false);
    setIsReviewMode(false);
    setAttemptId(null);
    setQuestions([]);
    setAnswers({});
    setActiveQIndex(0);
    setCheckedQuestions({});
    setFinalScore(0);
    setCheatWarnings(0);
    setDurationSeconds(0);
    setQuizToStart(null);
    setErrorMsg('');
    try {
      localStorage.removeItem('ic3_exam_session');
    } catch (e) {
      console.warn('Unable to remove session from localStorage:', e);
    }
    const currentLvl = levelId || selectedLevelId;
    if (currentLvl) {
      navigate(`/level/${currentLvl}`);
    } else {
      navigate('/');
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
    const maxSelections = (q?.options && typeof q.options === 'object' && !Array.isArray(q.options))
      ? (q.options.max_selections || 1) : 1;

    if (maxSelections <= 1) {
      // Single point mode (backward compatible)
      setAnswers({ ...answers, [qId]: { x, y } });
    } else {
      // Multi-point mode
      const currentPoints = Array.isArray(answers[qId]) ? [...answers[qId]] : [];
      if (currentPoints.length < maxSelections) {
        currentPoints.push({ x, y });
      } else {
        // Replace the oldest point
        currentPoints.shift();
        currentPoints.push({ x, y });
      }
      setAnswers({ ...answers, [qId]: currentPoints });
    }
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
    setIsModalOpen(false);
    navigate(`/level/${levelId}`);
  };

  const handleSelectQuiz = (quiz: any, presetMode?: 'training' | 'testing' | 'practice') => {
    setQuizToStart(quiz);
    setIsSchoolDropdownOpen(false);
    setIsClassDropdownOpen(false);
    setIsStudentDropdownOpen(false);
    setErrorMsg('');
    if (quiz && !quiz.allow_practice) {
      setLevelQuizMode('testing');
      setIsModePreselected(false);
    } else if (presetMode) {
      setLevelQuizMode(presetMode);
      setIsModePreselected(true);
    } else {
      setLevelQuizMode(prev => (prev === 'practice' || prev === 'training') ? prev : 'testing');
      setIsModePreselected(false);
    }
    setWizardStep('student_info');
    setIsModalOpen(true);
  };

  const handleSelectQuizWithMode = (quiz: any, mode: 'training' | 'testing' | 'practice') => {
    handleSelectQuiz(quiz, mode);
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

  // Show loading spinner when fetching past attempt
  if (routeAttemptId && (loading || attemptId !== Number(routeAttemptId))) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-color)' }}>
        <div className="animate-spin" style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(226, 232, 240, 0.8)',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%'
        }}></div>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1.1rem' }}>
          Đang tải kết quả bài thi...
        </div>
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
          <div
            className="portal-logo"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span className="logo-badge">IC3</span>
            <h1>Manager</h1>
          </div>
          <nav className="portal-nav-links">
            <button
              className="nav-link-btn"
              onClick={() => {
                navigate('/');
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
            <LevelPage
              selectedLevelId={selectedLevelId}
              programLevels={programLevels}
              quizzes={filteredLevelQuizzes}
              isLoading={isLoadingQuizzes}
              onBack={() => {
                const progKey = selectedProgram || (levelId ? findProgramForLevel(levelId) : null);
                navigate('/', { state: { openLevelSelect: true, program: progKey } });
              }}
              onSelectQuiz={handleSelectQuizWithMode}
            />
          )}
        </div>

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

        {/* Unified Program & Level Quiz Wizard Modal */}
        {isModalOpen && selectedProgram && createPortal(
          <div className="student-modal-overlay active" onClick={() => setIsModalOpen(false)}>
            <div className="student-modal-content wizard-modal-content glass" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-title">
                <h3>
                  {selectedProgram === 'Primary'
                    ? 'Chương Trình Tiểu Học (IC3 SPARK)'
                    : selectedProgram === 'Secondary'
                      ? 'Chương Trình THCS (IC3 GS6)'
                      : 'Chương Trình THPT (MOS)'}
                </h3>
                <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
              </div>

              {/* STEP 1: SELECT LEVEL */}
              {wizardStep === 'select_level' && (
                <div className="wizard-step-body">
                  <div className="modal-levels-list">
                    {programLevels[selectedProgram]?.levels.map((level) => (
                      <button
                        key={level.id}
                        className="modal-level-item"
                        onClick={() => handleSelectLevel(level.id)}
                      >
                        <div className="level-item-left">
                          <span className="level-tag-badge">{level.tag}</span>
                          <span className="level-name-text">{level.name}</span>
                        </div>
                        <ChevronRight size={18} className="chevron-right-icon" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT QUIZ */}
              {wizardStep === 'select_quiz' && (
                <div className="wizard-step-body">
                  <p className="wizard-step-instruction">
                    Chọn đề thi ôn luyện cho cấp độ: <strong>{programLevels[selectedProgram]?.levels.find(l => l.id === selectedLevelId)?.name}</strong>
                  </p>

                  {filteredLevelQuizzes.length === 0 ? (
                    <div className="empty-wizard-quizzes">
                      <BookOpen size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                      <p>Hiện tại chưa có đề thi nào được xuất bản cho cấp độ này.</p>
                    </div>
                  ) : (
                    <div className="wizard-quizzes-list">
                      {filteredLevelQuizzes.map((quiz) => (
                        <div key={quiz.quiz_id} className="wizard-quiz-card" onClick={() => handleSelectQuiz(quiz)}>
                          <div className="quiz-card-info">
                            <h4>{quiz.title}</h4>
                            <span className="quiz-card-meta">
                              {quiz.question_count} câu hỏi &bull; {quiz.time_limit} phút &bull; Hỗ trợ: Tự học &amp; Thi thử
                            </span>
                          </div>
                          <ChevronRight size={16} className="chevron-right-icon" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="modal-actions-row">
                    <button
                      className="btn-modal-cancel"
                      onClick={() => setWizardStep('select_level')}
                    >
                      Quay lại
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: STUDENT INFO FORM */}
              {wizardStep === 'student_info' && quizToStart && (
                <div className="wizard-step-body">
                  <p className="wizard-step-instruction">
                    Vui lòng xác nhận thông tin học sinh để bắt đầu bài thi: <strong>{quizToStart.title}</strong>
                  </p>

                  {errorMsg && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{errorMsg}</div>}

                  <div className="modal-form-body">
                    <div className="form-group">
                      <label>1. Chọn Trường học</label>
                      <div className="custom-select-container" ref={schoolSelectRef}>
                        <button
                          type="button"
                          className={`custom-select-trigger ${isSchoolDropdownOpen ? 'open' : ''}`}
                          onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                        >
                          <span>
                            {selectedSchoolId
                              ? schools.find((s) => s.school_id === Number(selectedSchoolId))?.school_name
                              : '-- Chọn trường học --'}
                          </span>
                          <ChevronDown size={18} className="select-arrow" />
                        </button>
                        {isSchoolDropdownOpen && (
                          <div className="custom-select-options">
                            <div
                              className={`custom-select-option ${!selectedSchoolId ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedSchoolId('');
                                setSelectedClassId('');
                                setSelectedStudentId('');
                                setIsSchoolDropdownOpen(false);
                              }}
                            >
                              -- Chọn trường học --
                            </div>
                            {schools.map((s) => (
                              <div
                                key={s.school_id}
                                className={`custom-select-option ${selectedSchoolId === s.school_id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedSchoolId(s.school_id);
                                  setSelectedClassId('');
                                  setSelectedStudentId('');
                                  setIsSchoolDropdownOpen(false);
                                }}
                              >
                                {s.school_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>2. Chọn Lớp học</label>
                      <div className="custom-select-container" ref={classSelectRef}>
                        <button
                          type="button"
                          className={`custom-select-trigger ${isClassDropdownOpen ? 'open' : ''}`}
                          onClick={() => {
                            if (selectedSchoolId) {
                              setIsClassDropdownOpen(!isClassDropdownOpen);
                            }
                          }}
                          disabled={!selectedSchoolId}
                          style={{
                            opacity: selectedSchoolId ? 1 : 0.6,
                            cursor: selectedSchoolId ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <span>
                            {selectedClassId
                              ? classes.find((c) => c.class_id === Number(selectedClassId))?.class_name
                              : '-- Chọn lớp học --'}
                          </span>
                          <ChevronDown size={18} className="select-arrow" />
                        </button>
                        {isClassDropdownOpen && selectedSchoolId && (
                          <div className="custom-select-options">
                            <div
                              className={`custom-select-option ${!selectedClassId ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedClassId('');
                                setSelectedStudentId('');
                                setIsClassDropdownOpen(false);
                              }}
                            >
                              -- Chọn lớp học --
                            </div>
                            {classes.map((c) => (
                              <div
                                key={c.class_id}
                                className={`custom-select-option ${selectedClassId === c.class_id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedClassId(c.class_id);
                                  setSelectedStudentId('');
                                  setIsClassDropdownOpen(false);
                                }}
                              >
                                {c.class_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>3. Chọn Họ và Tên</label>
                      <div className="custom-select-container" ref={studentSelectRef}>
                        <button
                          type="button"
                          className={`custom-select-trigger ${isStudentDropdownOpen ? 'open' : ''}`}
                          onClick={() => {
                            if (selectedClassId) {
                              setIsStudentDropdownOpen(!isStudentDropdownOpen);
                            }
                          }}
                          disabled={!selectedClassId}
                          style={{
                            opacity: selectedClassId ? 1 : 0.6,
                            cursor: selectedClassId ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <span>
                            {selectedStudentId
                              ? students.find((s) => s.student_id === Number(selectedStudentId))?.full_name
                              : '-- Chọn tên của bạn --'}
                          </span>
                          <ChevronDown size={18} className="select-arrow" />
                        </button>
                        {isStudentDropdownOpen && selectedClassId && (
                          <div className="custom-select-options">
                            <div
                              className={`custom-select-option ${!selectedStudentId ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedStudentId('');
                                setIsStudentDropdownOpen(false);
                              }}
                            >
                              -- Chọn tên của bạn --
                            </div>
                            {students.map((s) => (
                              <div
                                key={s.student_id}
                                className={`custom-select-option ${selectedStudentId === s.student_id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedStudentId(s.student_id);
                                  setIsStudentDropdownOpen(false);
                                }}
                              >
                                {s.full_name}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {(() => {
                    if (isModePreselected) return null;
                    const isPracticeEnabledForClass = true; // Luôn cho phép học sinh chọn chế độ ôn tập ở giao diện, việc chặn sẽ do backend xử lý khi học sinh click bắt đầu

                    return (
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label>4. Chọn Chế độ làm bài</label>
                        {quizToStart.allow_practice && isPracticeEnabledForClass ? (
                          <div className="quiz-mode-selection-cards">
                            <div
                              className={`quiz-mode-card ${levelQuizMode === 'testing' ? 'active' : ''}`}
                              onClick={() => setLevelQuizMode('testing')}
                            >
                              <div className="mode-card-header">
                                <span className="mode-title">Thi thử (Testing)</span>
                              </div>
                              <p className="mode-desc">Bài thi tính điểm, trộn câu hỏi, xem đáp án ở trang kết quả.</p>
                            </div>
                            <div
                              className={`quiz-mode-card ${levelQuizMode === 'training' ? 'active' : ''}`}
                              onClick={() => setLevelQuizMode('training')}
                            >
                              <div className="mode-card-header">
                                <span className="mode-title">Học tập (Training)</span>
                              </div>
                              <p className="mode-desc">Xem lời giải và giải thích đáp án đúng/sai ngay lập tức sau từng câu.</p>
                            </div>
                            <div
                              className={`quiz-mode-card ${levelQuizMode === 'practice' ? 'active' : ''}`}
                              onClick={() => setLevelQuizMode('practice')}
                            >
                              <div className="mode-card-header">
                                <span className="mode-title">Luyện tập (Practice)</span>
                              </div>
                              <p className="mode-desc">Tự luyện tập đề thi với thứ tự câu hỏi & đáp án được xáo trộn, có xem giải thích.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="quiz-mode-selection-cards disabled">
                            <div className="quiz-mode-card active">
                              <div className="mode-card-header">
                                <span className="mode-title">Thi thử (Testing)</span>
                                <span className="mode-badge">Bắt buộc</span>
                              </div>
                              <p className="mode-desc">
                                {!isPracticeEnabledForClass
                                  ? 'Chế độ ôn luyện / tự luyện tập hiện đang bị Giáo viên khóa đối với lớp của bạn.'
                                  : 'Bài thi tính điểm chính thức do giáo viên kiểm soát. Không hỗ trợ tự luyện tập.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                  {isStudentDropdownOpen && (
                    <div className="dropdown-spacer" style={{ height: '220px' }} />
                  )}

                  <div className="modal-actions-row">
                    <button
                      className="btn-modal-cancel"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Quay lại
                    </button>
                    <button
                      className="btn-modal-confirm"
                      disabled={loading || !selectedStudentId}
                      onClick={() => handleStartQuiz(quizToStart.quiz_id)}
                    >
                      {loading ? 'Đang chuẩn bị...' : 'Bắt đầu làm bài'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: ENTER PIN CODE */}
              {wizardStep === 'enter_pin' && quizToStart && (
                <StudentPortalPinEntry
                  quizToStart={quizToStart}
                  errorMsg={errorMsg}
                  loading={loading}
                  enteredPin={enteredPin || ''}
                  setEnteredPin={setEnteredPin || (() => {})}
                  onBack={() => {
                    setWizardStep('student_info');
                    if (setEnteredPin) setEnteredPin('');
                  }}
                  onSubmit={(pin) => handleStartQuiz(quizToStart.quiz_id, pin)}
                />
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Coming Soon Modal */}
        {comingSoonModal.open && createPortal(
          <div className="student-modal-overlay active" onClick={() => setComingSoonModal({ open: false, title: '', desc: '' })}>
            <div className="student-modal-content wizard-modal-content glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
              <div className="modal-header-title">
                <h3>Tính Năng Đang Phát Triển</h3>
                <button className="btn-close-modal" onClick={() => setComingSoonModal({ open: false, title: '', desc: '' })}>&times;</button>
              </div>
              <div className="wizard-step-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div className="coming-soon-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{comingSoonModal.title}</h4>
                <p style={{ opacity: 0.8, fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>{comingSoonModal.desc}</p>
                <button
                  className="btn-modal-confirm"
                  onClick={() => setComingSoonModal({ open: false, title: '', desc: '' })}
                  style={{ margin: '0 auto', display: 'block' }}
                >
                  Trở lại
                </button>
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
    const maxPoints = totalMaxPoints > 0 ? totalMaxPoints : 100;
    const scorePercentage = parseFloat(((finalScore / maxPoints) * 100).toFixed(1));
    const passingPercentage = 90;
    const passingPoints = Math.round(maxPoints * 0.9);
    const isPassed = finalScore >= passingPoints;

    return (
      <div className="student-submitted-container flex-center">
        <div className="submitted-card glass animate-slide-up" style={{ maxWidth: '700px', width: '100%' }}>
          <div className="tab-score-content">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              {isPassed ? (
                <div className="status-circle-icon passed">
                  ✓
                </div>
              ) : (
                <div className="status-circle-icon failed">
                  ✕
                </div>
              )}
            </div>

            <div className="score-details-row">
              <div className="score-info-text">
                Điểm của bạn: <span className="score-highlight-blue">{scorePercentage}% ({finalScore} điểm)</span>
              </div>
              <div className="score-info-text">
                Điểm đạt: <span className="score-highlight-blue">{passingPercentage}% ({passingPoints} điểm)</span>
              </div>
              <div className="score-warnings-text" style={{ marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Số lần thoát màn hình: {cheatWarnings} lần
              </div>
            </div>
          </div>

          <div className="submitted-actions" style={{ marginTop: '2rem' }}>
            <button className="btn-action-review" onClick={() => setIsReviewMode(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Đáp án
            </button>
            <button className="btn-action-restart" onClick={handleRestartQuiz}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              Làm Lại
            </button>
            <button className="btn-action-finish" onClick={handleGoBackToPortal}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 19-7-7 7-7M19 12H5"/>
              </svg>
              Chọn bài mới
            </button>
          </div>
        </div>

        {/* PREMIUM LIGHTBOX MODAL OVERLAY */}
        {zoomedMediaUrl && createPortal(
          <div 
            className="premium-lightbox-overlay" 
            onClick={() => setZoomedMediaUrl(null)}
            style={{ zIndex: 99999 }}
          >
            <div className="premium-lightbox-container" onClick={(e) => e.stopPropagation()}>
              <button 
                type="button" 
                className="premium-lightbox-close" 
                onClick={() => setZoomedMediaUrl(null)}
              >
                <X size={20} />
              </button>
              <img 
                src={zoomedMediaUrl} 
                alt="Zoomed Media Preview" 
                className="premium-lightbox-content"
              />
            </div>
          </div>,
          document.body
        )}
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
      </div>
    );
  }

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

export default QuizPortal;
