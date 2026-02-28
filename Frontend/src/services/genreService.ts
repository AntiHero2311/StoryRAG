import { api } from './api';
import type { GenreResponse } from './projectService';

export interface CreateGenreRequest {
    name: string;
    slug: string;
    color?: string;
    description?: string;
}

export interface UpdateGenreRequest {
    name: string;
    slug: string;
    color?: string;
    description?: string;
}

export const genreService = {
    getGenres: () =>
        api.get<GenreResponse[]>('/genre').then(r => r.data),

    createGenre: (data: CreateGenreRequest) =>
        api.post<GenreResponse>('/genre', data).then(r => r.data),

    updateGenre: (id: number, data: UpdateGenreRequest) =>
        api.put<GenreResponse>(`/genre/${id}`, data).then(r => r.data),

    deleteGenre: (id: number) =>
        api.delete(`/genre/${id}`).then(r => r.data),
};
