import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Clock, Loader2, Bot, Search, Sparkles, User, Copy, Check, AlertCircle, MessageSquare } from 'lucide-react';
import { aiService, type ChatHistoryItem } from '../../services/aiService';
import { sanitizeAiResponseForDisplay } from '../../utils/aiResponseSanitizer';

const PAGE_SIZE = 15;
const POLISH_PREFIX = '[Trau chuốt]';
const CONTINUE_PREFIX = '[Viết tiếp]';
const WRITE_NEW_PREFIX = '[Viết mới]';
const REWRITE_PREFIX = '[Viết lại]';
const REWRITE_PREFIX_LEGACY = '[Rewrite]';
type HistoryMode = 'all' | 'chat' | 'continue' | 'polish';

// ── Inline markdown renderer (shared with ChatPanel) ───────────────────────

function renderMd(text: string): ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let key = 0;

    const parseInline = (line: string): ReactNode[] => {
        const parts: React.ReactNode[] = [];
        const re = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)[^*]+(?<!\*)\*(?!\*)|(?<!_)_(?!_)[^_]+(?<!_)_(?!_))/g;
        let last = 0, m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
            if (m.index > last) parts.push(line.slice(last, m.index));
            const raw = m[0];
            if (raw.startsWith('**')) {
                parts.push(<strong key={key++} className="font-semibold">{raw.slice(2, -2)}</strong>);
            } else if (raw.startsWith('__')) {
                parts.push(<u key={key++}>{raw.slice(2, -2)}</u>);
            } else {
                parts.push(<em key={key++}>{raw.slice(1, -1)}</em>);
            }
            last = m.index + raw.length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return parts;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) { nodes.push(<div key={key++} className="h-1.5" />); continue; }
        const bulletMatch = trimmed.match(/^([–\-•]|\*(?!\*))\s+(.*)/s);
        if (bulletMatch) {
            nodes.push(
                <div key={key++} className="flex gap-1.5 items-start my-0.5">
                    <span className="text-[var(--accent-text)] font-bold shrink-0 mt-px">•</span>
                    <span>{parseInline(bulletMatch[2])}</span>
                </div>
            );
            continue;
        }
        nodes.push(<div key={key++} className="leading-relaxed">{parseInline(trimmed)}</div>);
    }
    return <div className="flex flex-col gap-0.5">{nodes}</div>;
}

// ── Component ──────────────────────────────────────────────────────────────

interface ChatHistoryPanelProps {
    projectId: string;
}

