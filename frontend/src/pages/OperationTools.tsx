import React, { useState, useEffect } from 'react';
import { 
  Terminal, Activity, Settings, FileArchive, ShieldAlert, 
  Download, Sparkles, X, Code, CheckCircle, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
  getOperationScript, saveOperationScript, geminiFixScript, API_BASE_URL, getOperationQuizzes 
} from '../api';
import './css/OperationTools.css';

interface ScriptItem {
  name: string;
  desc: string;
  iconType: 'terminal' | 'activity' | 'amber' | 'red' | 'green';
  url: string;
}

interface QuizItem {
  name: string;
  desc: string;
  url: string;
}

export const OperationTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [quizFiles, setQuizFiles] = useState<QuizItem[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState<boolean>(false);

  const fetchQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const res = await getOperationQuizzes();
      setQuizFiles(res.data);
    } catch (err) {
      console.error("Lỗi tải danh sách trắc nghiệm:", err);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  const handleDownloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Lỗi tải xuống tệp tin:", err);
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);
  
  // Script Debugger states
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [scriptContent, setScriptContent] = useState<string>('');
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(false);
  const [isSavingScript, setIsSavingScript] = useState<boolean>(false);
  
  // Gemini AI states
  const [errorInput, setErrorInput] = useState<string>('');
  const [promptInput, setPromptInput] = useState<string>('');
  const [isCallingAI, setIsCallingAI] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedScript(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedScript]);

  const systemTools: ScriptItem[] = [
    { name: "SetupGame.bat", desc: "Cài đặt tự động môi trường thi iSpring trên máy trạm.", iconType: 'terminal', url: "scripts/SetupGame.bat" },
    { name: "lay_ip.bat", desc: "Học sinh chạy file này trong giờ thi để gửi IP động về Server.", iconType: 'activity', url: "scripts/lay_ip.bat" },
    { name: "set_ip.bat", desc: "Thiết lập IP tĩnh cố định cho máy trạm. Rất hữu ích khi quản lý quy mô lớn.", iconType: 'amber', url: "scripts/set_ip.bat" },
    { name: "XoaFile.bat", desc: "Dọn dẹp nhanh Desktop, Temp và Downloads để máy luôn sạch và chạy mượt.", iconType: 'red', url: "scripts/XoaFile.bat" },
    { name: "fix_firewall.bat", desc: "Mở cổng Firewall và khắc phục lỗi kết nối khi máy học sinh không lưu được file.", iconType: 'green', url: "scripts/fix_firewall.bat" }
  ];

  // quizFiles are now dynamically loaded from backend

  const getIcon = (type: string) => {
    switch (type) {
      case 'terminal': return <Terminal size={22} />;
      case 'activity': return <Activity size={22} />;
      case 'amber': return <Settings size={22} />;
      case 'red': return <FileArchive size={22} />;
      case 'green': return <ShieldAlert size={22} />;
      default: return <Terminal size={22} />;
    }
  };

  const titles = [
    { title: "Công Cụ Hệ Thống", desc: "Tải xuống các công cụ hỗ trợ thiết lập và tối ưu phòng máy thi." },
    { title: "File Trắc Nghiệm", desc: "Các bộ câu hỏi trắc nghiệm định dạng .quiz cho các khối lớp." },
    { title: "File Bài Giảng", desc: "Kho lưu trữ tài liệu và slide bài giảng điện tử." }
  ];

  // Open the AI debugger for a script
  const handleOpenDebugger = async (scriptName: string) => {
    setSelectedScript(scriptName);
    setIsLoadingScript(true);
    setScriptContent('');
    setErrorInput('');
    setPromptInput('');
    setAiExplanation('');
    setFeedbackMsg(null);

    try {
      const res = await getOperationScript(scriptName);
      if (res.data.status === 'success') {
        setScriptContent(res.data.content);
      } else {
        setFeedbackMsg({ type: 'error', text: res.data.message || 'Lỗi tải script.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Không thể kết nối đến Server để lấy dữ liệu script.' 
      });
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Close debugger
  const handleCloseDebugger = () => {
    setSelectedScript(null);
  };

  // Call Gemini API to fix the script
  const handleAIFix = async () => {
    if (!selectedScript || isCallingAI || isLoadingScript) return;
    setIsCallingAI(true);
    setFeedbackMsg(null);
    setAiExplanation('');

    try {
      const res = await geminiFixScript({
        name: selectedScript,
        content: scriptContent,
        error: errorInput,
        prompt: promptInput
      });

      if (res.data.status === 'success') {
        setAiExplanation(res.data.explanation);
        setScriptContent(res.data.fixed_content);
        setFeedbackMsg({
          type: 'success',
          text: 'Gemini AI đã đề xuất sửa lỗi! Bản sửa đổi đã được điền trực tiếp vào khung soạn thảo bên trái. Hãy xem và bấm "Lưu chỉnh sửa" để áp dụng.'
        });
      } else {
        setFeedbackMsg({ type: 'error', text: res.data.message || 'AI không thể sửa lỗi script.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Không thể liên lạc với Gemini AI. Vui lòng thử lại.' 
      });
    } finally {
      setIsCallingAI(false);
    }
  };

  // Save the (manually edited or AI fixed) content to the server file
  const handleSaveFile = async (codeToSave: string) => {
    if (!selectedScript) return;
    setIsSavingScript(true);
    setFeedbackMsg(null);

    try {
      const res = await saveOperationScript(selectedScript, codeToSave);
      if (res.data.status === 'success') {
        setScriptContent(codeToSave);
        setFeedbackMsg({ type: 'success', text: `Đã ghi đè và lưu tệp ${selectedScript} thành công!` });
      } else {
        setFeedbackMsg({ type: 'error', text: res.data.message || 'Lỗi lưu script.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Lỗi lưu script lên máy chủ.' 
      });
    } finally {
      setIsSavingScript(false);
    }
  };

  return (
    <div className="ot-layout-wrapper animate-fade-in">
      
      {/* SIDEBAR TABS (Identical to legacy PHP layout) */}
      <div className="ot-sidebar">
        <div className="ot-sidebar-title">Danh Mục Quản Lý</div>
        <div className="ot-menu-list">
          <div 
            className={`ot-menu-item ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => setActiveTab(0)}
          >
            <Terminal size={18} />
            Công Cụ Hệ Thống
          </div>
          <div 
            className={`ot-menu-item ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => setActiveTab(1)}
          >
            <Code size={18} />
            File Trắc Nghiệm
          </div>
          <div 
            className={`ot-menu-item ${activeTab === 2 ? 'active' : ''}`}
            onClick={() => setActiveTab(2)}
          >
            <Settings size={18} />
            File Bài Giảng
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="ot-content">
        <div className="ot-container">
          
          <div className="ot-header">
            <h1>{titles[activeTab].title}</h1>
            <p>{titles[activeTab].desc}</p>
          </div>

          {/* TAB 0: CÔNG CỤ HỆ THỐNG */}
          {activeTab === 0 && (
            <div className="ot-file-list">
              {systemTools.map((t, idx) => (
                <div key={idx} className="ot-file-item">
                  <div className="ot-file-info">
                    <div className={`ot-file-icon ${t.iconType}`}>
                      {getIcon(t.iconType)}
                    </div>
                    <div className="ot-file-details">
                      <h3>{t.name}</h3>
                      <p>{t.desc}</p>
                    </div>
                  </div>
                  <div className="ot-actions">
                    <button 
                      onClick={() => handleOpenDebugger(t.name)}
                      className="ot-btn-ai"
                    >
                      <Sparkles size={14} /> Chẩn đoán AI
                    </button>
                    <button 
                      onClick={() => handleDownloadFile(`${API_BASE_URL}/${t.url}`, t.name)}
                      className="ot-btn-dl"
                    >
                      <Download size={14} /> Tải xuống
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 1: FILE TRẮC NGHIỆM */}
          {activeTab === 1 && (
            isLoadingQuizzes ? (
              <div className="flex-center" style={{ height: '200px', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={24} className="ai-spinner animate-spin" /> &nbsp; Đang tải danh sách đề thi...
              </div>
            ) : quizFiles.length === 0 ? (
              <div className="ot-empty-state">
                <Code size={48} />
                <h3>Chưa có file trắc nghiệm nào</h3>
                <p>Hãy xuất bản đề thi trắc nghiệm offline từ danh sách đề thi của giáo viên.</p>
              </div>
            ) : (
              <div className="ot-quiz-split-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* 1. Trắc nghiệm hệ thống */}
                <div className="ot-quiz-section">
                  <div className="ot-section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🖥️</span>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Trắc nghiệm hệ thống (Offline HTML)</h2>
                  </div>
                  {quizFiles.filter(q => q.name.endsWith('.html')).length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', paddingLeft: '0.5rem', margin: 0 }}>Chưa có file trắc nghiệm hệ thống offline nào.</p>
                  ) : (
                    <div className="ot-file-list">
                      {quizFiles.filter(q => q.name.endsWith('.html')).map((q, idx) => (
                        <div key={idx} className="ot-file-item">
                          <div className="ot-file-info">
                            <div className="ot-file-icon quiz">
                              <Code size={22} />
                            </div>
                            <div className="ot-file-details">
                              <h3>{q.name}</h3>
                              <p>{q.desc}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDownloadFile(`${API_BASE_URL}/${q.url}`, q.name)}
                            className="ot-btn-dl"
                          >
                            <Download size={14} /> Tải xuống
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. File câu hỏi iSpring */}
                <div className="ot-quiz-section">
                  <div className="ot-section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📦</span>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>File câu hỏi iSpring (.quiz)</h2>
                  </div>
                  {quizFiles.filter(q => q.name.endsWith('.quiz')).length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', paddingLeft: '0.5rem', margin: 0 }}>Chưa có file câu hỏi iSpring nào.</p>
                  ) : (
                    <div className="ot-file-list">
                      {quizFiles.filter(q => q.name.endsWith('.quiz')).map((q, idx) => (
                        <div key={idx} className="ot-file-item">
                          <div className="ot-file-info">
                            <div className="ot-file-icon quiz" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                              <FileArchive size={22} />
                            </div>
                            <div className="ot-file-details">
                              <h3>{q.name}</h3>
                              <p>{q.desc}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDownloadFile(`${API_BASE_URL}/${q.url}`, q.name)}
                            className="ot-btn-dl"
                          >
                            <Download size={14} /> Tải xuống
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* TAB 2: FILE BÀI GIẢNG */}
          {activeTab === 2 && (
            <div className="ot-empty-state">
              <Code size={48} />
              <h3>Chưa có file bài giảng nào</h3>
              <p>Nội dung học liệu slide sẽ được cập nhật trong thời gian tới.</p>
            </div>
          )}

        </div>
      </div>

      {/* GEMINI DIAGNOSTIC MODAL */}
      {selectedScript && (
        <div className="ai-modal-overlay" onClick={handleCloseDebugger}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="ai-modal-header">
              <h2>
                <Sparkles size={20} color="#9333ea" className="heart-pulse" /> 
                Chẩn đoán lỗi & Tối ưu script: {selectedScript}
              </h2>
              <button onClick={handleCloseDebugger} className="ai-modal-close">
                <X size={20} />
              </button>
            </div>

            <div className="ai-modal-body">
              {feedbackMsg && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: feedbackMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: feedbackMsg.type === 'success' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {feedbackMsg.text}
                </div>
              )}

              <div className="ai-grid-split">
                
                {/* Left side: Code Editor */}
                <div className="ai-panel">
                  <span className="ai-panel-title">Mã nguồn tệp (.bat) hiện tại:</span>
                  <div className="ai-editor-wrapper">
                    <div className="ai-editor-header">
                      <span className="ai-editor-title">scripts/{selectedScript}</span>
                      <button 
                        onClick={() => handleSaveFile(scriptContent)}
                        disabled={isSavingScript || isLoadingScript}
                        className="ot-btn-dl"
                        style={{ padding: '2px 10px', fontSize: '0.72rem', borderRadius: '4px' }}
                      >
                        {isSavingScript ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                      </button>
                    </div>
                    {isLoadingScript ? (
                      <div className="flex-center" style={{ height: '100%', color: '#94a3b8' }}>
                        <RefreshCw size={24} className="ai-spinner" /> &nbsp; Đang tải file...
                      </div>
                    ) : (
                      <textarea
                        value={scriptContent}
                        onChange={(e) => setScriptContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleAIFix();
                          }
                        }}
                        className="ai-textarea"
                        placeholder="Nội dung file script .bat..."
                      />
                    )}
                  </div>
                </div>

                {/* Right side: AI Prompts & Inputs */}
                <div className="ai-panel">
                  <span className="ai-panel-title">Nhập thông tin lỗi / Triệu chứng:</span>
                  <textarea
                    value={errorInput}
                    onChange={(e) => setErrorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAIFix();
                      }
                    }}
                    style={{ height: '80px', resize: 'none' }}
                    className="ai-input-field"
                    placeholder="Ví dụ: Netsh báo lỗi interface name hoặc script báo không tìm thấy đường dẫn file userdata..."
                  />

                  <span className="ai-panel-title" style={{ marginTop: '0.5rem' }}>Yêu cầu chỉnh sửa thêm (Tùy chọn):</span>
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAIFix();
                      }
                    }}
                    className="ai-input-field"
                    placeholder="Ví dụ: Đổi địa chỉ Server IP thành 192.168.50.1..."
                  />

                  <button
                    onClick={handleAIFix}
                    disabled={isCallingAI || isLoadingScript}
                    className="ai-diagnostic-btn"
                    style={{ marginTop: '0.8rem' }}
                  >
                    {isCallingAI ? (
                      <>
                        <RefreshCw size={16} className="ai-spinner" />
                        Gemini đang xử lý...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Chạy sửa lỗi tự động với Gemini AI
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* AI Diagnostic result */}
              {aiExplanation && (
                <div className="ai-output-box">
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#9333ea', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Chẩn đoán từ Gemini AI:
                  </h4>
                  
                  <div className="ai-explanation-box">
                    {aiExplanation}
                  </div>
                </div>
              )}

            </div>

            <div className="ai-modal-footer">
              <button 
                onClick={() => handleDownloadFile(`${API_BASE_URL}/scripts/${selectedScript}`, selectedScript)}
                className="ot-btn-dl"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}
              >
                <Download size={14} /> Tải xuống file
              </button>
              <button onClick={handleCloseDebugger} className="ot-btn-dl" style={{ background: 'var(--success)' }}>
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default OperationTools;
