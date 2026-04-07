import { useState, useEffect } from 'react';
import { Check, Zap, Star, Loader2, Crown, X, AlertCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { subscriptionService, SubscriptionPlan, UserSubscription } from '../services/subscriptionService';
import { UserInfo } from '../utils/jwtHelper';

// ── Plan visual config ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, {
    emoji: string;
    gradient: string;
    accentColor: string;
    borderGlow: string;
    popular?: boolean;
}> = {
    Free: {
        emoji: '🆓',
        gradient: 'from-slate-600 via-slate-700 to-slate-800',
        accentColor: 'text-slate-400',
        borderGlow: 'hover:shadow-[0_0_30px_-10px_rgba(148,163,184,0.3)]',
    },
    Basic: {
        emoji: '⚡',
        gradient: 'from-blue-500 via-indigo-600 to-blue-700',
        accentColor: 'text-blue-400',
        borderGlow: 'hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.4)]',
    },
    Pro: {
        emoji: '🚀',
        gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
        accentColor: 'text-purple-400',
        borderGlow: 'shadow-[0_0_30px_-10px_rgba(168,85,247,0.4)] ring-1 ring-purple-500/50 hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.5)]',
        popular: true,
    },
    Enterprise: {
        emoji: '👑',
        gradient: 'from-amber-400 via-orange-500 to-rose-600',
        accentColor: 'text-amber-400',
        borderGlow: 'hover:shadow-[0_0_30px_-10px_rgba(245,158,11,0.4)]',
    },
};

function getConfig(name: string) {
    return PLAN_CONFIG[name] ?? PLAN_CONFIG['Basic'];
}

function formatPrice(price: number) {
    if (price === 0) return { main: '0', sub: 'đ/tháng' };
    if (price >= 1000000) return { main: `${(price / 1000000).toFixed(0)}M`, sub: 'đ/tháng' };
    return { main: `${(price / 1000).toFixed(0)}K`, sub: 'đ/tháng' };
}

