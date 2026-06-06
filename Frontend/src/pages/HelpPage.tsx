import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CircleHelp, Sparkles, Loader2, AlertTriangle, RefreshCw,
    ChevronDown, Search, Tag, BookOpen, MessageSquare,
    CreditCard, ChevronRight, Lightbulb, Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '../layouts/MainLayout';
import { AdminPageShell, fmtNum } from '../components/admin/AdminShared';
import { faqService, type Faq } from '../services/faqService';
import { writingTipService, type WritingTip } from '../services/writingTipService';
import Modal from '../components/ui/Modal';

function normalizeList<T>(data: unknown): T[] {
    return Array.isArray(data) ? data : [];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    'Tổng quan': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', dot: 'bg-blue-400' },
    'Bắt đầu': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
    'AI & RAG': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', dot: 'bg-amber-400' },
    'Phân tích': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/25', dot: 'bg-indigo-400' },
    'Gói & thanh toán': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/25', dot: 'bg-pink-400' },
    'Workspace': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25', dot: 'bg-violet-400' },
    'Bảo mật': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/25', dot: 'bg-rose-400' },
    'Hỗ trợ': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/25', dot: 'bg-sky-400' },
};

function normalizeCategory(cat?: string) {
    if (!cat || cat.toLowerCase() === 'general') return 'Tổng quan';
    return cat;
}

