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

export type StaffReportDetail = {
  id: string;
  projectId: string;
  projectTitle: string;
  status: string;
  reviewStatus: string | null;
  totalScore: number;
  classification: string;
  overallFeedback: string;
  projectVersion: string;
  criteriaJson: string;
  staffEditedCriteriaJson: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type StaffStoryChapterItem = {
  chapter_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  updated_at: string | null;
};

export type StaffReportStoryResponse = {
  report_id: string;
  project_id: string;
  project_title: string;
  chapters: StaffStoryChapterItem[];
};

export type StaffCriterionEditItem = {
  key: string;
  feedback?: string | null;
  evidence?: string | null;
  errors?: string[] | null;
  suggestions?: string[] | null;
};

export type StaffEditReportRequest = {
  editedCriteria: StaffCriterionEditItem[];
  releaseToUser?: boolean;
  expectedUpdatedAt?: string | null;
  feedbackMessage?: string | null;
};

export const analysisJobService = {
  getFailedOrStale: (status?: string) =>
    api.get<StaffAnalysisJobItem[]>('/staff/analysis-jobs', { params: status ? { status } : {} }).then(r => r.data),

  rerun: (jobId: string) =>
    api.post<StaffAnalysisJobItem>(`/staff/analysis-jobs/${jobId}/rerun`).then(r => r.data),

  getPendingReports: (page = 1, pageSize = 20, status?: string) =>
    api
      .get<StaffPagedResponse<StaffPendingReportItem>>('/staff/analyses/pending', { params: { page, pageSize, status } })
      .then(r => r.data),

  getReportDetail: (reportId: string) =>
    api.get<StaffReportDetail>(`/staff/analyses/${reportId}`).then(r => r.data),

  getReportStory: (reportId: string) =>
    api.get<StaffReportStoryResponse>(`/staff/analyses/${reportId}/story`).then(r => r.data),

  editReport: (reportId: string, payload: StaffEditReportRequest) =>
    api.patch<StaffReportDetail>(`/staff/analyses/${reportId}/edit`, payload).then(r => r.data),
};
