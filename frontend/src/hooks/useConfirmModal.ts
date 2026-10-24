import { useState } from 'react';

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info';
  mode: 'confirm' | 'alert' | 'prompt';
  defaultValue?: string;
  promptPlaceholder?: string;
  confirmText?: string;
  onConfirm: (val?: string) => void;
}

export const useConfirmModal = () => {
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    mode: 'confirm',
    onConfirm: () => {}
  });

  const showPrompt = (
    title: string,
    message: string,
    defaultValue: string,
    onConfirm: (val: string) => void,
    promptPlaceholder = 'Ví dụ: A, B, C, 1, 2, ...'
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: 'info',
      mode: 'prompt',
      defaultValue,
      promptPlaceholder,
      confirmText: 'Xác nhận',
      onConfirm: (val) => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (val !== undefined) onConfirm(val);
      }
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'warning',
    confirmText = 'Xác nhận'
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      mode: 'confirm',
      confirmText,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  const showAlert = (
    title: string,
    message: string,
    type: 'danger' | 'warning' | 'info' = 'danger',
    confirmText = 'Đóng'
  ) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      mode: 'alert',
      confirmText,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const closeConfirmModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  return {
    modalConfig,
    showPrompt,
    showConfirm,
    showAlert,
    closeConfirmModal
  };
};
