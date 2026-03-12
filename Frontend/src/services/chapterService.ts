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
    title: string | null;
    wordCount: number;
    tokenCount: number;
    isChunked: boolean;
    isEmbedded: boolean;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string | null;
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
}

export interface UpdateChapterRequest {
    title?: string;
    content: string;
}

export interface CreateVersionRequest {
    title?: string;
}

export interface UpdateVersionTitleRequest {
    title: string;
}

export interface RenameChapterRequest {
    title: string;
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

    /** Lưu in-place: cập nhật content của version đang active (không tạo version mới). */
    updateChapter: (projectId: string, chapterId: string, data: UpdateChapterRequest) =>
        api.put<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}`, data).then(r => r.data),

    deleteChapter: (projectId: string, chapterId: string) =>
        api.delete(`/project/${projectId}/chapters/${chapterId}`).then(r => r.data),

    /** Đổi tên chương (chỉ title, không ảnh hưởng content hay version). */
    renameChapter: (projectId: string, chapterId: string, title: string) =>
        api.patch<ChapterResponse>(`/project/${projectId}/chapters/${chapterId}/title`, { title }).then(r => r.data),

    // Version management
    getVersions: (projectId: string, chapterId: string) =>
        api.get<ChapterVersionSummary[]>(`/project/${projectId}/chapters/${chapterId}/versions`).then(r => r.data),

    getVersionDetail: (projectId: string, chapterId: string, versionNumber: number) =>
        api.get<ChapterVersionDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}`).then(r => r.data),

    /** Tạo version trống mới (do người dùng chủ ý). */
    createNewVersion: (projectId: string, chapterId: string, data: CreateVersionRequest = {}) =>
        api.post<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions`, data).then(r => r.data),

    /** Chuyển sang version khác (set làm active). */
    setActiveVersion: (projectId: string, chapterId: string, versionNumber: number) =>
        api.patch<ChapterDetailResponse>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}/activate`).then(r => r.data),

    /** Đổi tên version. */
    updateVersionTitle: (projectId: string, chapterId: string, versionNumber: number, title: string) =>
        api.patch<ChapterVersionSummary>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}/title`, { title }).then(r => r.data),

    /** Xóa version (chỉ khi chapter có ≥2 version). */
    deleteVersion: (projectId: string, chapterId: string, versionNumber: number) =>
        api.delete(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}`).then(r => r.data),

    /** Toggle ghim version — version ghim không bị xóa tự động khi vượt giới hạn 20. */
    pinVersion: (projectId: string, chapterId: string, versionNumber: number) =>
        api.put<ChapterVersionSummary>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}/pin`).then(r => r.data),

    /** Lấy nội dung thuần của version để so sánh diff. */
    getVersionContent: (projectId: string, chapterId: string, versionNumber: number) =>
        api.get<{ content: string }>(`/project/${projectId}/chapters/${chapterId}/versions/${versionNumber}/content`).then(r => r.data.content),

    // Chunking
    chunkChapter: (projectId: string, chapterId: string) =>
        api.post<ChapterVersionDetailResponse>(`/project/${projectId}/chapters/${chapterId}/chunk`).then(r => r.data),
};
