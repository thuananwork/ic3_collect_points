import { useState, useEffect } from 'react';

export const useDevToolsBlocker = (isPreview: boolean = false) => {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  useEffect(() => {
    // 0. Vượt qua (Bypass) nếu:
    // - Đang chạy local (localhost hoặc 127.0.0.1)
    // - Chế độ preview/giáo viên/admin (isPreview = true)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal || isPreview) {
      setIsDevToolsOpen(false);
      return;
    }

    // 1. Chặn menu chuột phải (contextmenu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // 2. Chặn các tổ hợp phím tắt mở DevTools và Xem mã nguồn
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      
      // Ctrl+Shift+I, J, C hoặc Cmd+Opt+I, J, C (macOS)
      const isInspectKeys = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c');
      const isMacInspectKeys = e.altKey && (e.metaKey || e.ctrlKey) && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c');
      
      // Ctrl+U / Cmd+U (Xem mã nguồn - View Source)
      const isViewSource = (e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u');

      if (isInspectKeys || isMacInspectKeys || isViewSource) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 3. Vòng lặp phát hiện DevTools hoạt động (Docked & Undocked)
    let devtoolsOpenDetected = false;
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: () => {
        devtoolsOpenDetected = true;
      }
    });

    const checkDevTools = () => {
      devtoolsOpenDetected = false;
      // In đối tượng để kích hoạt getter của Chrome/Firefox nếu DevTools mở
      console.log(element);
      console.clear();

      // Kiểm tra chênh lệch chiều rộng/cao ngoài và trong cửa sổ (Docked DevTools)
      const threshold = 160;
      const isDockedWidth = window.outerWidth - window.innerWidth > threshold;
      const isDockedHeight = window.outerHeight - window.innerHeight > threshold;

      if (isDockedWidth || isDockedHeight || devtoolsOpenDetected) {
        setIsDevToolsOpen(true);
      } else {
        setIsDevToolsOpen(false);
      }
    };

    // Chạy kiểm tra định kỳ mỗi 1 giây
    const intervalId = setInterval(checkDevTools, 1000);

    // Kiểm tra ngay khi mount
    checkDevTools();

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(intervalId);
    };
  }, [isPreview]);

  return isDevToolsOpen;
};
