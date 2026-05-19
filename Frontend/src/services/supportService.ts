import api from './api';
import type { AuthorAppealResponse, SupportTicketResponse } from './staffService';

export type SupportTicketCategory = 'Payment' | 'Subscription' | 'Usage' | 'DataDeletion' | 'Other';
export type AppealType = 'ProjectFlag' | 'StaffFeedback' | 'ReportReview';

export const supportService = {
    async getMyTickets(): Promise<SupportTicketResponse[]> {
        const { data } = await api.get<SupportTicketResponse[]>('/me/support-tickets');
        return data;
    },

    async createTicket(payload: {
        category: SupportTicketCategory;
        subject: string;
        description: string;
    }): Promise<SupportTicketResponse> {
        const { data } = await api.post<SupportTicketResponse>('/me/support-tickets', payload);
        return data;
    },

    async getMyAppeals(): Promise<AuthorAppealResponse[]> {
        const { data } = await api.get<AuthorAppealResponse[]>('/me/appeals');
        return data;
    },

    async createAppeal(payload: {
        projectId: string;
        appealType: AppealType;
        referenceId?: string;
        reason: string;
    }): Promise<AuthorAppealResponse> {
        const { data } = await api.post<AuthorAppealResponse>('/me/appeals', payload);
        return data;
    },
};
