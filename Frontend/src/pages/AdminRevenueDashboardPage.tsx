import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calendar,
    CreditCard,
    DollarSign,
    Loader2,
    Package,
    Percent,
    RefreshCw,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import {
    AdminPageShell,
    Section,
    StatCard,
    fmtNum,
} from '../components/admin/AdminShared';
import {
    adminService,
    type AdminRevenueDashboard,
    type MonthlyRevenueItem,
    type PlanRevenueItem,
} from '../services/adminService';

const PLAN_COLORS = [
    { bar: 'bg-indigo-500', text: 'text-indigo-400', hex: '#6366f1' },
    { bar: 'bg-violet-500', text: 'text-violet-400', hex: '#8b5cf6' },
    { bar: 'bg-emerald-500', text: 'text-emerald-400', hex: '#10b981' },
    { bar: 'bg-sky-500', text: 'text-sky-400', hex: '#0ea5e9' },
    { bar: 'bg-rose-500', text: 'text-rose-400', hex: '#f43f5e' },
    { bar: 'bg-amber-500', text: 'text-amber-400', hex: '#f59e0b' },
];

function fmtCurrency(n: number) {
    return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
}

function fmtCurrencyShort(n: number) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

function monthOptions() {
    const now = new Date();
    const items: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 18; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        items.push({
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            label: `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`,
        });
    }
    return items;
}

const selectClass =
    'rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-shadow';

function ChartCard({ title, subtitle, children, className = '' }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`glass-card rounded-2xl p-5 flex flex-col ${className}`}>
            <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{title}</p>
                {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex-1 min-h-0">{children}</div>
        </div>
    );
}

