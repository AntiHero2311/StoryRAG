import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BarChart2, User, Settings,
    Users, CreditCard, ChevronLeft, ChevronRight,
    Bug, HelpCircle, BookOpen,
} from 'lucide-react';

const NAV_AUTHOR = [
    { key: 'dashboard',    label: 'Trang chủ',  icon: LayoutDashboard, path: '/home' },
    { key: 'analysis',     label: 'Phân tích',  icon: BarChart2,       path: '/analysis' },
    { key: 'subscription', label: 'Gói dịch vụ',icon: CreditCard,      path: '/subscription' },
    { key: 'profile',      label: 'Hồ sơ',      icon: User,            path: '/profile' },
    { key: 'settings',     label: 'Cài đặt',    icon: Settings,        path: '/settings' },
];

const NAV_STAFF = [
    { key: 'dashboard',    label: 'Trang chủ',  icon: LayoutDashboard, path: '/home' },
    { key: 'staff',        label: 'Báo cáo lỗi',icon: Bug,             path: '/staff' },
    { key: 'subscription', label: 'Gói dịch vụ',icon: CreditCard,      path: '/subscription' },
    { key: 'profile',      label: 'Hồ sơ',      icon: User,            path: '/profile' },
    { key: 'settings',     label: 'Cài đặt',    icon: Settings,        path: '/settings' },
];

const NAV_ADMIN = [
    { key: 'dashboard',    label: 'Trang chủ',  icon: LayoutDashboard, path: '/home' },
    { key: 'users',        label: 'Người dùng', icon: Users,           path: '/admin' },
    { key: 'staff',        label: 'Báo cáo lỗi',icon: Bug,             path: '/staff' },
    { key: 'sub-admin',    label: 'Quản lý Plans',icon: CreditCard,    path: '/admin/subscription' },
    { key: 'profile',      label: 'Hồ sơ',      icon: User,            path: '/profile' },
    { key: 'settings',     label: 'Cài đặt',    icon: Settings,        path: '/settings' },
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
            className="relative flex flex-col h-full shrink-0 transition-[width] duration-300 ease-in-out"
            style={{
                width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-color)',
            }}
        >
            {/* Subtle glow accent on left edge */}
            <div className="pointer-events-none absolute left-0 top-1/4 w-px h-1/2 opacity-40"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.5), transparent)' }}
            />

            <div className="relative flex flex-col h-full overflow-hidden">
                {/* ── Brand ── */}
                <button
                    onClick={() => onNavigate('/home')}
                    title="Về trang chủ"
                    className="flex items-center gap-3 px-3 py-4 min-h-[var(--topbar-height)] overflow-hidden w-full text-left transition-colors duration-150 hover:bg-[var(--bg-hover)] shrink-0"
                    style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                    {/* Logo with glow */}
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 rounded-xl blur-lg opacity-50"
                            style={{ background: 'var(--gradient-brand)' }}
                        />
                        <div className="relative w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--gradient-brand)' }}
                        >
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    {!collapsed && (
                        <div className="overflow-hidden flex-1 min-w-0">
                            <span
                                className="block font-black text-sm leading-tight truncate"
                                style={{ color: 'var(--text-bright)' }}
                            >
                                StoryNest
                            </span>
                            <p
                                className="text-[10px] truncate mt-0.5"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                AI Writing Platform
                            </p>
                        </div>
                    )}
                </button>

                {/* ── Navigation ── */}
                <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
                    {!collapsed && (
                        <p
                            className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            Menu
                        </p>
                    )}
                    <nav className="space-y-0.5 px-2">
                        {nav.map(item => {
                            const Icon = item.icon;
                            const active = location.pathname === item.path ||
                                (item.path !== '/home' && location.pathname.startsWith(item.path));

                            return (
                                <button
                                    key={item.key}
                                    onClick={() => onNavigate(item.path)}
                                    title={collapsed ? item.label : undefined}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group"
                                    style={active ? {
                                        background: 'var(--bg-active)',
                                        color: 'var(--accent-text)',
                                    } : {
                                        color: 'var(--text-secondary)',
                                    }}
                                    onMouseEnter={e => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.background = '';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                        }
                                    }}
                                >
                                    {/* Active indicator bar */}
                                    {active && (
                                        <div
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                                            style={{ background: 'var(--gradient-brand)' }}
                                        />
                                    )}

                                    <Icon
                                        className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110"
                                        style={active ? { color: 'var(--accent-text)' } : undefined}
                                    />

                                    {!collapsed && (
                                        <>
                                            <span className="truncate flex-1 text-left">{item.label}</span>
                                            {active && (
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ background: 'var(--accent)' }}
                                                />
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* ── Help card (only when expanded) ── */}
                {!collapsed && (
                    <div className="px-3 pb-4 shrink-0">
                        <div
                            className="rounded-2xl p-3.5"
                            style={{
                                background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))',
                                border: '1px solid rgba(99,102,241,0.18)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <HelpCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                                <p className="text-xs font-bold" style={{ color: 'var(--text-bright)' }}>
                                    Cần hỗ trợ?
                                </p>
                            </div>
                            <p className="text-[10px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
                                Liên hệ với chúng tôi qua trung tâm hỗ trợ.
                            </p>
                            <button
                                className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:opacity-90"
                                style={{
                                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                    color: '#ffffff',
                                }}
                            >
                                Trung tâm hỗ trợ
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Collapse Toggle ── */}
            <button
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? 'Mở rộng' : 'Thu nhỏ'}
                className="absolute top-[76px] -right-3 z-20 w-6 h-6 flex items-center justify-center rounded-full shadow-lg transition-all duration-150 hover:scale-110"
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                }}
            >
                {collapsed
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronLeft  className="w-3 h-3" />
                }
            </button>
        </aside>
    );
}
