import axios from 'axios';

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        // Map localhost to 127.0.0.1 to avoid Windows IPv6 resolution mismatch with Flask IPv4 binding
        const finalHost = hostname === 'localhost' ? '127.0.0.1' : hostname;
        return `${protocol}//${finalHost}:5000`;
    }
    return 'http://127.0.0.1:5000';
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401 && error.response.data && error.response.data.code === 'concurrent_login') {
            window.location.href = '/login?error=concurrent_login';
        }
        return Promise.reject(error);
    }
);

export default api;

export const getInitData = () => api.get('/api/init');
export const getSchools = () => api.get('/api/schools');
export const addSchool = (schoolName: string, address?: string, logo?: string) => api.post('/api/schools', { action: 'add_school', school_name: schoolName, address, school_logo: logo });
export const deleteSchool = (schoolId: number) => api.post('/api/schools', { action: 'delete_school', school_id: schoolId });

export const getClasses = (schoolId?: number, format?: string) => api.get('/api/classes', { params: { ...(schoolId ? { school_id: schoolId } : {}), ...(format ? { format: format } : {}) } });
export const selectClass = (className: string, schoolId: number) => api.post('/api/classes', { action: 'select_class', class: className, school_id: schoolId });
export const addClass = (grade: string, suffix: string, schoolId: number) => api.post('/api/classes', { action: 'add_class', grade, suffix, school_id: schoolId });
export const deleteClass = (className: string, schoolId: number) => api.post('/api/classes', { action: 'delete_class', class: className, school_id: schoolId });

export const getDashboardInfo = () => api.get('/api/dashboard-info');
export const getSeatingInfo = () => api.get('/api/seating-info');
export const getMuctuieuInfo = () => api.get('/api/muctieu-info');

export const postAction = (action: string, data: any = {}) => api.post('/api/action', { action, ...data });

export const loginLocal = (credentials: any) => api.post('/api/auth/login/local', credentials);
export const registerLocal = (credentials: any) => api.post('/api/auth/register', credentials);
export const logout = () => api.get('/api/auth/logout');
export const getAuthStatus = () => api.get('/api/auth/status');

export const getUsers = () => api.get('/api/admin/users');
export const updateUsers = (data: any) => api.post('/api/admin/users', data);
export const updateProfile = (data: { name: string, password?: string }) => api.post('/api/auth/profile', data);
export const uploadAvatar = (formData: FormData) => api.post('/api/auth/avatar', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});


export const getIpMapping = () => api.get('/api/ip-mapping');
export const getGsheetTabs = () => api.get('/api/gsheet-tabs');
export const fetchGsheet = (tab: string, force?: boolean) => api.get('/api/fetch-gsheet', { params: { tab, force } });
export const saveGsheetTargets = (data: { ots: any, targets: any }) => api.post('/api/save-gsheet-targets', data);
export const exportExcelUrl = (lop: string) => `${API_BASE_URL}/api/export-excel?lop=${lop}`;

export const getExcelData = (lop?: string) => api.get('/api/excel-data', { params: { lop } });
export const saveExcelData = (lop: string, grid: any) => api.post(`/api/save-excel-data?lop=${lop}`, { grid });


// --- QUIZ & QUESTION API ---

// Admin Quizzes
export const getQuizzes = () => api.get('/api/quizzes');
export const getQuizDetail = (quizId: number) => api.get(`/api/quizzes/${quizId}`);
export const createQuiz = (data: { title: string; description?: string; time_limit?: number; is_published?: boolean; school_level?: string; grade_level?: number | null; quiz_mode?: string; allow_practice?: boolean }) => api.post('/api/quizzes', data);
export const updateQuiz = (quizId: number, data: { title?: string; description?: string; time_limit?: number; is_published?: boolean; school_level?: string; grade_level?: number | null; quiz_mode?: string; allow_practice?: boolean }) => api.put(`/api/quizzes/${quizId}`, data);
export const batchUpdatePractice = (gradeLevel: number, allowPractice: boolean) => api.post('/api/quizzes/batch-practice', { grade_level: gradeLevel, allow_practice: allowPractice });
export const deleteQuiz = (quizId: number) => api.delete(`/api/quizzes/${quizId}`);
export const generateMixedQuiz = (data: { title: string; description?: string; time_limit?: number; school_level?: string; grade_level?: number | null; sources: Array<{ quiz_id: number | string; count: number }> }) => api.post('/api/quizzes/generate-mixed', data);


// Admin Questions
export const createQuestion = (quizId: number, data: { question_type: string; question_text: string; image_url?: string; options: any; correct_answer: any; explanation?: string; points?: number }) => api.post(`/api/quizzes/${quizId}/questions`, data);
export const updateQuestion = (questionId: number, data: { question_type?: string; question_text?: string; image_url?: string; options?: any; correct_answer?: any; explanation?: string; points?: number }) => api.put(`/api/questions/${questionId}`, data);
export const deleteQuestion = (questionId: number) => api.delete(`/api/questions/${questionId}`);
export const batchDeleteQuestions = (questionIds: number[]) => api.post('/api/questions/batch-delete', { question_ids: questionIds });
export const uploadQuestionImage = (formData: FormData) => api.post('/api/questions/upload', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});
export const importQuizQuestionsExcel = (quizId: number, formData: FormData) => api.post(`/api/quizzes/${quizId}/questions/import-excel`, formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});

