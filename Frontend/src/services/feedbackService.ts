import api from './api';

export type StaffFeedbackResponse = {
  id: string;
  projectId: string;
  projectTitle?: string;
  projectReportId?: string | null;
  chapterId?: string | null;
  authorId: string;
  authorName: string;
  staffId: string;
  staffName: string;
  content: string;
  status: string;
  staffNote?: string | null;
  userReaction?: 'Like' | 'Dislike' | null;
  userFeedback?: string | null;
  userRespondedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  readAt?: string | null;
  staffGenres?: { id: number; name: string; slug: string; color: string }[];
};

export type FeedbackResponseRequest = {
  reaction: 'Like' | 'Dislike';
  content?: string;
};

export const feedbackService = {
  async getMy(): Promise<StaffFeedbackResponse[]> {
    const res = await api.get<StaffFeedbackResponse[]>('/me/feedback');
    return res.data;
  },

  async markRead(id: string): Promise<StaffFeedbackResponse> {
    const res = await api.post<StaffFeedbackResponse>(`/me/feedback/${id}/mark-read`);
    return res.data;
  },

  async respond(id: string, payload: FeedbackResponseRequest): Promise<StaffFeedbackResponse> {
    const res = await api.post<StaffFeedbackResponse>(`/me/feedback/${id}/respond`, payload);
    return res.data;
  },

  async create(payload: { projectId: string; projectReportId?: string; content: string }): Promise<StaffFeedbackResponse> {
    const res = await api.post<StaffFeedbackResponse>('/me/feedback', payload);
    return res.data;
  },
};
