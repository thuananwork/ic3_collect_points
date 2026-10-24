import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import '../css/StudentPortalCheatBlocker.css';

interface StudentPortalCheatBlockerProps {
  cheatWarnings: number;
  blockerReason: string;
  requestFullscreen: () => void;
}

export const StudentPortalCheatBlocker: React.FC<StudentPortalCheatBlockerProps> = ({
  cheatWarnings,
  blockerReason,
  requestFullscreen
}) => {
  return (
    <div className="cheat-blocker-overlay flex-center">
      <div className="blocker-card glass animate-slide-up">
        <ShieldAlert size={64} className="blocker-alert-icon" />
        <h2>CẢNH BÁO VI PHẠM PHÒNG THI</h2>
        <p>{blockerReason}</p>

        <div className="blocker-status">
          Số lần vi phạm hiện tại: <strong>{cheatWarnings}/3</strong>
        </div>

        <button className="btn-primary btn-re-enter" onClick={requestFullscreen}>
          <ShieldCheck size={18} /> Kích hoạt lại Fullscreen
        </button>
      </div>
    </div>
  );
};
