import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { adminService, type SystemLimits, type SystemLimitsRequest } from '../../services/adminService';
import { AdminPageShell, fmtNum, fmtTokens } from '../../components/admin/AdminShared';
import RagConfigPanel from '../../components/admin/RagConfigPanel';

export default function AdminSystemPage() {
    const navigate = useNavigate();
    const [limits, setLimits] = useState<SystemLimits | null>(null);
    const [form, setForm] = useState<SystemLimitsRequest>({
        maxUploadMb: 10,
        maxProjectsPerAuthor: 50,
        maintenanceMode: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        smtpFromName: '',
        smtpFromAddress: '',
        vnPayPaymentUrl: '',
        vnPayTmnCode: '',
        vnPayHashSecret: '',
        vnPayReturnUrl: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminService.getSystemLimits();
            setLimits(data);
            setForm({
                maxUploadMb: data.maxUploadMb,
                maxProjectsPerAuthor: data.maxProjectsPerAuthor,
                maintenanceMode: data.maintenanceMode,
                smtpHost: data.smtpHost ?? '',
                smtpPort: data.smtpPort ?? 587,
                smtpUsername: data.smtpUsername ?? '',
                smtpPassword: data.smtpPassword ?? '',
                smtpFromName: data.smtpFromName ?? '',
                smtpFromAddress: data.smtpFromAddress ?? '',
                vnPayPaymentUrl: data.vnPayPaymentUrl ?? '',
                vnPayTmnCode: data.vnPayTmnCode ?? '',
                vnPayHashSecret: data.vnPayHashSecret ?? '',
                vnPayReturnUrl: data.vnPayReturnUrl ?? '',
            });
        } catch {
            setError('Không tải được cấu hình hệ thống.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate]);

    const saveLimits = async () => {
        setSaving(true);
        setError('');
        try {
            const data = await adminService.updateSystemLimits(form);
            setLimits(data);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err?.response?.data?.message ?? 'Lưu thất bại.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full h-10 px-3 rounded-xl text-sm border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none transition-colors';

    return (
        <MainLayout pageTitle="Hệ thống">
            {() => (
                <AdminPageShell title="Cấu hình hệ thống">
                    {error && <p className="text-rose-400 text-sm font-semibold">{error}</p>}

                    {limits && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
                            <div><p className="text-xs text-[var(--text-tertiary)]">Dự án</p><p className="text-xl font-bold">{fmtNum(limits.totalProjects)}</p></div>
                            <div><p className="text-xs text-[var(--text-tertiary)]">Chương</p><p className="text-xl font-bold">{fmtNum(limits.totalChapters)}</p></div>
                            <div><p className="text-xs text-[var(--text-tertiary)]">Tổng từ</p><p className="text-xl font-bold">{fmtTokens(limits.totalWordCount)}</p></div>
                        </div>
                    )}

                    <div className="rounded-2xl border border-indigo-500/20 bg-[var(--bg-surface)] p-6">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Cấu hình RAG</h2>
                        <RagConfigPanel />
                    </div>

                    <div className="space-y-6">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : (
                            <>
                                {/* Section 1: Giới hạn & bảo trì */}
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-4">
                                    <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2">Giới hạn & Bảo trì</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Upload tối đa (MB)</label>
                                            <input type="number" min={1} max={100} className={inputCls} value={form.maxUploadMb}
                                                onChange={e => setForm(f => ({ ...f, maxUploadMb: Number(e.target.value) }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Dự án tối đa / tác giả</label>
                                            <input type="number" min={1} max={500} className={inputCls} value={form.maxProjectsPerAuthor}
                                                onChange={e => setForm(f => ({ ...f, maxProjectsPerAuthor: Number(e.target.value) }))} />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-[var(--text-secondary)]">
                                        <input type="checkbox" className="rounded border-[var(--border-color)] bg-[var(--input-bg)] text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={form.maintenanceMode}
                                            onChange={e => setForm(f => ({ ...f, maintenanceMode: e.target.checked }))} />
                                        Chế độ bảo trì (chặn tác giả mới)
                                    </label>
                                </div>

                                {/* Section 2: Cấu hình SMTP Email */}
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-4">
                                    <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2">Cấu hình Email (SMTP)</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">SMTP Host</label>
                                            <input type="text" placeholder="smtp.gmail.com" className={inputCls} value={form.smtpHost}
                                                onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">SMTP Port</label>
                                            <input type="number" placeholder="587" className={inputCls} value={form.smtpPort}
                                                onChange={e => setForm(f => ({ ...f, smtpPort: Number(e.target.value) }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Tài khoản (Gmail)</label>
                                            <input type="text" placeholder="example@gmail.com" className={inputCls} value={form.smtpUsername}
                                                onChange={e => setForm(f => ({ ...f, smtpUsername: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Mật khẩu ứng dụng</label>
                                            <input type="password" placeholder="••••••••••••••••" className={inputCls} value={form.smtpPassword}
                                                onChange={e => setForm(f => ({ ...f, smtpPassword: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Tên hiển thị người gửi</label>
                                            <input type="text" placeholder="StoryNest" className={inputCls} value={form.smtpFromName}
                                                onChange={e => setForm(f => ({ ...f, smtpFromName: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Email hiển thị người gửi</label>
                                            <input type="text" placeholder="noreply@gmail.com" className={inputCls} value={form.smtpFromAddress}
                                                onChange={e => setForm(f => ({ ...f, smtpFromAddress: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Cấu hình VNPay */}
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-4">
                                    <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2">Cấu hình Cổng thanh toán (VNPay)</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">VNPay Payment URL</label>
                                            <input type="text" placeholder="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html" className={inputCls} value={form.vnPayPaymentUrl}
                                                onChange={e => setForm(f => ({ ...f, vnPayPaymentUrl: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Mã Website (TmnCode)</label>
                                            <input type="text" placeholder="TMNCODE" className={inputCls} value={form.vnPayTmnCode}
                                                onChange={e => setForm(f => ({ ...f, vnPayTmnCode: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">Mã bảo mật (HashSecret)</label>
                                            <input type="password" placeholder="••••••••" className={inputCls} value={form.vnPayHashSecret}
                                                onChange={e => setForm(f => ({ ...f, vnPayHashSecret: e.target.value }))} />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase block mb-1">URL phản hồi (Return URL)</label>
                                            <input type="text" placeholder="http://localhost:5173/payment/success" className={inputCls} value={form.vnPayReturnUrl}
                                                onChange={e => setForm(f => ({ ...f, vnPayReturnUrl: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => void saveLimits()} disabled={saving}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition text-white text-sm font-semibold disabled:opacity-50">
                                        {saving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Save className="w-4.5 h-4.5" />}
                                        Lưu cấu hình hệ thống
                                    </button>
                                    {saved && <span className="text-emerald-400 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình</span>}
                                </div>
                            </>
                        )}
                    </div>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
