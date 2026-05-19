import api from './api';
import type { StaffFeedbackResponse } from './feedbackService';

export interface StaffPagedResponse<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface StaffPerformanceResponse {
    staffId: string;
    staffName: string;
    reviewsThisMonth: number;
    feedbacksResolvedThisMonth: number;
    appealsReviewedThisMonth: number;
    ticketsResolvedThisMonth: number;
    avgFeedbackResponseHours?: number | null;
    openFeedbacksAssigned: number;
    pendingAppeals: number;
    openSupportTickets: number;
}

export interface SupportTicketResponse {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    assignedStaffId?: string | null;
    assignedStaffName?: string | null;
    category: string;
    subject: string;
    description: string;
    status: string;
    staffReply?: string | null;
    createdAt: string;
    updatedAt?: string | null;
    resolvedAt?: string | null;
}

export interface AuthorAppealResponse {
    id: string;
    authorId: string;
    authorName: string;
    projectId: string;
    appealType: string;
    referenceId?: string | null;
    reason: string;
    status: string;
    reviewedByStaffId?: string | null;
    reviewedByStaffName?: string | null;
    staffNote?: string | null;
    createdAt: string;
    updatedAt?: string | null;
}

export const staffService = {
    async getFeedbacks(page = 1, pageSize = 20, projectId?: string): Promise<StaffPagedResponse<StaffFeedbackResponse>> {
        const { data } = await api.get<StaffPagedResponse<StaffFeedbackResponse>>('/staff/feedback', {
            params: { page, pageSize, projectId },
        });
        return data;
    },

    async createFeedback(payload: { projectId: string; message: string }): Promise<StaffFeedbackResponse> {
        const { data } = await api.post<StaffFeedbackResponse>('/staff/feedback', {
            project_id: payload.projectId,
            message: payload.message,
        });
        return data;
    },

    async updateFeedback(feedbackId: string, payload: { projectId: string; content: string; status?: string; staffNote?: string }): Promise<StaffFeedbackResponse> {
        const { data } = await api.put<StaffFeedbackResponse>(`/staff/feedback/${feedbackId}`, payload);
        return data;
    },

    async getPerformance(): Promise<StaffPerformanceResponse> {
        const { data } = await api.get<StaffPerformanceResponse>('/staff/performance');
        return data;
    },

    async getSupportTickets(status?: string, category?: string, page = 1, pageSize = 20): Promise<StaffPagedResponse<SupportTicketResponse>> {
        const { data } = await api.get<StaffPagedResponse<SupportTicketResponse>>('/staff/support-tickets', {
            params: { status, category, page, pageSize },
        });
        return data;
    },

    async updateSupportTicket(ticketId: string, payload: { status?: string; staffReply?: string }): Promise<SupportTicketResponse> {
        const { data } = await api.put<SupportTicketResponse>(`/staff/support-tickets/${ticketId}`, payload);
        return data;
    },

    async getAppeals(status?: string, page = 1, pageSize = 20): Promise<StaffPagedResponse<AuthorAppealResponse>> {
        const { data } = await api.get<StaffPagedResponse<AuthorAppealResponse>>('/staff/appeals', {
            params: { status, page, pageSize },
        });
        return data;
    },

    async reviewAppeal(appealId: string, payload: { status: 'Approved' | 'Rejected'; staffNote?: string }): Promise<AuthorAppealResponse> {
        const { data } = await api.put<AuthorAppealResponse>(`/staff/appeals/${appealId}/review`, payload);
        return data;
    },

    async warnAuthor(payload: { userId: string; projectId?: string; message: string }): Promise<void> {
        await api.post('/staff/moderation/warn', payload);
    },

    async suspendProject(payload: { projectId: string; reason?: string }): Promise<void> {
        await api.post('/staff/moderation/suspend-project', payload);
    },

    async recommendBan(payload: { userId: string; reason: string }): Promise<SupportTicketResponse> {
        const { data } = await api.post<SupportTicketResponse>('/staff/moderation/recommend-ban', payload);
        return data;
    },
};
