import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineCategory = 'Historical' | 'Story' | 'Character' | 'World' | 'Political' | 'Other';
export type TimelineImportance = 'Minor' | 'Normal' | 'Major' | 'Critical';

export interface TimelineEventEntry {
    id: string;
    projectId: string;
    category: TimelineCategory | string;
    title: string;
    description: string;
    timeLabel?: string;
    sortOrder: number;
    importance: TimelineImportance | string;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateTimelineEventRequest {
    category?: string;
    title: string;
    description?: string;
    timeLabel?: string;
    sortOrder?: number;
    importance?: string;
}

export interface UpdateTimelineEventRequest {
    category?: string;
    title?: string;
    description?: string;
    timeLabel?: string;
    sortOrder?: number;
    importance?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIMELINE_CATEGORIES: { value: TimelineCategory; label: string; color: string }[] = [
    { value: 'Story',      label: 'Cốt truyện',   color: '#8b5cf6' },
    { value: 'Historical', label: 'Lịch sử',       color: '#f59e0b' },
    { value: 'Character',  label: 'Nhân vật',      color: '#ec4899' },
    { value: 'World',      label: 'Thế giới',      color: '#10b981' },
    { value: 'Political',  label: 'Chính trị',     color: '#3b82f6' },
    { value: 'Other',      label: 'Khác',           color: '#6b7280' },
];

export const TIMELINE_IMPORTANCE: { value: TimelineImportance; label: string; color: string; size: number }[] = [
    { value: 'Critical', label: 'Cực kỳ quan trọng', color: '#ef4444', size: 20 },
    { value: 'Major',    label: 'Quan trọng',         color: '#f97316', size: 16 },
    { value: 'Normal',   label: 'Bình thường',        color: '#8b5cf6', size: 12 },
    { value: 'Minor',    label: 'Phụ',                color: '#6b7280', size: 10 },
];

export function getCategoryColor(cat: string): string {
    return TIMELINE_CATEGORIES.find(c => c.value === cat)?.color ?? '#6b7280';
}

export function getCategoryLabel(cat: string): string {
    return TIMELINE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}

export function getImportanceInfo(imp: string) {
    return TIMELINE_IMPORTANCE.find(i => i.value === imp) ?? TIMELINE_IMPORTANCE[2];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/timeline`;

export const timelineService = {
    getAll: (projectId: string) =>
        api.get<TimelineEventEntry[]>(BASE(projectId)).then(r => r.data),

    create: (projectId: string, data: CreateTimelineEventRequest) =>
        api.post<TimelineEventEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdateTimelineEventRequest) =>
        api.put<TimelineEventEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),
};
