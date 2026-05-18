import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Send } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import {
  analysisJobService,
  type StaffReportDetail,
  type StaffReportStoryResponse,
} from '../services/analysisJobService';

type EditableCriterion = {
  key: string;
  groupName: string;
  criterionName: string;
  score: number;
  maxScore: number;
  feedback: string;
  evidence: string;
  errors: string[];
  suggestions: string[];
};

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function parseCriteria(detail: StaffReportDetail): EditableCriterion[] {
  const source = detail.staffEditedCriteriaJson ?? detail.criteriaJson;
  if (!source) return [];

  let raw: any = null;
  try {
    raw = JSON.parse(source);
  } catch {
    return [];
  }

  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.criteria) ? raw.criteria : []);
  return arr.map((item: any) => ({
    key: String(item?.key ?? item?.Key ?? ''),
    groupName: String(item?.groupName ?? item?.GroupName ?? ''),
    criterionName: String(item?.criterionName ?? item?.CriterionName ?? ''),
    score: Number(item?.score ?? item?.Score ?? 0),
    maxScore: Number(item?.maxScore ?? item?.MaxScore ?? 0),
    feedback: String(item?.feedback ?? item?.Feedback ?? ''),
    evidence: String(item?.evidence ?? item?.Evidence ?? ''),
    errors: Array.isArray(item?.errors) ? item.errors.map((x: any) => String(x)) : [],
    suggestions: Array.isArray(item?.suggestions) ? item.suggestions.map((x: any) => String(x)) : [],
  }))
    .filter(c => c.key);
}

export default function StaffReportReviewPage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<StaffReportDetail | null>(null);
  const [story, setStory] = useState<StaffReportStoryResponse | null>(null);
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const load = async (targetReportId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [reportDetail, storyData] = await Promise.all([
        analysisJobService.getReportDetail(targetReportId),
        analysisJobService.getReportStory(targetReportId),
      ]);
      setDetail(reportDetail);
      setStory(storyData);
      setCriteria(parseCriteria(reportDetail));
    } catch (err: any) {
      const message = err?.response?.data?.message
        ?? err?.response?.data?.Message
        ?? 'Không thể tải dữ liệu review report.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const info = getUserInfo(token);
    if (info.role !== 'Staff' && info.role !== 'Admin') {
      navigate('/home');
      return;
    }
    if (!reportId) {
      setError('Thiếu reportId.');
      setLoading(false);
      return;
    }
    void load(reportId);
  }, [navigate, reportId]);

  const updateCriterion = (index: number, patch: Partial<EditableCriterion>) => {
    setCriteria(prev => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const submitEdit = async (releaseToUser: boolean) => {
    if (!reportId || !detail || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await analysisJobService.editReport(reportId, {
        editedCriteria: criteria.map(c => ({
          key: c.key,
          feedback: c.feedback,
          evidence: c.evidence,
          errors: c.errors,
          suggestions: c.suggestions,
        })),
        releaseToUser,
        expectedUpdatedAt: detail.updatedAt ?? detail.createdAt,
        feedbackMessage: feedbackMessage.trim() || undefined,
      });

      setDetail(updated);
      setCriteria(parseCriteria(updated));
      setSuccess(releaseToUser
        ? 'Đã phát hành report cho tác giả.'
        : 'Đã lưu bản chỉnh sửa cho staff. Report chưa phát hành.');
    } catch (err: any) {
      const message = err?.response?.data?.message
        ?? err?.response?.data?.Message
        ?? 'Lưu chỉnh sửa thất bại.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const chapterCount = story?.chapters?.length ?? 0;
  const scoreLabel = useMemo(() => {
    if (!detail) return '';
    return `${detail.totalScore.toFixed(1)} điểm • ${detail.classification}`;
  }, [detail]);

  return (
    <MainLayout pageTitle="Staff Review Report">
      {() => (
        <div className="p-6 max-w-[1400px] mx-auto w-full space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/staff/analysis-jobs')}
              className="h-10 px-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </button>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Review report phân tích</h1>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            </div>
          ) : !detail ? null : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 space-y-4">
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{detail.projectTitle}</p>
                  <p className="text-sm mt-1 text-[var(--text-secondary)]">{scoreLabel}</p>
                  <p className="text-xs mt-1 text-[var(--text-secondary)]">
                    Trạng thái review: <span className="font-semibold text-[var(--text-primary)]">{detail.reviewStatus ?? 'PendingStaffReview'}</span>
                  </p>
                  <div className="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-hover)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1">Nhận xét tổng quan</p>
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{detail.overallFeedback || '—'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Chỉnh sửa nội dung criteria ({criteria.length})</p>
                  {criteria.map((c, idx) => (
                    <div key={c.key} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-hover)]/40 p-3 space-y-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {c.key} • {c.groupName} • {c.criterionName}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">Điểm AI: {c.score}/{c.maxScore}</p>

                      <label className="block">
                        <span className="text-xs text-[var(--text-secondary)]">Feedback</span>
                        <textarea
                          value={c.feedback}
                          onChange={e => updateCriterion(idx, { feedback: e.target.value })}
                          rows={3}
                          className="mt-1 w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)]"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-[var(--text-secondary)]">Evidence</span>
                        <textarea
                          value={c.evidence}
                          onChange={e => updateCriterion(idx, { evidence: e.target.value })}
                          rows={3}
                          className="mt-1 w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)]"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-[var(--text-secondary)]">Errors (mỗi dòng 1 ý)</span>
                        <textarea
                          value={c.errors.join('\n')}
                          onChange={e => updateCriterion(idx, { errors: splitLines(e.target.value) })}
                          rows={3}
                          className="mt-1 w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)]"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-[var(--text-secondary)]">Suggestions (mỗi dòng 1 ý)</span>
                        <textarea
                          value={c.suggestions.join('\n')}
                          onChange={e => updateCriterion(idx, { suggestions: splitLines(e.target.value) })}
                          rows={3}
                          className="mt-1 w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)]"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Feedback gửi tác giả (tuỳ chọn)</p>
                  <textarea
                    value={feedbackMessage}
                    onChange={e => setFeedbackMessage(e.target.value)}
                    rows={5}
                    placeholder="Nội dung nhắn cho tác giả sau khi review..."
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)]"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => void submitEdit(false)}
                      disabled={saving}
                      className="h-10 px-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Lưu bản chỉnh sửa
                    </button>
                    <button
                      onClick={() => void submitEdit(true)}
                      disabled={saving}
                      className="h-10 px-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Gửi tác giả
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Nội dung truyện ({chapterCount} chương)</p>
                  <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {(story?.chapters ?? []).map(ch => (
                      <details key={ch.chapter_id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-hover)]/50 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
                          Chương {ch.chapter_number}: {ch.title}
                        </summary>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">~{ch.word_count} từ</p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-primary)] leading-relaxed">
                          {ch.content || '(Chưa có nội dung)'}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
