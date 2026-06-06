import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Eye,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { analysisJobService, type StaffPendingReportItem } from '../services/analysisJobService';
import { getProjectDisplayLabel } from '../utils/staffDisplayHelpers';

const PAGE_SIZE = 15;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Severity mapping ────────────────────────────────────────────────────────
// CRITICAL: vi phạm nghiêm trọng, cần xem xét ngay
const CRITICAL_CODES = new Set(['ANTI_STATE', 'SEXUAL_CONTENT', 'PLAGIARISM_RISK']);

function getWarningPriority(code: string): number {
  const upper = code.toUpperCase();
  const MAP: Record<string, number> = {
    ANTI_STATE: 100,
    SEXUAL_CONTENT: 90,
    PLAGIARISM_RISK: 80,
    INCONSISTENCY: 50,
    REPETITION: 40,
    SPELLING_FORMATTING: 30,
    INCOMPLETE: 20,
    OTHER: 10,
  };
  return MAP[upper] ?? 0;
}

function getRowMaxPriority(r: StaffPendingReportItem): number {
  if (!r.warnings?.length) return 0;
  return Math.max(...r.warnings.map(c => getWarningPriority(c)));
}

type WarningMeta = {
  code: string;
  severity: 'critical' | 'warning';
  label: string;
  icon: string;
  badgeCls: string;
};

function getWarningMeta(code: string): WarningMeta {
  const upper = code.toUpperCase();
  const isCritical = CRITICAL_CODES.has(upper);

  const MAP: Record<string, { label: string; icon: string; badgeCls: string }> = {
    ANTI_STATE: {
      label: 'Chống phá / Phản động',
      icon: '🚫',
      badgeCls: 'bg-red-500/15 text-red-400 border border-red-500/30',
    },
    SEXUAL_CONTENT: {
      label: 'Nhạy cảm / 18+',
      icon: '⚠️',
      badgeCls: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
    },
    PLAGIARISM_RISK: {
      label: 'Nghi vấn đạo nhái',
      icon: '🚩',
      badgeCls: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
    },
    INCONSISTENCY: {
      label: 'Mâu thuẫn logic',
      icon: '⚡',
      badgeCls: 'bg-yellow-500/12 text-yellow-400 border border-yellow-500/25',
    },
    INCOMPLETE: {
      label: 'Chưa hoàn thành',
      icon: '💤',
      badgeCls: 'bg-sky-500/12 text-sky-400 border border-sky-500/25',
    },
    REPETITION: {
      label: 'Lặp từ / Lặp cảnh',
      icon: '🔄',
      badgeCls: 'bg-violet-500/12 text-violet-400 border border-violet-500/25',
    },
    SPELLING_FORMATTING: {
      label: 'Chính tả & Định dạng',
      icon: '✍️',
      badgeCls: 'bg-zinc-500/12 text-zinc-400 border border-zinc-500/20',
    },
    OTHER: {
      label: 'Cảnh báo khác',
      icon: '💬',
      badgeCls: 'bg-zinc-500/12 text-zinc-400 border border-zinc-500/20',
    },
  };

  const meta = MAP[upper] ?? {
    label: upper,
    icon: '•',
    badgeCls: 'bg-zinc-500/12 text-zinc-400 border border-zinc-500/20',
  };

  return { code: upper, severity: isCritical ? 'critical' : 'warning', ...meta };
}

/** Trả về mức độ nguy hiểm cao nhất của một row (để hiển thị badge và indicator) */
function rowSeverityRank(r: StaffPendingReportItem): number {
  if (!r.warnings?.length) return 0;
  if (r.warnings.some((c) => CRITICAL_CODES.has(c.toUpperCase()))) return 2;
  return 1;
}

