import { api } from './api';

export type StaffAnalysisJobItem = {
  id: string;
  project_id: string;
  requested_by: string;
  status: string;
  error_message?: string | null;
  started_at?: string | null;
  last_heartbeat?: string | null;
};

export type StaffPendingReportItem = {
  report_id: string;
  project_id: string;
  project_title: string;
  author_id: string;
  author_name: string;
  total_score: number;
  review_status: string;
  created_at: string;
  updated_at?: string | null;
};

export type StaffPagedResponse<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export const analysisJobService = {
  getFailedOrStale: (status?: string) =>
    api.get<StaffAnalysisJobItem[]>('/staff/analysis-jobs', { params: status ? { status } : {} }).then(r => r.data),

  rerun: (jobId: string) =>
    api.post<StaffAnalysisJobItem>(`/staff/analysis-jobs/${jobId}/rerun`).then(r => r.data),

  getPendingReports: (page = 1, pageSize = 20) =>
    api
      .get<StaffPagedResponse<StaffPendingReportItem>>('/staff/analyses/pending', { params: { page, pageSize } })
      .then(r => r.data),
};
