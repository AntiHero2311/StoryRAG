import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw, Loader2, Bug, Palette, Sparkles, MessageSquare,
    CheckCircle, Clock, AlertTriangle, XCircle, ChevronDown, Trash2, X,
    BarChart3, User, Calendar,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';
import {
    bugReportService,
    type BugReportResponse, type BugStatus, type UpdateBugReportRequest,
} from '../services/bugReportService';

// ── Helpers ────────────────────────────────────────────────────────────────────
function statusConfig(status: BugStatus) {
    switch (status) {
        case 'Open':       return { label: 'Chờ xử lý', icon: Clock,         bg: 'bg-sky-500/15',     text: 'text-sky-400',     border: 'border-sky-500/30' };
        case 'InProgress': return { label: 'Đang xử lý', icon: RefreshCw,    bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30' };
        case 'Resolved':   return { label: 'Đã giải quyết', icon: CheckCircle, bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' };
        case 'Closed':     return { label: 'Đã đóng',     icon: XCircle,     bg: 'bg-zinc-500/15',    text: 'text-zinc-400',    border: 'border-zinc-500/30' };
    }
}

function categoryIcon(cat: string) {
    switch (cat) {
        case 'Bug':     return <Bug className="w-3.5 h-3.5" />;
        case 'UX':      return <Palette className="w-3.5 h-3.5" />;
        case 'Feature': return <Sparkles className="w-3.5 h-3.5" />;
        default:        return <MessageSquare className="w-3.5 h-3.5" />;
    }
}

function priorityBadge(priority: string) {
    if (priority === 'High')   return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    if (priority === 'Medium') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
}

function priorityLabel(p: string) {
    return { High: '🔴 Cao', Medium: '🟡 Trung bình', Low: '🟢 Thấp' }[p] ?? p;
}

function formatDate(s: string) {
    return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({
    report, onClose, onUpdated,
}: {
    report: BugReportResponse;
    onClose: () => void;
    onUpdated: (r: BugReportResponse) => void;
}){
    const [status, setStatus] = useState<BugStatus>(report.status);
    const [note, setNote] = useState(report.staffNote ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const req: UpdateBugReportRequest = { status, staffNote: note || undefined };
            const updated = await bugReportService.updateStatus(report.id, req);
            onUpdated(updated);
            onClose();
        } catch {
            setError('Lưu thất bại. Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    };

    const sc = statusConfig(status);
    void sc; // used for status color display below

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-color)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-secondary)]"
                        style={{ background: 'var(--input-bg)' }}>
                        {categoryIcon(report.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-bold text-sm truncate">{report.title}</p>
                        <p className="text-[var(--text-secondary)] text-xs">{report.category} · {formatDate(report.createdAt)}</p>
                    </div>
                    <button onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Reporter */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--input-bg)]">
                        <User className="w-4 h-4 text-[var(--text-secondary)]" />
                        <div>
                            <p className="text-[var(--text-primary)] text-sm font-medium">{report.reporterName}</p>
                            <p className="text-[var(--text-secondary)] text-xs">{report.reporterEmail}</p>
                        </div>
                        <span className={`ml-auto text-xs px-2.5 py-1 rounded-lg font-medium ${priorityBadge(report.priority)}`}>
                            {priorityLabel(report.priority)}
                        </span>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Mô tả</label>
                        <p className="text-[var(--text-primary)] text-sm bg-[var(--input-bg)] px-4 py-3 rounded-xl border border-[var(--border-color)] whitespace-pre-wrap leading-relaxed">
                            {report.description}
                        </p>
                    </div>

                    {/* Status picker */}
                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Trạng thái</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['Open', 'InProgress', 'Resolved', 'Closed'] as BugStatus[]).map(s => {
                                const c = statusConfig(s);
                                const Icon = c.icon;
                                return (
                                    <button key={s} onClick={() => setStatus(s)}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${status === s ? `${c.bg} ${c.text} ${c.border}` : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/5'}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Staff note */}
                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Ghi chú của staff</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="Ghi chú xử lý, nguyên nhân, hướng giải quyết..."
                            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                        />
                    </div>

                    {error && <p className="text-rose-400 text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{error}</p>}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StaffDashboardPage() {
    const navigate = useNavigate();

    const [reports, setReports] = useState<BugReportResponse[]>([]);
    const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<BugStatus | 'all'>('all');
    const [selected, setSelected] = useState<BugReportResponse | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [data, s] = await Promise.all([
                bugReportService.getAll(filterStatus === 'all' ? undefined : filterStatus),
                bugReportService.getStats(),
            ]);
            setReports(data);
            setStats(s);
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message
                ?? (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message
                ?? 'Không thể tải dữ liệu báo cáo lỗi.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') {
            navigate('/home');
            return;
        }
        load();
    }, [load]);

    const handleUpdated = (updated: BugReportResponse) => {
        setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
        load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xoá báo cáo này?')) return;
        try {
            await bugReportService.delete(id);
            setReports(prev => prev.filter(r => r.id !== id));
            await load();
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message
                ?? (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message
                ?? 'Xoá báo cáo thất bại.';
            setError(message);
        }
    };

    const filtered = filterStatus === 'all' ? reports : reports.filter(r => r.status === filterStatus);

    const statCards = [
        { label: 'Tổng cộng',    value: stats.total,      color: 'text-[var(--text-primary)]', icon: BarChart3 },
        { label: 'Chờ xử lý',   value: stats.open,        color: 'text-sky-400',     icon: Clock },
        { label: 'Đang xử lý',  value: stats.inProgress,  color: 'text-amber-400',   icon: RefreshCw },
        { label: 'Đã giải quyết', value: stats.resolved,  color: 'text-emerald-400', icon: CheckCircle },
        { label: 'Đã đóng',     value: stats.closed,      color: 'text-zinc-400',    icon: XCircle },
    ];

    return (
        <MainLayout pageTitle="Quản lý báo cáo lỗi">
            {(userInfo) => (
            <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {statCards.map(c => (
                        <div key={c.label}
                            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-[var(--text-secondary)]/30 transition-colors"
                            onClick={() => {
                                const map: Record<string, BugStatus | 'all'> = {
                                    'Tổng cộng': 'all', 'Chờ xử lý': 'Open', 'Đang xử lý': 'InProgress',
                                    'Đã giải quyết': 'Resolved', 'Đã đóng': 'Closed',
                                };
                                setFilterStatus(map[c.label] ?? 'all');
                            }}>
                            <c.icon className={`w-5 h-5 shrink-0 ${c.color}`} />
                            <div>
                                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                                <p className="text-[var(--text-secondary)] text-xs">{c.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter + Refresh */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as BugStatus | 'all')}
                            className="appearance-none pl-3 pr-8 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-amber-500/30"
                        >
                            <option value="all">Tất cả</option>
                            <option value="Open">Chờ xử lý</option>
                            <option value="InProgress">Đang xử lý</option>
                            <option value="Resolved">Đã giải quyết</option>
                            <option value="Closed">Đã đóng</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                    </div>

                    <button onClick={load}
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>

                    <p className="text-[var(--text-secondary)] text-sm ml-auto">{filtered.length} báo cáo</p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Table */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-[var(--text-secondary)]">
                        <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Không có báo cáo nào</p>
                    </div>
                ) : (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        {['Tiêu đề', 'Người gửi', 'Loại', 'Mức độ', 'Trạng thái', 'Ngày gửi', ''].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {filtered.map(r => {
                                        const sc = statusConfig(r.status);
                                        const StatusIcon = sc.icon;
                                        return (
                                            <tr key={r.id}
                                                onClick={() => setSelected(r)}
                                                className="hover:bg-[var(--text-primary)]/3 cursor-pointer transition-colors group">
                                                <td className="px-4 py-3 max-w-[220px]">
                                                    <p className="text-[var(--text-primary)] text-sm font-medium truncate">{r.title}</p>
                                                    {r.staffNote && (
                                                        <p className="text-[var(--text-secondary)] text-xs truncate mt-0.5 opacity-70">
                                                            💬 {r.staffNote}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <p className="text-[var(--text-primary)] text-sm">{r.reporterName}</p>
                                                    <p className="text-[var(--text-secondary)] text-xs">{r.reporterEmail}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] bg-[var(--input-bg)] border border-[var(--border-color)] px-2.5 py-1 rounded-lg">
                                                        {categoryIcon(r.category)} {r.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${priorityBadge(r.priority)}`}>
                                                        {priorityLabel(r.priority)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${sc.bg} ${sc.text} ${sc.border}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(r.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {userInfo.role === 'Admin' && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                                                            className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                                            title="Xoá">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selected && (
                    <DetailModal
                        report={selected}
                        onClose={() => setSelected(null)}
                        onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
                    />
                )}
            </div>
            )}
        </MainLayout>
    );
}
