const QUIZ = {{QUIZ_DATA_JSON}};

// Safe localStorage wrappers to avoid SecurityError in file:// protocol
function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn("localStorage.getItem blocked:", e);
        return null;
    }
}

function safeSetItem(key, val) {
    try {
        localStorage.setItem(key, val);
    } catch (e) {
        console.warn("localStorage.setItem blocked:", e);
    }
}

let currentIdx = 0;
let answers = {}; // questionId: selectedOption
let flaggedSet = new Set(); // index of flagged questions
let timer = null;
let timeRemaining = QUIZ.time_limit * 60; // in seconds
let cheatWarnings = 0;
const apiBaseUrl = "{{SERVER_URL}}";
const apiFallbackUrl = "{{FALLBACK_URL}}";
let activeApiUrl = apiBaseUrl; // Sẽ tự động chuyển sang fallback nếu hostname không kết nối được

/**
 * Smart fetch: thử hostname trước, nếu lỗi thì tự động chuyển sang IP fallback.
 * Sau khi fallback thành công, tất cả request tiếp theo sẽ dùng IP luôn.
 */
async function smartFetch(path, options = {}) {
    const url = activeApiUrl + path;
    try {
        const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
        return res;
    } catch (err) {
        // Nếu đang dùng hostname mà lỗi → thử fallback sang IP
        if (activeApiUrl === apiBaseUrl && apiFallbackUrl && apiFallbackUrl !== apiBaseUrl) {
            console.warn(`Hostname ${apiBaseUrl} không kết nối được, chuyển sang IP: ${apiFallbackUrl}`);
            activeApiUrl = apiFallbackUrl;
            const fallbackUrl = activeApiUrl + path;
            return fetch(fallbackUrl, options);
        }
        throw err;
    }
}
let pcName = "";
let studentName = "";
let className = "";
let isSubmitted = false;
let isViewingSummary = false;
let isReviewMode = false;
let theme = safeGetItem('theme') || 'light';

// Custom Dialog State
let customDialogCallback = null;
let customConfirmCallback = null;

function showSystemAlert(title, message, callback = null) {
    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const modalEl = document.getElementById('custom-dialog');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message.replace(/\n/g, '<br>');
    if (modalEl) modalEl.classList.remove('hide');
    customDialogCallback = callback;
}

function closeCustomDialog() {
    const modalEl = document.getElementById('custom-dialog');
    if (modalEl) modalEl.classList.add('hide');
    if (customDialogCallback) {
        const cb = customDialogCallback;
        customDialogCallback = null;
        cb();
    }
}

function showSystemConfirm(title, message, callback) {
    const titleEl = document.getElementById('custom-confirm-title');
    const msgEl = document.getElementById('custom-confirm-message');
    const modalEl = document.getElementById('custom-confirm');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = message.replace(/\n/g, '<br>');
    if (modalEl) modalEl.classList.remove('hide');
    customConfirmCallback = callback;
}

function closeCustomConfirm(result) {
    const modalEl = document.getElementById('custom-confirm');
    if (modalEl) modalEl.classList.add('hide');
    if (customConfirmCallback) {
        const cb = customConfirmCallback;
        customConfirmCallback = null;
        cb(result);
    }
}

// Dropdown data lists
let schoolsList = [];
let classesList = [];
let studentsList = [];

// Selected IDs
let selectedSchoolId = '';
let selectedClassId = '';
let selectedStudentId = '';

window.addEventListener('DOMContentLoaded', () => {
    // Apply theme on load
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon();

    // Initialize custom dropdown triggers
    setupDropdown('school-select', (val, text) => selectSchool(val, text));
    setupDropdown('class-select', (val, text) => selectClass(val, text));
    setupDropdown('student-select', (val, text) => selectStudent(val, text));
    setupDropdown('pc-select', (val, text) => selectPC(val, text));

    // Populate PC options
    populatePCOptions();

    // Auto connect to baked server URL on load
    connectServer();

    // Anti-cheat warning detection
    window.addEventListener('blur', () => {
        if (timer && !isSubmitted && !isReviewMode) {
            cheatWarnings++;
            showSystemAlert(
                "CẢNH BÁO GIAN LẬN",
                "Bạn đã rời khỏi tab thi. Số lần cảnh báo: " + cheatWarnings + "/3. Rời quá 3 lần, hệ thống sẽ tự động thu bài.",
                () => {
                    if (cheatWarnings >= 3) {
                        submitQuiz(true);
                    }
                }
            );
        }
    });

    // Block context menu
    document.addEventListener('contextmenu', e => e.preventDefault());
    // Block critical shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') || 
            (e.ctrlKey && e.key === 'u') ||
            (e.metaKey && e.altKey && e.key === 'i')) {
            e.preventDefault();
            showSystemAlert("CẢNH BÁO", "Tính năng kiểm tra mã nguồn bị chặn.");
        }
    });

    // Arrow keys and Enter navigation
    document.addEventListener('keydown', (e) => {
        if (isSubmitted || isViewingSummary) return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            nextQuestion();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevQuestion();
        }
    });
});

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    safeSetItem('theme', theme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        if (theme === 'light') {
            themeIcon.className = 'fa-solid fa-moon';
        } else {
            themeIcon.className = 'fa-solid fa-sun';
        }
    }
}

