import { useState, useEffect, useRef } from 'react';
import { saveQuizAttempt } from '../api';

export const useStudentAntiCheat = (
  isExamStarted: boolean,
  examSubmitted: boolean,
  attemptIdRef: React.RefObject<number | null>,
  answersRef: React.RefObject<any>,
  durationRef: React.RefObject<number>,
  triggerAutoSubmit: (reason: string) => void,
  isPreview: boolean = false,
  onBanned?: (message: string) => void
) => {
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [showCheatBlocker, setShowCheatBlocker] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');

  const cheatWarningsRef = useRef(cheatWarnings);
  useEffect(() => {
    cheatWarningsRef.current = cheatWarnings;
  }, [cheatWarnings]);

  useEffect(() => {
    // 0. Bypass everything if current session is teacher/admin previewing
    if (isPreview) {
      setShowCheatBlocker(false);
      return;
    }

    if (!isExamStarted || examSubmitted) {
      // Remove cheat blocker if exam is not started or is submitted
      setShowCheatBlocker(false);
      return;
    }

    // 1. Tab switching detection
    const handleVisibilityChange = (force?: unknown) => {
      if (force === true || document.visibilityState === 'hidden') {
        const nextWarnings = cheatWarningsRef.current + 1;
        setCheatWarnings(nextWarnings);

        // Auto-save immediately to register warning on server
        if (attemptIdRef.current && attemptIdRef.current > 0) {
          saveQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: nextWarnings,
            duration_seconds: durationRef.current
          })
            .then(res => {
              if (res.data && res.data.status === 'banned') {
                if (onBanned) onBanned(res.data.message);
              }
            })
            .catch(err => {
              if (err.response && err.response.data && err.response.data.status === 'banned') {
                if (onBanned) onBanned(err.response.data.message);
              } else {
                console.error(err);
              }
            });
        }

        if (nextWarnings >= 3) {
          triggerAutoSubmit('Bạn đã vi phạm quy chế thi (chuyển tab/rời màn hình quá 3 lần). Bài thi đã tự động nộp.');
        } else {
          setBlockerReason(`Bạn đã chuyển tab hoặc rời màn hình làm bài. Cảnh báo vi phạm: ${nextWarnings}/3 lần. Chú ý: quá 3 lần hệ thống sẽ tự động nộp bài!`);
          setShowCheatBlocker(true);
        }
      }
    };

    // 2. Fullscreen change detection
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      if (!isFull && !examSubmitted) {
        const nextWarnings = cheatWarningsRef.current + 1;
        setCheatWarnings(nextWarnings);

        // Auto-save immediately to register warning on server
        if (attemptIdRef.current && attemptIdRef.current > 0) {
          saveQuizAttempt(attemptIdRef.current, {
            answers: answersRef.current,
            cheat_warnings_count: nextWarnings,
            duration_seconds: durationRef.current
          })
            .then(res => {
              if (res.data && res.data.status === 'banned') {
                if (onBanned) onBanned(res.data.message);
              }
            })
            .catch(err => {
              if (err.response && err.response.data && err.response.data.status === 'banned') {
                if (onBanned) onBanned(err.response.data.message);
              } else {
                console.error(err);
              }
            });
        }

        if (nextWarnings >= 3) {
          triggerAutoSubmit('Bạn đã vi phạm quy chế thi (thoát toàn màn hình quá 3 lần). Bài thi đã tự động nộp.');
        } else {
          setBlockerReason(`Yêu cầu bắt buộc chế độ Toàn màn hình (Fullscreen) để làm bài thi. Cảnh báo vi phạm: ${nextWarnings}/3 lần. Chú ý: quá 3 lần hệ thống sẽ tự động nộp bài!`);
          setShowCheatBlocker(true);
        }
      }
    };

    // Mất focus cửa sổ (chuyển sang cửa sổ/màn hình khác) quá 3 giây tính như rời tab
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const handleWindowBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!document.hasFocus() && document.visibilityState !== 'hidden') handleVisibilityChange(true);
      }, 3000);
    };
    const handleWindowFocus = () => { if (blurTimer) clearTimeout(blurTimer); };
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (blurTimer) clearTimeout(blurTimer);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isExamStarted, examSubmitted, isPreview]);

  const requestFullscreen = async () => {
    if (isPreview) return; // Bypass requesting fullscreen in preview mode
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setShowCheatBlocker(false);
      }
    } catch (err) {
      console.error('Không thể kích hoạt Fullscreen:', err);
    }
  };

  return {
    cheatWarnings,
    setCheatWarnings,
    cheatWarningsRef,
    showCheatBlocker,
    setShowCheatBlocker,
    blockerReason,
    setBlockerReason,
    requestFullscreen
  };
};
