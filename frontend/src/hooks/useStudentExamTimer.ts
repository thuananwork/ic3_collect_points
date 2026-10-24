import { useEffect, useRef } from 'react';
import { saveQuizAttempt } from '../api';

export const useStudentExamTimer = (
  isExamStarted: boolean,
  examSubmitted: boolean,
  quizToStart: any,
  attemptIdRef: React.RefObject<number | null>,
  answersRef: React.RefObject<any>,
  cheatWarningsRef: React.RefObject<number>,
  triggerAutoSubmit: (reason: string) => void,
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>,
  durationSeconds: number,
  setDurationSeconds: React.Dispatch<React.SetStateAction<number>>,
  examStartTime: number | null,
  examEndTime: number | null,
  onBanned?: (message: string) => void
) => {
  const durationRef = useRef(durationSeconds);
  const timerRef = useRef<any | null>(null);
  // Khởi tạo refs với giá trị tham số để interval đọc đúng ngay từ tick đầu tiên
  const examStartTimeRef = useRef<number | null>(examStartTime);
  const examEndTimeRef = useRef<number | null>(examEndTime);

  const limitSeconds = quizToStart ? quizToStart.time_limit * 60 : 0;
  const limitSecondsRef = useRef(limitSeconds);

  useEffect(() => {
    limitSecondsRef.current = limitSeconds;
  }, [limitSeconds]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    examStartTimeRef.current = examStartTime;
  }, [examStartTime]);

  useEffect(() => {
    examEndTimeRef.current = examEndTime;
  }, [examEndTime]);

  useEffect(() => {
    if (!isExamStarted || examSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // 1. Timer count down
    timerRef.current = setInterval(() => {
      const startTime = examStartTimeRef.current;
      const endTime = examEndTimeRef.current;
      const limit = limitSecondsRef.current;

      if (startTime && endTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        const elapsed = Math.min(limit, Math.floor((now - startTime) / 1000));

        setTimeLeft(remaining);
        setDurationSeconds(elapsed);

        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
        }
      } else {
        setDurationSeconds(d => d + 1);
        setTimeLeft(t => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            triggerAutoSubmit('Hết giờ làm bài! Bài thi của bạn đang được tự động nộp.');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    // 2. Periodic background auto-save every 5 seconds
    const autoSaveInterval = setInterval(() => {
      if (attemptIdRef.current && attemptIdRef.current > 0 && !examSubmitted) {
        saveQuizAttempt(attemptIdRef.current, {
          answers: answersRef.current,
          cheat_warnings_count: cheatWarningsRef.current,
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
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(autoSaveInterval);
    };
  }, [isExamStarted, examSubmitted]);

  return {
    durationRef
  };
};
