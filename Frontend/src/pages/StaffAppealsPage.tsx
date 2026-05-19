import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { staffService, type AuthorAppealResponse } from '../services/staffService';

export default function StaffAppealsPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<AuthorAppealResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Pending');
    const [selected, setSelected] = useState<AuthorAppealResponse | null>(null);
    const [note, setNote] = useState('');
    const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await staffService.getAppeals(filter || undefined, 1, 50);
            setRows(data.items ?? []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') { navigate('/home'); return; }
        void load();
    }, [load, navigate]);

    const handleReview = async () => {
        if (!selected) return;
        await staffService.reviewAppeal(selected.id, { status: decision, staffNote: note.trim() || undefined });
        setSelected(null);
        await load();
    };

    return (
        <MainLayout pageTitle="Kháng cáo">
            {() => (
                <div className="p-6 max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                        <Scale className="w-6 h-6 text-indigo-400" />
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Kháng cáo tác giả</h1>
                            <p className="text-sm text-[var(--text-secondary)]">Xem xét lại quyết định cờ dự án, feedback hoặc report.</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {['Pending', 'Approved', 'Rejected', ''].map(s => (
                            <button key={s || 'all'} onClick={() => setFilter(s)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${filter === s ? 'border-indigo-500/50 bg-indigo-500/15' : 'border-[var(--border-color)]'}`}>
                                {s || 'Tất cả'}
                            </button>
                        ))}
                    </div>

                    {loading ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
                        <div className="space-y-3">
                            {rows.map(a => (
                                <button key={a.id} onClick={() => setSelected(a)}
                                    className="w-full text-left p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
                                    <p className="font-semibold text-sm">{a.authorName} · {a.appealType}</p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">{a.reason}</p>
                                    <span className="text-xs text-amber-400 mt-2 inline-block">{a.status}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {selected && selected.status === 'Pending' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => e.target === e.currentTarget && setSelected(null)}>
                            <div className="w-full max-w-md bg-[var(--bg-surface)] border rounded-2xl p-6 space-y-4">
                                <p className="text-sm whitespace-pre-wrap">{selected.reason}</p>
                                <select value={decision} onChange={e => setDecision(e.target.value as 'Approved' | 'Rejected')} className="w-full rounded-xl border p-2 text-sm bg-[var(--input-bg)]">
                                    <option value="Approved">Chấp nhận</option>
                                    <option value="Rejected">Từ chối</option>
                                </select>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú staff" className="w-full h-20 rounded-xl border p-3 text-sm bg-[var(--input-bg)]" />
                                <button onClick={() => void handleReview()} className="w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm">Xác nhận</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
