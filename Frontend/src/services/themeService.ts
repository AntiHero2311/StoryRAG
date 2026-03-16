import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeEntry {
    id: string;
    projectId: string;
    title: string;
    description: string;
    notes?: string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateThemeRequest {
    title: string;
    description: string;
    notes?: string;
}

export interface UpdateThemeRequest {
    title?: string;
    description?: string;
    notes?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/themes`;

export const themeService = {
    getAll: (projectId: string) =>
        api.get<ThemeEntry[]>(BASE(projectId)).then(r => r.data),

    getById: (projectId: string, id: string) =>
        api.get<ThemeEntry>(`${BASE(projectId)}/${id}`).then(r => r.data),

    create: (projectId: string, data: CreateThemeRequest) =>
        api.post<ThemeEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdateThemeRequest) =>
        api.put<ThemeEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),

    embed: (projectId: string, id: string) =>
        api.post<ThemeEntry>(`${BASE(projectId)}/${id}/embed`).then(r => r.data),
};