export default function ChatHistoryPanel({ projectId }: ChatHistoryPanelProps) {
    const [items, setItems] = useState<ChatHistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<HistoryMode>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isPolishItem = (item: ChatHistoryItem) => item.question.startsWith(POLISH_PREFIX);
    const isContinueItem = (item: ChatHistoryItem) => item.question.startsWith(CONTINUE_PREFIX);
    const isWriteNewItem = (item: ChatHistoryItem) => item.question.startsWith(WRITE_NEW_PREFIX);
    const isRewriteItem = (item: ChatHistoryItem) =>
        item.question.startsWith(REWRITE_PREFIX) || item.question.startsWith(REWRITE_PREFIX_LEGACY);
    const isRewriteRelatedItem = (item: ChatHistoryItem) =>
        isPolishItem(item) || isRewriteItem(item);

    const getQuestionText = (item: ChatHistoryItem) => {
        if (isContinueItem(item)) return item.question.slice(CONTINUE_PREFIX.length).trim();
        if (isWriteNewItem(item)) return item.question.slice(WRITE_NEW_PREFIX.length).trim();
        if (isPolishItem(item)) return item.question.slice(POLISH_PREFIX.length).trim();
        if (isRewriteItem(item)) {
            if (item.question.startsWith(REWRITE_PREFIX)) return item.question.slice(REWRITE_PREFIX.length).trim();
            if (item.question.startsWith(REWRITE_PREFIX_LEGACY)) return item.question.slice(REWRITE_PREFIX_LEGACY.length).trim();
        }
        return item.question;
    };

    const load = async (p = 1) => {
        const isLoadMore = p > 1;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        try {
            const result = await aiService.getChatHistory(projectId, p, PAGE_SIZE);
            if (p === 1) { setItems(result.items); } else { setItems(prev => [...prev, ...result.items]); }
            setTotal(result.totalCount);
            setPage(p);
        } catch (e: any) {
            const message = e?.response?.data?.message ?? 'Không thể tải lịch sử chatbot lúc này.';
            setError(message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        setQuery('');
        setMode('all');
        setCopiedId(null);
        void load(1);
    }, [projectId]);

    useEffect(() => () => {
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
    }, []);

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return items.filter(item => {
            const isContinue = isContinueItem(item);
            const isPolish = isPolishItem(item);
            const isRewrite = isRewriteItem(item);
            const isWriteNew = isWriteNewItem(item);
            const isRewriteRelated = isPolish || isRewrite || isWriteNew;

            if (mode === 'chat') {
                if (isContinue || isRewriteRelated) return false;
            } else if (mode === 'continue') {
                if (!isContinue) return false;
            } else if (mode === 'polish') {
                if (!isRewriteRelated) return false;
            } else if (mode === 'all') {
                // Keep 'all' clean by excluding writing iterations as before
                if (isRewriteRelated) return false;
            }

            if (!normalizedQuery) return true;

            const q = getQuestionText(item).toLowerCase();
            const a = item.answer.toLowerCase();
            return q.includes(normalizedQuery) || a.includes(normalizedQuery);
        });
    }, [items, mode, query]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, ChatHistoryItem[]>();

        for (const item of filteredItems) {
            const date = new Date(item.createdAt);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            const existing = groups.get(key);
            if (existing) existing.push(item);
            else groups.set(key, [item]);
        }

        return Array.from(groups.entries()).map(([key, group]) => ({
            key,
            label: formatDayLabel(group[0].createdAt),
            items: group,
        }));
    }, [filteredItems]);

    const handleCopyAnswer = async (itemId: string, answer: string) => {
        try {
            await navigator.clipboard.writeText(answer);
            setCopiedId(itemId);
            if (copyResetRef.current) clearTimeout(copyResetRef.current);
            copyResetRef.current = setTimeout(() => {
                setCopiedId(prev => (prev === itemId ? null : prev));
            }, 1600);
        } catch {
            setError('Không thể sao chép câu trả lời vào clipboard.');
        }
    };

    const modeButtonClass = (target: HistoryMode, activeColor: string) =>
        `h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all border ${
            mode === target
                ? activeColor
                : 'text-[var(--text-secondary)] border-[var(--border-color)] bg-[var(--bg-app)]'
        }`;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-4 pt-3 pb-3 shrink-0 border-b border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Lịch sử chatbot</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
                        {total} lượt chat
                    </span>
                </div>

                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Tìm trong câu hỏi hoặc câu trả lời..."
                        className="w-full h-9 pl-9 pr-3 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}
                    />
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setMode('all')}
                        className={modeButtonClass('all', 'text-[var(--accent-text)] border-[var(--accent)]/35 bg-[var(--accent)]/10')}>
                        Tất cả
                    </button>
                    <button
                        onClick={() => setMode('chat')}
                        className={modeButtonClass('chat', 'text-sky-300 border-sky-400/35 bg-sky-400/10')}>
                        Chat thường
                    </button>
                    <button
                        onClick={() => setMode('continue')}
                        className={modeButtonClass('continue', 'text-amber-300 border-amber-400/35 bg-amber-400/10')}>
                        Viết tiếp
                    </button>
                    <button
                        onClick={() => setMode('polish')}
                        className={modeButtonClass('polish', 'text-emerald-300 border-emerald-400/35 bg-emerald-400/10')}>
                        Trau chuốt
                    </button>
                </div>

            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col py-4 gap-2.5">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-app)' }} />
                        ))}
                    </div>
                ) : error && items.length === 0 ? (
                    <div className="rounded-xl px-3 py-3 text-xs flex items-start gap-2"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fda4af' }}>
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold mb-1">Không tải được lịch sử chat</p>
                            <button
                                onClick={() => load(1)}
                                className="text-[10px] font-semibold underline underline-offset-2"
                                style={{ color: '#fecdd3' }}>
                                Thử tải lại
                            </button>
                        </div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                        <Bot className="w-8 h-8 text-[var(--text-secondary)] opacity-30" />
                        <p className="text-xs text-[var(--text-secondary)]">
                            {items.length === 0
                                ? 'Chưa có lịch sử chatbot nào.'
                                : 'Không có kết quả phù hợp bộ lọc hiện tại.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {groupedItems.map(group => (
                            <section key={group.key} className="space-y-2.5">
                                <div className="px-2 py-1 rounded-lg text-[10px] font-semibold tracking-wide uppercase flex items-center justify-between"
                                    style={{ background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
                                    <span>{group.label}</span>
                                    <span>{group.items.length} mục</span>
                                </div>

                                <div className="space-y-3">
                                    {group.items.map(item => {
                                        const isContinue = isContinueItem(item);
                                        const questionText = getQuestionText(item);
                                        const safeAnswer = sanitizeAiResponseForDisplay(item.answer);
                                        return (
                                            <article key={item.id}
                                                className="rounded-2xl p-3 border"
                                                style={{ background: 'var(--bg-app)', borderColor: 'var(--border-color)' }}>

                                                {/* User message */}
                                                <div className="flex justify-end gap-2 mb-2">
                                                    <div
                                                        className="max-w-[85%] rounded-2xl px-3 py-2 text-xs"
                                                        style={{
                                                            background: isContinue
                                                                ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.08))'
                                                                : 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(99,102,241,0.08))',
                                                            border: isContinue
                                                                ? '1px solid rgba(251,191,36,0.32)'
                                                                : '1px solid rgba(139,92,246,0.32)',
                                                            color: 'var(--text-primary)',
                                                            borderBottomRightRadius: '8px',
                                                        }}>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <span className="text-[10px] font-semibold">Bạn</span>
                                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                                isContinue ? 'text-amber-200 bg-amber-400/15' : 'text-indigo-200 bg-indigo-400/15'
                                                            }`}>
                                                                {isContinue ? 'Viết tiếp' : 'Chat'}
                                                            </span>
                                                        </div>
                                                        <p className="leading-relaxed whitespace-pre-wrap break-words">{questionText}</p>
                                                    </div>
                                                    <div className="w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center"
                                                        style={{
                                                            background: isContinue ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.12)',
                                                            border: isContinue ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(139,92,246,0.25)',
                                                        }}>
                                                        {isContinue
                                                            ? <Sparkles className="w-3 h-3 text-amber-200" />
                                                            : <User className="w-3 h-3 text-indigo-200" />}
                                                    </div>
                                                </div>

                                                {/* Assistant message */}
                                                <div className="flex justify-start gap-2">
                                                    <div className="w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center"
                                                        style={{
                                                            background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))',
                                                            border: '1px solid rgba(139,92,246,0.25)',
                                                        }}>
                                                        <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                                                    </div>
                                                    <div
                                                        className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed border"
                                                        style={{
                                                            background: 'var(--bg-surface)',
                                                            borderColor: 'var(--border-color)',
                                                            borderBottomLeftRadius: '8px',
                                                        }}>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <MessageSquare className="w-3 h-3 text-[var(--accent-text)]" />
                                                            <span className="text-[10px] font-semibold text-[var(--text-primary)]">AI Assistant</span>
                                                        </div>
                                                        <div className="text-[var(--text-secondary)] break-words">
                                                            {renderMd(safeAnswer)}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                                                            <span className="text-[9px] text-[var(--text-secondary)] opacity-70">
                                                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] text-[var(--text-secondary)] opacity-70">
                                                                    {item.totalTokens.toLocaleString()} tokens
                                                                </span>
                                                                <button
                                                                    onClick={() => handleCopyAnswer(item.id, safeAnswer)}
                                                                    className="h-5 px-1.5 rounded-md text-[9px] font-semibold flex items-center gap-1 transition-colors"
                                                                    style={{
                                                                        background: copiedId === item.id ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.12)',
                                                                        color: copiedId === item.id ? '#6ee7b7' : 'var(--accent-text)',
                                                                    }}>
                                                                    {copiedId === item.id
                                                                        ? <Check className="w-2.5 h-2.5" />
                                                                        : <Copy className="w-2.5 h-2.5" />}
                                                                    {copiedId === item.id ? 'Đã copy' : 'Copy'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}

                        {error && (
                            <div className="rounded-xl px-3 py-2 text-[11px] flex items-center justify-between gap-3"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fda4af' }}>
                                <div className="flex items-center gap-1.5">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{error}</span>
                                </div>
                                <button onClick={() => load(page)}
                                    className="text-[10px] font-semibold underline underline-offset-2">
                                    Thử lại
                                </button>
                            </div>
                        )}

                        {/* Load more */}
                        {items.length < total && (
                            <button
                                onClick={() => load(page + 1)}
                                disabled={loadingMore}
                                className="w-full h-9 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--accent-text)' }}>
                                {loadingMore
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Đang tải thêm...</>
                                    : `Tải thêm (${total - items.length} còn lại)`}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function formatDayLabel(isoDate: string): string {
    const value = new Date(isoDate);
    const target = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((today.getTime() - target.getTime()) / 86_400_000);

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    return value.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
