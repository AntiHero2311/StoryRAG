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

  // Client-side search filtering as helper
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.project_title.toLowerCase().includes(term) ||
        r.author_name.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

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
                      return (
                        <tr
                          key={r.report_id}
                          className="border-b border-[var(--border-color)]/60 hover:bg-[var(--bg-hover)]/40 transition-colors"
                        >
                          <td className="px-5 py-4 text-[var(--text-primary)] font-semibold max-w-[280px] truncate">
                            {r.project_title}
                          </td>
                          <td className="px-5 py-4 text-[var(--text-primary)] font-medium whitespace-nowrap max-w-[180px] truncate">
                            {r.author_name}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="font-bold text-base text-indigo-400 font-mono">
                              {r.total_score != null ? Math.round(r.total_score) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[var(--text-secondary)] whitespace-nowrap text-xs">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            <Link
                              to={`/staff/analysis-reports/${r.report_id}`}
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold text-xs border border-indigo-500/20 bg-indigo-500/5 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
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