// Dropdown Helper Function
function setupDropdown(id, onSelectCallback) {
    const container = document.getElementById(id + '-container');
    const trigger = document.getElementById(id + '-trigger');
    const options = document.getElementById(id + '-options');
    
    trigger.onclick = (e) => {
        if (trigger.disabled) return;
        e.stopPropagation();
        
        // Close other dropdowns
        closeAllDropdowns(id);
        
        trigger.classList.toggle('open');
        options.classList.toggle('hide');
    };
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            trigger.classList.remove('open');
            options.classList.add('hide');
        }
    });
}

function closeAllDropdowns(exceptId) {
    const dropdowns = ['school-select', 'class-select', 'student-select', 'pc-select'];
    dropdowns.forEach(id => {
        if (id !== exceptId) {
            const trigger = document.getElementById(id + '-trigger');
            const options = document.getElementById(id + '-options');
            if (trigger) trigger.classList.remove('open');
            if (options) options.classList.add('hide');
        }
    });
}

// PC Select populate
function populatePCOptions() {
    const optionsContainer = document.getElementById('pc-select-options');
    optionsContainer.innerHTML = "";
    
    const savedPC = safeGetItem('standalone_pc_name') || "";
    
    for (let i = 1; i <= 50; i++) {
        const pcStr = "PC" + String(i).padStart(2, '0');
        const opt = document.createElement('div');
        opt.className = "custom-select-option";
        opt.textContent = pcStr;
        if (pcStr === savedPC) {
            opt.classList.add('selected');
            document.getElementById('pc-select-trigger-text').textContent = pcStr;
            pcName = pcStr;
        }
        opt.onclick = () => selectPC(pcStr);
        optionsContainer.appendChild(opt);
    }
}

function selectPC(name) {
    pcName = name;
    document.getElementById('pc-select-trigger-text').textContent = name;
    
    // Highlight selected
    const options = document.getElementById('pc-select-options').children;
    for (let opt of options) {
        if (opt.textContent === name) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    }
    
    document.getElementById('pc-select-options').classList.add('hide');
    document.getElementById('pc-select-trigger').classList.remove('open');
}

// Connect and pull Schools
async function connectServer() {
    const statusBanner = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-status-text');
    
    try {
        const res = await smartFetch('/api/public/schools');
        if (!res.ok) throw new Error("School API failed");
        
        schoolsList = await res.json();
        
        // Hide connection banner
        if (statusBanner) statusBanner.classList.add('hide');
        
        // Show school field and PC options
        document.getElementById('school-group').classList.remove('hide');
        document.getElementById('pc-group').classList.remove('hide');
        document.getElementById('start-btn').classList.remove('hide');
        
        populateSchools();
    } catch (e) {
        console.error("Connection error:", e);
        if (statusBanner) {
            statusBanner.classList.add('error');
            const icon = statusBanner.querySelector('.status-icon');
            if (icon) {
                icon.className = "fa-solid fa-circle-exclamation status-icon";
            }
        }
        if (statusText) {
            statusText.textContent = "Lỗi kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại.";
        }
    }
}

function populateSchools() {
    const container = document.getElementById('school-select-options');
    container.innerHTML = "";
    
    schoolsList.forEach(s => {
        const opt = document.createElement('div');
        opt.className = "custom-select-option";
        opt.textContent = s.school_name;
        opt.onclick = () => selectSchool(s.school_id, s.school_name);
        container.appendChild(opt);
    });
}

async function selectSchool(id, name) {
    selectedSchoolId = id;
    document.getElementById('school-select-trigger-text').textContent = name;
    document.getElementById('school-select-options').classList.add('hide');
    document.getElementById('school-select-trigger').classList.remove('open');
    
    // Clear and disable class / student
    selectedClassId = '';
    selectedStudentId = '';
    document.getElementById('class-select-trigger-text').textContent = "-- Chọn lớp học --";
    document.getElementById('class-select-trigger').disabled = true;
    document.getElementById('student-select-trigger-text').textContent = "-- Chọn tên của bạn --";
    document.getElementById('student-select-trigger').disabled = true;
    
    document.getElementById('class-group').classList.add('hide');
    document.getElementById('student-group').classList.add('hide');

    if (!id) return;
    
    // Fetch classes
    try {
        const res = await smartFetch(`/api/public/schools/${id}/classes`);
        if (!res.ok) throw new Error("Classes API failed");
        classesList = await res.json();
        
        document.getElementById('class-group').classList.remove('hide');
        document.getElementById('class-select-trigger').disabled = false;
        populateClasses();
    } catch (e) {
        console.error("Fetch classes failed:", e);
    }
}

function populateClasses() {
    const container = document.getElementById('class-select-options');
    container.innerHTML = "";
    
    classesList.forEach(c => {
        const opt = document.createElement('div');
        opt.className = "custom-select-option";
        opt.textContent = c.class_name;
        opt.onclick = () => selectClass(c.class_id, c.class_name);
        container.appendChild(opt);
    });
}

async function selectClass(id, name) {
    selectedClassId = id;
    className = name;
    document.getElementById('class-select-trigger-text').textContent = name;
    document.getElementById('class-select-options').classList.add('hide');
    document.getElementById('class-select-trigger').classList.remove('open');
    
    // Clear student
    selectedStudentId = '';
    document.getElementById('student-select-trigger-text').textContent = "-- Chọn tên của bạn --";
    document.getElementById('student-select-trigger').disabled = true;
    document.getElementById('student-group').classList.add('hide');

    if (!id) return;

    // Fetch students
    try {
        const res = await smartFetch(`/api/public/classes/${id}/students`);
        if (!res.ok) throw new Error("Students API failed");
        studentsList = await res.json();
        
        document.getElementById('student-group').classList.remove('hide');
        document.getElementById('student-select-trigger').disabled = false;
        populateStudents();
    } catch (e) {
        console.error("Fetch students failed:", e);
    }
}

