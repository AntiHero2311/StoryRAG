import { useEffect, useState } from 'react';
import { Headphones, Loader2, Scale } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { supportService, type SupportTicketCategory } from '../services/supportService';
import type { SupportTicketResponse, AuthorAppealResponse } from '../services/staffService';

export default function SupportPage() {
    const [tab, setTab] = useState<'ticket' | 'appeal'>('ticket');
    const [tickets, setTickets] = useState<SupportTicketResponse[]>([]);
    const [appeals, setAppeals] = useState<AuthorAppealResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const [category, setCategory] = useState<SupportTicketCategory>('Other');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [appealProjectId, setAppealProjectId] = useState('');
    const [appealReason, setAppealReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        void Promise.all([supportService.getMyTickets(), supportService.getMyAppeals()])
            .then(([t, a]) => { setTickets(t); setAppeals(a); })
            .finally(() => setLoading(false));
    }, []);

    const submitTicket = async () => {
        setSubmitting(true);
        setMessage('');
        try {
            await supportService.createTicket({ category, subject, description });
            setSubject('');
            setDescription('');
            setTickets(await supportService.getMyTickets());
            setMessage('Đã gửi ticket. Staff sẽ phản hồi sớm.');
        } catch {
            setMessage('Không thể gửi ticket.');
        } finally {
            setSubmitting(false);
        }
    };

    const submitAppeal = async () => {
        if (!appealProjectId.trim()) { setMessage('Nhập Project ID (UUID).'); return; }
        setSubmitting(true);
        setMessage('');
        try {
            await supportService.createAppeal({
                projectId: appealProjectId.trim(),
                appealType: 'ProjectFlag',
                reason: appealReason,
            });
            setAppealReason('');
            setAppeals(await supportService.getMyAppeals());
            setMessage('Đã gửi kháng cáo.');
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setMessage(err?.response?.data?.message ?? 'Không thể gửi kháng cáo.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MainLayout pageTitle="Hỗ trợ">
            {() => (
                <div className="p-6 max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                        <Headphones className="w-6 h-6 text-indigo-400" />
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Hỗ trợ & Kháng cáo</h1>
                            <p className="text-sm text-[var(--text-secondary)]">Ticket thanh toán, gói dịch vụ, hoặc kháng cáo quyết định của Staff.</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setTab('ticket')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'ticket' ? 'bg-indigo-600 text-white' : 'border border-[var(--border-color)]'}`}>Ticket hỗ trợ</button>
                        <button onClick={() => setTab('appeal')} className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${tab === 'appeal' ? 'bg-indigo-600 text-white' : 'border border-[var(--border-color)]'}`}>
                            <Scale className="w-4 h-4" /> Kháng cáo
                        </button>
                    </div>

                    {message && <p className="text-sm text-emerald-400">{message}</p>}

                    {tab === 'ticket' ? (
                        <div className="space-y-4">
                            <select value={category} onChange={e => setCategory(e.target.value as SupportTicketCategory)} className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm">
                                <option value="Payment">Thanh toán</option>
                                <option value="Subscription">Gói dịch vụ</option>
                                <option value="Usage">Hướng dẫn sử dụng</option>
                                <option value="DataDeletion">Yêu cầu xóa dữ liệu</option>
                                <option value="Other">Khác</option>
                            </select>
                            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tiêu đề" className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm" />
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả chi tiết" className="w-full h-28 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm" />
                            <button onClick={() => void submitTicket()} disabled={submitting} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50">
                                {submitting ? 'Đang gửi…' : 'Gửi ticket'}
                            </button>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                                <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                                    <p className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Ticket của bạn</p>
                                    {tickets.map(t => (
                                        <div key={t.id} className="p-3 rounded-xl border border-[var(--border-color)] text-sm">
                                            <p className="font-semibold">{t.subject}</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">{t.status} · {t.category}</p>
                                            {t.staffReply && <p className="mt-2 text-[var(--text-secondary)]">Staff: {t.staffReply}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <input value={appealProjectId} onChange={e => setAppealProjectId(e.target.value)} placeholder="Project ID (UUID)" className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm font-mono" />
                            <textarea value={appealReason} onChange={e => setAppealReason(e.target.value)} placeholder="Lý do kháng cáo (tối thiểu 10 ký tự)" className="w-full h-28 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] p-3 text-sm" />
                            <button onClick={() => void submitAppeal()} disabled={submitting} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50">Gửi kháng cáo</button>
                            <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                                {appeals.map(a => (
                                    <div key={a.id} className="p-3 rounded-xl border border-[var(--border-color)] text-sm">
                                        <p className="font-semibold">{a.appealType} · {a.status}</p>
                                        <p className="text-[var(--text-secondary)] mt-1">{a.reason}</p>
                                        {a.staffNote && <p className="text-xs text-indigo-300 mt-2">Staff: {a.staffNote}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
