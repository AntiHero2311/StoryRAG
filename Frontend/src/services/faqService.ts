import { api } from './api';

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  published: boolean;
  updatedAt: string;
};

export type FaqUpsertRequest = {
  question: string;
  answer: string;
  category: string;
  order: number;
  published: boolean;
};

export const faqService = {
  // Public read (published only)
  getPublic: (category?: string) =>
    api.get<Faq[]>('/faqs', { params: category ? { category } : {} }).then(r => r.data),

  // Staff/Admin
  getAll: (params?: { category?: string; published?: boolean }) =>
    api.get<Faq[]>('/faqs/admin', { params: params ?? {} }).then(r => r.data),

  getOne: (id: string) =>
    api.get<Faq>(`/faqs/admin/${id}`).then(r => r.data),

  create: (data: FaqUpsertRequest) =>
    api.post<Faq>('/faqs/admin', data).then(r => r.data),

  update: (id: string, data: FaqUpsertRequest) =>
    api.put<Faq>(`/faqs/admin/${id}`, data).then(r => r.data),

  togglePublish: (id: string, published: boolean) =>
    api.patch<Faq>(`/faqs/admin/${id}/publish`, { published }).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/faqs/admin/${id}`),
};

