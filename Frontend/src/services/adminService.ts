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

export interface AdminOverviewStats {
    // Users
    totalUsers: number;
    activeUsers: number;
    newUsersLast7Days: number;
    newUsersLast30Days: number;
    totalAuthors: number;
    totalStaff: number;
    totalAdmins: number;
    // Content
    totalProjects: number;
    totalChapters: number;
    totalWordCount: number;
    totalCharacters: number;
    totalWorldbuildingEntries: number;
    // AI
    totalAiTokens: number;
    totalAiChatMessages: number;
    totalAiAnalyses: number;
    // Subscriptions
    activeSubscriptions: number;
    expiredSubscriptions: number;
    cancelledSubscriptions: number;
    // Bugs
    openBugReports: number;
    inProgressBugReports: number;
    resolvedBugReports: number;
    highPriorityOpenBugs: number;
}

export const adminService = {
    getUserStats: async (): Promise<UserStatsResponse> => {
        const response = await api.get<UserStatsResponse>('/admin/users/stats');
        return response.data;
    },
    getOverviewStats: async (): Promise<AdminOverviewStats> => {
        const response = await api.get<AdminOverviewStats>('/admin/stats/overview');
        return response.data;
    },
};