function getCategoryStyle(cat?: string) {
    const key = normalizeCategory(cat);
    const normalized = Object.keys(CATEGORY_COLORS).find(k => k.toLowerCase() === key.toLowerCase());
    return normalized
        ? CATEGORY_COLORS[normalized]
        : { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/25', dot: 'bg-zinc-400' };
}

const QUICK_LINKS = [
    { to: '/feedback', label: 'Phản hồi Staff', desc: 'Hỏi đáp về báo cáo phân tích', icon: MessageSquare, iconBg: 'bg-sky-500/12 text-sky-400', border: 'hover:border-sky-500/35', chevronHover: 'group-hover:text-sky-400' },
    { to: '/subscription', label: 'Gói dịch vụ', desc: 'Xem hạn mức và nâng cấp gói', icon: CreditCard, iconBg: 'bg-emerald-500/12 text-emerald-400', border: 'hover:border-emerald-500/35', chevronHover: 'group-hover:text-emerald-400' },
];

export default function HelpPage() {
    const [tab, setTab] = useState<'faq' | 'tips'>('faq');
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [tips, setTips] = useState<WritingTip[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openFaq, setOpenFaq] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState('all');
    const [selectedTip, setSelectedTip] = useState<WritingTip | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        void Promise.all([faqService.getPublic(), writingTipService.getPublic()])
            .then(([f, t]) => {
                setFaqs(normalizeList<Faq>(f));
                setTips(normalizeList<WritingTip>(t));
            })
            .catch(() => {
                setError('Không tải được nội dung trợ giúp. Kiểm tra API đang chạy hoặc thử lại sau.');
                setFaqs([]);
                setTips([]);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const faqCategories = useMemo(() => {
        const cats = new Set(faqs.map(f => normalizeCategory(f.category)));
        return ['all', ...Array.from(cats).sort()];
    }, [faqs]);

    const tipTags = useMemo(() => {
        const tags = new Set<string>();
        tips.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
        return ['all', ...Array.from(tags).sort()];
    }, [tips]);

    const filteredFaqs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return faqs.filter(f => {
            const cat = normalizeCategory(f.category);
            if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
            if (!term) return true;
            return f.question.toLowerCase().includes(term)
                || f.answer.toLowerCase().includes(term)
                || cat.toLowerCase().includes(term);
        });
    }, [faqs, searchTerm, categoryFilter]);

    const filteredTips = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return tips.filter(t => {
            if (tagFilter !== 'all' && !t.tags?.includes(tagFilter)) return false;
            if (!term) return true;
            return t.title.toLowerCase().includes(term)
                || t.content.toLowerCase().includes(term)
                || t.tags?.some(tag => tag.toLowerCase().includes(term));
        });
    }, [tips, searchTerm, tagFilter]);

    const groupedFaqs = useMemo(() => {
        const groups: Record<string, Faq[]> = {};
        filteredFaqs.forEach(f => {
            const cat = normalizeCategory(f.category);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(f);
        });
        return groups;
    }, [filteredFaqs]);

    const switchTab = (next: 'faq' | 'tips') => {
        setTab(next);
        setSearchTerm('');
        setCategoryFilter('all');
        setTagFilter('all');
        setOpenFaq(null);
    };

    return (
        <MainLayout pageTitle="Trợ giúp">
            {() => (
                <AdminPageShell
                    title="Trợ giúp & Hướng dẫn"
                    action={
                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-indigo-500/30 transition-all disabled:opacity-60"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </button>
                    }
                >
                    {/* Hero */}
                    <div
                        className="relative rounded-3xl border overflow-hidden"
                        style={{
                            borderColor: 'rgba(99,102,241,0.2)',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.05) 40%, var(--bg-surface) 100%)',
                        }}
                    >
                        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/8 blur-[80px] rounded-full pointer-events-none" />
                        <div className="h-1" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)' }} />
                        <div className="relative p-6 md:p-8">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 10px 28px rgba(99,102,241,0.35)' }}
                                    >
                                        <CircleHelp className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-1">StoryNest · Help Center</p>
                                        <h2 className="text-[var(--text-primary)] font-black text-xl md:text-2xl leading-tight">
                                            Hướng dẫn sáng tác & FAQ
                                        </h2>
                                        <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed max-w-xl">
                                            Giải đáp thắc mắc thường gặp và chia sẻ mẹo viết truyện — tìm nhanh theo từ khóa hoặc danh mục.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3 shrink-0">
                                    <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/8 px-4 py-3 min-w-[100px] text-center">
                                        <p className="text-2xl font-black text-indigo-300 tabular-nums">{fmtNum(faqs.length)}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/70 mt-0.5">FAQ</p>
                                    </div>
                                    <div className="rounded-2xl border border-violet-500/25 bg-violet-500/8 px-4 py-3 min-w-[100px] text-center">
                                        <p className="text-2xl font-black text-violet-300 tabular-nums">{fmtNum(tips.length)}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/70 mt-0.5">Mẹo viết</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p>{error}</p>
                                <button type="button" onClick={load} className="mt-2 text-xs font-semibold text-rose-200 hover:text-white underline">
                                    Thử lại
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:p-5 space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                            <div className="flex p-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-hover)]/30 w-fit">
                                <button
                                    type="button"
                                    onClick={() => switchTab('faq')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        tab === 'faq'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <CircleHelp className="w-4 h-4" />
                                    Câu hỏi thường gặp
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'faq' ? 'bg-white/20' : 'bg-[var(--text-primary)]/8'}`}>
                                        {filteredFaqs.length}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchTab('tips')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        tab === 'tips'
                                            ? 'bg-violet-600 text-white shadow-sm'
                                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Mẹo viết truyện
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'tips' ? 'bg-white/20' : 'bg-[var(--text-primary)]/8'}`}>
                                        {filteredTips.length}
                                    </span>
                                </button>
                            </div>

                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder={tab === 'faq' ? 'Tìm câu hỏi, câu trả lời…' : 'Tìm mẹo viết, tag…'}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--bg-hover)]/40 border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/40 transition-colors placeholder:text-[var(--text-tertiary)]"
                                />
                            </div>
                        </div>

                        {/* Category / tag filters */}
                        {tab === 'faq' && faqCategories.length > 2 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                                <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                                {faqCategories.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                            categoryFilter === cat
                                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                                : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-indigo-500/25'
                                        }`}
                                    >
                                        {cat === 'all' ? 'Tất cả' : cat}
                                    </button>
                                ))}
                            </div>
                        )}
                        {tab === 'tips' && tipTags.length > 2 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                                <Tag className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                                {tipTags.map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setTagFilter(tag)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                            tagFilter === tag
                                                ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                                                : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-violet-500/25'
                                        }`}
                                    >
                                        {tag === 'all' ? 'Tất cả' : tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-secondary)]">
                            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
                            <p className="text-sm">Đang tải tài liệu trợ giúp…</p>
                        </div>
                    ) : tab === 'faq' ? (
                        filteredFaqs.length === 0 ? (
                            <EmptyState
                                icon={CircleHelp}
                                title="Không tìm thấy câu hỏi"
                                hint="Thử đổi từ khóa hoặc bộ lọc danh mục."
                            />
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(groupedFaqs).map(([category, items]) => {
                                    const style = getCategoryStyle(category);
                                    return (
                                        <section key={category} className="space-y-3">
                                            <div className="flex items-center gap-2.5 min-h-[1.75rem]">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                                <h3 className="text-sm font-bold text-[var(--text-primary)] leading-none">{category}</h3>
                                                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[var(--text-primary)]/5 border border-[var(--border-color)] text-[var(--text-secondary)] leading-none">
                                                    {items.length}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {items.map(f => {
                                                    const isOpen = openFaq === f.id;
                                                    return (
                                                        <div
                                                            key={f.id}
                                                            className={`rounded-2xl border overflow-hidden transition-all ${
                                                                isOpen
                                                                    ? `${style.border} bg-[var(--bg-surface)]`
                                                                    : 'border-[var(--border-color)] bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)]'
                                                            }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="w-full text-left px-4 py-3.5 flex items-center gap-3 min-h-[3.25rem]"
                                                                onClick={() => setOpenFaq(isOpen ? null : f.id)}
                                                            >
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
                                                                    <BookOpen className={`w-4 h-4 ${style.text}`} />
                                                                </div>
                                                                <p className={`flex-1 min-w-0 text-sm font-semibold leading-normal ${isOpen ? style.text : 'text-[var(--text-primary)]'}`}>
                                                                    {f.question}
                                                                </p>
                                                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? `rotate-180 ${style.text}` : 'text-[var(--text-tertiary)]'}`} />
                                                            </button>
                                                            <AnimatePresence initial={false}>
                                                                {isOpen && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="px-4 pb-4">
                                                                            <div className="ml-12 pt-3 border-t border-[var(--border-color)]/50 text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                                                                                {f.answer}
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )
                    ) : filteredTips.length === 0 ? (
                        <EmptyState
                            icon={Sparkles}
                            title="Không tìm thấy mẹo viết"
                            hint="Thử đổi từ khóa hoặc tag lọc."
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTips.map((t, idx) => (
                                <motion.button
                                    key={t.id}
                                    type="button"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                                    onClick={() => setSelectedTip(t)}
                                    className="group text-left rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-violet-500/35 hover:bg-[var(--bg-hover)]/30 transition-all p-5 flex flex-col gap-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/12 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <Lightbulb className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <div className="flex-1 min-w-0 self-center">
                                            <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-violet-300 transition-colors line-clamp-2 leading-normal">
                                                {t.title}
                                            </h3>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                                                {t.content}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 group-hover:translate-x-0.5 group-hover:text-violet-400 transition-all" />
                                    </div>
                                    {t.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[var(--border-color)]/50">
                                            {t.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/15">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    )}

                    {/* Quick links */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--border-color)] flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">Cần hỗ trợ thêm?</h3>
                                <p className="text-xs text-[var(--text-secondary)]">Liên hệ Staff hoặc xem gói dịch vụ</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {QUICK_LINKS.map(link => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.to}
                                        to={link.to}
                                        className={`group flex items-center gap-4 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]/40 transition-all hover:-translate-y-0.5 ${link.border}`}
                                    >
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${link.iconBg}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-[var(--text-primary)]">{link.label}</p>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{link.desc}</p>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-[var(--text-tertiary)] shrink-0 ${link.chevronHover}`} />
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {/* Tip detail modal */}
                    <Modal
                        isOpen={!!selectedTip}
                        onClose={() => setSelectedTip(null)}
                        title={selectedTip?.title ?? 'Mẹo viết'}
                        size="lg"
                    >
                        {selectedTip && (
                            <div className="space-y-4">
                                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                                    {selectedTip.content}
                                </p>
                                {selectedTip.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]">
                                        {selectedTip.tags.map(tag => (
                                            <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>
                </AdminPageShell>
            )}
        </MainLayout>
    );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof CircleHelp; title: string; hint: string }) {
    return (
        <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)]/50">
            <div className="w-14 h-14 rounded-2xl bg-[var(--text-primary)]/5 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{hint}</p>
        </div>
    );
}
