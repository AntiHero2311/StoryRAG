import { api } from './api';

export interface RegisterData {
    fullName: string;
    email: string;
    password: string;
    otp: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface GoogleLoginData {
    idToken: string;
}

export interface ChangePasswordData {
    oldPassword: string;
    newPassword: string;
}

export interface ForgotPasswordData {
    email: string;
}

export interface ResetPasswordData {
    token: string;
    newPassword: string;
}

export interface RefreshTokenData {
    refreshToken: string;
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
    // Gửi mã OTP đăng ký
    sendOtp: async (email: string): Promise<void> => {
        await api.post('/Auth/register/send-otp', { email });
    },

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

    // Gọi API Đăng Nhập Google
    googleLogin: async (data: GoogleLoginData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/Auth/google-login', data);
        return response.data;
    },

    // Làm mới Access Token bằng Refresh Token
    refresh: async (data: RefreshTokenData): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/Auth/refresh', data);
        return response.data;
    },

    // Đổi mật khẩu
    changePassword: async (data: ChangePasswordData): Promise<void> => {
        await api.put('/Auth/change-password', data);
    },

    // Quên mật khẩu — gửi email reset link
    forgotPassword: async (data: ForgotPasswordData): Promise<void> => {
        await api.post('/Auth/forgot-password', data);
    },

    // Đặt lại mật khẩu với token từ email
    resetPassword: async (data: ResetPasswordData): Promise<void> => {
        await api.post('/Auth/reset-password', data);
    },
};
