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
        { label: 'Báo cáo đã duyệt', sub: 'Trong tháng hiện tại', value: stats.reviewsThisMonth },
        { label: 'Phản hồi đã đóng', sub: 'Trong tháng hiện tại', value: stats.feedbacksResolvedThisMonth },
        {
            label: 'Thời gian phản hồi trung bình',
            sub: 'Từ lúc nhận đến khi đóng phản hồi',
            value: stats.avgFeedbackResponseHours != null ? `${stats.avgFeedbackResponseHours} giờ` : '—',
        },
    ] : [];

    return (
        <MainLayout pageTitle="KPI Staff">
            {() => (
                <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-indigo-400" />
                        <h1 className="text-lg font-bold text-[var(--text-primary)]">Hiệu suất làm việc</h1>
                    </div>

                    {error && <p className="text-rose-400 text-sm">{error}</p>}

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {cards.map(c => (
                                <div key={c.label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.label}</p>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1 mb-3">{c.sub}</p>
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
