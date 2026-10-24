import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Award, ArrowRight, BookOpen, Laptop, FileText,
  Settings, X, Terminal,
  Lock, ChevronLeft, ChevronRight, Mail, Sparkles,
  ArrowLeft, Heart, GraduationCap, Database, ShieldAlert
} from 'lucide-react';
import './css/Home.css';

const guides = [
  {
    id: 'realtime-sync',
    title: 'Quy trình vận hành cổng thu điểm realtime',
    desc: 'Mở port lắng nghe dữ liệu ngầm và cơ chế đồng bộ điểm thi từ máy con học sinh.',
    tag: 'TUTORIAL', color: '#2563eb',
    icon: <LayoutDashboard size={40} color="#2563eb" />,
    steps: [
      'Chọn cổng vào "Nhận Điểm Thực Hành" trên thanh menu chính.',
      'Lựa chọn chính xác Khối lớp và Tên lớp thực hành thực tế (Ví dụ: Lớp 7.6).',
      'Bật trạng thái lắng nghe dữ liệu để hệ thống mở port tiếp nhận kết quả ngầm.',
      'Sử dụng phần mềm NetSupport School giao link hoặc bài thi thử xuống các máy trạm.',
      'Học sinh hoàn thành bài làm và bấm nộp bài, điểm số sẽ bay thẳng lên hiển thị lập tức.'
    ]
  },
  {
    id: 'seating-chart',
    title: 'Thiết lập & Đồng bộ Sơ đồ chỗ ngồi',
    desc: 'Gán vị trí chỗ ngồi học sinh trực quan và cơ chế tự động quét rename file dữ liệu.',
    tag: 'MANAGEMENT', color: '#0ea5e9',
    icon: <Award size={40} color="#0ea5e9" />,
    steps: [
      'Truy cập trang quản trị "Sơ Đồ Chô Ngồi" từ menu phân hệ.',
      'Kéo thả tên học sinh vào ô sơ đồ máy tính tương ứng với phòng máy thực tế.',
      'Server Python chạy ngầm tự động rename đồng bộ các file dữ liệu điểm trong quá khứ chạy theo học sinh.',
      'Bấm "Xác nhận lưu sơ đồ" để đóng gói lưu trữ cấu hình sang file JSON.'
    ]
  },
  {
    id: 'google-sheets',
    title: 'Đồng bộ dữ liệu Bảng điểm Google Sheets',
    desc: 'Liên kết API đẩy tự động điểm số của học sinh lên bảng tính đám mây.',
    tag: 'INTEGRATION', color: '#16a34a',
    icon: <Database size={40} color="#16a34a" />,
    steps: [
      'Truy cập phân hệ "Bảng điểm GS" trên menu hệ thống.',
      'Dán đường dẫn (URL) của trang Google Sheets chứa danh sách lớp.',
      'Bấm chọn lớp cần đồng bộ và nhấn "Tải điểm lên".',
      'Hệ thống sẽ tự động ghép tên học sinh, điểm số đạt được và đẩy trực tiếp lên Cloud.'
    ]
  },
  {
    id: 'target-points',
    title: 'Quản lý Target mục tiêu điểm số',
    desc: 'Đặt sàn điểm số đạt chuẩn thi quốc tế và bẫy màu cảnh báo học lực trực quan.',
    tag: 'EDUCATION', color: '#8b5cf6',
    icon: <Sparkles size={40} color="#8b5cf6" />,
    steps: [
      'Di chuyển đến trang cấu hình "Mục Tiêu" trên thanh điều hướng.',
      'Đặt mức điểm sàn đạt chuẩn thi chứng chỉ (Ví dụ: 35 câu đạt) đồng loạt hoặc đặt riêng lẻ.',
      'Giao mã đề ôn tập thi thử tương ứng (OT1 - OT5) cho buổi học thực hành hôm nay.',
      'Hệ thống tự động phân loại màu realtime trên sơ đồ: Xanh (Đạt chỉ tiêu), Vàng (Cận chuẩn), Đỏ (Yếu).'
    ]
  },
  {
    id: 'workstation-cleanup',
    title: 'Tự động hóa dọn dẹp máy trạm',
    desc: 'Hướng dẫn sử dụng Scripts tự động làm sạch ổ đĩa và thư mục học tập.',
    tag: 'AUTOMATION', color: '#f59e0b',
    icon: <Terminal size={40} color="#f59e0b" />,
    steps: [
      'Vào mục "Công Cụ Vận Hành" trên trang chủ và tải tệp tin XoaFile.bat.',
      'Gửi tệp tin xuống toàn bộ các máy con thông qua NetSupport School.',
      'Nhấn chọn "Remote Execute" (Hoặc chạy bằng quyền Administrator).',
      'Hệ thống máy con sẽ tự động xóa sạch rác, bài làm của ca trước để chuẩn bị tinh tươm cho ca sau.'
    ]
  }
];

