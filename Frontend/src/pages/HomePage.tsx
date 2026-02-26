import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, FolderOpen, BarChart2, User, Settings,
    LogOut, Users, ShieldCheck, Bell, ChevronDown, Menu, X,
    Sparkles, BookOpen, MessageSquare, Lightbulb, TrendingUp
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';

// ── Role-based menu config ───────────────────────────────────────────────────
const NAV_AUTHOR = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

const NAV_STAFF = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'users', label: 'Người dùng', icon: Users, path: '/admin' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

const NAV_ADMIN = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'users', label: 'Người dùng', icon: Users, path: '/admin' },
    { key: 'admin', label: 'Quản trị', icon: ShieldCheck, path: '/admin' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

function getNav(role: string) {
    if (role === 'Admin') return NAV_ADMIN;
    if (role === 'Staff') return NAV_STAFF;
    return NAV_AUTHOR;
}

function getRoleBadge(role: string) {
    if (role === 'Admin') return { label: 'Admin', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' };
    if (role === 'Staff') return { label: 'Staff', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { label: 'Author', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' };
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ role, collapsed, onCollapse, onNavigate }: {
    role: string; collapsed: boolean; onCollapse: () => void; onNavigate: (path: string) => void;
}) {
    const nav = getNav(role);
    const location = useLocation();

    return (
        <aside
            className="flex flex-col h-full transition-all duration-300 overflow-hidden"
            style={{
                width: collapsed ? '68px' : '200px',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-color)',
                flexShrink: 0,
            }}
        >
            {/* Brand */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border-color)] min-h-[68px]">
                <img src="/logo.png" alt="StoryNest" className="h-8 w-8 shrink-0 object-contain" />
                {!collapsed && (
                    <div className="overflow-hidden">
                        <p className="text-[var(--text-primary)] font-bold text-sm leading-tight truncate">StoryNest</p>
                        <p className="text-[var(--text-secondary)] text-[10px] truncate">Analysis System</p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto py-4">
                {!collapsed && (
                    <p className="text-[var(--text-secondary)] opacity-50 text-[10px] font-semibold uppercase tracking-widest px-4 mb-2">Menu</p>
                )}
                <nav className="space-y-0.5 px-2">
                    {nav.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                            <button
                                key={item.key}
                                onClick={() => onNavigate(item.path)}
                                title={collapsed ? item.label : undefined}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${active
                                    ? 'text-[#f5a623] bg-[#f5a623]/10'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#f5a623]' : ''}`} />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                                {!collapsed && active && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f5a623]" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Help CTA */}
            {!collapsed && (
                <div className="px-3 pb-3">
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                        <p className="text-white text-xs font-semibold mb-0.5">Need Help?</p>
                        <p className="text-white/35 text-[10px] mb-3">Contact us for assistance.</p>
                        <button className="w-full py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-medium transition-colors">
                            Support Center
                        </button>
                    </div>
                </div>
            )}

            {/* Collapse toggle */}
            <div className="px-3 pb-4">
                <button
                    onClick={onCollapse}
                    className="w-full flex items-center justify-center py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all text-sm"
                >
                    {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    );
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ fullName, role, onLogout }: { fullName: string; role: string; onLogout: () => void }) {
    const [userOpen, setUserOpen] = useState(false);
    const initials = fullName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
    const badge = getRoleBadge(role);

    return (
        <header style={{ background: 'var(--bg-topbar)', borderBottom: '1px solid var(--border-color)' }}
            className="h-[68px] flex items-center px-6 gap-4 shrink-0 relative z-20">
            <h1 className="text-[var(--text-primary)] font-bold text-lg">Dashboard</h1>
            <div className="flex-1" />

            {/* Notification */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f5a623] rounded-full" />
            </button>

            {/* Settings */}
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <Settings className="w-4 h-4" />
            </button>

            {/* User menu */}
            <div className="relative">
                <button onClick={() => setUserOpen(o => !o)}
                    className="flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                        {initials}
                    </div>
                    <span className="text-[var(--text-primary)] text-sm font-medium max-w-[120px] truncate hidden sm:block">{fullName}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                </button>

                {userOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <div className="px-4 py-3 border-b border-[var(--border-color)]">
                            <p className="text-[var(--text-primary)] text-sm font-semibold truncate">{fullName}</p>
                            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                                {badge.label}
                            </span>
                        </div>
                        <button onClick={onLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <LogOut className="w-4 h-4" /> Đăng xuất
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

// ── Writing Tips ─────────────────────────────────────────────────────────────
const TIPS = [
    { title: 'Pacing', desc: 'Cân bằng nhịp độ giữa các cảnh hành động và cảnh nội tâm.' },
    { title: 'Show, don\'t Tell', desc: 'Diễn đạt cảm xúc qua hành động thay vì mô tả trực tiếp.' },
    { title: 'Conflict', desc: 'Mỗi chương cần có ít nhất một xung đột nhỏ thúc đẩy cốt truyện.' },
];

// ── Dashboard Content ─────────────────────────────────────────────────────────
function DashboardContent({ fullName, role, onNavigate }: { fullName: string; role: string; onNavigate: (path: string) => void }) {
    const [tipIdx] = useState(0);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Welcome Banner */}
            <div className="rounded-3xl p-7 flex items-center justify-between"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div>
                    <h2 className="text-[var(--text-primary)] font-bold text-xl mb-1">
                        Chào mừng, {fullName}! 👋
                    </h2>
                    <p className="text-[var(--text-secondary)] text-sm">
                        Bạn có 0 dự án đang thực hiện. Hãy tiếp tục sáng tạo và phát triển tác phẩm của bạn!
                    </p>
                </div>
                <button
                    onClick={() => onNavigate('/projects')}
                    className="hidden sm:flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shrink-0 ml-6"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                >
                    <FolderOpen className="w-4 h-4" />
                    Quản lý Dự án
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng Dự án', value: '0', icon: FolderOpen, color: '#6366f1' },
                    { label: 'Tổng Chương', value: '0', icon: BookOpen, color: '#8b5cf6' },
                    { label: 'Phân tích', value: '0', icon: TrendingUp, color: '#06b6d4' },
                    { label: 'AI Queries', value: '0', icon: MessageSquare, color: '#f5a623' },
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

            {/* Bottom 2-col */}
            <div className="grid lg:grid-cols-3 gap-4">
                {/* Recent Projects */}
                <div className="lg:col-span-2 rounded-2xl p-6"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[var(--text-primary)] font-semibold">Dự án Gần đây</h3>
                        <button onClick={() => onNavigate('/projects')}
                            className="text-xs text-[#f5a623] hover:text-[#f97316] transition-colors flex items-center gap-1">
                            Xem tất cả →
                        </button>
                    </div>

                    {/* Empty state */}
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
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    {/* Quick AI */}
                    <div className="rounded-2xl p-5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid rgba(245,166,35,0.3)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-[#f5a623]" />
                            <p className="text-[var(--text-primary)] font-semibold text-sm">Quick AI Query</p>
                        </div>
                        <p className="text-[var(--text-secondary)] text-xs mb-4 leading-relaxed">
                            Đặt câu hỏi về tác phẩm của bạn và nhận phân tích tức thì.
                        </p>
                        <button className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                            Bắt đầu Chat
                        </button>
                    </div>

                    {/* Writing tip */}
                    <div className="rounded-2xl p-5"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <p className="text-[var(--text-primary)] font-semibold text-sm">Mẹo Viết</p>
                        </div>
                        <div className="border-l-2 border-[#f5a623]/60 pl-3">
                            <p className="text-[#f5a623] text-xs font-semibold mb-1">{TIPS[tipIdx].title}</p>
                            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{TIPS[tipIdx].desc}</p>
                        </div>
                    </div>

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
    const [collapsed, setCollapsed] = useState(false);
    const [userInfo, setUserInfo] = useState({ fullName: 'Người dùng', role: 'Author' });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        setUserInfo(getUserInfo(token));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)]">
            <Sidebar
                role={userInfo.role}
                collapsed={collapsed}
                onCollapse={() => setCollapsed(c => !c)}
                onNavigate={navigate}
            />

            <div className="flex flex-col flex-1 min-w-0">
                <Topbar
                    fullName={userInfo.fullName}
                    role={userInfo.role}
                    onLogout={handleLogout}
                />
                <DashboardContent
                    fullName={userInfo.fullName}
                    role={userInfo.role}
                    onNavigate={navigate}
                />
            </div>
        </div>
    );
}
