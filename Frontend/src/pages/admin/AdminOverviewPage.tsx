import { useCallback, useEffect, useState, type ElementType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Users, CreditCard, Bug, Globe,
    RefreshCw, DollarSign, Settings2, ScrollText, Headphones, ChevronRight,
    Shield, AlertTriangle, CheckCircle2, LayoutDashboard,
    TrendingUp, BarChart3, UserPlus,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { getUserInfo } from '../../utils/jwtHelper';
import { adminService, type AdminOverviewStats } from '../../services/adminService';
import { AdminPageShell, fmtNum, fmtTokens, MiniBar } from '../../components/admin/AdminShared';

const METRIC_MODULES = [
    {
        to: '/admin/users',
        icon: Users,
        label: 'Người dùng',
        sub: 'Tài khoản trên nền tảng',
        accent: '#818cf8',
        border: 'border-indigo-500/20 hover:border-indigo-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(99,102,241,0.12)]',
        iconBg: 'bg-indigo-500/12 text-indigo-400',
        valueColor: 'text-indigo-300',
        getValue: (ov: AdminOverviewStats) => fmtNum(ov.totalUsers),
        getHint: (ov: AdminOverviewStats) => `+${fmtNum(ov.newUsersLast7Days)} tuần này`,
    },
    {
        to: '/admin/subscription',
        icon: CreditCard,
        label: 'Gói đang hoạt động',
        sub: 'Subscription còn hiệu lực',
        accent: '#34d399',
        border: 'border-emerald-500/20 hover:border-emerald-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(52,211,153,0.12)]',
        iconBg: 'bg-emerald-500/12 text-emerald-400',
        valueColor: 'text-emerald-300',
        getValue: (ov: AdminOverviewStats) => fmtNum(ov.activeSubscriptions),
        getHint: (ov: AdminOverviewStats) => `${fmtNum(ov.expiredSubscriptions)} đã hết hạn`,
    },
    {
        to: '/admin/revenue',
        icon: DollarSign,
        label: 'Doanh thu 30 ngày',
        sub: 'Thanh toán thành công gần đây',
        accent: '#fbbf24',
        border: 'border-amber-500/20 hover:border-amber-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(251,191,36,0.12)]',
        iconBg: 'bg-amber-500/12 text-amber-400',
        valueColor: 'text-amber-300',
        getValue: (ov: AdminOverviewStats) => fmtCurrencyShort(ov.revenueLast30Days),
        getHint: (ov: AdminOverviewStats) => `${fmtNum(ov.successfulPayments)} giao dịch`,
    },
    {
        to: '/staff/bugs',
        icon: Bug,
        label: 'Bug đang mở',
        sub: 'Cần theo dõi hoặc xử lý',
        accent: '#fb923c',
        border: 'border-orange-500/20 hover:border-orange-500/45',
        glow: 'hover:shadow-[0_8px_32px_rgba(251,146,60,0.12)]',
        iconBg: 'bg-orange-500/12 text-orange-400',
        valueColor: 'text-orange-300',
        getValue: (ov: AdminOverviewStats) => fmtNum(ov.openBugReports + ov.inProgressBugReports),
        getHint: (ov: AdminOverviewStats) => ov.highPriorityOpenBugs > 0
            ? `${fmtNum(ov.highPriorityOpenBugs)} ưu tiên cao`
            : 'Không có bug khẩn',
    },
] as const;

const NAV_LINKS = [
    { to: '/admin/users', label: 'Người dùng', desc: 'CRUD, khoá/mở tài khoản', icon: Users, iconBg: 'bg-indigo-500/12 text-indigo-400', border: 'hover:border-indigo-500/35', chevronHover: 'group-hover:text-indigo-400' },
    { to: '/admin/revenue', label: 'Doanh thu', desc: 'Báo cáo thanh toán chi tiết', icon: DollarSign, iconBg: 'bg-amber-500/12 text-amber-400', border: 'hover:border-amber-500/35', chevronHover: 'group-hover:text-amber-400' },
    { to: '/admin/subscription', label: 'Gói dịch vụ', desc: 'Quản lý plans & pricing', icon: CreditCard, iconBg: 'bg-emerald-500/12 text-emerald-400', border: 'hover:border-emerald-500/35', chevronHover: 'group-hover:text-emerald-400' },
    { to: '/admin/system', label: 'Hệ thống', desc: 'RAG config & giới hạn lưu trữ', icon: Settings2, iconBg: 'bg-violet-500/12 text-violet-400', border: 'hover:border-violet-500/35', chevronHover: 'group-hover:text-violet-400' },
    { to: '/admin/logs', label: 'Nhật ký', desc: 'Audit log toàn hệ thống', icon: ScrollText, iconBg: 'bg-sky-500/12 text-sky-400', border: 'hover:border-sky-500/35', chevronHover: 'group-hover:text-sky-400' },
    { to: '/staff', label: 'Vận hành Staff', desc: 'Feedback, duyệt báo cáo, bug…', icon: Headphones, iconBg: 'bg-rose-500/12 text-rose-400', border: 'hover:border-rose-500/35', chevronHover: 'group-hover:text-rose-400' },
];

function fmtCurrencyShort(n: number) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return fmtNum(n);
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AD';
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

function MetricCardSkeleton() {
    return (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 animate-pulse">
            <div className="h-1 w-full rounded-full bg-[var(--text-primary)]/8 mb-4" />
            <div className="flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--text-primary)]/8 shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-[var(--text-primary)]/8" />
                    <div className="h-7 w-16 rounded bg-[var(--text-primary)]/10" />
                    <div className="h-3 w-32 rounded bg-[var(--text-primary)]/6" />
                </div>
            </div>
        </div>
    );
}

function InsightTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">{label}</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-[var(--text-secondary)] mt-1">{sub}</p>}
        </div>
    );
}

