import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
// import { Link } from 'react-router-dom'; // Reserved for future use
import { getDashboardInfo, postAction, getIpMapping, exportExcelUrl } from '../api';
import '../assets/css/bootstrap.min.css';
import './css/Dashboard.css';

const Dashboard: React.FC = () => {
  const [tenLop, setTenLop] = useState('');
  const [isScoringActive, setIsScoringActive] = useState(false);
  const [isScoringOther, setIsScoringOther] = useState(false);
  const [scoringClass, setScoringClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [originalStudents, setOriginalStudents] = useState<any[]>([]);
  const [selectedPC, setSelectedPC] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('isDetailOpen');
    return saved !== null ? saved === 'true' : true;
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [isTyping, setIsTyping] = useState(false);


  // Sorting & Filtering
  const [currentSort, setCurrentSort] = useState('pc_asc');
  const [currentLegendFilter, setCurrentLegendFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals visibility
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [showGenericModal, setShowGenericModal] = useState(false);

  // Generic modal state
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState(''); // 'bulk_target', 'bulk_ot', 'clear_bulk_target', 'clear_bulk_ot'
  const [modalInputVal, setModalInputVal] = useState('');

  // Spreadsheet raw data
  const [txtList, setTxtList] = useState('');
  const [sheetLines, setSheetLines] = useState<string[]>([]);
  const [sheetFormat, setSheetFormat] = useState<'full' | 'partial' | 'raw' | null>(null);

  // IP Mapping state
  const [ipList, setIpList] = useState<any[]>([]);
  const [serverIP, setServerIP] = useState('');
  const [ipCount, setIpCount] = useState(0);
  const [ipLastUpdate, setIpLastUpdate] = useState('');

  // Operation Logs
  const [actionLogs, setActionLogs] = useState<string[]>([]);

  // Auto-refresh interval
  const pollInterval = useRef<any>(null);

  const addActionLog = (msg: string) => {
    const now = new Date();
    const ts = now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0') + ':' +
      now.getSeconds().toString().padStart(2, '0');
    setActionLogs(prev => [ts + ' — ' + msg, ...prev].slice(0, 30));
  };

  useEffect(() => {
    fetchInitData();
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  // Save isDetailOpen to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('isDetailOpen', String(isDetailOpen));
  }, [isDetailOpen]);

  // Close tools dropdown on click outside or ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowToolsDropdown(false);
      }
    };

    if (showToolsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showToolsDropdown]);

  const fetchInitData = async () => {
    try {
      const res = await getDashboardInfo();
      const className = res.data.class_name;
      setTenLop(className);
      setTxtList(res.data.student_list_raw || '');

      setIsScoringActive(res.data.is_scoring_active);
      setScoringClass(res.data.scoring_class);
      setIsScoringOther(res.data.scoring_class && res.data.scoring_class !== className);

      await refreshData();

      startPolling();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(() => {
      refreshData();
    }, 3000);
  };

  const stopPolling = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
  }; void stopPolling;

  const refreshData = async () => {
    if (isTyping) return;
    try {
      const res = await postAction('get_data');
      if (res.data.status === 'success') {
        processAndSetData(res.data);
        setLastUpdate('Cập nhật: ' + new Date().toLocaleTimeString('vi-VN'));
      }
    } catch (err) {
      console.error('Error fetching student scores:', err);
    }
  };

  const doRefresh = async () => {
    await refreshData();
    addActionLog('Làm mới danh sách điểm');
  }; void doRefresh;

  const parseTimeSec = (tStr: string) => {
    if (!tStr || tStr === '—') return 999999;
    let m = 0, s = 0;
    let pM = tStr.match(/(\d+)p/);
    let pS = tStr.match(/(\d+)s/);
    if (pM) m = parseInt(pM[1]);
    if (pS) s = parseInt(pS[1]);
    return m * 60 + s;
  };

  const getGradeCategory = (score: any, ot: string) => {
    let s = parseFloat(score);
    if (isNaN(s)) return null;
    ot = ot || 'OT1';

    if (ot === 'OT5') {
      if (s >= 30) return 'G';
      if (s >= 25) return 'K';
      if (s >= 17) return 'TB';
      return 'Y';
    } else {
      if (s >= 41) return 'G';
      if (s >= 35) return 'K';
      if (s >= 23) return 'TB';
      return 'Y';
    }
  };

  const badgeClass = (score: any, target: any, ot: string) => {
    if (score === '' || score === undefined || score === null) return 'sbadge-na';
    let s = parseFloat(score);
    let t = (target !== '' && target !== null) ? parseFloat(target) : null;

    if (t !== null && t > 0) {
      if (s >= t) return 'sbadge-high';
      if (s >= t * 0.60) return 'sbadge-mid';
      return 'sbadge-low';
    } else {
      let grade = getGradeCategory(s, ot);
      if (grade === 'G' || grade === 'K') return 'sbadge-high';
      if (grade === 'TB') return 'sbadge-mid';
      return 'sbadge-low';
    }
  };

  const processAndSetData = (resData: any) => {
    const list: any[] = [];
    for (let i = 1; i <= 60; i++) {
      const pcKey = String(i);
      const found = resData.data?.find((s: any) => String(s.pc) === pcKey);
      const name = found?.name || resData.mapping?.[pcKey] || '';
      const sd = found?.scores || resData.scores?.[pcKey] || {};
      const allScr = sd.score !== undefined && sd.score !== '' ? String(sd.score) : '';
      let bestScore: any = '';
      if (allScr !== '') {
        const parts = allScr.split('|').map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n));
        bestScore = parts.length ? Math.max(...parts) : '';
      }
      const listOrder = resData.listOrder?.[pcKey] !== undefined ? parseInt(resData.listOrder[pcKey]) : undefined;
      const scoresByOT = sd.scoresByOT || null;
      const assignedStr = found?.ot || resData.otConfigs?.[pcKey] || '';
      const assignedArr = assignedStr ? assignedStr.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '') : [];
      const targetStr = found?.target || resData.targets?.[pcKey] || '';
      const targetArr = targetStr ? targetStr.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '') : [];

      let sumBestScore = 0;
      let sumTotalTarget = 0;
      let maxDisplayParts: any[] = [];
      let targetDisplayParts: any[] = [];
      let hasAnyScore = false;

      if (assignedArr.length > 0 && assignedStr !== 'Hoàn thành') {
        assignedArr.forEach((ot: string, idx: number) => {
          let otBest = 0;
          if (scoresByOT && scoresByOT[ot]) {
            const otScores = scoresByOT[ot].map((s: any) => parseFloat(s)).filter((n: number) => !isNaN(n));
            if (otScores.length > 0) {
              otBest = Math.max(...otScores);
              hasAnyScore = true;
            }
          }
          sumBestScore += otBest;
          maxDisplayParts.push(otBest || (hasAnyScore ? '0' : ''));

          let otTarget = parseFloat(targetArr[idx] || targetArr[0] || 0);
          if (isNaN(otTarget)) otTarget = 0;
          sumTotalTarget += otTarget;
          targetDisplayParts.push(targetArr[idx] || targetArr[0] || '');
        });
      } else {
        sumBestScore = parseFloat(bestScore) || 0;
        hasAnyScore = bestScore !== '';
        sumTotalTarget = parseFloat(targetStr) || 0;
        maxDisplayParts = [bestScore || ''];
        targetDisplayParts = [targetStr || ''];
      }

      const maxDisp = maxDisplayParts.filter(x => x !== '').join(', ');
      const tgtDisp = targetDisplayParts.filter(x => x !== '').join(', ');

      list.push({
        pc: i,
        name: name,
        bestScore: hasAnyScore ? sumBestScore : (allScr !== '' ? 0 : ''),
        bestScoreDisplay: maxDisp,
        max: sd.max || '',
        time: sd.timeSpent || '',
        timeSec: parseTimeSec(sd.timeSpent),
        lastOT: sd.lastOT || '',
        target: targetStr,
        targetDisplay: tgtDisp,
        sumTotalTarget: sumTotalTarget,
        assigned: assignedStr,
        allScr: allScr,
        attempts: allScr ? allScr.split('|').length : 0,
        listOrder: listOrder,
        scoresByOT: scoresByOT
      });
    }
    setOriginalStudents(list);
    sortAndFilterList(list, currentSort, currentLegendFilter, searchQuery);
  };

  const sortAndFilterList = (
    list = originalStudents,
    sortType = currentSort,
    legendType = currentLegendFilter,
    query = searchQuery
  ) => {
    let result = [...list];

    // Search query filter
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(st => {
        let nameMatch = (st.name || '').toLowerCase().includes(q);
        let pcMatch = String(st.pc).includes(q);

        let pcSearchNum = null;
        let match = q.match(/^pc[-_\s]*0*(\d+)$/);
        if (match) pcSearchNum = parseInt(match[1]);
        let exactPcMatch = (pcSearchNum !== null && st.pc === pcSearchNum);

        return nameMatch || pcMatch || exactPcMatch;
      });
    }

    // Legend filter
    if (legendType !== 'all') {
      result = result.filter(st => {
        let assignedArr = st.assigned ? st.assigned.split(',').map((s: string) => s.trim()) : [];
        const isOtFail = (st.assigned && st.assigned !== 'Hoàn thành' && st.lastOT && st.lastOT !== 'UNKNOWN' && !assignedArr.includes(st.lastOT));
        const bc = badgeClass(st.bestScore, st.sumTotalTarget, st.lastOT || assignedArr[0]);

        if (legendType === 'pass') return bc === 'sbadge-high';
        if (legendType === 'mid') return bc === 'sbadge-mid';
        if (legendType === 'low') return bc === 'sbadge-low';
        if (legendType === 'none') return st.bestScore === '';
        if (legendType === 'otfail') return isOtFail;
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortType === 'pc_asc') return a.pc - b.pc;
      if (sortType === 'seat_asc') return a.pc - b.pc;
      if (sortType === 'list_asc') {
        let sa = a.listOrder !== undefined ? a.listOrder : 9999;
        let sb = b.listOrder !== undefined ? b.listOrder : 9999;
        if (sa !== sb) return sa - sb;
        return a.pc - b.pc;
      }
      if (sortType === 'score_desc') {
        let sa = a.bestScore !== '' ? a.bestScore : -1;
        let sb = b.bestScore !== '' ? b.bestScore : -1;
        if (sa !== sb) return sb - sa;
        return a.timeSec - b.timeSec;
      }
      if (sortType === 'score_asc') {
        let sa = a.bestScore !== '' ? a.bestScore : 9999;
        let sb = b.bestScore !== '' ? b.bestScore : 9999;
        if (sa !== sb) return sa - sb;
        return a.timeSec - b.timeSec;
      }
      if (sortType === 'time_asc') {
        let ta = a.bestScore !== '' ? a.timeSec : 999999;
        let tb = b.bestScore !== '' ? b.timeSec : 999999;
        return ta - tb;
      }
      return 0;
    });

    setStudents(result);
  };

  const handleSortChange = (type: string) => {
    setCurrentSort(type);
    sortAndFilterList(originalStudents, type, currentLegendFilter, searchQuery);
  };

  const togglePositionSort = () => {
    if (currentSort === 'seat_asc') {
      handleSortChange('list_asc');
    } else if (currentSort === 'list_asc') {
      handleSortChange('pc_asc');
    } else {
      handleSortChange('seat_asc');
    }
  };

  const handleLegendFilterChange = (type: string) => {
    const newFilter = currentLegendFilter === type ? 'all' : type;
    setCurrentLegendFilter(newFilter);
    sortAndFilterList(originalStudents, currentSort, newFilter, searchQuery);
  };

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    sortAndFilterList(originalStudents, currentSort, currentLegendFilter, val);
  };

  // Toggle Scoring
  const toggleScoring = async () => {
    try {
      await postAction('set_scoring', { class: isScoringActive ? '' : tenLop });
      const nextActive = !isScoringActive;
      setIsScoringActive(nextActive);
      if (nextActive) {
        setScoringClass(tenLop);
        setIsScoringOther(false);
        addActionLog('🟢 BẬT nhận điểm cho lớp ' + tenLop);
      } else {
        setScoringClass('');
        addActionLog('⚪ TẮT nhận điểm');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Row operations
  const selectRow = (pc: number) => {
    const nextSelected = selectedPC === pc ? null : pc;
    setSelectedPC(nextSelected);
    if (nextSelected !== null) {
      setIsDetailOpen(true);
    }
  };

  // Save specific attributes
  const saveNameSingle = async (pc: number, newName: string) => {
    try {
      await postAction('save_name', { pc: String(pc), name: newName });
      addActionLog(`Cập nhật Tên PC${String(pc).padStart(2, '0')}: ${newName}`);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const saveManualScore = async (pc: number, val: string, oldVal: string) => {
    if (val === oldVal) return;
    try {
      await postAction('save_manual_score', { pc: String(pc), score: val });
      addActionLog(`Nhập điểm thủ công PC${String(pc).padStart(2, '0')}: ${val}`);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const saveTargetScore = async (pc: number, val: string) => {
    try {
      await postAction('save_target', { pc: String(pc), target: val });
      addActionLog(`Đặt mục tiêu PC${String(pc).padStart(2, '0')}: ${val}`);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const saveOTConfigSingle = async (pc: number, val: string) => {
    try {
      await postAction('save_ot', { pc: String(pc), ot: val });
      addActionLog(`Giao bài PC${String(pc).padStart(2, '0')}: ${val}`);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteStudentScores = async (pc: number) => {
    if (!window.confirm(`Xoá điểm của PC${String(pc).padStart(2, '0')}?`)) return;
    try {
      await postAction('delete_scores', { pc: String(pc) });
      addActionLog(`Xoá bài thi PC${String(pc).padStart(2, '0')}`);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteClassAllScores = async () => {
    if (!window.confirm(`⚠️ XÓA TOÀN BỘ ĐIỂM lớp "${tenLop}"?\nHành động này không thể hoàn tác!`)) return;
    try {
      await postAction('delete_scores');
      addActionLog('🗑️ Xoá toàn bộ điểm lớp');
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk Operations Modal
  const openBulkGeneric = (type: string, title: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalInputVal('');
    setShowGenericModal(true);
  };

  const handleBulkGenericApply = async () => {
    setShowGenericModal(false);
    try {
      if (modalType === 'bulk_target') {
        await postAction('save_bulk_target', { target: modalInputVal });
        addActionLog(`🎯 Đặt mục tiêu hàng loạt: ${modalInputVal}`);
      } else if (modalType === 'clear_bulk_target') {
        await postAction('save_bulk_target', { target: '' });
        addActionLog('🚫 Xoá mục tiêu hàng loạt');
      } else if (modalType === 'bulk_ot') {
        await postAction('save_bulk_ot', { ot: modalInputVal });
        addActionLog(`📋 Giao bài hàng loạt: ${modalInputVal}`);
      } else if (modalType === 'clear_bulk_ot') {
        await postAction('save_bulk_ot', { ot: '' });
        addActionLog('🚫 Huỷ giao bài hàng loạt');
      }
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Spreadsheet raw input modal
  const openListModal = () => {
    setShowListModal(true);
    renderSheetFromText(txtList);
  };

  const renderSheetFromText = (rawText: string) => {
    let lines = rawText.split('\n').filter(l => l.trim() !== '');
    if (lines.length > 0) {
      const firstCols = lines[0].split('\t');
      const isHdr = ['họ và tên', 'stt', '#', 'họ'].includes(firstCols[0].toLowerCase().trim());
      if (isHdr) lines = lines.slice(1);
    }
    setSheetLines(lines);

    if (lines.length > 0) {
      const firstCols = lines[0].split('\t');
      if (firstCols.length >= 28) setSheetFormat('full');
      else if (firstCols.length >= 14 && firstCols.length <= 20) setSheetFormat('partial');
      else setSheetFormat('raw');
    } else {
      setSheetFormat(null);
    }
  };

  const updateSheetCell = (rowIdx: number, colIdx: number, newVal: string) => {
    const updated = [...sheetLines];
    if (rowIdx < 0 || rowIdx >= updated.length) return;
    let cols = updated[rowIdx].split('\t');
    while (cols.length <= colIdx) cols.push('');
    cols[colIdx] = newVal.replace(/\r?\n|\r/g, ' ').trim();
    updated[rowIdx] = cols.join('\t');

    setSheetLines(updated);
    const newText = updated.join('\n');
    setTxtList(newText);
  };

  const handlePasteList = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText.trim()) return;

    let newText = txtList;
    if (txtList.trim()) {
      const replace = window.confirm('Đã có dữ liệu.\nBấm OK để THAY THẾ, bấm Cancel để THÊM VÀO.');
      if (replace) {
        newText = pastedText;
      } else {
        newText = txtList.trim() + '\n' + pastedText;
      }
    } else {
      newText = pastedText;
    }
    setTxtList(newText);
    renderSheetFromText(newText);
  };

  const clearSheetData = () => {
    if (!window.confirm('Xoá toàn bộ dữ liệu danh sách?')) return;
    setTxtList('');
    setSheetLines([]);
    setSheetFormat(null);
  };

  const addSheetRow = () => {
    let data = txtList;
    if (data && !data.endsWith('\n')) data += '\n';
    let numTabs = 4;
    if (sheetLines.length) numTabs = sheetLines[0].split('\t').length - 1;
    data += 'Học sinh mới' + '\t'.repeat(numTabs);
    setTxtList(data);
    renderSheetFromText(data);
  };

  const saveList = async () => {
    // Check duplicates
    let pcMap: any = {};
    let duplicates: number[] = [];

    sheetLines.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split('\t');
      let pcCol = cols.find(c => /^PC\d+/i.test(c.trim()));
      if (pcCol) {
        let pcNum = parseInt(pcCol.replace(/\D/g, ''), 10);
        if (pcMap[pcNum]) {
          duplicates.push(pcNum);
        } else {
          pcMap[pcNum] = true;
        }
      }
    });

    if (duplicates.length > 0) {
      const uniqueDupes = [...new Set(duplicates)].map(n => "PC" + String(n).padStart(2, '0'));
      alert("⛔ PHÁT HIỆN TRÙNG LẶP VỊ TRÍ MÁY!\n\nCác máy sau đang có 2 học sinh ngồi chung: " + uniqueDupes.join(', ') + "\n\nHệ thống ĐÃ CHẶN lệnh lưu. Vui lòng kiểm tra lại bảng danh sách để tránh bị mất điểm của học sinh!");
      return;
    }

    try {
      await postAction('save_list', { data: txtList });
      setShowListModal(false);
      refreshData();
      addActionLog(`Lưu danh sách: ${sheetLines.length} học sinh`);
    } catch (err) {
      console.error(err);
    }
  };



  // IP Management modal
  const openIPModal = async () => {
    setShowIpModal(true);
    await loadIPMapping();
  }; void openIPModal;

  const loadIPMapping = async () => {
    try {
      const res = await getIpMapping();
      setIpList(res.data.ipMapping || []);
      setServerIP(res.data.serverIP || '');
      setIpCount(res.data.totalPCs || 0);
      setIpLastUpdate(res.data.lastModified || 'Chưa cập nhật');
    } catch (err) {
      console.error(err);
    }
  };

  const clearIPMapping = async () => {
    if (!window.confirm('Xoá toàn bộ mapping IP hiện tại?')) return;
    try {
      await postAction('clear_ip_mapping');
      addActionLog('🗑️ Xoá toàn bộ IP');
      await loadIPMapping();
    } catch (err) {
      console.error(err);
    }
  };

  const generateBat = async () => {
    try {
      await postAction('generate_bat', { server_ip: serverIP });
      addActionLog(`⚡ Tạo file lay_ip.bat: ${serverIP}`);
      alert(`Đã tạo lay_ip.bat cho server IP: ${serverIP}! Học sinh có thể tải về.`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }} />;

  // Process Stats & Charts locally
  let total = 0, scored = 0, sum = 0, pass = 0, fail = 0, otFailCount = 0;
  let countG = 0, countK = 0, countTB = 0, countY = 0;
  let cPass = 0, cMid = 0, cLow = 0, cNone = 0, cOtfail = 0;
  let topArr: any[] = [];

  originalStudents.forEach(st => {
    if (st.name) {
      total++;
      let assignedArr = st.assigned ? st.assigned.split(',').map((s: string) => s.trim()) : [];
      const isOtFail = (st.assigned && st.assigned !== 'Hoàn thành' && st.lastOT && st.lastOT !== 'UNKNOWN' && !assignedArr.includes(st.lastOT));
      if (isOtFail) cOtfail++;

      if (st.bestScore === '') {
        cNone++;
      } else {
        scored++;
        sum += parseFloat(st.bestScore) || 0;
        const bc = badgeClass(st.bestScore, st.sumTotalTarget, st.lastOT || assignedArr[0]);

        if (bc === 'sbadge-high') { cPass++; pass++; }
        else if (bc === 'sbadge-mid') { cMid++; fail++; }
        else if (bc === 'sbadge-low') { cLow++; fail++; }

        if (isOtFail) otFailCount++;

        let gradeCat = getGradeCategory(st.bestScore, st.lastOT || assignedArr[0]);
        if (gradeCat === 'G') countG++;
        if (gradeCat === 'K') countK++;
        if (gradeCat === 'TB') countTB++;
        if (gradeCat === 'Y') countY++;

        topArr.push({ pc: st.pc, name: st.name, score: st.bestScore, timeSec: st.timeSec });
      }
    }
  });

  const avgScore = scored ? Math.round(sum / scored) : '—';

  // Top 5 Vinh danh
  topArr.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSec - b.timeSec;
  });
  const topFive = topArr.slice(0, 5);

  const selectedStudent = originalStudents.find(s => s.pc === selectedPC);
  const selectedAssignedArr = selectedStudent?.assigned ? selectedStudent.assigned.split(',').map((s: string) => s.trim()) : [];
  const selectedBc = selectedStudent ? badgeClass(selectedStudent.bestScore, selectedStudent.sumTotalTarget, selectedStudent.lastOT || selectedAssignedArr[0]) : '';

  let selectedScoreColor = 'var(--gray-700)';
  if (selectedBc === 'sbadge-high') selectedScoreColor = 'var(--green)';
  if (selectedBc === 'sbadge-mid') selectedScoreColor = 'var(--amber)';
  if (selectedBc === 'sbadge-low') selectedScoreColor = 'var(--red)';

  const selectedOtMatchClass = (selectedStudent?.lastOT !== '' && selectedStudent?.assigned !== '')
    ? (selectedAssignedArr.includes(selectedStudent?.lastOT) ? 'chip-green' : 'chip-red')
    : 'chip-gray';

  const selectedPct = (selectedStudent?.bestScore !== '' && selectedStudent?.max)
    ? Math.round((selectedStudent.bestScore / selectedStudent.max) * 100)
    : null;

  const portalContainer = document.getElementById('dashboard-navbar-portal');

  return (
    <div className="teacher-dashboard-page" style={{ background: 'var(--gray-100)', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {portalContainer && createPortal(
        <div className="classroom-tools-capsule">
          <button className="nav-portal-btn" onClick={openListModal}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}><path d="M4 6h12M4 10h12M4 14h7" strokeLinecap="round" /></svg>
            Danh sách HS
          </button>



          {/* Scoring Toggle */}
          <button
            className="nav-portal-btn"
            id="scoringToggle"
            onClick={toggleScoring}
            title={isScoringOther ? `Lớp ${scoringClass} đang nhận điểm` : ''}
            style={{
              color: isScoringActive ? 'var(--success)' : (isScoringOther ? 'var(--danger)' : 'var(--text-secondary)'),
              background: isScoringActive ? 'rgba(5, 150, 105, 0.08)' : (isScoringOther ? 'rgba(220, 38, 38, 0.08)' : 'transparent'),
              fontWeight: (isScoringActive || isScoringOther) ? 700 : 500,
            }}
          >
            {isScoringActive ? '🟢 Đang nhận điểm' : (isScoringOther ? `🔴 Lớp ${scoringClass} đang nhận` : '⚪ Bật nhận điểm')}
          </button>

          {/* DROPDOWN: Công cụ */}
          <div ref={toolsDropdownRef} className="toolbar-dropdown" style={{ position: 'relative' }}>
            <button
              className="nav-portal-btn"
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              style={{
                color: showToolsDropdown ? 'var(--primary-color)' : 'var(--text-secondary)',
                background: showToolsDropdown ? 'rgba(26, 115, 232, 0.08)' : 'transparent',
                fontWeight: showToolsDropdown ? 700 : 500,
              }}
            >
              ⚙️ Công cụ ▾
            </button>
            {showToolsDropdown && (
              <div className="toolbar-dropdown-menu" style={{ display: 'block', right: 0, left: 'auto', top: 'calc(100% + 8px)' }}>
                <button className="dd-item" onClick={() => { openBulkGeneric('bulk_target', '🎯 Đặt mục tiêu hàng loạt'); setShowToolsDropdown(false); }}>🎯 Đặt mục tiêu hàng loạt</button>
                <button className="dd-item dd-danger" onClick={() => { openBulkGeneric('clear_bulk_target', '🚫 Xoá mục tiêu hàng loạt'); setShowToolsDropdown(false); }}>🚫 Xoá mục tiêu hàng loạt</button>
                <div className="dd-sep"></div>
                <button className="dd-item" onClick={() => { openBulkGeneric('bulk_ot', '📋 Giao bài hàng loạt'); setShowToolsDropdown(false); }}>📋 Giao bài hàng loạt</button>
                <button className="dd-item dd-danger" onClick={() => { openBulkGeneric('clear_bulk_ot', '🚫 Huỷ giao bài hàng loạt'); setShowToolsDropdown(false); }}>🚫 Huỷ giao bài hàng loạt</button>
                <div className="dd-sep"></div>
                <a className="dd-item" href={exportExcelUrl(tenLop)} target="_blank" rel="noopener noreferrer" onClick={() => setShowToolsDropdown(false)}>📊 Xuất Excel</a>
                <div className="dd-sep"></div>
                <button className="dd-item dd-danger" onClick={() => { deleteClassAllScores(); setShowToolsDropdown(false); }}>🗑️ Xóa toàn bộ điểm</button>
              </div>
            )}
          </div>
        </div>,
        portalContainer
      )}

      {/* LAYOUT BODY */}
      <div className="layout" style={{ height: '100%' }}>

        {/* SIDEBAR */}
        <div className="sidebar">

          {/* Lớp & Thông tin chung (Phương án 1) */}
          <div className="sb-section" style={{ borderBottom: '2px dashed var(--gray-200)', background: 'rgba(37, 99, 235, 0.04)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--blue)' }}>
                🏫 Lớp {tenLop}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-lt)', padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                IC3 ACTIVE
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: 'var(--gray-500)', fontWeight: 700 }}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" style={{ width: 12, height: 12, display: 'inline' }}><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2 2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>{lastUpdate || 'Vừa cập nhật'}</span>
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">Thống kê nhanh</div>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-val">{scored}</div><div className="stat-lbl">Có điểm</div></div>
              <div className="stat-card"><div className="stat-val">{total}</div><div className="stat-lbl">Học sinh</div></div>
              <div className="stat-card"><div className="stat-val green">{avgScore}</div><div className="stat-lbl">Điểm TB</div></div>
              <div className="stat-card"><div className="stat-val amber">{pass}</div><div className="stat-lbl">Đạt mục tiêu</div></div>
              <div className="stat-card"><div className="stat-val red">{fail}</div><div className="stat-lbl">Chưa đạt</div></div>
              <div className="stat-card"><div className="stat-val red">{otFailCount}</div><div className="stat-lbl">Sai bài thi</div></div>
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">Sắp Xếp Dữ Liệu</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button className={`btn ${currentSort === 'score_desc' ? 'active' : ''}`} onClick={() => handleSortChange('score_desc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>🔽 Điểm Cao</button>
              <button className={`btn ${currentSort === 'score_asc' ? 'active' : ''}`} onClick={() => handleSortChange('score_asc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>🔼 Điểm Thấp</button>
              <button className={`btn ${currentSort === 'time_asc' ? 'active' : ''}`} onClick={() => handleSortChange('time_asc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>⚡ Nhanh nhất</button>
              <button className={`btn ${currentSort === 'pc_asc' ? 'active' : ''}`} onClick={() => handleSortChange('pc_asc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>💻 Số máy</button>
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">Sắp xếp vị trí</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button className={`btn ${currentSort === 'seat_asc' ? 'active' : ''}`} onClick={() => handleSortChange('seat_asc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>🪑 Sơ đồ</button>
              <button className={`btn ${currentSort === 'list_asc' ? 'active' : ''}`} onClick={() => handleSortChange('list_asc')} style={{ padding: '8px 8px', fontSize: '13.5px', gap: '6px' }}>📋 Danh sách</button>
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">Biểu đồ Phổ Điểm</div>
            <div className="dist-row">
              <div className="dist-lbl">Giỏi</div>
              <div className="prog-wrap" style={{ flex: 1 }}>
                <div className="prog-bar" style={{ background: '#1e8e3e', width: scored ? `${(countG / scored) * 100}%` : '0%' }}></div>
              </div>
              <div className="dist-val">{countG}</div>
            </div>
            <div className="dist-row">
              <div className="dist-lbl">Khá</div>
              <div className="prog-wrap" style={{ flex: 1 }}>
                <div className="prog-bar" style={{ background: '#f1c40f', width: scored ? `${(countK / scored) * 100}%` : '0%' }}></div>
              </div>
              <div className="dist-val">{countK}</div>
            </div>
            <div className="dist-row">
              <div className="dist-lbl">TB</div>
              <div className="prog-wrap" style={{ flex: 1 }}>
                <div className="prog-bar" style={{ background: '#e67e22', width: scored ? `${(countTB / scored) * 100}%` : '0%' }}></div>
              </div>
              <div className="dist-val">{countTB}</div>
            </div>
            <div className="dist-row">
              <div className="dist-lbl">Yếu</div>
              <div className="prog-wrap" style={{ flex: 1 }}>
                <div className="prog-bar" style={{ background: '#d93025', width: scored ? `${(countY / scored) * 100}%` : '0%' }}></div>
              </div>
              <div className="dist-val">{countY}</div>
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">🏆 Bảng Vinh Danh (Top 5)</div>
            <div id="topStudentsList">
              {topFive.map((top, idx) => {
                const rClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : 'rank-n'));
                return (
                  <div className="top-item" key={top.pc} onClick={() => selectRow(top.pc)}>
                    <span className={`top-rank ${rClass}`}>{idx + 1}</span>
                    <span className="top-name">
                      {top.name} <span style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 'normal' }}>(Máy {top.pc})</span>
                    </span>
                    <span className="top-score">{top.score}</span>
                  </div>
                );
              })}
              {topFive.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '13px', fontStyle: 'italic', padding: '10px 0' }}>Chưa có học sinh nộp bài</div>
              )}
            </div>
          </div>

          <div className="sb-section">
            <div className="sb-title">Tìm kiếm</div>
            <div className="inp-row">
              <input
                className="inp"
                placeholder="Nhập tên / số máy..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
              />
            </div>
          </div>

          <div className="sb-section" style={{ flex: 1 }}>
            <div className="sb-title">Chú thích & Lọc Nhanh</div>
            <div className="legend" style={{ fontStyle: 'italic', fontSize: '12px', marginBottom: '8px', color: 'var(--gray-500)' }}>* Bấm vào từng mục để lọc danh sách</div>
            <div className="legend">
              <div className={`leg-filter ${currentLegendFilter === 'pass' ? 'active' : ''}`} onClick={() => handleLegendFilterChange('pass')}>
                <div className="ldot" style={{ background: '#e6f4ea', border: '2px solid #1e8e3e' }}></div>
                Đạt mục tiêu / Tốt <span className="leg-count">({cPass})</span>
              </div>
              <div className={`leg-filter ${currentLegendFilter === 'mid' ? 'active' : ''}`} onClick={() => handleLegendFilterChange('mid')}>
                <div className="ldot" style={{ background: '#fef7e0', border: '2px solid #e37400' }}></div>
                Gần đạt (60-79%) <span className="leg-count">({cMid})</span>
              </div>
              <div className={`leg-filter ${currentLegendFilter === 'low' ? 'active' : ''}`} onClick={() => handleLegendFilterChange('low')}>
                <div className="ldot" style={{ background: '#fce8e6', border: '2px solid #d93025' }}></div>
                Chưa đạt (&lt;60%) <span className="leg-count">({cLow})</span>
              </div>
              <div className={`leg-filter ${currentLegendFilter === 'none' ? 'active' : ''}`} onClick={() => handleLegendFilterChange('none')}>
                <div className="ldot" style={{ background: '#f1f3f4', border: '2px solid #dadce0' }}></div>
                Chưa làm bài <span className="leg-count">({cNone})</span>
              </div>
              <div className={`leg-filter ${currentLegendFilter === 'otfail' ? 'active' : ''}`} onClick={() => handleLegendFilterChange('otfail')}>
                <div className="ldot" style={{ background: '#fce8e6', border: '2px dashed #d93025' }}></div>
                Thi sai bài giao <span className="leg-count">({cOtfail})</span>
              </div>
            </div>
          </div>

        </div>

        {/* MAIN TABLE */}
        <div className="content">
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px', cursor: 'pointer' }} onClick={togglePositionSort} title="Nhấn để đổi kiểu sắp xếp (Theo Sơ đồ / Danh sách)">Vị trí 🔃</th>
                  <th>Họ và tên</th>
                  <th style={{ width: '240px' }}>Điểm Đã Thi</th>
                  <th style={{ width: '120px' }}>MAX</th>
                  <th style={{ width: '80px' }}>Lần thi</th>
                  <th style={{ minWidth: '90px' }}>Mục tiêu</th>
                  <th style={{ minWidth: '130px' }}>Bài giao</th>
                  <th style={{ width: '100px' }}>Đã thi</th>
                  <th style={{ width: '100px' }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => {
                  let assignedStr = st.assigned || '';
                  let assignedArr = assignedStr ? assignedStr.split(',').map((s: string) => s.trim()) : [];
                  const bc = badgeClass(st.bestScore, st.sumTotalTarget, st.lastOT || assignedArr[0]);
                  const rc = (st.name && st.bestScore !== '') ? 'row-high' : '';
                  const isCompleted = assignedStr === 'Hoàn thành';
                  const otWarn = !isCompleted && assignedStr && st.lastOT && st.lastOT !== 'UNKNOWN' && !assignedArr.includes(st.lastOT);
                  const otClass = st.lastOT ? (assignedStr ? (isCompleted || assignedArr.includes(st.lastOT) ? 'ot-match' : 'ot-mismatch') : 'ot-none') : 'ot-none';
                  const isSelected = selectedPC === st.pc;

                  let allScrDisplay: React.ReactNode = '—';
                  if (st.scoresByOT) {
                    const otKeys = Object.keys(st.scoresByOT);
                    allScrDisplay = (
                      <span>
                        {otKeys.map((ot, oIdx) => {
                          const scoresStr = st.scoresByOT[ot].join(' | ');
                          return (
                            <React.Fragment key={ot}>
                              {oIdx > 0 && <span style={{ color: 'var(--gray-400)', fontWeight: 400, margin: '0 4px' }}>,</span>}
                              <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{ot}</span>
                              <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>:</span> {scoresStr}
                            </React.Fragment>
                          );
                        })}
                      </span>
                    );
                  }

                  const pcFmt = 'PC' + st.pc.toString().padStart(2, '0');
                  return (
                    <tr
                      key={st.pc}
                      id={`row-pc${st.pc}`}
                      className={`${rc}${isSelected ? ' sel-row' : ''}`}
                      onClick={() => selectRow(st.pc)}
                    >
                      <td><div className={`pc-badge ${!st.name ? 'empty' : ''}`} style={{ width: '55px' }}>{pcFmt}</div></td>
                      <td
                        className={`name-cell ${!st.name ? 'no-name' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        spellCheck={false}
                        onFocus={() => setIsTyping(true)}
                        onBlur={(e) => { setIsTyping(false); saveNameSingle(st.pc, e.target.textContent || ''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                        style={{ cursor: 'text' }}
                        title="Nhấn để sửa tên"
                      >
                        {st.name || ''}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--blue-dk)', fontWeight: 600, fontSize: '14px', lineHeight: '1.4' }}>{allScrDisplay}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          className={`sbadge ${bc}`}
                          style={{ width: '75px', textAlign: 'center', border: '1px dashed transparent', outline: 'none', cursor: 'text', fontFamily: 'inherit' }}
                          type="text"
                          defaultValue={st.bestScoreDisplay || ''}
                          placeholder="—"
                          onFocus={(e) => { setIsTyping(true); e.target.style.borderColor = 'var(--gray-500)'; }}
                          onBlur={(e) => { setIsTyping(false); e.target.style.borderColor = 'transparent'; saveManualScore(st.pc, e.target.value, st.bestScoreDisplay); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                          title="Nhập / Sửa điểm thủ công (Nhấn Enter để lưu)"
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--gray-700)', fontWeight: 700, fontSize: '15px' }}>{st.attempts > 0 ? st.attempts : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          className="tgt-inp"
                          type="text"
                          defaultValue={st.targetDisplay || ''}
                          placeholder="—"
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); saveTargetScore(st.pc, e.target.value); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                          style={{ width: '65px', textAlign: 'center' }}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          className={`ot-sel ${otWarn ? 'ot-warn' : ''} ${isCompleted ? 'ot-done' : ''}`}
                          style={{ width: '100px', textAlign: 'center', border: '1px solid transparent', outline: 'none', background: 'transparent' }}
                          type="text"
                          defaultValue={assignedStr}
                          placeholder="--"
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); saveOTConfigSingle(st.pc, e.target.value); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as any).blur(); }}
                        />
                      </td>
                      <td className={otClass} style={{ textAlign: 'center' }}>{st.lastOT || '—'}</td>
                      <td className="time-cell" style={{ textAlign: 'center' }}>{st.time || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className={`detail-panel${isDetailOpen ? '' : ' collapsed'}`} aria-hidden={!isDetailOpen}>
          <div className="detail-panel-inner">
            <div className="dp-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div className="dp-title" style={{ margin: 0 }}>Chi tiết học sinh</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsDetailOpen(false); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px' }}
                  title="Thu nhỏ bảng chi tiết"
                  className="detail-collapse-btn"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
              <div id="detailContent">
                {selectedStudent ? (
                  <>
                    <div style={{ textAlign: 'center', padding: '10px 0 12px' }}>
                      <div className="avatar">{selectedStudent.pc}</div>
                      <div className="dp-name">{selectedStudent.name || '(Chưa có tên)'}</div>
                      <div className="dp-sub">Máy số {selectedStudent.pc}</div>
                    </div>
                    <div style={{ background: 'var(--gray-50)', borderRadius: '10px', padding: '14px', marginBottom: '12px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
                      <div className="big-score" style={{ color: selectedScoreColor }}>{selectedStudent.bestScore !== '' ? selectedStudent.bestScore : '—'}</div>
                      <div className="big-max">/ {selectedStudent.max || '?'} điểm</div>
                      {selectedPct !== null && (
                        <>
                          <div className="prog-wrap"><div className="prog-bar" style={{ width: `${selectedPct}%`, background: selectedScoreColor }}></div></div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-600)', textAlign: 'right', marginTop: '4px' }}>{selectedPct}%</div>
                        </>
                      )}
                    </div>
                    <div className="dp-row"><span className="dp-lbl">Mục tiêu</span><span className="dp-val">{selectedStudent.target || '—'}</span></div>
                    <div className="dp-row"><span className="dp-lbl">Bài được giao</span><span className="dp-val">{selectedStudent.assigned || '—'}</span></div>
                    <div className="dp-row">
                      <span className="dp-lbl">Bài đã thi</span>
                      <span className={`chip ${selectedOtMatchClass}`} style={{ fontSize: '13px' }}>{selectedStudent.lastOT || '—'}</span>
                    </div>
                    <div className="dp-row"><span className="dp-lbl">Thời gian</span><span className="dp-val">{selectedStudent.time || '—'}</span></div>
                    <div className="dp-row"><span className="dp-lbl">Số lần thi</span><span className="dp-val">{selectedStudent.attempts || 0} lần</span></div>

                    <button
                      className="btn btn-red btn-sm"
                      onClick={() => deleteStudentScores(selectedStudent.pc)}
                      style={{ width: '100%', marginTop: '15px' }}
                    >
                      🗑️ Xoá toàn bộ điểm máy này
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-500)', fontSize: '14px', fontStyle: 'italic' }}>Nhấn vào một học sinh để xem chi tiết</div>
                )}
              </div>
            </div>

            <div className="dp-section">
              <div className="dp-title">Tất cả lần thi</div>
              <div id="allScores" style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                {selectedStudent ? (
                  selectedStudent.scoresByOT ? (
                    Object.keys(selectedStudent.scoresByOT).map((ot) => (
                      <div style={{ marginBottom: '8px' }} key={ot}>
                        <span style={{ fontWeight: 'bold', color: 'var(--gray-700)', marginRight: '8px' }}>{ot}:</span>
                        {selectedStudent.scoresByOT[ot].map((s: string, idx: number) => (
                          <span className="chip chip-blue" style={{ margin: '3px', fontSize: '13px', padding: '3px 10px' }} key={idx}>Lần {idx + 1}: {s}</span>
                        ))}
                      </div>
                    ))
                  ) : selectedStudent.allScr ? (
                    selectedStudent.allScr.split('|').map((s: string, idx: number) => (
                      <span className="chip chip-blue" style={{ margin: '3px', fontSize: '13px', padding: '3px 10px' }} key={idx}>Lần {idx + 1}: {s.trim()}</span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Chưa có dữ liệu</span>
                  )
                ) : '—'}
              </div>
            </div>

            <div className="dp-section" style={{ flex: 1 }}>
              <div className="dp-title">Lịch sử thao tác</div>
              <div id="actionLog" style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 2 }}>
                {actionLogs.length > 0 ? (
                  actionLogs.map((log, idx) => <div key={idx}>{log}</div>)
                ) : 'Chưa có thao tác.'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SPREADSHEET STYLE STUDENT LIST MODAL */}
      {showListModal && (
        <div className="modal-bg open" id="listModalBg" onClick={(e) => { if (e.target === e.currentTarget) setShowListModal(false); }}>
          <div className="custom-modal" style={{ width: '95vw', maxWidth: '1400px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div className="modal-title" style={{ marginBottom: 0 }}>📊 Danh sách học sinh</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span id="sheetInfo" style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>{sheetLines.length} học sinh</span>
                <button className="btn btn-sm btn-green" onClick={addSheetRow}>➕ Thêm dòng</button>
                <button className="btn btn-sm" onClick={clearSheetData} style={{ color: 'var(--red)' }}>🗑️ Xoá hết</button>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '10px', lineHeight: 1.5 }}>
              💡 <b>Copy từ Google Sheet</b> → click vào bảng rồi ấn <b>Ctrl+V</b> để dán. Hệ thống tự nhận diện cột Họ tên, PC, Bài giao, Mục tiêu.
            </div>

            {/* Spreadsheet Grid */}
            <div
              id="sheetContainer"
              onPaste={handlePasteList}
              style={{ flex: 1, overflow: 'auto', border: '2px solid var(--gray-300)', borderRadius: '8px', background: '#fff', minHeight: '400px', position: 'relative' }}
            >
              <table id="sheetTable" className="sheet-table">
                <thead>
                  <tr>
                    <th className="sheet-row-num">#</th>
                    <th className="sheet-pc-hdr">Vị trí (PC)</th>
                    <th>Họ và tên</th>
                    <th className="sheet-ot-hdr">Bài giao</th>
                    <th className="sheet-target-hdr">Mục tiêu</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetLines.map((line, idx) => {
                    const cols = line.split('\t');

                    let pcVal = cols.find(c => /^PC\d+/i.test(c.trim())) || '';
                    if (!pcVal && cols.length > 0) {
                      // Attempt positional fallback
                      if (sheetFormat === 'full') pcVal = cols[4] || '';
                      else if (sheetFormat === 'partial') pcVal = cols[8] || '';
                    }

                    let nameVal = cols[0] || '';
                    if (sheetFormat === 'full') nameVal = cols[18] || '';

                    let otVal = '';
                    let targetVal = '';
                    if (sheetFormat === 'full') {
                      otVal = cols[26] || '';
                      targetVal = cols[27] || '';
                    } else if (sheetFormat === 'partial') {
                      otVal = cols[9] || '';
                      targetVal = cols[10] || '';
                    } else if (cols.length > 2) {
                      otVal = cols[2] || '';
                      targetVal = cols[3] || '';
                    }

                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td
                          className="col-pc"
                          contentEditable
                          suppressContentEditableWarning
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); updateSheetCell(idx, sheetFormat === 'full' ? 4 : (sheetFormat === 'partial' ? 8 : 1), e.target.textContent || ''); }}
                        >
                          {pcVal}
                        </td>
                        <td
                          className="col-name"
                          contentEditable
                          suppressContentEditableWarning
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); updateSheetCell(idx, sheetFormat === 'full' ? 18 : 0, e.target.textContent || ''); }}
                        >
                          {nameVal}
                        </td>
                        <td
                          contentEditable
                          suppressContentEditableWarning
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); updateSheetCell(idx, sheetFormat === 'full' ? 26 : (sheetFormat === 'partial' ? 9 : 2), e.target.textContent || ''); }}
                        >
                          {otVal}
                        </td>
                        <td
                          className="col-target"
                          contentEditable
                          suppressContentEditableWarning
                          onFocus={() => setIsTyping(true)}
                          onBlur={(e) => { setIsTyping(false); updateSheetCell(idx, sheetFormat === 'full' ? 27 : (sheetFormat === 'partial' ? 10 : 3), e.target.textContent || ''); }}
                        >
                          {targetVal}
                        </td>
                      </tr>
                    );
                  })}
                  {sheetLines.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                        Chưa có dữ liệu. Hãy copy từ Google Sheet rồi paste trực tiếp vào đây.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-foot" style={{ marginTop: '12px' }}>
              <button className="btn" onClick={() => setShowListModal(false)}>Đóng</button>
              <button className="btn btn-primary" onClick={saveList}>💾 Lưu danh sách</button>
            </div>
          </div>
        </div>
      )}

      {/* IP MANAGEMENT MODAL */}
      {showIpModal && (
        <div className="modal-bg open" id="ipModalBg" onClick={(e) => { if (e.target === e.currentTarget) setShowIpModal(false); }}>
          <div className="custom-modal" style={{ width: '90vw', maxWidth: '1100px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div className="modal-title" style={{ marginBottom: 0 }}>🌐 Quản lý IP Máy Học Sinh</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span id="ipCount" style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 600 }}>{ipCount} máy đã nhận</span>
                <span id="ipLastUpdate" style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{ipLastUpdate}</span>
              </div>
            </div>

            {/* Server IP & BAT generation */}
            <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)', borderRadius: '10px', padding: '16px', marginBottom: '14px', border: '1px solid #c8e6c9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#2e7d32', marginBottom: '6px' }}>📡 IP Máy Chủ (Server)</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className="inp"
                      type="text"
                      value={serverIP}
                      onChange={(e) => setServerIP(e.target.value)}
                      placeholder="Đang phát hiện..."
                      style={{ maxWidth: '200px', fontSize: '15px', fontWeight: 700, textAlign: 'center' }}
                    />
                    <button className="btn btn-green btn-sm" onClick={generateBat} style={{ whiteSpace: 'nowrap' }}>⚡ Tạo file lay_ip.bat</button>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#558b2f', lineHeight: 1.6, maxWidth: '400px' }}>
                  💡 <b>Quy trình:</b> Tạo file → Gửi qua NetSupport → Học sinh chạy → IP tự cập nhật<br />
                  📁 File sẽ được lưu tại thư mục backend của <code>ic3-manager</code>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-green" onClick={loadIPMapping}>🔄 Làm mới danh sách IP</button>
              <button className="btn btn-red btn-sm" onClick={clearIPMapping}>🗑️ Xoá tất cả IP</button>
              <div className="spacer"></div>
              <a href="/lay_ip.bat" download className="btn btn-sm" style={{ textDecoration: 'none' }}>📥 Tải lay_ip.bat</a>
            </div>

            {/* IP Table */}
            <div style={{ flex: 1, overflow: 'auto', border: '2px solid var(--gray-300)', borderRadius: '8px', background: '#fff', minHeight: '300px' }}>
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    <th style={{ width: '100px' }}>Tên máy</th>
                    <th style={{ width: '80px' }}>Số PC</th>
                    <th>Địa chỉ IP</th>
                    <th style={{ width: '200px' }}>Học sinh (nếu có)</th>
                    <th style={{ width: '80px' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {ipList.map((ipObj, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{ipObj.pcName}</td>
                      <td>PC{String(ipObj.pcNum).padStart(2, '0')}</td>
                      <td>{ipObj.ip || '—'}</td>
                      <td>{originalStudents.find(s => s.pc === ipObj.pcNum)?.name || '—'}</td>
                      <td>
                        <span className={`chip ${ipObj.ip ? 'chip-green' : 'chip-gray'}`}>
                          {ipObj.ip ? 'Kết nối' : 'Ngoại tuyến'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ipList.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                        Nhấn "Làm mới" để tải dữ liệu IP
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-foot" style={{ marginTop: '12px' }}>
              <button className="btn" onClick={() => setShowIpModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERIC DIALOG MODAL */}
      {showGenericModal && (
        <div className="modal-bg open" id="modalBg" onClick={(e) => { if (e.target === e.currentTarget) setShowGenericModal(false); }}>
          <div className="custom-modal">
            <div className="modal-title" id="modalTitle">{modalTitle}</div>
            <div id="modalBody">
              {['bulk_target', 'bulk_ot'].includes(modalType) ? (
                <div style={{ padding: '15px 0' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Nhập giá trị áp dụng:</label>
                  <input
                    type="text"
                    className="inp"
                    value={modalInputVal}
                    onChange={(e) => setModalInputVal(e.target.value)}
                    placeholder={modalType === 'bulk_target' ? 'Ví dụ: 950' : 'Ví dụ: OT1, OT2'}
                    style={{ width: '100%' }}
                  />
                </div>
              ) : (
                <div style={{ padding: '15px 0', color: 'var(--red)', fontWeight: 600 }}>
                  Bạn có chắc chắn muốn xoá cấu hình này cho TOÀN BỘ học sinh trong lớp? Hành động này không thể khôi phục!
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowGenericModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleBulkGenericApply}>Áp dụng</button>
            </div>
          </div>
        </div>
      )}


      {/* TAB MÉP PHẢI: mở lại bảng chi tiết học sinh */}
      <button
        type="button"
        onClick={() => setIsDetailOpen(true)}
        className={`detail-edge-tab${isDetailOpen ? ' hidden' : ''}`}
        title="Mở bảng chi tiết học sinh"
        aria-label="Mở bảng chi tiết học sinh"
        tabIndex={isDetailOpen ? -1 : 0}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>

    </div>
  );
};

export default Dashboard;
