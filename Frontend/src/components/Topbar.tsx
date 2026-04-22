import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Bell, ChevronDown, LogOut, User, Sparkles, X,
    Bug, Briefcase, AlertTriangle, Loader2, CheckCircle,
} from 'lucide-react';
import { getInitials } from '../utils/jwtHelper';
import { bugReportService, type BugCategory, type BugPriority } from '../services/bugReportService';
import { appNotificationService, type AppNotificationItem } from '../services/appNotificationService';

interface TopbarProps {
    fullName: string;
    role: string;
    pageTitle?: string;
    onLogout: () => void;
    onSettings?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getRoleBadge(role: string) {
    if (role === 'Admin') return { label: 'Admin', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' };
    if (role === 'Staff') return { label: 'Staff', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { label: 'Author', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' };
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

function formatNotificationTime(iso: string) {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
}

function getNotificationDot(type: AppNotificationItem['type']) {
    if (type === 'success') return '#22c55e';
    if (type === 'error') return '#f87171';
    if (type === 'warning') return '#fbbf24';
    return '#60a5fa';
}

// ── Bug Report Modal ───────────────────────────────────────────────────────────
function BugReportModal({ onClose }: { onClose: () => void }) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-color)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                        <Bug className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-primary)] font-bold text-base">Báo cáo lỗi</h2>
                        <p className="text-[var(--text-secondary)] text-xs">Mô tả vấn đề bạn gặp phải</p>
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

// ── Component ──────────────────────────────────────────────────────────────────
export default function Topbar({ fullName, role, pageTitle, onLogout, onSettings }: TopbarProps) {
    const navigate = useNavigate();
    const [userOpen, setUserOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotificationItem[]>(() => appNotificationService.getAll());
    const [showWelcome, setShowWelcome] = useState(false);
    const [bugModalOpen, setBugModalOpen] = useState(false);
    const badge = getRoleBadge(role);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Welcome toast — once per session
    useEffect(() => {
        if (!fullName || fullName === 'Người dùng') return;
        const key = 'welcomed_' + fullName;
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            setShowWelcome(true);
            const t = setTimeout(() => setShowWelcome(false), 4500);
            return () => clearTimeout(t);
        }
    }, [fullName]);

    useEffect(() => {
        const sync = () => setNotifications(appNotificationService.getAll());
        sync();
        return appNotificationService.subscribe(sync);
    }, []);

    return (
        <>
            {/* ── Welcome Toast ─────────────────────────────────────────── */}
            <div
                className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999]"
                style={{
                    opacity: showWelcome ? 1 : 0,
                    transform: showWelcome ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-16px)',
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                    pointerEvents: showWelcome ? 'auto' : 'none',
                }}
            >
                <div
                    className="flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl"
                    style={{
                        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                        border: '1px solid rgba(139,92,246,0.35)',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-semibold leading-tight">
                            {getGreeting()}, {fullName}! 👋
                        </p>
                        <p className="text-indigo-300 text-xs mt-0.5">Chào mừng bạn trở lại StoryNest.</p>
                    </div>
                    <button
                        onClick={() => setShowWelcome(false)}
                        className="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ── Header ────────────────────────────────────────────────── */}
            <header
                style={{ background: 'var(--bg-topbar)', borderBottom: '1px solid var(--border-color)' }}
                className="h-[68px] flex items-center px-6 py-5 gap-4 shrink-0 relative z-20"
            >
                {pageTitle && <h1 className="text-[var(--text-primary)] font-bold text-lg">{pageTitle}</h1>}
                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    {/* ── Bell / Notification ── */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                const nextOpen = !notifOpen;
                                setNotifOpen(nextOpen);
                                setUserOpen(false);
                                if (nextOpen) appNotificationService.markAllRead();
                            }}
                            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                                    style={{ background: '#ef4444' }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                                <div
                                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-[#f5a623]" />
                                            <span className="text-[var(--text-primary)] text-sm font-semibold">Thông báo</span>
                                        </div>
                                        <button onClick={() => setNotifOpen(false)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[var(--text-primary)]/5 text-[var(--text-secondary)] transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 px-4 gap-3 text-center">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                                style={{ background: 'var(--input-bg)' }}>
                                                <Bell className="w-6 h-6 text-[var(--text-secondary)] opacity-30" />
                                            </div>
                                            <p className="text-[var(--text-primary)] text-sm font-semibold">Chưa có thông báo</p>
                                            <p className="text-[var(--text-secondary)] text-xs leading-relaxed max-w-[180px]">
                                                Thông báo về phân tích AI và hoạt động dự án sẽ xuất hiện ở đây.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="max-h-[320px] overflow-y-auto">
                                            {notifications.slice(0, 12).map(item => (
                                                <div
                                                    key={item.id}
                                                    className="px-4 py-3 border-b last:border-b-0"
                                                    style={{ borderColor: 'var(--border-color)' }}>
                                                    <div className="flex items-start gap-2.5">
                                                        <span
                                                            className="mt-1 w-2 h-2 rounded-full shrink-0"
                                                            style={{ background: getNotificationDot(item.type) }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[var(--text-primary)] text-sm font-semibold leading-snug">
                                                                {item.title}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed">
                                                                {item.message}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)] text-[11px] mt-1.5 opacity-80">
                                                                {formatNotificationTime(item.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bug Report */}
                    <button
                        onClick={() => setBugModalOpen(true)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors text-[var(--text-secondary)] hover:text-amber-400"
                        title="Báo cáo lỗi"
                    >
                        <Bug className="w-4 h-4" />
                    </button>

                    {/* Settings */}
                    {onSettings && (
                        <button
                            onClick={onSettings}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* ── User dropdown ── */}
                <div className="relative">
                    <button
                        onClick={() => { setUserOpen(o => !o); setNotifOpen(false); }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors"
                    >
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                        >
                            {getInitials(fullName)}
                        </div>
                        <span className="text-[var(--text-primary)] text-sm font-medium max-w-[120px] truncate hidden sm:block">
                            {fullName}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {userOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
                            <div
                                className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden shadow-2xl z-50"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                            >
                                <div className="px-4 py-3 border-b border-[var(--border-color)]">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                                        >
                                            {getInitials(fullName)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[var(--text-primary)] text-sm font-semibold truncate">{fullName}</p>
                                            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setUserOpen(false); navigate('/profile'); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors"
                                >
                                    <User className="w-4 h-4 shrink-0" />
                                    Xem hồ sơ
                                </button>

                                {(role === 'Staff' || role === 'Admin') && (
                                    <button
                                        onClick={() => { setUserOpen(false); navigate('/staff'); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                                    >
                                        <Briefcase className="w-4 h-4 shrink-0" />
                                        Quản lý báo cáo
                                    </button>
                                )}

                                <div className="h-px bg-[var(--border-color)] mx-3" />

                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4 shrink-0" /> Đăng xuất
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header >

            {/* ── Bug Report Modal ──────────────────────────────────────── */}
            {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
        </>
    );
}