function populateStudents() {
    const container = document.getElementById('student-select-options');
    container.innerHTML = "";
    
    studentsList.forEach(s => {
        const opt = document.createElement('div');
        opt.className = "custom-select-option";
        opt.textContent = s.full_name;
        opt.onclick = () => selectStudent(s.student_id, s.full_name);
        container.appendChild(opt);
    });
}

function selectStudent(id, name) {
    selectedStudentId = id;
    studentName = name;
    document.getElementById('student-select-trigger-text').textContent = name;
    document.getElementById('student-select-options').classList.add('hide');
    document.getElementById('student-select-trigger').classList.remove('open');
}

function startQuiz() {
    if (!selectedSchoolId || !selectedClassId || !selectedStudentId) {
        showSystemAlert("Thông báo", "Vui lòng hoàn thành chọn thông tin Trường, Lớp và Họ tên.");
        return;
    }
    if (!pcName) {
        showSystemAlert("Thông báo", "Vui lòng chọn số máy phòng thi.");
        return;
    }

    safeSetItem('standalone_pc_name', pcName);

    // Set UI details
    document.getElementById('display-pc').textContent = pcName;
    document.getElementById('user-info-tag').querySelector('.user-name').textContent = studentName;
    document.getElementById('user-info-tag').querySelector('.user-status').textContent = "Đang thi";

    // Set ornament background URL
    const mainArea = document.getElementById('quiz-main-area');
    if (mainArea) {
        mainArea.style.setProperty('--bg-ornament-url', `url('${activeApiUrl}/bg_ornament.png')`);
    }

    // Transition viewports
    document.getElementById('registration-viewport').classList.add('hide');
    document.getElementById('exam-viewport').classList.remove('hide');

    // Render first question
    renderQuestion(0);
    renderSidebarGrid();

    // Start countdown
    startTimer();
}

function startTimer() {
    const countdownEl = document.getElementById('countdown');
    timer = setInterval(() => {
        if (timeRemaining <= 0) {
            clearInterval(timer);
            showSystemAlert("Hết giờ làm bài", "Hết giờ làm bài! Bài của bạn đang được tự động nộp.", () => {
                submitQuiz(true);
            });
        } else {
            timeRemaining--;
            let min = Math.floor(timeRemaining / 60);
            let sec = timeRemaining % 60;
            countdownEl.textContent = String(min).padStart(2, '0') + ":" + String(sec).padStart(2, '0');
            if (timeRemaining <= 300) {
                countdownEl.classList.add('critical');
            }
        }
    }, 1000);
}

