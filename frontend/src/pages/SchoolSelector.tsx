import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchools, addSchool, deleteSchool } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirmModal } from '../hooks/useConfirmModal';
import './css/SchoolSelector.css';

interface School {
  school_id: number;
  school_name: string;
  address?: string;
  school_logo?: string;
}

const SchoolSelector: React.FC = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom Add School Modal state
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newSchoolLogo, setNewSchoolLogo] = useState('');

  const { modalConfig, showConfirm, showAlert, closeConfirmModal } = useConfirmModal();

  useEffect(() => {
    fetchSchoolsList();
  }, []);

  const fetchSchoolsList = async () => {
    try {
      const res = await getSchools();
      setSchools(res.data.schools);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchool = (schoolId: number) => {
    localStorage.setItem('active_school_id', schoolId.toString());
    navigate(`/choose-class?school_id=${schoolId}`);
  };

  const handleOpenSchoolModal = () => {
    setNewSchoolName('');
    setNewSchoolAddress('');
    setNewSchoolLogo('');
    setIsSchoolModalOpen(true);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newSchoolName.trim();
    const trimmedAddress = newSchoolAddress.trim();
    const trimmedLogo = newSchoolLogo.trim();

    if (!trimmedName) {
      showAlert("Lỗi nhập liệu", "Tên trường học không được để trống!");
      return;
    }
    if (schools.some(s => s.school_name.toLowerCase() === trimmedName.toLowerCase())) {
      showAlert("Lỗi nhập liệu", "Trường học này đã tồn tại!");
      return;
    }

    try {
      const res = await addSchool(trimmedName, trimmedAddress || undefined, trimmedLogo || undefined);
      if (res.data && res.data.status === 'error') {
        showAlert("Lỗi thêm trường", res.data.message || "Trường học này đã tồn tại!");
        return;
      }
      setIsSchoolModalOpen(false);
      const schoolsRes = await getSchools();
      setSchools(schoolsRes.data.schools);
    } catch (err: any) {
      console.error(err);
      showAlert("Lỗi thêm trường", err.response?.data?.message || "Trường học này đã được tạo!");
    }
  };

  const handleDeleteSchool = (schoolId: number, schoolName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    showConfirm(
      `Xác nhận xóa trường học`,
      `Bạn có chắc chắn muốn xóa trường "${schoolName}" và tất cả các lớp học trực thuộc không?`,
      async () => {
        try {
          await deleteSchool(schoolId);
          if (localStorage.getItem('active_school_id') === schoolId.toString()) {
            localStorage.removeItem('active_school_id');
          }
          await fetchSchoolsList();
        } catch (err) {
          console.error(err);
        }
      },
      'danger'
    );
  };

  if (loading) return <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }} />;

  return (
    <div className="school-selector-page">
      <div className="container">
        <div className="header">
          <h1>
            <span className="logo-badge">IC3</span>
            CHỌN TRƯỜNG HỌC
          </h1>
          <p style={{ color: 'var(--gray-600)', marginTop: '10px', fontSize: '15px' }}>
            Vui lòng chọn trường học để quản lý phòng máy và lớp học
          </p>
        </div>

        <div className="school-grid">
          {schools.map((school) => {
            return (
              <div 
                className="school-card" 
                key={school.school_id}
                onClick={() => handleSelectSchool(school.school_id)}
              >
                <button 
                  className="del-school-btn" 
                  onClick={(e) => handleDeleteSchool(school.school_id, school.school_name, e)}
                  title="Xóa trường học này"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
                <div className="school-icon">
                  {school.school_logo ? (
                    <img 
                      src={school.school_logo} 
                      alt="Logo" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                    </svg>
                  )}
                </div>
                <h3>{school.school_name}</h3>
                {school.address && <p style={{ fontSize: '12px', color: 'var(--gray-600)', marginBottom: '5px' }}>📍 {school.address}</p>}
                <p style={{ fontWeight: '600', color: 'var(--blue)', marginTop: '5px' }}>Truy cập trường học</p>
              </div>
            );
          })}

          <div className="school-card add-school-card" onClick={handleOpenSchoolModal}>
            <div className="school-icon">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <h3 style={{ color: 'var(--gray-600)' }}>Thêm trường mới</h3>
            <p>Thiết lập khu vực dạy học mới</p>
          </div>
        </div>
      </div>

      {/* Custom Add School Modal */}
      {isSchoolModalOpen && (
        <div className="confirm-modal-overlay" onClick={() => setIsSchoolModalOpen(false)}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-header">
              <div className="confirm-modal-icon-wrapper info">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                </svg>
              </div>
              <h3>Thêm trường học mới</h3>
            </div>
            
            <form onSubmit={handleSaveSchool}>
              <div className="confirm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--gray-700)' }}>Tên trường học *</label>
                  <input
                    type="text"
                    className="confirm-modal-input"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    placeholder="Ví dụ: THCS Nguyễn Du"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--gray-300)',
                      background: 'var(--white)',
                      color: 'var(--gray-900)',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--gray-700)' }}>Địa chỉ trường (Không bắt buộc)</label>
                  <input
                    type="text"
                    className="confirm-modal-input"
                    value={newSchoolAddress}
                    onChange={(e) => setNewSchoolAddress(e.target.value)}
                    placeholder="Ví dụ: 123 Đường Lê Lợi, Quận 1, TP. HCM"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--gray-300)',
                      background: 'var(--white)',
                      color: 'var(--gray-900)',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--gray-700)' }}>Đường dẫn ảnh Logo (Không bắt buộc)</label>
                  <input
                    type="text"
                    className="confirm-modal-input"
                    value={newSchoolLogo}
                    onChange={(e) => setNewSchoolLogo(e.target.value)}
                    placeholder="Ví dụ: https://example.com/logo.png"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--gray-300)',
                      background: 'var(--white)',
                      color: 'var(--gray-900)',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              
              <div className="confirm-modal-footer">
                <button 
                  type="button" 
                  className="confirm-modal-btn cancel" 
                  onClick={() => setIsSchoolModalOpen(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="confirm-modal-btn confirm-info"
                >
                  Lưu lại
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
    </div>
  );
};

export default SchoolSelector;
