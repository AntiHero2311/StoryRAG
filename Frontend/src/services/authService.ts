import { api } from './api';

export interface RegisterData {
    fullName: string;
    email: string;
    password: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface ChangePasswordData {
    oldPassword: string;
    newPassword: string;
}

export interface AuthResponse {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    accessToken: string;
    refreshToken?: string;
}

export const authService = {
    // Gọi API Đăng Ký
    register: async (data: RegisterData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/Auth/register', data);
        return response.data;
    },

    // Gọi API Đăng Nhập
    login: async (data: LoginData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/Auth/login', data);
        return response.data;
    },

    // Đổi mật khẩu
    changePassword: async (data: ChangePasswordData): Promise<void> => {
        await api.put('/Auth/change-password', data);
    }
};
