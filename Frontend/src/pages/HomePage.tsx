import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, FolderOpen, BookOpen, MessageSquare, TrendingUp, ShieldCheck
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';
import MyProjectsSection, { ProjectStats } from '../components/home/MyProjectsSection';

function DashboardContent({ fullName, role, onNavigate }: { fullName: string; role: string; onNavigate: (path: string) => void }) {
    const canManageProjects = role !== 'Admin';
    const [projectCount, setProjectCount] = useState(0);
    const [stats, setStats] = useState<ProjectStats>({
        totalChapters: 0,
        totalAnalysesUsed: 0,
        totalChatMessages: 0,
    });
    const [createRequestToken, setCreateRequestToken] = useState(0);

    const handleProjectDataChange = useCallback((data: { projectCount: number; stats: ProjectStats }) => {
        setProjectCount(data.projectCount);
        setStats(data.stats);
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="rounded-3xl p-7 flex items-center justify-between"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div>
                    <h2 className="text-[var(--text-primary)] font-bold text-xl mb-1">Chào mừng, {fullName}! 👋</h2>
                    <p className="text-[var(--text-secondary)] text-sm">
                        {canManageProjects
                            ? projectCount > 0
                                ? `Bạn có ${projectCount} dự án đang thực hiện. Hãy tiếp tục sáng tạo!`
                                : 'Bạn chưa có dự án nào. Bắt đầu ý tưởng mới ngay hôm nay!'
                            : 'Theo dõi hoạt động hệ thống và quản lý người dùng từ dashboard.'}
                    </p>
                </div>
                <button
                    onClick={() => canManageProjects ? setCreateRequestToken(t => t + 1) : onNavigate('/admin')}
                    className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shrink-0 ml-6"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                >
                    {role === 'Admin' ? <ShieldCheck className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {role === 'Admin' ? 'Admin Panel' : 'Tạo dự án mới'}
                </button>
            </div>

            {canManageProjects && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Tổng Dự án', value: projectCount.toString(), icon: FolderOpen, color: '#6366f1' },
                        { label: 'Tổng Chương', value: stats.totalChapters.toString(), icon: BookOpen, color: '#8b5cf6' },
                        { label: 'Phân tích', value: stats.totalAnalysesUsed.toString(), icon: TrendingUp, color: '#06b6d4' },
                        { label: 'AI Queries', value: stats.totalChatMessages.toString(), icon: MessageSquare, color: '#f5a623' },
                    ].map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="rounded-2xl p-5 flex items-center gap-4"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.color}20` }}>
                                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                                </div>
                                <div>
                                    <p className="text-[var(--text-secondary)] text-xs mb-0.5">{s.label}</p>
                                    <p className="text-[var(--text-primary)] font-bold text-xl">{s.value}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {canManageProjects && (
                <MyProjectsSection
                    onNavigate={onNavigate}
                    createRequestToken={createRequestToken}
                    onProjectDataChange={handleProjectDataChange}
                />
            )}

            {(role === 'Admin' || role === 'Staff') && (
                <button onClick={() => onNavigate('/admin')}
                    className="w-full rounded-2xl p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                        <p className="text-[var(--text-primary)] font-semibold text-sm">
                            {role === 'Admin' ? 'Admin Panel' : 'User Management'}
                        </p>
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs">Quản lý người dùng & thống kê hệ thống</p>
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
