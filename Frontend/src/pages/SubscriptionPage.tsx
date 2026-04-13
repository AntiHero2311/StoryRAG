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
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { subscriptionService, type UserSubscription } from '../services/subscriptionService';
import type { UserInfo } from '../utils/jwtHelper';

type UsageTone = 'violet' | 'amber';

function UsageCard({
    label,
    used,
    max,
    icon: Icon,
    tone,
}: {
    label: string;
    used: number;
    max: number;
    icon: React.ElementType;
    tone: UsageTone;
}) {
    const unlimited = max >= 9999;
    const pct = unlimited ? 12 : Math.min((used / Math.max(max, 1)) * 100, 100);
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

function ActiveSubscription({ sub, onNavigate }: { sub: UserSubscription; onNavigate: (path: string) => void }) {
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

                <div className="grid sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => onNavigate('/plans')}
                        className="py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
                        style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', boxShadow: '0 16px 28px -12px rgba(236,72,153,0.55)' }}
                    >
                        Nâng cấp / Gia hạn
                    </button>
                    <button
                        onClick={() => onNavigate('/plans')}
                        className="py-3.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 border border-white/20 text-white bg-gradient-to-r from-slate-800/90 to-slate-700/90 hover:from-slate-700/90 hover:to-slate-600/90"
                    >
                        Quản lý gói <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </section>

            <aside className="space-y-3">
                <div className="rounded-3xl border border-white/15 p-5 shadow-xl bg-gradient-to-br from-[#111827] to-[#1f2937]">
                    <h4 className="text-base font-bold flex items-center gap-2 mb-4 text-white">
                        <TrendingUp className="w-4.5 h-4.5 text-fuchsia-300" /> Mức sử dụng
                    </h4>

                    <div className="space-y-4">
                        <UsageCard label="Lượt phân tích" used={sub.usedAnalysisCount} max={sub.maxAnalysisCount} icon={BarChart2} tone="violet" />
                        <UsageCard label="Token AI" used={sub.usedTokens} max={sub.maxTokenLimit} icon={MessageSquare} tone="amber" />
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
    );
}

function SubscriptionContent({ onNavigate }: { onNavigate: (path: string) => void }) {
    const [sub, setSub] = useState<UserSubscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        subscriptionService
            .getMySubscription()
            .then((data) => setSub(data))
            .finally(() => setLoading(false));
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

                {sub ? <ActiveSubscription sub={sub} onNavigate={onNavigate} /> : <EmptyState onNavigate={onNavigate} />}
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
