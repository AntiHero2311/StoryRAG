import { api } from './api';

export type WritingTip = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  published: boolean;
  updatedAt: string;
};

export type WritingTipUpsertRequest = {
  title: string;
  content: string;
  tags: string[];
  published: boolean;
};

export const writingTipService = {
  // Public read (published only)
  getPublic: (tag?: string) =>
    api.get<WritingTip[]>('/writing-tips', { params: tag ? { tag } : {} }).then(r => r.data),

  // Staff/Admin
  getAll: (params?: { tag?: string; published?: boolean }) =>
    api.get<WritingTip[]>('/writing-tips/admin', { params: params ?? {} }).then(r => r.data),

  getOne: (id: string) =>
    api.get<WritingTip>(`/writing-tips/admin/${id}`).then(r => r.data),

  create: (data: WritingTipUpsertRequest) =>
    api.post<WritingTip>('/writing-tips/admin', data).then(r => r.data),

  update: (id: string, data: WritingTipUpsertRequest) =>
    api.put<WritingTip>(`/writing-tips/admin/${id}`, data).then(r => r.data),

  togglePublish: (id: string, published: boolean) =>
    api.patch<WritingTip>(`/writing-tips/admin/${id}/publish`, published).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/writing-tips/admin/${id}`),
};

