import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorldbuildingCategory =
    // ── New primary categories ──
    | 'Scene'      // Cảnh vật, Không gian hẹp
    | 'Setting'    // Bối cảnh
    | 'Location'   // Địa điểm
    | 'Rules'      // Quy tắc thế giới
    | 'Glossary'   // Thuật ngữ
    | 'Timeline'   // Dòng thời gian
    // ── Legacy / extra ──
    | 'World'
    | 'Magic'
    | 'History'
    | 'Religion'
    | 'Geography'
    | 'Technology'
    | 'Other';

export interface WorldbuildingEntry {
    id: string;
    projectId: string;
    title: string;
    content: string;
    category: WorldbuildingCategory | string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateWorldbuildingRequest {
    title: string;
    content: string;
    category?: string;
}

export interface UpdateWorldbuildingRequest {
    title?: string;
    content?: string;
    category?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/worldbuilding`;

export const worldbuildingService = {
    getAll: (projectId: string) =>
        api.get<WorldbuildingEntry[]>(BASE(projectId)).then(r => r.data),

    getById: (projectId: string, id: string) =>
        api.get<WorldbuildingEntry>(`${BASE(projectId)}/${id}`).then(r => r.data),

    create: (projectId: string, data: CreateWorldbuildingRequest) =>
        api.post<WorldbuildingEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdateWorldbuildingRequest) =>
        api.put<WorldbuildingEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),

    embed: (projectId: string, id: string) =>
        api.post<WorldbuildingEntry>(`${BASE(projectId)}/${id}/embed`).then(r => r.data),
};

export const WORLDBUILDING_CATEGORIES: { value: WorldbuildingCategory; label: string; color: string; placeholder: string }[] = [
    // ── Primary ──
    { value: 'Scene',      label: 'Cảnh',            color: '#c084fc', placeholder: 'Mô tả chi tiết một phân cảnh cụ thể, căn phòng, hay không gian mà nhân vật tương tác...' },
    { value: 'Setting',    label: 'Bối cảnh',        color: '#60a5fa', placeholder: 'Mô tả bối cảnh thế giới: thời đại, văn minh, không khí chung...' },
    { value: 'Location',   label: 'Địa điểm',        color: '#22d3ee', placeholder: 'Mô tả địa điểm, vị trí, địa danh quan trọng trong thế giới...' },
    { value: 'Rules',      label: 'Quy tắc thế giới', color: '#fb923c', placeholder: 'Quy tắc, luật lệ, giới hạn: magic system, vật lý thế giới, cấm kỵ...' },
    { value: 'Glossary',   label: 'Thuật ngữ',        color: '#2dd4bf', placeholder: 'Thuật ngữ: [Từ] — Giải thích ý nghĩa, nguồn gốc...' },
    { value: 'Timeline',   label: 'Dòng thời gian',   color: '#fbbf24', placeholder: 'Sự kiện theo trình tự (Năm X — Tên sự kiện): mô tả chi tiết...' },
    // ── Extended ──
    { value: 'Magic',      label: 'Ma thuật',         color: '#a78bfa', placeholder: 'Hệ thống ma thuật, năng lực đặc biệt, nguồn gốc sức mạnh...' },
    { value: 'History',    label: 'Lịch sử',          color: '#d97706', placeholder: 'Lịch sử thế giới, các sự kiện trong quá khứ, chiến tranh, vương triều...' },
    { value: 'Religion',   label: 'Tôn giáo',         color: '#e879f9', placeholder: 'Tôn giáo, tín ngưỡng, thần linh, nghi lễ, giáo điều...' },
    { value: 'Geography',  label: 'Địa lý',           color: '#4ade80', placeholder: 'Địa hình, khí hậu, lục địa, biển, bản đồ thế giới...' },
    { value: 'Technology', label: 'Công nghệ',        color: '#94a3b8', placeholder: 'Công nghệ, phát minh, trình độ văn minh, vũ khí, phương tiện...' },
    { value: 'World',      label: 'Thế giới',         color: '#818cf8', placeholder: 'Thông tin tổng quan về thế giới...' },
    { value: 'Other',      label: 'Khác',             color: '#6b7280', placeholder: 'Mô tả chi tiết về yếu tố thế giới này...' },
];

export function getCategoryLabel(cat: string): string {
    return WORLDBUILDING_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}

export function getCategoryColor(cat: string): string {
    return WORLDBUILDING_CATEGORIES.find(c => c.value === cat)?.color ?? '#6b7280';
}

export function getCategoryPlaceholder(cat: string): string {
    return WORLDBUILDING_CATEGORIES.find(c => c.value === cat)?.placeholder
        ?? 'Mô tả chi tiết về yếu tố thế giới này...';
}
