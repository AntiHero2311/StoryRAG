import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CharacterRole = 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';

export interface CharacterEntry {
    id: string;
    projectId: string;
    name: string;
    role: CharacterRole | string;
    description: string;
    background?: string;
    notes?: string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateCharacterRequest {
    name: string;
    role?: string;
    description: string;
    background?: string;
    notes?: string;
}

export interface UpdateCharacterRequest {
    name?: string;
    role?: string;
    description?: string;
    background?: string;
    notes?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/character`;

export const characterService = {
    getAll: (projectId: string) =>
        api.get<CharacterEntry[]>(BASE(projectId)).then(r => r.data),

    getById: (projectId: string, id: string) =>
        api.get<CharacterEntry>(`${BASE(projectId)}/${id}`).then(r => r.data),

    create: (projectId: string, data: CreateCharacterRequest) =>
        api.post<CharacterEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdateCharacterRequest) =>
        api.put<CharacterEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),

    embed: (projectId: string, id: string) =>
        api.post<CharacterEntry>(`${BASE(projectId)}/${id}/embed`).then(r => r.data),
};

export const CHARACTER_ROLES: { value: CharacterRole; label: string; color: string }[] = [
    { value: 'Protagonist', label: 'Nhân vật chính',  color: '#f5a623' },
    { value: 'Antagonist',  label: 'Phản diện',       color: '#ef4444' },
    { value: 'Supporting',  label: 'Nhân vật phụ',    color: '#0ea5e9' },
    { value: 'Minor',       label: 'Nhân vật phụ nhỏ', color: '#8b5cf6' },
];

export function getRoleInfo(role: string) {
    return CHARACTER_ROLES.find(r => r.value === role) ?? { value: role, label: role, color: '#6b7280' };
}
