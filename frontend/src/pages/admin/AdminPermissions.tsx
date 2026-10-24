import React, { useEffect, useState } from 'react';
import { getUsers, updateUsers } from '../../api';
import {
  Trash2, Mail, Key, ShieldCheck, Search,
  UserPlus, ShieldAlert, X,
  HelpCircle, ChevronRight, Save, UserCheck, UserX
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import './css/AdminPermissions.css';
import AdminLayout from '../../components/AdminLayout';


const AdminPermissions: React.FC = () => {
  const { modalConfig, showConfirm, closeConfirmModal } = useConfirmModal();
  const [users, setUsers] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Bộ lọc nâng cao: 'all' | 'pending' | 'approved' | 'admin' | 'google' | 'local'
  const [filterType, setFilterType] = useState<string>('all');

  // ID tài khoản được click chọn để xem chi tiết
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Trạng thái chỉnh sửa quyền
  const [editedPermissions, setEditedPermissions] = useState<Record<string, string[]>>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form thêm tài khoản trong sidebar
  const [showAddForm, setShowAddForm] = useState<'local' | 'google' | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const usersRef = React.useRef(users);
  const selectedUserIdRef = React.useRef(selectedUserId);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    fetchUsers(true);
    const interval = setInterval(() => fetchUsers(false), 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async (isInitial = false) => {
    try {
      const res = await getUsers();
      setUsers(res.data);

      setEditedPermissions(prev => {
        const nextPerms = { ...prev };
        Object.entries(res.data).forEach(([id, u]: any) => {
          const original = u.permissions || [];

          const prevVal = prev[id];
          const hasUnsavedChanges = prevVal && (() => {
            const currentOriginal = usersRef.current[id]?.permissions || [];
            return JSON.stringify(currentOriginal.sort()) !== JSON.stringify(prevVal.sort());
          })();

          if (!hasUnsavedChanges) {
            nextPerms[id] = original;
          }
        });

        Object.keys(nextPerms).forEach(id => {
          if (!res.data[id]) {
            delete nextPerms[id];
          }
        });

        return nextPerms;
      });

      const currentSelectedId = selectedUserIdRef.current;
      if (currentSelectedId && !res.data[currentSelectedId]) {
        setSelectedUserId(null);
      }
    } catch (err) {
      console.error(err);
      if (isInitial) {
        showToast('Lỗi khi tải danh sách người dùng', 'error');
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  const handleAction = async (action: string, payload: any) => {
    try {
      const res = await updateUsers({ action, ...payload });
      showToast(res.data.message, 'success');
      fetchUsers();

      // Reset form
      if (action === 'add_local') {
        setNewUsername('');
        setNewPassword('');
      }
      if (action === 'add_google') {
        setNewEmail('');
      }
      setShowAddForm(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Đã xảy ra lỗi', 'error');
    }
  };

  const togglePermission = (userId: string, permission: string) => {
    const current = editedPermissions[userId] || [];
    let newPerms = [...current];

    const subPermissions = ['chonlop', 'laydiem', 'chongoi', 'muctieu', 'scoreboard', 'excel-mode'];

    if (permission === 'nhan_diem_thuc_hanh') {
      if (current.includes('nhan_diem_thuc_hanh')) {
        // Tắt tính năng lớn -> Tắt luôn tất cả tính năng con
        newPerms = newPerms.filter(p => p !== 'nhan_diem_thuc_hanh' && !subPermissions.includes(p));
      } else {
        // Bật tính năng lớn -> Tự động bật tất cả tính năng con theo mặc định
        newPerms = [...newPerms, 'nhan_diem_thuc_hanh', ...subPermissions.filter(p => !newPerms.includes(p))];
      }
    } else if (subPermissions.includes(permission)) {
      if (current.includes(permission)) {
        // Tắt tính năng con
        newPerms = newPerms.filter(p => p !== permission);
      } else {
        // Bật tính năng con -> Tự động bật tính năng lớn cha nếu chưa có
        newPerms = [...newPerms, permission];
        if (!newPerms.includes('nhan_diem_thuc_hanh')) {
          newPerms.push('nhan_diem_thuc_hanh');
        }
      }
    } else {
      // Các tính năng lớn khác
      newPerms = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
    }

    setEditedPermissions(prev => ({ ...prev, [userId]: newPerms }));
  };

  const savePermissions = async (userId: string) => {
    const permissions = editedPermissions[userId] || [];
    try {
      await updateUsers({ action: 'update_permissions', user_id: userId, permissions });
      showToast('Cập nhật quyền thành công', 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi lưu quyền', 'error');
    }
  };

  const toggleApproval = (userId: string) => {
    handleAction('toggle_approval', { user_id: userId });
  };

  const hasChanges = (userId: string) => {
    const original = users[userId]?.permissions || [];
    const current = editedPermissions[userId] || [];
    return JSON.stringify(original.sort()) !== JSON.stringify(current.sort());
  };

  // Tính toán thống kê tài khoản
  const userEntries = Object.entries(users);
  const totalCount = userEntries.length;
  const approvedCount = userEntries.filter(([_, data]: any) => data.approved || data.role === 'admin').length;
  const pendingCount = totalCount - approvedCount;
  const googleCount = userEntries.filter(([_, data]: any) => data.type === 'google').length;
  const localCount = totalCount - googleCount;

  const approvedPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
  const googlePercent = totalCount > 0 ? Math.round((googleCount / totalCount) * 100) : 0;

  // Đếm chính xác cho từng bộ lọc tránh sai số phần trăm
  const approvedNonAdminCount = userEntries.filter(([_, data]: any) => data.approved && data.role !== 'admin').length;
  const adminCount = userEntries.filter(([_, data]: any) => data.role === 'admin').length;

  // Lọc nâng cao kết hợp tìm kiếm từ khóa
  const filteredUsers = userEntries.filter(([id, data]: any) => {
    const matchesSearch =
      (data.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    switch (filterType) {
      case 'pending':
        return !data.approved && data.role !== 'admin';
      case 'approved':
        return data.approved && data.role !== 'admin';
      case 'admin':
        return data.role === 'admin';
      case 'google':
        return data.type === 'google';
      case 'local':
        return data.type === 'local';
      default:
        return true;
    }
  });

  const selectedUserData = selectedUserId ? users[selectedUserId] : null;
  const selectedUserPerms = selectedUserId ? editedPermissions[selectedUserId] || [] : [];

  if (loading) {
    return (
      <div className="permissions-loading">
        <div className="spinner"></div>
        <div>Đang đồng bộ dữ liệu quản trị viên...</div>
      </div>
    );
  }

  return (
    <>
      <AdminLayout
        className="permissions-page animate-fade-in"
        isDetailCollapsed={!selectedUserId}
        sidebarContent={
          <>
            <div className="permissions-sidebar-header">
              <div className="permissions-sidebar-icon">
                <ShieldCheck size={24} strokeWidth={2.5} />
              </div>
              <div className="permissions-sidebar-title">
                <h1>Hệ Thống Admin</h1>
                <p>Phân quyền & Quản lý Giáo viên</p>
              </div>
            </div>

            {/* Stats Widget */}
            <div className="admin-stats-card">
              <h3>Thống Kê Tài Khoản</h3>
              
              <div className="admin-stats-row">
                <span className="admin-stats-label">Tổng số tài khoản</span>
                <span className="admin-stats-value">{totalCount}</span>
              </div>

              <div className="admin-stats-row">
                <span className="admin-stats-label">Chờ phê duyệt</span>
                <span className="admin-stats-value" style={{ color: pendingCount > 0 ? '#ef4444' : 'inherit' }}>
                  {pendingCount}
                </span>
              </div>

              <div className="admin-stats-row" style={{ marginTop: '8px' }}>
                <span className="admin-stats-label">Tỉ lệ đã duyệt ({approvedCount}/{totalCount})</span>
                <span className="admin-stats-value">{approvedPercent}%</span>
              </div>
              <div className="admin-stats-bar-container">
                <div className="admin-stats-bar" style={{ width: `${approvedPercent}%`, background: '#16a34a' }}></div>
              </div>

              <div className="admin-stats-row" style={{ marginTop: '8px' }}>
                <span className="admin-stats-label">Tài khoản Google ({googleCount}/{totalCount})</span>
                <span className="admin-stats-value">{googlePercent}%</span>
              </div>
              <div className="admin-stats-bar-container">
                <div className="admin-stats-bar" style={{ width: `${googlePercent}%`, background: '#3b82f6' }}></div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="sidebar-action-box">
              <div className="sidebar-form-title">
                <UserPlus size={18} color="var(--primary-color)" />
                <span>Tạo Tài Khoản Mới</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn-outline flex-center ${showAddForm === 'local' ? 'active' : ''}`}
                  onClick={() => setShowAddForm(showAddForm === 'local' ? null : 'local')}
                  style={{ flex: 1, padding: '0.5rem 0' }}
                >
                  <Key size={14} style={{ marginRight: '6px' }} /> Nội Bộ
                </button>
                <button 
                  className={`btn-primary flex-center ${showAddForm === 'google' ? 'active' : ''}`}
                  onClick={() => setShowAddForm(showAddForm === 'google' ? null : 'google')}
                  style={{ flex: 1, padding: '0.5rem 0' }}
                >
                  <Mail size={14} style={{ marginRight: '6px' }} /> Google
                </button>
              </div>

              {/* Form trượt gọn gàng */}
              {showAddForm && (
                <div className="sidebar-inputs animate-slide-up">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>
                      {showAddForm === 'local' ? 'Tài Khoản Nội Bộ' : 'Uỷ Quyền Google'}
                    </strong>
                    <button 
                      onClick={() => setShowAddForm(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {showAddForm === 'local' ? (
                    <>
                      <input
                        className="modern-input"
                        placeholder="Tên đăng nhập"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                      />
                      <input
                        className="modern-input"
                        type="password"
                        placeholder="Mật khẩu"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </>
                  ) : (
                    <input
                      className="modern-input"
                      placeholder="Địa chỉ Gmail (@gmail.com)"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                    />
                  )}

                  <button
                    className="btn-primary flex-center"
                    onClick={() => handleAction(
                      showAddForm === 'local' ? 'add_local' : 'add_google',
                      showAddForm === 'local'
                        ? { username: newUsername, password: newPassword }
                        : { email: newEmail }
                    )}
                    style={{ width: '100%', padding: '0.55rem' }}
                  >
                    Xác nhận khởi tạo
                  </button>
                </div>
              )}
            </div>
          </>
        }
        toolbarContent={
          <>
            <div className="permissions-search-container">
              <Search size={18} className="permissions-search-icon" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc email giáo viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="permissions-search-input"
              />
            </div>

            <div className="filter-pills-container">
              <button 
                className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Tất cả ({totalCount})
              </button>
              <button 
                className={`filter-pill ${filterType === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterType('pending')}
              >
                Chờ duyệt ({pendingCount})
              </button>
              <button 
                className={`filter-pill ${filterType === 'approved' ? 'active' : ''}`}
                onClick={() => setFilterType('approved')}
              >
                Đã duyệt ({approvedNonAdminCount})
              </button>
              <button 
                className={`filter-pill ${filterType === 'admin' ? 'active' : ''}`}
                onClick={() => setFilterType('admin')}
              >
                Admin ({adminCount})
              </button>
              <button 
                className={`filter-pill ${filterType === 'google' ? 'active' : ''}`}
                onClick={() => setFilterType('google')}
              >
                Google ({googleCount})
              </button>
              <button 
                className={`filter-pill ${filterType === 'local' ? 'active' : ''}`}
                onClick={() => setFilterType('local')}
              >
                Local ({localCount})
              </button>
            </div>
          </>
        }
        tableContent={
          <div className="permissions-table-scroller">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th style={{ textAlign: 'center' }}>Nguồn gốc</th>
                  <th style={{ textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Nhận điểm</th>
                  <th style={{ textAlign: 'center' }}>Trắc nghiệm</th>
                  <th style={{ textAlign: 'center' }}>Bài Giảng Điện Tử</th>
                  <th style={{ textAlign: 'center' }}>Tài Liệu Ôn Tập</th>
                  <th style={{ textAlign: 'center' }}>Công cụ</th>
                  <th style={{ textAlign: 'center', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(([id, data]: any) => (
                  <tr 
                    key={id} 
                    className={`table-row-hover ${selectedUserId === id ? 'selected-row' : ''}`}
                    onClick={() => setSelectedUserId(id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="user-name-cell">{data.name || 'Không tên'}</div>
                      <div className="user-email-cell">{data.email || id}</div>
                    </td>

                    {/* Nguồn gốc */}
                    <td style={{ textAlign: 'center' }}>
                      {data.type === 'google' ? (
                        <span className="badge badge-google">Google</span>
                      ) : (
                        <span className="badge badge-local">Local</span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td style={{ textAlign: 'center' }}>
                      <div 
                        className="status-cell" 
                        onClick={(e) => { 
                          e.stopPropagation(); // Ngăn sự kiện mở bảng detail
                          if (data.role !== 'admin') toggleApproval(id); 
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={data.role === 'admin'}
                          checked={data.role === 'admin' || data.approved}
                          readOnly
                          className="status-checkbox"
                        />
                        {data.role === 'admin' ? (
                          <span className="badge badge-admin"><ShieldAlert size={11} /> ADMIN</span>
                        ) : data.approved ? (
                          <span className="badge badge-approved">Đã duyệt</span>
                        ) : (
                          <span className="badge badge-pending">Chờ duyệt</span>
                        )}
                      </div>
                    </td>

                    {/* Quyền hạn (Checkboxes cho các tính năng lớn) */}
                    {[
                      { key: 'nhan_diem_thuc_hanh', label: 'Nhận điểm' },
                      { key: 'trac_nghiem_ly_thuyet', label: 'Trắc nghiệm' },
                      { key: 'bai_giang_dien_tu', label: 'Bài Giảng Điện Tử' },
                      { key: 'tai_lieu_on_tap', label: 'Tài Liệu Ôn Tập' },
                      { key: 'cong_cu_tien_ich', label: 'Công cụ' }
                    ].map(feat => (
                      <td 
                        key={feat.key} 
                        style={{ textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Không mở panel detail khi nhấp trực tiếp checkbox
                      >
                        <input
                          type="checkbox"
                          className="permission-checkbox"
                          disabled={data.role === 'admin' || !data.approved}
                          checked={data.role === 'admin' || (editedPermissions[id] || []).includes(feat.key)}
                          onChange={() => togglePermission(id, feat.key)}
                        />
                      </td>
                    ))}

                    {/* Biểu tượng mũi tên đi tiếp */}
                    <td style={{ textAlign: 'center' }}>
                      <ChevronRight size={16} color="var(--text-secondary)" style={{ opacity: selectedUserId === id ? 1 : 0.4 }} />
                    </td>
                  </tr>
                ))}

                {/* Empty State */}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                      Không tìm thấy tài khoản nào khớp với bộ lọc và từ khóa tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        }
        detailContent={
          selectedUserData ? (
            <>
              <div className="detail-header">
                <h3>Thông Tin Tài Khoản</h3>
                <button className="btn-close-detail" onClick={() => setSelectedUserId(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Profile Brief Card */}
              <div className="profile-card">
                <div className="avatar-large">
                  {(selectedUserData.name || selectedUserId || 'U')[0].toUpperCase()}
                </div>
                <div className="profile-name">{selectedUserData.name || 'Chưa thiết lập tên'}</div>
                <div className="profile-email">{selectedUserData.email || selectedUserId}</div>
                
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {selectedUserData.type === 'google' ? (
                    <span className="badge badge-google">Google Account</span>
                  ) : (
                    <span className="badge badge-local">Local Account</span>
                  )}
                  {selectedUserData.role === 'admin' ? (
                    <span className="badge badge-admin">ADMIN</span>
                  ) : selectedUserData.approved ? (
                    <span className="badge badge-approved">Đã Duyệt</span>
                  ) : (
                    <span className="badge badge-pending">Chờ Phê Duyệt</span>
                  )}
                </div>
              </div>

              {/* Account Details */}
              <div className="detail-group">
                <div className="detail-group-title">Chi Tiết Trạng Thái</div>
                
                <div className="detail-item">
                  <span className="detail-item-label">Duyệt hệ thống</span>
                  <span className="detail-item-value">
                    {selectedUserData.role === 'admin' ? 'Vĩnh viễn' : selectedUserData.approved ? 'Hoạt động' : 'Đang khóa'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-item-label">Quyền cấm Ôn luyện</span>
                  <span className="detail-item-value">
                    {selectedUserData.role === 'admin' ? (
                      'N/A (Admin)'
                    ) : (
                      <button
                        onClick={() => handleAction('toggle_allow_training_ban', { user_id: selectedUserId })}
                        className={`badge ${selectedUserData.allow_training_ban !== false ? 'badge-approved' : 'badge-pending'}`}
                        style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontWeight: 'bold' }}
                      >
                        {selectedUserData.allow_training_ban !== false ? 'Được phép cấm' : 'Bị chặn quyền cấm'}
                      </button>
                    )}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-item-label">Số lượng quyền</span>
                  <span className="detail-item-value" style={{ color: 'var(--primary-color)' }}>
                    {selectedUserData.role === 'admin' ? 'Tất cả' : `${selectedUserPerms.length} quyền`}
                  </span>
                </div>
              </div>

              {/* Detailed Permissions Section */}
              <div className="detail-group" style={{ marginTop: '0.75rem' }}>
                <div className="detail-group-title">Phân Quyền Hệ Thống</div>
                
                <div className="features-config-list">
                  {/* 1. Nhận điểm */}
                  <div className={`feature-config-card ${selectedUserPerms.includes('nhan_diem_thuc_hanh') ? 'active' : ''}`}>
                    <div className="feature-config-header">
                      <label className="feature-config-label">
                        <input
                          type="checkbox"
                          disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                          checked={selectedUserData.role === 'admin' || selectedUserPerms.includes('nhan_diem_thuc_hanh')}
                          onChange={() => togglePermission(selectedUserId!, 'nhan_diem_thuc_hanh')}
                          className="permission-checkbox"
                        />
                        <span className="feature-title">Nhận điểm</span>
                      </label>
                    </div>
                    
                    {/* Sub-features nested list */}
                    {(selectedUserData.role === 'admin' || selectedUserPerms.includes('nhan_diem_thuc_hanh')) && (
                      <div className="sub-features-list animate-slide-up">
                        {[
                          { key: 'chonlop', label: 'Chọn lớp' },
                          { key: 'laydiem', label: 'Lấy điểm' },
                          { key: 'chongoi', label: 'Sơ đồ ghế' },
                          { key: 'muctieu', label: 'Mục tiêu' },
                          { key: 'scoreboard', label: 'Bảng điểm GS' },
                          { key: 'excel-mode', label: 'Nhập Excel' }
                        ].map(sub => (
                          <label key={sub.key} className="sub-feature-item">
                            <input
                              type="checkbox"
                              disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                              checked={selectedUserData.role === 'admin' || selectedUserPerms.includes(sub.key)}
                              onChange={() => togglePermission(selectedUserId!, sub.key)}
                              className="permission-checkbox sub-checkbox"
                            />
                            <span className="sub-feature-title">{sub.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Trắc nghiệm */}
                  <div className={`feature-config-card ${selectedUserPerms.includes('trac_nghiem_ly_thuyet') ? 'active' : ''}`}>
                    <div className="feature-config-header">
                      <label className="feature-config-label">
                        <input
                          type="checkbox"
                          disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                          checked={selectedUserData.role === 'admin' || selectedUserPerms.includes('trac_nghiem_ly_thuyet')}
                          onChange={() => togglePermission(selectedUserId!, 'trac_nghiem_ly_thuyet')}
                          className="permission-checkbox"
                        />
                        <span className="feature-title">Trắc nghiệm</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Bài Giảng Điện Tử */}
                  <div className={`feature-config-card ${selectedUserPerms.includes('bai_giang_dien_tu') ? 'active' : ''}`}>
                    <div className="feature-config-header">
                      <label className="feature-config-label">
                        <input
                          type="checkbox"
                          disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                          checked={selectedUserData.role === 'admin' || selectedUserPerms.includes('bai_giang_dien_tu')}
                          onChange={() => togglePermission(selectedUserId!, 'bai_giang_dien_tu')}
                          className="permission-checkbox"
                        />
                        <span className="feature-title">Bài Giảng Điện Tử</span>
                      </label>
                    </div>
                  </div>

                  {/* 4. Tài Liệu Ôn Tập */}
                  <div className={`feature-config-card ${selectedUserPerms.includes('tai_lieu_on_tap') ? 'active' : ''}`}>
                    <div className="feature-config-header">
                      <label className="feature-config-label">
                        <input
                          type="checkbox"
                          disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                          checked={selectedUserData.role === 'admin' || selectedUserPerms.includes('tai_lieu_on_tap')}
                          onChange={() => togglePermission(selectedUserId!, 'tai_lieu_on_tap')}
                          className="permission-checkbox"
                        />
                        <span className="feature-title">Tài Liệu Ôn Tập</span>
                      </label>
                    </div>
                  </div>

                  {/* 5. Công cụ */}
                  <div className={`feature-config-card ${selectedUserPerms.includes('cong_cu_tien_ich') ? 'active' : ''}`}>
                    <div className="feature-config-header">
                      <label className="feature-config-label">
                        <input
                          type="checkbox"
                          disabled={selectedUserData.role === 'admin' || !selectedUserData.approved}
                          checked={selectedUserData.role === 'admin' || selectedUserPerms.includes('cong_cu_tien_ich')}
                          onChange={() => togglePermission(selectedUserId!, 'cong_cu_tien_ich')}
                          className="permission-checkbox"
                        />
                        <span className="feature-title">Công Cụ Tiện Ích</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Management & Interactions */}
              <div className="detail-actions">
                {/* Lưu quyền hạn */}
                {selectedUserData.role !== 'admin' && (
                  <button
                    onClick={() => savePermissions(selectedUserId!)}
                    disabled={!hasChanges(selectedUserId!)}
                    className="btn-detail-save flex-center"
                    style={{
                      opacity: hasChanges(selectedUserId!) ? 1 : 0.5,
                      cursor: hasChanges(selectedUserId!) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <Save size={16} /> Lưu quyền hạn
                  </button>
                )}

                {/* Duyệt / Hủy duyệt */}
                {selectedUserData.role !== 'admin' && (
                  <button
                    onClick={() => toggleApproval(selectedUserId!)}
                    className="btn-outline flex-center"
                    style={{ width: '100%', gap: '8px' }}
                  >
                    {selectedUserData.approved ? (
                      <>
                        <UserX size={16} color="#ef4444" />
                        <span>Hủy duyệt tài khoản</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} color="#16a34a" />
                        <span>Duyệt hoạt động</span>
                      </>
                    )}
                  </button>
                )}

                {/* Xóa tài khoản vĩnh viễn */}
                {selectedUserData.role !== 'admin' && (
                  <button
                    onClick={() => {
                      showConfirm(
                        'Xác nhận xóa tài khoản',
                        `Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${selectedUserData.name || selectedUserId}"? Hành động này không thể hoàn tác.`,
                        async () => {
                          await handleAction('delete_user', { user_id: selectedUserId });
                          setSelectedUserId(null);
                        },
                        'danger',
                        'Xóa vĩnh viễn'
                      );
                    }}
                    className="btn-detail-delete"
                  >
                    <Trash2 size={16} /> Xóa tài khoản vĩnh viễn
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="dp-empty">
              <HelpCircle size={40} className="dp-empty-icon" />
              <div style={{ fontWeight: 600 }}>Chưa chọn tài khoản</div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                Hãy click chọn một tài khoản từ bảng danh sách bên trái để xem chi tiết và thực thi các thao tác quản trị nâng cao.
              </p>
            </div>
          )
        }
      />

      {/* Confirm Modal */}
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

      {/* Toast Notification */}
      {toast && (
        <div className={`permissions-toast animate-slide-up ${toast.type}`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.message}
        </div>
      )}
    </>
  );
};

export default AdminPermissions;