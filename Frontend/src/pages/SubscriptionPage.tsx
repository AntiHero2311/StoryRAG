import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BarChart2,
    CheckCircle2,
    Clock3,
    Crown,
    CreditCard,
    Loader2,
    MessageSquare,
    Shield,
    Sparkles,
    Star,
    TrendingUp,
    TriangleAlert,
    Zap,
    Calendar,
    Wallet,
    Check,
    XCircle,
    History,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { subscriptionService, type UserSubscription } from '../services/subscriptionService';
import { paymentService, type PaymentResponse } from '../services/paymentService';
import type { UserInfo } from '../utils/jwtHelper';

type UsageTone = 'violet' | 'amber';

function PaymentHistorySection({ payments, loading }: { payments: PaymentResponse[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 border border-white/10 rounded-3xl bg-[#111827]/50 mt-6">
                <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
            </div>
        );
    }

    return (
        <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between px-2">
                <h4 className="text-xl font-black text-white flex items-center gap-2.5 tracking-tight uppercase">
                    <History className="w-5 h-5 text-fuchsia-400" /> Lịch sử thanh toán
                </h4>
            </div>

            <div className="rounded-[2rem] border border-white/10 overflow-hidden bg-[#0a0a0a]/60 shadow-2xl backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-500">Mô tả</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-500">Ngày giao dịch</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-500">Số tiền</th>
                                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-500 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-40">
                                            <Wallet className="w-10 h-10 mb-2" />
                                            <p className="text-sm font-semibold text-zinc-400">Bạn chưa có lịch sử giao dịch nào.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">{p.planName || 'Gói dịch vụ'}</span>
                                                <span className="text-[11px] font-medium text-zinc-500 mt-0.5 tracking-tight">{p.transactionId || 'Giao dịch hệ thống'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-zinc-400">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span className="text-xs font-semibold">{new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-white">
                                                {p.amount.toLocaleString('vi-VN')}đ
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                {p.status === 'Completed' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                                        <Check className="w-3 h-3" /> Thành công
                                                    </div>
                                                ) : p.status === 'Pending' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                                        <Clock3 className="w-3 h-3" /> Đang xử lý
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest">
                                                        <XCircle className="w-3 h-3" /> Thất bại
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function DowngradeNotice({ sub }: { sub: UserSubscription }) {
    if (!sub.nextPlanId) return null;

    return (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-500">
            <TriangleAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
                <p className="text-sm font-bold text-amber-200">Thông báo hạ cấp gói</p>
                <p className="text-xs leading-relaxed text-amber-100/80">
                    Bạn đã đăng ký hạ xuống gói <span className="font-black text-amber-300">[{sub.nextPlanName}]</span>. 
                    Gói này sẽ chính thức có hiệu lực vào ngày <span className="font-black text-amber-300">[{new Date(sub.endDate).toLocaleDateString('vi-VN')}]</span>. 
                    Từ giờ đến lúc đó, bạn vẫn tiếp tục sử dụng gói <span className="font-black text-white">[{sub.planName}]</span>.
                </p>
                <p className="text-[11px] font-semibold text-rose-300 mt-1">
                    * Lưu ý: Hệ thống không hoàn tiền chênh lệch cho chu kỳ hiện tại.
                </p>
            </div>
        </div>
    );
}

function UsageCard({
    label,
    used,
    max,
    treatAsUnlimited = false,
    icon: Icon,
    tone,
}: {
    label: string;
    used: number;
    max: number;
    treatAsUnlimited?: boolean;
    icon: React.ElementType;
    tone: UsageTone;
}) {
    const unlimited = treatAsUnlimited && max >= 9999;
    const pct = unlimited
        ? (used > 0 ? 12 : 0)
        : Math.min((used / Math.max(max, 1)) * 100, 100);
    const highUsage = !unlimited && pct >= 80;

    const gradient = highUsage
        ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
        : tone === 'violet'
            ? 'linear-gradient(90deg,#6366f1,#a855f7,#ec4899)'
            : 'linear-gradient(90deg,#f59e0b,#f97316,#fb7185)';

    return (
        <div
            className="rounded-2xl border p-4 space-y-3 shadow-lg"
            style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.18)' }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center border"
                        style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' }}
                    >
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-300">{label}</span>
                </div>
                <p className="text-sm font-extrabold text-white">
                    {used.toLocaleString()} <span className="text-zinc-400">/ {unlimited ? '∞' : max.toLocaleString()}</span>
                </p>
            </div>

            <div className="h-2.5 rounded-full overflow-hidden border border-white/10 bg-black/25">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: gradient }} />
            </div>

            {highUsage && (
                <p className="text-xs font-semibold flex items-center gap-1.5 text-amber-300">
                    <TriangleAlert className="w-3.5 h-3.5" /> Mức sử dụng đang gần chạm giới hạn.
                </p>
            )}
        </div>
    );
}

function EmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
    return (
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
            <section className="relative rounded-3xl border border-white/15 overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1f1147] via-[#2d1a64] to-[#0f172a]" />

                <div className="relative z-10 p-8 sm:p-9">
                    <div className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center border border-white/25 bg-[#111827]/90 backdrop-blur-0">
                        <CreditCard className="w-7 h-7 text-fuchsia-200" />
                    </div>

                    <h3 className="text-[30px] leading-tight font-black text-white tracking-tight">Chưa có gói dịch vụ</h3>
                    <p className="text-sm mt-3 max-w-xl leading-relaxed text-zinc-300">
                        Nâng cấp để mở khóa giới hạn cao hơn cho phân tích và token AI. Style này ưu tiên chiều sâu thị giác và cảm giác cao cấp.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                        <button
                            onClick={() => onNavigate('/plans')}
                            className="px-5 py-3 rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 transition-all hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', boxShadow: '0 14px 30px -10px rgba(217,70,239,0.55)' }}
                        >
                            <Zap className="w-4.5 h-4.5" /> Khám phá gói
                        </button>
                        <button
                            onClick={() => onNavigate('/plans')}
                            className="px-5 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2 border border-white/25 text-white bg-[#111827]/90 backdrop-blur-0 hover:bg-white/15"
                        >
                            Xem chi tiết <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid sm:grid-cols-3 lg:grid-cols-1 gap-3">
                {[
                    { icon: BarChart2, title: 'Phân tích sâu', desc: 'Đánh giá truyện nhiều lớp' },
                    { icon: Sparkles, title: 'Token AI lớn', desc: 'Viết mạch liền không ngắt' },
                    { icon: Shield, title: 'Bảo mật cao', desc: 'Dữ liệu mã hóa theo user' },
                ].map((item) => (
                    <article
                        key={item.title}
                        className="rounded-2xl p-4 border border-white/15 shadow-lg"
                        style={{ background: 'linear-gradient(145deg, rgba(76,29,149,0.85), rgba(17,24,39,0.9))' }}
                    >
                        <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-[#111827]/90 border border-white/15">
                            <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="text-xs mt-1 text-zinc-300">{item.desc}</p>
                    </article>
                ))}
            </section>
        </div>
    );
}

function ActiveSubscription({ 
    sub, 
    payments, 
    historyLoading, 
    onNavigate 
}: { 
    sub: UserSubscription; 
    payments: PaymentResponse[]; 
    historyLoading: boolean; 
    onNavigate: (path: string) => void 
}) {
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000));
    const totalDays = Math.max(1, Math.ceil((new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime()) / 86400000));
    const usedCycle = Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));
    const urgent = daysLeft <= 7;

    const quickStats = useMemo(
        () => [
            { icon: Clock3, label: 'Thời gian còn lại', value: `${daysLeft} ngày` },
            {
                icon: BarChart2,
                label: 'Lượt phân tích tối đa',
                value: sub.maxAnalysisCount >= 9999 ? 'Không giới hạn' : `${sub.maxAnalysisCount} lượt`,
            },
            { icon: MessageSquare, label: 'Token tối đa', value: `${(sub.maxTokenLimit / 1000).toFixed(0)}K` },
        ],
        [daysLeft, sub.maxAnalysisCount, sub.maxTokenLimit],
    );

    return (
        <div className="space-y-6">
            <DowngradeNotice sub={sub} />
            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-3">
                <section className="space-y-3">
                    <div className="relative rounded-3xl border border-white/15 overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#312e81] via-[#4c1d95] to-[#0f172a]" />

                        <div className="relative z-10 p-7 sm:p-8">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3 bg-white/12 border border-white/20 text-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Đang hoạt động
                                    </div>
                                    <h3 className="text-3xl sm:text-4xl font-black tracking-tight uppercase text-white">{sub.planName}</h3>
                                    <p className="text-sm mt-1.5 text-zinc-200">
                                        {sub.price === 0 ? 'Miễn phí' : `${sub.price.toLocaleString('vi-VN')}đ / tháng`}
                                    </p>
                                </div>
                                <div className="w-11 h-11 rounded-2xl bg-[#111827]/90 border border-white/20 flex items-center justify-center">
                                    <Crown className="w-6 h-6 text-amber-200" />
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl border border-white/25 p-4 bg-[#0b1220]/70">
                                <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-xs font-semibold text-zinc-300">Chu kỳ thanh toán</p>
                                    <p className="text-sm font-bold text-white">{daysLeft} ngày còn lại</p>
                                </div>

                                <div className="h-2.5 rounded-full overflow-hidden bg-black/45 border border-white/15">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${usedCycle}%`,
                                            background: urgent
                                                ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                                                : 'linear-gradient(90deg,#818cf8,#c084fc,#f472b6)',
                                        }}
                                    />
                                </div>

                                <div className="mt-2 flex justify-between text-xs text-zinc-300">
                                    <span>Bắt đầu: {new Date(sub.startDate).toLocaleDateString('vi-VN')}</span>
                                    <span>Kết thúc: {new Date(sub.endDate).toLocaleDateString('vi-VN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={() => onNavigate('/plans')}
                            className="w-full py-4 rounded-2xl text-sm font-black text-white transition-all hover:brightness-110 flex items-center justify-center gap-2 group"
                            style={{ 
                                background: 'linear-gradient(135deg,#a855f7,#ec4899)', 
                                boxShadow: '0 16px 32px -12px rgba(236,72,153,0.5)' 
                            }}
                        >
                            Quản lý / Gia hạn gói <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </section>

                <aside className="space-y-3">
                    <div className="rounded-3xl border border-white/15 p-5 shadow-xl bg-gradient-to-br from-[#111827] to-[#1f2937]">
                        <h4 className="text-base font-bold flex items-center gap-2 mb-4 text-white">
                            <TrendingUp className="w-4.5 h-4.5 text-fuchsia-300" /> Mức sử dụng
                        </h4>

                        <div className="space-y-4">
                            <UsageCard
                                label="Lượt phân tích"
                                used={sub.usedAnalysisCount}
                                max={sub.maxAnalysisCount}
                                treatAsUnlimited
                                icon={BarChart2}
                                tone="violet"
                            />
                            <UsageCard
                                label="Token AI"
                                used={sub.usedTokens}
                                max={sub.maxTokenLimit}
                                icon={MessageSquare}
                                tone="amber"
                            />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/15 p-5 shadow-xl bg-gradient-to-br from-[#1e1b4b] to-[#0f172a]">
                        <h4 className="text-sm font-bold mb-3 text-white inline-flex items-center gap-2">
                            <Star className="w-4 h-4 text-fuchsia-300" /> Tổng quan nhanh
                        </h4>
                        <div className="space-y-2.5">
                            {quickStats.map((item) => (
                                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5 bg-[#0f172a]/80">
                                    <p className="text-xs font-semibold flex items-center gap-1.5 text-zinc-300">
                                        <item.icon className="w-3.5 h-3.5" /> {item.label}
                                    </p>
                                    <p className="text-sm font-bold text-white">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            <PaymentHistorySection payments={payments} loading={historyLoading} />
        </div>
    );
}

function SubscriptionContent({ onNavigate }: { onNavigate: (path: string) => void }) {
    const [sub, setSub] = useState<UserSubscription | null>(null);
    const [payments, setPayments] = useState<PaymentResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        subscriptionService
            .getMySubscription()
            .then((data) => setSub(data))
            .finally(() => setLoading(false));

        paymentService
            .getPaymentHistory(1, 10)
            .then((res) => setPayments(res.payments))
            .finally(() => setHistoryLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex-1 min-h-[520px] flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-fuchsia-400" />
                    <p className="text-sm font-medium text-zinc-400">Đang tải thông tin gói dịch vụ...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg-app)' }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3 pb-8">
                <header className="mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <h2 className="text-3xl sm:text-[36px] leading-tight font-black tracking-tight text-[var(--text-primary)] dark:text-white">Gói dịch vụ</h2>
                    </div>
                </header>

                {sub ? (
                    <ActiveSubscription 
                        sub={sub} 
                        payments={payments} 
                        historyLoading={historyLoading}
                        onNavigate={onNavigate} 
                    />
                ) : (
                    <EmptyState onNavigate={onNavigate} />
                )}
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