export default function StaffReportsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<StaffPendingReportItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await analysisJobService.getPendingReports(page, PAGE_SIZE, 'all');
      setRows(data.items ?? []);
      setTotalCount(data.totalCount ?? 0);
    } catch {
      setError('Không thể tải danh sách kết quả phân tích AI.');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

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

  // Client-side search + sort: critical luôn lên đầu
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          (r) =>
            r.project_title.toLowerCase().includes(term) ||
            r.author_name.toLowerCase().includes(term)
        )
      : rows;

    // Sort: highest priority warnings first, if equal then sort by date descending
    return [...filtered].sort((a, b) => {
      const pA = getRowMaxPriority(a);
      const pB = getRowMaxPriority(b);
      if (pA !== pB) return pB - pA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, searchTerm]);

  const criticalCount = useMemo(
    () => filteredRows.filter((r) => rowSeverityRank(r) === 2).length,
    [filteredRows]
  );

  return (
    <MainLayout pageTitle="Danh sách phân tích AI">
      {() => (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--input-bg)' }}
              >
                <BarChart2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Danh sách phân tích AI</h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Xem kết quả các báo cáo phân tích tác phẩm do AI đánh giá sau khi tác giả chạy phân tích.
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors bg-[var(--bg-surface)]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>

          {/* Critical alert banner */}
          {!loading && criticalCount > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{
                background: 'rgba(239,68,68,0.07)',
                borderColor: 'rgba(239,68,68,0.25)',
              }}
            >
              <span className="text-base shrink-0">🚨</span>
              <p className="text-xs font-bold text-red-400">
                {criticalCount} tác phẩm có <span className="uppercase">vi phạm nghiêm trọng</span> — cần xem xét ưu tiên!
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-secondary)]">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Tìm tác phẩm hoặc tác giả..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-secondary)]">
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang tải…
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-20 text-center text-[var(--text-secondary)] text-sm space-y-2">
                <p className="font-medium">Chưa có bản thảo nào được phân tích</p>
                <p className="text-xs text-[var(--text-tertiary)]">Danh sách phân tích rỗng theo bộ lọc hiện tại.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr
                      className="border-b border-[var(--border-color)] text-[var(--text-secondary)] uppercase text-[10px] tracking-wider"
                      style={{ background: 'var(--input-bg)' }}
                    >
                      <th className="px-5 py-4 font-semibold">Tác phẩm</th>
                      <th className="px-5 py-4 font-semibold">Tác giả</th>
                      <th className="px-5 py-4 font-semibold text-center">Điểm số AI</th>
                      <th className="px-5 py-4 font-semibold">Thời gian</th>
                      <th className="px-5 py-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const severityRank = rowSeverityRank(r);
                      const isCriticalRow = severityRank === 2;
                      const isWarningRow = severityRank === 1;

                      // Sort warnings: highest priority warnings first within each row
                      const sortedWarnings = [...(r.warnings ?? [])].sort((a, b) => {
                        return getWarningPriority(b) - getWarningPriority(a);
                      });

                      return (
                        <tr
                          key={r.report_id}
                          className="border-b border-[var(--border-color)]/60 transition-colors"
                          style={{
                            background: isCriticalRow
                              ? 'rgba(239,68,68,0.04)'
                              : isWarningRow
                              ? 'rgba(245,158,11,0.03)'
                              : undefined,
                          }}
                        >
                          <td className="px-5 py-4 max-w-[280px]">
                            <div className="flex items-center gap-2 mb-1">
                              {/* Priority indicator dot */}
                              {isCriticalRow && (
                                <span
                                  className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse"
                                  title="Vi phạm nghiêm trọng"
                                />
                              )}
                              {isWarningRow && !isCriticalRow && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                                  title="Có cảnh báo"
                                />
                              )}
                              <span
                                className="truncate font-semibold"
                                style={{ color: isCriticalRow ? 'rgba(252,165,165,0.95)' : 'var(--text-primary)' }}
                              >
                                {getProjectDisplayLabel(r.project_title, { reportId: r.report_id, projectId: r.project_id, authorName: r.author_name })}
                              </span>
                            </div>

                            {sortedWarnings.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {sortedWarnings.map((code) => {
                                  const meta = getWarningMeta(code);
                                  return (
                                    <span
                                      key={code}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${meta.badgeCls}`}
                                    >
                                      <span>{meta.icon}</span>
                                      {meta.label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[var(--text-primary)] font-medium whitespace-nowrap max-w-[180px] truncate">
                            {r.author_name}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className="font-bold text-base font-mono"
                              style={{
                                color: isCriticalRow
                                  ? '#f87171'
                                  : isWarningRow
                                  ? '#fbbf24'
                                  : 'var(--color-indigo-400, #818cf8)',
                              }}
                            >
                              {r.total_score != null ? Math.round(r.total_score) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[var(--text-secondary)] whitespace-nowrap text-xs">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            <Link
                              to={`/staff/analysis-reports/${r.report_id}`}
                              className={`inline-flex items-center gap-1 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors ${
                                isCriticalRow
                                  ? 'text-red-400 hover:text-red-300 border border-red-500/25 bg-red-500/8 hover:bg-red-500/15'
                                  : 'text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10'
                              }`}
                            >
                              Xem chi tiết
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!loading && totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Trang {page} / {totalPages} — Tổng số {totalCount} kết quả
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border-color)] disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--bg-hover)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border-color)] disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--bg-hover)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors"
                >
                  Sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
