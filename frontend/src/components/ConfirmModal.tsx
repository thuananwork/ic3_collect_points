import React, { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import './css/ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  mode?: 'confirm' | 'alert' | 'prompt';
  promptPlaceholder?: string;
  defaultValue?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'info',
  mode = 'confirm',
  promptPlaceholder = '',
  defaultValue = ''
}) => {
  const [inputValue, setInputValue] = useState('');

  // Reset/Set input value when prompt opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue || '');
    }
  }, [isOpen, defaultValue]);

  // Hỗ trợ phím ESC để hủy và Enter để xác nhận nhanh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && mode !== 'prompt') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Lấy icon tương ứng với loại thông báo
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertCircle size={22} />;
      case 'warning':
        return <AlertTriangle size={22} />;
      case 'info':
      default:
        return <Info size={22} />;
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div 
        className="confirm-modal-card" 
        onClick={(e) => e.stopPropagation()} // Tránh đóng modal khi click bên trong card
      >
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon-wrapper ${type}`}>
            {getIcon()}
          </div>
          <h3>{title}</h3>
        </div>
        
        <div className="confirm-modal-body">
          <p style={{ margin: '0 0 10px 0', whiteSpace: 'pre-line' }}>{message}</p>
          {mode === 'prompt' && (
            <input
              type="text"
              className="confirm-modal-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={promptPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onConfirm(inputValue);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-color)',
                background: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                marginTop: '10px',
                outline: 'none',
              }}
            />
          )}
        </div>
        
        <div className="confirm-modal-footer">
          {mode !== 'alert' && (
            <button 
              type="button" 
              className="confirm-modal-btn cancel" 
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button 
            type="button" 
            className={`confirm-modal-btn confirm-${type}`} 
            onClick={() => onConfirm(mode === 'prompt' ? inputValue : undefined)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
