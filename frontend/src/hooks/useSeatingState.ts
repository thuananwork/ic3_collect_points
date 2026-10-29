import { useEffect, useState } from 'react';
import { getSeatingInfo, getMuctuieuInfo, postAction } from '../api';

export interface Student {
  id: string;
  ho: string;
  ten: string;
  fullName: string;
  originalFullName: string;
  originalPc: number;
  currentPc: number;
  originalOt: string;
  currentOt: string;
  originalTarget: string;
  currentTarget: string;
  deleted: boolean;
  _matched?: boolean;
  bestScore?: number | string;
  max?: number;
}

export const parseName = (fullName: string) => {
  let parts = fullName.trim().split(" ");
  if (parts.length > 1) {
    let ten = parts.pop() || '';
    let ho = parts.join(" ");
    return { ho, ten };
  }
  return { ho: fullName, ten: "" };
};

const useSeatingState = (mode: 'seating' | 'targets') => {
  const [tenLop, setTenLop] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChanged, setIsChanged] = useState(false);

  // Presentation mode
  const [presenting, setPresenting] = useState(false);

  // Modals Visibility
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Swap candidate
  const [swapCandidate, setSwapCandidate] = useState<any | null>(null);

  // Paste Data
  const [pasteData, setPasteData] = useState('');

  // Toast State
  const [toastShow, setToastShow] = useState(false);
  const [toastContent, setToastContent] = useState('');
  const [toastTitle, setToastTitle] = useState('');
  const [toastBg, setToastBg] = useState('#4CAF50');

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard Escape listener and fullscreenchange listener to exit presentation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && presenting) {
        setPresenting(false);
        document.body.classList.remove('presenting');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && presenting) {
        setPresenting(false);
        document.body.classList.remove('presenting');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [presenting]);

  // Presentation auto scale effect
  useEffect(() => {
    if (presenting) {
      const handleScale = () => {
        const targetRatio = 1.25;
        const currentRatio = window.devicePixelRatio || 1;
        const zoomLevel = targetRatio / currentRatio;
        document.documentElement.style.zoom = String(zoomLevel);

        let styleEl = document.getElementById('autoscale-fix-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'autoscale-fix-style';
          document.head.appendChild(styleEl);
        }

        const correctedVh = (100 / zoomLevel).toFixed(4);
        styleEl.innerHTML = `
          html, body { height: ${correctedVh}vh !important; min-height: ${correctedVh}vh !important; }
          .app-container { height: ${correctedVh}vh !important; }
          .app-main-content { height: ${correctedVh}vh !important; overflow: hidden !important; }
          .seating-chart-container-page { height: ${correctedVh}vh !important; }
          .main-container { height: ${correctedVh}vh !important; }
          body.presenting, body.presenting .right-panel { height: ${correctedVh}vh !important; }
        `;
      };

      handleScale();
      window.addEventListener('resize', handleScale);
      return () => {
        window.removeEventListener('resize', handleScale);
        document.documentElement.style.zoom = "";
        const styleEl = document.getElementById('autoscale-fix-style');
        if (styleEl) styleEl.remove();
      };
    }
  }, [presenting]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (mode === 'seating') {
        const res = await getSeatingInfo();
        setTenLop(res.data.class_name);

        const mapping = res.data.mapping || {};
        const targets = res.data.targets || {};
        const ots = res.data.otConfigs || {};

        const list: Student[] = [];
        for (let pc in mapping) {
          let name = mapping[pc];
          let pName = parseName(name);
          let otVal = ots[pc] || '';
          let targetVal = targets[pc] || '';

          list.push({
            id: pc,
            ho: pName.ho,
            ten: pName.ten,
            fullName: name,
            originalFullName: name,
            originalPc: parseInt(pc),
            currentPc: parseInt(pc),
            originalOt: otVal,
            currentOt: otVal,
            originalTarget: targetVal,
            currentTarget: targetVal,
            deleted: false
          });
        }
        setStudents(list);
      } else {
        // Fetch student targets
        const infoRes = await getMuctuieuInfo();
        setTenLop(infoRes.data.class_name);
        const stMap = infoRes.data.students || {};

        // Fetch scores
        const scoreRes = await postAction('get_data');
        const scoresMap = scoreRes.data.scores || {};

        const list: Student[] = [];
        for (let pc in stMap) {
          const student = stMap[pc];
          const sc = scoresMap[pc] || {};
          let best: any = '';
          if (sc.score !== undefined && sc.score !== '') {
            const parts = String(sc.score).split('|').map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n));
            best = parts.length ? Math.max(...parts) : '';
          }

          list.push({
            id: pc,
            ho: student.ho || '',
            ten: student.ten || '',
            fullName: student.fullName || '',
            originalFullName: student.fullName || '',
            originalPc: parseInt(pc),
            currentPc: parseInt(pc),
            originalOt: student.baiLam || '',
            currentOt: student.baiLam || '',
            originalTarget: student.mucTieu || '',
            currentTarget: student.mucTieu || '',
            deleted: false,
            bestScore: best,
            max: sc.max || 1000
          });
        }
        setStudents(list);
      }
      setIsChanged(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToastNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastContent(msg);
    setToastTitle(type === 'success' ? 'Đã cập nhật sơ đồ học sinh' : 'Lỗi / Cảnh báo');
    setToastBg(type === 'success' ? '#4CAF50' : '#f44336');
    setToastShow(true);
    setTimeout(() => {
      setToastShow(false);
    }, 5000);
  };

  const updateSaveButtonState = (currentList: Student[]) => {
    const changes = currentList.some(s =>
      s.currentPc !== s.originalPc ||
      s.deleted ||
      s.id.toString().startsWith('new_') ||
      s.currentOt !== s.originalOt ||
      s.currentTarget !== s.originalTarget ||
      s.fullName !== s.originalFullName
    );
    setIsChanged(changes);
  };

  const handleNameChange = (id: string, val: string) => {
    const updated = students.map(s => {
      if (s.id === id) {
        const pName = parseName(val);
        return {
          ...s,
          fullName: val,
          ho: pName.ho,
          ten: pName.ten
        };
      }
      return s;
    });
    setStudents(updated);
    updateSaveButtonState(updated);
  };

  const handleMetaChange = (id: string, val: string, field: 'Ot' | 'Target') => {
    const updated = students.map(s => {
      if (s.id === id) {
        return {
          ...s,
          [field === 'Ot' ? 'currentOt' : 'currentTarget']: val
        };
      }
      return s;
    });
    setStudents(updated);
    updateSaveButtonState(updated);
  };

  const handlePCChange = (id: string, val: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    const oldPc = student.currentPc;
    const newPc = parseInt(val);

    if (isNaN(newPc) || newPc < 1 || newPc > 60) {
      showToastNotification("Vui lòng nhập Vị trí hợp lệ (1-60)", "error");
      return;
    }

    if (oldPc === newPc) return;

    // Check duplicate collision
    const collision = students.find(s => s.currentPc === newPc && s.id !== id && !s.deleted);
    if (collision) {
      setSwapCandidate({
        mover: student,
        target: collision,
        oldPc: oldPc,
        newPc: newPc
      });
      setShowSwapModal(true);
    } else {
      const updated = students.map(s => {
        if (s.id === id) return { ...s, currentPc: newPc };
        return s;
      });
      setStudents(updated);
      updateSaveButtonState(updated);
    }
  };

  const confirmSwap = () => {
    if (!swapCandidate) return;

    const updated = students.map(s => {
      if (s.id === swapCandidate.mover.id) return { ...s, currentPc: swapCandidate.newPc };
      if (s.id === swapCandidate.target.id) return { ...s, currentPc: swapCandidate.oldPc };
      return s;
    });

    setStudents(updated);
    updateSaveButtonState(updated);
    setShowSwapModal(false);
    setSwapCandidate(null);
    showToastNotification("Đã đổi chỗ thành công!", "success");
  };

  const cancelSwap = () => {
    setShowSwapModal(false);
    setSwapCandidate(null);
  };

  const deleteStudent = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    if (window.confirm(`Chắc chắn bạn muốn xóa học sinh ${student.fullName} khỏi danh sách?`)) {
      const updated = students.map(s => {
        if (s.id === id) return { ...s, deleted: true };
        return s;
      });
      setStudents(updated);
      updateSaveButtonState(updated);
    }
  };

  const addNewStudent = () => {
    let availablePc = 1;
    while (students.some(s => s.currentPc === availablePc && !s.deleted) && availablePc <= 60) {
      availablePc++;
    }

    if (availablePc > 60) {
      showToastNotification("Đã đủ 60 máy, không thể thêm mới!", "error");
      return;
    }

    const newId = 'new_' + Date.now();
    const newSt: Student = {
      id: newId,
      ho: '',
      ten: '',
      fullName: '',
      originalFullName: '',
      originalPc: availablePc,
      currentPc: availablePc,
      originalOt: '',
      currentOt: '',
      originalTarget: '',
      currentTarget: '',
      deleted: false
    };

    const updated = [newSt, ...students];
    setStudents(updated);
    updateSaveButtonState(updated);
  };

  // Excel paste matching
  const confirmExcelPaste = () => {
    let raw = pasteData.trim();
    if (!raw) {
      setShowPasteModal(false);
      return;
    }

    let linesMatch = raw.replace(/\r/g, '').split(/\n/);
    let mappings: any[] = [];

    for (let line of linesMatch) {
      line = line.trim();
      if (!line) continue;

      // Bỏ qua dòng tiêu đề nếu người dùng bôi đen cả dòng đầu của file mẫu
      const lowerLine = line.toLowerCase().replace(/\s+/g, ' ');
      if (['họ và tên', 'họ tên', 'họ tên', 'tên hs', 'tên học sinh'].some(h => lowerLine.startsWith(h))) continue;

      let cells = line.split(/\t/);
      if (cells.length === 1) {
        cells = line.split(/\s+/);
      }

      let pcMatchIndex = -1;
      let pcNum: number | null = null;
      for (let i = 0; i < cells.length; i++) {
        let m = cells[i].trim().match(/^PC\s*0*(\d+)$/i);
        if (m) {
          pcMatchIndex = i;
          pcNum = parseInt(m[1], 10);
          break;
        }
      }

      if (pcMatchIndex !== -1) {
        let nameCells = cells.slice(0, pcMatchIndex).map(c => c.trim()).filter(c => c);
        let origStr = nameCells.join(" ");
        if (!origStr && pcMatchIndex > 0) {
          origStr = cells.slice(0, pcMatchIndex).join(" ").trim();
        }

        let otCell = '';
        let targetCell = '';

        let vals: string[] = [];
        for (let i = pcMatchIndex + 1; i < cells.length; i++) {
          let c = cells[i].trim();
          if (c) vals.push(c);
        }

        for (let val of vals) {
          let hasLetter = /[a-z]/i.test(val.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          let looksLikeOT = val.match(/^(OT|GM|Hoàn thành|Kiểm tra)/i) || (hasLetter && /\d/.test(val));
          let looksLikeTarget = /^\d+(\s*,\s*\d+)*$/.test(val) || val === '---';

          if (looksLikeOT) {
            otCell = otCell ? otCell + ", " + val : val;
          } else if (looksLikeTarget || (!isNaN(Number(val)) && val !== '')) {
            targetCell = targetCell ? targetCell + ", " + val : val;
          } else if (hasLetter) {
            otCell = otCell ? otCell + ", " + val : val;
          } else {
            if (!otCell) otCell = val;
          }
        }

        mappings.push({
          origStr: origStr || "Unknown",
          str: origStr.toLowerCase().replace(/\s+/g, ' '),
          pc: pcNum,
          ot: otCell,
          target: targetCell
        });
      } else {
        let nameCells = [];
        let otCell = '';
        let targetCell = '';

        let tokens: string[] = [];
        for (let c of cells) {
          if (c.trim()) tokens.push(c.trim());
        }

        while (tokens.length > 0) {
          let val = tokens[tokens.length - 1];
          let hasLetter = /[a-z]/i.test(val.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          let isNumList = /^\d+(\s*,\s*\d+)*$/.test(val);
          let isNum = !isNaN(Number(val)) && val !== '';
          let isOT = val.match(/^(OT|GM|Hoàn thành|Kiểm tra)/i) || (hasLetter && /\d/.test(val));

          if (isNumList || isNum || val === '---') {
            targetCell = targetCell ? val + ", " + targetCell : val;
            tokens.pop();
          } else if (isOT) {
            otCell = otCell ? val + ", " + otCell : val;
            tokens.pop();
          } else {
            break;
          }
        }

        nameCells = tokens;

        let origStr = nameCells.join(" ");
        if (origStr) {
          mappings.push({
            origStr: origStr,
            str: origStr.toLowerCase().replace(/\s+/g, ' '),
            pc: null,
            ot: otCell,
            target: targetCell
          });
        }
      }
    }

    let mapCount = 0;
    let newCount = 0;
    let matchExistCount = 0;
    let duplicatePcs: number[] = [];

    // Match mapping to students
    const updatedList = students.map(st => ({ ...st, _matched: false }));

    for (let m of mappings) {
      if (!m.str) continue;
      let bestStudent: any = null;

      // Pass 1: Exact Name Match
      for (let st of updatedList) {
        if (st.deleted) continue;
        let fName = st.fullName.toLowerCase().replace(/\s+/g, ' ');
        if (m.str === fName) {
          bestStudent = st;
          break;
        }
      }

      // Pass 2: Fuzzy fallback
      if (!bestStudent) {
        let bestScore = 0;
        for (let st of updatedList) {
          if (st.deleted || st._matched) continue;
          let fName = st.fullName.toLowerCase().replace(/\s+/g, ' ');
          if (fName.includes(m.str) || m.str.includes(fName)) {
            let score = Math.min(m.str.length, fName.length) / Math.max(m.str.length, fName.length);
            if (score > bestScore && score > 0.4) {
              bestScore = score;
              bestStudent = st;
            }
          }
        }
      }

      if (bestStudent) {
        bestStudent._matched = true;
        let changed = false;

        if (m.pc !== null) {
          if (bestStudent.currentPc !== m.pc) {
            bestStudent.currentPc = m.pc;
            changed = true;
          }
        }
        if (m.ot !== undefined && m.ot !== '') {
          if (bestStudent.currentOt !== m.ot) {
            bestStudent.currentOt = m.ot;
            changed = true;
          }
        }
        if (m.target !== undefined && m.target !== '') {
          if (bestStudent.currentTarget !== m.target) {
            bestStudent.currentTarget = m.target;
            changed = true;
          }
        }

        if (changed) mapCount++;
        else matchExistCount++;
      } else {
        // Create new
        let finalPc = m.pc;
        if (finalPc === null) {
          finalPc = 1;
          while (updatedList.some(s => s.currentPc === finalPc && !s.deleted) && finalPc <= 60) {
            finalPc++;
          }
        }

        let pName = parseName(m.origStr);
        updatedList.push({
          id: 'new_' + Date.now() + '_' + Math.random(),
          ho: pName.ho,
          ten: pName.ten,
          fullName: m.origStr,
          originalFullName: '',
          originalPc: finalPc,
          currentPc: finalPc,
          originalOt: '',
          currentOt: m.ot || '',
          originalTarget: '',
          currentTarget: m.target || '',
          deleted: false,
          _matched: true
        });
        newCount++;
      }
    }

    // Delete unmatched
    let deletedCount = 0;
    const keep = false; // Auto update and delete old students not in the pasted data

    const finalStudents = updatedList.map(st => {
      if (!st.deleted && !st.id.toString().startsWith('new_') && !st._matched && !keep) {
        deletedCount++;
        return { ...st, deleted: true };
      }
      return st;
    });

    // Check duplicates
    let pcCounts: any = {};
    finalStudents.forEach(st => {
      if (!st.deleted) {
        pcCounts[st.currentPc] = (pcCounts[st.currentPc] || 0) + 1;
      }
    });

    for (let pc in pcCounts) {
      if (pcCounts[pc] > 1) duplicatePcs.push(parseInt(pc));
    }

    let dupMsg = '';
    if (duplicatePcs.length > 0) {
      let pcStr = duplicatePcs.map(p => `PC${String(p).padStart(2, '0')}`).join(", ");
      dupMsg = `<br/><span style="color:#d93025; font-weight:700;">⚠️ Trùng lặp vị trí máy: ${pcStr}! Vui lòng sửa lại.</span>`;
    }

    setStudents(finalStudents);
    updateSaveButtonState(finalStudents);
    setShowPasteModal(false);

    let msg = ``;
    if (mapCount > 0) msg += `Đã cập nhật vị trí cho <b>${mapCount}</b> HS từ danh sách cũ.<br/>`;
    if (newCount > 0) msg += `Đã thêm mới <b>${newCount}</b> HS.<br/>`;
    if (matchExistCount > 0 && mapCount === 0 && newCount === 0) {
      msg = `Có <b>${matchExistCount}</b> HS giống vị trí hiện tại.<br/>`;
    }
    if (deletedCount > 0) {
      msg += `Đã xóa <b>${deletedCount}</b> học sinh không có mặt trong ds vừa dán.<br/>`;
    }
    msg += dupMsg;

    showToastNotification(msg, duplicatePcs.length > 0 ? "error" : "success");
  };

  // Save changes
  const saveChanges = async () => {
    setLoading(true);

    let changeMap: any = {};
    let deletes: number[] = [];
    let newStudentsList: any[] = [];
    let userTargets: any = {};
    let userOts: any = {};
    let userNames: any = {};

    students.forEach(st => {
      if (st.deleted) {
        if (!st.id.toString().startsWith('new_')) {
          deletes.push(st.originalPc);
        }
      } else {
        if (st.id.toString().startsWith('new_')) {
          newStudentsList.push({
            fullName: st.fullName,
            pc: st.currentPc
          });
        } else if (st.currentPc !== st.originalPc) {
          changeMap[st.originalPc] = st.currentPc;
        }

        if (!st.id.toString().startsWith('new_') && st.fullName !== st.originalFullName) {
          userNames[st.originalPc] = st.fullName;
        }

        if (st.currentOt !== '') {
          userOts[st.currentPc] = st.currentOt;
        } else if (st.originalOt !== '') {
          userOts[st.currentPc] = ''; // clear
        }

        if (st.currentTarget !== '') {
          userTargets[st.currentPc] = st.currentTarget;
        } else if (st.originalTarget !== '') {
          userTargets[st.currentPc] = ''; // clear
        }
      }
    });

    try {
      await postAction('update_pc_mapping', {
        changes: changeMap,
        deletes: deletes,
        new_students: newStudentsList,
        user_targets: userTargets,
        user_ots: userOts,
        user_names: userNames
      });
      showToastNotification(mode === 'seating' ? "Đã lưu sơ đồ chỗ ngồi thành công!" : "Đã lưu mục tiêu học sinh thành công!", "success");
      await fetchData();
    } catch (err) {
      console.error(err);
      showToastNotification("Gặp sự cố khi lưu thay đổi", "error");
      setLoading(false);
    }
  };

  const togglePresent = () => {
    const nextPresent = !presenting;
    setPresenting(nextPresent);

    if (nextPresent) {
      document.body.classList.add('presenting');
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log("Fullscreen API error:", err);
        });
      }
    } else {
      document.body.classList.remove('presenting');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    }
  };

  // Derived arrays
  const activeStudents = [...students].filter(s => !s.deleted);
  activeStudents.sort((a, b) => a.currentPc - b.currentPc);

  let pcCounts: any = {};
  activeStudents.forEach(st => {
    pcCounts[st.currentPc] = (pcCounts[st.currentPc] || 0) + 1;
  });

  return {
    tenLop,
    students,
    loading,
    isChanged,
    presenting,
    showSwapModal,
    showPasteModal,
    swapCandidate,
    pasteData,
    toastShow,
    toastContent,
    toastTitle,
    toastBg,
    activeStudents,
    pcCounts,
    setToastShow,
    setPasteData,
    setShowPasteModal,
    fetchData,
    handleNameChange,
    handleMetaChange,
    handlePCChange,
    confirmSwap,
    cancelSwap,
    deleteStudent,
    addNewStudent,
    confirmExcelPaste,
    saveChanges,
    togglePresent,
  };
};

export default useSeatingState;
