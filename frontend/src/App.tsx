import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom';
import { Grid, Target, Map, Sun, Moon, LayoutDashboard, LogOut, Table2 } from 'lucide-react';
import { getAuthStatus, logoutRequest } from './api';
import Login from './pages/Login';
import type { AuthStatus } from './pages/Login';

// Kept Pages
import SchoolSelector from './pages/SchoolSelector';
import ClassSelector from './pages/ClassSelector';
import Dashboard from './pages/Dashboard';
import SeatingChart from './pages/SeatingChart';
import StudentTargets from './pages/StudentTargets';
import Sheet from './pages/Sheet';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

const DEFAULT_TEACHER: User = {
  id: '1',
  name: 'Giáo viên',
  email: 'teacher@ic3.local',
  role: 'teacher',
  permissions: ['all', 'chonlop', 'laydiem', 'chongoi', 'muctieu', 'nhan_diem_thuc_hanh'],
};

interface ProtectedRouteProps {
  user: User | null;
  permission: string;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, permission, children }) => {
  if (!user) return <div className="flex-center" style={{ height: '70vh' }}>Đang tải...</div>;

  const subPermissions = ['chonlop', 'laydiem', 'chongoi', 'muctieu'];
  const hasParentPermission = !subPermissions.includes(permission) || user.permissions.includes('nhan_diem_thuc_hanh');

  if (user.permissions.includes('all') || (hasParentPermission && user.permissions.includes(permission))) {
    return <>{children}</>;
  }

  return (
    <div className="flex-center" style={{ height: '70vh', padding: '2rem' }}>
      <div className="glass animate-slide-up" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Giới hạn quyền truy cập</h2>
        <p>Tài khoản hiện tại chưa được cấp quyền ({permission}).</p>
        <Link to="/choose-school" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
          Quay lại chọn trường
        </Link>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();

  const getNavLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
    fontWeight: isActive ? 700 : 500,
    whiteSpace: 'nowrap' as const,
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
    flexShrink: 0,
  });

  const [user, setUser] = useState<User>(DEFAULT_TEACHER);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (window.location.hostname === 'localhost') {
      const newUrl = window.location.href.replace('//localhost', '//127.0.0.1');
      window.location.replace(newUrl);
      return;
    }
    checkAuth();
    const onAuthRequired = () => checkAuth();
    window.addEventListener('ic3-auth-required', onAuthRequired);
    return () => window.removeEventListener('ic3-auth-required', onAuthRequired);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const checkAuth = async () => {
    try {
      const res = await getAuthStatus();
      setAuth(res.data);
      if (res.data && res.data.authenticated && res.data.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Lỗi kiểm tra xác thực:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } finally {
      await checkAuth();
    }
  };

  if (!auth) {
    return <div className="flex-center" style={{ height: '100vh' }}>Đang tải...</div>;
  }
  if (!auth.authenticated) {
    return <Login status={auth} onChanged={checkAuth} />;
  }
  const daysLeft = auth.licence.days_left;

  return (
    <div className="app-container">
      <nav
        className="glass"
        style={{
          margin: 0,
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/choose-school" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div
              style={{
                background: 'var(--primary-color)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '14px',
                letterSpacing: '0.5px',
              }}
            >
              IC3
            </div>
            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Manager</span>
          </Link>
          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
            <NavLink to="/dashboard" style={getNavLinkStyle}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink
              to={
                localStorage.getItem('active_school_id')
                  ? `/choose-class?school_id=${localStorage.getItem('active_school_id')}`
                  : '/choose-school'
              }
              style={getNavLinkStyle}
            >
              <Grid size={16} /> Chọn lớp
            </NavLink>
            <NavLink to="/seating" style={getNavLinkStyle}>
              <Map size={16} /> Chỗ ngồi
            </NavLink>
            <NavLink to="/targets" style={getNavLinkStyle}>
              <Target size={16} /> Mục tiêu
            </NavLink>
            <NavLink to="/sheet" style={getNavLinkStyle}>
              <Table2 size={16} /> Danh sách
            </NavLink>
          </div>
          <div id="dashboard-navbar-portal" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: '1rem' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {typeof daysLeft === 'number' && daysLeft <= 14 && (
            <span
              title={`Giấy phép hết hạn ngày ${auth.licence.expires}`}
              style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a50e0e', background: '#fce8e6', padding: '4px 10px', borderRadius: '999px' }}
            >
              Còn {Math.max(daysLeft, 0)} ngày
            </span>
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {user.name}
          </span>
          <button
            onClick={handleLogout}
            className="btn-ghost flex-center"
            style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className="btn-ghost flex-center"
            style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
            title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </nav>

      <main key={location.pathname} className="app-main-content animate-fade-in">
        <Routes>
          <Route path="/" element={<Navigate to="/choose-school" replace />} />
          <Route
            path="/choose-school"
            element={
              <ProtectedRoute user={user} permission="chonlop">
                <SchoolSelector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/choose-class"
            element={
              <ProtectedRoute user={user} permission="chonlop">
                <ClassSelector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user} permission="laydiem">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seating"
            element={
              <ProtectedRoute user={user} permission="chongoi">
                <SeatingChart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/targets"
            element={
              <ProtectedRoute user={user} permission="muctieu">
                <StudentTargets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sheet"
            element={
              <ProtectedRoute user={user} permission="laydiem">
                <Sheet />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/choose-school" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
