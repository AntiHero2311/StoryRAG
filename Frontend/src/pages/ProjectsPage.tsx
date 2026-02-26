import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, FolderOpen, BarChart2, User, Settings,
    LogOut, Users, ShieldCheck, Bell, ChevronDown, Menu, X,
    Plus, Pencil, Trash2, BookOpen, AlertTriangle, Loader2,
} from 'lucide-react';
import {
    projectService,
    ProjectResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '../services/projectService';
import { getUserInfo } from '../utils/jwtHelper';

// ── Role-based nav ────────────────────────────────────────────────────────────
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ role, collapsed, onCollapse, onNavigate }: {
    role: string; collapsed: boolean; onCollapse: () => void; onNavigate: (path: string) => void;
}) {
    const nav = getNav(role);
    const location = useLocation();

    return (
        <aside
            className="flex flex-col h-full transition-all duration-300 overflow-hidden"
            style={{ width: collapsed ? '68px' : '200px', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', flexShrink: 0 }}
        >
            <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border-color)] min-h-[68px]">
                <img src="/logo.png" alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
                {!collapsed && (
                    <div className="overflow-hidden">
                        <span className="text-[var(--text-primary)] font-bold text-sm truncate">StoryNest</span>
                        <p className="text-white/30 text-[10px] truncate">Analysis System</p>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                {!collapsed && (
                    <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-4 mb-2">Menu</p>
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
                                {!collapsed && <span className="truncate">{item.label}</span>}
                                {!collapsed && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f5a623]" />}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {!collapsed && (
                <div className="px-3 pb-3">
                    <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                        <p className="text-white text-xs font-semibold mb-0.5">Need Help?</p>
                        <p className="text-white/30 text-[10px] mb-3">Contact us for assistance.</p>
                        <button className="w-full py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-medium transition-colors">
                            Support Center
                        </button>
                    </div>
                </div>
            )}

            <div className="px-3 pb-4">
                <button
                    onClick={onCollapse}
                    className="w-full flex items-center justify-center py-2.5 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all text-sm"
                >
                    {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
            </div>
        </aside>
    );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ fullName, role, onLogout }: { fullName: string; role: string; onLogout: () => void }) {
    const [userOpen, setUserOpen] = useState(false);
    const initials = fullName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
    const badge = getRoleBadge(role);

    return (
        <header className="h-[68px] flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--bg-topbar)]">
            <h1 className="text-[var(--text-primary)] font-bold text-lg">Dự án của tôi</h1>
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
                    className="flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                        {initials}
                    </div>
                    <span className="text-white text-sm font-medium max-w-[120px] truncate hidden sm:block">{fullName}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                </button>

                {userOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: '#161b27', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="px-4 py-3 border-b border-white/6">
                            <p className="text-white text-sm font-semibold truncate">{fullName}</p>
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

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Draft: 'bg-slate-500/20 text-[var(--text-secondary)] border-[var(--border-color)]',
        Published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        Archived: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    const labels: Record<string, string> = {
        Draft: 'Bản nháp',
        Published: 'Đã xuất bản',
        Archived: 'Lưu trữ',
    };
    return (
        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-semibold ${styles[status] ?? styles.Draft}`}>
            {labels[status] ?? status}
        </span>
    );
}

// ── Project form modal ────────────────────────────────────────────────────────
interface ProjectFormProps {
    initial?: { title: string; summary: string; status: string };
    onSubmit: (data: { title: string; summary: string; status: string }) => Promise<void>;
    onClose: () => void;
    loading: boolean;
    title: string;
}

function ProjectFormModal({ initial, onSubmit, onClose, loading, title }: ProjectFormProps) {
    const [form, setForm] = useState({
        title: initial?.title ?? '',
        summary: initial?.summary ?? '',
        status: initial?.status ?? 'Draft',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) { setError('Tên dự án không được để trống.'); return; }
        setError('');
        try {
            await onSubmit(form);
        } catch (err: any) {
            setError(err?.response?.data?.message ?? err?.message ?? 'Đã xảy ra lỗi.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[var(--text-primary)] font-bold text-lg">{title}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                            Tên dự án <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Ví dụ: Tiểu thuyết kiếm hiệp"
                            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none focus:ring-2 focus:ring-[#f5a623]/50"
                        />
                    </div>

                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                            Tóm tắt
                        </label>
                        <textarea
                            value={form.summary}
                            onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                            placeholder="Mô tả ngắn về dự án của bạn..."
                            rows={3}
                            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none focus:ring-2 focus:ring-[#f5a623]/50 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                            Trạng thái
                        </label>
                        <select
                            value={form.status}
                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-[#f5a623]/50 appearance-none"
                        >
                            <option value="Draft">Bản nháp</option>
                            <option value="Published">Đã xuất bản</option>
                            <option value="Archived">Lưu trữ</option>
                        </select>
                    </div>

                    {error && (
                        <p className="text-rose-400 text-sm flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                            Hủy
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ projectTitle, onConfirm, onClose, loading }: {
    projectTitle: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
    loading: boolean;
}) {
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        setError('');
        try { await onConfirm(); }
        catch (err: any) { setError(err?.response?.data?.message ?? err?.message ?? 'Đã xảy ra lỗi.'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-rose-500/20 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-primary)] font-bold">Xóa dự án?</h2>
                        <p className="text-[var(--text-secondary)] text-xs">Hành động này không thể hoàn tác.</p>
                    </div>
                </div>

                <p className="text-[var(--text-secondary)] text-sm mb-4">
                    Bạn có chắc muốn xóa dự án <span className="text-[var(--text-primary)] font-semibold">"{projectTitle}"</span>?
                </p>

                {error && (
                    <p className="text-rose-400 text-sm flex items-center gap-1.5 mb-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </p>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleConfirm} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Xóa
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onDelete }: {
    project: ProjectResponse;
    onEdit: (p: ProjectResponse) => void;
    onDelete: (p: ProjectResponse) => void;
}) {
    const createdDate = new Date(project.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    return (
        <div className="group relative flex flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md">
            {/* Status + actions */}
            <div className="flex items-center justify-between mb-3">
                <StatusBadge status={project.status} />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(project)}
                        title="Chỉnh sửa"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(project)}
                        title="Xóa"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)' }}>
                <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>

            {/* Title */}
            <h3 className="text-[var(--text-primary)] font-semibold text-sm leading-snug mb-2 line-clamp-2">
                {project.title}
            </h3>

            {/* Summary */}
            {project.summary && (
                <p className="text-[var(--text-secondary)] text-xs leading-relaxed mb-3 line-clamp-3 flex-1 opacity-70">
                    {project.summary}
                </p>
            )}

            <div className="mt-auto pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[var(--text-secondary)] opacity-50 text-[10px]">{createdDate}</span>
                <span className="text-[var(--text-secondary)] opacity-50 text-[10px]">0 chương</span>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [userInfo, setUserInfo] = useState({ fullName: 'Người dùng', role: 'Author' });

    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal states
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState<ProjectResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        setUserInfo(getUserInfo(token));
        fetchProjects();
    }, [navigate]);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await projectService.getProjects();
            setProjects(data);
        } catch {
            setError('Không thể tải danh sách dự án. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (form: { title: string; summary: string; status: string }) => {
        setModalLoading(true);
        try {
            const req: CreateProjectRequest = {
                title: form.title,
                summary: form.summary || undefined,
                status: form.status,
            };
            const created = await projectService.createProject(req);
            setProjects(prev => [created, ...prev]);
            setShowCreate(false);
        } finally {
            setModalLoading(false);
        }
    };

    const handleEdit = async (form: { title: string; summary: string; status: string }) => {
        if (!editTarget) return;
        setModalLoading(true);
        try {
            const req: UpdateProjectRequest = {
                title: form.title,
                summary: form.summary || undefined,
                status: form.status,
            };
            const updated = await projectService.updateProject(editTarget.id, req);
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditTarget(null);
        } finally {
            setModalLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setModalLoading(true);
        try {
            await projectService.deleteProject(deleteTarget.id);
            setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
            setDeleteTarget(null);
        } finally {
            setModalLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)]">
            <Sidebar role={userInfo.role} collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} onNavigate={navigate} />

            <div className="flex flex-col flex-1 min-w-0">
                <Topbar fullName={userInfo.fullName} role={userInfo.role} onLogout={handleLogout} />

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-[var(--text-primary)] font-bold text-xl">Dự án của tôi</h2>
                            <p className="text-[var(--text-secondary)] text-sm mt-0.5">
                                {projects.length} dự án
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                            <Plus className="w-4 h-4" />
                            Tạo dự án mới
                        </button>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-[#f5a623] animate-spin" />
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div className="rounded-2xl p-5 flex items-center gap-3"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                            <p className="text-rose-400 text-sm">{error}</p>
                            <button onClick={fetchProjects} className="ml-auto text-xs text-rose-400 hover:text-white underline">
                                Thử lại
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-[var(--text-primary)]/5 flex items-center justify-center">
                                <FolderOpen className="w-8 h-8 text-[var(--text-secondary)] opacity-20" />
                            </div>
                            <div className="text-center">
                                <p className="text-[var(--text-secondary)] font-medium mb-1">Chưa có dự án nào</p>
                                <p className="text-[var(--text-secondary)] opacity-50 text-sm">Tạo dự án đầu tiên để bắt đầu sáng tác!</p>
                            </div>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105"
                                style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                <Plus className="w-4 h-4" />
                                Tạo dự án đầu tiên
                            </button>
                        </div>
                    )}

                    {/* Project grid */}
                    {!loading && !error && projects.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {projects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onEdit={setEditTarget}
                                    onDelete={setDeleteTarget}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create modal */}
            {showCreate && (
                <ProjectFormModal
                    title="Tạo dự án mới"
                    onSubmit={handleCreate}
                    onClose={() => setShowCreate(false)}
                    loading={modalLoading}
                />
            )}

            {/* Edit modal */}
            {editTarget && (
                <ProjectFormModal
                    title="Chỉnh sửa dự án"
                    initial={{ title: editTarget.title, summary: editTarget.summary ?? '', status: editTarget.status }}
                    onSubmit={handleEdit}
                    onClose={() => setEditTarget(null)}
                    loading={modalLoading}
                />
            )}

            {/* Delete confirm */}
            {deleteTarget && (
                <DeleteConfirmModal
                    projectTitle={deleteTarget.title}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteTarget(null)}
                    loading={modalLoading}
                />
            )}
        </div>
    );
}
