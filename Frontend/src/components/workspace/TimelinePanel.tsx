import { useState, useEffect } from 'react';
import {
    Plus, Loader2, Trash2, Pencil, Check, Clock,
    Globe, Users, Scroll, Zap, ChevronUp, ChevronDown, CalendarDays,
    Milestone, Flame, Shuffle, Mountain
} from 'lucide-react';
import {
    timelineService,
    type TimelineEventEntry,
    type CreateTimelineEventRequest,
    TIMELINE_CATEGORIES,
    TIMELINE_IMPORTANCE,
    getCategoryColor,
    getCategoryLabel,
    getImportanceInfo,
} from '../../services/timelineService';
import { useToast } from '../Toast';

interface TimelinePanelProps { projectId: string; }

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    Story: Scroll,
    Arc: Milestone,
    Conflict: Flame,
    Twist: Shuffle,
    Climax: Mountain,
    Historical: Clock,
    Character: Users,
    World: Globe,
    Political: Zap,
    Other: CalendarDays,
};

function CategoryIcon({ cat, className }: { cat: string; className?: string }) {
    const Icon = CATEGORY_ICONS[cat] ?? CalendarDays;
    return <Icon className={className ?? 'w-3 h-3'} />;
}

const EMPTY_FORM: CreateTimelineEventRequest = {
    category: 'Story',
    title: '',
    description: '',
    timeLabel: '',
    sortOrder: 0,
    importance: 'Normal',
};

