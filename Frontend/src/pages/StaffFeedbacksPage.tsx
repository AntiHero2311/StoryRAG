import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, Mail } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { staffService } from '../services/staffService';
import type { StaffFeedbackResponse } from '../services/feedbackService';

const PAGE_SIZE = 20;

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function StaffFeedbacksPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Resolved'>('all');
    const [rows, setRows] = useState<StaffFeedbackResponse[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<StaffFeedbackResponse | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);


    const filtered = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows.filter(r => r.status === statusFilter);
    }, [rows, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const withAuthorReply = rows.filter(r => r.userRespondedAt).length;
    const openCount = rows.filter(r => r.status === 'Open').length;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await staffService.getFeedbacks(page, PAGE_SIZE);
            setRows(data.items ?? []);
            setTotalCount(data.totalCount ?? 0);
        } catch {
            setError('Không thể tải danh sách phản hồi.');
            setRows([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') { navigate('/home'); return; }
        void load();
    }, [load, navigate]);



    const handleResolve = async (item: StaffFeedbackResponse) => {
        setSaving(true);
        try {
            await staffService.updateFeedback(item.id, {
                projectId: item.projectId,
                content: item.content,
                status: 'Resolved',
                staffNote: note.trim() || item.staffNote || undefined,
            });
            setSelected(null);
            setNote('');
            await load();
        } catch {
            setError('Không thể cập nhật phản hồi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <MainLayout pageTitle="Phản hồi tác giả">
            {() => (
                <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--input-bg)' }}>
                            <MessageSquare className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-lg font-bold text-[var(--text-primary)]">Phản hồi tác giả</h1>
                        </div>

                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                            <p className="text-xs text-[var(--text-tertiary)]">Đang mở</p>
                            <p className="text-2xl font-bold text-amber-400">{openCount}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                            <p className="text-xs text-[var(--text-tertiary)]">Tác giả đã phản hồi</p>
                            <p className="text-2xl font-bold text-emerald-400">{withAuthorReply}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 col-span-2 sm:col-span-1">
                            <p className="text-xs text-[var(--text-tertiary)]">Tổng (trang)</p>
                            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCount}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {(['all', 'Open', 'Resolved'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    statusFilter === s
                                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                        : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                                }`}
                            >
                                {s === 'all' ? 'Tất cả' : s}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
                    )}

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-secondary)]">
                                <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="py-16 text-center text-[var(--text-secondary)] text-sm">Chưa có phản hồi nào.</p>
                        ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                                {filtered.map(item => (
                                    <div key={item.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-[var(--text-primary)] text-sm">{item.authorName}</p>
                                                <p className="text-xs text-[var(--text-tertiary)]">Staff: {item.staffName} · {fmtDate(item.createdAt)}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                item.status === 'Open' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                                            }`}>{item.status}</span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">{item.content}</p>
                                        {item.userRespondedAt && (
                                            <div className="mt-2 flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                                                <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-semibold">Tác giả đã phản hồi ({item.userReaction}) · {fmtDate(item.userRespondedAt)}</p>
                                                    {item.userFeedback && <p className="text-[var(--text-secondary)] mt-0.5">{item.userFeedback}</p>}
                                                </div>
                                            </div>
                                        )}
                                        {item.status === 'Open' && (
                                            <button
                                                onClick={() => { setSelected(item); setNote(item.staffNote ?? ''); }}
                                                className="mt-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                                            >
                                                Đánh dấu đã xử lý →
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-[var(--border-color)] disabled:opacity-40">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-[var(--text-secondary)]">{page} / {totalPages}</span>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-[var(--border-color)] disabled:opacity-40">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}



                    {selected && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
                            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4">
                                <h3 className="font-bold text-[var(--text-primary)]">Đánh dấu Resolved</h3>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Ghi chú nội bộ (tuỳ chọn)"
                                    className="w-full h-24 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm resize-none"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-xl border border-[var(--border-color)] text-sm">Hủy</button>
                                    <button
                                        onClick={() => void handleResolve(selected)}
                                        disabled={saving}
                                        className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Xác nhận
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
