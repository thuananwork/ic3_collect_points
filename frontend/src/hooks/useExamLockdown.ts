import { useEffect } from 'react';

const STYLE_ID = 'exam-lockdown-style';
const BODY_CLASS = 'exam-lockdown';

const isEditable = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null;
  return !!node?.closest?.('input, textarea, [contenteditable="true"]');
};

/**
 * Khoá thao tác sao chép trong lúc học sinh làm bài thi chính thức:
 * chặn copy/cut/paste, kéo thả, bôi đen văn bản câu hỏi, chuột phải, in ấn và các phím tắt tương ứng.
 * Mục đích là gây khó khi dán đề sang công cụ AI hoặc dán đáp án có sẵn vào ô trả lời.
 * Không thể ngăn học sinh chụp màn hình hay dùng thiết bị khác, nên đây chỉ là lớp răn đe.
 *
 * @param active true khi đang thi thật (không áp dụng cho ôn luyện hoặc giáo viên xem trước)
 */
export const useExamLockdown = (active: boolean) => {
  useEffect(() => {
    if (!active) return;

    const prevent = (e: Event) => e.preventDefault();
    // Cho phép bôi đen trong ô nhập liệu, chặn ở phần còn lại (đề bài, đáp án)
    const preventSelect = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    const preventCopyCut = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 's') {
        e.preventDefault(); // in / lưu trang
      } else if (k === 'v') {
        e.preventDefault(); // dán
      } else if ((k === 'c' || k === 'x' || k === 'a') && !isEditable(e.target)) {
        e.preventDefault(); // sao chép / cắt / chọn tất cả ngoài ô nhập
      }
    };

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent =
        `body.${BODY_CLASS} *:not(input):not(textarea){-webkit-user-select:none;user-select:none;}` +
        `@media print{body.${BODY_CLASS}{display:none !important;}}`;
      document.head.appendChild(style);
    }
    document.body.classList.add(BODY_CLASS);

    document.addEventListener('copy', preventCopyCut);
    document.addEventListener('cut', preventCopyCut);
    document.addEventListener('paste', prevent);
    document.addEventListener('dragstart', prevent);
    document.addEventListener('drop', prevent);
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('selectstart', preventSelect);
    window.addEventListener('beforeprint', prevent);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.body.classList.remove(BODY_CLASS);
      document.removeEventListener('copy', preventCopyCut);
      document.removeEventListener('cut', preventCopyCut);
      document.removeEventListener('paste', prevent);
      document.removeEventListener('dragstart', prevent);
      document.removeEventListener('drop', prevent);
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('selectstart', preventSelect);
      window.removeEventListener('beforeprint', prevent);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [active]);
};
