import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';

const PAGE_SIZE = 20;

export interface FlaggedProjectRow {
    project_id: string;
    author_email: string;
    flag_reason: string;
    flagged_at: string;
    severity: string;
}

interface PagedFlaggedResponse {
    items: FlaggedProjectRow[];
    totalCount: number;
    page: number;
    pageSize: number;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function severityStyle(sev: string) {
    if (sev === 'Critical') return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
}

export default function StaffFlaggedPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<FlaggedProjectRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get<PagedFlaggedResponse>('/staff/flagged-projects', {
                params: { page, page_size: PAGE_SIZE },
            });
            setRows(data.items ?? []);
            setTotalCount(data.totalCount ?? 0);
        } catch {
            setError('Không thể tải danh sách dự án bị cờ.');
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
        <MainLayout pageTitle="Dự án bị cờ (Abuse)">
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
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Dự án bị cờ tự động</h1>
                            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                                Các bản ghi từ hệ thống phát hiện lạm dụng (tần suất gọi AI). Chỉ Staff/Admin mới thấy trang
                                này.
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
                                Chưa có dự án nào bị cờ trong hệ thống.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr
                                            className="border-b border-[var(--border-color)] text-[var(--text-secondary)] uppercase text-[10px] tracking-wider"
                                            style={{ background: 'var(--input-bg)' }}
                                        >
                                            <th className="px-4 py-3 font-semibold">Email tác giả</th>
                                            <th className="px-4 py-3 font-semibold">Lý do</th>
                                            <th className="px-4 py-3 font-semibold">Mức độ</th>
                                            <th className="px-4 py-3 font-semibold">Thời điểm</th>
                                            <th className="px-4 py-3 font-semibold text-right">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => (
                                            <tr
                                                key={`${r.project_id}-${r.flagged_at}-${r.flag_reason}`}
                                                className="border-b border-[var(--border-color)]/60 hover:bg-[var(--bg-hover)]/40"
                                            >
                                                <td className="px-4 py-3 text-[var(--text-primary)] font-medium whitespace-nowrap max-w-[200px] truncate">
                                                    {r.author_email}
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                                                    {r.flag_reason}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${severityStyle(r.severity)}`}
                                                    >
                                                        {r.severity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                                                    {formatDate(r.flagged_at)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link
                                                        to={`/workspace/${r.project_id}`}
                                                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs"
                                                    >
                                                        Mở dự án
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
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
