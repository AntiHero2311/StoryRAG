import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2,
    Mail, RefreshCw, Search, Clock, BarChart2,
    ThumbsUp, ThumbsDown, Inbox,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { staffService } from '../services/staffService';
import type { StaffFeedbackResponse } from '../services/feedbackService';
import { AdminPageShell, StatCard } from '../components/admin/AdminShared';
import Modal from '../components/ui/Modal';
import {
    canEditStaffReply,
    isReadableProjectTitle,
    isStaffReplyViewOnly,
} from '../utils/staffDisplayHelpers';

const PAGE_SIZE = 20;

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function fmtRelative(iso: string) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return fmtDate(iso);
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function StaffFeedbacksPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Resolved'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [rows, setRows] = useState<StaffFeedbackResponse[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [openAssigned, setOpenAssigned] = useState(0);
    const [resolvedThisMonth, setResolvedThisMonth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [detailItem, setDetailItem] = useState<StaffFeedbackResponse | null>(null);
    const [replyNote, setReplyNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');

    const filtered = useMemo(() => {
        let list = statusFilter === 'all' ? rows : rows.filter(r => r.status === statusFilter);
        const q = searchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter(r =>
            r.authorName.toLowerCase().includes(q)
            || r.content.toLowerCase().includes(q)
            || (r.projectTitle ?? '').toLowerCase().includes(q)
            || (r.staffNote ?? '').toLowerCase().includes(q));
    }, [rows, statusFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const withAuthorReply = rows.filter(r => r.userRespondedAt).length;
    const openOnPage = rows.filter(r => r.status === 'Open').length;
    const resolvedOnPage = rows.filter(r => r.status === 'Resolved').length;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [data, perf] = await Promise.all([
                staffService.getFeedbacks(page, PAGE_SIZE),
                staffService.getPerformance().catch(() => null),
            ]);
            setRows(data.items ?? []);
            setTotalCount(data.totalCount ?? 0);
            setOpenAssigned(perf?.openFeedbacksAssigned ?? 0);
            setResolvedThisMonth(perf?.feedbacksResolvedThisMonth ?? 0);
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
        setCurrentUserId(info.userId);
        void load();
    }, [load, navigate]);

    const canEditReply = detailItem ? canEditStaffReply(detailItem, currentUserId) : false;
    const isReplyViewOnly = detailItem ? isStaffReplyViewOnly(detailItem, currentUserId) : false;

    const openDetail = (item: StaffFeedbackResponse) => {
        setDetailItem(item);
        setReplyNote(canEditStaffReply(item, currentUserId) ? (item.staffNote ?? '') : '');
    };

    const closeDetail = useCallback(() => {
        setDetailItem(null);
        setReplyNote('');
    }, []);

    const handleResolve = async () => {
        if (!detailItem || !canEditReply) return;
        if (!replyNote.trim()) {
            setError('Vui lòng nhập nội dung phản hồi trước khi hoàn thành.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await staffService.updateFeedback(detailItem.id, {
                projectId: detailItem.projectId,
                content: detailItem.content,
                status: 'Resolved',
                staffNote: replyNote.trim(),
            });
            closeDetail();
            await load();
        } catch {
            setError('Không thể cập nhật phản hồi.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNote = async () => {
        if (!detailItem || !canEditReply) return;
        if (!replyNote.trim()) {
            setError('Vui lòng nhập nội dung phản hồi.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await staffService.updateFeedback(detailItem.id, {
                projectId: detailItem.projectId,
                content: detailItem.content,
                status: detailItem.status,
                staffNote: replyNote.trim(),
            });
            closeDetail();
            await load();
        } catch {
            setError('Không thể lưu phản hồi.');
        } finally {
            setSaving(false);
        }
    };

    const filterTabs = [
        { key: 'all' as const, label: 'Tất cả', count: rows.length },
        { key: 'Open' as const, label: 'Đang chờ', count: openOnPage },
        { key: 'Resolved' as const, label: 'Hoàn thành', count: resolvedOnPage },
    ];

    return (
        <MainLayout pageTitle="Phản hồi tác giả">
            {() => (
                <AdminPageShell
                    title="Phản hồi tác giả"
                    action={
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </button>
                    }
                >
                    <div
                        className="rounded-3xl border p-5 md:p-6"
                        style={{
                            borderColor: 'rgba(99,102,241,0.2)',
                            background: 'linear-gradient(145deg, rgba(99,102,241,0.08), rgba(139,92,246,0.03) 50%, var(--bg-surface) 100%)',
                        }}
                    >
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
                                <MessageSquare className="w-6 h-6 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-[var(--text-primary)] font-black text-lg leading-tight">Hộp thư phản hồi tác giả</h2>
                                <p className="text-[var(--text-secondary)] text-sm mt-1 leading-relaxed">
                                    Theo dõi thắc mắc và góp ý từ tác giả về kết quả phân tích AI — trả lời trực tiếp để hoàn tất yêu cầu.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <StatCard
                            icon={Clock}
                            label="Đang chờ xử lý"
                            value={openAssigned}
                            sub="Được gán cho bạn"
                            color="border-amber-500/25 text-amber-300"
                            iconColor="bg-amber-500/10 text-amber-400"
                        />
                        <StatCard
                            icon={CheckCircle2}
                            label="Hoàn thành tháng này"
                            value={resolvedThisMonth}
                            color="border-emerald-500/25 text-emerald-300"
                            iconColor="bg-emerald-500/10 text-emerald-400"
                        />
                        <StatCard
                            icon={Mail}
                            label="Tác giả đã phản hồi"
                            value={withAuthorReply}
                            sub="Trên trang hiện tại"
                            color="border-sky-500/25 text-sky-300"
                            iconColor="bg-sky-500/10 text-sky-400"
                        />
                        <StatCard
                            icon={Inbox}
                            label="Tổng phản hồi"
                            value={totalCount}
                            sub={`Trang ${page}/${totalPages}`}
                            color="border-indigo-500/25 text-indigo-300"
                            iconColor="bg-indigo-500/10 text-indigo-400"
                        />
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm tác giả, dự án, nội dung..."
                                className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none border transition-colors focus:border-indigo-500/40"
                                style={{
                                    background: 'var(--bg-surface)',
                                    borderColor: 'var(--border-color)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filterTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                                        statusFilter === tab.key
                                            ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
                                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                    }`}
                                >
                                    {tab.label}
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/20">{tab.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
                    )}

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-24 gap-2 text-[var(--text-secondary)]">
                                <Loader2 className="w-5 h-5 animate-spin" /> Đang tải danh sách…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'var(--input-bg)' }}>
                                    <Inbox className="w-7 h-7 text-[var(--text-secondary)] opacity-40" />
                                </div>
                                <p className="text-[var(--text-primary)] font-semibold">Không có phản hồi phù hợp</p>
                                <p className="text-[var(--text-secondary)] text-sm max-w-sm">
                                    {searchQuery.trim() ? 'Thử đổi từ khóa hoặc bộ lọc trạng thái.' : 'Tác giả chưa gửi phản hồi nào trong danh sách này.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                                {filtered.map(item => {
                                    const isOpen = item.status === 'Open';
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => openDetail(item)}
                                            className="w-full text-left p-5 hover:bg-[var(--bg-hover)] transition-colors group"
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                                                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                                    {getInitials(item.authorName)}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-[var(--text-primary)] text-sm">{item.authorName}</p>
                                                                {isReadableProjectTitle(item.projectTitle) && (
                                                                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{item.projectTitle}</p>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                                {fmtRelative(item.createdAt)} · {fmtDate(item.createdAt)}
                                                            </p>
                                                        </div>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                                                            isOpen
                                                                ? 'bg-amber-500/12 text-amber-400 border border-amber-500/25'
                                                                : 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25'
                                                        }`}>
                                                            {isOpen ? <><Clock className="w-3 h-3" /> Đang chờ</> : <><CheckCircle2 className="w-3 h-3" /> Hoàn thành</>}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                                                        {item.content}
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        {item.staffNote && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                                                Đã trả lời
                                                            </span>
                                                        )}
                                                        {item.userRespondedAt && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                                {item.userReaction === 'Like' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                                                                Tác giả phản hồi lại
                                                            </span>
                                                        )}
                                                        {item.staffGenres && item.staffGenres.slice(0, 2).map(g => (
                                                            <span
                                                                key={g.id}
                                                                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                                                style={{ backgroundColor: `${g.color}15`, color: g.color, border: `1px solid ${g.color}25` }}
                                                            >
                                                                {g.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="h-9 px-3 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--bg-hover)] flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" /> Trước
                            </button>
                            <span className="text-sm text-[var(--text-secondary)] tabular-nums">Trang {page} / {totalPages}</span>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="h-9 px-3 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--bg-hover)] flex items-center gap-1"
                            >
                                Sau <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <Modal
                        isOpen={!!detailItem}
                        onClose={closeDetail}
                        title="Chi tiết phản hồi tác giả"
                        size="xl"
                        footer={detailItem && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
                                {detailItem.projectReportId && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/staff/analysis-reports/${detailItem.projectReportId}`)}
                                        className="h-10 px-4 rounded-xl text-sm font-semibold border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-2"
                                    >
                                        <BarChart2 className="w-4 h-4" /> Xem báo cáo phân tích
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    className="h-10 px-4 rounded-xl text-sm border border-[var(--border-color)] text-[var(--text-secondary)]"
                                >
                                    Đóng
                                </button>
                                {canEditReply && detailItem.status === 'Open' && (
                                    <button
                                        type="button"
                                        onClick={() => void handleResolve()}
                                        disabled={saving}
                                        className="h-10 px-5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Hoàn thành & gửi phản hồi
                                    </button>
                                )}
                                {canEditReply && detailItem.status !== 'Open' && (
                                    <button
                                        type="button"
                                        onClick={() => void handleSaveNote()}
                                        disabled={saving}
                                        className="h-10 px-5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        Lưu phản hồi
                                    </button>
                                )}
                            </div>
                        )}
                    >
                        {detailItem && (
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border"
                                    style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.18)' }}>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                        detailItem.status === 'Open'
                                            ? 'bg-amber-500/12 text-amber-400 border border-amber-500/25'
                                            : 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25'
                                    }`}>
                                        {detailItem.status === 'Open' ? 'Đang chờ xử lý' : 'Đã hoàn thành'}
                                    </span>
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        {detailItem.authorName}
                                        {isReadableProjectTitle(detailItem.projectTitle) ? ` · ${detailItem.projectTitle}` : ''}
                                    </span>
                                    <span className="text-xs text-[var(--text-secondary)] opacity-60">· Phụ trách: {detailItem.staffName}</span>
                                </div>

                                <div className="rounded-2xl p-4 border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-hover)' }}>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                            {getInitials(detailItem.authorName)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-primary)]">{detailItem.authorName}</p>
                                            <p className="text-[10px] text-[var(--text-secondary)]">Tác giả · {fmtDate(detailItem.createdAt)}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed select-text">{detailItem.content}</p>
                                </div>

                                {isReplyViewOnly && detailItem.staffNote ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Phản hồi của {detailItem.staffName}
                                        </label>
                                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed select-text max-h-48 overflow-y-auto">
                                            {detailItem.staffNote}
                                        </div>
                                        <p className="text-[11px] text-amber-300/90">
                                            {detailItem.staffName} đã phản hồi. Bạn chỉ có quyền xem, không thể chỉnh sửa.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                            Phản hồi gửi tác giả
                                        </label>
                                        <textarea
                                            value={replyNote}
                                            onChange={e => setReplyNote(e.target.value)}
                                            rows={4}
                                            maxLength={3000}
                                            placeholder="Nhập câu trả lời hoặc giải thích chi tiết cho tác giả (hiển thị trên trang Phân tích AI)..."
                                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-4 text-sm resize-none outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10"
                                            style={{ color: 'var(--text-primary)' }}
                                        />
                                        <p className="text-[11px] text-[var(--text-secondary)]">{replyNote.length} / 3000 ký tự</p>
                                    </div>
                                )}

                                {detailItem.userRespondedAt && (
                                    <div className="rounded-2xl p-4 border border-emerald-500/20"
                                        style={{ background: 'rgba(34,197,94,0.06)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Mail className="w-4 h-4 text-emerald-400" />
                                            <p className="text-sm font-bold text-emerald-400">
                                                Tác giả đã phản hồi lại
                                                {detailItem.userReaction === 'Like' ? (
                                                    <ThumbsUp className="w-3.5 h-3.5 inline ml-1" />
                                                ) : (
                                                    <ThumbsDown className="w-3.5 h-3.5 inline ml-1" />
                                                )}
                                            </p>
                                            <span className="text-xs text-[var(--text-secondary)] ml-auto">{fmtDate(detailItem.userRespondedAt)}</span>
                                        </div>
                                        {detailItem.userFeedback && (
                                            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap select-text">{detailItem.userFeedback}</p>
                                        )}
                                    </div>
                                )}

                                {detailItem.staffGenres && detailItem.staffGenres.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {detailItem.staffGenres.map(g => (
                                            <span
                                                key={g.id}
                                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                style={{ backgroundColor: `${g.color}18`, color: g.color, border: `1px solid ${g.color}30` }}
                                            >
                                                {g.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
