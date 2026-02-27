import { api } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChapterResponse {
    id: string;
    projectId: string;
    chapterNumber: number;
    title: string | null;
    wordCount: number;
    status: 'Draft' | 'Final' | 'Archived';
    currentVersionNum: number;
    currentVersionId: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface ChapterDetailResponse extends ChapterResponse {
    content: string | null;
    versions: ChapterVersionSummary[];
}

export interface ChapterVersionSummary {
    id: string;
    versionNumber: number;
    changeNote: string | null;
    wordCount: number;
    tokenCount: number;
    isChunked: boolean;
    isEmbedded: boolean;
    createdAt: string;
    createdByName: string;
}

export interface ChapterVersionDetailResponse extends ChapterVersionSummary {
    content: string;
    chunks: ChapterChunkResponse[];
}

export interface ChapterChunkResponse {
    id: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    hasEmbedding: boolean;
}

export interface CreateChapterRequest {
    chapterNumber: number;
    title?: string;
    content: string;
    changeNote?: string;
}

export interface UpdateChapterRequest {
    title?: string;
    content: string;
    changeNote?: string;
}

export interface SaveNewVersionRequest {
    content: string;
    changeNote?: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export const chapterService = {
    // Chapter CRUD
    getChapters: (projectId: string) =>
        api.get<ChapterResponse[]>(`/project/${projectId}/chapters`).then(r => r.data),

    getChapterDetail: (projectId: string, chapterId: string) =>
        api.get<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}`).then(r => r.data),

    createChapter: (projectId: string, data: CreateChapterRequest) =>
        api.post<ChapterDetailResponse>(`/project/${projectId}/chapters`, data).then(r => r.data),

    updateChapter: (projectId: string, chapterId: string, data: UpdateChapterRequest) =>
        api.put<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}`, data).then(r => r.data),

    deleteChapter: (projectId: string, chapterId: string) =>
        api.delete(`/project/${projectId}/chapters/${chapterId}`).then(r => r.data),

    // Version management
    getVersions: (projectId: string, chapterId: string) =>
        api.get<ChapterVersionSummary[]>(`/project/${projectId}/chapters/${chapterId}/versions`).then(r => r.data),

    getVersionDetail: (projectId: string, chapterId: string, versionNumber: number) =>
        api.get<ChapterVersionDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}`).then(r => r.data),

    saveNewVersion: (projectId: string, chapterId: string, data: SaveNewVersionRequest) =>
        api.post<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions`, data).then(r => r.data),

    restoreVersion: (projectId: string, chapterId: string, versionNumber: number) =>
        api.post<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}/restore`).then(r => r.data),

    // Chunking
    chunkChapter: (projectId: string, chapterId: string) =>
        api.post<ChapterVersionDetailResponse>(`/project/${projectId}/chapters/${chapterId}/chunk`).then(r => r.data),
};
