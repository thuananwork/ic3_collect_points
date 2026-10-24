import React, { useRef, useState } from 'react';
import { loginRequest, uploadLicence } from '../api';
import './css/Login.css';

export interface LicenceInfo {
  state: string;
  message: string;
  holder?: string;
  expires?: string;
  days_left?: number;
}

export interface AuthStatus {
  authenticated: boolean;
  machine_code: string;
  licence: LicenceInfo;
}

interface LoginProps {
  status: AuthStatus;
  onChanged: () => void;
}

const errorText = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (err?.response?.status === 403 && data?.code === 'licence') return data.message || fallback;
  return fallback;
};

const Login: React.FC<LoginProps> = ({ status, onChanged }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const licenceState = status.licence.state;
  const canLogin = licenceState === 'ok';

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(status.machine_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Trình duyệt chặn clipboard: người dùng tự bôi đen mã máy để chép */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await loginRequest(username.trim(), password);
      setPassword('');
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Không đăng nhập được. Kiểm tra lại kết nối rồi thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadLicence(file);
      onChanged();
    } catch (err) {
      setError(errorText(err, 'Không đọc được file account.lic này.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lic-login-page">
      <div className="lic-card">
        <div className="lic-brand">
          <span className="lic-badge">IC3</span>
          <div>
            <h1>ic3_collect_points</h1>
            <p>Thu điểm bài thi trong phòng máy</p>
          </div>
        </div>

        {!canLogin && (
          <div className="lic-alert" role="alert">
            {status.licence.message}
          </div>
        )}

        {canLogin && (
          <form onSubmit={submit} className="lic-form">
            <label htmlFor="lic-user">Tên đăng nhập</label>
            <input
              id="lic-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            <label htmlFor="lic-pass">Mật khẩu</label>
            <input
              id="lic-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" disabled={busy || !username || !password}>
              {busy ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
            {status.licence.expires && (
              <p className="lic-hint">
                Giấy phép của {status.licence.holder || 'bạn'} dùng đến {status.licence.expires}
                {typeof status.licence.days_left === 'number' ? ` (còn ${status.licence.days_left} ngày)` : ''}.
              </p>
            )}
          </form>
        )}

        {error && (
          <div className="lic-error" role="alert">
            {error}
          </div>
        )}

        <div className="lic-machine">
          <div className="lic-machine-title">Mã máy này</div>
          <div className="lic-machine-row">
            <code>{status.machine_code}</code>
            <button type="button" className="lic-ghost" onClick={copyCode}>
              {copied ? 'Đã chép' : 'Chép'}
            </button>
          </div>
          <p className="lic-hint">Gửi mã này cho tác giả để được cấp file account.lic dùng trên máy này.</p>
        </div>

        <div className="lic-actions">
          <input ref={fileRef} type="file" accept=".lic" hidden onChange={pickFile} />
          <button type="button" className="lic-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            {canLogin ? 'Đổi file account.lic' : 'Chọn file account.lic'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
