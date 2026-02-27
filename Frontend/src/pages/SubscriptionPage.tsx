import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, CheckCircle, Clock, BarChart2, MessageSquare,
    ArrowRight, AlertTriangle, Loader2, CreditCard,
    TrendingUp, Shield, Sparkles
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { subscriptionService, UserSubscription } from '../services/subscriptionService';
import { UserInfo } from '../utils/jwtHelper';

// ── Usage Bar ─────────────────────────────────────────────────────────────────
function UsageBar({ label, used, max, icon: Icon, color, gradient }: {
    label: string; used: number; max: number;
    icon: React.ElementType; color: string; gradient: string;
}) {
    const unlimited = max >= 9999;
    const pct = unlimited ? 8 : Math.min((used / max) * 100, 100);
    const isHigh = !unlimited && pct >= 80;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-right">
                    <span className={`text-sm font-bold ${isHigh ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                        {used.toLocaleString()}
                    </span>
                    <span className="text-[var(--text-secondary)] text-xs"> / {unlimited ? '∞' : max.toLocaleString()}</span>
                </div>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--text-primary)', opacity: 0.08 }}>
                <div className="absolute inset-0 rounded-full" style={{ background: 'var(--input-bg)' }} />
            </div>
            <div className="relative -mt-4">
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: `${pct}%`,
                            background: isHigh ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : gradient,
                        }}
                    />
                </div>
            </div>
            {isHigh && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3 h-3" /> Sắp đạt giới hạn
                </div>
            )}
        </div>
    );
}

// ── No Subscription Banner ────────────────────────────────────────────────────
function NoBanner({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <div className="space-y-5 px-1">
            {/* Hero card */}
            <div className="relative rounded-3xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <div className="h-40 relative"
                    style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 55%,#24243e 100%)' }}>
                    <div className="absolute inset-0"
                        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.25) 1px,transparent 1px)', backgroundSize: '22px 22px', opacity: 0.18 }} />
                    {/* Glowing orbs */}
                    <div className="absolute top-4 right-10 w-28 h-28 rounded-full blur-3xl opacity-40"
                        style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
                    <div className="absolute bottom-0 left-16 w-24 h-24 rounded-full blur-3xl opacity-30"
                        style={{ background: 'radial-gradient(circle,#f5a623,transparent)' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-2xl mx-auto mb-2 flex items-center justify-center shadow-2xl"
                                style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                <CreditCard className="w-7 h-7 text-white" />
                            </div>
                            <p className="text-white/70 text-xs font-semibold tracking-widest uppercase">Gói dịch vụ</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 text-center" style={{ background: 'var(--bg-surface)' }}>
                    <h3 className="text-[var(--text-primary)] font-bold text-xl mb-2">Bạn chưa có gói đăng ký</h3>
                    <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed max-w-sm mx-auto">
                        Nâng cấp ngay để mở khóa phân tích AI không giới hạn, lịch sử đầy đủ và nhiều tính năng cao cấp hơn.
                    </p>
                    <button
                        onClick={() => onNavigate('/plans')}
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)', boxShadow: '0 8px 24px rgba(245,166,35,0.35)' }}
                    >
                        <Zap className="w-4 h-4" /> Xem các gói dịch vụ <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Features teaser */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: BarChart2, label: 'Phân tích AI', sub: 'Toàn bộ bộ truyện', color: '#6366f1', bg: '#6366f115' },
                    { icon: Shield, label: 'Bảo mật', sub: 'Mã hóa AES-256', color: '#10b981', bg: '#10b98115' },
                    { icon: Sparkles, label: 'Token AI', sub: 'Hỏi đáp không giới hạn', color: '#f5a623', bg: '#f5a62315' },
                ].map(f => (
                    <div key={f.label} className="rounded-2xl p-4 text-center"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <div className="w-9 h-9 rounded-xl mx-auto mb-2.5 flex items-center justify-center"
                            style={{ background: f.bg }}>
                            <f.icon className="w-4 h-4" style={{ color: f.color }} />
                        </div>
                        <p className="text-[var(--text-primary)] text-xs font-bold leading-tight">{f.label}</p>
                        <p className="text-[var(--text-secondary)] text-[10px] mt-0.5 leading-tight">{f.sub}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Active Subscription ───────────────────────────────────────────────────────
function ActiveSub({ sub, onNavigate }: { sub: UserSubscription; onNavigate: (p: string) => void }) {
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000));
    const totalDays = Math.max(1, Math.ceil((new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime()) / 86400000));
    const progressPct = Math.max(5, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));
    const isUrgent = daysLeft <= 7;

    return (
        <div className="space-y-4 px-1">
            {/* Plan header */}
            <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <div className="relative px-6 pt-6 pb-14"
                    style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4c1d95 100%)' }}>
                    <div className="absolute inset-0 opacity-15"
                        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
                    <div className="absolute top-4 right-4 w-24 h-24 rounded-full blur-3xl opacity-40"
                        style={{ background: 'radial-gradient(circle,#f5a623,transparent)' }} />
                    <div className="relative flex items-start justify-between">
                        <div>
                            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Gói hiện tại</p>
                            <h2 className="text-white font-black text-3xl">{sub.planName}</h2>
                            <p className="text-indigo-200/60 text-sm mt-1">
                                {sub.price === 0 ? 'Miễn phí' : `${sub.price.toLocaleString('vi-VN')}đ/tháng`}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 text-xs font-bold">Active</span>
                        </div>
                    </div>
                </div>

                {/* Time remaining (overlaps) */}
                <div className="relative -mt-8 mx-5 rounded-2xl px-5 py-4 shadow-lg"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            <span className="text-[var(--text-secondary)] text-xs">Thời gian còn lại</span>
                        </div>
                        <span className={`text-sm font-bold ${isUrgent ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                            {daysLeft} ngày
                        </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                            style={{
                                width: `${progressPct}%`,
                                background: isUrgent ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                            }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1">
                        <span>{new Date(sub.startDate).toLocaleDateString('vi-VN')}</span>
                        <span>{new Date(sub.endDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                    {isUrgent && (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs text-rose-400"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Gói sắp hết hạn. Hãy gia hạn để không gián đoạn.
                        </div>
                    )}
                </div>
            </div>

            {/* Usage */}
            <div className="rounded-3xl p-5 space-y-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[var(--text-secondary)]" />
                        <h4 className="text-[var(--text-primary)] font-semibold text-sm">Mức sử dụng</h4>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Kỳ hiện tại</span>
                </div>
                <UsageBar
                    label="Phân tích bộ truyện"
                    used={sub.usedAnalysisCount} max={sub.maxAnalysisCount}
                    icon={BarChart2} color="#6366f1"
                    gradient="linear-gradient(90deg,#6366f1,#8b5cf6)"
                />
                <UsageBar
                    label="Token AI"
                    used={sub.usedTokens} max={sub.maxTokenLimit}
                    icon={MessageSquare} color="#f5a623"
                    gradient="linear-gradient(90deg,#f5a623,#f97316)"
                />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onNavigate('/plans')}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)', boxShadow: '0 6px 20px rgba(245,166,35,0.3)' }}>
                    <Zap className="w-4 h-4" /> Nâng cấp
                </button>
                <button onClick={() => onNavigate('/plans')}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <ArrowRight className="w-4 h-4" /> Gia hạn
                </button>
            </div>

            {/* Plan meta */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                {[
                    { label: 'Tên gói', value: sub.planName },
                    { label: 'Giá', value: sub.price === 0 ? 'Miễn phí' : `${sub.price.toLocaleString('vi-VN')}đ/tháng` },
                    { label: 'Phân tích tối đa', value: sub.maxAnalysisCount >= 9999 ? 'Không giới hạn' : `${sub.maxAnalysisCount} lần/tháng` },
                    { label: 'Token AI tối đa', value: `${(sub.maxTokenLimit / 1000).toFixed(0)}K/tháng` },
                ].map((row, i, arr) => (
                    <div key={row.label}
                        className={`flex items-center justify-between px-5 py-3 ${i !== arr.length - 1 ? 'border-b' : ''}`}
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <span className="text-[var(--text-secondary)] text-sm">{row.label}</span>
                        <span className="text-[var(--text-primary)] text-sm font-semibold">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function SubscriptionContent({ onNavigate }: { onNavigate: (p: string) => void }) {
    const [sub, setSub] = useState<UserSubscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        subscriptionService.getMySubscription()
            .then(data => setSub(data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-[#f5a623] mx-auto" />
                <p className="text-[var(--text-secondary)] text-sm">Đang tải thông tin gói...</p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="max-w-xl mx-auto py-7 px-5">
                {/* Page header */}
                <div className="mb-6">
                    <h2 className="text-[var(--text-primary)] font-black text-2xl">Gói dịch vụ</h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">
                        {sub ? 'Quản lý gói đăng ký và theo dõi mức sử dụng của bạn.' : 'Chọn gói phù hợp để bắt đầu sử dụng đầy đủ tính năng.'}
                    </p>
                </div>
                {sub ? <ActiveSub sub={sub} onNavigate={onNavigate} /> : <NoBanner onNavigate={onNavigate} />}
            </div>
        </div>
    );
}

export default function SubscriptionPage() {
    const navigate = useNavigate();
    return (
        <MainLayout pageTitle="Gói dịch vụ">
            {(_userInfo: UserInfo) => <SubscriptionContent onNavigate={navigate} />}
        </MainLayout>
    );
}
