import React from 'react';

interface StudentPortalPinEntryProps {
  quizToStart: any;
  errorMsg: string;
  loading: boolean;
  enteredPin: string;
  setEnteredPin: (pin: string) => void;
  onBack: () => void;
  onSubmit: (pin: string) => void;
}

export const StudentPortalPinEntry: React.FC<StudentPortalPinEntryProps> = ({
  quizToStart,
  errorMsg,
  loading,
  enteredPin,
  setEnteredPin,
  onBack,
  onSubmit
}) => {
  if (!quizToStart) return null;

  return (
    <div className="wizard-step-body">
      <p className="wizard-step-instruction">
        Đề thi <strong>{quizToStart.title}</strong> yêu cầu mã PIN từ Giáo viên để vào làm bài:
      </p>

      {errorMsg && (
        <div
          className="error-alert"
          style={{
            marginBottom: '14px',
            padding: '10px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '0.82rem'
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <div
        className="modal-form-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '1rem 0'
        }}
      >
        <div className="form-group" style={{ width: '100%' }}>
          <input
            type="text"
            maxLength={5}
            placeholder="Nhập 5 ký tự PIN"
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              textAlign: 'center',
              letterSpacing: '4px',
              boxSizing: 'border-box'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && enteredPin && enteredPin.length === 5) {
                onSubmit(enteredPin);
              }
            }}
          />
        </div>
      </div>

      <div className="modal-actions-row">
        <button
          className="btn-modal-cancel"
          onClick={onBack}
        >
          Quay lại
        </button>
        <button
          className="btn-modal-confirm"
          disabled={loading || !enteredPin || enteredPin.length !== 5}
          onClick={() => onSubmit(enteredPin)}
          style={{
            background: enteredPin && enteredPin.length === 5 ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#cbd5e1',
            cursor: enteredPin && enteredPin.length === 5 ? 'pointer' : 'not-allowed',
            opacity: enteredPin && enteredPin.length === 5 ? 1 : 0.5
          }}
        >
          {loading ? 'Đang vào...' : 'Vào thi'}
        </button>
      </div>
    </div>
  );
};
