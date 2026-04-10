import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneItem {
    title: string;
    description: string;
    exactQuote: string;
    /** Action | Dialogue | Introspection | Transition | Revelation */
    type: string;
}

export interface AiSceneAnalysisResult {
    chapterSummary: string;
    scenes: SceneItem[];
    totalTokens: number;
}

export interface AiCliffhangerResult {
    hasCliffhanger: boolean;
    cliffhangerDescription: string;
    cliffhangerQuote: string;
    actSetup: string;
    actConflict: string;
    actClimax: string;
    structureFeedback: string;
    totalTokens: number;
}

// ─── Scene type badge colors ──────────────────────────────────────────────────

export const SCENE_TYPE_COLORS: Record<string, string> = {
    Action:        '#f97316',
    Dialogue:      '#3b82f6',
    Introspection: '#a78bfa',
    Transition:    '#6b7280',
    Revelation:    '#f59e0b',
};

export function getSceneTypeLabel(type: string): string {
    const map: Record<string, string> = {
        Action:        'Hành động',
        Dialogue:      'Đối thoại',
        Introspection: 'Nội tâm',
        Transition:    'Chuyển cảnh',
        Revelation:    'Tiết lộ',
    };
    return map[type] ?? type;
}

export interface AiAnalysisHistoryDto {
    id: string;
    projectId: string;
    chapterId: string | null;
    analysisType: string;
    resultJson: string;
    totalTokens: number;
    createdAt: string;
}

export interface AiAnalysisHistoryResult {
    items: AiAnalysisHistoryDto[];
    totalCount: number;
    page: number;
    pageSize: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiAnalysisService = {
    /**
     * Phân rã nội dung chương thành danh sách các Cảnh (Scenes/Beats).
     */
    analyzeScenes: (projectId: string, content: string, chapterId?: string) =>
        api.post<AiSceneAnalysisResult>(`/ai/${projectId}/scenes`, { content, chapterId }).then(r => r.data),

    /**
     * Phân tích cấu trúc 3 hồi và phát hiện điểm Hạ hồi phân giải (Cliffhanger).
     */
    analyzeCliffhanger: (projectId: string, content: string, chapterId?: string) =>
        api.post<AiCliffhangerResult>(`/ai/${projectId}/cliffhanger`, { content, chapterId }).then(r => r.data),

    /**
     * Lấy lịch sử phân tích.
     */
    getAnalysisHistory: (projectId: string, type: 'Scenes' | 'Cliffhanger', chapterId?: string | null, page = 1, pageSize = 20) => {
        const params = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
        if (chapterId) params.set('chapterId', chapterId);
        return api.get<AiAnalysisHistoryResult>(`/ai/${projectId}/analysis/history?${params.toString()}`).then(r => r.data);
    },
};
