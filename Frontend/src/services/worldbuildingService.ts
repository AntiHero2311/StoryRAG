import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorldbuildingCategory =
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

const BASE = (projectId: string) => `/project/${projectId}/worldbuilding`;

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

export const WORLDBUILDING_CATEGORIES: { value: WorldbuildingCategory; label: string }[] = [
    { value: 'World',      label: 'Thế giới' },
    { value: 'Magic',      label: 'Ma thuật' },
    { value: 'History',    label: 'Lịch sử' },
    { value: 'Religion',   label: 'Tôn giáo' },
    { value: 'Geography',  label: 'Địa lý' },
    { value: 'Technology', label: 'Công nghệ' },
    { value: 'Other',      label: 'Khác' },
];

export function getCategoryLabel(cat: string): string {
    return WORLDBUILDING_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}
