import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, UserX, Shield, BookOpen, Briefcase,
    RefreshCw, Search, ChevronUp, ChevronDown,
    FileText, AlignLeft, Sparkles,
    CreditCard, Bug, Globe,
} from 'lucide-react';
import { adminService, UserSummary, UserStatsResponse, AdminOverviewStats } from '../services/adminService';
import MainLayout from '../layouts/MainLayout';

type SortKey = 'fullName' | 'email' | 'role' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | undefined) {
    return (n ?? 0).toLocaleString('vi-VN');
}

function fmtTokens(n: number | undefined) {
    const v = n ?? 0;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
    icon: Icon, label, value, sub, color, iconColor,
}: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; color: string; iconColor: string;
}) {
    return (
        <div className={`flex items-start gap-4 p-5 rounded-2xl border ${color} backdrop-blur-sm`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-0.5 truncate">{label}</p>
                <p className="text-2xl font-bold leading-none">{typeof value === 'number' ? fmtNum(value) : value}</p>
                {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────

function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] w-28 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-[var(--text-primary)]/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-[var(--text-primary)] w-8 text-right">{fmtNum(value)}</span>
        </div>
    );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
            </div>
            {children}
        </div>
    );
}

// ── Role / Sort helpers ───────────────────────────────────────────────────────

const roleStyle = (role: string) => {
    if (role === 'Admin') return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (role === 'Staff') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
};
const roleLabel = (role: string) =>
    ({ Admin: 'Admin', Author: 'Tác giả', Staff: 'Nhân viên' } as Record<string, string>)[role] ?? role;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
    return (
        <MainLayout pageTitle="Admin Dashboard">
            {() => <AdminDashboardContent />}
        </MainLayout>
    );
}

