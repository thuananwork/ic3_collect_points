import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerLocal, API_BASE_URL } from '../api';
import { Lock, User as UserIcon, Sparkles } from 'lucide-react';
import './css/Login.css';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfoMessage('');
    try {
      const res = await registerLocal({ username, password });
      setInfoMessage(res.data.message);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gửi yêu cầu đăng ký thất bại. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = API_BASE_URL + '/api/auth/login/google';
  };

  return (
    <div className="login-container mesh-bg animate-fade-in" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div className="login-split-card glass animate-slide-up" style={{ zIndex: 10, position: 'relative' }}>
        
        {/* NỬA BÊN TRÁI: Banner Minh Họa */}
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

        {/* NỬA PHẢI: Form Đăng Ký */}
        <div className="login-right">
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Đăng ký tài khoản
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Tạo tài khoản giáo viên mới để gửi yêu cầu phê duyệt.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modern-input-group">
              <input
                type="text"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="modern-input"
                required
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
                required
              />
              <Lock size={18} className="input-icon" />
            </div>

            {infoMessage && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.2)', marginBottom: '1rem' }}>
                <p style={{ color: '#16a34a', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600', margin: 0 }}>
                  {infoMessage}
                </p>
              </div>
            )}

            {error && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(185, 28, 28, 0.1)', border: '1px solid rgba(185, 28, 28, 0.2)', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600', margin: 0 }}>
                  {error}
                </p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'ĐANG GỬI YÊU CẦU...' : 'GỬI YÊU CẦU ĐĂNG KÝ'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <Link 
              to="/login"
              style={{ textDecoration: 'none', color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.82rem', letterSpacing: '0.5px' }}
            >
              ĐÃ CÓ TÀI KHOẢN? ĐĂNG NHẬP NGAY
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

export default Register;