export default function TimelinePanel({ projectId }: TimelinePanelProps) {
    const toast = useToast();
    const [events, setEvents] = useState<TimelineEventEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<CreateTimelineEventRequest>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        timelineService.getAll(projectId)
            .then(setEvents)
            .catch(() => setError('Không thể tải dữ liệu.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const openAdd = () => {
        setForm({ ...EMPTY_FORM, sortOrder: (events.length + 1) * 10 });
        setEditingId(null);
        setError(null);
        setView('form');
    };

    const openEdit = (e: TimelineEventEntry) => {
        setForm({
            category: e.category,
            title: e.title,
            description: e.description,
            timeLabel: e.timeLabel ?? '',
            sortOrder: e.sortOrder,
            importance: e.importance,
        });
        setEditingId(e.id);
        setError(null);
        setView('form');
    };

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editingId) {
                const updated = await timelineService.update(projectId, editingId, form);
                setEvents(prev => prev.map(e => e.id === editingId ? updated : e));
                toast.success('Đã cập nhật sự kiện.');
            } else {
                const created = await timelineService.create(projectId, form);
                setEvents(prev => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
                toast.success('Đã thêm sự kiện mới.');
            }
            setView('list');
        } catch { setError('Lưu thất bại.'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await timelineService.delete(projectId, id);
            setEvents(prev => prev.filter(e => e.id !== id));
        } catch { toast.error('Xóa thất bại.'); }
        finally { setDeletingId(null); }
    };

    // ── FORM VIEW ──────────────────────────────────────────────────────────
    if (view === 'form') {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2.5 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] text-sm">
                        ←
                    </button>
                    <CalendarDays className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {editingId ? 'Chỉnh sửa sự kiện' : 'Thêm mốc sự kiện'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {error && <div className="text-xs text-red-400 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>}

                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Tên sự kiện *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="VD: Trận chiến Mạch Thủy, Ngày Ngọc Rồng ra đời..."
                            autoFocus maxLength={200}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-violet-500/30"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>

                    {/* Time label */}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                            Mốc thời gian <span className="normal-case font-normal opacity-60">(tùy chỉnh)</span>
                        </label>
                        <input value={form.timeLabel ?? ''} onChange={e => setForm(f => ({ ...f, timeLabel: e.target.value }))}
                            placeholder="VD: Hồi 1, Năm 432 TCN, Hiện tại..."
                            maxLength={100}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>

                    {/* Category chips */}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Phân loại</label>
                        <div className="flex flex-wrap gap-1.5">
                            {TIMELINE_CATEGORIES.map(c => {
                                const active = form.category === c.value;
                                return (
                                    <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                                        style={active
                                            ? { background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55` }
                                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                        <CategoryIcon cat={c.value} className="w-2.5 h-2.5" />
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Importance */}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Mức độ quan trọng</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {TIMELINE_IMPORTANCE.map(imp => {
                                const active = form.importance === imp.value;
                                return (
                                    <button key={imp.value} onClick={() => setForm(f => ({ ...f, importance: imp.value }))}
                                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
                                        style={{
                                            background: active ? `${imp.color}18` : 'var(--bg-app)',
                                            border: `1px solid ${active ? imp.color + '55' : 'var(--border-color)'}`,
                                        }}>
                                        <div className="rounded-full shrink-0" style={{ width: imp.size / 2, height: imp.size / 2, background: imp.color }} />
                                        <span className="text-[10px] font-semibold" style={{ color: active ? imp.color : 'var(--text-secondary)' }}>
                                            {imp.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Mô tả chi tiết</label>
                        <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Mô tả sự kiện, nguyên nhân, hậu quả, nhân vật liên quan..."
                            rows={5}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>

                <div className="px-4 pb-4 pt-2.5 flex gap-2 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <button onClick={handleSave} disabled={saving || !form.title.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingId ? 'Cập nhật' : 'Thêm mốc sự kiện'}
                    </button>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        Hủy
                    </button>
                </div>
            </div>
        );
    }

    // ── LIST VIEW (VISUAL TIMELINE) ────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2  flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Tuyến truyện (Plot & Timeline)</span>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent)' }}>
                        {events.length}
                    </span>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <Plus className="w-3 h-3" /> Thêm mốc
                </button>
            </div>

            {error && <div className="mx-3 mb-2 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>}

            <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
                {loading && <div className="text-xs text-[var(--text-secondary)] text-center py-10">Đang tải...</div>}

                {!loading && events.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                            <CalendarDays className="w-7 h-7 opacity-25 text-violet-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold text-[var(--text-primary)] mb-1">Chưa có dữ liệu Tuyến truyện</p>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed max-w-[200px]">
                                Thêm các tình tiết cốt truyện, sự kiện lịch sử, hoặc cao trào quan trọng.
                            </p>
                        </div>
                        <button onClick={openAdd}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                            <Plus className="w-3.5 h-3.5" /> Thêm sự kiện đầu tiên
                        </button>
                    </div>
                )}

                {!loading && events.length > 0 && (
                    <div className="relative pt-8 pb-12 w-[800px] max-w-full mx-auto">
                        {/* Vertical timeline line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full"
                            style={{ background: 'linear-gradient(180deg, transparent, var(--border-color) 4%, var(--border-color) 96%, transparent)' }} />

                        <div className="flex flex-col gap-6">
                            {events.map((evt, idx) => {
                                const impInfo = getImportanceInfo(evt.importance);
                                const catColor = getCategoryColor(evt.category);
                                const isExpanded = expandedId === evt.id;
                                const isLeft = idx % 2 === 0;

                                return (
                                    <div key={evt.id} className={`relative flex items-center w-full ${isLeft ? 'justify-start' : 'justify-end'}`}>
                                        {/* Timeline dot */}
                                        <div
                                            className="absolute left-1/2 flex items-center justify-center rounded-full border-4 border-[var(--bg-app)] z-10 transition-transform hover:scale-125 -translate-x-1/2"
                                            style={{
                                                width: impInfo.size + 8,
                                                height: impInfo.size + 8,
                                                background: impInfo.color,
                                                boxShadow: `0 0 0 1px ${impInfo.color}40`,
                                                top: '1.5rem',
                                            }}
                                        />

                                        {/* Connector Line */}
                                        <div className={`absolute top-[1.5rem] mt-[5px] h-0.5 z-0 ${isLeft ? 'right-1/2 w-8' : 'left-1/2 w-8'}`}
                                            style={{ background: catColor + '40' }} />

                                        {/* Card */}
                                        <div className={`w-[calc(50%-2rem)] ${isLeft ? 'pr-4' : 'pl-4'}`}>
                                            <div
                                                className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 group"
                                                onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                                                style={{ background: 'var(--bg-surface)', border: `1px solid ${isExpanded ? catColor + '77' : 'var(--border-color)'}`, boxShadow: `0 8px 30px rgba(0,0,0,0.15)` }}
                                            >
                                                {/* Card header */}
                                                <div className="px-5 pt-4 pb-3 flex items-start gap-3 flex-col sm:flex-row">
                                                    <div className="flex-1 min-w-0 w-full">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {evt.timeLabel && (
                                                                <div className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
                                                                    style={{ background: `${catColor}18`, color: catColor }}>
                                                                    {evt.timeLabel}
                                                                </div>
                                                            )}
                                                            <div className="flex-1" />
                                                            <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                                                                style={{ background: `${catColor}15`, color: catColor }}>
                                                                <CategoryIcon cat={evt.category} className="w-3 h-3" />
                                                                {getCategoryLabel(evt.category)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[15px] font-bold text-[var(--text-primary)] leading-snug mb-2">{evt.title}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                                                                style={{ background: `${impInfo.color}15`, color: impInfo.color }}>
                                                                {impInfo.label}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Expand icon */}
                                                    <div className="shrink-0 mt-1 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-start">
                                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                </div>

                                                {/* Expanded content */}
                                                {isExpanded && (
                                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                                        {evt.description && (
                                                            <div className="px-5 pb-4 text-[13px] text-[var(--text-secondary)] leading-relaxed"
                                                                style={{ borderTop: '1px solid var(--border-color)' }}>
                                                                <p className="pt-3">{evt.description}</p>
                                                            </div>
                                                        )}
                                                        {/* Actions */}
                                                        <div className="px-5 pb-3 flex items-center gap-2 bg-[var(--bg-app)] pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                                            <button onClick={e => { e.stopPropagation(); openEdit(evt); }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:text-[var(--text-primary)]"
                                                                style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                                                                <Pencil className="w-3.5 h-3.5" /> Sửa sự kiện
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); handleDelete(evt.id); }}
                                                                disabled={deletingId === evt.id}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ml-auto disabled:opacity-50 transition-colors hover:bg-red-500/20"
                                                                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                                                                {deletingId === evt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                                Xóa
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* End cap */}
                            <div className="relative flex items-center justify-center w-full mt-4">
                                <div className="w-4 h-4 rounded-full border-4 border-[var(--bg-app)]" style={{ background: 'var(--border-color)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