function AdminDashboardContent() {
    const navigate = useNavigate();
    const token    = localStorage.getItem('token');

    const [overview, setOverview]   = useState<AdminOverviewStats | null>(null);
    const [stats,    setStats]      = useState<UserStatsResponse | null>(null);
    const [loading,  setLoading]    = useState(true);
    const [error,    setError]      = useState('');
    const [search,   setSearch]     = useState('');
    const [sortKey,  setSortKey]    = useState<SortKey>('createdAt');
    const [sortDir,  setSortDir]    = useState<SortDir>('desc');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    useEffect(() => { if (!token) { navigate('/login'); return; } fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true); setError('');
        try {
            const [ov, us] = await Promise.all([
                adminService.getOverviewStats(),
                adminService.getUserStats(),
            ]);
            setOverview(ov);
            setStats(us);
        } catch {
            setError('Không có quyền truy cập hoặc không kết nối được server.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const filtered = (stats?.users ?? [])
        .filter(u => {
            const q = search.toLowerCase();
            return (u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                && (roleFilter === 'all' || u.role === roleFilter);
        })
        .sort((a, b) => {
            const av = String(a[sortKey]), bv = String(b[sortKey]);
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });

    const SortIcon = ({ col }: { col: SortKey }) => (
        sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />)
            : <ChevronDown className="w-3.5 h-3.5 inline ml-1 opacity-20" />
    );

    if (loading) return (
        <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)] text-sm">Đang tải dữ liệu...</p>
            </div>
        </div>
    );

    const ov = overview;

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Ambient */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/15 blur-[140px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">Thống kê hệ thống</h2>
                        <p className="text-sm text-[var(--text-secondary)]">Tổng quan toàn bộ nền tảng</p>
                    </div>
                    <button onClick={fetchAll}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] transition-colors">
                        <RefreshCw className="w-4 h-4" />
                        Làm mới
                    </button>
                </div>

                {error && (
                    <div className="px-5 py-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {ov && <>
                    {/* ── Row 1: Key metrics ─────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <StatCard icon={Users}      label="Tổng users"    value={ov.totalUsers}    color="border-[var(--border-color)] text-[var(--text-primary)]"  iconColor="bg-[var(--text-primary)]/8" />
                        <StatCard icon={FileText}   label="Dự án"         value={ov.totalProjects} color="border-indigo-500/20 text-indigo-300"   iconColor="bg-indigo-500/10" />
                        <StatCard icon={BookOpen}   label="Chương"        value={ov.totalChapters} color="border-sky-500/20 text-sky-300"         iconColor="bg-sky-500/10" />
                        <StatCard icon={AlignLeft}  label="Tổng từ"       value={fmtTokens(ov.totalWordCount)} color="border-emerald-500/20 text-emerald-300" iconColor="bg-emerald-500/10" />
                        <StatCard icon={Sparkles}   label="AI tokens dùng" value={fmtTokens(ov.totalAiTokens)} color="border-purple-500/20 text-purple-300" iconColor="bg-purple-500/10" />
                    </div>

                    {/* ── Row 2: Four sections ───────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                        {/* Users */}
                        <Section title="Người dùng" icon={Users}>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[var(--text-secondary)] text-sm">Đang hoạt động</span>
                                    <span className="font-bold text-emerald-400">{fmtNum(ov.activeUsers)}</span>
                                </div>
                                <MiniBar label="Tác giả"  value={ov.totalAuthors} total={ov.totalUsers} color="bg-indigo-500" />
                                <MiniBar label="Nhân viên" value={ov.totalStaff}   total={ov.totalUsers} color="bg-amber-500" />
                                <MiniBar label="Admin"    value={ov.totalAdmins}  total={ov.totalUsers} color="bg-rose-500" />
                                <div className="pt-2 border-t border-[var(--border-color)] flex gap-4">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-sky-400">{fmtNum(ov.newUsersLast7Days)}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">7 ngày qua</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-sky-300">{fmtNum(ov.newUsersLast30Days)}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">30 ngày qua</p>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Content */}
                        <Section title="Nội dung" icon={Globe}>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--text-secondary)]">Nhân vật</span>
                                    <span className="font-semibold">{fmtNum(ov.totalCharacters)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--text-secondary)]">Worldbuilding</span>
                                    <span className="font-semibold">{fmtNum(ov.totalWorldbuildingEntries)}</span>
                                </div>
                                <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">AI Chat msgs</span>
                                        <span className="font-semibold text-purple-400">{fmtNum(ov.totalAiChatMessages)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">Phân tích AI</span>
                                        <span className="font-semibold text-purple-400">{fmtNum(ov.totalAiAnalyses)}</span>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Subscriptions */}
                        <Section title="Gói đăng ký" icon={CreditCard}>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        Đang active
                                    </span>
                                    <span className="text-xl font-bold text-emerald-400">{fmtNum(ov.activeSubscriptions)}</span>
                                </div>
                                <MiniBar label="Hết hạn"  value={ov.expiredSubscriptions}   total={ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions} color="bg-amber-500" />
                                <MiniBar label="Đã huỷ"   value={ov.cancelledSubscriptions} total={ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions} color="bg-slate-500" />
                                <div className="pt-2 border-t border-[var(--border-color)]">
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Tổng: <span className="font-semibold text-[var(--text-primary)]">
                                            {fmtNum(ov.activeSubscriptions + ov.expiredSubscriptions + ov.cancelledSubscriptions)}
                                        </span> giao dịch
                                    </p>
                                </div>
                            </div>
                        </Section>

                        {/* Bug Reports */}
                        <Section title="Bug Reports" icon={Bug}>
                            <div className="space-y-3">
                                {ov.highPriorityOpenBugs > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold">
                                        ⚠️ {ov.highPriorityOpenBugs} bug ưu tiên cao chưa xử lý
                                    </div>
                                )}
                                <MiniBar label="Chờ xử lý"    value={ov.openBugReports}       total={ov.openBugReports + ov.inProgressBugReports + ov.resolvedBugReports} color="bg-sky-500" />
                                <MiniBar label="Đang xử lý"   value={ov.inProgressBugReports}  total={ov.openBugReports + ov.inProgressBugReports + ov.resolvedBugReports} color="bg-amber-500" />
                                <MiniBar label="Đã giải quyết" value={ov.resolvedBugReports}   total={ov.openBugReports + ov.inProgressBugReports + ov.resolvedBugReports} color="bg-emerald-500" />
                            </div>
                        </Section>
                    </div>

                    {/* ── Row 3: User stats cards ────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <StatCard icon={Users}     label="Tổng users"  value={ov.totalUsers}   sub={`${ov.activeUsers} đang hoạt động`}  color="border-[var(--border-color)] text-[var(--text-primary)]"  iconColor="bg-[var(--text-primary)]/8" />
                        <StatCard icon={UserCheck} label="Hoạt động"   value={ov.activeUsers}  color="border-emerald-500/20 text-emerald-400" iconColor="bg-emerald-500/10" />
                        <StatCard icon={UserX}     label="Tạm khoá"    value={ov.totalUsers - ov.activeUsers} color="border-rose-500/20 text-rose-400" iconColor="bg-rose-500/10" />
                        <StatCard icon={BookOpen}  label="Tác giả"     value={ov.totalAuthors} color="border-indigo-500/20 text-indigo-400" iconColor="bg-indigo-500/10" />
                        <StatCard icon={Briefcase} label="Nhân viên"   value={ov.totalStaff}   color="border-amber-500/20 text-amber-400"  iconColor="bg-amber-500/10" />
                        <StatCard icon={Shield}    label="Admin"       value={ov.totalAdmins}  color="border-rose-500/20 text-rose-400"   iconColor="bg-rose-500/10" />
                    </div>
                </>}

                {/* ── User Table ─────────────────────────────────────────── */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="font-semibold text-sm text-[var(--text-secondary)] flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Danh sách người dùng
                            <span className="px-2 py-0.5 bg-[var(--text-primary)]/10 rounded-full text-xs">{filtered.length}</span>
                        </h2>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                                className="bg-[var(--input-bg)] border border-[var(--border-color)] text-sm rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                                <option value="all">Tất cả</option>
                                <option value="Admin">Admin</option>
                                <option value="Author">Tác giả</option>
                                <option value="Staff">Nhân viên</option>
                            </select>
                            <div className="relative flex-1 sm:w-56">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                <input type="text" placeholder="Tìm tên, email..." value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                                    {(['fullName', 'email', 'role', 'createdAt'] as SortKey[]).map(col => (
                                        <th key={col} onClick={() => handleSort(col)}
                                            className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none">
                                            {{ fullName: 'Tên', email: 'Email', role: 'Role', createdAt: 'Ngày tạo' }[col]}
                                            <SortIcon col={col} />
                                        </th>
                                    ))}
                                    <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Không tìm thấy người dùng nào.</td></tr>
                                ) : filtered.map((user: UserSummary) => (
                                    <tr key={user.id} className="hover:bg-[var(--text-primary)]/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0 text-white">
                                                    {user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                                </div>
                                                <span className="font-medium text-[var(--text-primary)]">{user.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--text-secondary)]">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${roleStyle(user.role)}`}>
                                                {roleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--text-secondary)] text-xs">
                                            {new Date(user.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isActive
                                                ? <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Hoạt động</span>
                                                : <span className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />Tạm khoá</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
