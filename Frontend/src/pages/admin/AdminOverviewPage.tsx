import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Users, FileText, BookOpen, AlignLeft, Sparkles, CreditCard, Bug, Globe,
    RefreshCw, DollarSign, Settings2, ScrollText, Headphones, ChevronRight,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { adminService, type AdminOverviewStats } from '../../services/adminService';
import { AdminPageShell, StatCard, Section, MiniBar, fmtNum, fmtTokens } from '../../components/admin/AdminShared';

const QUICK_LINKS = [
    { to: '/admin/users', label: 'Người dùng', desc: 'CRUD, khoá/mở tài khoản', icon: Users, color: 'text-indigo-400' },
    { to: '/admin/revenue', label: 'Doanh thu', desc: 'Báo cáo thanh toán', icon: DollarSign, color: 'text-amber-400' },
    { to: '/admin/subscription', label: 'Gói dịch vụ', desc: 'Quản lý plans', icon: CreditCard, color: 'text-emerald-400' },
    { to: '/admin/system', label: 'Hệ thống', desc: 'RAG & giới hạn lưu trữ', icon: Settings2, color: 'text-violet-400' },
    { to: '/admin/logs', label: 'Nhật ký', desc: 'Audit log hệ thống', icon: ScrollText, color: 'text-sky-400' },
    { to: '/staff', label: 'Vận hành Staff', desc: 'Feedback, cờ dự án, báo lỗi…', icon: Headphones, color: 'text-rose-400' },
];

export default function AdminOverviewPage() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setOverview(await adminService.getOverviewStats());
        } catch {
            setError('Không tải được thống kê.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate]);

    const ov = overview;

    return (
        <MainLayout pageTitle="Admin">
            {() => (
                <AdminPageShell
                    title="Tổng quan Admin"
                    subtitle="Quản trị nền tảng — chọn mục bên dưới"
                    action={
                        <button type="button" onClick={() => void load()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm">
                            <RefreshCw className="w-4 h-4" /> Làm mới
                        </button>
                    }
                >
                    {error && <p className="text-rose-400 text-sm">{error}</p>}
                    {loading && !ov ? <p className="text-[var(--text-secondary)] text-sm">Đang tải…</p> : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {QUICK_LINKS.map(l => (
                            <Link key={l.to} to={l.to}
                                className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-indigo-500/40 transition-colors group">
                                <l.icon className={`w-8 h-8 shrink-0 ${l.color}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-[var(--text-primary)]">{l.label}</p>
                                    <p className="text-xs text-[var(--text-secondary)]">{l.desc}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-indigo-400" />
                            </Link>
                        ))}
                    </div>

                    {ov && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <StatCard icon={Users} label="Users" value={ov.totalUsers} color="border-[var(--border-color)] text-[var(--text-primary)]" iconColor="bg-[var(--text-primary)]/8" />
                                <StatCard icon={FileText} label="Dự án" value={ov.totalProjects} color="border-indigo-500/20 text-indigo-300" iconColor="bg-indigo-500/10" />
                                <StatCard icon={BookOpen} label="Chương" value={ov.totalChapters} color="border-sky-500/20 text-sky-300" iconColor="bg-sky-500/10" />
                                <StatCard icon={AlignLeft} label="Tổng từ" value={fmtTokens(ov.totalWordCount)} color="border-emerald-500/20 text-emerald-300" iconColor="bg-emerald-500/10" />
                                <StatCard icon={Sparkles} label="AI tokens" value={fmtTokens(ov.totalAiTokens)} color="border-purple-500/20 text-purple-300" iconColor="bg-purple-500/10" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <Section title="Người dùng" icon={Users}>
                                    <MiniBar label="Tác giả" value={ov.totalAuthors} total={ov.totalUsers} color="bg-indigo-500" />
                                    <MiniBar label="Staff" value={ov.totalStaff} total={ov.totalUsers} color="bg-amber-500" />
                                    <MiniBar label="Admin" value={ov.totalAdmins} total={ov.totalUsers} color="bg-rose-500" />
                                </Section>
                                <Section title="Nội dung" icon={Globe}>
                                    <p className="text-sm flex justify-between"><span className="text-[var(--text-secondary)]">Nhân vật</span><span>{fmtNum(ov.totalCharacters)}</span></p>
                                    <p className="text-sm flex justify-between"><span className="text-[var(--text-secondary)]">AI Chat</span><span>{fmtNum(ov.totalAiChatMessages)}</span></p>
                                </Section>
                                <Section title="Gói đăng ký" icon={CreditCard}>
                                    <p className="text-2xl font-bold text-emerald-400">{fmtNum(ov.activeSubscriptions)} <span className="text-sm font-normal text-[var(--text-secondary)]">active</span></p>
                                </Section>
                                <Section title="Bug Reports" icon={Bug}>
                                    <MiniBar label="Chờ" value={ov.openBugReports} total={ov.openBugReports + ov.inProgressBugReports + ov.resolvedBugReports} color="bg-sky-500" />
                                    <MiniBar label="Đã xử lý" value={ov.resolvedBugReports} total={ov.openBugReports + ov.inProgressBugReports + ov.resolvedBugReports} color="bg-emerald-500" />
                                </Section>
                            </div>
                        </>
                    )}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
