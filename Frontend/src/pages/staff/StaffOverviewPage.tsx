import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, MessageSquare, Activity,
    CircleHelp, Bug, RefreshCw, ChevronRight, BarChart2,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { AdminPageShell, StatCard } from '../../components/admin/AdminShared';
import { staffService } from '../../services/staffService';
import { analysisJobService } from '../../services/analysisJobService';
import { bugReportService } from '../../services/bugReportService';

type HubStats = {
    pendingReports: number;
    openFeedbacks: number;
    failedJobs: number;
    openBugs: number;
};

const QUICK_LINKS = [
    { to: '/staff/analyses', label: 'Kết quả phân tích', icon: BarChart2, color: 'text-indigo-400', statKey: 'pendingReports' as const },
    { to: '/staff/analysis-jobs', label: 'Phân tích AI', icon: Activity, color: 'text-violet-400', statKey: 'failedJobs' as const },
    { to: '/staff/feedbacks', label: 'Phản hồi tác giả', icon: MessageSquare, color: 'text-indigo-400', statKey: 'openFeedbacks' as const },
    { to: '/staff/content?tab=faq', label: 'Nội dung trợ giúp', icon: CircleHelp, color: 'text-emerald-400' },
    { to: '/staff/bugs', label: 'Báo cáo lỗi app', icon: Bug, color: 'text-orange-400', statKey: 'openBugs' as const },
];

export default function StaffOverviewPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<HubStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [perf, jobs, bugs, pendingReportsRes] = await Promise.all([
                staffService.getPerformance(),
                analysisJobService.getAnalysisJobs('failed,stale'),
                bugReportService.getStats(),
                analysisJobService.getPendingReports(1, 1, 'Pending'),
            ]);
            setStats({
                pendingReports: pendingReportsRes.totalCount ?? 0,
                openFeedbacks: perf.openFeedbacksAssigned,
                failedJobs: jobs.length,
                openBugs: bugs.open + bugs.inProgress,
            });
        } catch {
            setError('Không tải được tổng quan vận hành.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate]);

    return (
        <MainLayout pageTitle="Vận hành">
            {() => (
                <AdminPageShell
                    title="Tổng quan Staff"
                    action={
                        <button type="button" onClick={() => void load()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                        </button>
                    }
                >
                    {error && <p className="text-rose-400 text-sm">{error}</p>}

                    {stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <StatCard icon={Activity} label="Job lỗi/treo" value={stats.failedJobs} color="border-violet-500/25 text-violet-300" iconColor="bg-violet-500/10" />
                            <StatCard icon={MessageSquare} label="Feedback mở" value={stats.openFeedbacks} color="border-sky-500/25 text-sky-300" iconColor="bg-sky-500/10" />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {QUICK_LINKS.map(l => {
                            const badge = l.statKey && stats ? stats[l.statKey] : null;
                            return (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-amber-500/35 transition-colors group"
                                >
                                    <l.icon className={`w-8 h-8 shrink-0 ${l.color}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                            {l.label}
                                            {badge != null && badge > 0 && (
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{badge}</span>
                                            )}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-amber-400" />
                                </Link>
                            );
                        })}
                    </div>

                    <Link
                        to="/staff/performance"
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/30"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Xem KPI cá nhân
                    </Link>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
