import { useState, useEffect } from 'react';
import {
    Plus, Pencil, X, Check, Loader2, Power, PowerOff,
    BarChart2, MessageSquare, DollarSign
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import {
    subscriptionService, SubscriptionPlan, CreatePlanRequest, UpdatePlanRequest
} from '../services/subscriptionService';
import { UserInfo } from '../utils/jwtHelper';

// ── Input helper ──────────────────────────────────────────────────────────────
const inputCls = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-[#f5a623]/50 focus:ring-2 focus:ring-[#f5a623]/20 rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm outline-none transition-all";

// ── Plan Form Modal ───────────────────────────────────────────────────────────
function PlanModal({ plan, onClose, onSaved }: {
    plan?: SubscriptionPlan;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!plan;
    const [form, setForm] = useState({
        planName: plan?.planName ?? '',
        price: plan?.price ?? 0,
        maxAnalysisCount: plan?.maxAnalysisCount ?? 10,
        maxTokenLimit: plan?.maxTokenLimit ?? 50000,
        description: plan?.description ?? '',
        isActive: plan?.isActive ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.planName.trim()) { setError('Tên plan không được để trống.'); return; }
        try {
            setSaving(true); setError('');
            if (isEdit) {
                await subscriptionService.updatePlan(plan!.id, form as UpdatePlanRequest);
            } else {
                await subscriptionService.createPlan(form as CreatePlanRequest);
            }
            onSaved();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(msg || 'Có lỗi xảy ra.');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
                    <h3 className="text-[var(--text-primary)] font-bold">
                        {isEdit ? 'Chỉnh sửa Plan' : 'Tạo Plan mới'}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--text-primary)]/5 text-[var(--text-secondary)]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                            <X className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Tên Plan</label>
                            <input value={form.planName} onChange={e => set('planName', e.target.value)} placeholder="Pro Plus..." className={inputCls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Giá (đ/tháng)</label>
                            <input type="number" min={0} value={form.price} onChange={e => set('price', +e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Lần phân tích</label>
                            <input type="number" min={1} value={form.maxAnalysisCount} onChange={e => set('maxAnalysisCount', +e.target.value)} className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Token AI tối đa</label>
                            <input type="number" min={1000} value={form.maxTokenLimit} onChange={e => set('maxTokenLimit', +e.target.value)} className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Mô tả</label>
                            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                                className={`${inputCls} resize-none`} placeholder="Mô tả ngắn về plan..." />
                        </div>
                        <div className="col-span-2 flex items-center gap-3">
                            <button type="button" onClick={() => set('isActive', !form.isActive)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${form.isActive ? 'bg-emerald-500' : 'bg-[var(--text-primary)]/20'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <span className="text-[var(--text-secondary)] text-sm">Kích hoạt ngay</span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-semibold hover:bg-[var(--text-primary)]/5 transition-all">
                            Huỷ
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo Plan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Content ───────────────────────────────────────────────────────────────────
function AdminSubscriptionContent() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'create' | SubscriptionPlan | null>(null);

    const load = () => {
        setLoading(true);
        subscriptionService.getPlans(true).then(setPlans).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const toggleActive = async (plan: SubscriptionPlan) => {
        await subscriptionService.updatePlan(plan.id, { isActive: !plan.isActive });
        load();
    };

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[var(--text-primary)] font-bold text-lg">Quản lý Subscription Plans</h2>
                        <p className="text-[var(--text-secondary)] text-sm mt-0.5">{plans.length} plan • hiển thị kể cả đã tắt</p>
                    </div>
                    <button
                        onClick={() => setModal('create')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                    >
                        <Plus className="w-4 h-4" /> Thêm Plan
                    </button>
                </div>

                {/* Plan cards */}
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#f5a623]" /></div>
                ) : (
                    <div className="space-y-3">
                        {plans.map(plan => (
                            <div key={plan.id}
                                className={`rounded-2xl p-5 transition-all ${!plan.isActive ? 'opacity-50' : ''}`}
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                        {plan.planName[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-[var(--text-primary)] font-bold">{plan.planName}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${plan.isActive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                                                {plan.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <p className="text-[var(--text-secondary)] text-xs mb-3 leading-relaxed">{plan.description}</p>
                                        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                                            <span className="flex items-center gap-1">
                                                <DollarSign className="w-3.5 h-3.5 text-[#f5a623]" />
                                                {plan.price === 0 ? 'Miễn phí' : `${plan.price.toLocaleString('vi-VN')}đ/tháng`}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                                                {plan.maxAnalysisCount >= 9999 ? '∞' : plan.maxAnalysisCount} phân tích
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                                                {(plan.maxTokenLimit / 1000).toFixed(0)}K token
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => setModal(plan)}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => toggleActive(plan)}
                                            title={plan.isActive ? 'Deactivate' : 'Activate'}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${plan.isActive ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}>
                                            {plan.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modal === 'create' && (
                <PlanModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
            )}
            {modal && modal !== 'create' && (
                <PlanModal plan={modal as SubscriptionPlan} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
            )}
        </div>
    );
}

export default function AdminSubscriptionPage() {
    return (
        <MainLayout pageTitle="Quản lý Plans">
            {(_: UserInfo) => <AdminSubscriptionContent />}
        </MainLayout>
    );
}
