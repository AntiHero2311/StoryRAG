import { api } from './api';

export interface GenreResponse {
    id: number;
    name: string;
    slug: string;
    color: string;
    description: string | null;
}

export interface ProjectResponse {
    id: string;
    title: string;
    summary: string | null;
    aiInstructions: string | null;
    coverImageURL: string | null;
    status: 'Draft' | 'Published' | 'Archived';
    createdAt: string;
    updatedAt: string | null;
    genres: GenreResponse[];
}

export interface CreateProjectRequest {
    title: string;
    summary?: string;
    aiInstructions?: string;
    status?: string;
    genreIds?: number[];
}

export interface UpdateProjectRequest {
    title: string;
    summary?: string;
    aiInstructions?: string;
    coverImageURL?: string;
    status?: string;
    genreIds?: number[];
}

export const projectService = {
    getProjects: () =>
        api.get<ProjectResponse[]>('/projects').then(r => r.data),

    getProject: (id: string) =>
        api.get<ProjectResponse>(`/projects/${id}`).then(r => r.data),

    createProject: (data: CreateProjectRequest) =>
        api.post<ProjectResponse>('/projects', data).then(r => r.data),

    updateProject: (id: string, data: UpdateProjectRequest) =>
        api.put<ProjectResponse>(`/projects/${id}`, data).then(r => r.data),

    deleteProject: (id: string) =>
        api.delete(`/projects/${id}`).then(r => r.data),

    exportProject: async (id: string, title: string) => {
        const response = await api.get(`/projects/${id}/export`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([response.data], { type: 'text/plain;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    getStats: () =>
        api.get<{ totalChapters: number; totalAnalysesUsed: number; totalChatMessages: number }>('/projects/stats').then(r => r.data),
};