function getFeatures(plan: SubscriptionPlan) {
    return [
        plan.maxAnalysisCount >= 9999
            ? 'Phân tích không giới hạn'
            : `${plan.maxAnalysisCount} lần phân tích/tháng`,
        plan.maxTokenLimit >= 1_000_000
            ? `${(plan.maxTokenLimit / 1_000_000).toFixed(1)}M token AI/tháng`
            : `${(plan.maxTokenLimit / 1000).toFixed(0)}K token AI/tháng`,
        'Lịch sử phân tích',
        ...(plan.planName !== 'Free' ? ['Xuất báo cáo PDF'] : []),
        ...(plan.planName === 'Pro' || plan.planName === 'Enterprise' ? ['Hỗ trợ ưu tiên'] : []),
        ...(plan.planName === 'Enterprise' ? ['API access', 'SLA 99.9%'] : []),
    ];
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({
    plan, current, subscribing, onSelect,
}: {
    plan: SubscriptionPlan;
    current: UserSubscription | null;
    subscribing: boolean;
    onSelect: (plan: SubscriptionPlan) => void;
}) {
    const cfg = getConfig(plan.planName);
    const isCurrent = current?.planId === plan.id;
    const features = getFeatures(plan);
    const { main, sub } = formatPrice(plan.price);
    const isFree = plan.price === 0;

    return (
        <div className={`relative flex flex-col rounded-[2rem] glass-card border border-white/10 overflow-hidden transition-all duration-300 transform hover:-translate-y-2 ${cfg.borderGlow}`}>
            
            {/* Popular badge */}
            {cfg.popular && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600" />
            )}
            {cfg.popular && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-wider z-10 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                    <Star className="w-3 h-3 fill-purple-400 text-purple-400" /> Nổi bật
                </div>
            )}

            {/* Header */}
            <div className="p-8 relative overflow-hidden text-center">
                <div className="relative z-10">
                    <div className="text-4xl mb-3 drop-shadow-md">{cfg.emoji}</div>
                    <h3 className="text-white font-black text-xl uppercase tracking-widest mb-4 opacity-90 drop-shadow-sm">{plan.planName}</h3>
                    
                    <div className="flex items-end justify-center gap-1 mb-2">
                        <span className="font-black text-5xl leading-none text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 drop-shadow-sm">{main}</span>
                        <span className="text-zinc-500 text-sm font-semibold mb-1">{sub}</span>
                    </div>
                    {plan.description && (
                        <p className="text-zinc-400 text-xs mt-4 leading-relaxed font-medium px-2">{plan.description}</p>
                    )}
                </div>
            </div>

            <div className="px-8 flex-1 flex flex-col justify-end">
                {/* Features */}
                <div className="space-y-4 py-6 border-t border-white/5">
                    {features.map(f => (
                        <div key={f} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white/5 border border-white/10 shadow-inner">
                                <Check className={`w-3 h-3 ${cfg.accentColor}`} />
                            </div>
                            <span className="text-zinc-300 text-sm font-medium">{f}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            <div className="p-8 pt-0 mt-auto">
                {isCurrent ? (
                    <div className="w-full py-4 rounded-xl text-center text-[15px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                        ✓ Đang sử dụng
                    </div>
                ) : (
                    <button
                        id={`plan-select-${plan.id}`}
                        onClick={() => onSelect(plan)}
                        disabled={subscribing}
                        className={`w-full py-4 rounded-xl text-white text-[15px] font-bold transition-all duration-300 flex items-center justify-center gap-2 
                        bg-gradient-to-r ${cfg.gradient} 
                        hover:brightness-110 hover:shadow-lg active:scale-95 disabled:opacity-50 shadow-inner`}
                    >
                        {isFree ? '🆓 Dùng miễn phí' : 'Nâng cấp ngay'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Modals ────────────────────────────────────────────────────────
function FreeConfirmModal({ plan, onClose, onSuccess }: {
    plan: SubscriptionPlan;
    onClose: () => void;
    onSuccess: (sub: UserSubscription) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        try {
            const sub = await subscriptionService.subscribe(plan.id);
            setDone(true);
            onSuccess(sub);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#090514]/80 backdrop-blur-md">
            <div className="w-full max-w-[400px] glass-card rounded-[2rem] border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden relative">
                
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors z-20"
                >
                    <X className="w-4 h-4" />
                </button>

                {!done ? (
                    <>
                        <div className="relative p-8 pb-6 text-center border-b border-white/5 overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/20 blur-[50px] rounded-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-400/10 blur-[40px] rounded-full pointer-events-none" />
                            
                            <div className="relative z-10">
                                <div className="text-5xl mb-4 drop-shadow-md">🆓</div>
                                <h3 className="text-white font-black text-2xl tracking-tight mb-2">Gói Khởi Điểm</h3>
                                <p className="text-zinc-400 text-[13px] font-medium leading-relaxed">
                                    Hoàn toàn miễn phí — trải nghiệm sức mạnh AI <br/>không cần thẻ thanh toán.
                                </p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* What you get */}
                            <div className="rounded-2xl p-5 bg-white/5 border border-white/10 space-y-3.5 shadow-inner">
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Quyền lợi:</div>
                                {getFeatures(plan).map(f => (
                                    <div key={f} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-slate-500/20 text-slate-300">
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-zinc-200 text-sm font-semibold">{f}</span>
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[13px] font-medium shadow-inner">
                                    <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[15px] font-bold transition-all duration-300"
                                >
                                    Trở lại
                                </button>
                                <button
                                    id="free-plan-confirm-btn"
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="flex-1 py-3.5 rounded-xl text-white text-[15px] font-bold transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800 hover:brightness-110 shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</> : 'Bắt đầu ngay'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-10 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                        <div className="relative z-10 space-y-5">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                <Check className="w-10 h-10 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-2xl tracking-tight mb-2">Đăng ký thành công!</h3>
                                <p className="text-zinc-400 text-[15px] font-medium leading-relaxed">
                                    Chào mừng bạn đến với thế giới của StoryNest. Bạn đã có thể bắt đầu sáng tác.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full mt-4 py-4 rounded-xl text-white font-bold text-[15px] transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 shadow-lg active:scale-95"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PaidPlanModal({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
    const cfg = getConfig(plan.planName);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#090514]/80 backdrop-blur-md">
            <div className="w-full max-w-[400px] glass-card rounded-[2rem] border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden relative">
                
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors z-20"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="relative p-8 pb-6 text-center border-b border-white/5 overflow-hidden">
                     <div className={`absolute top-0 right-0 w-32 h-32 blur-[50px] rounded-full pointer-events-none opacity-20 bg-gradient-to-tr ${cfg.gradient}`} />
                     <div className="relative z-10">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-inner">
                            <Crown className={`w-8 h-8 ${cfg.accentColor}`} />
                        </div>
                        <h3 className="text-white font-black text-2xl tracking-tight mb-2 uppercase">{cfg.emoji} {plan.planName}</h3>
                        <p className="text-zinc-400 text-sm font-semibold">
                            {formatPrice(plan.price).main}{formatPrice(plan.price).sub}
                        </p>
                    </div>
                </div>

                <div className="p-8 space-y-6 text-center relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#101010] to-transparent pointer-events-none opacity-50" />
                    <p className="text-zinc-300 text-[15px] leading-relaxed font-medium relative z-10 px-2">
                        Tính năng thanh toán đang được hoàn thiện. <br/>
                        Cảm ơn bạn đã quan tâm đến mục tiêu hỗ trợ StoryNest với gói nâng cấp siêu việt này.
                    </p>
                    <button
                        onClick={onClose}
                        className={`w-full py-4 rounded-xl text-white text-[15px] font-bold transition-all bg-gradient-to-r ${cfg.gradient} hover:brightness-110 shadow-lg active:scale-95 relative z-10`}
                    >
                        Đã hiểu & Quay lại
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Content ──────────────────────────────────────────────────────────────
function PlansContent() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [current, setCurrent] = useState<UserSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
    const [subscribing, setSubscribing] = useState(false);

    useEffect(() => {
        Promise.all([
            subscriptionService.getPlans(),
            subscriptionService.getMySubscription(),
        ]).then(([p, s]) => {
            setPlans(p);
            setCurrent(s as UserSubscription | null);
        }).finally(() => setLoading(false));
    }, []);

    const handleSuccess = (sub: UserSubscription) => {
        setCurrent(sub);
        setSubscribing(false);
    };

    if (loading) return (
        <div className="flex-1 flex items-center justify-center min-h-[500px]">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto w-full relative">
            
            {/* Background effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
            <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="py-16 px-6 relative z-10">
                {/* Hero */}
                <div className="text-center mb-16 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-zinc-200 text-[13px] font-bold tracking-widest uppercase">Phá vỡ giới hạn</span>
                    </div>
                    
                    <h2 className="text-4xl md:text-5xl font-black mb-6 text-white tracking-tight leading-tight">
                        Chọn quyền năng <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-purple-400">kiến tạo thế giới của bạn</span>
                    </h2>
                    
                    <p className="text-zinc-400 text-lg mx-auto leading-relaxed font-medium">
                        Toàn quyền sử dụng bộ công cụ AI thông minh để xây dựng tiểu thuyết, nhân vật và thiết kế cốt truyện theo mong muốn.
                    </p>
                    
                    {current && (
                        <div className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold shadow-inner">
                            <Check className="w-5 h-5 text-indigo-400" /> Gói hiện hành: {current.planName}
                        </div>
                    )}
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-[1300px] mx-auto auto-rows-fr">
                    {plans.map(plan => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            current={current}
                            subscribing={subscribing}
                            onSelect={setSelected}
                        />
                    ))}
                </div>

                {/* FAQ note */}
                <div className="text-center mt-20 pb-10 text-zinc-500 text-sm font-medium">
                    Bạn cần tư vấn thêm? Liên hệ với chúng tôi tại{' '}
                    <a href="mailto:support@storynest.vn" className="text-indigo-400 font-bold hover:text-indigo-300 hover:underline transition-colors">support@storynest.vn</a>
                </div>
            </div>

            {/* Modals */}
            {selected && selected.price === 0 && (
                <FreeConfirmModal
                    plan={selected}
                    onClose={() => setSelected(null)}
                    onSuccess={handleSuccess}
                />
            )}
            {selected && selected.price > 0 && (
                <PaidPlanModal
                    plan={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}

export default function PlansPage() {
    return (
        <MainLayout pageTitle="Bảng giá">
            {(_: UserInfo) => <PlansContent />}
        </MainLayout>
    );
}
