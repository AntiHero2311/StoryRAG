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

export interface StoryWarning {
    code: string;
    severity: string;
    title: string;
    detail: string;
}

export interface ProjectReportResponse {
    id: string;
    projectId: string;
    projectTitle: string;
    status: 'Pending' | 'Completed' | 'Failed' | 'MockData';
    totalScore: number;
    classification: 'Cần sửa lớn' | 'Trung bình' | 'Khá' | 'Xuất sắc';
    overallFeedback: string;
    groups: GroupResult[];
    warnings: StoryWarning[];
    createdAt: string;
}

export interface ProjectReportSummary {
    id: string;
    status: string;
    totalScore: number;
    classification: string;
    createdAt: string;
}

export interface ProjectAnalysisJobResponse {
    jobId: string;
    projectId: string;
    status: 'Queued' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled';
    stage: 'Queued' | 'Preparing' | 'Analyzing' | 'Saving' | 'Completed' | 'Failed' | 'Cancelled';
    progress: number;
    reportId: string | null;
    errorMessage: string | null;
    isExistingJob: boolean;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const reportService = {
    enqueueAnalyzeJob: (projectId: string) =>
        api.post<ProjectAnalysisJobResponse>(`/ai/${projectId}/analyze/jobs`).then(r => r.data),

    getAnalyzeJob: (projectId: string, jobId: string) =>
        api.get<ProjectAnalysisJobResponse>(`/ai/${projectId}/analyze/jobs/${jobId}`).then(r => r.data),

    getAnalyzeJobResult: (projectId: string, jobId: string) =>
        api.get<ProjectReportResponse>(`/ai/${projectId}/analyze/jobs/${jobId}/result`).then(r => r.data),

    cancelAnalyzeJob: (projectId: string, jobId: string) =>
        api.post<ProjectAnalysisJobResponse>(`/ai/${projectId}/analyze/jobs/${jobId}/cancel`).then(r => r.data),

    analyze: (projectId: string) =>
        api.post<ProjectReportResponse>(`/ai/${projectId}/analyze`).then(r => r.data),

    getLatest: (projectId: string) =>
        api.get<ProjectReportResponse>(`/ai/${projectId}/reports/latest`).then(r => r.data),

    getAll: (projectId: string) =>
        api.get<ProjectReportSummary[]>(`/ai/${projectId}/reports`).then(r => r.data),

    getById: (projectId: string, reportId: string) =>
        api.get<ProjectReportResponse>(`/ai/${projectId}/reports/${reportId}`).then(r => r.data),
};
