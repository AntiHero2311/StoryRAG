import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Pencil, Trash2, AlertTriangle, Loader2, MoreHorizontal, X, FolderOpen, Info
} from 'lucide-react';
import {
    projectService,
    ProjectResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
} from '../services/projectService';
import MainLayout from '../layouts/MainLayout';

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

// ── Info modal ──────────────────────────────────────────────────────────────
function ProjectInfoModal({ project, onClose }: { project: ProjectResponse; onClose: () => void }) {
    const createdDate = new Date(project.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const updatedDate = project.updatedAt
        ? new Date(project.updatedAt).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
        : '--';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[var(--text-primary)] font-bold text-lg">Thông tin dự án</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Tên dự án</label>
                        <p className="text-[var(--text-primary)] font-medium bg-[var(--input-bg)] px-4 py-2.5 rounded-xl border border-[var(--border-color)]">{project.title}</p>
                    </div>

                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Trạng thái</label>
                        <div className="bg-[var(--input-bg)] px-4 py-2.5 rounded-xl border border-[var(--border-color)]">
                            <StatusBadge status={project.status} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Tóm tắt</label>
                        <div className="bg-[var(--input-bg)] px-4 py-2.5 rounded-xl border border-[var(--border-color)] min-h-[4rem]">
                            {project.summary ? (
                                <p className="text-[var(--text-primary)] text-sm">{project.summary}</p>
                            ) : (
                                <p className="text-[var(--text-secondary)] text-sm italic">Không có tóm tắt</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Ngày tạo</label>
                            <p className="text-[var(--text-primary)] text-sm">{createdDate}</p>
                        </div>
                        <div>
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Cập nhật lần cuối</label>
                            <p className="text-[var(--text-primary)] text-sm">{updatedDate}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center"
                        style={{ background: 'var(--text-secondary)' }}>
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Book Color Palette ────────────────────────────────────────────────────────
const BOOK_COLORS = [
    { spine: '#1e293b', cover: '#334155', accent: '#f5a623', texture: 'opacity-10' }, // Slate - Professional
    { spine: '#1e1b4b', cover: '#312e81', accent: '#818cf8', texture: 'opacity-20' }, // Indigo - Academic
    { spine: '#064e3b', cover: '#065f46', accent: '#34d399', texture: 'opacity-15' }, // Emerald - Fantasy
    { spine: '#451a03', cover: '#78350f', accent: '#f59e0b', texture: 'opacity-25' }, // Amber - Historical
    { spine: '#4c1d95', cover: '#5b21b6', accent: '#a78bfa', texture: 'opacity-20' }, // Violet - Creative
    { spine: '#701a75', cover: '#86198f', accent: '#f0abfc', texture: 'opacity-15' }, // Fuchsia - Romance
    { spine: '#7f1d1d', cover: '#991b1b', accent: '#f87171', texture: 'opacity-20' }, // Red - Thriller
    { spine: '#0c4a6e', cover: '#075985', accent: '#38bdf8', texture: 'opacity-15' }, // Sky - Sci-Fi
];

function hashColor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
}

// ── Project Card (Book Style) ─────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onDelete, onInfo, onClick }: {
    project: ProjectResponse;
    onEdit: (p: ProjectResponse) => void;
    onDelete: (p: ProjectResponse) => void;
    onInfo: (p: ProjectResponse) => void;
    onClick: (p: ProjectResponse) => void;
}) {
    const color = hashColor(project.id);
    const createdDate = new Date(project.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const [menuOpen, setMenuOpen] = useState(false);

    // Book dimensions
    const BOOK_W = '170px';
    const BOOK_H = '290px';

    return (
        <div
            className="group relative cursor-pointer flex justify-center overflow-hidden"
            onClick={() => onClick(project)}
            style={{ perspective: '1200px' }}
        >
            {/* Book container */}
            <div className="relative transition-all duration-300 ease-out transform-gpu group-hover:scale-[1.02] overflow-hidden"
                style={{
                    transformStyle: 'preserve-3d',
                    width: BOOK_W,
                    height: BOOK_H
                }}>

                {/* Main Book Body */}
                <div className="relative flex rounded-r-[2rem] overflow-hidden shadow-[15px_15px_30px_rgba(0,0,0,0.4)] group-hover:shadow-[30px_30px_60px_rgba(0,0,0,0.5)] transition-all duration-500"
                    style={{ height: BOOK_H, width: BOOK_W }}>

                    {/* Spine */}
                    <div
                        className="w-8 shrink-0 flex items-center justify-center relative z-20"
                        style={{
                            background: `linear-gradient(90deg, ${color.spine} 0%, ${color.spine} 20%, ${color.cover} 100%)`,
                            boxShadow: 'inset -2px 0 5px rgba(0,0,0,0.3)',
                            borderRadius: '8px 0 0 8px'
                        }}
                    >
                        <div className="absolute inset-x-0 top-6 h-px bg-white/10" />
                        <div className="absolute inset-x-0 bottom-6 h-px bg-white/10" />
                        <span
                            className="text-white font-bold rotate-180 whitespace-nowrap opacity-40 uppercase tracking-[0.2em]"
                            style={{ writingMode: 'vertical-rl', fontSize: '11px' }}
                        >
                            StoryNest
                        </span>
                    </div>

                    {/* Book Cover */}
                    <div
                        className="flex-1 flex flex-col p-5 relative overflow-hidden z-10"
                        style={{ background: color.cover }}
                    >
                        {/* Hinge detail */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/20 blur-[1px] z-20" />

                        {/* Texture Overlay */}
                        <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leather.png')] ${color.texture} pointer-events-none mix-blend-overlay`} />

                        {/* Top section - Status only */}
                        <div className="flex items-center justify-between mb-4 relative z-30">
                            <StatusBadge status={project.status} />
                        </div>

                        {/* Title Section */}
                        <div className="flex-1 flex flex-col justify-center relative z-30">
                            <h3 className="font-bold text-xl leading-tight text-white line-clamp-4 text-center break-words [hyphens:auto]"
                                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)', fontFamily: "'Playfair Display', serif" }}>
                                {project.title}
                            </h3>
                        </div>

                        {/* Footer - Date and Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/10 relative z-30">
                            <span className="text-white/40 text-[10px] font-medium tracking-wider">{createdDate}</span>

                            <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => setMenuOpen(!menuOpen)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all shadow-sm"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                                {menuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                                        <div className="absolute right-0 bottom-full mb-2 w-32 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
                                            <button
                                                onClick={() => { onInfo(project); setMenuOpen(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors"
                                            >
                                                <Info className="w-3.5 h-3.5" /> Thông tin
                                            </button>
                                            <button
                                                onClick={() => { onEdit(project); setMenuOpen(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                                            </button>
                                            <button
                                                onClick={() => { onDelete(project); setMenuOpen(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Xóa dự án
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Paper Edges (Visual Stack) - subtle */}
                    <div className="absolute right-0 top-0 bottom-0 w-[5px] z-0 overflow-hidden" style={{ background: 'linear-gradient(to right, rgba(250,248,244,0.6), rgba(220,215,205,0.4))' }}>
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className="h-[2px] w-full bg-black/5" style={{ marginTop: i === 0 ? 0 : '3px' }} />
                        ))}
                    </div>
                </div>


            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
    const navigate = useNavigate();

    return (
        <MainLayout pageTitle="Dự án của tôi">
            {() => (
                <ProjectsContent
                    onNavigate={navigate}
                />
            )}
        </MainLayout>
    );
}

function ProjectsContent({ onNavigate }: { onNavigate: (path: string) => void }) {
    const handleOpenWorkspace = (project: ProjectResponse) => {
        sessionStorage.setItem(`project_${project.id}`, JSON.stringify({ title: project.title }));
        onNavigate(`/workspace/${project.id}`);
    };

    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal states
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState<ProjectResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
    const [infoTarget, setInfoTarget] = useState<ProjectResponse | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

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

    return (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {projects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onEdit={setEditTarget}
                            onDelete={setDeleteTarget}
                            onInfo={setInfoTarget}
                            onClick={handleOpenWorkspace}
                        />
                    ))}
                </div>
            )}

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

            {/* Info modal */}
            {infoTarget && (
                <ProjectInfoModal
                    project={infoTarget}
                    onClose={() => setInfoTarget(null)}
                />
            )}
        </div>
    );
}
