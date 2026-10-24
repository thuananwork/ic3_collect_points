import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, Grid, Users, Target, Map, Sun, Moon, LayoutDashboard, FileText, ShieldAlert, BookOpen, Terminal, Dumbbell } from 'lucide-react';
import { getAuthStatus, logout, API_BASE_URL, toggleClassPractice, getTeacherClassesPractice } from './api';
import ConfirmModal from './components/ConfirmModal';
import { useConfirmModal } from './hooks/useConfirmModal';


// Components
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ClassSelector from './pages/ClassSelector';
import SchoolSelector from './pages/SchoolSelector';
import Dashboard from './pages/Dashboard';
import SeatingChart from './pages/SeatingChart';
import StudentTargets from './pages/StudentTargets';
import AdminPermissions from './pages/admin/AdminPermissions';
import AdminQuizzes from './pages/admin/AdminQuizzes';
import AdminQuestions from './pages/admin/AdminQuestions';
import AdminArticles from './pages/admin/AdminArticles';
import GoogleScoreboard from './pages/GoogleScoreboard';
import ExcelInput from './pages/ExcelInput';
import Profile from './pages/Profile';
import TeacherQuizzes from './pages/TeacherQuizzes';
import QuizPortal from './pages/QuizPortal';
import StudentPortal from './pages/StudentPortal';
import OperationTools from './pages/OperationTools';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  avatar_url?: string;
}

