import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import {
    adminService,
    type AdminRevenueDashboard,
    type MonthlyRevenueItem,
    type PlanRevenueItem,
} from '../services/adminService';

const PLAN_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ec4899', '#8b5cf6'];

function fmtCurrency(n: number) {
    return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
}

function fmtNum(n: number) {
    return n.toLocaleString('vi-VN');
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

function VerticalBarChart({
    title,
    items,
    formatValue,
}: {
    title: string;
    items: { label: string; value: number; color: string }[];
    formatValue: (v: number) => string;
}) {
    const max = Math.max(...items.map(i => i.value), 1);
    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 h-full flex flex-col">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">{title}</p>
            {items.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] flex-1 flex items-center justify-center">Chưa có dữ liệu</p>
            ) : (
                <div className="flex items-end justify-center gap-3 flex-1 min-h-[140px] px-2">
                    {items.map(item => (
                        <div key={item.label} className="flex flex-col items-center gap-2 flex-1 max-w-[72px]">
                            <span className="text-[10px] text-[var(--text-secondary)] text-center leading-tight">{formatValue(item.value)}</span>
                            <div
                                className="w-full rounded-t-lg transition-all"
                                style={{ height: `${Math.max(8, (item.value / max) * 120)}px`, backgroundColor: item.color }}
                            />
                            <span className="text-[10px] font-semibold text-[var(--text-primary)] text-center truncate w-full">{item.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function MonthlyBarChart({ data }: { data: MonthlyRevenueItem[] }) {
    const max = Math.max(...data.map(d => d.revenue), 1);
    return (
        <div className="flex items-end gap-1.5 h-[160px] px-1">
            {data.map(d => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                        className="w-full rounded-t bg-amber-500/90 min-h-[4px]"
                        style={{ height: `${Math.max(4, (d.revenue / max) * 130)}px` }}
                        title={`${d.label}: ${fmtCurrency(d.revenue)}`}
                    />
                    <span className="text-[9px] text-[var(--text-tertiary)] rotate-[-45deg] origin-top-left translate-y-2 whitespace-nowrap">{d.label}</span>
                </div>
            ))}
        </div>
    );
}

function GrowthLineChart({ data }: { data: MonthlyRevenueItem[] }) {
    const points = data.filter(d => d.growthPercent != null);
    if (points.length < 2) {
        return <p className="text-sm text-[var(--text-secondary)] py-12 text-center">Chưa đủ dữ liệu tăng trưởng</p>;
    }
    const values = points.map(p => p.growthPercent ?? 0);
    const min = Math.min(...values, -10);
    const max = Math.max(...values, 10);
    const range = max - min || 1;
    const w = 320;
    const h = 120;
    const coords = points.map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p.growthPercent! - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full h-[160px]">
            <polyline fill="none" stroke="#6366f1" strokeWidth="2.5" points={coords} />
            {points.map((p, i) => {
                const x = (i / (points.length - 1)) * w;
                const y = h - ((p.growthPercent! - min) / range) * h;
                return <circle key={p.label} cx={x} cy={y} r="3" fill="#818cf8" />;
            })}
        </svg>
    );
}

function DonutStat({ percent, label, color }: { percent: number; label: string; color: string }) {
    const r = 42;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
    return (
        <div className="flex flex-col items-center justify-center">
            <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border-color)" strokeWidth="12" />
                <circle
                    cx="55" cy="55" r={r} fill="none"
                    stroke={color}
                    strokeWidth="12"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                />
                <text x="55" y="52" textAnchor="middle" className="fill-[var(--text-primary)] text-lg font-bold">
                    {percent}%
                </text>
                <text x="55" y="68" textAnchor="middle" className="fill-[var(--text-secondary)] text-[9px]">
                    {label}
                </text>
            </svg>
        </div>
    );
}

function KpiBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{label}</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1 leading-tight">{value}</p>
            {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
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
        if (!token) { navigate('/login'); return; }
        void load();
    }, [load, navigate]);

    const planBars = useMemo(() => {
        if (!data) return [];
        return data.revenueByPlan.map((p, i) => ({
            label: p.planName,
            value: p.revenue,
            color: PLAN_COLORS[i % PLAN_COLORS.length],
        }));
    }, [data]);

    const orderBars = useMemo(() => {
        if (!data) return [];
        return data.revenueByPlan.map((p, i) => ({
            label: p.planName,
            value: p.orderCount,
            color: PLAN_COLORS[i % PLAN_COLORS.length],
        }));
    }, [data]);

    const growth = data?.revenueGrowthPercent ?? 0;
    const growthUp = growth >= 0;

    const selectedPlanShare = useMemo(() => {
        if (!data || planId === 'all') return data?.paymentSuccessRate ?? 0;
        const total = data.revenueByPlan.reduce((s, p) => s + p.revenue, 0);
        const sel = data.revenueByPlan.find(p => String(p.planId) === planId);
        if (!total || !sel) return 0;
        return Math.round((sel.revenue / total) * 1000) / 10;
    }, [data, planId]);

    return (
        <MainLayout pageTitle="Báo cáo doanh thu">
            {() => (
                <div className="flex-1 overflow-y-auto">
                    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-7 h-7 text-amber-400" />
                                <div>
                                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Báo cáo doanh thu</h1>
                                    <p className="text-sm text-[var(--text-secondary)]">Thống kê thanh toán gói đăng ký theo tháng và theo plan</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => void load()} disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/5">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                            </button>
                        </div>

                        {error && <p className="text-rose-400 text-sm">{error}</p>}

                        {loading && !data ? (
                            <div className="flex justify-center py-24"><Loader2 className="w-10 h-10 animate-spin text-indigo-400" /></div>
                        ) : data && (
                            <>
                                {/* ── Top: month filter + KPIs + charts ── */}
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                                    <div className="xl:col-span-3 space-y-3">
                                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Chọn tháng báo cáo</label>
                                        <select
                                            value={`${year}-${month}`}
                                            onChange={e => {
                                                const [y, m] = e.target.value.split('-').map(Number);
                                                setYear(y);
                                                setMonth(m);
                                            }}
                                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                                        >
                                            {months.map(m => (
                                                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                                            ))}
                                        </select>
                                        <div className="grid grid-cols-1 gap-2">
                                            <KpiBox label="Tổng doanh thu" value={fmtCurrency(data.totalRevenue)} />
                                            <KpiBox label="Doanh thu tháng chọn" value={fmtCurrency(data.selectedMonthRevenue)} />
                                            <KpiBox label="Tổng đơn thành công" value={fmtNum(data.totalCompletedOrders)} />
                                            <KpiBox label="Đơn tháng chọn" value={fmtNum(data.selectedMonthOrders)} />
                                        </div>
                                    </div>

                                    <div className="xl:col-span-3">
                                        <VerticalBarChart title="Doanh thu theo gói (tháng)" items={planBars} formatValue={fmtCurrency} />
                                    </div>
                                    <div className="xl:col-span-3">
                                        <VerticalBarChart title="Số đơn theo gói (tháng)" items={orderBars} formatValue={fmtNum} />
                                    </div>

                                    <div className="xl:col-span-3 space-y-3">
                                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">Tăng trưởng doanh thu</p>
                                            <div className="flex items-center gap-2">
                                                {growthUp ? <TrendingUp className="w-8 h-8 text-emerald-400" /> : <TrendingDown className="w-8 h-8 text-rose-400" />}
                                                <span className={`text-3xl font-black ${growthUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {growth > 0 ? '+' : ''}{growth}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] mt-2">So với tháng trước</p>
                                        </div>
                                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex flex-col items-center">
                                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2 self-start">
                                                {planId === 'all' ? 'Tỷ lệ thanh toán thành công' : 'Thị phần gói (tháng)'}
                                            </p>
                                            <DonutStat
                                                percent={selectedPlanShare}
                                                label={planId === 'all' ? 'thành công' : 'doanh thu'}
                                                color={planId === 'all' ? '#22c55e' : '#3b82f6'}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Bottom: plan filter + trends ── */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-12 flex flex-wrap items-center gap-3">
                                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Chọn gói (xu hướng 12 tháng)</label>
                                        <select
                                            value={planId}
                                            onChange={e => setPlanId(e.target.value)}
                                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] min-w-[200px]"
                                        >
                                            <option value="all">Tất cả gói</option>
                                            {data.plans.map((p: PlanRevenueItem) => (
                                                <option key={p.planId} value={String(p.planId)}>{p.planName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4">
                                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Doanh thu 12 tháng</p>
                                        <MonthlyBarChart data={data.monthlyTrend} />
                                    </div>
                                    <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4">
                                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Tăng trưởng % từng tháng</p>
                                        <GrowthLineChart data={data.monthlyTrend} />
                                    </div>
                                    <div className="lg:col-span-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col items-center justify-center">
                                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2 self-start">Tháng {month}/{year}</p>
                                        <p className="text-2xl font-bold text-amber-300">{fmtCurrency(data.selectedMonthRevenue)}</p>
                                        <p className="text-sm text-[var(--text-secondary)] mt-1">{data.selectedMonthOrders} đơn hoàn tất</p>
                                        <div className="mt-4 w-full pt-4 border-t border-[var(--border-color)] space-y-2">
                                            {data.revenueByPlan.slice(0, 5).map((p, i) => (
                                                <div key={p.planId} className="flex justify-between text-xs">
                                                    <span className="text-[var(--text-secondary)] truncate pr-2">{p.planName}</span>
                                                    <span className="font-semibold" style={{ color: PLAN_COLORS[i % PLAN_COLORS.length] }}>{fmtCurrency(p.revenue)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </main>
                </div>
            )}
        </MainLayout>
    );
}
