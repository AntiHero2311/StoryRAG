import { useCallback, useEffect, useState, type ElementType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    MessageSquare, Activity, CircleHelp, Bug, RefreshCw,
    ClipboardCheck, AlertTriangle, CheckCircle2, BarChart3,
    Headphones, Loader2, ChevronRight, LayoutDashboard, Sparkles,
    ListTodo, Clock,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { getUserInfo } from '../../utils/jwtHelper';
import { AdminPageShell, fmtNum } from '../../components/admin/AdminShared';
import { staffService } from '../../services/staffService';
import { analysisJobService, type StaffAnalysisJobItem, type StaffPendingReportItem } from '../../services/analysisJobService';
import { bugReportService, type BugReportResponse } from '../../services/bugReportService';
import type { StaffFeedbackResponse } from '../../services/feedbackService';

type HubStats = {
    pendingReports: number;
    openFeedbacks: number;
    failedJobs: number;
    openBugs: number;
};

const OPERATION_MODULES = [
    {
        to: '/staff/analyses',
        icon: ClipboardCheck,
        label: 'Báo cáo chờ duyệt',
        sub: 'Review và phát hành kết quả AI',
        statKey: 'pendingReports' as const,
        accent: '#f59e0b',
        border: 'border-amber-500/20 hover:border-amber-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(245,158,11,0.12)]',
        iconBg: 'bg-amber-500/12 text-amber-400',
        valueColor: 'text-amber-300',
    },
    {
        to: '/staff/feedbacks',
        icon: MessageSquare,
        label: 'Phản hồi tác giả',
        sub: 'Trả lời thắc mắc về báo cáo',
        statKey: 'openFeedbacks' as const,
        accent: '#38bdf8',
        border: 'border-sky-500/20 hover:border-sky-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(56,189,248,0.12)]',
        iconBg: 'bg-sky-500/12 text-sky-400',
        valueColor: 'text-sky-300',
    },
    {
        to: '/staff/analysis-jobs',
        icon: Activity,
        label: 'Job lỗi / treo',
        sub: 'Can thiệp pipeline phân tích',
        statKey: 'failedJobs' as const,
        accent: '#a78bfa',
        border: 'border-violet-500/20 hover:border-violet-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(167,139,250,0.12)]',
        iconBg: 'bg-violet-500/12 text-violet-400',
        valueColor: 'text-violet-300',
    },
    {
        to: '/staff/bugs',
        icon: Bug,
        label: 'Bug đang xử lý',
        sub: 'Báo cáo lỗi từ người dùng',
        statKey: 'openBugs' as const,
        accent: '#fb923c',
        border: 'border-orange-500/20 hover:border-orange-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(251,146,60,0.12)]',
        iconBg: 'bg-orange-500/12 text-orange-400',
        valueColor: 'text-orange-300',
    },
];

type PriorityItem = {
    id: string;
    categoryLabel: string;
    title: string;
    meta: string;
    to: string;
    sortKey: number;
    icon: ElementType;
    badge?: string;
    badgeClass?: string;
};

const BUG_PRIORITY_WEIGHT: Record<string, number> = { High: 90, Medium: 60, Low: 30 };
const MAX_PRIORITY_ITEMS = 5;

function fmtRelative(iso: string) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
}

