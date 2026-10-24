import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getClasses, selectClass, addClass, deleteClass, getSchools } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirmModal } from '../hooks/useConfirmModal';
import './css/ClassSelector.css';

interface School {
  school_id: number;
  school_name: string;
  address?: string;
  school_logo?: string;
}

const ClassSelector: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const schoolIdParam = searchParams.get('school_id');

  const [schoolName, setSchoolName] = useState('Trường học');
  const [counts, setCounts] = useState<any>({});
  const [activeClass, setActiveClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('secondary');

  const { modalConfig, showPrompt, showConfirm, showAlert, closeConfirmModal } = useConfirmModal();

  const levels = [
    { key: 'primary', label: 'Tiểu học (Lớp 3, 4, 5)', grades: ['3', '4', '5'] },
    { key: 'secondary', label: 'THCS (Lớp 6, 7, 8)', grades: ['6', '7', '8'] },
    { key: 'high', label: 'THPT (Lớp 10, 11, 12)', grades: ['10', '11', '12'] }
  ];

  useEffect(() => {
    if (!schoolIdParam) {
      navigate('/choose-school', { replace: true });
      return;
    }
    loadData();
  }, [schoolIdParam]);

  const loadData = async () => {
    const sId = parseInt(schoolIdParam || '0');
    if (!sId) {
      navigate('/choose-school', { replace: true });
      return;
    }

    try {
      // 1. Fetch schools list to find name
      const schoolsRes = await getSchools();
      const currentSchool = schoolsRes.data.schools.find((s: School) => s.school_id === sId);
      if (currentSchool) {
        setSchoolName(currentSchool.school_name);
        localStorage.setItem('active_school_id', sId.toString());
      } else {
        // School not found or belongs to another user
        navigate('/choose-school', { replace: true });
        return;
      }

      // 2. Fetch classes of this school
      const classesRes = await getClasses(sId);
      setCounts(classesRes.data.counts);
      if (classesRes.data.active_class) {
        setActiveClass(classesRes.data.active_class);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      navigate('/choose-school', { replace: true });
    }
  };

  const fetchClasses = async (sId: number) => {
    try {
      const res = await getClasses(sId);
      setCounts(res.data.counts);
      if (res.data.active_class) {
        setActiveClass(res.data.active_class);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelect = async (className: string) => {
    const sId = parseInt(schoolIdParam || '0');
    if (!sId) return;

    try {
      await selectClass(className, sId);
      setActiveClass(className);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = (grade: string, e: React.MouseEvent) => {
    e.preventDefault();
    const sId = parseInt(schoolIdParam || '0');
    if (!sId) return;

    showPrompt(
      `Thêm lớp mới - Khối ${grade}`,
      `Nhập tên lớp mới cho Lớp ${grade} (Ví dụ: A, B, C, 1, 2, ...):`,
      '',
      async (suffix) => {
        const trimmed = suffix.trim();
        if (!trimmed) {
          showAlert("Lỗi nhập liệu", "Tên lớp không được để trống!");
          return;
        }

        try {
          const res = await addClass(grade, trimmed, sId);
          if (res.data && res.data.status === 'error') {
            showAlert("Lỗi thêm lớp", res.data.message || "Lớp học đã tồn tại.");
            return;
          }
          await fetchClasses(sId);
        } catch (err: any) {
          console.error(err);
          showAlert("Lỗi thêm lớp", err.response?.data?.message || "Lớp học này đã tồn tại trong trường!");
        }
      }
    );
  };

  const handleDelete = (className: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sId = parseInt(schoolIdParam || '0');
    if (!sId) return;

    showConfirm(
      `Xác nhận xóa lớp`,
      `Bạn có chắc chắn muốn xóa lớp ${className}?`,
      async () => {
        try {
          await deleteClass(className, sId);
          await fetchClasses(sId);
        } catch (err) {
          console.error(err);
        }
      },
      'danger'
    );
  };

  if (loading) return <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }} />;

  return (
    <div className="class-selector-page">
      <div className="container">
        <div className="back-btn-container">
          <button className="btn-back-schools" onClick={() => navigate('/choose-school')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Quay lại chọn trường
          </button>
        </div>

        <div className="header">
          <h1>
            <span className="logo-badge">IC3</span>
            {schoolName}
          </h1>
          <p style={{ color: 'var(--gray-600)', marginTop: '10px', fontSize: '15px' }}>
            Vui lòng chọn lớp để tiếp tục quản lý
          </p>
        </div>

        <div className="level-tabs">
          {levels.map((lvl) => (
            <button
              key={lvl.key}
              className={`level-tab ${selectedLevel === lvl.key ? 'active' : ''}`}
              onClick={() => setSelectedLevel(lvl.key)}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        <div className="grid">
          {(levels.find(l => l.key === selectedLevel)?.grades || []).map((grade) => {
            const listClasses = Array.isArray(counts[grade])
              ? [...counts[grade]].sort((a, b) => a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' }))
              : [];

            return (
              <div className="card" key={grade}>
                <div className="card-header">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </div>
                  <h3>LỚP {grade}</h3>
                </div>
                <div className="btn-grid">
                  {listClasses.map((className: string) => {
                    const isActive = activeClass === className;
                    return (
                      <div className="class-wrapper" key={className}>
                        <button
                          onClick={() => handleSelect(className)}
                          className={`class-btn ${isActive ? 'active' : ''}`}
                          style={{ padding: '12px 30px' }}
                        >
                          Lớp {className}
                        </button>
                        <button
                          onClick={(e) => handleDelete(className, e)}
                          className="del-btn"
                          title="Xoá lớp này"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={(e) => handleAdd(grade, e)}
                    className="btn-add"
                    title={`Thêm lớp mới cho Lớp ${grade}`}
                  >
                    + Thêm
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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

export default ClassSelector;