function renderQuestion(idx) {
    if (idx < 0 || idx >= QUIZ.questions.length) return;
    currentIdx = idx;
    const q = QUIZ.questions[idx];
    const qType = (q.type || "").toLowerCase();

    // Update Header indexes
    document.getElementById('display-q-index').textContent = idx + 1;
    const progressPercent = ((idx + 1) / QUIZ.questions.length) * 100;
    document.getElementById('progress-bar-fill').style.width = progressPercent + "%";

    // Update Points
    document.getElementById('display-q-points').textContent = (q.points || 10) + " điểm";

    // Update Question text
    document.getElementById('question-text').textContent = q.text;

    // Display image if exists
    const imgContainer = document.getElementById('question-image-container');
    const imgEl = document.getElementById('question-image');
    
    // We only display the question-image-container if the type is NOT hotspot
    if (q.image && qType !== 'hotspot') {
        let fullUrl = q.image;
        if (!fullUrl.startsWith('http')) {
            fullUrl = activeApiUrl + q.image;
        }
        imgEl.src = fullUrl;
        imgContainer.classList.remove('hide');
    } else {
        imgContainer.classList.add('hide');
    }

    // Render options
    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = "";

    const studentAnswer = answers[q.id];

    // Read correct answer from base64 if in review mode
    let correctAns = null;
    if (isReviewMode) {
        try {
            correctAns = JSON.parse(atob(q.answer_b64));
        } catch(e) {}
    }

    if (qType === 'true_false' || qType === 'single_choice') {
        const opts = Array.isArray(q.options) ? q.options : [];
        opts.forEach(opt => {
            const button = document.createElement('button');
            button.type = "button";
            button.className = "option";
            
            const isSel = (studentAnswer === opt.id);
            const isCorr = (correctAns === opt.id);
            
            if (isSel) button.classList.add('selected');
            if (isReviewMode) {
                button.disabled = true;
                button.style.cursor = 'not-allowed';
                if (isCorr) {
                    button.classList.add('checked-correct');
                } else if (isSel) {
                    button.classList.add('checked-incorrect');
                }
            }
            
            button.onclick = isReviewMode ? null : () => selectSingleAnswer(q.id, opt.id);
            button.innerHTML = `<span class="radio-circle"></span> <span style="margin-left: 0.5rem;">${opt.text}</span>`;
            optContainer.appendChild(button);
        });
    } else if (qType === 'multiple_choice') {
        const opts = Array.isArray(q.options) ? q.options : [];
        const currentArr = Array.isArray(studentAnswer) ? studentAnswer : [];
        opts.forEach(opt => {
            const button = document.createElement('button');
            button.type = "button";
            button.className = "option";
            
            const isSel = currentArr.includes(opt.id);
            const isCorr = Array.isArray(correctAns) && correctAns.includes(opt.id);
            
            if (isSel) button.classList.add('selected');
            if (isReviewMode) {
                button.disabled = true;
                button.style.cursor = 'not-allowed';
                if (isCorr) {
                    button.classList.add('checked-correct');
                } else if (isSel) {
                    button.classList.add('checked-incorrect');
                }
            }
            
            button.onclick = isReviewMode ? null : () => selectMultipleAnswer(q.id, opt.id);
            button.innerHTML = `<span class="checkbox-square"></span> <span style="margin-left: 0.5rem;">${opt.text}</span>`;
            optContainer.appendChild(button);
        });
    } else if (qType === 'short_answer') {
        const input = document.createElement('input');
        input.type = "text";
        input.value = studentAnswer || "";
        input.placeholder = "Nhập câu trả lời của bạn ở đây...";
        input.className = "text-input-field";
        
        if (isReviewMode) {
            input.disabled = true;
            input.style.cursor = 'not-allowed';
            const isCorr = checkAnswer(qType, correctAns, studentAnswer);
            if (isCorr) {
                input.style.borderColor = '#16a34a';
                input.style.backgroundColor = 'rgba(22, 163, 74, 0.05)';
            } else {
                input.style.borderColor = '#ef4444';
                input.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            }
        }
        
        input.oninput = (e) => {
            answers[q.id] = e.target.value;
            updateSidebarBox(idx, e.target.value.trim() !== "");
        };
        optContainer.appendChild(input);
    } else if (qType === 'hotspot') {
        // RENDER HOTSPOT QUESTION
        const hotspotWrapper = document.createElement('div');
        hotspotWrapper.className = "hotspot-interactive-container";
        hotspotWrapper.style.width = "100%";
        hotspotWrapper.style.textAlign = "center";

        const imageWrapper = document.createElement('div');
        imageWrapper.className = "hotspot-student-image-wrapper";
        imageWrapper.style.position = "relative";
        imageWrapper.style.display = "inline-block";
        imageWrapper.style.cursor = isReviewMode ? "default" : "crosshair";

        const img = document.createElement('img');
        let fullUrl = q.image;
        if (!fullUrl.startsWith('http')) {
            fullUrl = activeApiUrl + q.image;
        }
        img.src = fullUrl;
        img.style.display = "block";
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";

        // Read selectable zones / options
        let selectableZones = [];
        let hasZones = false;
        
        if (q.options) {
            if (Array.isArray(q.options) && q.options.some(o => o.x !== undefined)) {
                selectableZones = q.options;
                hasZones = true;
            } else if (typeof q.options === 'object' && Array.isArray(q.options.zones)) {
                selectableZones = q.options.zones;
                hasZones = true;
            }
        }

        imageWrapper.appendChild(img);

        // Click-based or Zone-based Click listener
        if (!isReviewMode) {
            img.onclick = (e) => {
                if (hasZones) return; // Zone-based will handle clicks on their divs
                
                const rect = img.getBoundingClientRect();
                const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
                const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));
                
                answers[q.id] = { x, y };
                renderQuestion(currentIdx);
                updateSidebarBox(currentIdx, true);
            };
        }

        // Render Selectable Zones
        if (hasZones) {
            selectableZones.forEach((zone, zoneIdx) => {
                const zoneDiv = document.createElement('div');
                zoneDiv.style.position = 'absolute';
                zoneDiv.style.left = zone.x + '%';
                zoneDiv.style.top = zone.y + '%';
                zoneDiv.style.width = (zone.width || zone.w) + '%';
                zoneDiv.style.height = (zone.height || zone.h) + '%';
                zoneDiv.style.borderRadius = '4px';
                
                const isSelected = isZoneSelected(zone, studentAnswer);
                
                if (isSelected) {
                    zoneDiv.style.border = '2px solid #005691';
                    zoneDiv.style.background = 'rgba(99, 102, 241, 0.2)';
                } else if (!isReviewMode) {
                    zoneDiv.style.border = '1px dashed rgba(0,0,0,0.15)';
                    zoneDiv.style.cursor = 'pointer';
                }

                if (!isReviewMode) {
                    zoneDiv.onclick = (e) => {
                        e.stopPropagation();
                        // For simplicity, click center of zone
                        const centerPoint = {
                            x: zone.x + (zone.width || zone.w) / 2,
                            y: zone.y + (zone.height || zone.h) / 2
                        };
                        answers[q.id] = centerPoint;
                        renderQuestion(currentIdx);
                        updateSidebarBox(currentIdx, true);
                    };
                }
                
                imageWrapper.appendChild(zoneDiv);
            });
        }

        // Render Student Markers (only if no zones or if clicked)
        if (!hasZones && studentAnswer && studentAnswer.x !== undefined) {
            const marker = document.createElement('div');
            marker.className = "student-hotspot-marker";
            marker.style.position = 'absolute';
            marker.style.left = studentAnswer.x + '%';
            marker.style.top = studentAnswer.y + '%';
            marker.style.transform = 'translate(-50%, -50%)';
            marker.style.width = '24px';
            marker.style.height = '24px';
            marker.style.pointerEvents = 'none';
            marker.innerHTML = `<span class="marker-radar" style="position:absolute; width:100%; height:100%; background:rgba(239,68,68,0.3); border-radius:50%; display:block; animation:radar-pulse 1.2s infinite;"></span><span class="marker-core" style="position:absolute; width:8px; height:8px; background:#ef4444; border-radius:50%; top:8px; left:8px; display:block;"></span>`;
            imageWrapper.appendChild(marker);
        }

        // Render Correct Zones / Answer guide in Review Mode
        if (isReviewMode) {
            let correctZones = [];
            if (hasZones) {
                correctZones = selectableZones.filter(z => z.is_correct === true);
            } else if (correctAns) {
                correctZones = Array.isArray(correctAns) ? correctAns : [correctAns];
            }
            
            correctZones.forEach(zone => {
                const zoneDiv = document.createElement('div');
                zoneDiv.style.position = 'absolute';
                zoneDiv.style.left = zone.x + '%';
                zoneDiv.style.top = zone.y + '%';
                zoneDiv.style.width = (zone.width || zone.w || 4) + '%';
                zoneDiv.style.height = (zone.height || zone.h || 4) + '%';
                zoneDiv.style.border = '2px dashed #16a34a';
                zoneDiv.style.background = 'rgba(22, 163, 74, 0.2)';
                zoneDiv.style.borderRadius = '4px';
                zoneDiv.style.pointerEvents = 'none';
                imageWrapper.appendChild(zoneDiv);
            });
        }

        hotspotWrapper.appendChild(imageWrapper);
        optContainer.appendChild(hotspotWrapper);
        
        // Render Clear button in normal mode
        if (studentAnswer && !isReviewMode) {
            const clearBtn = document.createElement('button');
            clearBtn.type = "button";
            clearBtn.className = "footer-btn";
            clearBtn.style.margin = "1rem auto 0 auto";
            clearBtn.style.background = "#ef4444";
            clearBtn.style.color = "#ffffff";
            clearBtn.style.border = "none";
            clearBtn.textContent = "Xóa điểm đã chọn";
            clearBtn.onclick = () => {
                answers[q.id] = null;
                renderQuestion(currentIdx);
                updateSidebarBox(currentIdx, false);
            };
            optContainer.appendChild(clearBtn);
        }
    } else {
        const p = document.createElement('p');
        p.className = "text-amber-500 font-semibold";
        p.textContent = "Loại câu hỏi này hiện tại chưa được hỗ trợ offline.";
        optContainer.appendChild(p);
    }

    // Render Review Explanation Card
    if (isReviewMode) {
        const explanationDiv = document.createElement('div');
        const isCorr = checkAnswer(qType, correctAns, studentAnswer);
        explanationDiv.className = `explanation-panel ${isCorr ? 'correct' : 'incorrect'}`;
        
        let feedbackHeader = isCorr ? "✓ Trả lời đúng" : (studentAnswer ? "✗ Trả lời sai" : "⚠️ Chưa làm");
        let explanationText = q.explanation || "";
        if (!explanationText) {
            if (isCorr) {
                explanationText = "Chúc mừng bạn đã trả lời chính xác câu hỏi này.";
            } else {
                if (qType === 'single_choice' || qType === 'true_false') {
                    let correctOpt = q.options ? q.options.find(o => String(o.id) === String(correctAns)) : null;
                    let correctText = correctOpt ? correctOpt.text : correctAns;
                    explanationText = `Đáp án đúng là: <strong>${correctText}</strong>`;
                } else if (qType === 'multiple_choice') {
                    let correctTexts = [];
                    if (Array.isArray(correctAns) && q.options) {
                        correctAns.forEach(cid => {
                            let o = q.options.find(opt => String(opt.id) === String(cid));
                            if (o) correctTexts.push(`<strong>${o.text}</strong>`);
                        });
                    }
                    if (correctTexts.length > 0) {
                        explanationText = `Đáp án đúng gồm: ${correctTexts.join(', ')}`;
                    } else {
                        explanationText = `Đáp án đúng gồm: ${correctAns.join(', ')}`;
                    }
                } else if (qType === 'short_answer') {
                    let correctShow = Array.isArray(correctAns) ? correctAns.join(' / ') : correctAns;
                    explanationText = `Đáp án đúng là: <strong>${correctShow}</strong>`;
                } else {
                    explanationText = "Bạn nhớ ôn luyện kỹ kiến thức phần này nhé.";
                }
            }
        }
        
        explanationDiv.innerHTML = `<h4 style="font-weight: 800; margin-bottom: 0.5rem;">${feedbackHeader}</h4><p>${explanationText}</p>`;
        optContainer.appendChild(explanationDiv);
    }

    // Update circular nav disabled states
    document.getElementById('btn-prev').disabled = (idx === 0);
    document.getElementById('btn-next').disabled = (idx === QUIZ.questions.length - 1);

    // Update flag footer button state
    updateFlagBtnState();

    // Highlight current navigator cell
    const boxes = document.querySelectorAll('.navigator-grid-box');
    boxes.forEach((box, i) => {
        if (i === idx) {
            box.classList.add('active');
        } else {
            box.classList.remove('active');
        }
    });
}

