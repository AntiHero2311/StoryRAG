import api from './api';

export interface UserProfile {
    id: string;
    fullName: string;
    email: string;
    avatarURL?: string;
    role: string;
    createdAt: string;
}

export interface UpdateProfileRequest {
    fullName: string;
    avatarURL?: string;
}

export const userService = {
    getProfile: async (): Promise<UserProfile> => {
        const response = await api.get<UserProfile>('/user/profile');
        return response.data;
    },

    updateProfile: async (data: UpdateProfileRequest): Promise<UserProfile> => {
        const response = await api.put<UserProfile>('/user/profile', data);
        return response.data;
    },
};