export default function AdminOverviewPage() {
    const navigate = useNavigate();
    const [adminName, setAdminName] = useState('Admin');
    const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setOverview(await adminService.getOverviewStats());
            setLastUpdated(new Date());
        } catch {
            setError('Không tải được thống kê tổng quan. Vui lòng thử lại.');
            setOverview(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Admin') { navigate('/home'); return; }
        setAdminName(info.fullName || 'Admin');
        void load();
    }, [load, navigate]);

    const ov = overview;
    const openBugs = ov ? ov.openBugReports + ov.inProgressBugReports : 0;
    const needsAttention = ov ? ov.highPriorityOpenBugs > 0 || openBugs > 0 : false;

    return (
        <MainLayout pageTitle="Admin">
            {() => (
                <AdminPageShell
                    title="Tổng quan Admin"
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
                        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/8 blur-[80px] rounded-full pointer-events-none" />
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
                                        {getInitials(adminName)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                                <Shield className="w-3 h-3" />
                                                Admin Console
                                            </span>
                                            <span className="text-[11px] text-[var(--text-secondary)] capitalize">{fmtToday()}</span>
                                        </div>
                                        <h2 className="text-[var(--text-primary)] font-black text-2xl md:text-3xl leading-tight">
                                            {getGreeting()}, {adminName}
                                        </h2>
                                        <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed max-w-xl">
                                            Bảng điều khiển quản trị StoryNest — theo dõi người dùng, doanh thu, nội dung và sức khỏe hệ thống.
                                        </p>
                                    </div>
                                </div>

                                <div className="xl:w-72 shrink-0">
                                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]/60 backdrop-blur-sm p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Hệ thống</span>
                                            <span className="relative flex h-2.5 w-2.5">
                                                {needsAttention && (
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                                                )}
                                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                    needsAttention ? 'bg-amber-400' : 'bg-emerald-400'
                                                }`} />
                                            </span>
                                        </div>
                                        <div className={`rounded-xl border px-4 py-3 ${
                                            needsAttention
                                                ? 'border-amber-500/30 bg-amber-500/8'
                                                : 'border-emerald-500/30 bg-emerald-500/8'
                                        }`}>
                                            {needsAttention && ov ? (
                                                <>
                                                    <p className="text-3xl font-black text-amber-300 leading-none">
                                                        {fmtNum(ov.highPriorityOpenBugs > 0 ? ov.highPriorityOpenBugs : openBugs)}
                                                    </p>
                                                    <p className="text-xs text-amber-300/70 mt-1.5 flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                        {ov.highPriorityOpenBugs > 0 ? 'bug ưu tiên cao' : 'bug đang mở'}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Ổn định
                                                    </p>
                                                    <p className="text-xs text-emerald-300/70 mt-1">Không có cảnh báo khẩn</p>
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

                    {/* Key metrics */}
                    <section className="space-y-4">
                        <SectionHeader
                            icon={LayoutDashboard}
                            title="Chỉ số chính"
                            hint="Số liệu quan trọng nhất — bấm để mở trang quản lý"
                        />
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
                            </div>
                        ) : ov && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                {METRIC_MODULES.map(mod => {
                                    const Icon = mod.icon;
                                    const value = mod.getValue(ov);
                                    const hint = mod.getHint(ov);
                                    const hasAlert = mod.label === 'Bug đang mở' && openBugs > 0;
                                    return (
                                        <Link
                                            key={mod.to}
                                            to={mod.to}
                                            className={`group relative flex flex-col rounded-2xl border bg-[var(--bg-surface)] transition-all duration-200 hover:-translate-y-0.5 ${mod.border} ${mod.glow}`}
                                        >
                                            <div className="h-1 rounded-t-2xl" style={{ background: mod.accent, opacity: hasAlert ? 1 : 0.4 }} />
                                            <div className="flex items-start gap-4 p-5">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${mod.iconBg}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] truncate">
                                                        {mod.label}
                                                    </p>
                                                    <p className={`text-2xl font-black leading-none mt-1 tabular-nums ${hasAlert ? mod.valueColor : 'text-[var(--text-primary)]'}`}>
                                                        {value}
                                                    </p>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-2">{mod.sub}</p>
                                                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Deeper insights — data not repeated in metric cards */}
                    {!loading && ov && (
                        <section className="space-y-4">
                            <SectionHeader
                                icon={BarChart3}
                                title="Chi tiết nền tảng"
                                hint="Phân tích sâu hơn — không trùng với chỉ số chính phía trên"
                            />
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-sky-400" />
                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">Nội dung & AI</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <InsightTile label="Dự án" value={fmtNum(ov.totalProjects)} />
                                        <InsightTile label="Chương" value={fmtNum(ov.totalChapters)} />
                                        <InsightTile label="Tổng từ" value={fmtTokens(ov.totalWordCount)} />
                                        <InsightTile label="AI tokens" value={fmtTokens(ov.totalAiTokens)} />
                                    </div>
                                    <div className="pt-2 border-t border-[var(--border-color)] space-y-2 text-xs text-[var(--text-secondary)]">
                                        <p>{fmtNum(ov.totalAiAnalyses)} lượt phân tích AI</p>
                                        <p>{fmtNum(ov.totalAiChatMessages)} tin nhắn chat AI</p>
                                        <p>{fmtNum(ov.totalWorldbuildingEntries)} mục worldbuilding</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <UserPlus className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">Cộng đồng người dùng</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <MiniBar label="Tác giả" value={ov.totalAuthors} total={ov.totalUsers} color="bg-indigo-500" />
                                        <MiniBar label="Staff" value={ov.totalStaff} total={ov.totalUsers} color="bg-amber-500" />
                                        <MiniBar label="Admin" value={ov.totalAdmins} total={ov.totalUsers} color="bg-rose-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-color)]">
                                        <InsightTile label="Mới 7 ngày" value={fmtNum(ov.newUsersLast7Days)} />
                                        <InsightTile label="Mới 30 ngày" value={fmtNum(ov.newUsersLast30Days)} />
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        {fmtNum(ov.activeUsers)} tài khoản đang hoạt động
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">Gói & thanh toán</h4>
                                    </div>
                                    <div className="space-y-3">
                                        <MiniBar label="Đang hoạt động" value={ov.activeSubscriptions} total={ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions} color="bg-emerald-500" />
                                        <MiniBar label="Hết hạn" value={ov.expiredSubscriptions} total={ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions} color="bg-amber-500" />
                                        <MiniBar label="Đã huỷ" value={ov.cancelledSubscriptions} total={ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions} color="bg-rose-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-color)]">
                                        <InsightTile label="Doanh thu 7 ngày" value={fmtCurrencyShort(ov.revenueLast7Days)} />
                                        <InsightTile label="Tổng doanh thu" value={fmtCurrencyShort(ov.totalRevenue)} />
                                    </div>
                                    <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                                        <MiniBar label="Bug đã xử lý" value={ov.resolvedBugReports} total={ov.resolvedBugReports + openBugs} color="bg-emerald-500" />
                                        {ov.highPriorityOpenBugs > 0 && (
                                            <p className="text-xs text-rose-300 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                {fmtNum(ov.highPriorityOpenBugs)} bug ưu tiên cao đang mở
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Navigation */}
                    <section className="space-y-4">
                        <SectionHeader
                            icon={Settings2}
                            title="Điều hướng quản trị"
                            hint="Truy cập nhanh các khu vực quản lý"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {NAV_LINKS.map(link => {
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
                                            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{link.desc}</p>
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
