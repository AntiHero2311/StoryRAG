import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Bell, ChevronDown, LogOut, User, Sparkles, X,
} from 'lucide-react';
import { getInitials } from '../utils/jwtHelper';

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

// ── Component ──────────────────────────────────────────────────────────────────
export default function Topbar({ fullName, role, pageTitle, onLogout, onSettings }: TopbarProps) {
    const navigate = useNavigate();
    const [userOpen, setUserOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const badge = getRoleBadge(role);

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

                                    {/* Empty state */}
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
