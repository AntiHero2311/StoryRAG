import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    exiting?: boolean;
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (type: ToastType, message: string, duration?: number) => void;
    dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: string) => {
        // Trigger exit animation first
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220);
    }, []);

    const toast = useCallback((type: ToastType, message: string, duration = 3500) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message, duration }]);
        setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');

    return {
        success: (msg: string, duration?: number) => ctx.toast('success', msg, duration),
        error: (msg: string, duration?: number) => ctx.toast('error', msg, duration),
        warning: (msg: string, duration?: number) => ctx.toast('warning', msg, duration),
        info: (msg: string, duration?: number) => ctx.toast('info', msg, duration),
    };
}

// ── Toast UI ───────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    error: <XCircle className="w-4 h-4 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
    info: <Info className="w-4 h-4 shrink-0" />,
};

const STYLES: Record<ToastType, { border: string; icon: string; bg: string }> = {
    success: {
        bg: 'var(--bg-surface)',
        border: 'var(--success)',
        icon: 'var(--success)',
    },
    error: {
        bg: 'var(--bg-surface)',
        border: 'var(--error)',
        icon: 'var(--error)',
    },
    warning: {
        bg: 'var(--bg-surface)',
        border: 'var(--warning)',
        icon: 'var(--warning)',
    },
    info: {
        bg: 'var(--bg-surface)',
        border: 'var(--info)',
        icon: 'var(--info)',
    },
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
            aria-live="polite"
        >
            {toasts.map(t => {
                const s = STYLES[t.type];
                return (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full ${t.exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
                        style={{
                            background: s.bg,
                            border: `1px solid var(--border-color)`,
                            borderLeft: `3px solid ${s.border}`,
                        }}
                    >
                        <span style={{ color: s.icon }}>{ICONS[t.type]}</span>
                        <p className="text-sm leading-snug flex-1" style={{ color: 'var(--text-primary)' }}>
                            {t.message}
                        </p>
                        <button
                            onClick={() => onDismiss(t.id)}
                            className="shrink-0 opacity-40 hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
