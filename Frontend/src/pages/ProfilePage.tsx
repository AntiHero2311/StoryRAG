import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, FolderOpen, BarChart2, User, Settings,
    Users, ShieldCheck, LogOut, Bell, ChevronDown, Menu, X,
    Mail, Shield, Calendar, Edit3, Save, CheckCircle, Camera,
} from 'lucide-react';
import { userService, UserProfile } from '../services/userService';
import { getUserInfo, getInitials } from '../utils/jwtHelper';

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
function getRoleLabel(role: string) {
    return { Admin: 'Quản trị viên', Staff: 'Nhân viên', Author: 'Tác giả' }[role] ?? role;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ role, collapsed, onCollapse, onNavigate }: {
    role: string; collapsed: boolean; onCollapse: () => void; onNavigate: (path: string) => void;
}) {
    const nav = getNav(role);
    const location = useLocation();
    return (
        <aside className="flex flex-col h-full transition-all duration-300 overflow-hidden shrink-0"
            style={{ width: collapsed ? '68px' : '200px', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)' }}>
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
                {!collapsed && <p className="text-[var(--text-secondary)] opacity-50 text-[10px] font-semibold uppercase tracking-widest px-4 mb-2">Menu</p>}
                <nav className="space-y-0.5 px-2">
                    {nav.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                            <button key={item.key} onClick={() => onNavigate(item.path)} title={collapsed ? item.label : undefined}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${active ? 'text-[#f5a623] bg-[#f5a623]/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'}`}>
                                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#f5a623]' : ''}`} />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                                {!collapsed && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f5a623]" />}
                            </button>
                        );
                    })}
                </nav>
            </div>
            {!collapsed && (
                <div className="px-3 pb-3">
                    <div className="bg-[var(--text-primary)]/5 border border-[var(--border-color)] rounded-2xl p-4">
                        <p className="text-[var(--text-primary)] text-xs font-semibold mb-0.5">Need Help?</p>
                        <p className="text-[var(--text-secondary)] text-[10px] mb-3">Contact us for assistance.</p>
                        <button className="w-full py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-medium transition-colors">Support Center</button>
                    </div>
                </div>
            )}
            <div className="px-3 pb-4">
                <button onClick={onCollapse}
                    className="w-full flex items-center justify-center py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all">
                    {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    );
}

// ── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ fullName, role, onLogout }: { fullName: string; role: string; onLogout: () => void }) {
    const [userOpen, setUserOpen] = useState(false);
    const badge = getRoleBadge(role);
    return (
        <header style={{ background: 'var(--bg-topbar)', borderBottom: '1px solid var(--border-color)' }}
            className="h-[68px] flex items-center px-6 gap-4 shrink-0 relative z-20">
            <h1 className="text-[var(--text-primary)] font-bold text-lg">Hồ sơ cá nhân</h1>
            <div className="flex-1" />
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f5a623] rounded-full" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                <Settings className="w-4 h-4" />
            </button>
            <div className="relative">
                <button onClick={() => setUserOpen(o => !o)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                        {getInitials(fullName)}
                    </div>
                    <span className="text-[var(--text-primary)] text-sm font-medium max-w-[120px] truncate hidden sm:block">{fullName}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                </button>
                {userOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <div className="px-4 py-3 border-b border-[var(--border-color)]">
                            <p className="text-[var(--text-primary)] text-sm font-semibold truncate">{fullName}</p>
                            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
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

// ── Profile Content ───────────────────────────────────────────────────────────
function ProfileContent({ jwtRole }: { jwtRole: string }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await userService.getProfile();
                setProfile(data);
                setFullName(data.fullName);
                setAvatarUrl(data.avatarURL ?? '');
            } catch { setError('Không thể tải thông tin người dùng.'); }
            finally { setLoading(false); }
        })();
    }, []);

    const handleSave = async () => {
        if (!fullName.trim()) { setError('Họ và tên không được để trống.'); return; }
        try {
            setSaving(true); setError('');
            const updated = await userService.updateProfile({ fullName: fullName.trim(), avatarURL: avatarUrl || undefined });
            setProfile(updated);
            setEditing(false);
            setSuccess('Cập nhật thành công!');
            setTimeout(() => setSuccess(''), 3000);
        } catch { setError('Cập nhật thất bại. Vui lòng thử lại.'); }
        finally { setSaving(false); }
    };

    const badge = getRoleBadge(profile?.role ?? jwtRole);

    if (loading) return (
        <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#f5a623] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)] text-sm">Đang tải...</p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Alerts */}
                {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                        <X className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {success}
                    </div>
                )}

                {/* Avatar card */}
                <div className="rounded-3xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    {/* Header bar - Increased height to prevent clipping */}
                    <div className="h-32 relative" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)' }}>
                        <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                    </div>

                    <div className="px-6 pb-6 pt-2">
                        {/* Avatar - Adjusted overlap and vertical space */}
                        <div className="flex items-end gap-5 -mt-12 mb-6">
                            <div className="relative">
                                {profile?.avatarURL ? (
                                    <img src={profile.avatarURL} alt="Avatar"
                                        className="w-24 h-24 rounded-2xl object-cover"
                                        style={{ outline: '4px solid var(--bg-surface)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }} />
                                ) : (
                                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', outline: '4px solid var(--bg-surface)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}>
                                        {profile ? getInitials(profile.fullName) : '?'}
                                    </div>
                                )}
                                {editing && (
                                    <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-[#f5a623] flex items-center justify-center shadow-lg hover:bg-[#f97316] transition-colors border-2 border-[var(--bg-surface)]">
                                        <Camera className="w-4 h-4 text-white" />
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <p className="text-[var(--text-primary)] font-bold text-xl leading-tight mb-1">{profile?.fullName}</p>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${badge.bg} ${badge.text} ${badge.border}`}>
                                        {getRoleLabel(profile?.role ?? jwtRole)}
                                    </span>
                                </div>
                            </div>
                            <div className="ml-auto mb-1">
                                {!editing ? (
                                    <button onClick={() => setEditing(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all">
                                        <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditing(false); setFullName(profile?.fullName ?? ''); setAvatarUrl(profile?.avatarURL ?? ''); setError(''); }}
                                            disabled={saving}
                                            className="px-4 py-2 rounded-xl text-sm text-[var(--text-secondary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all">
                                            Huỷ
                                        </button>
                                        <button onClick={handleSave} disabled={saving}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            {saving ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info card */}
                <div className="rounded-3xl p-6 space-y-5 bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    <h3 className="text-[var(--text-primary)] font-semibold text-sm">Thông tin cá nhân</h3>

                    {/* Full Name */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <User className="w-3 h-3" /> Họ và Tên
                        </label>
                        {editing ? (
                            <input type="text" value={fullName} autoFocus
                                onChange={e => { setFullName(e.target.value); setError(''); }}
                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-[#f5a623]/50 focus:ring-2 focus:ring-[#f5a623]/20 rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none transition-all"
                                placeholder="Nhập họ và tên..." />
                        ) : (
                            <p className="text-[var(--text-primary)] font-medium">{profile?.fullName}</p>
                        )}
                    </div>

                    {/* Avatar URL */}
                    {editing && (
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                                <Camera className="w-3 h-3" /> URL Ảnh đại diện
                            </label>
                            <input type="url" value={avatarUrl}
                                onChange={e => setAvatarUrl(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-[#f5a623]/50 focus:ring-2 focus:ring-[#f5a623]/20 rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none transition-all"
                                placeholder="https://..." />
                        </div>
                    )}

                    {/* Divider */}
                    <div className="h-px bg-white/5" />

                    {/* Email */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Mail className="w-3 h-3" /> Email
                        </label>
                        <p className="text-[var(--text-secondary)] text-sm">{profile?.email}</p>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Shield className="w-3 h-3" /> Vai trò
                        </label>
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-lg border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                            {getRoleLabel(profile?.role ?? jwtRole)}
                        </span>
                    </div>

                    {/* Joined */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Calendar className="w-3 h-3" /> Ngày tham gia
                        </label>
                        <p className="text-[var(--text-secondary)] text-sm">
                            {profile?.createdAt
                                ? new Date(profile.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [userInfo, setUserInfo] = useState({ fullName: 'Người dùng', role: 'Author' });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        setUserInfo({ fullName: info.fullName, role: info.role });
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)]">
            <Sidebar role={userInfo.role} collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} onNavigate={navigate} />
            <div className="flex flex-col flex-1 min-w-0">
                <Topbar fullName={userInfo.fullName} role={userInfo.role} onLogout={handleLogout} />
                <ProfileContent jwtRole={userInfo.role} />
            </div>
        </div>
    );
}
