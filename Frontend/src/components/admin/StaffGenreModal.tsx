import { useState, useEffect } from 'react';
import { X, BookOpen, Loader2, CheckCircle2 } from 'lucide-react';
import { adminService, type UserSummary, type GenreInfo } from '../../services/adminService';

interface AllGenre {
    id: number;
    name: string;
    slug: string;
    color: string;
    description?: string | null;
}

interface Props {
    staff: UserSummary;
    allGenres: AllGenre[];
    onClose: () => void;
    onSaved: (updated: UserSummary) => void;
}

export default function StaffGenreModal({ staff, allGenres, onClose, onSaved }: Props) {
    const [selected, setSelected] = useState<Set<number>>(
        new Set((staff.genres ?? []).map((g: GenreInfo) => g.id))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setSelected(new Set((staff.genres ?? []).map((g: GenreInfo) => g.id)));
    }, [staff]);

    const toggle = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const updated = await adminService.assignStaffGenres(staff.id, Array.from(selected));
            onSaved(updated);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string; Message?: string } } };
            setError(e?.response?.data?.message ?? e?.response?.data?.Message ?? 'Lỗi khi lưu.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-color)]">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                            Thể loại chuyên môn
                        </h2>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            {staff.fullName} · {staff.email}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                {/* Genre list */}
                <div className="flex-1 overflow-y-auto p-5">
                    <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                        Chọn thể loại truyện mà staff này chuyên phụ trách. Author sẽ thấy thông tin này khi xem phản hồi từ staff.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {allGenres.map(genre => {
                            const isSelected = selected.has(genre.id);
                            return (
                                <button
                                    key={genre.id}
                                    type="button"
                                    onClick={() => toggle(genre.id)}
                                    className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150"
                                    style={{
                                        borderColor: isSelected ? genre.color : 'var(--border-color)',
                                        background: isSelected ? `${genre.color}18` : 'transparent',
                                    }}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ background: genre.color }}
                                    />
                                    <span
                                        className="text-sm font-medium flex-1"
                                        style={{ color: isSelected ? genre.color : 'var(--text-primary)' }}
                                    >
                                        {genre.name}
                                    </span>
                                    {isSelected && (
                                        <CheckCircle2
                                            className="w-4 h-4 flex-shrink-0"
                                            style={{ color: genre.color }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[var(--border-color)] space-y-3">
                    {selected.size > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {allGenres
                                .filter(g => selected.has(g.id))
                                .map(g => (
                                    <span
                                        key={g.id}
                                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                        style={{ background: `${g.color}25`, color: g.color }}
                                    >
                                        {g.name}
                                    </span>
                                ))}
                        </div>
                    )}
                    {error && <p className="text-xs text-rose-400">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-semibold hover:bg-white/5 transition-colors"
                            style={{ color: 'var(--text-secondary)' }}>
                            Huỷ
                        </button>
                        <button type="button" onClick={() => void handleSave()} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {saving ? 'Đang lưu…' : `Lưu (${selected.size} thể loại)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
