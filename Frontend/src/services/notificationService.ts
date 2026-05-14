import { api } from './api';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
    id: string;
    userId: string;
    createdByUserId: string | null;
    createdByName: string | null;
    type: NotificationType;
    title: string;
    message: string;
    tag?: string;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
}

export interface CreateNotificationRequest {
    title: string;
    message: string;
    type: NotificationType;
    tag?: string;
    targetRoles?: Array<'Author' | 'Staff' | 'Admin'>;
}

export interface CreateNotificationResult {
    createdCount: number;
}

export const notificationService = {
    getMy: (limit = 50) =>
        api.get<NotificationItem[]>('/notifications', { params: { limit } }).then(r => r.data),

    create: (payload: CreateNotificationRequest) =>
        api.post<CreateNotificationResult>('/notifications', payload).then(r => r.data),

    markRead: (notificationId: string) =>
        api.post<NotificationItem>(`/notifications/${notificationId}/mark-read`).then(r => r.data),

    markAllRead: () =>
        api.post<{ readCount: number }>('/notifications/mark-all-read').then(r => r.data),
};
