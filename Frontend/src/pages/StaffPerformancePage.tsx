import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import { staffService, type StaffPerformanceResponse } from '../services/staffService';

export default function StaffPerformancePage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<StaffPerformanceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const info = getUserInfo(token);
        if (info.role !== 'Staff' && info.role !== 'Admin') { navigate('/home'); return; }

        void staffService.getPerformance()
            .then(setStats)
            .catch(() => setError('Không thể tải thống kê KPI.'))
            .finally(() => setLoading(false));
    }, [navigate]);

    const cards = stats ? [
        { label: 'Report đã duyệt (tháng)', value: stats.reviewsThisMonth },
        { label: 'Feedback đã đóng (tháng)', value: stats.feedbacksResolvedThisMonth },
        { label: 'Kháng cáo đã xử lý (tháng)', value: stats.appealsReviewedThisMonth },
        { label: 'Ticket đã giải quyết (tháng)', value: stats.ticketsResolvedThisMonth },
        { label: 'Feedback đang mở', value: stats.openFeedbacksAssigned },
        { label: 'Kháng cáo chờ duyệt', value: stats.pendingAppeals },
        { label: 'Ticket hỗ trợ đang mở', value: stats.openSupportTickets },
        {
            label: 'Thời gian phản hồi TB (giờ)',
            value: stats.avgFeedbackResponseHours != null ? stats.avgFeedbackResponseHours : '—',
        },
    ] : [];

    return (
        <MainLayout pageTitle="KPI Staff">
            {() => (
                <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-indigo-400" />
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)]">Hiệu suất làm việc</h1>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {stats ? `Xin chào ${stats.staffName}` : 'Thống kê nội bộ tháng hiện tại'}
                            </p>
                        </div>
                    </div>

                    {error && <p className="text-rose-400 text-sm">{error}</p>}

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {cards.map(c => (
                                <div key={c.label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-1">{c.label}</p>
                                    <p className="text-3xl font-black text-[var(--text-primary)]">{c.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
