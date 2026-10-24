import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, ShieldAlert, CheckCircle, RefreshCw, Clock, Award, Users, AlertTriangle, ChevronDown, Key, Sliders, FileUp } from 'lucide-react';
import { getClasses, getQuizzes, assignClassQuiz, updateClassQuizStatus, getTeacherClassQuizzes, getLiveProctor, getSchools, selectClass, postAction, updateClassQuizPin, toggleClassPractice, getClassPracticeStatus, exportStandaloneQuiz, deleteStudentAttempt, toggleWorkstationBanTraining } from '../api';
import './css/TeacherQuizzes.css';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirmModal } from '../hooks/useConfirmModal';

interface ClassItem {
  class_id: number;
  class_name: string;
  school_level?: string;
  grade_level?: number | null;
}

interface School {
  school_id: number;
  school_name: string;
}

interface QuizItem {
  quiz_id: number;
  title: string;
  is_published: boolean;
  time_limit: number;
  question_count: number;
  school_level?: string;
  grade_level?: number | null;
  allow_practice?: boolean;
}

interface AssignedQuiz {
  class_quiz_id: number;
  class_id: number;
  class_name: string;
  quiz_id: number;
  quiz_title: string;
  status: 'active' | 'completed';
  assigned_at: string;
  pin_code?: string;
}

interface ProctorStudent {
  student_id: number;
  full_name: string;
  pc_name: string;
  has_attempt: boolean;
  attempt_id: number | null;
  status: 'not_started' | 'inprogress' | 'submitted' | 'auto_submitted';
  score_achieved: number | null;
  duration_seconds: number;
  cheat_warnings_count: number;
  answered_count: number;
  total_questions: number;
  started_at: string | null;
  completed_at: string | null;
  target_score: number | null;
  workstation_id: number | null;
  ban_training: boolean;
  attempt_count: number;
  max_score: number | null;
}

interface TeacherQuizzesProps {
  user?: any;
}

