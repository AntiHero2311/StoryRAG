import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Activity,
  XCircle,
  Clock,
  RotateCcw,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Modal from '../components/ui/Modal';
import { getUserInfo } from '../utils/jwtHelper';
import {
  analysisJobService,
  type StaffAnalysisJobItem,
} from '../services/analysisJobService';
import { isReadableProjectTitle, resolveStoryTitle } from '../utils/staffDisplayHelpers';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isJobStale(job: StaffAnalysisJobItem) {
  return (job.status || '').toLowerCase() === 'processing'
    && !!job.last_heartbeat
    && Date.now() - new Date(job.last_heartbeat).getTime() > 15 * 60 * 1000;
}

function getJobMeta(job: StaffAnalysisJobItem) {
  const isFailed = (job.status || '').toLowerCase() === 'failed';
  const isStale = isJobStale(job);
  return {
    isFailed,
    isStale,
    canRerun: isFailed || isStale,
    showPartialReport: !!job.report_id && (isFailed || isStale),
  };
}

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'failed') return { label: 'Lỗi', icon: XCircle, bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' };
  if (s === 'processing') return { label: 'Đang chạy', icon: Activity, bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' };
  if (s === 'queued') return { label: 'Đang chờ', icon: Clock, bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' };
  if (s === 'completed') return { label: 'Hoàn thành', icon: CheckCircle2, bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (s === 'cancelled') return { label: 'Đã hủy', icon: XCircle, bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' };
  return { label: status, icon: Activity, bg: 'bg-zinc-500/10', text: 'text-zinc-300', border: 'border-zinc-500/20' };
}

export default function StaffAnalysisJobsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StaffAnalysisJobItem[]>([]);
  const [titleByProject, setTitleByProject] = useState<Map<string, string>>(new Map());
  const [titleByReport, setTitleByReport] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rerunLoadingId, setRerunLoadingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<StaffAnalysisJobItem | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const resolveTitle = useCallback((job: StaffAnalysisJobItem) => (
    resolveStoryTitle(
      {
        projectTitle: job.project_title,
        projectId: job.project_id,
        authorName: job.requested_by_name,
        reportId: job.report_id,
      },
      titleByProject,
      titleByReport,
    )
  ), [titleByProject, titleByReport]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jobs, reports] = await Promise.all([
        analysisJobService.getAnalysisJobs(statusFilter),
        analysisJobService.getPendingReports(1, 200, 'all').catch(() => ({ items: [] })),
      ]);
      setItems(jobs);

      const nextTitleByProject = new Map<string, string>();
      const nextTitleByReport = new Map<string, string>();

      for (const report of reports.items ?? []) {
        if (isReadableProjectTitle(report.project_title) && !nextTitleByProject.has(report.project_id)) {
          nextTitleByProject.set(report.project_id, report.project_title.trim());
        }
        if (isReadableProjectTitle(report.project_title)) {
          nextTitleByReport.set(report.report_id, report.project_title.trim());
        }
      }

      setTitleByProject(nextTitleByProject);
      setTitleByReport(nextTitleByReport);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message ??
        'Không thể tải danh sách analysis jobs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
    void load();
  }, [load, navigate]);

  const stats = useMemo(() => {
    const failed = items.filter(x => (x.status || '').toLowerCase() === 'failed').length;
    const processing = items.filter(x => (x.status || '').toLowerCase() === 'processing').length;
    const completed = items.filter(x => (x.status || '').toLowerCase() === 'completed').length;
    return { total: items.length, failed, processing, completed };
  }, [items]);

  const handleRerun = async (jobId: string) => {
    if (!confirm('Chạy lại job này? Job cũ sẽ được giữ nguyên.')) return;
    setError('');
    setRerunLoadingId(jobId);
    try {
      await analysisJobService.rerun(jobId);
      setDetailItem(null);
      await load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message ??
        'Rerun thất bại.';
      setError(message);
    } finally {
      setRerunLoadingId(null);
    }
  };

  return (
    <MainLayout pageTitle="Phân tích AI">
      {() => (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-5">
          <div className="rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-bright)' }}>
                  Phân tích AI
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
                    ({stats.total} · Failed {stats.failed} · Processing {stats.processing} · Completed {stats.completed})
                  </span>
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Theo dõi tiến trình từng lượt phân tích. Xem kết quả nội dung tại trang Kết quả phân tích.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="relative flex-1 sm:flex-none min-w-[200px]">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="appearance-none pl-3 pr-9 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="failed,stale">Lỗi & Treo (Failed + Stale)</option>
                  <option value="failed">Lỗi (Failed)</option>
                  <option value="stale">Treo (Stale)</option>
                  <option value="processing">Đang chạy (Processing)</option>
                  <option value="queued">Đang chờ (Queued)</option>
                  <option value="completed">Thành công (Completed)</option>
                  <option value="cancelled">Hủy (Cancelled)</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
              </div>

              <button
                onClick={() => void load()}
                className="h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}



          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 rounded-3xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Không có job nào</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Danh sách rỗng theo filter hiện tại.</p>
            </div>
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {['Bộ truyện', 'Người yêu cầu', 'Trạng thái', 'Lỗi', 'Bắt đầu', 'Cập nhật'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {items.map(j => {
                    const sc = statusBadge(j.status);
                    const Icon = sc.icon;
                    const { isStale } = getJobMeta(j);
                    const storyTitle = resolveTitle(j);

                    return (
                      <tr
                        key={j.id}
                        onClick={() => setDetailItem(j)}
                        className="hover:bg-[var(--text-primary)]/3 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <p className="text-[var(--text-primary)] text-sm font-semibold truncate" title={storyTitle}>
                            {storyTitle}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[var(--text-primary)] text-sm truncate" title={j.requested_by_name}>{j.requested_by_name || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sc.label}{isStale ? ' · Treo' : ''}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {j.error_message ? (
                            <p className="text-xs text-rose-300 truncate" title={j.error_message}>{j.error_message}</p>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                          {fmtDate(j.started_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                          {fmtDate(j.last_heartbeat)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Modal
            isOpen={!!detailItem}
            onClose={() => setDetailItem(null)}
            title="Chi tiết job phân tích"
            size="lg"
            footer={detailItem && (() => {
              const meta = getJobMeta(detailItem);
              return (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailItem(null)}
                    className="h-10 px-4 rounded-xl text-sm border border-[var(--border-color)] text-[var(--text-secondary)]"
                  >
                    Đóng
                  </button>
                  {meta.showPartialReport && (
                    <Link
                      to={`/staff/analysis-reports/${detailItem.report_id}`}
                      onClick={() => setDetailItem(null)}
                      className="h-10 px-4 rounded-xl text-sm font-semibold border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-2"
                    >
                      <BarChart2 className="w-4 h-4" /> Báo cáo dở
                    </Link>
                  )}
                  {meta.canRerun && (
                    <button
                      type="button"
                      onClick={() => void handleRerun(detailItem.id)}
                      disabled={rerunLoadingId === detailItem.id}
                      className="h-10 px-5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    >
                      {rerunLoadingId === detailItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Rerun
                    </button>
                  )}
                </div>
              );
            })()}
          >
            {detailItem && (() => {
              const sc = statusBadge(detailItem.status);
              const Icon = sc.icon;
              const { isStale } = getJobMeta(detailItem);
              const storyTitle = resolveTitle(detailItem);

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border"
                    style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.18)' }}>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {sc.label}{isStale ? ' · Treo' : ''}
                    </span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{storyTitle}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl px-4 py-3 border border-[var(--border-color)]" style={{ background: 'var(--bg-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Người yêu cầu</p>
                      <p className="text-[var(--text-primary)] font-medium break-words">{detailItem.requested_by_name || '—'}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 border border-[var(--border-color)]" style={{ background: 'var(--bg-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Bắt đầu</p>
                      <p className="text-[var(--text-primary)] font-medium tabular-nums">{fmtDate(detailItem.started_at)}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 border border-[var(--border-color)]" style={{ background: 'var(--bg-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Cập nhật lần cuối</p>
                      <p className="text-[var(--text-primary)] font-medium tabular-nums">{fmtDate(detailItem.last_heartbeat)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Chi tiết lỗi</p>
                    {detailItem.error_message ? (
                      <p className="text-sm text-rose-300 leading-relaxed whitespace-pre-wrap break-words rounded-xl px-4 py-3 border border-rose-500/20 bg-rose-500/8 max-h-60 overflow-y-auto select-text">
                        {detailItem.error_message}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)] rounded-xl px-4 py-3 border border-[var(--border-color)]" style={{ background: 'var(--bg-hover)' }}>
                        Không có thông báo lỗi.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </Modal>
        </div>
      )}
    </MainLayout>
  );
}
