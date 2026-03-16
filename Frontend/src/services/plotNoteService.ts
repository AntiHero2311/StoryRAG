import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlotNoteType =
    | 'Arc'
    | 'Conflict'
    | 'Foreshadowing'
    | 'Twist'
    | 'Climax'
    | 'Resolution'
    | 'Other';

export interface PlotNoteEntry {
    id: string;
    projectId: string;
    type: PlotNoteType | string;
    title: string;
    content: string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface CreatePlotNoteRequest {
    type?: string;
    title: string;
    content: string;
}

export interface UpdatePlotNoteRequest {
    type?: string;
    title?: string;
    content?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/plot-notes`;

export const plotNoteService = {
    getAll: (projectId: string) =>
        api.get<PlotNoteEntry[]>(BASE(projectId)).then(r => r.data),

    getById: (projectId: string, id: string) =>
        api.get<PlotNoteEntry>(`${BASE(projectId)}/${id}`).then(r => r.data),

    create: (projectId: string, data: CreatePlotNoteRequest) =>
        api.post<PlotNoteEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdatePlotNoteRequest) =>
        api.put<PlotNoteEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),

    embed: (projectId: string, id: string) =>
        api.post<PlotNoteEntry>(`${BASE(projectId)}/${id}/embed`).then(r => r.data),
};

export const PLOT_NOTE_TYPES: { value: PlotNoteType; label: string; color: string; placeholder: string }[] = [
    { value: 'Arc', label: 'Story Arc', color: '#3b82f6', placeholder: 'Mô tả diễn biến của một tuyến truyện / arc lớn...' },
    { value: 'Conflict', label: 'Xung đột', color: '#ef4444', placeholder: 'Mô tả mâu thuẫn, xung đột chính trị/cá nhân, khó khăn thử thách...' },
    { value: 'Foreshadowing', label: 'Foreshadowing (Cài cắm)', color: '#8b5cf6', placeholder: 'Các chi tiết ẩn ý, foreshadowing sẽ được giải quyết sau...' },
    { value: 'Twist', label: 'Plot Twist', color: '#f59e0b', placeholder: 'Bước ngoặt bất ngờ, kế hoạch đảo lộn...' },
    { value: 'Climax', label: 'Cao trào (Climax)', color: '#10b981', placeholder: 'Trận chiến cuối cùng, hoặc điểm bùng nổ của xung đột...' },
    { value: 'Resolution', label: 'Giải quyết & Kết thúc', color: '#14b8a6', placeholder: 'Kết cục của các nhân vật, thông điệp rút ra...' },
    { value: 'Other', label: 'Khác', color: '#6b7280', placeholder: 'Các ghi chú khác về cốt truyện...' },
];

export function getPlotNoteTypeLabel(type: string): string {
    return PLOT_NOTE_TYPES.find(t => t.value === type)?.label ?? type;
}

export function getPlotNoteTypeColor(type: string): string {
    return PLOT_NOTE_TYPES.find(t => t.value === type)?.color ?? '#6b7280';
}
