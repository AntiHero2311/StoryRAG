import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Bell, ChevronDown, LogOut, User, Sparkles, X
} from 'lucide-react';
import { getInitials } from '../utils/jwtHelper';
import {
    bugReportService,
    type BugReportResponse,
} from '../services/bugReportService';
import { appNotificationService, type AppNotificationItem } from '../services/appNotificationService';
import { notificationService } from '../services/notificationService';
import BugReportModal from './BugReportModal';
import Modal from './ui/Modal';

interface TopbarProps {
    fullName: string;
    role: string;
    userId: string;
    avatarUrl?: string;
    pageTitle?: string;
    onLogout: () => void;
    onSettings?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getRoleBadge(role: string) {
    if (role === 'Admin') return { label: 'Admin', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/25' };
    if (role === 'Staff') return { label: 'Staff', bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/25' };
    return { label: 'Author', bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/25' };
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

function getNotificationTypeLabel(type: AppNotificationItem['type']) {
    if (type === 'success') return 'Thành công';
    if (type === 'error') return 'Lỗi';
    if (type === 'warning') return 'Cảnh báo';
    return 'Thông tin';
}

function getNotificationTypeStyle(type: AppNotificationItem['type']) {
    if (type === 'success') return { bg: 'rgba(34,197,94,0.12)', color: '#86efac', border: 'rgba(34,197,94,0.3)' };
    if (type === 'error') return { bg: 'rgba(248,113,113,0.12)', color: '#fca5a5', border: 'rgba(248,113,113,0.3)' };
    if (type === 'warning') return { bg: 'rgba(251,191,36,0.12)', color: '#fcd34d', border: 'rgba(251,191,36,0.3)' };
    return { bg: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: 'rgba(96,165,250,0.3)' };
}

function formatNotificationDateTime(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getSeenBugFeedbackMap(userId: string): Record<string, string> {
    try {
        const key = `storyrag:bug-feedback-seen-v1:${userId}`;
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
}

function saveSeenBugFeedbackMap(userId: string, data: Record<string, string>) {
    const key = `storyrag:bug-feedback-seen-v1:${userId}`;
    localStorage.setItem(key, JSON.stringify(data));
}

function getBugStatusLabel(status: BugReportResponse['status']) {
    switch (status) {
        case 'Open': return 'Mở';
        case 'InProgress': return 'Đang xử lý';
        case 'Resolved': return 'Đã giải quyết';
        case 'Closed': return 'Đã đóng';
        default: return status;
    }
}



// ── Component ──────────────────────────────────────────────────────────────────
export default function Topbar({ fullName, role, userId, avatarUrl, pageTitle, onLogout, onSettings }: TopbarProps) {
    const navigate = useNavigate();
    const bellRef = useRef<HTMLButtonElement>(null);
    const [userOpen, setUserOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifPanelPos, setNotifPanelPos] = useState({ top: 72, right: 20 });
    const [detailNotification, setDetailNotification] = useState<AppNotificationItem | null>(null);
    const [notifications, setNotifications] = useState<AppNotificationItem[]>(() => appNotificationService.getAll());
    const [serverNotifications, setServerNotifications] = useState<AppNotificationItem[]>([]);

    const [showWelcome, setShowWelcome] = useState(false);
    const [bugModalOpen, setBugModalOpen] = useState(false);
    const [imgError, setImgError] = useState(false);
    const badge = getRoleBadge(role);
    const getFullUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        const base = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7259/api';
        const cleanBase = base.endsWith('/api') ? base.slice(0, -4) : base;
        return `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`;
    };
    const avatarSrc = getFullUrl(avatarUrl);

    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);
    const mergedNotifications = [...serverNotifications, ...notifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unreadCount = mergedNotifications.filter(n => !n.isRead).length;

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
    }, [userId]);

    useEffect(() => {
        let disposed = false;
        const syncServerNotifications = async () => {
            if (!userId) {
                setServerNotifications([]);
                return;
            }
            try {
                const items = await notificationService.getMy(60);
                if (disposed) return;
                setServerNotifications(items.map(item => ({
                    id: `server:${item.id}`,
                    type: item.type,
                    title: item.title,
                    message: item.message,
                    createdAt: item.createdAt,
                    isRead: item.isRead,
                    tag: item.tag,
                })));
            } catch {
                if (!disposed) setServerNotifications([]);
            }
        };

        void syncServerNotifications();
        const intervalId = window.setInterval(() => { void syncServerNotifications(); }, 10000);
        return () => {
            disposed = true;
            window.clearInterval(intervalId);
        };
    }, [userId]);

    useEffect(() => {
        if (role !== 'Author' || !userId) return;

        let disposed = false;

        const syncFeedbackNotifications = async () => {
            try {
                const reports = await bugReportService.getMy();
                if (disposed) return;

                const seenMap = getSeenBugFeedbackMap(userId);
                let hasSeenUpdates = false;
                const existingTags = new Set(appNotificationService.getAll().map(n => n.tag).filter(Boolean));

                for (const report of reports) {
                    if (!report.updatedAt) continue;

                    const hasFeedback = Boolean(report.staffNote?.trim()) || report.status !== 'Open';
                    if (!hasFeedback) continue;

                    if (seenMap[report.id] === report.updatedAt) continue;

                    const tag = `bug-feedback:${report.id}:${report.updatedAt}`;
                    if (!existingTags.has(tag)) {
                        const statusLabel = getBugStatusLabel(report.status);
                        const message = report.staffNote?.trim()
                            ? `${report.title} • ${statusLabel}: ${report.staffNote}`
                            : `${report.title} • Trạng thái mới: ${statusLabel}`;

                        appNotificationService.add({
                            type: 'info',
                            title: 'Phản hồi từ Staff',
                            message,
                            tag,
                        });
                    }

                    seenMap[report.id] = report.updatedAt;
                    hasSeenUpdates = true;
                }

                if (hasSeenUpdates) {
                    saveSeenBugFeedbackMap(userId, seenMap);
                }
            } catch {
                // Không làm gián đoạn Topbar khi không tải được phản hồi.
            }
        };

        void syncFeedbackNotifications();
        const intervalId = window.setInterval(() => { void syncFeedbackNotifications(); }, 60000);

        return () => {
            disposed = true;
            window.clearInterval(intervalId);
        };
    }, [role, userId]);

    const updateNotifPanelPosition = useCallback(() => {
        const bell = bellRef.current;
        if (!bell) return;
        const rect = bell.getBoundingClientRect();
        setNotifPanelPos({
            top: rect.bottom + 8,
            right: Math.max(12, window.innerWidth - rect.right),
        });
    }, []);

    useEffect(() => {
        if (!notifOpen) return;
        updateNotifPanelPosition();
        window.addEventListener('resize', updateNotifPanelPosition);
        window.addEventListener('scroll', updateNotifPanelPosition, true);
        return () => {
            window.removeEventListener('resize', updateNotifPanelPosition);
            window.removeEventListener('scroll', updateNotifPanelPosition, true);
        };
    }, [notifOpen, updateNotifPanelPosition]);

    const handleNotificationClick = async (item: AppNotificationItem) => {
        setDetailNotification(item);

        if (!item.isRead && item.id.startsWith('server:')) {
            const notificationId = item.id.slice('server:'.length);
            setServerNotifications(prev =>
                prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));

            try {
                await notificationService.markRead(notificationId);
            } catch {
                // Không làm gián đoạn UI nếu request mark-read lỗi tạm thời.
            }
        }
    };



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
                style={{
                    background: 'var(--bg-topbar)',
                    borderBottom: '1px solid var(--border-color)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                }}
                className="h-[var(--topbar-height)] flex items-center px-5 gap-4 shrink-0 relative z-20"
            >
                {pageTitle && (
                    <h1 className="font-bold text-base" style={{ color: 'var(--text-bright)' }}>
                        {pageTitle}
                    </h1>
                )}
                <div className="flex-1" />

                <div className="flex items-center gap-2 ml-auto">
                    {/* ── Bell / Notification ── */}
                    <div className="relative">
                        <button
                            ref={bellRef}
                            onClick={() => {
                                const nextOpen = !notifOpen;
                                setNotifOpen(nextOpen);
                                setUserOpen(false);
                                if (nextOpen) {
                                    updateNotifPanelPosition();
                                    appNotificationService.markAllRead();
                                    setServerNotifications(prev => prev.map(item => item.isRead ? item : { ...item, isRead: true }));
                                    void notificationService.markAllRead();
                                }
                            }}
                            className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
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

                        {notifOpen && createPortal(
                            <>
                                <div className="fixed inset-0 z-[1200]" onClick={() => setNotifOpen(false)} />
                                <div
                                    className="fixed w-80 max-w-[calc(100vw-24px)] z-[1201] overflow-hidden animate-slide-in-right"
                                    style={{
                                        top: notifPanelPos.top,
                                        right: notifPanelPos.right,
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-2xl)',
                                        boxShadow: 'var(--shadow-xl)',
                                        backdropFilter: 'blur(16px)',
                                    }}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                                            <span className="text-[var(--text-primary)] text-sm font-semibold">Thông báo</span>
                                        </div>
                                        <div className="flex items-center gap-1">

                                            <button onClick={() => setNotifOpen(false)}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[var(--text-primary)]/5 text-[var(--text-secondary)] transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>



                                    {mergedNotifications.length === 0 ? (
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
                                        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
                                            {mergedNotifications.slice(0, 20).map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => { void handleNotificationClick(item); }}
                                                    className="w-full text-left px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                                                    style={{ borderColor: 'var(--border-color)' }}>
                                                    <div className="flex items-start gap-2.5">
                                                        <span
                                                            className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                                                            style={{ background: getNotificationDot(item.type) }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[var(--text-primary)] text-sm font-semibold leading-snug line-clamp-1">
                                                                {item.title}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)] text-xs mt-1 leading-relaxed line-clamp-2">
                                                                {item.message}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)] text-[11px] mt-1.5 opacity-80">
                                                                {formatNotificationTime(item.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>,
                            document.body,
                        )}
                    </div>


                    {/* Settings */}
                    {onSettings && (
                        <button
                            onClick={onSettings}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* ── User dropdown ── */}
                <div className="relative">
                    <button
                        onClick={() => { setUserOpen(o => !o); setNotifOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150"
                        style={{ background: 'var(--bg-hover)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-active)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    >
                        {avatarSrc && !imgError ? (
                            <img
                                src={avatarSrc}
                                alt="Avatar"
                                onError={() => setImgError(true)}
                                className="w-7 h-7 rounded-full object-cover"
                                style={{ boxShadow: '0 0 12px rgba(99,102,241,0.35)' }}
                            />
                        ) : (
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                                style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 12px rgba(99,102,241,0.35)' }}
                            >
                                {getInitials(fullName)}
                            </div>
                        )}
                        <span className="text-sm font-medium max-w-[120px] truncate hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                            {fullName}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${userOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                    </button>

                    {userOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setUserOpen(false)} />
                            <div
                                className="absolute right-0 top-full mt-2 w-56 z-50 overflow-hidden animate-scale-in"
                                style={{
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-2xl)',
                                    boxShadow: 'var(--shadow-xl)',
                                    backdropFilter: 'blur(16px)',
                                }}
                            >
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <div className="flex items-center gap-3">
                                        {avatarSrc && !imgError ? (
                                            <img
                                                src={avatarSrc}
                                                alt="Avatar"
                                                onError={() => setImgError(true)}
                                                className="w-9 h-9 rounded-full object-cover shrink-0"
                                                style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
                                            />
                                        ) : (
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                                                style={{ background: 'var(--gradient-brand)', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}
                                            >
                                                {getInitials(fullName)}
                                            </div>
                                        )}
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
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150"
                                    style={{ color: 'var(--text-secondary)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                                >
                                    <User className="w-4 h-4 shrink-0" />
                                    Xem hồ sơ
                                </button>

                                <div className="mx-3 my-1" style={{ height: '1px', background: 'var(--border-color)' }} />

                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150"
                                    style={{ color: 'var(--error)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
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

            {/* ── Notification Detail Modal ─────────────────────────────── */}
            <Modal
                isOpen={!!detailNotification}
                onClose={() => setDetailNotification(null)}
                title="Chi tiết thông báo"
                size="md"
            >
                {detailNotification && (() => {
                    const typeStyle = getNotificationTypeStyle(detailNotification.type);
                    return (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                                    style={{
                                        background: typeStyle.bg,
                                        color: typeStyle.color,
                                        borderColor: typeStyle.border,
                                    }}
                                >
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: getNotificationDot(detailNotification.type) }}
                                    />
                                    {getNotificationTypeLabel(detailNotification.type)}
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {formatNotificationTime(detailNotification.createdAt)}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug">
                                    {detailNotification.title}
                                </h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed whitespace-pre-wrap">
                                    {detailNotification.message}
                                </p>
                            </div>

                            <p className="text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]">
                                {formatNotificationDateTime(detailNotification.createdAt)}
                            </p>
                        </div>
                    );
                })()}
            </Modal>
        </>
    );
}
