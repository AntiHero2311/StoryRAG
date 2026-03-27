import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneItem {
    title: string;
    description: string;
    openingLine: string;
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

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiAnalysisService = {
    /**
     * Phân rã nội dung chương thành danh sách các Cảnh (Scenes/Beats).
     * @param projectId - ID của dự án
     * @param content   - Nội dung chương cần phân tích
     */
    analyzeScenes: (projectId: string, content: string) =>
        api.post<AiSceneAnalysisResult>(`/ai/${projectId}/scenes`, { content }).then(r => r.data),

    /**
     * Phân tích cấu trúc 3 hồi và phát hiện điểm Hạ hồi phân giải (Cliffhanger).
     * @param projectId - ID của dự án
     * @param content   - Nội dung chương cần phân tích
     */
    analyzeCliffhanger: (projectId: string, content: string) =>
        api.post<AiCliffhangerResult>(`/ai/${projectId}/cliffhanger`, { content }).then(r => r.data),
};
