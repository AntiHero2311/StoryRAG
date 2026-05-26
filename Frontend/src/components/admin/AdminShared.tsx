import type { ReactNode } from 'react';

export function fmtNum(n: number | undefined) {
    return (n ?? 0).toLocaleString('vi-VN');
}

export function fmtTokens(n: number | undefined) {
    const v = n ?? 0;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
}

export function StatCard({
    icon: Icon, label, value, sub, color, iconColor,
}: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; color: string; iconColor: string;
}) {
    return (
        <div className={`flex items-start gap-4 p-5 rounded-2xl border ${color} backdrop-blur-sm`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-0.5 truncate">{label}</p>
                <p className="text-2xl font-bold leading-none">{typeof value === 'number' ? fmtNum(value) : value}</p>
                {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

export function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] w-28 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-[var(--text-primary)]/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-[var(--text-primary)] w-8 text-right">{fmtNum(value)}</span>
        </div>
    );
}

export function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: ReactNode }) {
    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
            </div>
            {children}
        </div>
    );
}

export const roleStyle = (role: string) => {
    if (role === 'Admin') return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (role === 'Staff') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
};

export const roleLabel = (role: string) =>
    ({ Admin: 'Admin', Author: 'Tác giả', Staff: 'Nhân viên' } as Record<string, string>)[role] ?? role;

export function AdminPageShell({ title, children, action }: {
    title: string; children: ReactNode; action?: ReactNode;
}) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>
            <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
                    {action}
                </div>
                {children}
            </main>
        </div>
    );
}
