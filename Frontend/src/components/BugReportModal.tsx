import { useState } from 'react';
import { Bug, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { bugReportService, type BugCategory, type BugPriority } from '../services/bugReportService';

interface BugReportModalProps {
    onClose: () => void;
}

export default function BugReportModal({ onClose }: BugReportModalProps) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'Bug' as BugCategory,
        priority: 'Medium' as BugPriority,
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.description.trim()) {
            setError('Vui lòng điền tiêu đề và mô tả.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await bugReportService.create(form);
            setSuccess(true);
            setTimeout(onClose, 1800);
        } catch {
            setError('Gửi báo cáo thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md overflow-hidden shadow-2xl animate-scale-in"
                style={{ 
                    background: 'var(--bg-modal)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-3xl)', 
                    boxShadow: 'var(--shadow-2xl)' 
                }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                        <Bug className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-primary)] font-bold text-base">Hỗ trợ & Báo lỗi</h2>
                        <p className="text-[var(--text-secondary)] text-xs">Chúng tôi luôn lắng nghe ý kiến của bạn</p>
                    </div>
                    <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {success ? (
                    <div className="flex flex-col items-center gap-3 py-12 px-6">
                        <CheckCircle className="w-12 h-12 text-emerald-400" />
                        <p className="text-[var(--text-primary)] font-semibold">Đã gửi báo cáo!</p>
                        <p className="text-[var(--text-secondary)] text-sm text-center">Cảm ơn bạn. Chúng tôi sẽ xem xét sớm.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                                Tiêu đề <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Mô tả ngắn về lỗi..."
                                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                            />
                        </div>

                        {/* Category + Priority */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Loại</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value as BugCategory }))}
                                    className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-amber-500/30 appearance-none"
                                >
                                    <option value="Bug">🐛 Lỗi kỹ thuật</option>
                                    <option value="UX">🎨 Giao diện / UX</option>
                                    <option value="Feature">✨ Đề xuất tính năng</option>
                                    <option value="Other">💬 Khác</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">Mức độ</label>
                                <select
                                    value={form.priority}
                                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as BugPriority }))}
                                    className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-amber-500/30 appearance-none"
                                >
                                    <option value="Low">🟢 Thấp</option>
                                    <option value="Medium">🟡 Trung bình</option>
                                    <option value="High">🔴 Cao</option>
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                                Mô tả chi tiết <span className="text-rose-400">*</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Mô tả lỗi, các bước tái hiện, kết quả mong muốn..."
                                rows={4}
                                className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                            />
                        </div>

                        {error && (
                            <p className="text-rose-400 text-sm flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                            </p>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors">
                                Hủy
                            </button>
                            <button type="submit" disabled={loading}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Gửi báo cáo
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
