import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FolderOpen, BookOpen, TrendingUp, ShieldCheck, ArrowRight
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';
import MyProjectsSection, { ProjectStats } from '../components/home/MyProjectsSection';

function StatCard({ label, value, icon: Icon, color, delay = 0 }: {
    label: string; value: string; icon: typeof FolderOpen;
    color: string; delay?: number;
}) {
    return (
        <div
            className="rounded-2xl p-5 flex items-center gap-4 animate-slide-up group transition-all duration-200 hover:-translate-y-0.5"
            style={{
                animationDelay: `${delay}ms`,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
        >
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${color}18` }}
            >
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="font-black text-2xl leading-none" style={{ color: 'var(--text-bright)' }}>{value}</p>
            </div>
        </div>
    );
}

function DashboardContent({ fullName, role, onNavigate }: {
    fullName: string; role: string; onNavigate: (path: string) => void
}) {
    const showAuthorProjectDashboard = role === 'Author';
    const [projectCount, setProjectCount] = useState(0);
    const [stats, setStats] = useState<ProjectStats>({
        totalChapters: 0,
        totalAnalysesUsed: 0,
        totalChatMessages: 0,
    });

    const handleProjectDataChange = useCallback((data: { projectCount: number; stats: ProjectStats }) => {
        setProjectCount(data.projectCount);
        setStats(data.stats);
    }, []);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Chào buổi sáng';
        if (h < 18) return 'Chào buổi chiều';
        return 'Chào buổi tối';
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

            {/* ── Welcome Banner ── */}
            <div
                className="relative rounded-3xl p-6 overflow-hidden animate-fade-in"
                style={{
                    background: 'linear-gradient(135deg, rgba(79,70,229,0.18) 0%, rgba(124,58,237,0.12) 50%, rgba(168,85,247,0.08) 100%)',
                    border: '1px solid rgba(99,102,241,0.2)',
                }}
            >
                {/* Background orb */}
                <div
                    className="pointer-events-none absolute -right-16 -top-16 w-48 h-48 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)', filter: 'blur(32px)' }}
                />
                <div className="relative">
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-text)' }}>
                        {greeting()}
                    </p>
                    <h2 className="font-black text-xl mb-1" style={{ color: 'var(--text-bright)' }}>
                        {fullName} 👋
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {showAuthorProjectDashboard
                            ? projectCount > 0
                                ? `Bạn có ${projectCount} dự án đang thực hiện. Hãy tiếp tục sáng tạo!`
                                : 'Bạn chưa có dự án nào. Bắt đầu ý tưởng mới ngay hôm nay!'
                            : role === 'Staff'
                                ? 'Dùng menu bên trái để xem dự án bị cờ, xử lý báo cáo lỗi và hỗ trợ hệ thống.'
                                : 'Theo dõi hoạt động hệ thống và quản lý người dùng từ dashboard.'}
                    </p>
                </div>
            </div>

            {/* ── Stats Grid ── */}
            {showAuthorProjectDashboard && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="Tổng Dự án"  value={projectCount.toString()}              icon={FolderOpen}    color="#6366f1" delay={0}   />
                    <StatCard label="Tổng Chương" value={stats.totalChapters.toString()}       icon={BookOpen}      color="#8b5cf6" delay={50}  />
                    <StatCard label="Phân tích"   value={stats.totalAnalysesUsed.toString()}   icon={TrendingUp}    color="#06b6d4" delay={100} />
                </div>
            )}

            {/* ── Projects Section ── */}
            {showAuthorProjectDashboard && (
                <MyProjectsSection
                    onNavigate={onNavigate}
                    createRequestToken={0}
                    onProjectDataChange={handleProjectDataChange}
                />
            )}

            {/* ── Admin / Staff panel ── */}
            {(role === 'Admin' || role === 'Staff') && (
                <button
                    onClick={() => onNavigate(role === 'Admin' ? '/admin' : '/staff')}
                    className="w-full rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 group"
                    style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.03))',
                        border: '1px solid rgba(239,68,68,0.2)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.2)'; }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                                <ShieldCheck className="w-4 h-4 text-rose-400" />
                            </div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-bright)' }}>
                                {role === 'Admin' ? 'Admin Panel' : 'Staff Panel'}
                            </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-rose-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
            )}
        </div>
    );
}

export default function HomePage() {
    const navigate = useNavigate();
    return (
        <MainLayout pageTitle="Trang chủ">
            {(userInfo: UserInfo) => (
                <DashboardContent
                    fullName={userInfo.fullName}
                    role={userInfo.role}
                    onNavigate={navigate}
                />
            )}
        </MainLayout>
    );
}