function isZoneSelected(zone, studentAns) {
    if (!studentAns) return false;
    const pts = Array.isArray(studentAns) ? studentAns : [studentAns];
    const zx = parseFloat(zone.x);
    const zy = parseFloat(zone.y);
    const zw = parseFloat(zone.width || zone.w || 0);
    const zh = parseFloat(zone.height || zone.h || 0);
    
    return pts.some(pt => {
        const px = parseFloat(pt.x);
        const py = parseFloat(pt.y);
        return px >= zx && px <= zx + zw && py >= zy && py <= zy + zh;
    });
}

function getCorrectZonesCount(q) {
    if (!q.options) return 1;
    if (Array.isArray(q.options)) {
        return q.options.filter(o => o.is_correct === true).length || 1;
    }
    if (typeof q.options === 'object' && Array.isArray(q.options.zones)) {
        return q.options.zones.filter(o => o.is_correct === true).length || 1;
    }
    return 1;
}

function selectSingleAnswer(qId, optId) {
    answers[qId] = optId;
    renderQuestion(currentIdx);
    updateSidebarBox(currentIdx, true);
}

function selectMultipleAnswer(qId, optId) {
    if (!answers[qId]) {
        answers[qId] = [];
    }
    const idx = answers[qId].indexOf(optId);
    if (idx === -1) {
        answers[qId].push(optId);
    } else {
        answers[qId].splice(idx, 1);
    }
    renderQuestion(currentIdx);
    updateSidebarBox(currentIdx, answers[qId].length > 0);
}

