import { useState, useEffect, type ReactNode } from 'react';
import { Clock, Loader2, Bot, Search, Sparkles, Feather } from 'lucide-react';
import { aiService, type ChatHistoryItem } from '../../services/aiService';

const PAGE_SIZE = 15;
const POLISH_PREFIX = '[Trau chuốt]';

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

    const load = async (p = 1) => {
        setLoading(true);
        try {
            const result = await aiService.getChatHistory(projectId, p, PAGE_SIZE);
            if (p === 1) { setItems(result.items); } else { setItems(prev => [...prev, ...result.items]); }
            setTotal(result.totalCount);
            setPage(p);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(1); }, [projectId]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Lịch sử AI</span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
                    {total} mục
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
                {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Đang tải...</span>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                        <Bot className="w-8 h-8 text-[var(--text-secondary)] opacity-30" />
                        <p className="text-xs text-[var(--text-secondary)]">Chưa có lịch sử AI nào.</p>
                    </div>
                ) : (
                    <>
                        {items.map(item => {
                            const isPolish = item.question.startsWith(POLISH_PREFIX);
                            const questionText = isPolish
                                ? item.question.slice(POLISH_PREFIX.length).trim()
                                : item.question;
                            return (
                                <div key={item.id} className="rounded-xl overflow-hidden border border-[var(--border-color)]"
                                    style={{ background: 'var(--bg-app)' }}>
                                    {/* Question */}
                                    <div className="px-3 py-2 flex items-start gap-2"
                                        style={{
                                            background: isPolish ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.06)',
                                            borderBottom: '1px solid var(--border-color)',
                                        }}>
                                        {isPolish
                                            ? <Feather className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                            : <Search className="w-3 h-3 text-[var(--accent-text)] shrink-0 mt-0.5" />}
                                        <div className="min-w-0 flex-1">
                                            <span
                                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                                    isPolish
                                                        ? 'text-emerald-400 bg-emerald-400/10'
                                                        : 'text-[var(--accent-text)] bg-[var(--accent)]/10'
                                                }`}>
                                                {isPolish ? 'Trau chuốt' : 'AI Chat'}
                                            </span>
                                            <p className="text-xs text-[var(--text-primary)] leading-relaxed mt-1">{questionText}</p>
                                        </div>
                                    </div>
                                {/* Answer */}
                                <div className="px-3 py-2 flex items-start gap-2">
                                    <Sparkles className="w-3 h-3 text-[var(--accent-text)] shrink-0 mt-0.5" />
                                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                        {renderMd(item.answer)}
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="px-3 pb-2 flex items-center justify-between">
                                    <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                                        {item.totalTokens.toLocaleString()} tokens
                                    </span>
                                </div>
                                </div>
                            );
                        })}

                        {/* Load more */}
                        {items.length < total && (
                            <button onClick={() => load(page + 1)} disabled={loading}
                                className="w-full py-2 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text)] disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                                {loading
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</>
                                    : `Tải thêm (${total - items.length} còn lại)`}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
