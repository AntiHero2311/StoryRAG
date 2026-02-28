import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    LayoutDashboard, FolderOpen, BarChart2, User, Settings,
    Users, CreditCard, ChevronLeft, ChevronRight,
} from 'lucide-react';

const NAV_AUTHOR = [
    { key: 'dashboard', label: 'Trang chủ', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'subscription', label: 'Gói dịch vụ', icon: CreditCard, path: '/subscription' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

const NAV_STAFF = [
    { key: 'dashboard', label: 'Trang chủ', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'subscription', label: 'Gói dịch vụ', icon: CreditCard, path: '/subscription' },
    { key: 'users', label: 'Người dùng', icon: Users, path: '/admin' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

const NAV_ADMIN = [
    { key: 'dashboard', label: 'Trang chủ', icon: LayoutDashboard, path: '/home' },
    { key: 'projects', label: 'Dự án', icon: FolderOpen, path: '/projects' },
    { key: 'analysis', label: 'Phân tích', icon: BarChart2, path: '/analysis' },
    { key: 'users', label: 'Người dùng', icon: Users, path: '/admin' },
    { key: 'sub-admin', label: 'Quản lý Plans', icon: CreditCard, path: '/admin/subscription' },
    { key: 'profile', label: 'Hồ sơ', icon: User, path: '/profile' },
    { key: 'settings', label: 'Cài đặt', icon: Settings, path: '/settings' },
];

function getNav(role: string) {
    if (role === 'Admin') return NAV_ADMIN;
    if (role === 'Staff') return NAV_STAFF;
    return NAV_AUTHOR;
}

interface SidebarProps {
    role: string;
    onNavigate: (path: string) => void;
}

export default function Sidebar({ role, onNavigate }: SidebarProps) {
    const nav = getNav(role);
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className="relative flex flex-col h-full transition-all duration-300 shrink-0"
            style={{
                width: collapsed ? '64px' : '200px',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-color)',
            }}
        >
            {/* Inner wrapper clips content during collapse animation */}
            <div className="relative flex flex-col h-full overflow-hidden">
                {/* Brand */}
                <button
                    onClick={() => onNavigate('/home')}
                    title="Về trang chủ"
                    className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border-color)] min-h-[68px] overflow-hidden w-full text-left hover:bg-[var(--text-primary)]/5 transition-colors"
                >
                    <img src="/logo.png" alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
                    {!collapsed && (
                        <div className="overflow-hidden flex-1">
                            <span className="text-[var(--text-primary)] font-bold text-sm truncate block">StoryNest</span>
                            <p className="text-[var(--text-secondary)] text-[10px] truncate opacity-50">Analysis System</p>
                        </div>
                    )}
                </button>

                <div className="flex-1 overflow-y-auto py-2">
                    {!collapsed && (
                        <p className="text-[var(--text-secondary)] opacity-40 text-[10px] font-semibold uppercase tracking-widest px-4 mb-2">Menu</p>
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
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${active
                                        ? 'text-[#f5a623] bg-[#f5a623]/10'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#f5a623]' : ''}`} />
                                    {!collapsed && (
                                        <>
                                            <span className="truncate">{item.label}</span>
                                            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f5a623]" />}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Support section - hidden when collapsed */}
                {!collapsed && (
                    <div className="px-3 pb-5">
                        <div className="bg-[#f5a623]/5 border border-[#f5a623]/15 rounded-2xl p-3.5">
                            <p className="text-[var(--text-primary)] text-xs font-semibold mb-0.5">Cần hỗ trợ?</p>
                            <p className="text-[var(--text-secondary)] text-[10px] mb-3 opacity-70">Liên hệ với chúng tôi.</p>
                            <button className="w-full py-1.5 rounded-xl bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#f5a623] text-xs font-medium transition-colors border border-[#f5a623]/20">
                                Trung tâm hỗ trợ
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Collapse toggle button — outside overflow-hidden wrapper so it's never clipped */}
            <button
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? 'Mở rộng' : 'Thu nhỏ'}
                className="absolute top-[72px] -right-3 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#f5a623]/50 shadow-sm transition-all"
            >
                {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>
        </aside>
    );
}
