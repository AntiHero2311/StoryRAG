import api from './api';

export interface GenreInfo {
    id: number;
    name: string;
    slug: string;
    color: string;
    description?: string;
}

export interface UserSummary {
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    genres: GenreInfo[];
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
    successfulPayments: number;
    totalRevenue: number;
    revenueLast7Days: number;
    revenueLast30Days: number;
    // Bugs
    openBugReports: number;
    inProgressBugReports: number;
    resolvedBugReports: number;
    highPriorityOpenBugs: number;
}

export interface AdminCreateUserRequest {
    fullName: string;
    email: string;
    password: string;
    role: string;
}

export interface AdminUpdateUserRequest {
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    newPassword?: string;
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
    getUser: async (id: string): Promise<UserSummary> => {
        const response = await api.get<UserSummary>(`/admin/users/${id}`);
        return response.data;
    },
    createUser: async (payload: AdminCreateUserRequest): Promise<UserSummary> => {
        const response = await api.post<UserSummary>('/admin/users', payload);
        return response.data;
    },
    updateUser: async (id: string, payload: AdminUpdateUserRequest): Promise<UserSummary> => {
        const response = await api.put<UserSummary>(`/admin/users/${id}`, payload);
        return response.data;
    },
    deleteUser: async (id: string): Promise<void> => {
        await api.delete(`/admin/users/${id}`);
    },
    getRevenueDashboard: async (year: number, month: number, planId?: number): Promise<AdminRevenueDashboard> => {
        const params: Record<string, number> = { year, month };
        if (planId != null) params.planId = planId;
        const response = await api.get<AdminRevenueDashboard>('/admin/revenue/dashboard', { params });
        return response.data;
    },
    getLogs: async (page = 1, pageSize = 30, category?: string, level?: string): Promise<SystemLogsPage> => {
        const response = await api.get<SystemLogsPage>('/admin/logs', { params: { page, pageSize, category, level } });
        return response.data;
    },
    getSystemLimits: async (): Promise<SystemLimits> => {
        const response = await api.get<SystemLimits>('/admin/system/limits');
        return response.data;
    },
    updateSystemLimits: async (payload: SystemLimitsRequest): Promise<SystemLimits> => {
        const response = await api.put<SystemLimits>('/admin/system/limits', payload);
        return response.data;
    },
    setUserActive: async (id: string, isActive: boolean): Promise<UserSummary> => {
        const response = await api.patch<UserSummary>(`/admin/users/${id}/active`, { isActive });
        return response.data;
    },

    // ── Staff Genre Specialization ────────────────────────────────────────────
    getAllStaffWithGenres: async (): Promise<UserSummary[]> => {
        const response = await api.get<UserSummary[]>('/admin/staff/genres');
        return response.data;
    },
    getStaffGenres: async (staffId: string): Promise<UserSummary> => {
        const response = await api.get<UserSummary>(`/admin/staff/${staffId}/genres`);
        return response.data;
    },
    assignStaffGenres: async (staffId: string, genreIds: number[]): Promise<UserSummary> => {
        const response = await api.put<UserSummary>(`/admin/staff/${staffId}/genres`, { genreIds });
        return response.data;
    },
};

export interface SystemLogItem {
    id: string;
    level: string;
    category: string;
    action: string;
    message: string;
    actorId: string | null;
    actorName: string | null;
    createdAt: string;
}

export interface SystemLogsPage {
    total: number;
    page: number;
    pageSize: number;
    storageReady?: boolean;
    items: SystemLogItem[];
}

export interface SystemLimits {
    maxUploadMb: number;
    maxProjectsPerAuthor: number;
    maintenanceMode: boolean;
    totalProjects: number;
    totalChapters: number;
    totalWordCount: number;

    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword?: string;
    smtpFromName: string;
    smtpFromAddress: string;

    vnPayPaymentUrl: string;
    vnPayTmnCode: string;
    vnPayHashSecret?: string;
    vnPayReturnUrl: string;
}

export interface SystemLimitsRequest {
    maxUploadMb: number;
    maxProjectsPerAuthor: number;
    maintenanceMode: boolean;

    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword?: string;
    smtpFromName: string;
    smtpFromAddress: string;

    vnPayPaymentUrl: string;
    vnPayTmnCode: string;
    vnPayHashSecret?: string;
    vnPayReturnUrl: string;
}

export interface PlanRevenueItem {
    planId: number;
    planName: string;
    revenue: number;
    orderCount: number;
}

export interface MonthlyRevenueItem {
    year: number;
    month: number;
    label: string;
    revenue: number;
    orderCount: number;
    growthPercent: number | null;
}

export interface AdminRevenueDashboard {
    year: number;
    month: number;
    totalRevenue: number;
    selectedMonthRevenue: number;
    totalCompletedOrders: number;
    selectedMonthOrders: number;
    revenueGrowthPercent: number | null;
    paymentSuccessRate: number;
    revenueByPlan: PlanRevenueItem[];
    monthlyTrend: MonthlyRevenueItem[];
    plans: PlanRevenueItem[];
}