interface HomeProps {
  user?: { id: string; name: string; role: string; permissions: string[]; };
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [sakuraPetals, setSakuraPetals] = useState<any[]>([]);

  const guideId = searchParams.get('guide');
  const selectedGuide = guides.find(g => g.id === guideId) || null;

  const [modal, setModal] = useState<{
    open: boolean; type: 'coming' | 'denied' | 'tools'; title: string; content: React.ReactNode;
  }>({ open: false, type: 'coming', title: '', content: null });

  // Khởi tạo cánh hoa anh đào rơi mượt mà lãng mạn
  useEffect(() => {
    const petals = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      size: Math.random() * 12 + 8 + 'px',
      left: Math.random() * 100 + '%',
      animationDuration: Math.random() * 8 + 8 + 's',
      animationDelay: Math.random() * 5 + 's',
    }));
    setSakuraPetals(petals);
  }, [selectedGuide]);

  // Hiệu ứng tự động chạy ngang (Auto-Scroll Carousel) cho phần Cẩm nang
  useEffect(() => {
    if (selectedGuide) return;

    const timer = setInterval(() => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          carouselRef.current.scrollBy({ left: 400, behavior: 'smooth' });
        }
      }
    }, 4500);

    return () => clearInterval(timer);
  }, [selectedGuide]);

  const hasPermission = (permission: string) => {
    if (!user) return true;
    if (user.role === 'admin') return true;
    return user.permissions.includes('all') || user.permissions.includes(permission);
  };

  const openComing = (title: string, desc: string) => {
    setModal({
      open: true,
      type: 'coming',
      title,
      content: (
        <div className="art-coming-container">
          <div className="art-coming-icon-wrapper">
            <Sparkles size={32} />
          </div>
          <p className="art-coming-text">{desc}</p>
          <div className="art-badge-coming">✨ Phân hệ đang được hoàn thiện mã nguồn</div>
          <button
            className="art-coming-btn"
            onClick={() => setModal(m => ({ ...m, open: false }))}
          >
            Trở lại Home
          </button>
        </div>
      )
    });
  };

  const openDenied = (title: string) => {
    setModal({
      open: true,
      type: 'denied',
      title: 'Giới hạn quyền truy cập',
      content: (
        <div className="art-denied-container">
          <div className="art-denied-icon-wrapper">
            <ShieldAlert size={32} />
          </div>
          <p className="art-denied-text">
            Tài khoản hiện tại chưa được cấp quyền quản trị phân hệ "<strong>{title}</strong>". Vui lòng liên hệ Admin để mở rộng cấu hình.
          </p>
          <button
            className="art-denied-btn"
            onClick={() => setModal(m => ({ ...m, open: false }))}
          >
            Trở lại Home
          </button>
        </div>
      )
    });
  };


  const scrollCarousel = (dir: 'left' | 'right') => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  };

  useEffect(() => { window.scrollTo(0, 0); }, [selectedGuide]);

  const features = [
    {
      title: 'Nhận Điểm Thực Hành',
      desc: 'Đồng bộ kết quả thi thử realtime trực tiếp từ ứng dụng máy học sinh.',
      icon: <LayoutDashboard size={24} />, permission: 'nhan_diem_thuc_hanh', active: true,
      theme: 'sky-primary', onClick: () => navigate('/choose-school')
    },
    {
      title: 'Trắc Nghiệm Lý Thuyết',
      desc: 'Giao đề trực tuyến xuống máy trạm, tự động chấm và phân tích phổ điểm.',
      icon: <BookOpen size={24} />, permission: 'trac_nghiem_ly_thuyet', active: true,
      theme: 'sky-light', onClick: () => {
        if (user?.role === 'admin') {
          navigate('/admin/quizzes');
        } else {
          navigate('/teacher/quizzes');
        }
      }
    },
    {
      title: 'Bài Giảng Điện Tử',
      desc: 'Kho lưu trữ và chia sẻ slide học liệu tương tác thông minh xuống máy con.',
      icon: <Laptop size={24} />, permission: 'bai_giang_dien_tu', active: false,
      theme: 'sky-light', onClick: () => openComing('Bài Giảng Điện Tử', 'Phân hệ phân phối slide học liệu trực tuyến đang trong giai đoạn thử nghiệm phòng máy.')
    },
    {
      title: 'Tài Liệu Ôn Tập',
      desc: 'Ngân hàng đề cương ôn luyện lõi bám sát chứng chỉ quốc tế IC3 Spark.',
      icon: <FileText size={24} />, permission: 'tai_lieu_on_tap', active: false,
      theme: 'sky-light', onClick: () => openComing('Tài Liệu Ôn Tập', 'Thư viện tài liệu cẩm nang ôn tập tin học quốc tế sẽ sớm được cập nhật.')
    },
    {
      title: 'Công Cụ Vận Hành',
      desc: 'Bộ tiện ích batch script quản trị hệ thống phòng máy LAN tự động.',
      icon: <Settings size={24} />, permission: 'cong_cu_tien_ich', active: true,
      theme: 'sky-accent', onClick: () => navigate('/operation-tools')
    }
  ];


  if (selectedGuide) {
    return (
      <div className="art-article-page animate-fade-in">
        <div className="art-sakura-container">
          {sakuraPetals.map((p) => (
            <div key={p.id} className="sakura-petal" style={{ width: p.size, height: p.size, left: p.left, animationDuration: p.animationDuration, animationDelay: p.animationDelay }}></div>
          ))}
        </div>

        <div className="art-article-container">
          <button className="art-back-btn" onClick={() => setSearchParams({})}>
            <ArrowLeft size={16} /> Trở về không gian trang chủ
          </button>

          <div className="art-article-header">
            <span className="art-article-tag" style={{ color: selectedGuide.color }}>{selectedGuide.tag}</span>
            <h1>{selectedGuide.title}</h1>
            <p>{selectedGuide.desc}</p>
          </div>

          <div className="art-article-content">
            <div className="art-article-title-sm">Cẩm nang triển khai chi tiết:</div>
            <div className="art-timeline">
              {selectedGuide.steps.map((step: string, idx: number) => (
                <div key={idx} className="art-timeline-item">
                  <div className="art-timeline-dot" style={{ backgroundColor: selectedGuide.color }}></div>
                  <div className="art-timeline-content">
                    <h4>Hạng mục bước {idx + 1}</h4>
                    <p>{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="art-home-wrapper">

      {/* KHỐI CÁNH HOA ANH ĐÀO RƠI XUYÊN SUỐT NỀN WEB */}
      <div className="art-sakura-container">
        {sakuraPetals.map((p) => (
          <div key={p.id} className="sakura-petal" style={{ width: p.size, height: p.size, left: p.left, animationDuration: p.animationDuration, animationDelay: p.animationDelay }}></div>
        ))}
      </div>

      {/* 1. HERO SECTION */}
      <section className="art-hero">
        <div className="art-hero-content">
          <div className="art-hero-badge">
            <GraduationCap size={14} /> IC3 CLASSROOM MANAGER
          </div>
          <h1>
            Xin chào, <br />
            <span className="text-highlight">Thầy {user?.name || 'Nguyễn Thuận An'}</span>
          </h1>
          <p>Hệ thống điều hướng tác vụ phòng máy thực hành Tin học. Vui lòng nhấp chọn một phân hệ chuyên mục bên dưới để bắt đầu chuỗi công tác quản trị.</p>
        </div>
      </section>

      {/* 2. CATEGORY PORTALS */}
      <section className="art-features-section">
        <div className="art-section-heading">
          <h2>Danh mục tác vụ chính</h2>
          <div className="art-heading-line"></div>
        </div>

        <div className="art-features-grid">
          {features.map((f, i) => {
            const permitted = hasPermission(f.permission);
            const isLocked = f.active && !permitted;
            const isComing = !f.active;

            return (
              <div
                key={i}
                className={`art-feature-card theme-${f.theme} ${isLocked ? 'is-locked' : ''}`}
                onClick={() => {
                  if (isLocked) openDenied(f.title);
                  else f.onClick();
                }}
              >
                <div className="art-card-decor"></div>

                <div className="art-card-header">
                  <div className="art-card-icon">{f.icon}</div>
                  {!f.active ? (
                    <span className="art-status-pill pill-dev">Bản dựng</span>
                  ) : isLocked ? (
                    <span className="art-status-pill pill-locked"><Lock size={10} /> Khóa</span>
                  ) : (
                    <span className="art-status-pill pill-active">Sẵn sàng</span>
                  )}
                </div>

                <div className="art-card-body">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>

                <div className="art-card-footer">
                  <span>{isLocked ? 'Yêu cầu cấp quyền' : isComing ? 'Xem tiến trình dựng' : 'Mở phân hệ'}</span>
                  <ArrowRight size={14} className="arrow-move" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. MAGAZINE CAROUSEL (NỔI BẬT VÀ TO HƠN) */}
      <section className="art-magazine-section">
        <div className="art-section-heading">
          <h2>Cẩm nang nghiệp vụ sư phạm</h2>
          <div className="art-heading-line"></div>
        </div>

        <div className="art-magazine-nav">
          <button aria-label="Slide trước" onClick={() => scrollCarousel('left')}><ChevronLeft size={16} /></button>
          <button aria-label="Slide sau" onClick={() => scrollCarousel('right')}><ChevronRight size={16} /></button>
        </div>

        <div className="art-magazine-track" ref={carouselRef}>
          {guides.map((g, i) => (
            <div key={i} className="art-guide-post" onClick={() => setSearchParams({ guide: g.id })}>
              <div className="art-post-header">
                <div className="art-post-icon" style={{ backgroundColor: `${g.color}15`, color: g.color }}>
                  {React.cloneElement(g.icon as React.ReactElement<any>, { size: 22 })}
                </div>
                <span className="art-post-tag" style={{ color: g.color, backgroundColor: `${g.color}15` }}>{g.tag}</span>
              </div>
              <div className="art-post-content">
                <h4>{g.title}</h4>
                <p>{g.desc}</p>
              </div>
              <div className="art-post-footer">
                <span>Đọc bài viết</span>
                <ArrowRight size={14} className="arrow-move" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CONTACT & FOOTER */}
      <section className="art-contact-section">
        <div className="art-contact-box">
          <div className="art-contact-decor-ring"></div>
          <div className="art-contact-left">
            <Heart size={32} className="heart-pulse" color="#f43f5e" />
            <div>
              <h3>Hòm thư tiếp nhận & Đóng góp ý kiến</h3>
              <p>Mọi câu hỏi phản hồi kỹ thuật hoặc đề xuất phát triển công cụ mới, vui lòng gửi thư:</p>
            </div>
          </div>
          <a href="mailto:thuanan524@gmail.com" className="art-contact-btn">
            <Mail size={16} /> thuanan524@gmail.com
          </a>
        </div>
      </section>

      <footer className="art-footer">
        <p>IC3 Manager System © 2026 • Designed with creativity by Nguyễn Thuận An</p>
      </footer>

      {/* MODALS */}
      {modal.open && (
        <div className="art-modal-overlay" onClick={() => setModal(m => ({ ...m, open: false }))}>
          <div className="art-modal-content" onClick={e => e.stopPropagation()}>
            <button className="art-modal-close" onClick={() => setModal(m => ({ ...m, open: false }))}>
              <X size={18} />
            </button>
            <h3 className="art-modal-title">{modal.title}</h3>
            {modal.content}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;