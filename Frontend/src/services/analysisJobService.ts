import { api } from './api';
import type { ContentAnalysisResult } from './reportService';

export type StaffAnalysisJobItem = {
  id: string;
  project_id: string;
  project_title: string;
  requested_by: string;
  requested_by_name: string;
  status: string;
  error_message?: string | null;
  report_id?: string | null;
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
  warnings?: string[];
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
  contentAnalysis?: ContentAnalysisResult;
  authorId?: string;
  authorName?: string;
  authorStrikeCount?: number;
  authorIsBanned?: boolean;
  authorIsBanRequested?: boolean;
  authorBanRequestReason?: string | null;
  authorWarningMessage?: string | null;
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

type RawRecord = Record<string, unknown>;

function pickStr(raw: RawRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function pickNullableStr(raw: RawRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (value === null) return null;
  }
  return null;
}

function normalizeAnalysisJob(raw: RawRecord): StaffAnalysisJobItem {
  return {
    id: pickStr(raw, 'id', 'Id'),
    project_id: pickStr(raw, 'project_id', 'projectId'),
    project_title: pickStr(raw, 'project_title', 'projectTitle'),
    requested_by: pickStr(raw, 'requested_by', 'requestedBy'),
    requested_by_name: pickStr(raw, 'requested_by_name', 'requestedByName'),
    status: pickStr(raw, 'status', 'Status') || 'Unknown',
    error_message: pickNullableStr(raw, 'error_message', 'errorMessage'),
    report_id: pickNullableStr(raw, 'report_id', 'reportId'),
    started_at: pickNullableStr(raw, 'started_at', 'startedAt'),
    last_heartbeat: pickNullableStr(raw, 'last_heartbeat', 'lastHeartbeat'),
  };
}

function normalizePendingReport(raw: RawRecord): StaffPendingReportItem {
  return {
    report_id: pickStr(raw, 'report_id', 'reportId'),
    project_id: pickStr(raw, 'project_id', 'projectId'),
    project_title: pickStr(raw, 'project_title', 'projectTitle'),
    author_id: pickStr(raw, 'author_id', 'authorId'),
    author_name: pickStr(raw, 'author_name', 'authorName'),
    total_score: Number(raw.total_score ?? raw.totalScore ?? 0),
    review_status: pickStr(raw, 'review_status', 'reviewStatus'),
    created_at: pickStr(raw, 'created_at', 'createdAt'),
    updated_at: pickNullableStr(raw, 'updated_at', 'updatedAt'),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : undefined,
  };
}

export const analysisJobService = {
  getAnalysisJobs: (status?: string) =>
    api
      .get<RawRecord[]>('/staff/analysis-jobs', { params: status ? { status } : {} })
      .then(r => (Array.isArray(r.data) ? r.data : []).map(normalizeAnalysisJob)),

  rerun: (jobId: string) =>
    api.post<RawRecord>(`/staff/analysis-jobs/${jobId}/rerun`).then(r => normalizeAnalysisJob(r.data)),

  getPendingReports: (page = 1, pageSize = 20, status?: string) =>
    api
      .get<StaffPagedResponse<RawRecord>>('/staff/analyses/pending', { params: { page, pageSize, status } })
      .then(r => ({
        ...r.data,
        items: (r.data.items ?? []).map(normalizePendingReport),
      })),

  getReportDetail: (reportId: string) =>
    api.get<StaffReportDetail>(`/staff/analyses/${reportId}`).then(r => r.data),

  getReportStory: (reportId: string) =>
    api.get<StaffReportStoryResponse>(`/staff/analyses/${reportId}/story`).then(r => r.data),

  editReport: (reportId: string, payload: StaffEditReportRequest) =>
    api.patch<StaffReportDetail>(`/staff/analyses/${reportId}/edit`, payload).then(r => r.data),
};
