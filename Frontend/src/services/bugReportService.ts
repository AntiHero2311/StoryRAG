import { api } from './api';

export type BugCategory = 'Bug' | 'UX' | 'Feature' | 'Other';
export type BugPriority = 'Low' | 'Medium' | 'High';
export type BugStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed';

export interface BugReportResponse {
    id: string;
    userId: string;
    reporterName: string;
    reporterEmail: string;
    title: string;
    description: string;
    category: BugCategory;
    priority: BugPriority;
    status: BugStatus;
    staffNote: string | null;
    resolvedByName: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface BugReportStatsResponse {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
}

export interface CreateBugReportRequest {
    title: string;
    description: string;
    category: BugCategory;
    priority: BugPriority;
}

export interface UpdateBugReportRequest {
    status: BugStatus;
    staffNote?: string;
}

export const bugReportService = {
    create: (data: CreateBugReportRequest) =>
        api.post<BugReportResponse>('/bug-reports', data).then(r => r.data),

    getMy: () =>
        api.get<BugReportResponse[]>('/bug-reports/my').then(r => r.data),

    getAll: (status?: BugStatus) =>
        api.get<BugReportResponse[]>('/bug-reports', { params: status ? { status } : {} }).then(r => r.data),

    getStats: () =>
        api.get<BugReportStatsResponse>('/bug-reports/stats').then(r => r.data),

    updateStatus: (reportId: string, data: UpdateBugReportRequest) =>
        api.put<BugReportResponse>(`/bug-reports/${reportId}`, data).then(r => r.data),

    delete: (reportId: string) =>
        api.delete(`/bug-reports/${reportId}`),
};
