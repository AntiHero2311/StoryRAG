import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen, MessageSquare, TrendingUp, Loader2, FolderOpen, ChevronDown,
    ShieldCheck
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { projectService, ProjectResponse } from '../services/projectService';
import { UserInfo } from '../utils/jwtHelper';



// ── Project Card (Mini) for Dashboard ────────────────────────────────────────
function MiniProjectCard({ project, onClick }: { project: ProjectResponse; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-left"
        >
            <div className="w-10 h-14 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[var(--text-primary)] font-semibold text-sm truncate mb-0.5">{project.title}</p>
                <p className="text-[var(--text-secondary)] text-[10px] opacity-50">
                    {new Date(project.createdAt).toLocaleDateString()} • {project.status}
                </p>
            </div>
            <div className="text-[var(--text-secondary)] opacity-30">
                <ChevronDown className="-rotate-90 w-4 h-4" />
            </div>
        </button>
    );
}

// ── Dashboard Content ─────────────────────────────────────────────────────────
function DashboardContent({ fullName, role, onNavigate }: { fullName: string; role: string; onNavigate: (path: string) => void }) {
    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        projectService.getProjects().then(data => {
            setProjects(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const recentProjects = [...projects].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 3);

    return (
        <div className="p-6 space-y-6">
            {/* Welcome Banner */}
            <div className="rounded-3xl p-7 flex items-center justify-between"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div>
                    <h2 className="text-[var(--text-primary)] font-bold text-xl mb-1">
                        Chào mừng, {fullName}! 👋
                    </h2>
                    <p className="text-[var(--text-secondary)] text-sm">
                        {projects.length > 0
                            ? `Bạn có ${projects.length} dự án đang thực hiện. Hãy tiếp tục sáng tạo!`
                            : "Bạn chưa có dự án nào. Bắt đầu ý tưởng mới ngay hôm nay!"}
                    </p>
                </div>
                <button
                    onClick={() => onNavigate(role === 'Admin' ? '/admin' : '/projects')}
                    className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shrink-0 ml-6"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                >
                    {role === 'Admin' ? <ShieldCheck className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                    {role === 'Admin' ? 'Admin Panel' : 'Quản lý Dự án'}
                </button>
            </div>

            {/* Stats row */}
            {role !== 'Admin' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Tổng Dự án', value: projects.length.toString(), icon: FolderOpen, color: '#6366f1' },
                        { label: 'Tổng Chương', value: '—', icon: BookOpen, color: '#8b5cf6' },
                        { label: 'Phân tích', value: 'Phase 2', icon: TrendingUp, color: '#06b6d4' },
                        { label: 'AI Queries', value: 'Phase 2', icon: MessageSquare, color: '#f5a623' },
                    ].map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="rounded-2xl p-5 flex items-center gap-4"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${s.color}20` }}>
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

            {/* Bottom 2-col */}
            <div className={`grid ${role === 'Admin' ? 'grid-cols-1' : 'lg:grid-cols-3'} gap-4`}>
                {/* Recent Projects */}
                {role !== 'Admin' && (
                    <div className="lg:col-span-2 rounded-2xl p-6"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[var(--text-primary)] font-semibold">Dự án Gần đây</h3>
                            <button onClick={() => onNavigate('/projects')}
                                className="text-xs text-[#f5a623] hover:text-[#f97316] transition-colors flex items-center gap-1">
                                Xem tất cả →
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
                            </div>
                        ) : projects.length > 0 ? (
                            <div className="grid gap-3">
                                {recentProjects.map(p => (
                                    <MiniProjectCard key={p.id} project={p} onClick={() => onNavigate(`/workspace/${p.id}`)} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--text-primary)]/5 flex items-center justify-center">
                                    <FolderOpen className="w-7 h-7 text-[var(--text-secondary)] opacity-30" />
                                </div>
                                <p className="text-[var(--text-secondary)] text-sm">Chưa có dự án nào</p>
                                <button
                                    onClick={() => onNavigate('/projects')}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all">
                                    Tạo dự án mới
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Right column */}
                <div className="space-y-4">

                    {/* Admin panel shortcut */}
                    {(role === 'Admin' || role === 'Staff') && (
                        <button onClick={() => onNavigate('/admin')}
                            className="w-full rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
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
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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
