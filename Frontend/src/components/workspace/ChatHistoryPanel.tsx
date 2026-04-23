import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Clock, Loader2, Bot, Search, Sparkles, User, Copy, Check, AlertCircle, MessageSquare, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { aiService, type ChatHistoryItem } from '../../services/aiService';
import { sanitizeAiResponseForDisplay } from '../../utils/aiResponseSanitizer';

const PAGE_SIZE = 15;
const POLISH_PREFIX = '[Trau chuốt]';
const CONTINUE_PREFIX = '[Viết tiếp]';
const WRITE_NEW_PREFIX = '[Viết mới]';
const REWRITE_PREFIX = '[Viết lại]';
const REWRITE_PREFIX_LEGACY = '[Rewrite]';

type HistoryMode = 'all' | 'chat' | 'continue' | 'polish';

// ── Inline markdown renderer ───────────────────────────────────────────────
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

// ── Main Component ─────────────────────────────────────────────────────────
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

    const load = async (p = 1) => {
        const isLoadMore = p > 1;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        try {
            const result = await aiService.getChatHistory(projectId, p, PAGE_SIZE);
            if (p === 1) { setItems(result.items); } 
            else { setItems(prev => [...prev, ...result.items]); }
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
    }, [projectId]);

    useEffect(() => {
        if (projectId) load(1);
    }, [projectId, mode]);

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return items.filter(item => {
            const isContinue = item.question.startsWith(CONTINUE_PREFIX);
            const isPolish = item.question.startsWith(POLISH_PREFIX);
            const isWriteNew = item.question.startsWith(WRITE_NEW_PREFIX);
            const isRewrite = item.question.startsWith(REWRITE_PREFIX) || item.question.startsWith(REWRITE_PREFIX_LEGACY);
            const isRewriteRelated = isPolish || isRewrite || isWriteNew;

            if (mode === 'chat') {
                if (isContinue || isRewriteRelated) return false;
            } else if (mode === 'continue') {
                if (!isContinue) return false;
            } else if (mode === 'polish') {
                if (!isRewriteRelated) return false;
            } else if (mode === 'all') {
                if (isRewriteRelated) return false;
            }

            if (!normalizedQuery) return true;
            return item.question.toLowerCase().includes(normalizedQuery) || 
                   item.answer.toLowerCase().includes(normalizedQuery);
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
                        <button
                            onClick={() => load(1)}
                            disabled={loading}
                            className="p-1 hover:bg-[var(--hover-bg)] rounded-md transition-colors disabled:opacity-30"
                            title="Làm mới lịch sử"
                        >
                            <RotateCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </button>
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

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button onClick={() => setMode('all')} className={modeButtonClass('all', 'text-[var(--accent-text)] border-[var(--accent)]/35 bg-[var(--accent)]/10')}>Tất cả</button>
                    <button onClick={() => setMode('chat')} className={modeButtonClass('chat', 'text-sky-300 border-sky-400/35 bg-sky-400/10')}>Chat thường</button>
                    <button onClick={() => setMode('continue')} className={modeButtonClass('continue', 'text-amber-300 border-amber-400/35 bg-amber-400/10')}>Viết tiếp</button>
                    <button onClick={() => setMode('polish')} className={modeButtonClass('polish', 'text-emerald-300 border-emerald-400/35 bg-emerald-400/10')}>Viết lại / Trau chuốt</button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6 scrollbar-thin">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col py-4 gap-2.5">
                        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-app)' }} />)}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                        <Bot className="w-8 h-8 text-[var(--text-secondary)] opacity-30" />
                        <p className="text-xs text-[var(--text-secondary)]">
                            {items.length === 0 ? 'Chưa có lịch sử chatbot nào.' : 'Không tìm thấy kết quả phù hợp.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {groupedItems.map(group => (
                            <section key={group.key} className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-50" />
                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{group.label}</span>
                                    <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-50" />
                                </div>
                                <div className="space-y-4">
                                    {group.items.map(item => (
                                        <HistoryItemRow key={item.id} item={item} />
                                    ))}
                                </div>
                            </section>
                        ))}

                        {items.length < total && (
                            <button
                                onClick={() => load(page + 1)}
                                disabled={loadingMore}
                                className="w-full h-9 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--accent-text)' }}>
                                {loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tải thêm...'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Sub-component for individual history item ───────────────────────────
function HistoryItemRow({ item }: { item: ChatHistoryItem }) {
    const isContinue = item.question.startsWith(CONTINUE_PREFIX);
    const isPolish = item.question.startsWith(POLISH_PREFIX);
    const isRewrite = item.question.startsWith(REWRITE_PREFIX) || item.question.startsWith(REWRITE_PREFIX_LEGACY);
    const isWriteNew = item.question.startsWith(WRITE_NEW_PREFIX);

    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const getDisplayQuestion = () => {
        let text = item.question;
        if (isContinue) text = text.slice(CONTINUE_PREFIX.length).trim();
        else if (isPolish) text = text.slice(POLISH_PREFIX.length).trim();
        else if (isWriteNew) text = text.slice(WRITE_NEW_PREFIX.length).trim();
        else if (isRewrite) {
            if (text.startsWith(REWRITE_PREFIX)) text = text.slice(REWRITE_PREFIX.length).trim();
            else text = text.slice(REWRITE_PREFIX_LEGACY.length).trim();
        }

        if (isContinue && text.includes('| Tiếp nối từ:')) {
            const [inst, ctx] = text.split('| Tiếp nối từ:');
            return (
                <div className="space-y-1.5">
                    <p className="font-semibold text-[var(--accent-text)]">{inst.trim()}</p>
                    <div className="text-[10px] opacity-60 italic border-l-2 border-[var(--accent)]/30 pl-2 line-clamp-2">
                        Từ: {ctx.trim()}
                    </div>
                </div>
            );
        }
        return <p className="leading-relaxed whitespace-pre-wrap break-words line-clamp-3">{text}</p>;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(item.answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <article className="group relative rounded-2xl overflow-hidden border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-all duration-300"
            style={{ background: 'var(--bg-app)' }}>
            
            <div className="p-3.5 space-y-4">
                {/* User side */}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 pr-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isContinue ? 'text-amber-200 bg-amber-400/20' : 
                            (isPolish || isRewrite) ? 'text-emerald-200 bg-emerald-400/20' : 
                            'text-indigo-200 bg-indigo-400/20'
                        }`}>
                            {isContinue ? 'Viết tiếp' : (isPolish || isRewrite) ? 'Viết lại' : 'Chat'}
                        </span>
                        <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Bạn</span>
                    </div>
                    <div className="max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[11px]"
                        style={{ 
                            background: 'var(--bg-surface)', 
                            border: '1px solid var(--border-color)',
                            borderBottomRightRadius: '4px'
                        }}>
                        {getDisplayQuestion()}
                    </div>
                </div>

                {/* AI side */}
                <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2 pl-1">
                        <div className="w-5 h-5 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[var(--accent-text)]" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)] opacity-80 uppercase tracking-tighter">AI Assistant</span>
                    </div>
                    
                    <div className="relative w-full">
                        <div className={`max-w-[95%] rounded-2xl px-3.5 py-3 text-[11px] leading-[1.8] border border-[var(--border-color)] transition-all duration-500 overflow-hidden ${!expanded ? 'max-h-[120px]' : ''}`}
                            style={{ 
                                background: 'linear-gradient(to bottom right, var(--bg-surface), var(--bg-app))',
                                borderBottomLeftRadius: '4px'
                            }}>
                            <div className="text-[var(--text-secondary)]">
                                {renderMd(sanitizeAiResponseForDisplay(item.answer))}
                            </div>
                            
                            {!expanded && item.answer.length > 250 && (
                                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-app)] to-transparent pointer-events-none" />
                            )}
                        </div>
                        
                        {item.answer.length > 250 && (
                            <button 
                                onClick={() => setExpanded(!expanded)}
                                className="mt-2 text-[10px] font-bold text-[var(--accent-text)] hover:underline flex items-center gap-1"
                            >
                                {expanded ? 'Thu gọn' : 'Xem thêm toàn bộ'}
                                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer actions */}
            <div className="px-3.5 py-2 bg-[var(--bg-surface)]/50 border-t border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-3 opacity-40">
                    <span className="text-[9px]">{new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[9px]">{item.totalTokens.toLocaleString()} tokens</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={{ 
                        background: copied ? 'rgba(16,185,129,0.1)' : 'var(--accent-subtle)',
                        color: copied ? '#10b981' : 'var(--accent-text)' 
                    }}
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Đã copy' : 'Copy'}
                </button>
            </div>
        </article>
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
    return value.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
