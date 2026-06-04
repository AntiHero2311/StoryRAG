import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleHelp,
  Sparkles,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Search,
  Tag,
  PenTool,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '../layouts/MainLayout';
import { faqService, type Faq } from '../services/faqService';
import { writingTipService, type WritingTip } from '../services/writingTipService';

function normalizeList<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Tổng quan': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'Bắt đầu': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'AI & RAG': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  'Phân tích': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  'Gói & thanh toán': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  'Workspace': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  'Bảo mật': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  'Hỗ trợ': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
};

function getCategoryStyle(cat?: string) {
  if (!cat) return { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' };
  const normalizedKey = cat.toLowerCase() === 'general' ? 'Tổng quan' : cat;
  const normalized = Object.keys(CATEGORY_COLORS).find(
    (k) => k.toLowerCase() === normalizedKey.toLowerCase()
  );
  return normalized ? CATEGORY_COLORS[normalized] : { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' };
}

export default function HelpPage() {
  const [tab, setTab] = useState<'faq' | 'tips'>('faq');
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [tips, setTips] = useState<WritingTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    load();
  }, [load]);

  // Filtering based on search term
  const filteredFaqs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return faqs;
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(term) ||
        (f.answer && f.answer.toLowerCase().includes(term)) ||
        (f.category && f.category.toLowerCase().includes(term))
    );
  }, [faqs, searchTerm]);

  const filteredTips = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tips;
    return tips.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.content && t.content.toLowerCase().includes(term)) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(term)))
    );
  }, [tips, searchTerm]);

  // Group FAQ by category for better visualization
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, Faq[]> = {};
    filteredFaqs.forEach((f) => {
      const cat = f.category && f.category.toLowerCase() === 'general' ? 'Tổng quan' : (f.category || 'Tổng quan');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    });
    return groups;
  }, [filteredFaqs]);

  return (
    <MainLayout pageTitle="Trợ giúp & Hướng dẫn">
      {() => (
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 select-none">
          {/* Header & Subtitle */}
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-2xl font-black text-[var(--text-bright)] tracking-tight">
              Trợ giúp & Hướng dẫn
            </h1>
            <p className="text-sm text-[var(--text-secondary)] max-w-xl">
              Khám phá các hướng dẫn sử dụng, giải đáp thắc mắc thường gặp và những mẹo viết truyện nâng cao từ hệ thống AI.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 flex items-start gap-3.5 text-sm text-rose-300 shadow-md">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Đã xảy ra sự cố</p>
                <p className="text-xs text-rose-400 mt-0.5">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-500/30 hover:border-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-rose-200 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Thử lại
                </button>
              </div>
            </div>
          )}

          {/* Search & Tabs Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border-b border-[var(--border-color)]/60 pb-5">
            {/* Tabs Control */}
            <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] p-1 rounded-xl shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => {
                  setTab('faq');
                  setSearchTerm('');
                }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  tab === 'faq'
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <CircleHelp className="w-4 h-4" /> Câu hỏi thường gặp
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('tips');
                  setSearchTerm('');
                }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  tab === 'tips'
                    ? 'bg-violet-600 text-white shadow-sm font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sparkles className="w-4 h-4" /> Mẹo viết truyện
              </button>
            </div>

            {/* Search input field */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-secondary)]">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  tab === 'faq'
                    ? 'Tìm câu hỏi, câu trả lời hoặc danh mục...'
                    : 'Tìm chủ đề, mẹo viết hoặc tag...'
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-[var(--text-tertiary)]"
              />
            </div>
          </div>

          {/* Main Contents Panel */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-secondary)]">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold">Đang tải tài liệu trợ giúp…</p>
            </div>
          ) : tab === 'faq' ? (
            filteredFaqs.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)]/20">
                <CircleHelp className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-55" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Không tìm thấy câu hỏi</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Vui lòng thử lại với từ khóa tìm kiếm khác.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedFaqs).map(([category, items]) => {
                  const style = getCategoryStyle(category);
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className={`w-1.5 h-3 rounded-full ${style.bg.replace('/10', '/80')} bg-indigo-500`} />
                        <h2 className="text-xs font-bold text-[var(--text-bright)] uppercase tracking-wider">
                          {category}
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-secondary)] font-mono">
                          {items.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {items.map((f) => {
                          const isOpen = openFaq === f.id;
                          return (
                            <div
                              key={f.id}
                              className={`rounded-2xl border transition-all duration-200 ${
                                isOpen
                                  ? 'border-indigo-500/30 bg-[var(--bg-surface)]/90 shadow-md shadow-indigo-500/2'
                                  : 'border-[var(--border-color)] bg-[var(--bg-surface)]/60 hover:bg-[var(--bg-surface)] hover:border-[var(--border-color)]/80'
                              }`}
                            >
                              <button
                                type="button"
                                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
                                onClick={() => setOpenFaq(isOpen ? null : f.id)}
                              >
                                <span className={`font-semibold text-xs transition-colors duration-150 ${isOpen ? 'text-indigo-300 font-bold' : 'text-[var(--text-primary)]'}`}>
                                  {f.question}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${
                                    isOpen ? 'rotate-180 text-indigo-400' : ''
                                  }`}
                                />
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
                                    <div className="px-5 pb-5 text-xs text-[var(--text-secondary)] whitespace-pre-wrap border-t border-[var(--border-color)]/40 pt-4 leading-relaxed font-medium select-text">
                                      {f.answer}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredTips.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)]/20">
              <Sparkles className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-55" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">Không tìm thấy mẹo viết truyện</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Vui lòng thử lại với từ khóa tìm kiếm khác.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTips.map((t, idx) => (
                <motion.article
                  key={t.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="group rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]/60 hover:bg-[var(--bg-surface)] hover:border-violet-500/35 transition-all p-5 flex flex-col justify-between hover:shadow-lg hover:shadow-violet-500/2 space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-violet-300 transition-colors line-clamp-1">
                        {t.title}
                      </h2>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                        <PenTool className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4 whitespace-pre-wrap select-text">
                      {t.content}
                    </p>
                  </div>

                  {t.tags?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[var(--border-color)]/30">
                      <Tag className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {t.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/15"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.article>
              ))}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
