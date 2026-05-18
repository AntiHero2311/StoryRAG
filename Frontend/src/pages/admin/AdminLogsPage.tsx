import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { adminService, type SystemLogsPage } from '../../services/adminService';
import { AdminPageShell } from '../../components/admin/AdminShared';

const CATEGORIES = ['', 'User', 'Config', 'Payment', 'Auth'];
const LEVELS = ['', 'Info', 'Warning', 'Error'];

export default function AdminLogsPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<SystemLogsPage | null>(null);
    const [page, setPage] = useState(1);
    const [category, setCategory] = useState('');
    const [level, setLevel] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            setData(await adminService.getLogs(page, 30, category || undefined, level || undefined));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate, page, category, level]);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <MainLayout pageTitle="Nhật ký">
            {() => (
                <AdminPageShell
                    title="Nhật ký hệ thống"
                    subtitle={data ? `${data.total} bản ghi` : 'Audit log cơ bản'}
                    action={
                        <button type="button" onClick={() => void load()} className="p-2 rounded-xl border border-[var(--border-color)]">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    }
                >
                    {data?.storageReady === false && (
                        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            Bảng nhật ký chưa sẵn sàng trên database. Chạy migration hoặc script{' '}
                            <code className="text-xs">Backend/Scripts/add_system_logs.sql</code>, sau đó thử lại.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm">
                            <option value="">Tất cả danh mục</option>
                            {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}
                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm">
                            <option value="">Tất cả mức</option>
                            {LEVELS.filter(Boolean).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)] text-xs uppercase text-[var(--text-secondary)]">
                                        <th className="text-left px-4 py-3">Thời gian</th>
                                        <th className="text-left px-4 py-3">Mức</th>
                                        <th className="text-left px-4 py-3">Danh mục</th>
                                        <th className="text-left px-4 py-3">Hành động</th>
                                        <th className="text-left px-4 py-3">Nội dung</th>
                                        <th className="text-left px-4 py-3">Người thực hiện</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {(data?.items ?? []).map(log => (
                                        <tr key={log.id} className="hover:bg-[var(--text-primary)]/5">
                                            <td className="px-4 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`text-xs font-semibold ${log.level === 'Error' ? 'text-rose-400' : log.level === 'Warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {log.level}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">{log.category}</td>
                                            <td className="px-4 py-2 text-xs">{log.action}</td>
                                            <td className="px-4 py-2 max-w-md truncate" title={log.message}>{log.message}</td>
                                            <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{log.actorName ?? '—'}</td>
                                        </tr>
                                    ))}
                                    {data?.items.length === 0 && (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-[var(--text-secondary)]">Chưa có nhật ký.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {data && data.total > data.pageSize && (
                        <div className="flex items-center justify-center gap-3">
                            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40">Trước</button>
                            <span className="text-sm text-[var(--text-secondary)]">{page} / {totalPages}</span>
                            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40">Sau</button>
                        </div>
                    )}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
