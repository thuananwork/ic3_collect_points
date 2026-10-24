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

export default api;

// Phiên hết hiệu lực (hết hạn giấy phép, khởi động lại máy chủ...): báo cho App quay về màn hình đăng nhập
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401 && err.response.data?.code === 'auth_required') {
            window.dispatchEvent(new Event('ic3-auth-required'));
        }
        return Promise.reject(err);
    }
);

export const getInitData = () => api.get('/api/init');
export const getSchools = () => api.get('/api/schools');
export const addSchool = (schoolName: string, address?: string, logo?: string) =>
    api.post('/api/schools', { action: 'add_school', school_name: schoolName, address, school_logo: logo });
export const deleteSchool = (schoolId: number) =>
    api.post('/api/schools', { action: 'delete_school', school_id: schoolId });

export const getClasses = (schoolId?: number, format?: string) =>
    api.get('/api/classes', { params: { ...(schoolId ? { school_id: schoolId } : {}), ...(format ? { format: format } : {}) } });
export const selectClass = (className: string, schoolId: number) =>
    api.post('/api/classes', { action: 'select_class', class: className, school_id: schoolId });
export const addClass = (grade: string, suffix: string, schoolId: number) =>
    api.post('/api/classes', { action: 'add_class', grade, suffix, school_id: schoolId });
export const deleteClass = (className: string, schoolId: number) =>
    api.post('/api/classes', { action: 'delete_class', class: className, school_id: schoolId });

export const getDashboardInfo = () => api.get('/api/dashboard-info');
export const getSeatingInfo = () => api.get('/api/seating-info');
export const getMuctuieuInfo = () => api.get('/api/muctieu-info');

export const postAction = (action: string, data: any = {}) => api.post('/api/action', { action, ...data });

export const getAuthStatus = () => api.get('/api/auth/status');
export const loginRequest = (username: string, password: string) => api.post('/api/auth/login', { username, password });
export const logoutRequest = () => api.post('/api/auth/logout');
export const uploadLicence = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/auth/licence', form);
};
export const getIpMapping = () => api.get('/api/ip-mapping');
export const exportExcelUrl = (lop: string) => `${API_BASE_URL}/api/export-excel?lop=${lop}`;
