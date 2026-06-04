import { useState } from 'react';
import { Bug, X, CheckCircle, AlertTriangle, Loader2, Upload, Trash2 } from 'lucide-react';
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
        imageUrl: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imagePreview, setImagePreview] = useState('');

    const getFullUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        const base = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7259/api';
        const cleanBase = base.endsWith('/api') ? base.slice(0, -4) : base;
        return `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError('Dung lượng ảnh tối đa là 5MB.');
            return;
        }

        setUploadingImage(true);
        setError('');
        try {
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);

            const url = await bugReportService.uploadImage(file);
            setForm(f => ({ ...f, imageUrl: url }));
        } catch {
            setError('Tải ảnh lên thất bại. Vui lòng thử lại.');
            setImagePreview('');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageRemove = () => {
        setForm(f => ({ ...f, imageUrl: '' }));
        setImagePreview('');
    };

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

                        {/* Category + Image Upload */}
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
                                <label className="block text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1.5">
                                    Ảnh minh chứng <span className="text-[var(--text-secondary)]/50 font-normal normal-case">(tùy chọn)</span>
                                </label>
                                {form.imageUrl || imagePreview ? (
                                    <div className="relative group w-full h-[41px] rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--input-bg)] flex items-center justify-between px-3">
                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                            <img 
                                                src={imagePreview || getFullUrl(form.imageUrl)} 
                                                alt="Bug screenshot" 
                                                className="w-6 h-6 object-cover rounded-md border border-[var(--border-color)] shrink-0"
                                            />
                                            <span className="text-xs text-[var(--text-secondary)] truncate">
                                                {uploadingImage ? 'Đang tải lên...' : 'Ảnh đính kèm'}
                                            </span>
                                        </div>
                                        {uploadingImage ? (
                                            <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={handleImageRemove}
                                                className="text-rose-400 hover:text-rose-500 p-1 rounded-md hover:bg-[var(--text-primary)]/5 transition-colors shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-1.5 w-full h-[41px] border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--input-bg)] hover:bg-[var(--text-primary)]/5 cursor-pointer transition-all text-[var(--text-secondary)]">
                                        <Upload className="w-4 h-4" />
                                        <span className="text-xs font-medium">Tải ảnh lên</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                )}
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