function truncate(text: string, max = 72) {
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

function buildPriorityQueue(
    jobs: StaffAnalysisJobItem[],
    reports: StaffPendingReportItem[],
    bugs: BugReportResponse[],
    feedbacks: StaffFeedbackResponse[],
): PriorityItem[] {
    const items: PriorityItem[] = [];

    for (const job of jobs) {
        const ts = job.last_heartbeat ?? job.started_at ?? '';
        items.push({
            id: `job-${job.id}`,
            categoryLabel: 'Job lỗi / treo',
            title: truncate(job.project_title || 'Dự án không tên'),
            meta: `${job.requested_by_name || 'Tác giả'} · ${job.status}${ts ? ` · ${fmtRelative(ts)}` : ''}`,
            to: '/staff/analysis-jobs',
            sortKey: 1000 + (ts ? Date.now() - new Date(ts).getTime() : 0),
            icon: Activity,
            badge: 'Khẩn',
            badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
        });
    }

    for (const bug of bugs.filter(b => b.status === 'Open' || b.status === 'InProgress')) {
        items.push({
            id: `bug-${bug.id}`,
            categoryLabel: 'Bug',
            title: truncate(bug.title),
            meta: `${bug.reporterName} · ${bug.status === 'InProgress' ? 'Đang xử lý' : 'Mới'} · ${fmtRelative(bug.createdAt)}`,
            to: '/staff/bugs',
            sortKey: (BUG_PRIORITY_WEIGHT[bug.priority] ?? 40) + (Date.now() - new Date(bug.createdAt).getTime()) / 1e6,
            icon: Bug,
            badge: bug.priority === 'High' ? 'Cao' : bug.priority === 'Medium' ? 'TB' : undefined,
            badgeClass: bug.priority === 'High'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                : 'bg-orange-500/15 text-orange-300 border-orange-500/25',
        });
    }

    for (const report of reports) {
        items.push({
            id: `report-${report.report_id}`,
            categoryLabel: 'Báo cáo chờ duyệt',
            title: truncate(report.project_title || 'Dự án không tên'),
            meta: `${report.author_name} · Điểm ${report.total_score} · ${fmtRelative(report.created_at)}`,
            to: `/staff/analysis-reports/${report.report_id}`,
            sortKey: 500 + (Date.now() - new Date(report.created_at).getTime()) / 1e6,
            icon: ClipboardCheck,
        });
    }

    for (const fb of feedbacks.filter(f => f.status === 'Open')) {
        items.push({
            id: `fb-${fb.id}`,
            categoryLabel: 'Phản hồi',
            title: truncate(fb.content),
            meta: `${fb.authorName} · ${fmtRelative(fb.createdAt)}`,
            to: '/staff/feedbacks',
            sortKey: 400 + (Date.now() - new Date(fb.createdAt).getTime()) / 1e6,
            icon: MessageSquare,
        });
    }

    return items
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, MAX_PRIORITY_ITEMS);
}

const SECONDARY_LINKS = [
    {
        to: '/staff/performance',
        icon: BarChart3,
        label: 'Hiệu suất & KPI',
        sub: 'Thống kê duyệt báo cáo và phản hồi theo tháng',
        border: 'hover:border-indigo-500/35',
        iconBg: 'bg-indigo-500/12 text-indigo-400',
        chevronHover: 'group-hover:text-indigo-400',
    },
    {
        to: '/staff/content?tab=faq',
        icon: CircleHelp,
        label: 'Nội dung trợ giúp',
        sub: 'Quản lý FAQ và mẹo viết cho tác giả',
        border: 'hover:border-emerald-500/35',
        iconBg: 'bg-emerald-500/12 text-emerald-400',
        chevronHover: 'group-hover:text-emerald-400',
    },
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function fmtToday() {
    return new Date().toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

function SectionHeader({ icon: Icon, title, hint }: { icon: ElementType; title: string; hint?: string }) {
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--border-color)] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
                    {hint && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{hint}</p>}
                </div>
            </div>
        </div>
    );
}

function OperationCardSkeleton() {
    return (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 animate-pulse">
            <div className="h-1 w-full rounded-full bg-[var(--text-primary)]/8 mb-4" />
            <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--text-primary)]/8 shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-[var(--text-primary)]/8" />
                    <div className="h-7 w-12 rounded bg-[var(--text-primary)]/10" />
                    <div className="h-3 w-32 rounded bg-[var(--text-primary)]/6" />
                </div>
            </div>
        </div>
    );
}

