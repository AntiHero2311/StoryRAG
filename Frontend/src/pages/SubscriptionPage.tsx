import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap, CheckCircle, Clock, BarChart2, MessageSquare,
    ArrowRight, AlertTriangle, Loader2, CreditCard,
    TrendingUp, Shield, Sparkles, Crown
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
        <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 shadow-inner">
                        <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-right">
                    <span className={`text-[15px] font-black ${isHigh ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 'text-white'}`}>
                        {used.toLocaleString()}
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold"> / {unlimited ? '∞' : max.toLocaleString()}</span>
                </div>
            </div>
            {/* Track track */}
            <div className="relative h-3 w-full rounded-full overflow-hidden bg-black/20 border border-white/5 shadow-inner">
                {/* Fill */}
                <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.3)] relative overflow-hidden"
                    style={{
                        width: `${pct}%`,
                        background: isHigh ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : gradient,
                    }}
                >
                    <div className="absolute inset-0 bg-white/20 w-full h-full rounded-full mix-blend-overlay" />
                </div>
            </div>
            {isHigh && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 px-1 drop-shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5" /> Chú ý, sắp đạt giới hạn!
                </div>
            )}
        </div>
    );
}

// ── No Subscription Banner ────────────────────────────────────────────────────
function NoBanner({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <div className="space-y-6">
            {/* Hero card */}
            <div className="relative rounded-[2rem] overflow-hidden glass-card shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] border border-white/10">
                <div className="h-44 relative bg-gradient-to-tr from-[#0f0c29] via-[#302b63] to-[#24243e] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
                    {/* Glowing orbs */}
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[50px] opacity-50 bg-indigo-500" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-[40px] opacity-40 bg-fuchsia-500" />
                    
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center mt-4">
                            <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white/10 border border-white/20 shadow-2xl backdrop-blur-md">
                                <CreditCard className="w-8 h-8 text-fuchsia-300" />
                            </div>
                            <p className="text-fuchsia-200/80 text-[11px] font-black tracking-[0.2em] uppercase">Gói dịch vụ</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 text-center relative z-10 glass-card">
                    <h3 className="text-white font-black text-2xl tracking-tight mb-3">Chưa có gói đăng ký nào</h3>
                    <p className="text-zinc-400 text-[15px] font-medium mb-8 leading-relaxed max-w-sm mx-auto">
                        Nâng cấp ngay để mở khóa phân tích AI không giới hạn, lưu trữ lịch sử và tiếp cận tính năng cao cấp.
                    </p>
                    <button
                        onClick={() => onNavigate('/plans')}
                        className="inline-flex items-center justify-center gap-2 w-full max-w-xs py-4 rounded-xl font-bold text-[15px] text-white transition-all duration-300 
                        bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 hover:brightness-110 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.5)] active:scale-95"
                    >
                        <Zap className="w-5 h-5 fill-white" /> Khám phá gói dịch vụ
                    </button>
                </div>
            </div>

            {/* Features teaser */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { icon: BarChart2, label: 'Phân tích', sub: 'Chuyên sâu toàn bộ', color: '#818cf8', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                    { icon: Shield, label: 'Bảo mật', sub: 'AES-256 cao cấp', color: '#34d399', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { icon: Sparkles, label: 'Token AI', sub: 'Tối đa hoá ý tưởng', color: '#fbbf24', bg: 'bg-amber-500/10 border-amber-500/20' },
                ].map(f => (
                    <div key={f.label} className="rounded-[1.5rem] p-5 text-center glass-card border border-white/5 shadow-lg transition-transform hover:-translate-y-1">
                        <div className={`w-12 h-12 rounded-2xl mx-auto mb-3.5 flex items-center justify-center border shadow-inner ${f.bg}`}>
                            <f.icon className="w-5 h-5" style={{ color: f.color }} />
                        </div>
                        <p className="text-white text-[13px] font-black tracking-wide leading-tight mb-1">{f.label}</p>
                        <p className="text-zinc-500 text-[11px] font-semibold leading-tight">{f.sub}</p>
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
        <div className="space-y-6">
            {/* Plan header */}
            <div className="rounded-[2rem] overflow-hidden glass-card shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 relative">
                <div className="relative px-8 pt-8 pb-16 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-fuchsia-900/40" />
                    <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[60px] opacity-40 bg-fuchsia-500 mix-blend-screen" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] opacity-40 bg-indigo-500 mix-blend-screen" />
                    
                    <div className="relative flex items-start justify-between z-10">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-3 shadow-inner">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                                <span className="text-emerald-300 text-[10px] font-black uppercase tracking-widest">Đang kích hoạt</span>
                            </div>
                            <h2 className="text-white font-black text-4xl tracking-tight mb-1 drop-shadow-lg uppercase">{sub.planName}</h2>
                            <p className="text-zinc-300 font-medium text-sm">
                                {sub.price === 0 ? 'Gói Miễn Phí Trọn Đời' : `${sub.price.toLocaleString('vi-VN')}đ/tháng`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Time remaining (overlaps) */}
                <div className="relative -mt-10 mx-6 mb-6 rounded-2xl p-6 glass-card border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-zinc-400" />
                            <span className="text-zinc-300 text-[13px] font-bold">Thời gian còn lại</span>
                        </div>
                        <span className={`text-[15px] font-black ${isUrgent ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 'text-white'}`}>
                            {daysLeft} ngày
                        </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-black/30 border border-white/5 shadow-inner relative">
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                            style={{
                                width: `${progressPct}%`,
                                background: isUrgent ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#818cf8,#c084fc)',
                            }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-zinc-500 mt-2">
                        <span>Bắt đầu: {new Date(sub.startDate).toLocaleDateString('vi-VN')}</span>
                        <span>Hết hạn: {new Date(sub.endDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                    {isUrgent && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-[13px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 shadow-inner">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Thời hạn sắp hết! Hãy gia hạn ngay để không gián đoạn trải nghiệm chữ.
                        </div>
                    )}
                </div>
            </div>

            {/* Usage */}
            <div className="rounded-[2rem] p-7 space-y-7 glass-card border border-white/10 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                            <TrendingUp className="w-4 h-4 text-zinc-300" />
                        </div>
                        <h4 className="text-white font-bold text-[17px]">Mức sử dụng</h4>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300 font-bold uppercase tracking-widest shadow-inner">Kỳ hiện hành</span>
                </div>
                
                <div className="space-y-6 relative z-10">
                    <UsageBar
                        label="Lượt Phân Tích Bộ Truyện"
                        used={sub.usedAnalysisCount} max={sub.maxAnalysisCount}
                        icon={BarChart2} color="#818cf8"
                        gradient="linear-gradient(90deg,#6366f1,#8b5cf6)"
                    />
                    <UsageBar
                        label="Token Hệ Sinh Thái AI"
                        used={sub.usedTokens} max={sub.maxTokenLimit}
                        icon={MessageSquare} color="#fbbf24"
                        gradient="linear-gradient(90deg,#f5a623,#f97316)"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => onNavigate('/plans')}
                    className="flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-[15px] text-white transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_30px_-5px_rgba(245,158,11,0.4)] active:scale-95 bg-gradient-to-r from-amber-500 to-orange-600 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Zap className="w-5 h-5 fill-white" /> Nâng cấp ngay
                </button>
                <button onClick={() => onNavigate('/plans')}
                    className="flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-[15px] text-white transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg active:scale-95 glass-card border border-white/10 hover:bg-white/5">
                    <ArrowRight className="w-5 h-5" /> Quản lý Gói
                </button>
            </div>

            {/* Plan meta */}
            <div className="rounded-[1.5rem] overflow-hidden glass-card border border-white/10">
                {[
                    { label: 'Tên gói đăng ký', value: sub.planName },
                    { label: 'Sự đầu tư (Giá)', value: sub.price === 0 ? 'Miễn phí' : `${sub.price.toLocaleString('vi-VN')}đ` },
                    { label: 'Lượt phân tích cấp phát', value: sub.maxAnalysisCount >= 9999 ? 'Vô Hạn' : `${sub.maxAnalysisCount} lượt` },
                    { label: 'Hạn mức Token AI', value: `${(sub.maxTokenLimit / 1000).toFixed(0)}K Tokens` },
                ].map((row, i, arr) => (
                    <div key={row.label}
                        className={`flex items-center justify-between px-6 py-4 ${i !== arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                        <span className="text-zinc-400 text-[13px] font-semibold">{row.label}</span>
                        <span className="text-white text-[14px] font-bold">{row.value}</span>
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
        <div className="flex-1 flex items-center justify-center min-h-[500px]">
            <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-fuchsia-500 mx-auto drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
                <p className="text-zinc-400 text-[15px] font-semibold animate-pulse">Đang nạp dữ liệu không gian...</p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin relative min-h-screen">
            
            {/* Global ambient background glow for subscription dashboard */}
            <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
            <div className="absolute top-[40%] left-[-10%] w-[350px] h-[350px] bg-fuchsia-600/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="max-w-xl mx-auto py-10 px-5 relative z-10 pb-24">
                {/* Page header */}
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl glass-card border border-white/10 mb-4 shadow-lg">
                        <Crown className="w-6 h-6 text-fuchsia-400" />
                    </div>
                    <h2 className="text-white font-black text-3xl tracking-tight mb-2">Bảng Điều Khiển Gói</h2>
                    <p className="text-zinc-400 font-medium text-[15px] max-w-[400px] mx-auto leading-relaxed">
                        {sub 
                            ? 'Làm chủ quyền năng sáng tạo lưu lượng AI của bạn trong chu kỳ hiện tại.' 
                            : 'Mở khóa quyền năng phân tích siêu việt để đưa tác phẩm của bạn lên tầm cao mới.'}
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