// Teacher Class Quizzes
export const assignClassQuiz = (data: { class_id: number; quiz_id: number; time_limit?: number; quiz_mode?: string; pin_code?: string; random_question_count?: number }) => api.post('/api/teacher/class-quizzes', data);
export const updateClassQuizStatus = (classQuizId: number, status: 'active' | 'completed') => api.put(`/api/teacher/class-quizzes/${classQuizId}/status`, { status });
export const getTeacherClassQuizzes = (schoolId?: number) => api.get('/api/teacher/class-quizzes/active', { params: { ...(schoolId ? { school_id: schoolId } : {}) } });
export const getLiveProctor = (classQuizId: number) => api.get(`/api/teacher/class-quizzes/${classQuizId}/proctor`);
export const updateClassQuizPin = (classQuizId: number, pinCode: string) => api.put(`/api/teacher/class-quizzes/${classQuizId}/pin`, { pin_code: pinCode });
export const deleteStudentAttempt = (attemptId: number) => api.delete(`/api/teacher/attempts/${attemptId}`);

// Student Public Access
export const getPublicQuizzes = () => api.get('/api/public/quizzes');
export const getPublicSchools = () => api.get('/api/public/schools');
export const getPublicClasses = (schoolId: number) => api.get(`/api/public/schools/${schoolId}/classes`);
export const getPublicStudents = (classId: number) => api.get(`/api/public/classes/${classId}/students`);
export const getPublicActiveQuizzes = (classId: number) => api.get(`/api/public/classes/${classId}/active-quizzes`);
export const checkActiveSessionsExist = () => api.get('/api/public/active-sessions-exist');
// Token của lượt thi: server cấp khi bắt đầu bài, các lệnh lưu / nộp / xem kết quả phải gửi lại.
// Lưu thêm vào localStorage để tải lại trang hoặc mở trang kết quả vẫn dùng được.
const ATTEMPT_TOKEN_PREFIX = 'attempt_token_';
const attemptTokens: Record<number, string> = {};

const rememberAttemptToken = (attemptId: any, token: any) => {
    const id = Number(attemptId);
    if (!id || id <= 0 || !token || token === 'local') return;
    attemptTokens[id] = String(token);
    try { localStorage.setItem(ATTEMPT_TOKEN_PREFIX + id, String(token)); } catch { /* bỏ qua */ }
};

const getAttemptToken = (attemptId: number): string => {
    if (attemptTokens[attemptId]) return attemptTokens[attemptId];
    try { return localStorage.getItem(ATTEMPT_TOKEN_PREFIX + attemptId) || ''; } catch { return ''; }
};

export const startQuizAttempt = (data: { class_quiz_id?: number; quiz_id?: number; student_id: number; quiz_mode?: string; session_token?: string; pin_code?: string }) =>
    api.post('/api/public/attempts/start', data).then(res => {
        rememberAttemptToken(res.data?.attempt_id, res.data?.session_token);
        return res;
    });
export const saveQuizAttempt = (attemptId: number, data: { answers: any; cheat_warnings_count: number; duration_seconds: number }) =>
    api.post(`/api/public/attempts/${attemptId}/save`, { ...data, session_token: getAttemptToken(attemptId) });
export const submitQuizAttempt = (attemptId: number, data: { answers: any; cheat_warnings_count: number; duration_seconds: number; is_auto_submit?: boolean }) =>
    api.post(`/api/public/attempts/${attemptId}/submit`, { ...data, session_token: getAttemptToken(attemptId) });
export const getQuizAttemptResults = (attemptId: number) =>
    api.get(`/api/public/attempts/${attemptId}`, { params: { token: getAttemptToken(attemptId) || undefined } });

// --- ARTICLES API ---
export const getPublicArticles = () => api.get('/api/public/articles');
export const adminGetArticles = () => api.get('/api/admin/articles');
export const adminCreateArticle = (data: { title: string; category: string; image?: string; description?: string; summary?: string; content?: string }) => api.post('/api/admin/articles', data);
export const adminUpdateArticle = (articleId: number, data: { title?: string; category?: string; image?: string; description?: string; summary?: string; content?: string }) => api.put(`/api/admin/articles/${articleId}`, data);
export const adminDeleteArticle = (articleId: number) => api.delete(`/api/admin/articles/${articleId}`);

// --- OPERATION TOOLS & GEMINI AI ---
export const getOperationScript = (name: string) => api.get('/api/operation-tools/script', { params: { name } });
export const saveOperationScript = (name: string, content: string) => api.post('/api/operation-tools/script', { name, content });
export const geminiFixScript = (data: { name: string; content: string; error?: string; prompt?: string }) => api.post('/api/operation-tools/gemini-fix', data);

// --- TEACHER CLASS PRACTICE TOGGLE ---
export const toggleClassPractice = (classId: number, data: { practice_enabled: boolean; scope?: 'class' | 'grade' }) => api.put(`/api/teacher/classes/${classId}/practice`, data);
export const getClassPracticeStatus = (classId: number) => api.get(`/api/teacher/classes/${classId}/practice`);
export const getTeacherClassesPractice = () => api.get('/api/teacher/classes/practice');
export const toggleWorkstationBanTraining = (workstationId: number, data: { ban_training: boolean }) => api.put(`/api/teacher/workstations/${workstationId}/ban-training`, data);

// --- STANDALONE QUIZ EXPORT ---
export const exportStandaloneQuiz = (quizId: number, filename?: string) => api.post(`/api/quizzes/${quizId}/export-standalone`, { filename });
export const getOperationQuizzes = () => api.get('/api/operation-tools/quizzes');





