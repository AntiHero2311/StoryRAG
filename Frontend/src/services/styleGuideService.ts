import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StyleGuideAspect =
    | 'POV'
    | 'Tone'
    | 'Vocabulary'
    | 'Dialogue'
    | 'Pacing'
    | 'Other';

export interface StyleGuideEntry {
    id: string;
    projectId: string;
    aspect: StyleGuideAspect | string;
    content: string;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateStyleGuideRequest {
    aspect?: string;
    content: string;
}

export interface UpdateStyleGuideRequest {
    aspect?: string;
    content?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = (projectId: string) => `/projects/${projectId}/style-guide`;

export const styleGuideService = {
    getAll: (projectId: string) =>
        api.get<StyleGuideEntry[]>(BASE(projectId)).then(r => r.data),

    getById: (projectId: string, id: string) =>
        api.get<StyleGuideEntry>(`${BASE(projectId)}/${id}`).then(r => r.data),

    create: (projectId: string, data: CreateStyleGuideRequest) =>
        api.post<StyleGuideEntry>(BASE(projectId), data).then(r => r.data),

    update: (projectId: string, id: string, data: UpdateStyleGuideRequest) =>
        api.put<StyleGuideEntry>(`${BASE(projectId)}/${id}`, data).then(r => r.data),

    delete: (projectId: string, id: string) =>
        api.delete(`${BASE(projectId)}/${id}`),

    embed: (projectId: string, id: string) =>
        api.post<StyleGuideEntry>(`${BASE(projectId)}/${id}/embed`).then(r => r.data),
};

export const STYLE_GUIDE_ASPECTS: { value: StyleGuideAspect; label: string; color: string; placeholder: string }[] = [
    { value: 'POV', label: 'Ngôi kể & Góc nhìn', color: '#60a5fa', placeholder: 'Mô tả chi tiết về ngôi kể (thứ nhất, thứ ba...), khoảng cách với nhân vật, giới hạn góc nhìn...' },
    { value: 'Tone', label: 'Tone & Không khí', color: '#fb923c', placeholder: 'Giọng văn chung, không khí (hào hùng, bi đát, hài hước, châm biếm...)' },
    { value: 'Vocabulary', label: 'Từ vựng & Miêu tả', color: '#2dd4bf', placeholder: 'Bộ từ vựng đặc trưng, mức độ sử dụng từ Hán Việt/cổ phong, hay văn phong phóng khoáng...' },
    { value: 'Dialogue', label: 'Đối thoại', color: '#a78bfa', placeholder: 'Quy tắc viết đối thoại: ngắn gọn hay văn hoa, có dùng nhiều từ địa phương không...' },
    { value: 'Pacing', label: 'Nhịp độ', color: '#f43f5e', placeholder: 'Nhịp độ truyện: chậm rãi đi sâu vào nội tâm, hay nhanh dồn dập nhiều hành động...' },
    { value: 'Other', label: 'Khác', color: '#6b7280', placeholder: 'Các lưu ý khác về văn phong...' },
];

export function getStyleGuideAspectLabel(aspect: string): string {
    return STYLE_GUIDE_ASPECTS.find(a => a.value === aspect)?.label ?? aspect;
}

export function getStyleGuideAspectColor(aspect: string): string {
    return STYLE_GUIDE_ASPECTS.find(a => a.value === aspect)?.color ?? '#6b7280';
}
