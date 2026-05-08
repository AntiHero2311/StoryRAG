import api from './api';

export type StaffFeedbackResponse = {
  id: string;
  projectId: string;
  chapterId?: string | null;
  authorId: string;
  authorName: string;
  staffId: string;
  staffName: string;
  content: string;
  status: string;
  staffNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  readAt?: string | null;
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
};

