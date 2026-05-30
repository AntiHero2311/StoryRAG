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

export interface ProjectImportResult {
    projectId: string;
    projectTitle: string;
    chaptersImported: number;
    charactersExtracted: number;
    settingsExtracted: number;
    timelineEventsExtracted: number;
    summary: string | null;
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
        const response = await api.get(`/manuscript/${id}/export`, {
            params: { format: 'docx' },
            responseType: 'blob',
        });
        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
        const a = document.createElement('a');
        a.href = url;

        // Trích xuất tên file từ Content-Disposition header nếu có
        const disposition = response.headers['content-disposition'];
        let downloadName = `${title}.docx`;
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { 
                downloadName = matches[1].replace(/['"]/g, '');
            }
        }

        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importFromManuscript: async (file: File): Promise<ProjectImportResult> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<ProjectImportResult>('/projects/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    getStats: () =>
        api.get<{ totalChapters: number; totalAnalysesUsed: number; totalChatMessages: number }>('/projects/stats').then(r => r.data),
};

