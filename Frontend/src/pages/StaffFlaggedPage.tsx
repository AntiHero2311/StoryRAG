import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';

const PAGE_SIZE = 20;

export interface FlaggedManuscriptRow {
    projectId: string;
    projectTitle: string;
    authorId: string;
    authorName: string;
    latestReportStatus?: string | null;
    latestScore?: number | null;
    latestReportId?: string | null;
    flagReason: string;
    lastUpdatedAt: string;
}

interface PagedFlaggedResponse {
    items: FlaggedManuscriptRow[];
    totalCount: number;
    page: number;
    pageSize: number;
}

type PagedFlaggedResponseCompat = Partial<PagedFlaggedResponse> & {
    Items?: FlaggedManuscriptRow[];
    TotalCount?: number;
    Page?: number;
    PageSize?: number;
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function StaffFlaggedPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<FlaggedManuscriptRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get<PagedFlaggedResponseCompat>('/staff/manuscripts/flagged', {
                params: { page, pageSize: PAGE_SIZE },
            });
            const items = data.items ?? data.Items ?? [];
            const total = data.totalCount ?? data.TotalCount ?? 0;
            setRows(items);
            setTotalCount(total);
        } catch {
            setError('Không thể tải danh sách bản thảo bị cờ.');
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

    return (
        <MainLayout pageTitle="Bản thảo bị cờ">
            {() => (
                <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
                    <div className="flex items-start gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'var(--input-bg)' }}
                        >
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Bản thảo bị cờ tự động</h1>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Flag được suy ra từ report AI mới nhất (anti-state, sexual, plagiarism, incomplete, inconsistency, score thấp, hoặc chưa có/không hoàn tất phân tích).
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                            {error}
                        </div>
                    )}

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-secondary)]">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang tải…
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="py-16 text-center text-[var(--text-secondary)] text-sm">
                                Chưa có bản thảo nào bị cờ theo tiêu chí hiện tại.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr
                                            className="border-b border-[var(--border-color)] text-[var(--text-secondary)] uppercase text-[10px] tracking-wider"
                                            style={{ background: 'var(--input-bg)' }}
                                        >
                                            <th className="px-4 py-3 font-semibold">Tác giả</th>
                                            <th className="px-4 py-3 font-semibold">Tác phẩm</th>
                                            <th className="px-4 py-3 font-semibold">Lý do</th>
                                            <th className="px-4 py-3 font-semibold">Trạng thái / điểm</th>
                                            <th className="px-4 py-3 font-semibold">Cập nhật</th>
                                            <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr
                                                key={`${r.projectId}-${r.lastUpdatedAt}-${r.flagReason}`}
                                                className="border-b border-[var(--border-color)]/60 hover:bg-[var(--bg-hover)]/40"
                                            >
                                                <td className="px-4 py-3 text-[var(--text-primary)] font-medium whitespace-nowrap max-w-[180px] truncate">
                                                    {r.authorName}
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-primary)] max-w-[260px] truncate">
                                                    {r.projectTitle}
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                                                    {r.flagReason}
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap text-xs">
                                                    <span className="font-mono">{r.latestReportStatus ?? '—'}</span>
                                                    <span className="mx-2 opacity-40">·</span>
                                                    <span className="font-semibold">{r.latestScore != null ? Math.round(r.latestScore) : '—'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap text-xs">
                                                    {formatDate(r.lastUpdatedAt)}
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <Link
                                                        to={`/workspace/${r.projectId}`}
                                                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs"
                                                    >
                                                        Mở
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                    {r.latestReportId && (
                                                        <Link
                                                            to={`/staff/analysis-reports/${r.latestReportId}`}
                                                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium text-xs ml-2"
                                                        >
                                                            Xem report
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {!loading && totalCount > PAGE_SIZE && (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <p className="text-xs text-[var(--text-secondary)]">
                                Trang {page} / {totalPages} — {totalCount} bản ghi
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border border-[var(--border-color)] disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--bg-hover)]"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Trước
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border border-[var(--border-color)] disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--bg-hover)]"
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
