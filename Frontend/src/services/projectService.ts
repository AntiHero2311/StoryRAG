import { api } from './api';

export interface ProjectResponse {
    id: string;
    title: string;
    summary: string | null;
    coverImageURL: string | null;
    status: 'Draft' | 'Published' | 'Archived';
    createdAt: string;
    updatedAt: string | null;
}

export interface CreateProjectRequest {
    title: string;
    summary?: string;
    status?: string;
}

export interface UpdateProjectRequest {
    title: string;
    summary?: string;
    coverImageURL?: string;
    status?: string;
}

export const projectService = {
    getProjects: () =>
        api.get<ProjectResponse[]>('/project').then(r => r.data),

    getProject: (id: string) =>
        api.get<ProjectResponse>(`/project/${id}`).then(r => r.data),

    createProject: (data: CreateProjectRequest) =>
        api.post<ProjectResponse>('/project', data).then(r => r.data),

    updateProject: (id: string, data: UpdateProjectRequest) =>
        api.put<ProjectResponse>(`/project/${id}`, data).then(r => r.data),

    deleteProject: (id: string) =>
        api.delete(`/project/${id}`).then(r => r.data),
};
