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

export const analysisJobService = {
  getFailedOrStale: (status?: string) =>
    api.get<StaffAnalysisJobItem[]>('/staff/analysis-jobs', { params: status ? { status } : {} }).then(r => r.data),

  rerun: (jobId: string) =>
    api.post<StaffAnalysisJobItem>(`/staff/analysis-jobs/${jobId}/rerun`).then(r => r.data),
};

