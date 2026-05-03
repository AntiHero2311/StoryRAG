import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, UserX, Shield, BookOpen, Briefcase,
    RefreshCw, Search, ChevronUp, ChevronDown,
    FileText, AlignLeft, Sparkles,
    CreditCard, Bug, Globe, DollarSign, Settings2, Save, Loader2, CheckCircle2,
} from 'lucide-react';
import { adminService, UserSummary, UserStatsResponse, AdminOverviewStats } from '../services/adminService';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';

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

function fmtCurrency(n: number | undefined) {
    return (n ?? 0).toLocaleString('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    });
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

// ── RAG Config Panel ──────────────────────────────────────────────────────

type RagConfig = {
    chunk_size: number;
    chunk_overlap: number;
    top_k_chat: number;
    top_k_report: number;
    splitter: string;
};

function RagConfigPanel() {
    const [config, setConfig] = useState<RagConfig>({
        chunk_size: 800, chunk_overlap: 100, top_k_chat: 5, top_k_report: 8, splitter: 'paragraph',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        api.get<RagConfig>('/admin/rag-config')
            .then(r => setConfig(r.data))
            .catch(() => setError('Không tải được cấu hình RAG.'))
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (field: keyof RagConfig, value: string | number) =>
        setConfig(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true); setError(null); setSaved(false);
        try {
            await api.put('/admin/rag-config', config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            const errs: string[] = e?.response?.data?.errors ?? [];
            setError(errs.length ? errs.join(' ') : (e?.response?.data?.message ?? 'Lưu thất bại.'));
        } finally {
            setSaving(false);
        }
    };

    const inputBase = [
        'w-full h-10 px-3 rounded-xl text-sm outline-none',
        'bg-[var(--bg-hover)] border border-[var(--border-color)]',
        'text-[var(--text-primary)] focus:border-indigo-500/60 transition-colors',
    ].join(' ');

    if (loading) return (
        <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải cấu hình...
        </div>
    );

    return (
        <div className="space-y-5">
            {error && (
                <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* chunk_size */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Chunk size <span className="normal-case font-normal">(100–4000)</span>
                    </label>
                    <input id="rag-chunk-size" type="number" min={100} max={4000} className={inputBase}
                        value={config.chunk_size} onChange={e => handleChange('chunk_size', Number(e.target.value))} />
                    <p className="text-[10px] text-[var(--text-secondary)]">Số ký tự mỗi chunk khi embed nội dung chương.</p>
                </div>

                {/* chunk_overlap */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Chunk overlap <span className="normal-case font-normal">(0–500)</span>
                    </label>
                    <input id="rag-chunk-overlap" type="number" min={0} max={500} className={inputBase}
                        value={config.chunk_overlap} onChange={e => handleChange('chunk_overlap', Number(e.target.value))} />
                    <p className="text-[10px] text-[var(--text-secondary)]">Số ký tự phần gọi nối giữa các chunk liên tiếp.</p>
                </div>

                {/* splitter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Splitter strategy
                    </label>
                    <select id="rag-splitter" className={inputBase}
                        value={config.splitter} onChange={e => handleChange('splitter', e.target.value)}>
                        <option value="paragraph">paragraph — đoạn văn</option>
                        <option value="sentence">sentence — câu</option>
                        <option value="fixed">fixed — cố định</option>
                    </select>
                    <p className="text-[10px] text-[var(--text-secondary)]">Chiến lược chia nhỏ nội dung trước khi embed.</p>
                </div>

                {/* top_k_chat */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Top-K Chat <span className="normal-case font-normal">(1–20)</span>
                    </label>
                    <input id="rag-top-k-chat" type="number" min={1} max={20} className={inputBase}
                        value={config.top_k_chat} onChange={e => handleChange('top_k_chat', Number(e.target.value))} />
                    <p className="text-[10px] text-[var(--text-secondary)]">Số chunk ngữ cảnh trả về cho chức năng AI Chat.</p>
                </div>

                {/* top_k_report */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Top-K Report <span className="normal-case font-normal">(1–20)</span>
                    </label>
                    <input id="rag-top-k-report" type="number" min={1} max={20} className={inputBase}
                        value={config.top_k_report} onChange={e => handleChange('top_k_report', Number(e.target.value))} />
                    <p className="text-[10px] text-[var(--text-secondary)]">Số chunk dùng để chấm điểm từng tiêu chí rubric (Stage 2 RAG).</p>
                </div>

            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    id="rag-config-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}
                >
                    {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                        : <><Save className="w-4 h-4" /> Lưu cấu hình</>
                    }
                </button>
                {saved && (
                    <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Đã lưu thành công!
                    </span>
                )}
            </div>
        </div>
    );
}

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
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.message
                ?? (err as { response?: { data?: { message?: string; Message?: string } } })?.response?.data?.Message
                ?? 'Không có quyền truy cập hoặc không kết nối được server.';
            setError(message);
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard icon={Users}      label="Tổng users"    value={ov.totalUsers}    color="border-[var(--border-color)] text-[var(--text-primary)]"  iconColor="bg-[var(--text-primary)]/8" />
                        <StatCard icon={FileText}   label="Dự án"         value={ov.totalProjects} color="border-indigo-500/20 text-indigo-300"   iconColor="bg-indigo-500/10" />
                        <StatCard icon={BookOpen}   label="Chương"        value={ov.totalChapters} color="border-sky-500/20 text-sky-300"         iconColor="bg-sky-500/10" />
                        <StatCard icon={AlignLeft}  label="Tổng từ"       value={fmtTokens(ov.totalWordCount)} color="border-emerald-500/20 text-emerald-300" iconColor="bg-emerald-500/10" />
                        <StatCard icon={Sparkles}   label="AI tokens dùng" value={fmtTokens(ov.totalAiTokens)} color="border-purple-500/20 text-purple-300" iconColor="bg-purple-500/10" />
                        <StatCard icon={DollarSign} label="Doanh thu"      value={fmtCurrency(ov.totalRevenue)} color="border-amber-500/20 text-amber-300" iconColor="bg-amber-500/10" />
                    </div>

                    {/* ── Row 2: Five sections ───────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

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

                        {/* Revenue */}
                        <Section title="Doanh thu" icon={DollarSign}>
                            <div className="space-y-3">
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3">
                                    <p className="text-xs text-amber-200/80">Tổng doanh thu</p>
                                    <p className="text-xl font-bold text-amber-300 mt-1">{fmtCurrency(ov.totalRevenue)}</p>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">30 ngày gần nhất</span>
                                        <span className="font-semibold text-amber-300">{fmtCurrency(ov.revenueLast30Days)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">7 ngày gần nhất</span>
                                        <span className="font-semibold text-amber-300">{fmtCurrency(ov.revenueLast7Days)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--text-secondary)]">Đơn thành công</span>
                                        <span className="font-semibold text-[var(--text-primary)]">{fmtNum(ov.successfulPayments)}</span>
                                    </div>
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

                {/* ── RAG Configuration ───────────────────────────────── */}
                <div
                    className="bg-[var(--bg-surface)] border border-indigo-500/20 rounded-3xl overflow-hidden"
                    style={{ boxShadow: '0 0 40px rgba(99,102,241,0.06)' }}
                >
                    <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))' }}>
                            <Settings2 className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-sm text-[var(--text-primary)]">Cấu hình RAG</h2>
                            <p className="text-xs text-[var(--text-secondary)]">Điều chỉnh tham số chunking và retrieval — áp dụng ngay, không cần restart server.</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <RagConfigPanel />
                    </div>
                </div>

            </main>

        </div>
    );
}

// ── Inject RAG Config into the dashboard layout ────────────────────────
