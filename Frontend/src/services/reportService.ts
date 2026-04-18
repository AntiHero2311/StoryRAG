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
    projectVersion: string;
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

export interface PacingPoint {
    segmentIndex: number;
    chapterNumber: number;
    score: number;
}

export interface EmotionPoint {
    segmentIndex: number;
    chapterNumber: number;
    valence: number;
    intensity: number;
    dominantEmotion: string;
}

export interface CharacterFrequency {
    characterName: string;
    totalMentions: number;
}

export interface CharacterPresencePoint {
    segmentIndex: number;
    chapterNumber: number;
    mentions: number;
}

export interface CharacterPresenceSeries {
    characterName: string;
    points: CharacterPresencePoint[];
}

export interface CharacterRelationshipEdge {
    sourceCharacter: string;
    targetCharacter: string;
    weight: number;
}

export interface NarrativeChartsResponse {
    pacing: PacingPoint[];
    emotions: EmotionPoint[];
    characterFrequencies: CharacterFrequency[];
    characterPresence: CharacterPresenceSeries[];
    characterRelationships: CharacterRelationshipEdge[];
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const reportService = {
    getActiveAnalyzeJob: (projectId?: string) => {
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        const query = params.toString();
        const url = query ? `/ai/analyze/jobs/active?${query}` : '/ai/analyze/jobs/active';
        return api.get<ProjectAnalysisJobResponse | null>(url).then(r => r.data);
    },

    enqueueAnalyzeJob: (projectId: string) =>
        api.post<ProjectAnalysisJobResponse>(`/ai/${projectId}/analyze/jobs`).then(r => r.data),

    getAnalyzeJob: (projectId: string, jobId: string) =>
        api.get<ProjectAnalysisJobResponse>(`/ai/${projectId}/analyze/jobs/${jobId}`).then(r => r.data),

    getLatestAnalyzeJob: (projectId: string) =>
        api.get<ProjectAnalysisJobResponse | null>(`/ai/${projectId}/analyze/jobs/latest`).then(r => r.data),

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

    getNarrativeCharts: (projectId: string, chapterId?: string) =>
        api.get<NarrativeChartsResponse>(`/ai/${projectId}/narrative/charts`, {
            params: chapterId ? { chapterId } : {},
        }).then(r => r.data),

    exportReportPdf: async (projectId: string, reportId: string): Promise<void> => {
        const res = await api.get(`/ai/${projectId}/reports/${reportId}/export/pdf`, {
            responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `AnalysisReport_${reportId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
};