function isQuestionAnswered(q) {
    const ans = answers[q.id];
    if (ans === undefined || ans === '' || ans === null) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return true;
}

function updateSidebarBox(idx, isDone) {
    const box = document.getElementById('nav-box-' + idx);
    if (box) {
        if (isDone) {
            box.classList.add('answered-item');
        } else {
            box.classList.remove('answered-item');
        }
    }
}

function prevQuestion() {
    if (currentIdx > 0) renderQuestion(currentIdx - 1);
}

function nextQuestion() {
    if (currentIdx < QUIZ.questions.length - 1) renderQuestion(currentIdx + 1);
}

function toggleFlag() {
    if (flaggedSet.has(currentIdx)) {
        flaggedSet.delete(currentIdx);
    } else {
        flaggedSet.add(currentIdx);
    }
    updateFlagBtnState();
    
    // Update sidebar box flag badge
    const box = document.getElementById('nav-box-' + currentIdx);
    if (box) {
        if (flaggedSet.has(currentIdx)) {
            box.classList.add('flagged-item');
        } else {
            box.classList.remove('flagged-item');
        }
    }
}

function updateFlagBtnState() {
    const flagBtn = document.getElementById('btn-flag');
    const flagIcon = document.getElementById('btn-flag-icon');
    const flagText = document.getElementById('btn-flag-text');
    if (flaggedSet.has(currentIdx)) {
        flagBtn.classList.add('flagged-active');
        flagIcon.className = "fa-solid fa-flag text-amber-500";
        flagText.textContent = "Bỏ đánh dấu";
    } else {
        flagBtn.classList.remove('flagged-active');
        flagIcon.className = "fa-regular fa-flag";
        flagText.textContent = "Đánh dấu";
    }
}

function renderSidebarGrid() {
    const gridEl = document.getElementById('sidebar-question-grid');
    gridEl.innerHTML = "";

    QUIZ.questions.forEach((q, index) => {
        const box = document.createElement('button');
        box.type = "button";
        box.id = 'nav-box-' + index;
        box.className = "navigator-grid-box inactive";
        
        if (index === currentIdx) {
            box.classList.add('active');
            if (isReviewMode) {
                box.classList.add('active-review');
            }
        }
        
        if (isReviewMode) {
            let correctAns = null;
            try {
                correctAns = JSON.parse(atob(q.answer_b64));
            } catch(e) {}
            const qType = (q.type || "").toLowerCase();
            const isCorr = checkAnswer(qType, correctAns, answers[q.id]);
            if (isCorr) {
                box.classList.add('review-correct');
            } else {
                box.classList.add('review-incorrect');
            }
        } else {
            if (isQuestionAnswered(q)) {
                box.classList.add('answered-item');
            }
        }

        if (flaggedSet.has(index)) {
            box.classList.add('flagged-item');
        }
        
        box.onclick = () => {
            if (isViewingSummary) hideSummary();
            renderQuestion(index);
        };
        box.textContent = index + 1;
        gridEl.appendChild(box);
    });
}

