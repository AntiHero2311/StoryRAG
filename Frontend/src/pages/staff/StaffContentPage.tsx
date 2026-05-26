import { useSearchParams } from 'react-router-dom';
import { CircleHelp, Sparkles } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { AdminPageShell } from '../../components/admin/AdminShared';
import StaffFaqPage from '../StaffFaqPage';
import StaffWritingTipPage from '../StaffWritingTipPage';

export default function StaffContentPage() {
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'tips' ? 'tips' : 'faq';

    const setTab = (t: 'faq' | 'tips') => {
        setParams({ tab: t }, { replace: true });
    };

    return (
        <MainLayout pageTitle="Nội dung trợ giúp">
            {() => (
                <AdminPageShell title="Nội dung trợ giúp">
                    <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-3">
                        <button
                            type="button"
                            onClick={() => setTab('faq')}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                                tab === 'faq'
                                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                    : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                            }`}
                        >
                            <CircleHelp className="w-4 h-4" />
                            Câu hỏi thường gặp
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('tips')}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                                tab === 'tips'
                                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                    : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            Mẹo viết truyện
                        </button>
                    </div>

                    {tab === 'faq' ? <StaffFaqPage embedded /> : <StaffWritingTipPage embedded />}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
