import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loginLocal, API_BASE_URL } from '../api';
import { Lock, User as UserIcon, Sparkles } from 'lucide-react';
import './css/Login.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Xử lý các lỗi điều hướng từ Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam === 'pending_approval') {
      setError('Tài khoản Google của bạn đang chờ Admin phê duyệt. Vui lòng liên hệ Admin!');
    } else if (errorParam === 'unauthorized') {
      setError('Tài khoản Google này chưa được cấp phép truy cập hệ thống.');
    } else if (errorParam === 'auth_failed') {
      setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
    } else if (errorParam === 'network_error') {
      setError('Không thể kết nối đến máy chủ Google (Lỗi kết nối mạng). Vui lòng kiểm tra lại đường truyền internet!');
    } else if (errorParam === 'concurrent_login') {
      setError('Tài khoản của bạn đã được đăng nhập trên một trình duyệt khác.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() && !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    if (!username.trim()) {
      setError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }
    
    setLoading(true);
    try {
      await loginLocal({ username, password });
      onLoginSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = API_BASE_URL + '/api/auth/login/google';
  };

  return (
    <div className="login-container mesh-bg animate-fade-in" style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* KHUNG SPLIT CARD */}
      <div className="login-split-card" style={{ zIndex: 10, position: 'relative' }}>

        {/* NỬA TRÁI: Banner Minh Họa */}
        <div className="login-left">
          <div style={{ position: 'absolute', top: '2.5rem', left: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', textShadow: '0 1px 4px rgba(15, 23, 42, 0.15)' }}>
              <Sparkles size={20} />
              <span style={{ fontWeight: 700, letterSpacing: '2px', fontSize: '0.85rem' }}>EDTECH PLATFORM</span>
            </div>
          </div>

          <div style={{ paddingBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ background: '#1a73e8', color: '#ffffff', padding: '8px 24px', borderRadius: '10px', fontWeight: 900, fontSize: '2rem', letterSpacing: '0.5px' }}>IC3</div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: 1.1, margin: 0, color: '#ffffff', textShadow: '0 2px 12px rgba(15, 23, 42, 0.25)' }}>
                Manager
              </h1>
            </div>
            <p style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: '500', opacity: 1, lineHeight: 1.5, maxWidth: '85%', textShadow: '0 1px 6px rgba(15, 23, 42, 0.18)' }}>
              Hệ thống quản lý điểm thi học sinh.
            </p>
          </div>
        </div>

        {/* NỬA PHẢI: Form Đăng Nhập */}
        <div className="login-right">
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Welcome MyFriend
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Vui lòng đăng nhập tài khoản giáo viên để tiếp tục.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="modern-input-group">
              <input
                type="text"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="modern-input"
              />
              <UserIcon size={18} className="input-icon" />
            </div>

            <div className="modern-input-group">
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="modern-input"
              />
              <Lock size={18} className="input-icon" />
            </div>

            {error && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.2)', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600', margin: 0 }}>
                  {error}
                </p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP HỆ THỐNG'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link 
              to="/register"
              style={{ textDecoration: 'none', color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.82rem', letterSpacing: '0.5px' }}
            >
              CHƯA CÓ TÀI KHOẢN? ĐĂNG KÝ TẠI ĐÂY
            </Link>
          </div>

          <div style={{ margin: '1.5rem 0 1rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700', letterSpacing: '1px' }}>HOẶC</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <button onClick={handleGoogleLogin} className="btn-ghost btn-google">
            <img src="https://www.google.com/favicon.ico" width={20} alt="Google" />
            TIẾP TỤC VỚI GOOGLE
          </button>
        </div>

      </div>

    </div>
  );
};

export default Login;