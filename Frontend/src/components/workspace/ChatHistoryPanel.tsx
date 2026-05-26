import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Clock, Loader2, Bot, Search, Copy, Check, RotateCcw, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { aiService, type ChatHistoryItem } from '../../services/aiService';
import { sanitizeAiResponseForDisplay } from '../../utils/aiResponseSanitizer';

const PAGE_SIZE = 15;


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

    const handleDeleteHistory = async (historyId: string) => {
        try {
            await aiService.deleteChatHistory(projectId, historyId);
            setItems(prev => prev.filter(item => item.id !== historyId));
            setTotal(prev => Math.max(0, prev - 1));
        } catch (e: any) {
            console.error('Lỗi khi xóa lịch sử chat:', e);
        }
    };

    useEffect(() => {
        setQuery('');
    }, [projectId]);

    useEffect(() => {
        if (projectId) load(1);
    }, [projectId]);

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return items.filter(item => {
            if (!normalizedQuery) return true;
            return item.question.toLowerCase().includes(normalizedQuery) || 
                   item.answer.toLowerCase().includes(normalizedQuery);
        });
    }, [items, query]);

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
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6 scrollbar-thin">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                        <span>{error}</span>
                    </div>
                )}
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
                                        <HistoryItemRow key={item.id} item={item} onDelete={() => handleDeleteHistory(item.id)} />
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
function HistoryItemRow({ item, onDelete }: { item: ChatHistoryItem, onDelete?: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const getDisplayQuestion = () => {
        return <p className="leading-relaxed whitespace-pre-wrap break-words line-clamp-3">{item.question}</p>;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(item.answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-5 py-4 border-b border-[var(--border-color)]/50 last:border-0">
            {/* User Message */}
            <div className="flex justify-end pr-1">
                <div className="flex flex-col items-end max-w-[85%]">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl rounded-tr-sm px-4 py-3 text-[12px] shadow-sm">
                         {getDisplayQuestion()}
                    </div>
                </div>
            </div>

            {/* AI Message */}
            <div className="flex gap-3 pl-1">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-md mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 flex flex-col items-start min-w-0 pt-0.5">
                    <div className="relative w-full">
                        <div className={`text-[13px] leading-relaxed text-[var(--text-primary)] transition-all duration-300 overflow-hidden ${!expanded && item.answer.length > 300 ? 'max-h-[200px]' : ''}`}>
                             {renderMd(sanitizeAiResponseForDisplay(item.answer))}
                        </div>
                        {!expanded && item.answer.length > 300 && (
                             <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-app)] to-transparent pointer-events-none" />
                        )}
                    </div>
                    
                    {/* Action Bar beneath AI Message */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 w-full">
                        {!expanded && item.answer.length > 300 && (
                            <button 
                                onClick={() => setExpanded(true)}
                                className="text-[11px] font-bold text-[var(--accent-text)] hover:text-white transition-colors flex items-center gap-1 bg-[var(--accent)]/10 px-3 py-1.5 rounded-lg border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20"
                            >
                                Đọc tiếp <ChevronDown className="w-3 h-3" />
                            </button>
                        )}
                        {expanded && item.answer.length > 300 && (
                            <button 
                                onClick={() => setExpanded(false)}
                                className="text-[11px] font-bold text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1 bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
                            >
                                Thu gọn <ChevronUp className="w-3 h-3" />
                            </button>
                        )}
                        
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${copied ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)]'}`}
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Đã copy' : 'Copy'}
                        </button>

                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--text-secondary)] hover:text-red-400 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-red-400/30 hover:bg-red-400/10 transition-all ml-1"
                                title="Xóa lịch sử"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa
                            </button>
                        )}
                        
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] opacity-50 ml-auto font-medium">
                            <span>{new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{item.totalTokens.toLocaleString()} tk</span>
                        </div>
                    </div>
                </div>
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
    return value.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
