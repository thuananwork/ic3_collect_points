import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, FileText, Eye, EyeOff, Search, ChevronRight, X, FileUp } from 'lucide-react';
import { getQuizzes, createQuiz, updateQuiz, deleteQuiz, generateMixedQuiz, exportStandaloneQuiz } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { slugify } from '../../utils/scoring';
import './css/AdminQuizzes.css';
import AdminLayout from '../../components/AdminLayout';

interface Quiz {
  quiz_id: number;
  title: string;
  description: string;
  time_limit: number;
  is_published: boolean;
  created_at: string;
  question_count: number;
  school_level?: string;
  grade_level?: number | null;
  quiz_mode?: string;
  allow_practice?: boolean;
}

const GRADE_LEVELS_MAP: { [key: string]: number[] } = {
  'Primary': [3, 4, 5],
  'Secondary': [6, 7, 8, 9],
  'High': [10, 11, 12],
};

const getSchoolLevelLabel = (level?: string) => {
  if (level === 'Primary') return 'Tiểu học';
  if (level === 'Secondary') return 'THCS';
  if (level === 'High') return 'THPT';
  return '';
};

const AdminQuizzes: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { modalConfig, showConfirm, showPrompt, showAlert, closeConfirmModal } = useConfirmModal();
  const [isExporting, setIsExporting] = useState<number | null>(null);

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
  
  // Filter states
  const [filterSchoolLevel, setFilterSchoolLevel] = useState<string>('');
  const [filterGradeLevel, setFilterGradeLevel] = useState<number | ''>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(45);
  const [isPublished, setIsPublished] = useState(false);
  const [schoolLevel, setSchoolLevel] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<number | ''>('');
  const [allowPractice, setAllowPractice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Mix modal states
  const [isMixModalOpen, setIsMixModalOpen] = useState(false);
  const [mixTitle, setMixTitle] = useState('');
  const [mixDescription, setMixDescription] = useState('');
  const [mixTimeLimit, setMixTimeLimit] = useState(45);
  const [mixSchoolLevel, setMixSchoolLevel] = useState<string>('');
  const [mixGradeLevel, setMixGradeLevel] = useState<number | ''>('');
  const [mixSources, setMixSources] = useState<Array<{ quizId: string; count: number }>>([
    { quizId: '', count: 15 }
  ]);
  const [mixErrorMsg, setMixErrorMsg] = useState('');


  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getQuizzes();
      const sorted = res.data.sort((a: any, b: any) => {
        const extractLastNumber = (title: string) => {
          const matches = title.match(/\d+/g);
          return matches && matches.length > 0 ? parseInt(matches[matches.length - 1], 10) : 0;
        };
        const numA = extractLastNumber(a.title);
        const numB = extractLastNumber(b.title);
        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
      });
      setQuizzes(sorted);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đề thi:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedQuiz(null);
    setTitle('');
    setDescription('');
    setTimeLimit(45);
    setIsPublished(true);
    setSchoolLevel('');
    setGradeLevel('');
    setAllowPractice(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (quiz: Quiz) => {
    setModalMode('edit');
    setSelectedQuiz(quiz);
    setTitle(quiz.title);
    setDescription(quiz.description);
    setTimeLimit(quiz.time_limit);
    setIsPublished(quiz.is_published);
    setSchoolLevel(quiz.school_level || '');
    setGradeLevel(quiz.grade_level || '');
    setAllowPractice(!!quiz.allow_practice);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề đề thi.');
      return;
    }

    const payload = {
      title,
      description,
      time_limit: timeLimit,
      is_published: isPublished,
      school_level: schoolLevel || undefined,
      grade_level: gradeLevel !== '' ? Number(gradeLevel) : null,
      quiz_mode: 'testing',
      allow_practice: allowPractice
    };

    try {
      if (modalMode === 'create') {
        await createQuiz(payload);
      } else if (modalMode === 'edit' && selectedQuiz) {
        await updateQuiz(selectedQuiz.quiz_id, payload);
      }
      setIsModalOpen(false);
      fetchQuizzes();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  const handleDelete = (quizId: number, quizTitle: string) => {
    showConfirm(
      'Xác nhận xóa bài kiểm tra',
      `Bạn có chắc chắn muốn xóa bài kiểm tra "${quizTitle}"? Hành động này sẽ xóa toàn bộ câu hỏi liên quan.`,
      async () => {
        const originalQuizzes = [...quizzes];
        // Optimistic UI updates
        setQuizzes(prev => prev.filter(q => q.quiz_id !== quizId));

        try {
          await deleteQuiz(quizId);
          fetchQuizzes(true); // silent refresh
        } catch (err) {
          console.error('Lỗi khi xóa bài kiểm tra:', err);
          alert('Không thể xóa bài kiểm tra. Vui lòng thử lại.');
          // Revert state
          setQuizzes(originalQuizzes);
        }
      },
      'danger'
    );
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    // Optimistic UI updates
    setQuizzes(prev => prev.map(q =>
      q.quiz_id === quiz.quiz_id ? { ...q, is_published: !q.is_published } : q
    ));

    try {
      await updateQuiz(quiz.quiz_id, { is_published: !quiz.is_published });
      fetchQuizzes(true); // silent refresh
    } catch (err) {
      console.error('Lỗi khi thay đổi trạng thái công khai:', err);
      // Revert state
      setQuizzes(prev => prev.map(q =>
        q.quiz_id === quiz.quiz_id ? { ...q, is_published: quiz.is_published } : q
      ));
    }
  };

  const handleOpenMixModal = () => {
    setMixTitle('');
    setMixDescription('');
    setMixTimeLimit(45);
    setMixSchoolLevel('');
    setMixGradeLevel('');
    setMixSources([{ quizId: '', count: 15 }]);
    setMixErrorMsg('');
    setIsMixModalOpen(true);
  };

  const handleAddMixSource = () => {
    setMixSources(prev => [...prev, { quizId: '', count: 15 }]);
  };

  const handleRemoveMixSource = (index: number) => {
    setMixSources(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMixSourceChange = (index: number, field: 'quizId' | 'count', value: any) => {
    setMixSources(prev => prev.map((src, idx) => {
      if (idx === index) {
        return {
          ...src,
          [field]: field === 'count' ? Math.max(1, parseInt(value) || 0) : value
        };
      }
      return src;
    }));
  };

  const handleMixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mixTitle.trim()) {
      setMixErrorMsg('Vui lòng nhập tiêu đề đề thi mới.');
      return;
    }

    const validSources = mixSources.filter(src => src.quizId !== '' && src.count > 0);
    if (validSources.length === 0) {
      setMixErrorMsg('Vui lòng cấu hình ít nhất một đề thi nguồn với số câu hỏi lớn hơn 0.');
      return;
    }

    const payload = {
      title: mixTitle,
      description: mixDescription,
      time_limit: mixTimeLimit,
      school_level: mixSchoolLevel || undefined,
      grade_level: mixGradeLevel !== '' ? Number(mixGradeLevel) : null,
      sources: validSources.map(src => ({
        quiz_id: Number(src.quizId),
        count: src.count
      }))
    };

    try {
      await generateMixedQuiz(payload);
      setIsMixModalOpen(false);
      fetchQuizzes();
    } catch (err: any) {
      console.error(err);
      setMixErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi sinh đề thi trộn.');
    }
  };


  const filteredQuizzes = quizzes.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLevel = !filterSchoolLevel || q.school_level === filterSchoolLevel;
    const matchesGrade = filterGradeLevel === '' || q.grade_level === Number(filterGradeLevel);
    
    return matchesSearch && matchesLevel && matchesGrade;
  });

  return (
    <>
      <AdminLayout
        className="admin-quizzes-page"
        toolbarContent={
          <div className="admin-quizzes-toolbar-wrapper">
            <div className="search-bar-container">
              <div className="search-filter-left">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="filter-controls-group" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <select
                    value={filterSchoolLevel}
                    onChange={(e) => {
                      setFilterSchoolLevel(e.target.value);
                      setFilterGradeLevel('');
                    }}
                    className="form-input filter-select"
                    style={{ width: '180px', padding: '0.5rem 0.75rem' }}
                  >
                    <option value="">Cấp học (Tất cả)</option>
                    <option value="Primary">Tiểu học</option>
                    <option value="Secondary">THCS</option>
                    <option value="High">THPT</option>
                  </select>

                  <select
                    value={filterGradeLevel}
                    onChange={(e) => setFilterGradeLevel(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="form-input filter-select"
                    style={{ width: '150px', padding: '0.5rem 0.75rem' }}
                    disabled={!filterSchoolLevel}
                  >
                    <option value="">Lớp (Tất cả)</option>
                    {filterSchoolLevel && GRADE_LEVELS_MAP[filterSchoolLevel]?.map(g => (
                      <option key={g} value={g}>Lớp {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="search-filter-right-buttons" style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-mix-quizzes" onClick={handleOpenMixModal}>
                  🎲 Trộn đề ngẫu nhiên mới
                </button>
                <button className="btn-primary btn-add-quiz" onClick={handleOpenCreateModal}>
                  <Plus size={18} /> Tạo bài kiểm tra
                </button>
              </div>
            </div>
          </div>
        }
        tableContent={
          loading ? (
            <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '1rem' }}>
              <div className="spinner"></div>
              <span style={{ color: 'var(--text-secondary)' }}>Đang tải danh sách đề thi...</span>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} className="empty-icon" />
              <h3>Không tìm thấy đề thi nào</h3>
              <p>Hãy bắt đầu bằng cách tạo đề thi trắc nghiệm đầu tiên của bạn.</p>
              <button className="btn-primary" onClick={handleOpenCreateModal}>Tạo bài kiểm tra</button>
            </div>
          ) : (
            <div className="quizzes-table-scroller">
              <table className="quizzes-table">
                <thead>
                  <tr>
                    <th>Đề thi</th>
                    <th>Phân loại</th>
                    <th>Thời gian</th>
                    <th>Số câu hỏi</th>
                    <th className="status-header">Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuizzes.map((quiz) => (
                    <tr key={quiz.quiz_id}>
                      <td>
                        <div className="quiz-title-cell">{quiz.title}</div>
                        <div className="quiz-desc-cell">{quiz.description || 'Không có mô tả.'}</div>
                      </td>
                      <td>
                        {quiz.school_level ? (
                          <span className="badge-level">
                            {getSchoolLevelLabel(quiz.school_level)} {quiz.grade_level ? `- Lớp ${quiz.grade_level}` : ''}
                          </span>
                        ) : (
                          <span className="badge-none">-</span>
                        )}
                      </td>
                      <td>
                        <span className="quiz-time-cell">{quiz.time_limit} phút</span>
                      </td>
                      <td>
                        <span className="quiz-count-cell">{quiz.question_count} câu</span>
                      </td>
                      <td className="quiz-status-cell">
                        {quiz.is_published ? (
                          <span className="badge-published"><Eye size={12} /> Đang hoạt động</span>
                        ) : (
                          <span className="badge-draft"><EyeOff size={12} /> Nháp</span>
                        )}
                      </td>
                      <td>
                        <span className="quiz-date-cell">{new Date(quiz.created_at).toLocaleDateString('vi-VN')}</span>
                      </td>
                      <td>
                        <div className="quiz-table-actions">
                          <button 
                            className="btn-action btn-questions" 
                            onClick={() => navigate(`/admin/quizzes/${slugify(quiz.title)}/questions`)}
                            title="Soạn câu hỏi"
                          >
                            Soạn câu hỏi <ChevronRight size={16} />
                          </button>
                          <div className="action-icons">
                            <button 
                              className={`icon-action btn-toggle-pub ${quiz.is_published ? 'published' : 'draft'}`} 
                              onClick={() => handleTogglePublish(quiz)}
                              title={quiz.is_published ? "Chuyển thành bản nháp" : "Công khai đề thi"}
                            >
                              {quiz.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            <button 
                              className="icon-action btn-export-offline" 
                              onClick={() => handleExportOffline(quiz.quiz_id)}
                              title="Xuất bản tệp HTML offline (.html)"
                              disabled={isExporting !== null}
                              style={{ cursor: isExporting !== null ? 'not-allowed' : 'pointer' }}
                            >
                              <FileUp size={16} color="#a855f7" className={isExporting === quiz.quiz_id ? "animate-spin" : ""} />
                            </button>
                            <button 
                              className="icon-action btn-edit" 
                              onClick={() => handleOpenEditModal(quiz)}
                              title="Chỉnh sửa cấu hình đề"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className="icon-action btn-delete" 
                              onClick={() => handleDelete(quiz.quiz_id, quiz.title)}
                              title="Xóa đề thi"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      />

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass animate-slide-up">
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Tạo bài kiểm tra' : 'Chỉnh sửa cấu hình bài kiểm tra'}</h2>
              <button type="button" className="btn-close-custom" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
              
              <div className="form-section-title">Thông tin cơ bản</div>
              <div className="form-group">
                <label className="form-label">Tiêu đề đề thi <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đề ôn tập IC3 GS6 - Máy tính căn bản"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả hướng dẫn</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập thông tin hướng dẫn hoặc mô tả phạm vi kiến thức cho học sinh..."
                  className="form-input form-textarea"
                  rows={2}
                />
              </div>

              <div className="form-section-title">Cấu hình &amp; Phân loại</div>
              <div className="form-row three-cols">
                <div className="form-group third">
                  <label className="form-label">Cấp học</label>
                  <select
                    value={schoolLevel}
                    onChange={(e) => {
                      setSchoolLevel(e.target.value);
                      setGradeLevel('');
                    }}
                    className="form-input"
                  >
                    <option value="">-- Không chọn --</option>
                    <option value="Primary">Tiểu học (Spark)</option>
                    <option value="Secondary">THCS (IC3 GS6)</option>
                    <option value="High">THPT (MOS)</option>
                  </select>
                </div>
                
                <div className="form-group third">
                  <label className="form-label">Khối lớp</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="form-input"
                    disabled={!schoolLevel}
                  >
                    <option value="">-- Tất cả --</option>
                    {schoolLevel && GRADE_LEVELS_MAP[schoolLevel]?.map(g => (
                      <option key={g} value={g}>Lớp {g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group third">
                  <label className="form-label">Thời gian (phút)</label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 0))}
                    className="form-input"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="form-section-title">Trạng thái xuất bản & Chế độ Ôn luyện</div>
              <div className="form-group-publish-card" style={{ marginBottom: '1rem' }}>
                <label className="publish-card-label">
                  <div className="publish-card-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="form-checkbox-premium"
                    />
                  </div>
                  <div className="publish-card-text">
                    <span className="publish-card-title">Cho phép học sinh truy cập ngay</span>
                    <span className="publish-card-desc">Nếu được bật, đề thi sẽ hiển thị ngay trên cổng Quiz Portal của học sinh để luyện tập hoặc kiểm tra.</span>
                  </div>
                </label>
              </div>

              <div className="form-group-publish-card">
                <label className="publish-card-label">
                  <div className="publish-card-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={allowPractice}
                      onChange={(e) => setAllowPractice(e.target.checked)}
                      className="form-checkbox-premium"
                    />
                  </div>
                  <div className="publish-card-text">
                    <span className="publish-card-title">Cho phép học sinh Ôn luyện (Practice)</span>
                    <span className="publish-card-desc">Nếu được bật, nút Ôn luyện (Practice) sẽ xuất hiện bên cạnh nút Training và Testing để học sinh có thể ôn luyện đề với thứ tự câu hỏi &amp; đáp án được xáo trộn.</span>
                  </div>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'create' ? 'Tạo bài kiểm tra' : 'Lưu cấu hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RANDOM MIXING MODAL */}
      {isMixModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass animate-slide-up" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h2>🎲 Trộn câu hỏi tạo đề thi mới</h2>
              <button type="button" className="btn-close-custom" onClick={() => setIsMixModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleMixSubmit} className="modal-body">
              {mixErrorMsg && <div className="alert alert-danger">{mixErrorMsg}</div>}
              
              <div className="form-section-title">Thông tin đề thi mới</div>
              <div className="form-group">
                <label className="form-label">Tiêu đề đề thi mới <span className="required">*</span></label>
                <input
                  type="text"
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  placeholder="Ví dụ: Đề thi thử tổng hợp IC3 GS6"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả hướng dẫn</label>
                <textarea
                  value={mixDescription}
                  onChange={(e) => setMixDescription(e.target.value)}
                  placeholder="Nhập thông tin hướng dẫn làm bài..."
                  className="form-input form-textarea"
                  rows={2}
                />
              </div>

              <div className="form-row three-cols">
                <div className="form-group third">
                  <label className="form-label">Cấp học</label>
                  <select
                    value={mixSchoolLevel}
                    onChange={(e) => {
                      setMixSchoolLevel(e.target.value);
                      setMixGradeLevel('');
                    }}
                    className="form-input"
                  >
                    <option value="">-- Không chọn --</option>
                    <option value="Primary">Tiểu học (Spark)</option>
                    <option value="Secondary">THCS (IC3 GS6)</option>
                    <option value="High">THPT (MOS)</option>
                  </select>
                </div>
                
                <div className="form-group third">
                  <label className="form-label">Khối lớp</label>
                  <select
                    value={mixGradeLevel}
                    onChange={(e) => setMixGradeLevel(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="form-input"
                    disabled={!mixSchoolLevel}
                  >
                    <option value="">-- Tất cả --</option>
                    {mixSchoolLevel && GRADE_LEVELS_MAP[mixSchoolLevel]?.map(g => (
                      <option key={g} value={g}>Lớp {g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group third">
                  <label className="form-label">Thời gian (phút)</label>
                  <input
                    type="number"
                    value={mixTimeLimit}
                    onChange={(e) => setMixTimeLimit(Math.max(1, parseInt(e.target.value) || 0))}
                    className="form-input"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Đề thi nguồn & Số câu hỏi ngẫu nhiên</span>
                <button type="button" className="btn-add-source-link" onClick={handleAddMixSource}>
                  <Plus size={14} /> Thêm đề nguồn
                </button>
              </div>

              <div className="mix-sources-list">
                {mixSources.map((src, idx) => {
                  const selectedQuizObj = quizzes.find(q => q.quiz_id === Number(src.quizId));
                  const maxQuestions = selectedQuizObj ? selectedQuizObj.question_count : 0;
                  
                  return (
                    <div key={idx} className="mix-source-row">
                      <div className="mix-source-select-col">
                        <select
                          value={src.quizId}
                          onChange={(e) => handleMixSourceChange(idx, 'quizId', e.target.value)}
                          className="form-input select-premium-source"
                          required
                        >
                          <option value="">-- Chọn đề thi nguồn --</option>
                          {quizzes.map(q => (
                            <option key={q.quiz_id} value={q.quiz_id}>
                              {q.title} ({q.question_count} câu)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mix-source-count-col">
                        <input
                          type="number"
                          value={src.count}
                          onChange={(e) => handleMixSourceChange(idx, 'count', e.target.value)}
                          className="form-input count-premium-input"
                          min={1}
                          max={maxQuestions > 0 ? maxQuestions : undefined}
                          placeholder="Số câu"
                          title={maxQuestions > 0 ? `Tối đa ${maxQuestions} câu` : ""}
                          required
                        />
                        {maxQuestions > 0 && <span className="max-question-hint">/ {maxQuestions}</span>}
                      </div>
                      <button
                        type="button"
                        className="btn-remove-source"
                        onClick={() => handleRemoveMixSource(idx)}
                        disabled={mixSources.length === 1}
                        title="Xóa nguồn này"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsMixModalOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-mix-submit">
                  🎲 Bắt đầu trộn đề
                </button>
              </div>
            </form>
          </div>
        </div>
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
    </>
  );
};

export default AdminQuizzes;