const TeacherQuizzes: React.FC<TeacherQuizzesProps> = ({ user }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const isInitialLoadRef = useRef(true);

  const [activeClassId, setActiveClassId] = useState<number | ''>('');
  const [selectedQuizId, setSelectedQuizId] = useState<number | ''>('');
  const [customTimeLimit, setCustomTimeLimit] = useState<number | ''>('');
  const [randomCount, setRandomCount] = useState<number | ''>('');
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const { modalConfig, showPrompt, showAlert, closeConfirmModal } = useConfirmModal();

  const handleExportOffline = async (quizId: number) => {
    const defaultFilename = `Quiz_${quizId}_Standalone`;
    showPrompt(
      "Xuất bản Offline HTML",
      "Nhập tên tệp tin HTML offline (không bao gồm đuôi .html):",
      defaultFilename,
      async (customFilename: string) => {
        const finalFilename = customFilename.trim() || defaultFilename;
        setIsExporting(quizId);
        try {
          const res = await exportStandaloneQuiz(quizId, finalFilename);
          if (res.data.status === 'success') {
            showAlert(
              "Xuất bản thành công",
              `Xuất bản đề thi offline thành công! File đã được lưu vào: ${res.data.filename}. Thầy cô có thể tải xuống từ trang "Công cụ vận hành".`,
              'info'
            );
          } else {
            showAlert("Lỗi xuất bản", res.data.message || 'Lỗi xuất bản đề thi offline.', 'danger');
          }
        } catch (err: any) {
          console.error(err);
          showAlert("Lỗi kết nối", err.response?.data?.message || 'Lỗi khi kết nối tới máy chủ để xuất bản.', 'danger');
        } finally {
          setIsExporting(null);
        }
      },
      "Nhập tên file..."
    );
  };

  // PIN settings states
  const [pinOption, setPinOption] = useState<'random' | 'custom'>(() => {
    try {
      return (localStorage.getItem('teacher_pin_option') as 'random' | 'custom') || 'random';
    } catch {
      return 'random';
    }
  });
  const [customPin, setCustomPin] = useState<string>(() => {
    try {
      return localStorage.getItem('teacher_custom_pin') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('teacher_pin_option', pinOption);
    } catch (e) {
      console.warn('Unable to save pinOption to localStorage:', e);
    }
  }, [pinOption]);

  useEffect(() => {
    try {
      localStorage.setItem('teacher_custom_pin', customPin);
    } catch (e) {
      console.warn('Unable to save customPin to localStorage:', e);
    }
  }, [customPin]);

  // Custom dropdown select class states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);

  // Custom dropdown select school states
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>(() => {
    try {
      const savedStateStr = user ? localStorage.getItem(`teacher_quizzes_state_${user.id}`) : null;
      if (savedStateStr) {
        const saved = JSON.parse(savedStateStr);
        if (saved && saved.schoolId) return Number(saved.schoolId);
      }
    } catch (e) {
      console.warn('Failed to parse saved schoolId:', e);
    }
    return '';
  });
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const schoolDropdownRef = useRef<HTMLDivElement>(null);

  // Custom dropdown select quiz states
  const [isQuizDropdownOpen, setIsQuizDropdownOpen] = useState(false);
  const quizDropdownRef = useRef<HTMLDivElement>(null);

  const [assignedQuizzes, setAssignedQuizzes] = useState<AssignedQuiz[]>([]);
  const [selectedActiveSession, setSelectedActiveSession] = useState<AssignedQuiz | null>(null);
  const [proctorStudents, setProctorStudents] = useState<ProctorStudent[]>([]);

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Quick import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSchoolId, setImportSchoolId] = useState<number | ''>('');
  const [importClassId, setImportClassId] = useState<number | ''>('');
  const [isImportSchoolDropdownOpen, setIsImportSchoolDropdownOpen] = useState(false);
  const [isImportClassDropdownOpen, setIsImportClassDropdownOpen] = useState(false);
  const importSchoolDropdownRef = useRef<HTMLDivElement>(null);
  const importClassDropdownRef = useRef<HTMLDivElement>(null);
  const [importText, setImportText] = useState('');
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importClasses, setImportClasses] = useState<ClassItem[]>([]);

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    if (isInitialLoadRef.current) return;

    const stateToSave = {
      schoolId: selectedSchoolId,
      classId: activeClassId,
      quizId: selectedQuizId,
      customTimeLimit: customTimeLimit
    };
    try {
      localStorage.setItem(`teacher_quizzes_state_${user.id}`, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Unable to save state to localStorage:', e);
    }
  }, [selectedSchoolId, activeClassId, selectedQuizId, customTimeLimit, user]);

  // Session stop confirm states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sessionToStop, setSessionToStop] = useState<number | null>(null);

  // PIN change modal states
  const [showPinChangeModal, setShowPinChangeModal] = useState(false);
  const [pinChangeSession, setPinChangeSession] = useState<AssignedQuiz | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Practice toggle states
  const [blockPracticeEnabled, setBlockPracticeEnabled] = useState<boolean>(false);
  const [showToolsModal, setShowToolsModal] = useState<boolean>(false);
  const [toolsScope, setToolsScope] = useState<'class' | 'grade'>('class');
  const [isSavingTools, setIsSavingTools] = useState<boolean>(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState<boolean>(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Find the selected class object to get its school_level and grade_level
  const selectedClassObj = classes.find(c => c.class_id === Number(activeClassId));

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  const openImportModal = (preselect = false) => {
    setImportText('');
    if (preselect && selectedSchoolId && activeClassId) {
      setImportSchoolId(Number(selectedSchoolId));
      setImportClassId(Number(activeClassId));
    } else {
      setImportSchoolId(selectedSchoolId || (schools.length > 0 ? schools[0].school_id : ''));
      setImportClassId(activeClassId || '');
    }
    setShowImportModal(true);
  };

  useEffect(() => {
    if (showImportModal && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [showImportModal]);

  useEffect(() => {
    if (!importSchoolId) {
      setImportClasses([]);
      setImportClassId('');
      return;
    }
    const loadClasses = async () => {
      try {
        const res = await getClasses(Number(importSchoolId), 'list');
        setImportClasses(res.data);
        if (res.data.length > 0) {
          const hasPageClass = res.data.some((c: any) => c.class_id === Number(activeClassId));
          if (hasPageClass && Number(selectedSchoolId) === Number(importSchoolId)) {
            setImportClassId(Number(activeClassId));
          } else {
            setImportClassId(res.data[0].class_id);
          }
        } else {
          setImportClassId('');
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách lớp học trong modal:', err);
      }
    };
    loadClasses();
  }, [importSchoolId, activeClassId, selectedSchoolId]);


  const parseImportText = (text: string) => {
    const lines = text.split('\n');
    const resultLines: string[] = [];
    let seqPc = 1;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Check if header line
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith('họ và tên') || lowerLine.startsWith('stt') || lowerLine.startsWith('#') || lowerLine.startsWith('tên hs')) {
        continue;
      }

      // Split by tab, if no tab, split by multiple spaces
      let cells = line.split('\t');
      if (cells.length === 1) {
        cells = line.split(/\s{2,}/); // split by 2 or more spaces to preserve name spaces
        if (cells.length === 1) {
          cells = line.split(/\s+/);
        }
      }

      cells = cells.map(c => c.trim()).filter(c => c);
      if (cells.length === 0) continue;

      let pcNum: number | null = null;
      let pcIndex = -1;

      // 1. Find PC column
      for (let i = 0; i < cells.length; i++) {
        const match = cells[i].match(/^PC[-_\s]*0*(\d+)$/i);
        if (match) {
          pcNum = parseInt(match[1], 10);
          pcIndex = i;
          break;
        }
      }

      // 2. Separate name, OT, Target
      let name = '';
      let ot = '';
      let target = '';

      if (pcIndex !== -1) {
        // If PC exists, name is everything before PC
        name = cells.slice(0, pcIndex).join(' ').trim();
        
        // Look at cells after PC
        const postPcCells = cells.slice(pcIndex + 1);
        for (const val of postPcCells) {
          const hasLetter = /[a-z]/i.test(val.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const looksLikeOT = val.match(/^(OT|GM|Hoàn thành|Kiểm tra)/i) || (hasLetter && /\d/.test(val));
          const looksLikeTarget = /^\d+(\s*,\s*\d+)*$/.test(val);

          if (looksLikeOT) {
            ot = ot ? ot + ", " + val : val;
          } else if (looksLikeTarget) {
            target = target ? target + ", " + val : val;
          } else if (hasLetter) {
            ot = ot ? ot + ", " + val : val;
          } else {
            if (!ot) ot = val;
          }
        }
      } else {
        // If no PC, we guess:
        const tokens = [...cells];
        while (tokens.length > 0) {
          const val = tokens[tokens.length - 1];
          const hasLetter = /[a-z]/i.test(val.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const looksLikeOT = val.match(/^(OT|GM|Hoàn thành|Kiểm tra)/i) || (hasLetter && /\d/.test(val));
          const looksLikeTarget = /^\d+(\s*,\s*\d+)*$/.test(val);

          if (looksLikeTarget) {
            target = target ? val + ", " + target : val;
            tokens.pop();
          } else if (looksLikeOT) {
            ot = ot ? val + ", " + ot : val;
            tokens.pop();
          } else {
            break;
          }
        }
        name = tokens.join(' ').trim();
        pcNum = seqPc++;
      }

      // fallback target
      if (!target) target = '35';

      if (name && pcNum !== null && pcNum >= 1 && pcNum <= 60) {
        const pcStr = `PC${String(pcNum).padStart(2, '0')}`;
        resultLines.push(`${name}\t${pcStr}\t${ot || 'Tất cả'}\t${target}`);
      }
    }

    return resultLines.join('\n');
  };

  const handleSaveImport = async () => {
    if (!importText.trim()) {
      showToast('Vui lòng nhập danh sách học sinh!', 'error');
      return;
    }

    const formattedData = parseImportText(importText);
    if (!formattedData.trim()) {
      showToast('Không tìm thấy dữ liệu học sinh hợp lệ!', 'error');
      return;
    }

    if (!importClassId || !importSchoolId) {
      showToast('Vui lòng chọn trường học và lớp học!', 'error');
      return;
    }

    const targetClassObj = importClasses.find(c => c.class_id === Number(importClassId));
    if (!targetClassObj) {
      showToast('Lớp học không hợp lệ!', 'error');
      return;
    }

    setIsSavingImport(true);
    try {
      await selectClass(targetClassObj.class_name, Number(importSchoolId));
      const res = await postAction('save_list', { data: formattedData });
      if (res.data.status === 'success') {
        showToast('Nhập danh sách học sinh thành công!', 'success');
        setShowImportModal(false);
        setImportText('');
      } else {
        showToast(res.data.message || 'Lưu danh sách học sinh thất bại.', 'error');
      }
    } catch (err) {
      console.error('Lỗi khi lưu danh sách học sinh:', err);
      showToast('Có lỗi xảy ra khi lưu danh sách học sinh.', 'error');
    } finally {
      setIsSavingImport(false);
    }
  };

  const filteredQuizzesToAssign = quizzes.filter(q => {
    if (showAllQuizzes) return true;
    if (!selectedClassObj) return true;

    const isQuizUnclassified = !q.school_level && !q.grade_level;
    if (isQuizUnclassified) return true;

    const matchesLevel = q.school_level === selectedClassObj.school_level;
    const matchesGrade = q.grade_level === null || q.grade_level === undefined || q.grade_level === selectedClassObj.grade_level;

    return matchesLevel && matchesGrade;
  });



  // Click outside listener for custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false);
      }
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(event.target as Node)) {
        setIsSchoolDropdownOpen(false);
      }
      if (quizDropdownRef.current && !quizDropdownRef.current.contains(event.target as Node)) {
        setIsQuizDropdownOpen(false);
      }
      if (importSchoolDropdownRef.current && !importSchoolDropdownRef.current.contains(event.target as Node)) {
        setIsImportSchoolDropdownOpen(false);
      }
      if (importClassDropdownRef.current && !importClassDropdownRef.current.contains(event.target as Node)) {
        setIsImportClassDropdownOpen(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to Escape key to close the Khóa ôn tập modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showToolsModal) {
        setShowToolsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showToolsModal]);

  // Fetch practice status when session or tools modal is opened
  useEffect(() => {
    if (!selectedActiveSession || !showToolsModal) return;

    const fetchPractice = async () => {
      try {
        const res = await getClassPracticeStatus(selectedActiveSession.class_id);
        if (res.data && res.data.status === 'success') {
          setBlockPracticeEnabled(!res.data.practice_enabled);
        }
      } catch (err) {
        console.error('Lỗi khi tải trạng thái luyện tập của lớp:', err);
      }
    };

    fetchPractice();
  }, [selectedActiveSession?.class_id, showToolsModal]);

  const handleSaveToolsPractice = async () => {
    if (!selectedActiveSession) return;
    setIsSavingTools(true);
    try {
      const res = await toggleClassPractice(selectedActiveSession.class_id, {
        practice_enabled: !blockPracticeEnabled,
        scope: toolsScope
      });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cập nhật chế độ Luyện tập thành công!', 'success');
        
        // Also update the local classes state so it's fresh
        setClasses(prev => prev.map(c => {
          if (toolsScope === 'grade') {
            const activeClass = prev.find(item => item.class_id === selectedActiveSession.class_id);
            if (activeClass && c.grade_level === activeClass.grade_level) {
              return { ...c, practice_enabled: !blockPracticeEnabled };
            }
          } else if (c.class_id === selectedActiveSession.class_id) {
            return { ...c, practice_enabled: !blockPracticeEnabled };
          }
          return c;
        }));

        // Đồng bộ hóa trạng thái cấm máy trạm (cột Thao tác)
        setProctorStudents(prev => prev.map(st => ({
          ...st,
          ban_training: blockPracticeEnabled
        })));
        
        setShowToolsModal(false);
      } else {
        showToast(res.data.message || 'Lỗi khi cập nhật chế độ Luyện tập.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Lỗi hệ thống khi cập nhật chế độ Luyện tập.', 'error');
    } finally {
      setIsSavingTools(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Set up polling for proctoring
  useEffect(() => {
    let intervalId: any = null;
    if (selectedActiveSession && selectedActiveSession.status === 'active' && autoRefresh) {
      fetchProctorData(selectedActiveSession.class_quiz_id);
      intervalId = setInterval(() => {
        fetchProctorData(selectedActiveSession.class_quiz_id);
      }, 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedActiveSession, autoRefresh]);

  const fetchInitialData = async () => {
    try {
      const classesRes = await getClasses();
      let classesList: ClassItem[] = [];
      if (classesRes.data.counts) {
        const counts = classesRes.data.counts;
        Object.keys(counts).forEach(grade => {
          counts[grade].forEach((name: string) => {
            classesList.push({
              class_id: classesList.length + 1,
              class_name: name
            });
          });
        });
      }

      let savedQuizId: number | '' = '';
      let savedTimeLimit: number | '' = '';
      try {
        const savedStateStr = user ? localStorage.getItem(`teacher_quizzes_state_${user.id}`) : null;
        if (savedStateStr) {
          const saved = JSON.parse(savedStateStr);
          if (saved) {
            if (saved.quizId) savedQuizId = Number(saved.quizId);
            if (saved.customTimeLimit !== undefined) savedTimeLimit = saved.customTimeLimit;
          }
        }
      } catch (e) {
        console.warn('Failed to get saved quizId:', e);
      }

      const assignedRes = await getTeacherClassQuizzes(selectedSchoolId ? Number(selectedSchoolId) : undefined);
      setAssignedQuizzes(assignedRes.data);

      const quizzesRes = await getQuizzes();
      const quizzesList = quizzesRes.data.filter((q: QuizItem) => q.is_published);
      setQuizzes(quizzesList);

      if (savedQuizId) {
        const matched = quizzesList.find((q: QuizItem) => q.quiz_id === savedQuizId);
        if (matched) {
          setSelectedQuizId(matched.quiz_id);
          setCustomTimeLimit(savedTimeLimit !== '' ? Number(savedTimeLimit) : matched.time_limit);
        }
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    }
  };

  const fetchProctorData = async (classQuizId: number, force = false) => {
    if (isTyping && !force) return;
    try {
      const res = await getLiveProctor(classQuizId);
      setProctorStudents(res.data.proctor_students);
      if (selectedActiveSession && selectedActiveSession.class_quiz_id === classQuizId) {
        setSelectedActiveSession(prev => prev ? {
          ...prev,
          quiz_title: res.data.quiz_title,
          class_name: res.data.class_name
        } : null);
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu giám sát:', err);
    }
  };

  const saveNameSingle = async (pc: number, newName: string) => {
    if (!selectedActiveSession) return;
    try {
      if (selectedSchoolId) {
        await selectClass(selectedActiveSession.class_name, Number(selectedSchoolId));
      }
      await postAction('save_name', { pc: String(pc), name: newName });
      fetchProctorData(selectedActiveSession.class_quiz_id, true);
    } catch (err) {
      console.error(err);
    }
  };

  const saveTargetScore = async (pc: number, val: string) => {
    if (!selectedActiveSession) return;
    try {
      if (selectedSchoolId) {
        await selectClass(selectedActiveSession.class_name, Number(selectedSchoolId));
      }
      await postAction('save_target', { pc: String(pc), target: val });
      fetchProctorData(selectedActiveSession.class_quiz_id, true);
    } catch (err) {
      console.error(err);
    }
  };

  const saveManualScore = async (pc: number, val: string) => {
    if (!selectedActiveSession) return;
    try {
      if (selectedSchoolId) {
        await selectClass(selectedActiveSession.class_name, Number(selectedSchoolId));
      }
      await postAction('save_manual_score', { pc: String(pc), score: val });
      fetchProctorData(selectedActiveSession.class_quiz_id, true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId || !selectedQuizId) {
      alert('Vui lòng chọn Lớp học và Đề thi');
      return;
    }

    if (pinOption === 'custom' && (!customPin || !/^[a-zA-Z0-9]{5}$/.test(customPin))) {
      alert('Mật khẩu phòng thi (PIN) tự đặt phải gồm đúng 5 ký tự chữ hoặc số (ví dụ: A1B2C)');
      return;
    }

    try {
      const res = await assignClassQuiz({
        class_id: typeof activeClassId === 'string' ? parseInt(activeClassId) : activeClassId,
        quiz_id: typeof selectedQuizId === 'string' ? parseInt(selectedQuizId) : selectedQuizId,
        time_limit: customTimeLimit !== '' ? Number(customTimeLimit) : undefined,
        random_question_count: randomCount !== '' && Number(randomCount) > 0 ? Number(randomCount) : undefined,
        pin_code: pinOption === 'custom' ? customPin : undefined
      });

      const assignedRes = await getTeacherClassQuizzes(selectedSchoolId ? Number(selectedSchoolId) : undefined);
      setAssignedQuizzes(assignedRes.data);

      const started = assignedRes.data.find((x: AssignedQuiz) => x.class_quiz_id === res.data.class_quiz_id);
      if (started) {
        setSelectedActiveSession(started);
        fetchProctorData(started.class_quiz_id);
      }

      setSelectedQuizId('');
      setCustomTimeLimit('');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi bắt đầu lượt thi.');
    }
  };

  const handleStopSession = (classQuizId: number) => {
    setSessionToStop(classQuizId);
    setShowConfirmModal(true);
  };

  const confirmStopSession = async () => {
    if (sessionToStop === null) return;
    try {
      await updateClassQuizStatus(sessionToStop, 'completed');
      const assignedRes = await getTeacherClassQuizzes(selectedSchoolId ? Number(selectedSchoolId) : undefined);
      setAssignedQuizzes(assignedRes.data);

      if (selectedActiveSession && selectedActiveSession.class_quiz_id === sessionToStop) {
        const updated = assignedRes.data.find((x: AssignedQuiz) => x.class_quiz_id === sessionToStop);
        setSelectedActiveSession(updated || null);
        if (updated) {
          fetchProctorData(updated.class_quiz_id);
        }
      }
      showToast('Đã dừng ca thi thành công!', 'success');
    } catch (err) {
      console.error('Lỗi khi dừng lượt thi:', err);
      showToast('Không thể dừng lượt thi. Vui lòng thử lại.', 'error');
    } finally {
      setShowConfirmModal(false);
      setSessionToStop(null);
    }
  };

  const handleResetAttempt = (attemptId: number, studentName: string) => {
    showPrompt(
      "Xác nhận hủy lượt làm bài",
      `Bạn có chắc chắn muốn hủy lượt làm bài của học sinh "${studentName}"? (Hành động này sẽ xóa vĩnh viễn tiến trình làm bài hiện tại, giúp học sinh đăng ký lại từ đầu). Nhập "HUY" để xác nhận:`,
      "",
      async (confirmVal) => {
        if (confirmVal.trim().toUpperCase() !== "HUY") {
          showToast("Xác nhận không khớp. Hủy bỏ thao tác.", "error");
          return;
        }
        try {
          const res = await deleteStudentAttempt(attemptId);
          if (res.data.status === 'success') {
            showToast(`Đã hủy lượt thi của học sinh ${studentName} thành công!`, 'success');
            if (selectedActiveSession) {
              fetchProctorData(selectedActiveSession.class_quiz_id);
            }
          } else {
            showToast(res.data.message || 'Hủy lượt thi thất bại.', 'error');
          }
        } catch (err: any) {
          console.error(err);
          showToast(err.response?.data?.message || 'Có lỗi xảy ra khi hủy lượt thi.', 'error');
        }
      },
      "HUY"
    );
  };

  const handleToggleWorkstationBan = async (workstationId: number, currentBanStatus: boolean) => {
    try {
      const nextBanStatus = !currentBanStatus;
      const res = await toggleWorkstationBanTraining(workstationId, { ban_training: nextBanStatus });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cập nhật trạng thái cấm thành công!', 'success');
        
        // Update local state proctorStudents
        setProctorStudents(prev => prev.map(st => {
          if (st.workstation_id === workstationId) {
            return { ...st, ban_training: nextBanStatus };
          }
          return st;
        }));
      } else {
        showToast(res.data.message || 'Lỗi khi cập nhật trạng thái cấm.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Lỗi hệ thống khi cập nhật cấm máy.', 'error');
    }
  };

  const handlePromptChangePin = (session: AssignedQuiz) => {
    setPinChangeSession(session);
    setNewPinValue(session.pin_code || '');
    setPinChangeError('');
    setShowPinChangeModal(true);
  };

  const handleConfirmChangePin = async () => {
    if (!pinChangeSession) return;
    const cleanPin = newPinValue.trim().toUpperCase();
    if (!/^[a-zA-Z0-9]{5}$/.test(cleanPin)) {
      setPinChangeError('Mã PIN phải gồm đúng 5 ký tự chữ hoặc số');
      return;
    }

    try {
      const res = await updateClassQuizPin(pinChangeSession.class_quiz_id, cleanPin);
      showToast(res.data.message || 'Cập nhật PIN thành công!', 'success');
      
      // Update locally in assignedQuizzes list
      setAssignedQuizzes(prev => prev.map(q => 
        q.class_quiz_id === pinChangeSession.class_quiz_id 
          ? { ...q, pin_code: cleanPin } 
          : q
      ));

      // Update locally in selectedActiveSession
      setSelectedActiveSession(prev => prev && prev.class_quiz_id === pinChangeSession.class_quiz_id
        ? { ...prev, pin_code: cleanPin }
        : prev
      );

      setShowPinChangeModal(false);
      setPinChangeSession(null);
    } catch (err: any) {
      console.error(err);
      setPinChangeError(err.response?.data?.message || 'Lỗi khi đổi mã PIN');
    }
  };

  const selectSessionForProctoring = (session: AssignedQuiz) => {
    setSelectedActiveSession(session);
    fetchProctorData(session.class_quiz_id);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const res = await getSchools();
        const schoolsList = res.data.schools || [];
        setSchools(schoolsList);

        if (selectedSchoolId && schoolsList.some((s: School) => s.school_id === selectedSchoolId)) {
          return;
        }

        let initialSchoolId: number | '' = '';
        const activeClassesRes = await getClasses();
        if (activeClassesRes.data && activeClassesRes.data.active_school_id) {
          initialSchoolId = Number(activeClassesRes.data.active_school_id);
        } else {
          const localId = localStorage.getItem('active_school_id');
          if (localId) {
            initialSchoolId = Number(localId);
          }
        }

        const isValidSchool = schoolsList.some((s: School) => s.school_id === initialSchoolId);
        if (!isValidSchool && schoolsList.length > 0) {
          initialSchoolId = schoolsList[0].school_id;
        }

        setSelectedSchoolId(initialSchoolId);
      } catch (err) {
        console.error('Lỗi khi tải danh sách trường học:', err);
      }
    };
    loadSchools();
  }, []);

  useEffect(() => {
    if (!selectedSchoolId) {
      setClasses([]);
      setActiveClassId('');
      setAssignedQuizzes([]);
      return;
    }

    const loadDataForSchool = async () => {
      try {
        const classesRes = await getClasses(Number(selectedSchoolId), 'list');
        const classesData = classesRes.data;
        setClasses(classesData);

        const assignedRes = await getTeacherClassQuizzes(Number(selectedSchoolId));
        setAssignedQuizzes(assignedRes.data);

        if (selectedActiveSession) {
          const stillExists = assignedRes.data.some((q: AssignedQuiz) => q.class_quiz_id === selectedActiveSession.class_quiz_id);
          if (!stillExists) {
            setSelectedActiveSession(null);
            setProctorStudents([]);
          }
        }

        if (classesData.length > 0) {
          let targetClassId: number | '' = '';
          
          if (isInitialLoadRef.current) {
            try {
              const savedStateStr = user ? localStorage.getItem(`teacher_quizzes_state_${user.id}`) : null;
              if (savedStateStr) {
                const saved = JSON.parse(savedStateStr);
                if (saved && saved.classId) {
                  const matched = classesData.find((c: any) => c.class_id === Number(saved.classId));
                  if (matched) {
                    targetClassId = matched.class_id;
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse saved classId:', e);
            }
          }

          if (!targetClassId) {
            const activeClassesRes = await getClasses();
            const activeClassName = activeClassesRes.data?.active_class;
            const matchedClass = classesData.find((c: any) => c.class_name === activeClassName);
            if (matchedClass) {
              targetClassId = matchedClass.class_id;
            } else {
              targetClassId = classesData[0].class_id;
            }
          }

          setActiveClassId(targetClassId);
        } else {
          setActiveClassId('');
        }

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      } catch (err) {
        console.error('Lỗi load danh sách lớp học và lượt thi:', err);
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      }
    };

    loadDataForSchool();
  }, [selectedSchoolId]);

  // Find the student with the highest score and fastest time
  const finishedStudents = proctorStudents.filter(
    st => (st.status === 'submitted' || st.status === 'auto_submitted') && st.score_achieved !== null
  );

  let bestStudentId: number | null = null;
  if (finishedStudents.length > 0) {
    const sortedFinished = [...finishedStudents].sort((a, b) => {
      const scoreA = a.score_achieved ?? 0;
      const scoreB = b.score_achieved ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.duration_seconds - b.duration_seconds;
    });
    bestStudentId = sortedFinished[0].student_id;
  }

  const portalContainer = document.getElementById('dashboard-navbar-portal');

  return (
    <div className="teacher-quizzes-container">

      <div className="teacher-layout">
        {/* LEFT COLUMN: ACTIVE CONTROL & SESSIONS */}
        <div className="control-column">

          {/* ASSIGN PANEL */}
          <div className="control-panel glass">
            <h3><Play size={18} className="panel-icon play-icon" /> Giao lượt thi mới</h3>
            <form onSubmit={handleStartSession} className="assign-form">

              <div className="form-group">
                <label>Đơn vị Trường học:</label>
                <div className="custom-select-container" ref={schoolDropdownRef}>
                  <div
                    className={`custom-select-trigger ${isSchoolDropdownOpen ? 'open' : ''}`}
                    onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                  >
                    <span className="selected-value">
                      {schools.find(s => s.school_id === selectedSchoolId)?.school_name || '-- Chọn trường học --'}
                    </span>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                  {isSchoolDropdownOpen && (
                    <div className="custom-select-options">
                      {schools.map((s) => (
                        <div
                          key={s.school_id}
                          className={`custom-select-option ${selectedSchoolId === s.school_id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSchoolId(s.school_id);
                            setIsSchoolDropdownOpen(false);
                          }}
                        >
                          <span>{s.school_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Lớp học thực hành:</label>
                <div className="custom-select-container" ref={classDropdownRef}>
                  <div
                    className={`custom-select-trigger ${isClassDropdownOpen ? 'open' : ''}`}
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                  >
                    <span className="selected-value">
                      {classes.find(c => c.class_id === activeClassId)?.class_name || '-- Chọn lớp học --'}
                    </span>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                  {isClassDropdownOpen && (
                    <div className="custom-select-options">
                      <div
                        className={`custom-select-option ${activeClassId === '' ? 'selected' : ''}`}
                        onClick={() => {
                          setActiveClassId('');
                          setIsClassDropdownOpen(false);
                        }}
                      >
                        <span>-- Chọn lớp học --</span>
                      </div>
                      {classes.map((c) => (
                        <div
                          key={c.class_id}
                          className={`custom-select-option ${activeClassId === c.class_id ? 'selected' : ''}`}
                          onClick={() => {
                            setActiveClassId(c.class_id);
                            setIsClassDropdownOpen(false);
                          }}
                        >
                          <span>{c.class_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <div className="label-flex-row">
                  <label>Đề thi trắc nghiệm:</label>
                  {activeClassId && (
                    <label className="toggle-quiz-filter">
                      <input
                        type="checkbox"
                        checked={showAllQuizzes}
                        onChange={(e) => setShowAllQuizzes(e.target.checked)}
                      />
                      <span>Tất cả đề thi</span>
                    </label>
                  )}
                </div>
                {(() => {
                  const getQuizDisplayLabel = (q: QuizItem) => {
                    const levelLabel = q.school_level ? (q.school_level === 'Primary' ? 'Tiểu học' : q.school_level === 'Secondary' ? 'THCS' : 'THPT') : '';
                    const label = q.grade_level ? `${levelLabel} Khối ${q.grade_level}` : levelLabel ? `${levelLabel} (Chung)` : 'Chung';
                    return `[${label}] ${q.title} (${q.question_count} câu / ${q.time_limit}p)`;
                  };
                  const selectedQuizObj = filteredQuizzesToAssign.find(q => q.quiz_id === selectedQuizId);

                  return (
                    <div className="custom-select-container" ref={quizDropdownRef}>
                      <div
                        className={`custom-select-trigger ${isQuizDropdownOpen ? 'open' : ''}`}
                        onClick={() => setIsQuizDropdownOpen(!isQuizDropdownOpen)}
                      >
                        <span className="selected-value">
                          {selectedQuizId !== '' && selectedQuizObj
                            ? getQuizDisplayLabel(selectedQuizObj)
                            : '-- Chọn bài kiểm tra --'
                          }
                        </span>
                        <ChevronDown size={16} className="select-arrow" />
                      </div>
                      {isQuizDropdownOpen && (
                        <div className="custom-select-options">
                          <div
                            className={`custom-select-option ${selectedQuizId === '' ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedQuizId('');
                              setCustomTimeLimit('');
                              setIsQuizDropdownOpen(false);
                            }}
                          >
                            <span>-- Chọn bài kiểm tra --</span>
                          </div>
                          {filteredQuizzesToAssign.length === 0 ? (
                            <div className="custom-select-option disabled-msg">
                              <span>Không có bài kiểm tra nào khả dụng</span>
                            </div>
                          ) : (
                            filteredQuizzesToAssign.map((q) => (
                              <div
                                key={q.quiz_id}
                                className={`custom-select-option ${selectedQuizId === q.quiz_id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedQuizId(q.quiz_id);
                                  setCustomTimeLimit(q.time_limit);
                                  setIsQuizDropdownOpen(false);
                                }}
                              >
                                <span>{getQuizDisplayLabel(q)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {selectedQuizId && (
                  <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleExportOffline(Number(selectedQuizId))}
                      disabled={isExporting !== null}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'transparent',
                        border: 'none',
                        color: '#9333ea',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: isExporting !== null ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <FileUp size={13} className={isExporting === Number(selectedQuizId) ? "animate-spin" : ""} color="#a855f7" />
                      {isExporting === Number(selectedQuizId) ? "Đang xuất bản..." : "Xuất bản offline HTML"}
                    </button>
                  </div>
                )}
                {activeClassId && !showAllQuizzes && filteredQuizzesToAssign.length === 0 && (
                  <p className="filter-warn-text">
                    ⚠️ Không có bài kiểm tra riêng cho khối này. Hãy tích chọn "Tất cả đề thi".
                  </p>
                )}
              </div>



              <div className="form-group">
                <label htmlFor="custom-time-limit">Thời gian làm bài (phút):</label>
                <input
                  id="custom-time-limit"
                  type="number"
                  min="1"
                  max="180"
                  className="form-input-custom"
                  value={customTimeLimit}
                  onChange={(e) => setCustomTimeLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={!selectedQuizId}
                  placeholder="Thời gian làm bài"
                />
              </div>

              <div className="form-group">
                <label htmlFor="random-question-count">Số câu bốc ngẫu nhiên cho mỗi học sinh:</label>
                <input
                  id="random-question-count"
                  type="number"
                  min="1"
                  className="form-input-custom"
                  value={randomCount}
                  onChange={(e) => setRandomCount(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={!selectedQuizId}
                  placeholder="Để trống = làm toàn bộ đề"
                />
              </div>

              <div className="form-group">
                <label>Mật khẩu phòng thi (PIN):</label>
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.4rem', marginBottom: '0.4rem' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="pinOption"
                      value="random"
                      checked={pinOption === 'random'}
                      onChange={() => setPinOption('random')}
                      style={{ cursor: 'pointer' }}
                    />
                    Ngẫu nhiên
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                    <input
                      type="radio"
                      name="pinOption"
                      value="custom"
                      checked={pinOption === 'custom'}
                      onChange={() => setPinOption('custom')}
                      style={{ cursor: 'pointer' }}
                    />
                    Tự đặt mã
                  </label>
                </div>
                {pinOption === 'custom' && (
                  <input
                    type="text"
                    maxLength={5}
                    className="form-input-custom"
                    placeholder="Nhập 5 ký tự PIN (ví dụ: A1B2C)"
                    value={customPin}
                    onChange={(e) => setCustomPin(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    style={{
                      marginTop: '0.4rem',
                      textAlign: 'center',
                      letterSpacing: '3px',
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      borderColor: customPin.length === 5 ? '#22c55e' : undefined
                    }}
                  />
                )}
              </div>

              <button type="submit" className="btn-primary btn-submit-session">
                Kích hoạt lượt thi
              </button>
            </form>
          </div>



          {/* SESSIONS LIST */}
          <div className="sessions-panel glass">
            <h3>Lịch sử lượt giám sát</h3>
            <div className="sessions-list">
              {assignedQuizzes.length === 0 ? (
                <p className="no-sessions">Chưa có lượt thi nào được khởi tạo.</p>
              ) : (
                assignedQuizzes.map((session) => (
                  <div
                    key={session.class_quiz_id}
                    className={`session-item ${selectedActiveSession?.class_quiz_id === session.class_quiz_id ? 'selected' : ''}`}
                    onClick={() => selectSessionForProctoring(session)}
                  >
                    <div className="session-main">
                      <h4>{session.quiz_title}</h4>
                      <div className="session-meta">
                        <span>Lớp: <strong>{session.class_name}</strong></span>
                        <span>Mở: {new Date(session.assigned_at).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      {session.pin_code && (
                        <div className="session-pin-row" style={{ marginTop: '0.35rem' }}>
                          <span className="session-pin-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            🔑 {session.pin_code}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="session-status-col">
                      {session.status === 'active' ? (
                        <span className="status-badge pulse-active">Đang mở</span>
                      ) : (
                        <span className="status-badge closed">Đã đóng</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE PROCTORING SCREEN */}
        <div className="proctor-column">
          <div className="proctor-panel glass">
            {selectedActiveSession ? (
              <>
                <div className="proctor-header">
                  <div>
                    <div className="proctor-title-row">
                      <h2>Giám sát hệ thống: {selectedActiveSession.quiz_title}</h2>
                      {selectedActiveSession.status === 'active' ? (
                        <span className="pulse-dot" title="Đang giám sát thời gian thực"></span>
                      ) : (
                        <span className="status-tag-closed">Đã kết thúc</span>
                      )}
                    </div>
                    <p className="proctor-sub" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span>Phòng máy lớp: <strong>{selectedActiveSession.class_name}</strong></span>
                      <span>|</span>
                      <span>Thời gian kích hoạt: {new Date(selectedActiveSession.assigned_at).toLocaleTimeString('vi-VN')}</span>
                      {selectedActiveSession.pin_code && (
                        <>
                          <span>|</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                            🔑 Mã PIN: <span style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{selectedActiveSession.pin_code}</span>
                            {selectedActiveSession.status === 'active' && (
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handlePromptChangePin(selectedActiveSession); }}
                                style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                Đổi mã
                              </button>
                            )}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="proctor-controls">
                    <label className="auto-refresh-check">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                      />
                      <span>Tự động cập nhật ngầm</span>
                    </label>
                    <button
                      className="btn-refresh-manual"
                      onClick={() => fetchProctorData(selectedActiveSession.class_quiz_id)}
                      title="Đồng bộ tức thì"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <div style={{ position: 'relative', display: 'inline-block' }} ref={toolsDropdownRef}>
                      <button
                        type="button"
                        className="btn-tools"
                        onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                        title="Công cụ khóa ôn tập"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(37, 99, 235, 0.2)',
                          background: 'rgba(37, 99, 235, 0.08)',
                          color: 'var(--primary-color)',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Sliders size={14} /> Công cụ <ChevronDown size={12} style={{ transform: showToolsDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }} />
                      </button>

                      {showToolsDropdown && (
                        <div style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          right: 0,
                          minWidth: '200px',
                          background: 'var(--card-bg, #ffffff)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          padding: '4px',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              setToolsScope('class');
                              setShowToolsModal(true);
                              setShowToolsDropdown(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-color, #f8fafc)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Sliders size={14} style={{ color: '#3b82f6' }} />
                            <span>Khóa ôn tập</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedActiveSession.status === 'active' && (
                      <button
                        className="btn-danger btn-stop-quiz"
                        onClick={() => handleStopSession(selectedActiveSession.class_quiz_id)}
                      >
                        <Square size={14} /> Dừng lượt làm bài
                      </button>
                    )}
                  </div>
                </div>

                {/* STATS OVERVIEW */}
                <div className="proctor-stats">
                  <div className="stat-card">
                    <Users className="stat-icon" />
                    <div className="stat-info-text">
                      <span className="stat-label">Sĩ số lớp</span>
                      <span className="stat-value">{proctorStudents.length}</span>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <RefreshCw className="stat-icon icon-spin-slow" />
                    <div className="stat-info-text">
                      <span className="stat-label">Đang làm bài</span>
                      <span className="stat-value">
                        {proctorStudents.filter(s => s.status === 'inprogress').length}
                      </span>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <CheckCircle className="stat-icon" />
                    <div className="stat-info-text">
                      <span className="stat-label">Đã hoàn thành</span>
                      <span className="stat-value">
                        {proctorStudents.filter(s => s.status === 'submitted' || s.status === 'auto_submitted').length}
                      </span>
                    </div>
                  </div>
                  <div className="stat-card red">
                    <ShieldAlert className="stat-icon" />
                    <div className="stat-info-text">
                      <span className="stat-label">Cảnh báo vi phạm</span>
                      <span className="stat-value">
                        {proctorStudents.filter(s => s.cheat_warnings_count > 0).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STUDENTS LIVE MONITOR LIST */}
                <div className="proctor-list-wrapper">
                  {proctorStudents.length === 0 ? (
                    <p className="no-students">Phòng máy trống, chưa có học sinh kết nối vào đề.</p>
                  ) : (
                    <table className="proctor-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Máy</th>
                          <th>Họ và tên</th>
                          <th style={{ width: '120px' }}>Trạng thái</th>
                          <th style={{ width: '180px' }}>Tiến độ câu</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Số điểm</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Mục tiêu</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>Lần thi</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>MAX</th>
                          <th style={{ width: '150px' }}>Cảnh báo vi phạm</th>
                          <th style={{ width: '100px' }}>Thời gian</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Cấm ôn luyện</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Hủy lượt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proctorStudents.map((st) => {
                          const hasCheated = st.cheat_warnings_count > 0;
                          const isDangerous = st.cheat_warnings_count >= 3;
                          const progressPercent = st.total_questions > 0
                             ? Math.min(100, Math.round((st.answered_count / st.total_questions) * 100))
                             : 0;

                          return (
                            <tr
                              key={st.student_id}
                              className={`proctor-row ${st.status} ${isDangerous ? 'cheat-danger' : hasCheated ? 'cheat-warn' : ''}`}
                            >
                              <td>
                                <span className="pc-badge">{st.pc_name}</span>
                              </td>
                              <td
                                onClick={(e) => e.stopPropagation()}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                spellCheck={false}
                                onFocus={() => setIsTyping(true)}
                                onBlur={(e) => {
                                  setIsTyping(false);
                                  const pcNum = parseInt(st.pc_name.replace(/\D/g, ''), 10);
                                  if (!isNaN(pcNum)) {
                                    saveNameSingle(pcNum, e.target.textContent || '');
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                                style={{ cursor: 'text' }}
                                title="Nhấn để sửa tên"
                              >
                                <strong className="student-name-row">{st.full_name}</strong>
                              </td>
                              <td>
                                <span className={`status-badge-mini ${st.status}`}>
                                  {st.status === 'not_started' && 'Chưa vào'}
                                  {st.status === 'inprogress' && 'Đang làm'}
                                  {st.status === 'submitted' && 'Đã nộp'}
                                  {st.status === 'auto_submitted' && 'Tự nộp'}
                                </span>
                              </td>
                              <td>
                                {st.status !== 'not_started' ? (
                                  <div className="student-progress-inline">
                                    <div className="progress-track-mini">
                                      <div className="progress-bar-fill-mini" style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                    <span className="progress-text-mini">{st.answered_count}/{st.total_questions} ({progressPercent}%)</span>
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                {st.score_achieved !== null ? (
                                  <span className="score-text-highlight">
                                    {st.student_id === bestStudentId && (
                                      <span title="Thủ khoa: Điểm cao nhất & Thời gian nhanh nhất" style={{ display: 'inline-block', marginRight: '4px' }}>
                                        <Award size={12} style={{ verticalAlign: 'middle' }} />
                                      </span>
                                    )}
                                    <strong>{st.score_achieved}</strong>
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                <input
                                  type="text"
                                  defaultValue={st.target_score !== null ? String(st.target_score) : ''}
                                  placeholder="—"
                                  onFocus={() => setIsTyping(true)}
                                  onBlur={(e) => {
                                    setIsTyping(false);
                                    const pcNum = parseInt(st.pc_name.replace(/\D/g, ''), 10);
                                    if (!isNaN(pcNum)) {
                                      saveTargetScore(pcNum, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                                  style={{
                                    width: '65px',
                                    textAlign: 'center',
                                    background: 'var(--white)',
                                    color: 'var(--gray-900)',
                                    border: '1px solid var(--gray-300)',
                                    borderRadius: '5px',
                                    padding: '3px 6px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    outline: 'none'
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                {st.attempt_count > 0 ? st.attempt_count : <span className="text-muted">—</span>}
                              </td>
                              <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                <input
                                  type="text"
                                  defaultValue={st.max_score !== null ? String(st.max_score) : ''}
                                  placeholder="—"
                                  onFocus={() => setIsTyping(true)}
                                  onBlur={(e) => {
                                    setIsTyping(false);
                                    const pcNum = parseInt(st.pc_name.replace(/\D/g, ''), 10);
                                    if (!isNaN(pcNum)) {
                                      saveManualScore(pcNum, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                                  style={{
                                    width: '65px',
                                    textAlign: 'center',
                                    background: 'transparent',
                                    color: '#2563eb',
                                    border: '1px dashed transparent',
                                    outline: 'none',
                                    cursor: 'text',
                                    fontFamily: 'inherit',
                                    fontWeight: 700
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; }}
                                  onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'transparent'; }}
                                />
                              </td>
                              <td>
                                {st.cheat_warnings_count > 0 ? (
                                  <span className={`cheat-badge-inline ${isDangerous ? 'danger' : 'warn'}`}>
                                    <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                                    Rời tab: {st.cheat_warnings_count} lần
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                {st.status !== 'not_started' ? (
                                  <div className="duration-text">
                                    <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                                    <span>{formatDuration(st.duration_seconds)}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {st.workstation_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleWorkstationBan(st.workstation_id!, st.ban_training)}
                                    className={`btn-ban-workstation-text ${st.ban_training ? 'banned' : 'allowed'}`}
                                    title={st.ban_training ? 'Đang cấm ôn luyện. Bấm để Cho phép học sinh này làm xong sớm.' : 'Đang cho phép ôn luyện. Bấm để Cấm.'}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '3px 10px',
                                      borderRadius: '6px',
                                      border: '1.5px solid',
                                      borderColor: st.ban_training ? '#fca5a5' : '#bbf7d0',
                                      background: st.ban_training ? '#fef2f2' : '#f0fdf4',
                                      color: st.ban_training ? '#ef4444' : '#16a34a',
                                      fontWeight: 700,
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      minWidth: '55px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                  >
                                    {st.ban_training ? 'Cấm' : 'Không'}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {st.status === 'inprogress' && st.attempt_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleResetAttempt(st.attempt_id!, st.full_name)}
                                    className="btn-reset-student-attempt"
                                    title="Hủy lượt làm bài (Reset)"
                                    style={{
                                      background: '#ef4444',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '5px 8px',
                                      borderRadius: '5px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    Hủy lượt
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="proctor-empty-state">
                <Users size={48} className="proctor-empty-icon" />
                <h3>Kênh Giám Sát Phòng Máy Trực Tuyến</h3>
                <p>Chọn một lượt thi từ danh sách bên trái hoặc kích hoạt lượt thi mới để bắt đầu giám sát.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PORTAL FOR GLASS NAVBAR */}
      {portalContainer && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="nav-portal-btn" onClick={() => openImportModal(false)}>
            📋 Nhập danh sách học sinh
          </button>
          <a href="/portal?preview=true" target="_blank" rel="noopener noreferrer" className="nav-portal-btn">
            🌐 Xem cổng học sinh
          </a>
        </div>,
        portalContainer
      )}

      {/* TOAST ALERT */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-content">
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* QUICK IMPORT MODAL */}
      {showImportModal && createPortal(
        <div className="modal-bg open" onClick={(e) => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
          <div className="custom-modal">
            <div className="modal-title">
              <span>📋 Dán dữ liệu học sinh từ Excel</span>
            </div>

            <div className="modal-select-group" style={{ marginTop: '14px' }}>
              <div className="modal-select-item">
                <label>Đơn vị Trường học:</label>
                <div className="custom-select-container" ref={importSchoolDropdownRef}>
                  <div
                    className={`custom-select-trigger ${isImportSchoolDropdownOpen ? 'open' : ''} ${isSavingImport ? 'disabled' : ''}`}
                    onClick={() => !isSavingImport && setIsImportSchoolDropdownOpen(!isImportSchoolDropdownOpen)}
                  >
                    <span className="selected-value">
                      {schools.find(s => s.school_id === importSchoolId)?.school_name || '-- Chọn trường học --'}
                    </span>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                  {isImportSchoolDropdownOpen && (
                    <div className="custom-select-options" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <div
                        className={`custom-select-option ${importSchoolId === '' ? 'selected' : ''}`}
                        onClick={() => {
                          setImportSchoolId('');
                          setIsImportSchoolDropdownOpen(false);
                        }}
                      >
                        <span>-- Chọn trường học --</span>
                      </div>
                      {schools.map((s) => (
                        <div
                          key={s.school_id}
                          className={`custom-select-option ${importSchoolId === s.school_id ? 'selected' : ''}`}
                          onClick={() => {
                            setImportSchoolId(s.school_id);
                            setIsImportSchoolDropdownOpen(false);
                          }}
                        >
                          <span>{s.school_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-select-item">
                <label>Lớp học thực hành:</label>
                <div className="custom-select-container" ref={importClassDropdownRef}>
                  <div
                    className={`custom-select-trigger ${isImportClassDropdownOpen ? 'open' : ''} ${isSavingImport ? 'disabled' : ''}`}
                    onClick={() => !isSavingImport && setIsImportClassDropdownOpen(!isImportClassDropdownOpen)}
                  >
                    <span className="selected-value">
                      {importClasses.find(c => c.class_id === importClassId)?.class_name || '-- Chọn lớp học --'}
                    </span>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                  {isImportClassDropdownOpen && (
                    <div className="custom-select-options" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <div
                        className={`custom-select-option ${importClassId === '' ? 'selected' : ''}`}
                        onClick={() => {
                          setImportClassId('');
                          setIsImportClassDropdownOpen(false);
                        }}
                      >
                        <span>-- Chọn lớp học --</span>
                      </div>
                      {importClasses.map((c) => (
                        <div
                          key={c.class_id}
                          className={`custom-select-option ${importClassId === c.class_id ? 'selected' : ''}`}
                          onClick={() => {
                            setImportClassId(c.class_id);
                            setIsImportClassDropdownOpen(false);
                          }}
                        >
                          <span>{c.class_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-info-box">
              Dán bảng chứa <b>Tên HS, Vị trí (PC...), Bài làm, Mục tiêu</b>.
            </div>

            <textarea
              ref={textareaRef}
              className="modal-textarea"
              placeholder={"Nguyễn Văn A    PC05    OT1    35\nTrần Thị B      PC06    OT2    40\nHoặc chỉ nhập/dán danh sách tên:\nNguyễn Văn C\nLê Thị D"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              disabled={isSavingImport}
              style={{ height: '180px' }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                  e.stopPropagation();
                }
              }}
            />

            <div className="modal-foot">
              <button
                type="button"
                className="modal-btn"
                onClick={() => setShowImportModal(false)}
                disabled={isSavingImport}
              >
                Hủy
              </button>
              <button
                type="button"
                className="modal-btn primary"
                onClick={handleSaveImport}
                disabled={isSavingImport}
              >
                {isSavingImport ? 'Đang lưu...' : '💾 Lưu danh sách'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Confirm Stop Quiz Modal Overlay */}
      {showConfirmModal && createPortal(
        <div className="custom-modal-overlay">
          <div className="custom-modal-content glass animate-scale-in">
            <div className="custom-modal-header text-danger">
              <AlertTriangle size={24} className="panel-icon warn-icon" style={{ animation: 'tca-pulse 2s infinite' }} />
              <h3>Xác nhận dừng lượt thi</h3>
            </div>
            <div className="custom-modal-body">
              <p>Bạn có chắc chắn muốn dừng lượt thi này?</p>
              <p className="danger-subtext">⚠️ Học sinh sẽ bị khóa bài ngay lập tức và không thể tiếp tục làm bài thi lý thuyết.</p>
            </div>
            <div className="custom-modal-footer">
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setSessionToStop(null);
                }} 
                className="btn-modal-secondary"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmStopSession} 
                className="btn-modal-danger"
              >
                Đồng ý dừng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Pin Change Modal Overlay */}
      {showPinChangeModal && pinChangeSession && createPortal(
        <div className="custom-modal-overlay">
          <div className="custom-modal-content glass animate-scale-in" style={{ maxWidth: '400px' }}>
            <div className="custom-modal-header">
              <Key size={24} className="panel-icon" style={{ color: '#2563eb' }} />
              <h3>Thay đổi mã PIN ca thi</h3>
            </div>
            <div className="custom-modal-body">
              <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '12px' }}>
                Cập nhật mã PIN mới cho lượt thi đề <strong>{pinChangeSession.quiz_title}</strong> của lớp <strong>{pinChangeSession.class_name}</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Mã PIN mới (5 ký tự):</label>
                <input
                  type="text"
                  maxLength={5}
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="Nhập 5 ký tự PIN"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    letterSpacing: '4px',
                    outline: 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmChangePin();
                    }
                  }}
                />
                {pinChangeError && (
                  <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 500 }}>⚠️ {pinChangeError}</span>
                )}
              </div>
            </div>
            <div className="custom-modal-footer">
              <button 
                onClick={() => {
                  setShowPinChangeModal(false);
                  setPinChangeSession(null);
                }} 
                className="btn-modal-secondary"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmChangePin} 
                className="btn-modal-primary"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cập nhật PIN
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Proctor Tools Modal Overlay */}
      {showToolsModal && selectedActiveSession && createPortal(
        <div className="confirm-modal-overlay" onClick={() => setShowToolsModal(false)}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <div className="confirm-modal-icon-wrapper info">
                <Sliders size={22} />
              </div>
              <h3>Khóa ôn tập</h3>
            </div>
            
            <div className="confirm-modal-body">
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Đang cấu hình cho <strong>Lớp {selectedActiveSession.class_name}</strong>
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* SCOPE SELECTOR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phạm vi áp dụng:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setToolsScope('class')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: toolsScope === 'class' ? '1.5px solid #3b82f6' : '1.5px solid var(--border-color)',
                        background: toolsScope === 'class' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        color: toolsScope === 'class' ? '#3b82f6' : 'var(--text-primary)',
                        fontWeight: toolsScope === 'class' ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Chỉ lớp {selectedActiveSession.class_name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolsScope('grade')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: toolsScope === 'grade' ? '1.5px solid #3b82f6' : '1.5px solid var(--border-color)',
                        background: toolsScope === 'grade' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        color: toolsScope === 'grade' ? '#3b82f6' : 'var(--text-primary)',
                        fontWeight: toolsScope === 'grade' ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Cả khối {(() => {
                        const cls = classes.find(c => c.class_id === selectedActiveSession.class_id);
                        return cls?.grade_level ? cls.grade_level : '';
                      })()}
                    </button>
                  </div>
                </div>

                {/* PRACTICE MODE SWITCH */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--bg-color)',
                  border: '1.5px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Chế độ Luyện tập</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Chặn học sinh tự luyện tập đề thi</span>
                  </div>
                  
                  <div
                    onClick={() => setBlockPracticeEnabled(!blockPracticeEnabled)}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '46px',
                      height: '24px',
                      cursor: 'pointer',
                      backgroundColor: blockPracticeEnabled ? '#ef4444' : '#cbd5e1',
                      transition: '0.3s',
                      borderRadius: '24px'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: blockPracticeEnabled ? '24px' : '4px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.3s',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>

                {/* DYNAMIC ACTION EXPLANATION */}
                <div style={{
                  marginTop: '4px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: blockPracticeEnabled ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: blockPracticeEnabled ? '1.5px solid rgba(239, 68, 68, 0.25)' : '1.5px solid rgba(16, 185, 129, 0.25)',
                  color: blockPracticeEnabled ? '#ef4444' : '#10b981',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>ℹ️ Chức năng sẽ thực hiện:</span>
                  </div>
                  {blockPracticeEnabled ? (
                    <span>
                      Hệ thống sẽ <strong>KHÓA</strong> chế độ Luyện tập cho{' '}
                      {toolsScope === 'class' ? (
                        <>lớp <strong>{selectedActiveSession.class_name}</strong></>
                      ) : (
                        <>cả <strong>Khối {(() => {
                          const cls = classes.find(c => c.class_id === selectedActiveSession.class_id);
                          return cls?.grade_level ? cls.grade_level : '';
                        })()}</strong></>
                      )}. Học sinh sẽ không tự luyện tập được nữa (chỉ thi khi giáo viên mở đề).
                    </span>
                  ) : (
                    <span>
                      Hệ thống sẽ <strong>MỞ</strong> chế độ Luyện tập cho{' '}
                      {toolsScope === 'class' ? (
                        <>lớp <strong>{selectedActiveSession.class_name}</strong></>
                      ) : (
                        <>cả <strong>Khối {(() => {
                          const cls = classes.find(c => c.class_id === selectedActiveSession.class_id);
                          return cls?.grade_level ? cls.grade_level : '';
                        })()}</strong></>
                      )}. Học sinh có thể tự luyện tập các đề thi.
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="confirm-modal-footer">
              <button 
                type="button" 
                className="confirm-modal-btn cancel" 
                onClick={() => setShowToolsModal(false)}
              >
                Hủy
              </button>
              <button 
                type="button" 
                className="confirm-modal-btn confirm-info" 
                onClick={handleSaveToolsPractice}
                disabled={isSavingTools}
              >
                {isSavingTools ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
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
        defaultValue={modalConfig.defaultValue}
        promptPlaceholder={modalConfig.promptPlaceholder}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default TeacherQuizzes;