export default function StaffOverviewPage() {
    const navigate = useNavigate();
    const [staffName, setStaffName] = useState('Staff');
    const [stats, setStats] = useState<HubStats | null>(null);
    const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [performance, jobs, bugs, pendingReportsRes, pendingPreview, allBugs, feedbacksRes] = await Promise.all([
                staffService.getPerformance(),
                analysisJobService.getAnalysisJobs('failed,stale'),
                bugReportService.getStats(),
                analysisJobService.getPendingReports(1, 1, 'Pending'),
                analysisJobService.getPendingReports(1, 3, 'Pending'),
                bugReportService.getAll().catch(() => [] as BugReportResponse[]),
                staffService.getFeedbacks(1, 5).catch(() => ({ items: [] as StaffFeedbackResponse[], totalCount: 0, page: 1, pageSize: 5 })),
            ]);
            setStats({
                pendingReports: pendingReportsRes.totalCount ?? 0,
                openFeedbacks: performance.openFeedbacksAssigned,
                failedJobs: jobs.length,
                openBugs: bugs.open + bugs.inProgress,
            });
            setPriorityItems(buildPriorityQueue(
                jobs,
                pendingPreview.items ?? [],
                allBugs,
                feedbacksRes.items ?? [],
            ));
            setLastUpdated(new Date());
        } catch {
            setError('Không tải được tổng quan vận hành. Vui lòng thử lại.');
            setStats(null);
            setPriorityItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') { navigate('/home'); return; }
        setStaffName(info.fullName || 'Staff');
        void load();
    }, [load, navigate]);

    const totalPending = stats
        ? stats.pendingReports + stats.openFeedbacks + stats.failedJobs + stats.openBugs
        : 0;

    return (
        <MainLayout pageTitle="Vận hành">
            {() => (
                <AdminPageShell
                    title="Trung tâm vận hành Staff"
                    action={
                        <button
                            type="button"
                            onClick={() => void load()}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-indigo-500/30 transition-all disabled:opacity-60"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </button>
                    }
                >
                    {/* Hero */}
                    <div
                        className="relative rounded-3xl border overflow-hidden"
                        style={{
                            borderColor: 'rgba(99,102,241,0.2)',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.05) 40%, var(--bg-surface) 100%)',
                        }}
                    >
                        <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/8 blur-[80px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-indigo-500/6 blur-[60px] rounded-full pointer-events-none" />
                        <div className="h-1" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)' }} />

                        <div className="relative p-6 md:p-8">
                            <div className="flex flex-col xl:flex-row xl:items-center gap-6">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-lg tracking-tight"
                                        style={{
                                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                            boxShadow: '0 12px 32px rgba(99,102,241,0.35)',
                                        }}
                                    >
                                        {getInitials(staffName)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                                <Sparkles className="w-3 h-3" />
                                                Staff Operations
                                            </span>
                                            <span className="text-[11px] text-[var(--text-secondary)] capitalize">{fmtToday()}</span>
                                        </div>
                                        <h2 className="text-[var(--text-primary)] font-black text-2xl md:text-3xl leading-tight">
                                            {getGreeting()}, {staffName}
                                        </h2>
                                        <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed max-w-xl">
                                            Bảng điều khiển vận hành StoryNest — theo dõi hàng đợi công việc và điều hướng nhanh tới từng khu vực xử lý.
                                        </p>
                                    </div>
                                </div>

                                <div className="xl:w-72 shrink-0">
                                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]/60 backdrop-blur-sm p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Trạng thái</span>
                                            <span className={`relative flex h-2.5 w-2.5 ${totalPending > 0 ? '' : ''}`}>
                                                {totalPending > 0 && (
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                                                )}
                                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                    totalPending > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`} />
                                            </span>
                                        </div>
                                        <div className={`rounded-xl border px-4 py-3 ${
                                            totalPending > 0
                                                ? 'border-amber-500/30 bg-amber-500/8'
                                                : 'border-emerald-500/30 bg-emerald-500/8'
                                        }`}>
                                            {totalPending > 0 ? (
                                                <>
                                                    <p className="text-3xl font-black text-amber-300 leading-none">{fmtNum(totalPending)}</p>
                                                    <p className="text-xs text-amber-300/70 mt-1.5 flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                        việc cần xử lý
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Ổn định
                                                    </p>
                                                    <p className="text-xs text-emerald-300/70 mt-1">Không có việc chờ trong hàng đợi</p>
                                                </>
                                            )}
                                        </div>
                                        {lastUpdated && (
                                            <p className="text-[11px] text-[var(--text-secondary)] text-center">
                                                Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Work queue */}
                    <section className="space-y-4">
                        <SectionHeader
                            icon={LayoutDashboard}
                            title="Hàng đợi công việc"
                            hint="Số lượng việc chờ theo từng khu vực — bấm để mở trang xử lý"
                        />

                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => <OperationCardSkeleton key={i} />)}
                            </div>
                        ) : stats && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                {OPERATION_MODULES.map(mod => {
                                    const Icon = mod.icon;
                                    const value = stats[mod.statKey];
                                    const hasWork = value > 0;
                                    return (
                                        <Link
                                            key={mod.to}
                                            to={mod.to}
                                            className={`group relative flex flex-col rounded-2xl border bg-[var(--bg-surface)] transition-all duration-200 hover:-translate-y-0.5 ${mod.border} ${mod.glow}`}
                                        >
                                            <div className="h-1 rounded-t-2xl" style={{ background: mod.accent, opacity: hasWork ? 1 : 0.35 }} />
                                            <div className="flex items-start gap-4 p-5">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${mod.iconBg}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] truncate">
                                                            {mod.label}
                                                        </p>
                                                        {hasWork && (
                                                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-80" style={{ color: mod.accent }} />
                                                        )}
                                                    </div>
                                                    <p className={`text-3xl font-black leading-none tabular-nums ${hasWork ? mod.valueColor : 'text-[var(--text-primary)]/40'}`}>
                                                        {fmtNum(value)}
                                                    </p>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-2 leading-snug">{mod.sub}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-1 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-secondary)]" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Priority queue — concrete items, not duplicate counts */}
                    {!loading && stats && totalPending > 0 && priorityItems.length > 0 && (
                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
                            <SectionHeader
                                icon={ListTodo}
                                title="Việc ưu tiên"
                                hint="Danh sách cụ thể cần xử lý sớm — sắp xếp theo mức độ khẩn"
                            />
                            <div className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                                {priorityItems.map((item, idx) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.id}
                                            to={item.to}
                                            className="group flex items-start gap-4 px-4 py-3.5 hover:bg-[var(--bg-hover)]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 shrink-0 pt-0.5">
                                                <span className="w-6 text-center text-xs font-bold text-[var(--text-tertiary)] tabular-nums">
                                                    {idx + 1}
                                                </span>
                                                <div className="w-9 h-9 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--border-color)] flex items-center justify-center">
                                                    <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                        {item.categoryLabel}
                                                    </span>
                                                    {item.badge && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.badgeClass}`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug group-hover:text-indigo-300 transition-colors">
                                                    {item.title}
                                                </p>
                                                <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 shrink-0 opacity-60" />
                                                    {item.meta}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-2 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-secondary)]" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Secondary tools */}
                    <section className="space-y-4">
                        <SectionHeader
                            icon={Headphones}
                            title="Công cụ & quản lý"
                            hint="Theo dõi hiệu suất và nội dung hỗ trợ tác giả"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {SECONDARY_LINKS.map(link => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.to}
                                        to={link.to}
                                        className={`group flex items-center gap-4 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]/40 transition-all duration-200 hover:-translate-y-0.5 ${link.border}`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${link.iconBg}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-[var(--text-primary)]">{link.label}</p>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{link.sub}</p>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-[var(--text-tertiary)] shrink-0 transition-transform group-hover:translate-x-0.5 ${link.chevronHover}`} />
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
