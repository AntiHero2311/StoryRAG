import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base URL của Backend — override bằng .env.local khi dev local
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7259/api';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

interface RefreshResponse {
    accessToken: string;
    refreshToken?: string;
}

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

// Interceptor: nếu Access Token hết hạn, dùng Refresh Token để lấy token mới và retry request.
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as RetryableRequestConfig | undefined;
        const isRefreshRequest = originalRequest?.url?.includes('/Auth/refresh');

        if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isRefreshRequest) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            const response = await api.post<RefreshResponse>('/Auth/refresh', { refreshToken });
            localStorage.setItem('token', response.data.accessToken);
            if (response.data.refreshToken) {
                localStorage.setItem('refreshToken', response.data.refreshToken);
            }

            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            return Promise.reject(refreshError);
        }
    }
);

export default api;
