import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { staffService, type SupportTicketResponse } from '../services/staffService';

const CATEGORIES: Record<string, string> = {
    Payment: 'Thanh toán',
    Subscription: 'Gói dịch vụ',
    Usage: 'Hướng dẫn sử dụng',
    DataDeletion: 'Xóa dữ liệu',
    BanRecommendation: 'Đề xuất khóa TK',
    Other: 'Khác',
};

export default function StaffSupportTicketsPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<SupportTicketResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<string>('');
    const [selected, setSelected] = useState<SupportTicketResponse | null>(null);
    const [reply, setReply] = useState('');
    const [newStatus, setNewStatus] = useState('InProgress');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await staffService.getSupportTickets(status || undefined, undefined, 1, 50);
            setRows(data.items ?? []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') { navigate('/home'); return; }
        void load();
    }, [load, navigate]);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await staffService.updateSupportTicket(selected.id, {
                status: newStatus,
                staffReply: reply.trim() || undefined,
            });
            setSelected(null);
            await load();
        } finally {
            setSaving(false);
        }
    };

    return (
        <MainLayout pageTitle="Ticket hỗ trợ">
            {() => (
                <div className="p-6 max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                        <Headphones className="w-6 h-6 text-indigo-400" />
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Ticket hỗ trợ khách hàng</h1>
                            <p className="text-sm text-[var(--text-secondary)]">Thanh toán, gói dịch vụ, hướng dẫn, xóa dữ liệu.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['', 'Open', 'InProgress', 'Resolved'].map(s => (
                            <button key={s || 'all'} onClick={() => setStatus(s)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${status === s ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>
                                {s || 'Tất cả'}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <div className="space-y-3">
                            {rows.map(t => (
                                <button key={t.id} onClick={() => { setSelected(t); setReply(t.staffReply ?? ''); setNewStatus(t.status); }}
                                    className="w-full text-left p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-indigo-500/30 transition-colors">
                                    <div className="flex justify-between gap-2">
                                        <span className="font-semibold text-sm text-[var(--text-primary)]">{t.subject}</span>
                                        <span className="text-xs text-amber-400">{t.status}</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{CATEGORIES[t.category] ?? t.category} · {t.userName}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {selected && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={e => e.target === e.currentTarget && setSelected(null)}>
                            <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4">
                                <h3 className="font-bold">{selected.subject}</h3>
                                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{selected.description}</p>
                                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-2 text-sm">
                                    <option value="Open">Open</option>
                                    <option value="InProgress">InProgress</option>
                                    <option value="Resolved">Resolved</option>
                                    <option value="Closed">Closed</option>
                                </select>
                                <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Phản hồi cho user" className="w-full h-24 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm" />
                                <div className="flex gap-2">
                                    <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-xl border text-sm">Đóng</button>
                                    <button onClick={() => void handleSave()} disabled={saving} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Lưu</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
