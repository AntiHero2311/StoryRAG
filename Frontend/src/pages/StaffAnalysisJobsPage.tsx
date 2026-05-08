import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Activity,
  XCircle,
  Clock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { analysisJobService, type StaffAnalysisJobItem } from '../services/analysisJobService';

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

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'failed') return { label: 'Failed', icon: XCircle, bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' };
  if (s === 'processing') return { label: 'Processing', icon: Activity, bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' };
  if (s === 'queued') return { label: 'Queued', icon: Clock, bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' };
  return { label: status, icon: Activity, bg: 'bg-zinc-500/10', text: 'text-zinc-300', border: 'border-zinc-500/20' };
}

export default function StaffAnalysisJobsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StaffAnalysisJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rerunLoadingId, setRerunLoadingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'failed' | 'stale' | 'failed,stale'>('failed,stale');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await analysisJobService.getFailedOrStale(statusFilter);
      setItems(data);
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
    return { total: items.length, failed, processing };
  }, [items]);

  const handleRerun = async (jobId: string) => {
    if (!confirm('Trigger rerun job này? Job cũ sẽ được giữ nguyên.')) return;
    setError('');
    setRerunLoadingId(jobId);
    try {
      await analysisJobService.rerun(jobId);
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
    <MainLayout pageTitle="Analysis Jobs (Failed/Stale)">
      {() => (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-5">
          <div className="rounded-3xl p-5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-bright)' }}>Staff Analysis Jobs</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Tổng: {stats.total} · Failed: {stats.failed} · Processing: {stats.processing}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="appearance-none pl-3 pr-9 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="failed,stale">Failed + Stale</option>
                  <option value="failed">Failed</option>
                  <option value="stale">Stale</option>
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['ID', 'Project', 'Requested By', 'Status', 'Error', 'Started', 'Last heartbeat', ''].map(h => (
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
                      return (
                        <tr key={j.id} className="hover:bg-[var(--text-primary)]/3 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-[var(--text-primary)] text-xs font-mono">{j.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[var(--text-primary)] text-xs font-mono">{j.project_id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[var(--text-primary)] text-xs font-mono">{j.requested_by}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[420px]">
                            {j.error_message ? (
                              <p className="text-xs text-rose-300 line-clamp-2 whitespace-pre-wrap">{j.error_message}</p>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {fmtDate(j.started_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {fmtDate(j.last_heartbeat)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => navigator.clipboard.writeText(j.id)}
                              className="h-8 px-3 rounded-xl text-xs font-semibold transition-colors"
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                              title="Copy job id"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => void handleRerun(j.id)}
                              disabled={rerunLoadingId === j.id}
                              className="ml-2 h-8 px-3 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
                              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)', color: 'var(--accent-text)' }}
                              title="Rerun"
                            >
                              {rerunLoadingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              Rerun
                            </button>
                            <a
                              className="ml-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold transition-colors"
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                              href={`/workspace/${j.project_id}`}
                              title="Mở workspace"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Workspace
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}

