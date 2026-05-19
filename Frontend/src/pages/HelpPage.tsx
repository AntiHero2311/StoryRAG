import { useEffect, useState } from 'react';
import { CircleHelp, Sparkles, Loader2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { faqService, type Faq } from '../services/faqService';
import { writingTipService, type WritingTip } from '../services/writingTipService';

export default function HelpPage() {
    const [tab, setTab] = useState<'faq' | 'tips'>('faq');
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [tips, setTips] = useState<WritingTip[]>([]);
    const [loading, setLoading] = useState(true);
    const [openFaq, setOpenFaq] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        void Promise.all([faqService.getPublic(), writingTipService.getPublic()])
            .then(([f, t]) => { setFaqs(f); setTips(t); })
            .finally(() => setLoading(false));
    }, []);

    return (
        <MainLayout pageTitle="Trợ giúp">
            {() => (
                <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">Trợ giúp & hướng dẫn</h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Câu hỏi thường gặp và mẹo viết do đội ngũ StoryRAG biên soạn.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setTab('faq')}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
                                tab === 'faq' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                            }`}
                        >
                            <CircleHelp className="w-4 h-4" /> Câu hỏi thường gặp
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('tips')}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
                                tab === 'tips' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" /> Mẹo viết truyện
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : tab === 'faq' ? (
                        faqs.length === 0 ? (
                            <p className="text-center text-[var(--text-secondary)] py-12 text-sm">Chưa có câu hỏi nào được xuất bản.</p>
                        ) : (
                            <div className="space-y-2">
                                {faqs.map(f => (
                                    <div key={f.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
                                        <button
                                            type="button"
                                            className="w-full text-left px-4 py-3 flex items-center justify-between gap-2"
                                            onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                                        >
                                            <span className="font-semibold text-sm text-[var(--text-primary)]">{f.question}</span>
                                            <span className="text-xs text-[var(--text-tertiary)] shrink-0">{f.category}</span>
                                        </button>
                                        {openFaq === f.id && (
                                            <div className="px-4 pb-4 text-sm text-[var(--text-secondary)] whitespace-pre-wrap border-t border-[var(--border-color)] pt-3">
                                                {f.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    ) : tips.length === 0 ? (
                        <p className="text-center text-[var(--text-secondary)] py-12 text-sm">Chưa có mẹo viết nào được xuất bản.</p>
                    ) : (
                        <div className="space-y-4">
                            {tips.map(t => (
                                <article key={t.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
                                    <h2 className="font-bold text-[var(--text-primary)]">{t.title}</h2>
                                    {t.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {t.tags.map(tag => (
                                                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-sm text-[var(--text-secondary)] mt-3 whitespace-pre-wrap">{t.content}</p>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </MainLayout>
    );
}
