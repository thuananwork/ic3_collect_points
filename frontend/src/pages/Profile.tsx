import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Key, UserCheck, Shield, ChevronLeft, Save, AlertCircle, Camera } from 'lucide-react';
import { updateProfile, uploadAvatar, API_BASE_URL } from '../api';
import './css/Profile.css';

interface ProfileProps {
  user: any;
  onUpdateUser: (newUser: any) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) {
    return (
      <div className="profile-container">
        <div className="flex-center" style={{ color: 'var(--text-secondary)' }}>
          Vui lòng đăng nhập để xem hồ sơ cá nhân.
        </div>
      </div>
    );
  }

  // Lấy chữ cái đầu của tên để làm Avatar
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Kiểm tra kích thước file (tối đa 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.' });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setLoading(true);
    setMessage(null);

    try {
      const response = await uploadAvatar(formData);
      if (response.data.status === 'success') {
        setMessage({ type: 'success', text: response.data.message });
        
        // Cập nhật trạng thái người dùng
        const updatedUser = {
          ...user,
          avatar_url: response.data.avatar_url
        };
        onUpdateUser(updatedUser);
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Cập nhật ảnh đại diện thất bại.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể tải ảnh lên. Định dạng file có thể không hợp lệ.'
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Tên hiển thị không được để trống.' });
      return;
    }

    if (password) {
      if (password.length < 6) {
        setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Mật khẩu xác nhận không trùng khớp.' });
        return;
      }
    }

    setLoading(true);
    try {
      const response = await updateProfile({
        name: name.trim(),
        ...(password ? { password } : {})
      });

      if (response.data.status === 'success') {
        setMessage({ type: 'success', text: response.data.message });
        // Cập nhật state User toàn cục
        onUpdateUser(response.data.user);
        // Reset ô mật khẩu
        setPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Có lỗi xảy ra.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Cập nhật thất bại. Vui lòng kiểm tra kết nối.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (user.role === 'admin') {
      navigate('/admin/users');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card-wrapper">
        {/* Banner đầu trang cá nhân */}
        <div className="profile-hero">
          <div className="profile-avatar-large" onClick={handleAvatarClick} title="Nhấn để thay đổi ảnh đại diện">
            {user.avatar_url ? (
              <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE_URL}${user.avatar_url}`} alt={name || user.name} />
            ) : (
              getInitials(name || user.name)
            )}
            <div className="profile-avatar-overlay">
              <Camera size={18} />
              <span>Đổi ảnh</span>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*" 
          />
          <h2>{name || user.name}</h2>
          <p>{user.email || user.id}</p>
          
          <div className="profile-badges-row">
            <span className={`profile-badge role-${user.role}`}>
              {user.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}
            </span>
            <span className={`profile-badge type-${user.type || 'local'}`}>
              {user.type === 'google' ? 'Google Account' : 'Tài khoản nội bộ'}
            </span>
          </div>
        </div>

        {/* Form chi tiết */}
        <div className="profile-content">
          {message && (
            <div 
              className={`flex-center`} 
              style={{ 
                padding: '0.85rem', 
                borderRadius: '8px', 
                marginBottom: '1.25rem', 
                fontSize: '0.9rem',
                fontWeight: 600,
                gap: '8px',
                background: message.type === 'success' ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: message.type === 'success' ? '1px solid #16a34a' : '1px solid #ef4444',
                color: message.type === 'success' ? '#16a34a' : '#ef4444'
              }}
            >
              {message.type === 'error' ? <AlertCircle size={18} /> : <UserCheck size={18} />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-form">
            {/* Tên đăng nhập (Read Only) */}
            <div className="profile-form-group">
              <label>Tên Đăng Nhập / Email</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon"><User size={18} /></span>
                <input 
                  type="text" 
                  value={user.email || user.id} 
                  disabled 
                  className="profile-input" 
                />
              </div>
            </div>

            {/* Họ và Tên */}
            <div className="profile-form-group">
              <label>Họ và Tên Hiển Thị</label>
              <div className="profile-input-wrapper">
                <span className="profile-input-icon"><UserCheck size={18} /></span>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="profile-input" 
                  placeholder="Nhập họ và tên hiển thị..."
                  required
                />
              </div>
            </div>

            {/* Đổi mật khẩu (chỉ hiển thị cho tài khoản Local) */}
            {user.type !== 'google' && (
              <>
                <div style={{ margin: '8px 0 2px 0', borderBottom: '1px solid var(--border-color)' }}></div>
                
                <div className="profile-form-group">
                  <label>Mật Khẩu Mới (Bỏ trống nếu không đổi)</label>
                  <div className="profile-input-wrapper">
                    <span className="profile-input-icon"><Key size={18} /></span>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="profile-input" 
                      placeholder="Mật khẩu mới (từ 6 ký tự trở lên)..."
                    />
                  </div>
                </div>

                <div className="profile-form-group">
                  <label>Xác Nhận Mật Khẩu Mới</label>
                  <div className="profile-input-wrapper">
                    <span className="profile-input-icon"><Shield size={18} /></span>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="profile-input" 
                      placeholder="Nhập lại mật khẩu mới để xác nhận..."
                    />
                  </div>
                </div>
              </>
            )}

            {/* Nút hành động */}
            <div className="profile-actions">
              <button 
                type="button" 
                onClick={handleBack} 
                className="profile-btn-back"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ChevronLeft size={18} /> Quay lại
                </div>
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="profile-btn-save"
              >
                <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
