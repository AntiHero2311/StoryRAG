import axios from 'axios';

// Base URL của Backend — override bằng .env.local khi dev local
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7259/api';

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 600000,
});

// Interceptor: Tự động đính kèm Token vào Header nếu có
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