interface ProtectedRouteProps {
  user: User | null;
  permission: string;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, permission, children }) => {
  if (!user) return <Navigate to="/login" replace />;

  // Nếu là Admin cố tình vào trang thu thập điểm của User -> Trả về trang Admin Console
  if (user.role === 'admin') {
    return <Navigate to="/admin/users" replace />;
  }

  // Check quyền cho tài khoản giáo viên thông thường
  const subPermissions = ['chonlop', 'laydiem', 'chongoi', 'muctieu', 'scoreboard', 'excel-mode'];
  const hasParentPermission = !subPermissions.includes(permission) || user.permissions.includes('nhan_diem_thuc_hanh');

  if (user.permissions.includes('all') || (hasParentPermission && user.permissions.includes(permission))) {
    return <>{children}</>;
  }

  // Map permission key to friendly Vietnamese name
  const getPermissionLabel = (p: string) => {
    switch (p) {
      case 'nhan_diem_thuc_hanh':
      case 'chonlop':
      case 'laydiem':
      case 'chongoi':
      case 'muctieu':
      case 'scoreboard':
      case 'excel-mode':
        return 'Nhận Điểm Thực Hành';
      case 'trac_nghiem_ly_thuyet':
        return 'Trắc Nghiệm Lý Thuyết';
      case 'bai_giang_dien_tu':
        return 'Bài Giảng Điện Tử';
      case 'tai_lieu_on_tap':
        return 'Tài Liệu Ôn Tập';
      case 'cong_cu_tien_ich':
        return 'Công Cụ Tiện Ích';
      default:
        return 'Phân Hệ Quản Trị';
    }
  };

  return (
    <div className="flex-center" style={{ height: '70vh', padding: '2rem' }}>
      <div className="glass animate-slide-up" style={{
        maxWidth: '500px',
        padding: '2.5rem 2rem',
        borderRadius: '16px',
        border: '1.5px solid rgba(239, 68, 68, 0.25)',
        background: 'rgba(255, 255, 255, 0.75)',
        boxShadow: '0 10px 30px -10px rgba(239, 68, 68, 0.08)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        boxSizing: 'border-box'
      }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.5rem'
        }}>
          <ShieldAlert size={36} />
        </div>
        
        <h2 style={{
          fontWeight: 800,
          fontSize: '1.4rem',
          color: '#1e293b',
          margin: 0,
          letterSpacing: '-0.02em'
        }}>
          Giới hạn quyền truy cập
        </h2>
        
        <p style={{
          color: '#475569',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          margin: '0 0 1rem 0'
        }}>
          Tài khoản hiện tại chưa được cấp quyền quản trị phân hệ "<strong>{getPermissionLabel(permission)}</strong>". Vui lòng liên hệ Admin để mở rộng cấu hình.
        </p>
        
        <Link 
          to="/" 
          className="btn-primary flex-center" 
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.65rem 2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            borderRadius: '8px',
            background: 'var(--primary-color)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
            transition: 'all 0.2s ease',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          Quay lại Trang chủ
        </Link>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const isNhanDiemFlow = ['/choose-school', '/choose-class', '/dashboard', '/seating', '/targets', '/scoreboard', '/excel-mode', '/teacher/quizzes'].includes(location.pathname);

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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  // Avatar dropdown state
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);



  // Practice mode modal states
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceGrades, setPracticeGrades] = useState<{ grade: number; enabled: boolean; count: number; sampleClassId?: number }[]>([]);
  const [practiceLoading, setPracticeLoading] = useState<number | null>(null);

  useEffect(() => {
    if (window.location.hostname === 'localhost') {
      const newUrl = window.location.href.replace('//localhost', '//127.0.0.1');
      window.location.replace(newUrl);
      return;
    }
    checkAuth();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Click outside to close avatar menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarMenu]);



  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const checkAuth = async () => {
    try {
      const res = await getAuthStatus();
      if (res.data.authenticated) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { modalConfig, showConfirm, closeConfirmModal } = useConfirmModal();

  const handleLogout = async () => {
    setShowAvatarMenu(false);
    showConfirm(
      'Đăng xuất tài khoản',
      'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống IC3 Manager?',
      async () => {
        await logout();
        localStorage.removeItem('active_school_id');
        setUser(null);
        window.location.href = '/login';
      },
      'info',
      'Đăng xuất'
    );
  };



  const handleOpenPracticeModal = async () => {
    setShowAvatarMenu(false);
    setShowPracticeModal(true);
    try {
      const res = await getTeacherClassesPractice();
      const classesData: Array<{ class_id: number; class_name: string; grade_level: number; practice_enabled: boolean }> = res.data;
      
      const gradeMap: Record<number, { totalClasses: number; enabledCount: number; sampleClassId: number }> = {};
      for (const c of classesData) {
        const g = c.grade_level;
        if (!gradeMap[g]) {
          gradeMap[g] = { totalClasses: 0, enabledCount: 0, sampleClassId: c.class_id };
        }
        gradeMap[g].totalClasses++;
        if (c.practice_enabled) {
          gradeMap[g].enabledCount++;
        }
      }
      
      const grades = Object.entries(gradeMap)
        .map(([g, info]) => ({
          grade: Number(g),
          enabled: info.enabledCount > 0,
          count: info.totalClasses,
          sampleClassId: info.sampleClassId
        }))
        .sort((a, b) => a.grade - b.grade);
      setPracticeGrades(grades);
    } catch (err) {
      console.error('Lỗi tải dữ liệu practice:', err);
    }
  };

  const handleTogglePracticeGrade = async (grade: number, enable: boolean) => {
    setPracticeLoading(grade);
    try {
      const gradeInfo = practiceGrades.find(g => g.grade === grade);
      if (gradeInfo && gradeInfo.sampleClassId) {
        await toggleClassPractice(gradeInfo.sampleClassId, {
          practice_enabled: enable,
          scope: 'grade'
        });
        setPracticeGrades(prev => prev.map(g => g.grade === grade ? { ...g, enabled: enable } : g));
      }
    } catch (err) {
      console.error('Lỗi toggle practice:', err);
    } finally {
      setPracticeLoading(null);
    }
  };

  // Lấy chữ cái đầu của tên để làm Avatar
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Đang tải IC3 Manager...</div>;

  return (
    <>
    <div className="app-container">
      {user && location.pathname !== '/portal' && (
        <nav className="glass" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link to={user.role === 'admin' ? "/admin/users" : "/"} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <div style={{ background: 'var(--primary-color)', color: 'white', padding: '6px 12px', borderRadius: '6px', fontWeight: 800, fontSize: '14px', letterSpacing: '0.5px' }}>IC3</div>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Manager</span>
            </Link>
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
              {user.role === 'admin' ? (
                <>
                  <NavLink to="/admin/users" style={getNavLinkStyle}><Users size={16} /> Quyền & Tài khoản</NavLink>
                  <NavLink to="/admin/quizzes" style={getNavLinkStyle}><FileText size={16} /> Quản lý Đề thi</NavLink>
                  <NavLink to="/admin/articles" style={getNavLinkStyle}><BookOpen size={16} /> Quản lý Bài viết</NavLink>
                </>
              ) : (
                isNhanDiemFlow && (
                  <>
                    {['/dashboard', '/seating', '/targets', '/scoreboard', '/excel-mode', '/teacher/quizzes'].includes(location.pathname) && (
                      <NavLink to="/dashboard" style={getNavLinkStyle}>
                        <LayoutDashboard size={16} /> Dashboard
                      </NavLink>
                    )}
                    {(user.permissions.includes('all') || (user.permissions.includes('nhan_diem_thuc_hanh') && user.permissions.includes('chonlop'))) && (
                      <NavLink to={localStorage.getItem('active_school_id') ? `/choose-class?school_id=${localStorage.getItem('active_school_id')}` : "/choose-school"} style={getNavLinkStyle}>
                        <Grid size={16} /> Chọn lớp
                      </NavLink>
                    )}
                    {(user.permissions.includes('all') || (user.permissions.includes('nhan_diem_thuc_hanh') && user.permissions.includes('chongoi'))) && (
                      <NavLink to="/seating" style={getNavLinkStyle}><Map size={16} /> Chỗ ngồi</NavLink>
                    )}
                    {(user.permissions.includes('all') || (user.permissions.includes('nhan_diem_thuc_hanh') && user.permissions.includes('muctieu'))) && (
                      <NavLink to="/targets" style={getNavLinkStyle}><Target size={16} /> Mục tiêu</NavLink>
                    )}
                  </>
                )
              )}
            </div>
            <div id="dashboard-navbar-portal" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: '1rem' }}></div>
          </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button onClick={toggleTheme} className="btn-ghost flex-center" style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              {/* Avatar Dropdown (Facebook style) */}
              <div ref={avatarMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  className="nav-avatar-btn"
                  title={user.name}
                >
                  <div className="nav-avatar-circle" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE_URL}${user.avatar_url}`} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                </button>

                {showAvatarMenu && (
                  <div className="nav-avatar-dropdown">
                    <div className="nav-avatar-dropdown-header">
                      <div className="nav-avatar-circle-lg" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE_URL}${user.avatar_url}`} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          getInitials(user.name)
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.email || user.id}</div>
                      </div>
                    </div>
                    <div className="nav-avatar-dropdown-sep"></div>
                    <Link
                      to="/profile"
                      className="nav-avatar-dropdown-item"
                      onClick={() => setShowAvatarMenu(false)}
                    >
                      <UserIcon size={16} /> Hồ sơ cá nhân
                    </Link>
                    {user.role !== 'admin' && (
                      <>


                        {(user.permissions.includes('all') || user.permissions.includes('cong_cu_tien_ich')) && (
                          <Link
                            to="/operation-tools"
                            className="nav-avatar-dropdown-item"
                            onClick={() => setShowAvatarMenu(false)}
                          >
                            <Terminal size={16} /> Công cụ vận hành
                          </Link>
                        )}
                        {(user.permissions.includes('all') || user.permissions.includes('trac_nghiem_ly_thuyet')) && (
                          <button
                            className="nav-avatar-dropdown-item"
                            onClick={handleOpenPracticeModal}
                            style={{ border: 'none', background: 'transparent', width: '100%', cursor: 'pointer' }}
                          >
                            <Dumbbell size={16} /> Chế độ Luyện tập
                          </button>
                        )}
                      </>
                    )}
                    <button
                      className="nav-avatar-dropdown-item nav-avatar-dropdown-danger"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </nav>
        )}

        {/* Simple Theme Toggle for Login Page if not logged in */}
        {!user && ['/login', '/register'].includes(location.pathname) && (
          <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100 }}>
            <button onClick={toggleTheme} className="glass flex-center" style={{ width: '45px', height: '45px', padding: 0, borderRadius: '50%' }}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        )}

        <main key={location.pathname} className={`${(user || !['/login', '/register'].includes(location.pathname)) ? "app-main-content" : "login-container"} animate-fade-in`}>
          <Routes>
            <Route path="/login" element={!user ? <Login onLoginSuccess={checkAuth} /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

            {/* Định tuyến chính cho User thường */}
            <Route path="/" element={
              user ? (
                user.role === 'admin' ? <Navigate to="/admin/users" replace /> : (
                  <Home user={user} />
                )
              ) : <QuizPortal />
            } />
             <Route path="/level/:levelId" element={
              user ? (
                user.role === 'admin' ? <Navigate to="/admin/users" replace /> : (
                  <Navigate to="/" replace />
                )
              ) : <QuizPortal />
            } />
            <Route path="/results/:attemptId" element={<QuizPortal />} />
            <Route path="/level/:levelId/results/:attemptId" element={<QuizPortal />} />
            <Route path="/choose-school" element={user ? <ProtectedRoute user={user} permission="chonlop"><SchoolSelector /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/choose-class" element={user ? <ProtectedRoute user={user} permission="chonlop"><ClassSelector /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/dashboard" element={user ? <ProtectedRoute user={user} permission="laydiem"><Dashboard /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/seating" element={user ? <ProtectedRoute user={user} permission="chongoi"><SeatingChart /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/targets" element={user ? <ProtectedRoute user={user} permission="muctieu"><StudentTargets /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/scoreboard" element={user ? <ProtectedRoute user={user} permission="scoreboard"><GoogleScoreboard /></ProtectedRoute> : <Navigate to="/login" replace />} />
            <Route path="/excel-mode" element={user ? <ProtectedRoute user={user} permission="excel-mode"><ExcelInput /></ProtectedRoute> : <Navigate to="/login" replace />} />

            {/* Định tuyến chính cho Admin */}
            <Route path="/admin/users" element={
              user ? (
                user.role === 'admin' ? <AdminPermissions /> : <Navigate to="/" replace />
              ) : <Navigate to="/login" replace />
            } />
            <Route path="/admin/quizzes" element={
              user ? (
                user.role === 'admin' ? <AdminQuizzes /> : <Navigate to="/" replace />
              ) : <Navigate to="/login" replace />
            } />
            <Route path="/admin/articles" element={
              user ? (
                user.role === 'admin' ? <AdminArticles /> : <Navigate to="/" replace />
              ) : <Navigate to="/login" replace />
            } />
            <Route path="/admin/quizzes/:quizId/questions" element={
              user ? (
                user.role === 'admin' ? <AdminQuestions /> : <Navigate to="/" replace />
              ) : <Navigate to="/login" replace />
            } />

            {/* Định tuyến cho Giáo viên giao đề */}
            <Route path="/teacher/quizzes" element={
              user ? <ProtectedRoute user={user} permission="trac_nghiem_ly_thuyet"><TeacherQuizzes user={user} /></ProtectedRoute> : <Navigate to="/login" replace />
            } />

            {/* Định tuyến cho Phân hệ Công cụ Vận hành */}
            <Route path="/operation-tools" element={
              user ? <ProtectedRoute user={user} permission="cong_cu_tien_ich"><OperationTools /></ProtectedRoute> : <Navigate to="/login" replace />
            } />

            {/* Định tuyến tự do cho Học sinh làm bài */}
            <Route path="/portal" element={<StudentPortal />} />
            
            <Route path="/profile" element={user ? <Profile user={user} onUpdateUser={setUser} /> : <Navigate to="/login" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>


      </div>

      {/* Practice Mode Modal */}
      {showPracticeModal && (
        <div className="practice-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPracticeModal(false); }}>
          <div className="practice-modal glass animate-scale-in">
            <div className="practice-modal-header">
              <div className="practice-modal-icon">
                <Dumbbell size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Chế độ Luyện tập (Practice)</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Bật/tắt cho phép học sinh tự luyện tập theo từng khối</span>
              </div>
            </div>

            <div className="practice-modal-body">
              {practiceGrades.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem 0' }}>Không có đề thi nào được phân khối.</p>
              ) : (
                <div className="practice-grade-list">
                  {practiceGrades.map(({ grade, enabled, count }) => (
                    <div key={grade} className={`practice-grade-item ${enabled ? 'active' : ''}`}>
                      <div className="practice-grade-info">
                        <span className="practice-grade-label">Khối {grade}</span>
                        <span className="practice-grade-count">{count} đề thi</span>
                      </div>
                      <button
                        className={`practice-toggle-btn ${enabled ? 'on' : 'off'}`}
                        onClick={() => handleTogglePracticeGrade(grade, !enabled)}
                        disabled={practiceLoading === grade}
                      >
                        <span className="practice-toggle-knob" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="practice-modal-footer">
              <button onClick={() => setShowPracticeModal(false)} className="btn-modal-secondary" style={{ width: '100%', borderRadius: '10px', padding: '10px' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeConfirmModal}
        confirmText={modalConfig.confirmText}
      />


    </>
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