function showSummary() {
    isViewingSummary = true;
    
    // Toggle header titles
    document.getElementById('topbar-quiz-info').classList.add('hide');
    document.getElementById('topbar-summary-title').classList.remove('hide');
    document.getElementById('user-info-tag').classList.add('hide');

    // Toggle workspaces
    document.getElementById('quiz-main-area').classList.add('hide');
    document.getElementById('summary-table-area').classList.remove('hide');
    document.getElementById('exam-sidebar').classList.add('hide');

    // Toggle footers
    document.getElementById('footer-quiz-mode').classList.add('hide');
    document.getElementById('footer-summary-mode').classList.remove('hide');

    // Populate table rows
    const tbody = document.getElementById('summary-table-body');
    tbody.innerHTML = "";

    QUIZ.questions.forEach((q, index) => {
        const answered = isQuestionAnswered(q);
        const flagged = flaggedSet.has(index);

        const tr = document.createElement('tr');
        tr.className = "summary-tr";
        tr.onclick = () => {
            hideSummary();
            renderQuestion(index);
        };

        let checkmarkHTML = "";
        let unansweredHTML = "";
        
        if (isReviewMode) {
            let correctAns = null;
            try {
                correctAns = JSON.parse(atob(q.answer_b64));
            } catch(e) {}
            
            const qType = (q.type || "").toLowerCase();
            const isCorr = checkAnswer(qType, correctAns, answers[q.id]);
            if (answered) {
                checkmarkHTML = isCorr 
                    ? '<span class="checkmark-icon" style="color: #16a34a; font-weight: bold; font-size:1.25rem;">✓</span>' 
                    : '<span style="color: #ef4444; font-weight: bold; font-size:1.25rem;">✗</span>';
            } else {
                unansweredHTML = '<span style="color: #ef4444; font-size: 0.85rem; font-weight: 600;">Chưa làm</span>';
            }
        } else {
            checkmarkHTML = answered ? '<span class="checkmark-icon">✓</span>' : '';
            unansweredHTML = !answered ? '<div class="empty-answer-box"></div>' : '';
        }

        tr.innerHTML = `
            <td class="td-question">
                <span class="td-question-text">${index + 1}. ${q.text}</span>
            </td>
            <td class="td-answered">
                ${checkmarkHTML}
            </td>
            <td class="td-unanswered">
                ${unansweredHTML}
            </td>
            <td class="td-flagged">
                ${flagged ? '<i class="fa-solid fa-flag text-amber-500"></i>' : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function hideSummary() {
    isViewingSummary = false;

    // Toggle header titles
    document.getElementById('topbar-quiz-info').classList.remove('hide');
    document.getElementById('topbar-summary-title').classList.add('hide');
    document.getElementById('user-info-tag').classList.remove('hide');

    // Toggle workspaces
    document.getElementById('quiz-main-area').classList.remove('hide');
    document.getElementById('summary-table-area').classList.add('hide');
    document.getElementById('exam-sidebar').classList.remove('hide');

    // Toggle footers
    document.getElementById('footer-quiz-mode').classList.remove('hide');
    document.getElementById('footer-summary-mode').classList.add('hide');
    
    // Redraw grid
    renderSidebarGrid();
}

function checkAnswer(qType, correctAns, studentAns) {
    qType = (qType || "").toLowerCase();
    if (correctAns === null || correctAns === undefined || studentAns === null || studentAns === undefined) {
        return false;
    }
    if (qType === 'single_choice' || qType === 'true_false') {
        return String(correctAns).trim().toLowerCase() === String(studentAns).trim().toLowerCase();
    } else if (qType === 'multiple_choice') {
        if (!Array.isArray(correctAns) || !Array.isArray(studentAns)) return false;
        if (correctAns.length !== studentAns.length) return false;
        const cSorted = [...correctAns].map(x => String(x).trim().toLowerCase()).sort();
        const sSorted = [...studentAns].map(x => String(x).trim().toLowerCase()).sort();
        return JSON.stringify(cSorted) === JSON.stringify(sSorted);
    } else if (qType === 'short_answer') {
        if (Array.isArray(correctAns)) {
            return correctAns.some(ans => String(ans).trim().toLowerCase() === String(studentAns).trim().toLowerCase());
        }
        return String(correctAns).trim().toLowerCase() === String(studentAns).trim().toLowerCase();
    } else if (qType === 'hotspot') {
        // check coordinates relative to correctZones
        if (!studentAns) return false;
        const pts = Array.isArray(studentAns) ? studentAns : [studentAns];
        
        let correctZones = [];
        if (Array.isArray(correctAns)) {
            correctZones = correctAns;
        } else if (correctAns.x !== undefined) {
            correctZones = [correctAns];
        } else if (typeof correctAns === 'object' && Array.isArray(correctAns.zones)) {
            correctZones = correctAns.zones.filter(z => z.is_correct === true);
        }

        // We check if all pts are inside any correct zones, and all correct zones have at least one point
        // For simplicity, we check if student point lands in a correct zone
        return pts.some(pt => {
            return correctZones.some(zone => {
                const zx = parseFloat(zone.x);
                const zy = parseFloat(zone.y);
                const zw = parseFloat(zone.width || zone.w || 4); // default small tolerance width
                const zh = parseFloat(zone.height || zone.h || 4);
                return pt.x >= zx && pt.x <= zx + zw && pt.y >= zy && pt.y <= zy + zh;
            });
        });
    }
    return String(correctAns) === String(studentAns);
}

function submitQuizConfirm() {
    const unanswered = QUIZ.questions.filter(q => !isQuestionAnswered(q)).length;
    let msg = "Bạn có chắc chắn muốn nộp bài?";
    if (unanswered > 0) {
        msg += `<br>Lưu ý: Bạn còn <strong style="color: #ef4444;">${unanswered}</strong> câu hỏi chưa hoàn thành.`;
    }
    showSystemConfirm("Nộp bài thi", msg, (confirmed) => {
        if (confirmed) {
            submitQuiz(false);
        }
    });
}

function submitQuiz(isAuto = false) {
    if (isSubmitted) return;
    isSubmitted = true;
    clearInterval(timer);

    let correctCount = 0;
    const totalQuestions = QUIZ.questions.length;

    QUIZ.questions.forEach(q => {
        let correctAns = null;
        try {
            const rawJson = atob(q.answer_b64);
            correctAns = JSON.parse(rawJson);
        } catch(e) {
            console.error("Lỗi decode đáp án đúng: ", e);
        }

        const studentAns = answers[q.id];
        const isCorrect = checkAnswer(q.type, correctAns, studentAns);
        
        if (isCorrect) {
            correctCount++;
        }
    });

    // 1 câu đúng = 1 điểm, sai = 0 điểm
    const earnedPoints = correctCount;
    const duration = QUIZ.time_limit * 60 - timeRemaining;

    // Send score to teacher server (gửi số câu đúng, không phải phần trăm)
    const payload = new URLSearchParams();
    payload.append('sp', String(earnedPoints));
    payload.append('ut', String(duration));
    payload.append('lt', QUIZ.title);
    payload.append('pc_name', pcName);
    payload.append('class_id', selectedClassId);
    payload.append('student_id', selectedStudentId);

    const url = `${activeApiUrl}/api/save-score`;
    
    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: payload.toString()
    })
    .then(res => res.text())
    .then(text => console.log("Submit score response:", text))
    .catch(err => {
        console.error("Submit score error:", err);
        showSystemAlert("Lỗi kết nối", "Không thể tự động gửi điểm về máy thầy. Hãy báo cho thầy cô!");
    });

    // Show results viewport
    showResults(correctCount, duration, earnedPoints);
}

function showResults(correctCount, duration, earnedPoints) {
    document.getElementById('exam-viewport').classList.add('hide');
    document.getElementById('results-viewport').classList.remove('hide');

    const totalQuestions = QUIZ.questions.length;
    const maxPoints = totalQuestions; // 1 câu = 1 điểm
    const scorePercentage = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
    
    const passingPercentage = 90;
    const passingPoints = Math.round(maxPoints * 0.9);
    const isPassed = earnedPoints >= passingPoints;

    // Set status icon class and character
    const statusIcon = document.getElementById('result-status-icon');
    if (statusIcon) {
        if (isPassed) {
            statusIcon.className = "status-circle-icon passed";
            statusIcon.textContent = "✓";
        } else {
            statusIcon.className = "status-circle-icon failed";
            statusIcon.textContent = "✕";
        }
    }

    // Set score texts
    const scorePercentEl = document.getElementById('result-score-percent');
    if (scorePercentEl) {
        scorePercentEl.textContent = `${earnedPoints}/${maxPoints} câu đúng (${scorePercentage}%)`;
    }

    const passingPercentEl = document.getElementById('result-passing-percent');
    if (passingPercentEl) {
        passingPercentEl.textContent = `${passingPoints}/${maxPoints} câu đúng (${passingPercentage}%)`;
    }

    // Set warnings, pc name, and time spent
    const cheatWarningsEl = document.getElementById('result-cheat-warnings');
    if (cheatWarningsEl) {
        cheatWarningsEl.textContent = cheatWarnings;
    }

    const pcNameEl = document.getElementById('result-pc-name');
    if (pcNameEl) {
        pcNameEl.textContent = pcName;
    }

    const timeSpentEl = document.getElementById('result-time-spent');
    if (timeSpentEl) {
        let minSpent = Math.floor(duration / 60);
        let secSpent = duration % 60;
        timeSpentEl.textContent = String(minSpent).padStart(2, '0') + ":" + String(secSpent).padStart(2, '0');
    }
}

function enterReviewMode() {
    isReviewMode = true;
    isViewingSummary = false;
    
    document.getElementById('results-viewport').classList.add('hide');
    document.getElementById('exam-viewport').classList.remove('hide');

    // Update status to "Xem lại"
    document.getElementById('user-info-tag').querySelector('.user-status').textContent = "Xem lại";
    document.getElementById('user-info-tag').querySelector('.user-status').style.color = "#3b82f6";

    // Update NỘP BÀI in sidebar to PHIẾU ĐIỂM
    const sidebarSubmitBtn = document.querySelector('.sidebar-submit-btn');
    sidebarSubmitBtn.style.background = "#3b82f6";
    sidebarSubmitBtn.querySelector('span').textContent = "PHIẾU ĐIỂM";
    sidebarSubmitBtn.querySelector('i').className = "fa-solid fa-square-poll-vertical";
    sidebarSubmitBtn.onclick = () => exitReviewMode();

    // Update Footer for Review Mode: add exit button
    const footerQuiz = document.getElementById('footer-quiz-mode');
    let exitReviewBtn = document.getElementById('exit-review-btn');
    if (!exitReviewBtn) {
        exitReviewBtn = document.createElement('button');
        exitReviewBtn.type = "button";
        exitReviewBtn.id = 'exit-review-btn';
        exitReviewBtn.className = "footer-btn";
        exitReviewBtn.style.marginLeft = "auto";
        exitReviewBtn.style.background = "#3b82f6";
        exitReviewBtn.style.color = "#ffffff";
        exitReviewBtn.style.border = "none";
        exitReviewBtn.innerHTML = `<i class="fa-solid fa-square-poll-vertical"></i> <span>Quay lại Phiếu Điểm</span>`;
        exitReviewBtn.onclick = () => exitReviewMode();
        footerQuiz.appendChild(exitReviewBtn);
    }
    
    // Hide flag button in review mode
    document.getElementById('btn-flag').classList.add('hide');

    renderQuestion(0);
    renderSidebarGrid();
}

function exitReviewMode() {
    isReviewMode = false;
    document.getElementById('exam-viewport').classList.add('hide');
    document.getElementById('results-viewport').classList.remove('hide');
}

// Lightbox zoom features
function zoomImage(src) {
    const overlay = document.getElementById('lightbox-overlay');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    overlay.classList.remove('hide');
}

function closeZoom() {
    document.getElementById('lightbox-overlay').classList.add('hide');
}
