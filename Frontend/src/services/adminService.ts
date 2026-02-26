import api from './api';

export interface UserSummary {
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export interface UserStatsResponse {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalAuthors: number;
    totalStaff: number;
    totalAdmins: number;
    users: UserSummary[];
}

export const adminService = {
    getUserStats: async (): Promise<UserStatsResponse> => {
        const response = await api.get<UserStatsResponse>('/admin/users/stats');
        return response.data;
    },
};
