import { useState, useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Pencil, Trash2, AlertTriangle, Loader2, MoreHorizontal, X, FolderOpen, Info, Search, ChevronDown, Check
} from 'lucide-react';
import {
    projectService,
    type ProjectResponse,
    type CreateProjectRequest,
    type UpdateProjectRequest,
    type GenreResponse,
} from '../services/projectService';
import { genreService } from '../services/genreService';
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
    initial?: { title: string; summary: string; status: string; genreIds: number[] };
    onSubmit: (data: { title: string; summary: string; status: string; genreIds: number[] }) => Promise<void>;
    onClose: () => void;
    loading: boolean;
    title: string;
    genres: GenreResponse[];
}

function ProjectFormModal({ initial, onSubmit, onClose, loading, title, genres }: ProjectFormProps) {
    const [form, setForm] = useState({
        title: initial?.title ?? '',
        summary: initial?.summary ?? '',
        status: initial?.status ?? 'Draft',
        genreIds: initial?.genreIds ?? [] as number[],
    });
    const [error, setError] = useState('');

    const [genreSearch, setGenreSearch] = useState('');
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsGenreOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleGenre = (id: number) => {
        setForm(f => ({
            ...f,
            genreIds: f.genreIds.includes(id)
                ? f.genreIds.filter(g => g !== id)
                : [...f.genreIds, id],
        }));
    };

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

                    {genres.length > 0 && (
                        <div className="relative z-20" ref={dropdownRef}>
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                                Thể loại
                            </label>

                            <div
                                onClick={() => setIsGenreOpen(!isGenreOpen)}
                                className="w-full min-h-[44px] px-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl flex items-center justify-between cursor-pointer transition-all hover:border-[var(--text-secondary)]/50 focus-within:ring-2 focus-within:ring-[#f5a623]/50 focus-within:border-[#f5a623]/50"
                            >
                                <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                                    {form.genreIds.length === 0 ? (
                                        <span className="text-[var(--text-secondary)]/50 text-sm py-0.5">Chọn thể loại...</span>
                                    ) : (
                                        form.genreIds.map(id => {
                                            const g = genres.find(x => x.id === id);
                                            if (!g) return null;
                                            return (
                                                <span
                                                    key={g.id}
                                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                                                    style={{
                                                        background: g.color + '20',
                                                        color: g.color,
                                                        border: `1px solid ${g.color}40`,
                                                    }}
                                                    onClick={(e) => { e.stopPropagation(); toggleGenre(g.id); }}
                                                >
                                                    {g.name}
                                                    <X className="w-3 h-3 hover:scale-110 transition-transform cursor-pointer" />
                                                </span>
                                            );
                                        })
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-200 ml-2 shrink-0 ${isGenreOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isGenreOpen && (
                                <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[200px]">
                                    <div className="p-2 border-b border-[var(--border-color)] shrink-0">
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                            <input
                                                type="text"
                                                placeholder="Tìm kiếm thể loại..."
                                                value={genreSearch}
                                                onChange={e => setGenreSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] bg-opacity-50 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[#f5a623]/50 focus:ring-1 focus:ring-[#f5a623]/50 transition-all placeholder-[var(--text-secondary)]/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto scrollbar-thin p-1.5 flex flex-col gap-0.5">
                                        {genres.filter(g => g.name.toLowerCase().includes(genreSearch.toLowerCase())).length === 0 ? (
                                            <div className="text-center py-6 text-sm text-[var(--text-secondary)]">Không tìm thấy thể loại phù hợp</div>
                                        ) : (
                                            genres.filter(g => g.name.toLowerCase().includes(genreSearch.toLowerCase())).map(g => {
                                                const selected = form.genreIds.includes(g.id);
                                                return (
                                                    <div
                                                        key={g.id}
                                                        onClick={() => {
                                                            toggleGenre(g.id);
                                                        }}
                                                        className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-[var(--text-primary)]/5"
                                                        style={{
                                                            background: selected ? g.color + '0d' : 'transparent',
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{
                                                                    background: g.color,
                                                                    boxShadow: `0 0 8px ${g.color}66`
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium" style={{ color: selected ? g.color : 'var(--text-primary)' }}>
                                                                {g.name}
                                                            </span>
                                                        </div>
                                                        {selected && <Check className="w-4 h-4" style={{ color: g.color }} />}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const menuBtnRef = useRef<HTMLButtonElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const BOOK_W = 195;
    const BOOK_H = 290;
    const SPINE_W = 38;

    return (
        <div
            className="relative cursor-pointer flex justify-center"
            onClick={() => onClick(project)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                perspective: '700px',
                perspectiveOrigin: '50% 50%',
                padding: '16px 8px 24px',
            }}
        >
            {/* 3D Book wrapper */}
            <div
                style={{
                    position: 'relative',
                    width: `${BOOK_W}px`,
                    height: `${BOOK_H}px`,
                    transformStyle: 'preserve-3d',
                    transform: isHovered
                        ? 'rotateY(-6deg) translateY(-8px)'
                        : 'rotateY(-28deg)',
                    transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    filter: isHovered
                        ? 'drop-shadow(16px 22px 32px rgba(0,0,0,0.55))'
                        : 'drop-shadow(6px 14px 22px rgba(0,0,0,0.5))',
                }}
            >
                {/* Main book body: spine + cover */}
                <div style={{
                    display: 'flex',
                    height: `${BOOK_H}px`,
                    width: `${BOOK_W}px`,
                    borderRadius: '3px 12px 12px 3px',
                    overflow: 'hidden',
                    position: 'relative',
                }}>
                    {/* ── SPINE ── */}
                    <div style={{
                        width: `${SPINE_W}px`,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: `linear-gradient(90deg, ${color.spine} 0%, ${color.cover} 100%)`,
                        boxShadow: 'inset -4px 0 8px rgba(0,0,0,0.4)',
                        borderRadius: '3px 0 0 3px',
                    }}>
                        {/* Spine decorative bands */}
                        <div style={{ position: 'absolute', top: '22px', left: '4px', right: '4px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ position: 'absolute', top: '26px', left: '4px', right: '4px', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ position: 'absolute', bottom: '22px', left: '4px', right: '4px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ position: 'absolute', bottom: '26px', left: '4px', right: '4px', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        {/* Spine title — StoryNest branding, vertical */}
                        <span style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            fontSize: '10px',
                            fontWeight: '800',
                            color: 'rgba(255,255,255,0.5)',
                            letterSpacing: '0.25em',
                            textTransform: 'uppercase',
                            fontFamily: 'sans-serif',
                            whiteSpace: 'nowrap',
                        }}>
                            StoryNest
                        </span>
                    </div>

                    {/* ── COVER ── */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '14px 14px 12px',
                        position: 'relative',
                        overflow: 'hidden',
                        background: color.cover,
                    }}>
                        {/* Hinge shadow */}
                        <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: '10px',
                            background: 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)',
                            zIndex: 20,
                        }} />

                        {/* Light reflection (diagonal top-left) */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 35%, transparent 65%)',
                            pointerEvents: 'none', zIndex: 2,
                        }} />

                        {/* Subtle noise texture via SVG */}
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08, pointerEvents: 'none', zIndex: 1 }}>
                            <filter id={`noise-${project.id}`}>
                                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0" />
                            </filter>
                            <rect width="100%" height="100%" filter={`url(#noise-${project.id})`} />
                        </svg>

                        {/* Title */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative', zIndex: 30,
                        }}>
                            <h3 style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '19px',
                                fontWeight: '700',
                                color: 'white',
                                lineHeight: '1.4',
                                textShadow: '1px 2px 8px rgba(0,0,0,0.65)',
                                textAlign: 'center',
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                            }}>
                                {project.title}
                            </h3>
                        </div>

                        {/* Genre tags */}
                        {project.genres && project.genres.length > 0 && (
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '4px',
                                position: 'relative', zIndex: 30,
                                marginBottom: '8px',
                                justifyContent: 'center',
                            }}>
                                {project.genres.slice(0, 2).map(g => (
                                    <span key={g.id} style={{
                                        fontSize: '8px',
                                        fontWeight: '700',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        color: g.color,
                                        background: g.color + '22',
                                        border: `1px solid ${g.color}55`,
                                        borderRadius: '4px',
                                        padding: '2px 5px',
                                    }}>
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Footer: date + menu */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            borderTop: '1px solid rgba(255,255,255,0.12)',
                            paddingTop: '10px',
                            position: 'relative', zIndex: 30,
                            marginTop: '8px',
                        }}>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', fontWeight: '500', letterSpacing: '0.04em' }}>
                                {createdDate}
                            </span>
                            <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                    ref={menuBtnRef}
                                    onClick={() => {
                                        if (!menuOpen && menuBtnRef.current) {
                                            const rect = menuBtnRef.current.getBoundingClientRect();
                                            setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                        }
                                        setMenuOpen(v => !v);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                                {menuOpen && createPortal(
                                    <>
                                        <div className="fixed inset-0 z-[200]" onClick={() => setMenuOpen(false)} />
                                        <div
                                            className="fixed w-36 rounded-xl shadow-2xl overflow-hidden z-[201]"
                                            style={{
                                                top: menuPos.top,
                                                right: menuPos.right,
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <button onClick={() => { onInfo(project); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                                                <Info className="w-3.5 h-3.5" /> Thông tin
                                            </button>
                                            <button onClick={() => { onEdit(project); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                                                <Pencil className="w-3.5 h-3.5" /> Chỉnh sửa
                                            </button>
                                            <button onClick={() => { onDelete(project); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" /> Xóa dự án
                                            </button>
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── PAGE EDGES (right side) ── */}
                    <div style={{
                        position: 'absolute', right: '-5px', top: '2px', bottom: '2px',
                        width: '7px', zIndex: 0,
                        display: 'flex', flexDirection: 'column',
                        borderRadius: '0 2px 2px 0',
                        overflow: 'hidden',
                    }}>
                        {[...Array(28)].map((_, i) => (
                            <div key={i} style={{
                                flex: 1,
                                background: i % 4 === 0
                                    ? 'rgba(248,244,236,0.9)'
                                    : i % 4 === 2
                                        ? 'rgba(235,230,220,0.75)'
                                        : 'rgba(242,238,230,0.82)',
                                borderBottom: i % 2 === 0 ? '0.5px solid rgba(180,170,155,0.2)' : 'none',
                            }} />
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
            {(userInfo) => {
                if (userInfo.role === 'Admin') {
                    setTimeout(() => navigate('/home'), 0);
                    return null;
                }
                return <ProjectsContent onNavigate={navigate} />;
            }}
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
    const [genres, setGenres] = useState<GenreResponse[]>([]);

    // Modal states
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState<ProjectResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectResponse | null>(null);
    const [infoTarget, setInfoTarget] = useState<ProjectResponse | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        fetchProjects();
        genreService.getGenres().then(setGenres).catch(() => { });
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

    const handleCreate = async (form: { title: string; summary: string; status: string; genreIds: number[] }) => {
        setModalLoading(true);
        try {
            const req: CreateProjectRequest = {
                title: form.title,
                summary: form.summary || undefined,
                status: form.status,
                genreIds: form.genreIds,
            };
            const created = await projectService.createProject(req);
            setProjects(prev => [created, ...prev]);
            setShowCreate(false);
        } finally {
            setModalLoading(false);
        }
    };

    const handleEdit = async (form: { title: string; summary: string; status: string; genreIds: number[] }) => {
        if (!editTarget) return;
        setModalLoading(true);
        try {
            const req: UpdateProjectRequest = {
                title: form.title,
                summary: form.summary || undefined,
                status: form.status,
                genreIds: form.genreIds,
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
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
                    genres={genres}
                />
            )}

            {/* Edit modal */}
            {editTarget && (
                <ProjectFormModal
                    title="Chỉnh sửa dự án"
                    initial={{
                        title: editTarget.title,
                        summary: editTarget.summary ?? '',
                        status: editTarget.status,
                        genreIds: editTarget.genres?.map(g => g.id) ?? [],
                    }}
                    onSubmit={handleEdit}
                    onClose={() => setEditTarget(null)}
                    loading={modalLoading}
                    genres={genres}
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
