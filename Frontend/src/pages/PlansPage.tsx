import { useState, useEffect } from 'react';
import { Check, Zap, Star, Loader2, Crown, X, AlertCircle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { subscriptionService, SubscriptionPlan, UserSubscription } from '../services/subscriptionService';
import { UserInfo } from '../utils/jwtHelper';

// ── Plan visual config ────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, {
    gradient: string;
    bgCard: string;
    popular?: boolean;
    emoji: string;
    accentColor: string;
}> = {
    Free: {
        gradient: 'linear-gradient(135deg, #475569, #334155)',
        bgCard: 'rgba(71,85,105,0.08)',
        emoji: '🆓',
        accentColor: '#64748b',
    },
    Basic: {
        gradient: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
        bgCard: 'rgba(59,130,246,0.08)',
        emoji: '⚡',
        accentColor: '#3b82f6',
    },
    Pro: {
        gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        bgCard: 'rgba(139,92,246,0.08)',
        popular: true,
        emoji: '🚀',
        accentColor: '#8b5cf6',
    },
    Enterprise: {
        gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)',
        bgCard: 'rgba(245,158,11,0.08)',
        emoji: '👑',
        accentColor: '#f59e0b',
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
            : `${(plan.maxTokenLimit / 1_000).toFixed(0)}K token AI/tháng`,
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
        <div
            className={`relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${cfg.popular ? 'ring-2' : ''}`}
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                ...(cfg.popular ? { boxShadow: `0 0 0 2px ${cfg.accentColor}50` } : {}),
            }}
        >
            {/* Popular badge */}
            {cfg.popular && (
                <div
                    className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[10px] font-bold z-10"
                    style={{ background: cfg.gradient }}
                >
                    <Star className="w-3 h-3 fill-white" /> Phổ biến
                </div>
            )}

            {/* Gradient header */}
            <div className="p-6 text-white" style={{ background: cfg.gradient }}>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">
                    {cfg.emoji} {plan.planName}
                </p>
                <div className="flex items-end gap-1">
                    <span className="font-black text-5xl leading-none">{main}</span>
                    <span className="text-white/60 text-sm mb-1">{sub}</span>
                </div>
                {plan.description && (
                    <p className="text-white/60 text-xs mt-3 leading-relaxed">{plan.description}</p>
                )}
                {isCurrent && (
                    <span className="inline-block mt-3 px-3 py-1 rounded-xl bg-white/20 text-white text-[10px] font-bold">
                        ✓ Gói hiện tại của bạn
                    </span>
                )}
            </div>

            {/* Features */}
            <div className="flex-1 p-5 space-y-2.5">
                {features.map(f => (
                    <div key={f} className="flex items-center gap-2.5">
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${cfg.accentColor}20`, border: `1px solid ${cfg.accentColor}40` }}
                        >
                            <Check className="w-3 h-3" style={{ color: cfg.accentColor }} />
                        </div>
                        <span className="text-[var(--text-secondary)] text-sm">{f}</span>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="p-5 pt-0">
                {isCurrent ? (
                    <div
                        className="w-full py-3 rounded-2xl text-center text-sm font-semibold border"
                        style={{
                            background: `${cfg.accentColor}10`,
                            borderColor: `${cfg.accentColor}30`,
                            color: cfg.accentColor,
                        }}
                    >
                        ✓ Đang sử dụng
                    </div>
                ) : (
                    <button
                        id={`plan-select-${plan.id}`}
                        onClick={() => onSelect(plan)}
                        disabled={subscribing}
                        className="w-full py-3 rounded-2xl text-white text-sm font-bold transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: cfg.gradient }}
                    >
                        {isFree ? '🆓 Dùng miễn phí' : 'Chọn gói này'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Free Confirm Modal ────────────────────────────────────────────────────────
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--text-primary)]/10 text-[var(--text-secondary)] transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                {!done ? (
                    <>
                        {/* Header */}
                        <div className="p-6 text-center" style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}>
                            <div className="text-4xl mb-2">🆓</div>
                            <h3 className="text-white font-bold text-xl">Gói Free</h3>
                            <p className="text-white/60 text-sm mt-1">Hoàn toàn miễn phí — không cần thanh toán</p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* What you get */}
                            <div
                                className="rounded-2xl p-4 space-y-2"
                                style={{ background: 'rgba(71,85,105,0.08)', border: '1px solid rgba(71,85,105,0.2)' }}
                            >
                                {getFeatures(plan).map(f => (
                                    <div key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                        <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {f}
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 py-3 rounded-2xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-semibold hover:bg-[var(--text-primary)]/5 transition-all"
                                >
                                    Huỷ
                                </button>
                                <button
                                    id="free-plan-confirm-btn"
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="flex-1 py-3 rounded-2xl text-white text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}
                                >
                                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng ký...</> : 'Xác nhận'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Success state */
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-[var(--text-primary)] font-bold text-xl">Đăng ký thành công! 🎉</h3>
                        <p className="text-[var(--text-secondary)] text-sm">
                            Bạn đã kích hoạt gói <strong>Free</strong>. Bắt đầu sử dụng ngay!
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}
                        >
                            Bắt đầu
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Paid Plan Modal ───────────────────────────────────────────────────────────
function PaidPlanModal({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
    const cfg = getConfig(plan.planName);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
            >
                <div className="p-6 text-center" style={{ background: cfg.gradient }}>
                    <Crown className="w-10 h-10 text-white mx-auto mb-2" />
                    <h3 className="text-white font-bold text-xl">{cfg.emoji} {plan.planName}</h3>
                    <p className="text-white/60 text-sm mt-1">
                        {formatPrice(plan.price).main}{formatPrice(plan.price).sub}
                    </p>
                </div>
                <div className="p-6 space-y-4 text-center">
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                        Tính năng thanh toán đang được phát triển. Vui lòng liên hệ hỗ trợ để nâng cấp lên gói{' '}
                        <strong className="text-[var(--text-primary)]">{plan.planName}</strong>.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-2xl text-white text-sm font-bold hover:opacity-90 transition-all"
                        style={{ background: cfg.gradient }}
                    >
                        Đã hiểu
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
        <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#f5a623]" />
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Hero */}
            <div className="text-center py-12 px-6">
                <div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[#f5a623] text-xs font-bold border"
                    style={{ background: 'rgba(245,166,35,0.1)', borderColor: 'rgba(245,166,35,0.3)' }}
                >
                    <Zap className="w-3.5 h-3.5" /> Chọn gói phù hợp
                </div>
                <h2 className="text-[var(--text-primary)] font-black text-4xl mb-3">
                    Nâng cấp tài khoản
                </h2>
                <p className="text-[var(--text-secondary)] text-sm max-w-md mx-auto leading-relaxed">
                    Tất cả gói bao gồm phân tích AI, quản lý dự án và xuất báo cáo tự động.
                </p>
                {current && (
                    <div
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-2xl text-sm font-medium"
                        style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623' }}
                    >
                        <Check className="w-4 h-4" /> Gói hiện tại: <strong>{current.planName}</strong>
                    </div>
                )}
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 px-6 pb-12 max-w-6xl mx-auto">
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
            <div className="text-center pb-10 text-[var(--text-secondary)] text-xs">
                Cần hỗ trợ? Liên hệ team qua{' '}
                <span className="text-[#f5a623] font-semibold cursor-pointer hover:underline">support@storynest.vn</span>
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
