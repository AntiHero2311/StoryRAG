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
    avgFeedbackResponseHours?: number | null;
    openFeedbacksAssigned: number;
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

    async warnAuthor(payload: { userId: string; projectId?: string; message: string }): Promise<void> {
        await api.post('/staff/moderation/warn', payload);
    },

    async suspendProject(payload: { projectId: string; reason?: string }): Promise<void> {
        await api.post('/staff/moderation/suspend-project', payload);
    },

    async recommendBan(payload: { userId: string; reason: string }): Promise<void> {
        await api.post('/staff/moderation/recommend-ban', payload);
    },
};
