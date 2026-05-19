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
    const [form, setForm] = useState<SystemLimitsRequest>({ maxUploadMb: 10, maxProjectsPerAuthor: 50, maintenanceMode: false });
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

    const inputCls = 'w-full h-10 px-3 rounded-xl text-sm border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-primary)]';

    return (
        <MainLayout pageTitle="Hệ thống">
            {() => (
                <AdminPageShell title="Cấu hình hệ thống" subtitle="RAG, giới hạn lưu trữ và chế độ bảo trì">
                    {error && <p className="text-rose-400 text-sm">{error}</p>}

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

                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-4">
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">Giới hạn & bảo trì</h2>
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Upload tối đa (MB)</label>
                                        <input type="number" min={1} max={100} className={inputCls} value={form.maxUploadMb}
                                            onChange={e => setForm(f => ({ ...f, maxUploadMb: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Dự án tối đa / tác giả</label>
                                        <input type="number" min={1} max={500} className={inputCls} value={form.maxProjectsPerAuthor}
                                            onChange={e => setForm(f => ({ ...f, maxProjectsPerAuthor: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={form.maintenanceMode}
                                        onChange={e => setForm(f => ({ ...f, maintenanceMode: e.target.checked }))} />
                                    Chế độ bảo trì (chặn tác giả mới — cần tích hợp middleware)
                                </label>
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => void saveLimits()} disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Lưu giới hạn
                                    </button>
                                    {saved && <span className="text-emerald-400 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Đã lưu</span>}
                                </div>
                            </>
                        )}
                    </div>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
