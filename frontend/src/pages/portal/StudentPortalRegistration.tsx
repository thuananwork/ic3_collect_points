import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, BookOpen, ChevronDown } from 'lucide-react';
import '../css/StudentPortalRegistration.css';
import { StudentPortalPinEntry } from './StudentPortalPinEntry';

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

interface StudentPortalRegistrationProps {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  wizardStep: 'select_level' | 'select_quiz' | 'student_info' | 'enter_pin';
  setWizardStep: (step: 'select_level' | 'select_quiz' | 'student_info' | 'enter_pin') => void;
  selectedProgram: string | null;
  selectedLevelId: string | null;
  filteredLevelQuizzes: any[];
  quizToStart: any;
  schools: School[];
  classes: ClassItem[];
  students: Student[];
  selectedSchoolId: number | '';
  setSelectedSchoolId: (id: number | '') => void;
  selectedClassId: number | '';
  setSelectedClassId: (id: number | '') => void;
  selectedStudentId: number | '';
  setSelectedStudentId: (id: number | '') => void;
  errorMsg: string;
  loading: boolean;
  programLevels: any;
  handleStartQuiz: (quizId: number, pinVal?: string) => void;
  handleSelectLevel: (levelId: string) => void;
  handleSelectQuiz: (quiz: any) => void;
  comingSoonModal: { open: boolean; title: string; desc: string };
  setComingSoonModal: (modal: { open: boolean; title: string; desc: string }) => void;
  enteredPin?: string;
  setEnteredPin?: (pin: string) => void;
  quizMode: 'testing' | 'training' | 'practice';
  setQuizMode: (mode: 'testing' | 'training' | 'practice') => void;
  isModePreselected: boolean;
}

export const StudentPortalRegistration: React.FC<StudentPortalRegistrationProps> = ({
  isModalOpen,
  setIsModalOpen,
  wizardStep,
  setWizardStep,
  selectedProgram,
  selectedLevelId,
  filteredLevelQuizzes,
  quizToStart,
  schools,
  classes,
  students,
  selectedSchoolId,
  setSelectedSchoolId,
  selectedClassId,
  setSelectedClassId,
  selectedStudentId,
  setSelectedStudentId,
  errorMsg,
  loading,
  programLevels,
  handleStartQuiz,
  handleSelectLevel,
  handleSelectQuiz,
  comingSoonModal,
  setComingSoonModal,
  enteredPin,
  setEnteredPin,
  quizMode,
  setQuizMode,
  isModePreselected
}) => {
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

  // Close dropdowns when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setIsSchoolDropdownOpen(false);
      setIsClassDropdownOpen(false);
      setIsStudentDropdownOpen(false);
    }
  }, [isModalOpen]);

  return (
    <>
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
                  {programLevels[selectedProgram]?.levels.map((level: any) => (
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
                  Chọn đề thi ôn luyện cho cấp độ: <strong>{programLevels[selectedProgram]?.levels.find((l: any) => l.id === selectedLevelId)?.name}</strong>
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
                              className={`quiz-mode-card ${quizMode === 'testing' ? 'active' : ''}`}
                              onClick={() => setQuizMode('testing')}
                            >
                              <div className="mode-card-header">
                                <span className="mode-title">Thi thử (Testing)</span>
                              </div>
                              <p className="mode-desc">Bài thi tính điểm, trộn câu hỏi, xem đáp án ở trang kết quả.</p>
                            </div>
                            <div
                              className={`quiz-mode-card ${quizMode === 'training' ? 'active' : ''}`}
                              onClick={() => setQuizMode('training')}
                            >
                              <div className="mode-card-header">
                                <span className="mode-title">Học tập (Training)</span>
                              </div>
                              <p className="mode-desc">Xem lời giải và giải thích đáp án đúng/sai ngay lập tức sau từng câu.</p>
                            </div>
                            <div
                              className={`quiz-mode-card ${quizMode === 'practice' ? 'active' : ''}`}
                              onClick={() => setQuizMode('practice')}
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
    </>
  );
};