function VerticalBarChart({
    items,
    formatValue,
}: {
    items: { label: string; value: number; colorClass: string }[];
    formatValue: (v: number) => string;
}) {
    const max = Math.max(...items.map(i => i.value), 1);
    if (items.length === 0) {
        return (
            <p className="text-sm text-[var(--text-secondary)] flex-1 flex items-center justify-center py-12">
                Chưa có dữ liệu trong tháng này
            </p>
        );
    }
    return (
        <div className="flex items-end justify-center gap-2 sm:gap-4 flex-1 min-h-[160px] px-1 pb-1">
            {items.map(item => (
                <div key={item.label} className="flex flex-col items-center gap-2 flex-1 max-w-[88px] group">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatValue(item.value)}
                    </span>
                    <div className="w-full flex flex-col justify-end h-[130px]">
                        <div
                            className={`w-full rounded-t-lg ${item.colorClass} opacity-90 group-hover:opacity-100 transition-all duration-300 shadow-[0_-4px_20px_rgba(99,102,241,0.15)]`}
                            style={{ height: `${Math.max(10, (item.value / max) * 120)}px` }}
                            title={`${item.label}: ${formatValue(item.value)}`}
                        />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--text-primary)] text-center truncate w-full leading-tight">
                        {item.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

function MonthlyBarChart({ data }: { data: MonthlyRevenueItem[] }) {
    const max = Math.max(...data.map(d => d.revenue), 1);
    if (data.length === 0) {
        return <p className="text-sm text-[var(--text-secondary)] text-center py-16">Chưa có dữ liệu xu hướng</p>;
    }
    return (
        <div className="space-y-3">
            <div className="flex items-end gap-1.5 h-[180px] px-0.5">
                {data.map((d, i) => (
                    <div key={d.label} className="flex-1 flex flex-col items-center gap-2 min-w-0 group">
                        <span className="text-[9px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-full">
                            {fmtCurrencyShort(d.revenue)}
                        </span>
                        <div className="w-full flex flex-col justify-end flex-1 min-h-0">
                            <div
                                className="w-full rounded-t-md min-h-[6px] transition-all duration-300 group-hover:brightness-110"
                                style={{
                                    height: `${Math.max(6, (d.revenue / max) * 150)}px`,
                                    background: `linear-gradient(180deg, ${PLAN_COLORS[i % PLAN_COLORS.length].hex}99, ${PLAN_COLORS[i % PLAN_COLORS.length].hex})`,
                                }}
                                title={`${d.label}: ${fmtCurrency(d.revenue)} · ${d.orderCount} đơn`}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {data.map(d => (
                    <span
                        key={d.label}
                        className="flex-1 min-w-0 text-center text-[9px] text-[var(--text-tertiary)] truncate"
                        title={d.label}
                    >
                        {d.label.replace('Tháng ', '').replace('/', '/')}
                    </span>
                ))}
            </div>
        </div>
    );
}

function GrowthLineChart({ data }: { data: MonthlyRevenueItem[] }) {
    const points = data.filter(d => d.growthPercent != null);
    if (points.length < 2) {
        return <p className="text-sm text-[var(--text-secondary)] py-16 text-center">Chưa đủ dữ liệu tăng trưởng</p>;
    }
    const values = points.map(p => p.growthPercent ?? 0);
    const min = Math.min(...values, -15);
    const max = Math.max(...values, 15);
    const range = max - min || 1;
    const w = 400;
    const h = 140;
    const padY = 12;
    const coords = points.map((p, i) => {
        const x = 20 + (i / (points.length - 1)) * (w - 40);
        const y = padY + (h - padY * 2) - ((p.growthPercent! - min) / range) * (h - padY * 2);
        return { x, y, p };
    });
    const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
    const zeroY = padY + (h - padY * 2) - ((0 - min) / range) * (h - padY * 2);

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${w} ${h + 28}`} className="w-full min-w-[280px] h-[180px]">
                <line x1="20" y1={zeroY} x2={w - 20} y2={zeroY} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <defs>
                    <linearGradient id="growth-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                    <linearGradient id="growth-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99,102,241,0.25)" />
                        <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                    </linearGradient>
                </defs>
                <polygon
                    fill="url(#growth-area-grad)"
                    points={`${coords[0].x},${zeroY} ${linePoints} ${coords[coords.length - 1].x},${zeroY}`}
                />
                <polyline fill="none" stroke="url(#growth-line-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
                {coords.map(({ x, y, p }) => (
                    <g key={p.label}>
                        <circle cx={x} cy={y} r="4" fill="#818cf8" stroke="var(--bg-surface)" strokeWidth="2" />
                        <title>{`${p.label}: ${p.growthPercent! > 0 ? '+' : ''}${p.growthPercent}%`}</title>
                    </g>
                ))}
            </svg>
            <div className="flex justify-between text-[9px] text-[var(--text-tertiary)] px-5 -mt-1">
                <span>{points[0]?.label}</span>
                <span>{points[points.length - 1]?.label}</span>
            </div>
        </div>
    );
}

export default function AdminRevenueDashboardPage() {
    const navigate = useNavigate();
    const months = useMemo(() => monthOptions(), []);
    const now = new Date();

    const [year, setYear] = useState(now.getUTCFullYear());
    const [month, setMonth] = useState(now.getUTCMonth() + 1);
    const [planId, setPlanId] = useState<string>('all');
    const [data, setData] = useState<AdminRevenueDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const pid = planId === 'all' ? undefined : Number(planId);
            const res = await adminService.getRevenueDashboard(year, month, pid);
            setData(res);
        } catch {
            setError('Không tải được báo cáo doanh thu.');
        } finally {
            setLoading(false);
        }
    }, [year, month, planId]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        void load();
    }, [load, navigate]);

    const planBars = useMemo(() => {
        if (!data) return [];
        return data.revenueByPlan.map((p, i) => ({
            label: p.planName,
            value: p.revenue,
            colorClass: PLAN_COLORS[i % PLAN_COLORS.length].bar,
        }));
    }, [data]);

    const orderBars = useMemo(() => {
        if (!data) return [];
        return data.revenueByPlan.map((p, i) => ({
            label: p.planName,
            value: p.orderCount,
            colorClass: PLAN_COLORS[i % PLAN_COLORS.length].bar,
        }));
    }, [data]);

    const growth = data?.revenueGrowthPercent ?? 0;
    const growthUp = growth >= 0;
    const totalPlanRevenue = data?.revenueByPlan.reduce((s, p) => s + p.revenue, 0) ?? 0;

    /** Khi "Tất cả gói": tỷ lệ đơn Completed / tổng lần tạo đơn trong tháng. Khi chọn 1 gói: % doanh thu gói đó trong tháng. */
    const rateKpi = useMemo(() => {
        if (!data) return { value: 0, label: 'Tỷ lệ thanh toán', sub: '' };
        if (planId === 'all') {
            return {
                value: data.paymentSuccessRate,
                label: 'Tỷ lệ thanh toán thành công',
                sub: 'Đơn hoàn tất ÷ tổng lần tạo đơn (kể cả hủy/thất bại)',
            };
        }
        const sel = data.revenueByPlan.find(p => String(p.planId) === planId);
        const share = totalPlanRevenue && sel
            ? Math.round((sel.revenue / totalPlanRevenue) * 1000) / 10
            : 0;
        const name = data.plans.find(p => String(p.planId) === planId)?.planName ?? 'Gói đã chọn';
        return {
            value: share,
            label: 'Thị phần doanh thu',
            sub: `${name} trong tổng doanh thu tháng`,
        };
    }, [data, planId, totalPlanRevenue]);

    const selectedMonthLabel = months.find(m => m.year === year && m.month === month)?.label ?? `Tháng ${month}/${year}`;

    return (
        <MainLayout pageTitle="Báo cáo doanh thu">
            {() => (
                <AdminPageShell
                    title="Báo cáo doanh thu"
                    action={
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                to="/admin"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/30 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Tổng quan
                            </Link>
                            <button
                                type="button"
                                onClick={() => void load()}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)] hover:border-indigo-500/40 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Làm mới
                            </button>
                        </div>
                    }
                >
                    {/* Filters */}
                    <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                                <Calendar className="w-3.5 h-3.5" />
                                Tháng báo cáo
                            </label>
                            <select
                                value={`${year}-${month}`}
                                onChange={e => {
                                    const [y, m] = e.target.value.split('-').map(Number);
                                    setYear(y);
                                    setMonth(m);
                                }}
                                className={`w-full sm:max-w-xs ${selectClass}`}
                            >
                                {months.map(m => (
                                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                                <Package className="w-3.5 h-3.5" />
                                Gói (xu hướng 12 tháng)
                            </label>
                            <select
                                value={planId}
                                onChange={e => setPlanId(e.target.value)}
                                className={`w-full sm:max-w-xs ${selectClass}`}
                                disabled={!data}
                            >
                                <option value="all">Tất cả gói</option>
                                {data?.plans.map((p: PlanRevenueItem) => (
                                    <option key={p.planId} value={String(p.planId)}>
                                        {p.planName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {data && (
                            <div className="sm:ml-auto text-right">
                                <p className="text-xs text-[var(--text-tertiary)]">Đang xem</p>
                                <p className="text-sm font-semibold text-[var(--text-bright)]">{selectedMonthLabel}</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                            {error}
                        </div>
                    )}

                    {loading && !data ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                            <p className="text-sm text-[var(--text-secondary)]">Đang tải báo cáo…</p>
                        </div>
                    ) : null}

                    {data && (
                        <>
                            {/* KPI row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <StatCard
                                    icon={DollarSign}
                                    label="Tổng doanh thu"
                                    value={fmtCurrency(data.totalRevenue)}
                                    sub={`${fmtNum(data.totalCompletedOrders)} đơn thành công`}
                                    color="border-indigo-500/25 text-indigo-200"
                                    iconColor="bg-indigo-500/15 text-indigo-400"
                                />
                                <StatCard
                                    icon={CreditCard}
                                    label="Doanh thu tháng"
                                    value={fmtCurrency(data.selectedMonthRevenue)}
                                    sub={`${fmtNum(data.selectedMonthOrders)} đơn · ${selectedMonthLabel}`}
                                    color="border-violet-500/25 text-violet-200"
                                    iconColor="bg-violet-500/15 text-violet-400"
                                />
                                <StatCard
                                    icon={growthUp ? TrendingUp : TrendingDown}
                                    label="Tăng trưởng"
                                    value={`${growth > 0 ? '+' : ''}${growth}%`}
                                    sub="So với tháng trước"
                                    color={growthUp ? 'border-emerald-500/25 text-emerald-300' : 'border-rose-500/25 text-rose-300'}
                                    iconColor={growthUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}
                                />
                                <StatCard
                                    icon={Percent}
                                    label={rateKpi.label}
                                    value={`${rateKpi.value}%`}
                                    sub={rateKpi.sub}
                                    color="border-sky-500/25 text-sky-200"
                                    iconColor="bg-sky-500/15 text-sky-400"
                                />
                            </div>

                            {/* Trends */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                <ChartCard
                                    title="Doanh thu 12 tháng"
                                    subtitle={planId === 'all' ? 'Tất cả gói' : data.plans.find(p => String(p.planId) === planId)?.planName}
                                    className="lg:col-span-7"
                                >
                                    <MonthlyBarChart data={data.monthlyTrend} />
                                </ChartCard>
                                <ChartCard
                                    title="Tăng trưởng %"
                                    subtitle="So với tháng liền trước"
                                    className="lg:col-span-5"
                                >
                                    <GrowthLineChart data={data.monthlyTrend} />
                                </ChartCard>
                            </div>

                            {/* Plan breakdown */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                <ChartCard title="Doanh thu theo gói" subtitle={selectedMonthLabel} className="lg:col-span-4">
                                    <VerticalBarChart items={planBars} formatValue={fmtCurrency} />
                                </ChartCard>
                                <ChartCard title="Số đơn theo gói" subtitle={selectedMonthLabel} className="lg:col-span-4">
                                    <VerticalBarChart items={orderBars} formatValue={fmtNum} />
                                </ChartCard>

                                <div className="lg:col-span-4 glass-card rounded-2xl p-5 relative overflow-hidden border border-indigo-500/20 bg-brand-subtle flex flex-col min-h-[280px]">
                                    <div
                                        className="absolute inset-0 opacity-40 pointer-events-none"
                                        style={{ background: 'var(--gradient-brand)', filter: 'blur(60px)' }}
                                    />
                                    <div className="relative flex-1">
                                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)] mb-1">
                                            Tóm tắt tháng
                                        </p>
                                        <p className="text-2xl sm:text-3xl font-black text-gradient-bright leading-tight">
                                            {fmtCurrency(data.selectedMonthRevenue)}
                                        </p>
                                        <p className="text-sm text-[var(--text-secondary)] mt-2 flex items-center gap-1.5">
                                            <ShoppingCart className="w-4 h-4" />
                                            {fmtNum(data.selectedMonthOrders)} đơn hoàn tất
                                        </p>
                                        {planId === 'all' && (
                                            <p className="text-xs text-[var(--text-tertiary)] mt-3">
                                                {rateKpi.value}% đơn thanh toán thành công trong tháng
                                            </p>
                                        )}
                                    </div>
                                    {data.revenueByPlan.length > 0 && (
                                        <div className="relative mt-4 pt-4 border-t border-[var(--border-color)] space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                                                Top gói tháng này
                                            </p>
                                            {data.revenueByPlan.slice(0, 4).map((p, i) => (
                                                <div key={p.planId} className="flex justify-between text-xs gap-2">
                                                    <span className={`truncate ${PLAN_COLORS[i % PLAN_COLORS.length].text}`}>
                                                        {p.planName}
                                                    </span>
                                                    <span className="font-semibold text-[var(--text-primary)] shrink-0">
                                                        {fmtCurrency(p.revenue)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Plan table */}
                            {data.revenueByPlan.length > 0 && (
                                <Section title="Chi tiết theo gói" icon={Package}>
                                    <div className="space-y-3">
                                        {data.revenueByPlan.map((p, i) => {
                                            const pct = totalPlanRevenue > 0 ? Math.round((p.revenue / totalPlanRevenue) * 100) : 0;
                                            const colors = PLAN_COLORS[i % PLAN_COLORS.length];
                                            return (
                                                <div key={p.planId} className="space-y-1.5">
                                                    <div className="flex justify-between items-baseline gap-2">
                                                        <span className={`text-sm font-medium ${colors.text}`}>{p.planName}</span>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-sm font-bold text-[var(--text-primary)]">
                                                                {fmtCurrency(p.revenue)}
                                                            </span>
                                                            <span className="text-xs text-[var(--text-tertiary)] ml-2">
                                                                {fmtNum(p.orderCount)} đơn · {pct}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 bg-[var(--text-primary)]/10 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Section>
                            )}
                        </>
                    )}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
