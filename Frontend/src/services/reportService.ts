import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CriterionResult {
    key: string;
    groupName: string;
    criterionName: string;
    score: number;
    maxScore: number;
    feedback: string;
    errors: string[];
    suggestions: string[];
}

export interface GroupResult {
    name: string;
    score: number;
    maxScore: number;
    criteria: CriterionResult[];
}

export interface ProjectReportResponse {
    id: string;
    projectId: string;
    projectTitle: string;
    status: 'Pending' | 'Completed' | 'Failed' | 'MockData';
    totalScore: number;
    classification: 'Cần sửa lớn' | 'Trung bình' | 'Khá' | 'Xuất sắc';
    groups: GroupResult[];
    createdAt: string;
}

export interface ProjectReportSummary {
    id: string;
    status: string;
    totalScore: number;
    classification: string;
    createdAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const reportService = {
    analyze: (projectId: string) =>
        api.post<ProjectReportResponse>(`/ai/${projectId}/analyze`).then(r => r.data),

    getLatest: (projectId: string) =>
        api.get<ProjectReportResponse>(`/ai/${projectId}/reports/latest`).then(r => r.data),

    getAll: (projectId: string) =>
        api.get<ProjectReportSummary[]>(`/ai/${projectId}/reports`).then(r => r.data),

    getById: (projectId: string, reportId: string) =>
        api.get<ProjectReportResponse>(`/ai/${projectId}/reports/${reportId}`).then(r => r.data),
};
