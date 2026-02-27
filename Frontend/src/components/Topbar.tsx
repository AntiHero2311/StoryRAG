import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Bell, ChevronDown, LogOut, User, Sparkles, X,
    BookOpen, CheckCircle, AlertCircle, Info, Check
} from 'lucide-react';
import { getInitials } from '../utils/jwtHelper';

interface TopbarProps {
    fullName: string;
    role: string;
    pageTitle?: string;
    onLogout: () => void;
    onSettings?: () => void;
}

// ── Sample notifications ───────────────────────────────────────────────────────
interface Notif {
    id: number;
    type: 'info' | 'success' | 'warning';
    title: string;
    desc: string;
    time: string;
    read: boolean;
}

const SAMPLE_NOTIFS: Notif[] = [
    { id: 1, type: 'success', title: 'Phân tích hoàn tất', desc: 'Dự án "Kiếm khách" đã được phân tích xong.', time: '5 phút trước', read: false },
    { id: 2, type: 'info', title: 'Dự án mới được thêm', desc: 'Bạn vừa tạo dự án "Truyện ngắn 2025".', time: '1 giờ trước', read: false },
    { id: 3, type: 'warning', title: 'Hạn mức sắp đạt', desc: 'Bạn đã dùng 80% dung lượng lưu trữ.', time: '3 giờ trước', read: false },
    { id: 4, type: 'info', title: 'Cập nhật hệ thống', desc: 'StoryNest v2.1 đã được triển khai thành công.', time: 'Hôm qua', read: true },
    { id: 5, type: 'success', title: 'Xuất file thành công', desc: 'Báo cáo phân tích đã được xuất ra PDF.', time: 'Hôm qua', read: true },
];

const NOTIF_ICON = {
    info: { Icon: Info, bg: 'bg-blue-500/15', color: 'text-blue-400' },
    success: { Icon: CheckCircle, bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
    warning: { Icon: AlertCircle, bg: 'bg-amber-500/15', color: 'text-amber-400' },
};

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

// ── Component ──────────────────────────────────────────────────────────────────
export default function Topbar({ fullName, role, pageTitle, onLogout, onSettings }: TopbarProps) {
    const navigate = useNavigate();
    const [userOpen, setUserOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifs, setNotifs] = useState<Notif[]>(SAMPLE_NOTIFS);
    const [showWelcome, setShowWelcome] = useState(false);
    const badge = getRoleBadge(role);

    const unreadCount = notifs.filter(n => !n.read).length;

    const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    const markRead = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

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
                className="h-[68px] flex items-center px-6 gap-4 shrink-0 relative z-20"
            >
                {pageTitle && <h1 className="text-[var(--text-primary)] font-bold text-lg">{pageTitle}</h1>}
                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    {/* ── Bell / Notification ── */}
                    <div className="relative">
                        <button
                            onClick={() => { setNotifOpen(o => !o); setUserOpen(false); }}
                            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[#f5a623] text-white text-[9px] font-bold leading-none">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {notifOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                                <div
                                    className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-[#f5a623]" />
                                            <span className="text-[var(--text-primary)] text-sm font-semibold">Thông báo</span>
                                            {unreadCount > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[10px] font-bold">
                                                    {unreadCount} mới
                                                </span>
                                            )}
                                        </div>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllRead}
                                                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            >
                                                <Check className="w-3 h-3" /> Đánh dấu tất cả đã đọc
                                            </button>
                                        )}
                                    </div>

                                    {/* Notification list */}
                                    <div className="max-h-[340px] overflow-y-auto scrollbar-thin">
                                        {notifs.map(n => {
                                            const { Icon, bg, color } = NOTIF_ICON[n.type];
                                            return (
                                                <button
                                                    key={n.id}
                                                    onClick={() => markRead(n.id)}
                                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--text-primary)]/5 ${!n.read ? 'bg-[var(--text-primary)]/[0.03]' : ''}`}
                                                >
                                                    {/* Icon */}
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                                                        <Icon className={`w-4 h-4 ${color}`} />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={`text-xs font-semibold leading-snug ${n.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                                                                {n.title}
                                                            </p>
                                                            {!n.read && (
                                                                <span className="w-2 h-2 rounded-full bg-[#f5a623] shrink-0 mt-1" />
                                                            )}
                                                        </div>
                                                        <p className="text-[var(--text-secondary)] text-[11px] mt-0.5 leading-snug">{n.desc}</p>
                                                        <p className="text-[var(--text-secondary)] text-[10px] mt-1 opacity-50">{n.time}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Footer */}
                                    <div className="px-4 py-2.5 border-t border-[var(--border-color)]">
                                        <button className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                            <BookOpen className="w-3.5 h-3.5" /> Xem tất cả thông báo
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

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
        </>
    );
}
