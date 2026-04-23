import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Sparkles, Bot, Trash2, Send, Loader2 } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { sanitizeAiResponseForDisplay } from '../../utils/aiResponseSanitizer';

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string; tokens?: number };

interface ChatPanelProps {
    projectId: string;
    isEmbedded: boolean;
    onEmbed?: () => void;
    isSyncing?: boolean;
}

// ── Markdown renderer ──────────────────────────────────────────────────────

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

// ── Suggestions ────────────────────────────────────────────────────────────

const SUGGESTIONS = [
    { icon: '👤', text: 'Nhân vật chính là ai?' },
    { icon: '📖', text: 'Tóm tắt cốt truyện chương này' },
    { icon: '🗺️', text: 'Bối cảnh câu chuyện ở đâu?' },
    { icon: '💡', text: 'Gợi ý plot twist tiếp theo' },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatPanel({ projectId, isEmbedded, onEmbed, isSyncing }: ChatPanelProps) {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () =>
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const doChat = async () => {
        if (!projectId || !input.trim() || loading) return;
        const question = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: question }]);
        setLoading(true);
        scrollToBottom();
        try {
            const result = await aiService.chat(projectId, question);
            const safeAnswer = sanitizeAiResponseForDisplay(result.answer);
            setMessages(prev => [...prev, {
                role: 'assistant', content: safeAnswer, tokens: result.totalTokens,
            }]);
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'AI Chat thất bại. Vui lòng thử lại.';
            setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    // Auto-resize textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    return (
        <div className="flex-1 flex flex-col min-h-0">

            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.1))' }}>
                        <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">AI Chat</span>
                    {isEmbedded && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                            ● Sẵn sàng
                        </span>
                    )}
                </div>
                {messages.length > 0 && (
                    <button onClick={() => setMessages([])} title="Xóa lịch sử chat"
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-3 min-h-0 scrollbar-thin">

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))',
                                border: '1px solid rgba(139,92,246,0.2)',
                                boxShadow: '0 4px 20px rgba(139,92,246,0.1)',
                            }}>
                            <Bot className="w-6 h-6 text-[var(--accent-text)]" />
                        </div>
                        <div>
                            <p className="text-[var(--text-primary)] text-xs font-bold mb-1">Hỏi về nội dung truyện</p>
                            <p className="text-[var(--text-secondary)] text-[10px] leading-relaxed max-w-[200px]">
                                {isEmbedded
                                    ? 'Hỏi bất cứ điều gì về nhân vật, cốt truyện, bối cảnh...'
                                    : 'Nội dung chưa được đồng bộ với AI. Hãy embed để bắt đầu.'}
                            </p>
                        </div>

                        {/* Embed button for ChatPanel context */}
                        {!isEmbedded && onEmbed && (
                            <button
                                onClick={onEmbed}
                                disabled={isSyncing}
                                className="group relative flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff',
                                    boxShadow: '0 4px 15px rgba(16,185,129,0.25)',
                                }}
                            >
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>ĐANG ĐỒNG BỘ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>EMBED NGAY</span>
                                    </>
                                )}
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]" />
                            </button>
                        )}
                        {/* Suggestion cards */}
                        {isEmbedded && (
                            <div className="flex flex-col gap-1.5 w-full px-1">
                                {SUGGESTIONS.map(s => (
                                    <button key={s.text} onClick={() => setInput(s.text)}
                                        className="group text-left text-[10px] px-3 py-2 rounded-xl transition-all flex items-center gap-2"
                                        style={{
                                            background: 'var(--bg-app)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                            (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.04)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-app)';
                                        }}>
                                        <span className="text-sm">{s.icon}</span>
                                        <span>{s.text}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Messages list */}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        style={{ animation: 'fadeSlideIn 0.25s ease-out' }}>
                        {/* AI avatar */}
                        {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))',
                                    border: '1px solid rgba(139,92,246,0.25)',
                                }}>
                                <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                            </div>
                        )}
                        <div
                            className="max-w-[82%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed"
                            style={msg.role === 'user'
                                ? {
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))',
                                    color: 'var(--text-primary)',
                                    border: '1px solid rgba(139,92,246,0.25)',
                                    borderBottomRightRadius: '6px',
                                }
                                : {
                                    background: 'var(--bg-app)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    borderBottomLeftRadius: '6px',
                                }
                            }>
                            {msg.role === 'assistant' ? renderMd(msg.content) : msg.content}
                            {msg.tokens && (
                                <div className="mt-1.5 text-[9px] opacity-40 flex items-center gap-1">
                                    <Sparkles className="w-2 h-2" />{msg.tokens.toLocaleString()} tokens
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                    <div className="flex gap-2 justify-start" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
                        <div className="w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1))',
                                border: '1px solid rgba(139,92,246,0.25)',
                            }}>
                            <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                        </div>
                        <div className="px-4 py-3 rounded-2xl flex items-center gap-3"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderBottomLeftRadius: '6px' }}>
                            <div className="flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)]">Đang phân tích...</span>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="px-3 pb-3 shrink-0">
                <div className="rounded-xl overflow-hidden transition-all"
                    style={{
                        background: 'var(--bg-app)',
                        border: input
                            ? '1px solid rgba(139,92,246,0.4)'
                            : '1px solid var(--border-color)',
                        boxShadow: input ? '0 0 0 3px rgba(139,92,246,0.08)' : 'none',
                    }}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doChat(); } }}
                        placeholder={isEmbedded ? 'Nhập câu hỏi... (Enter để gửi)' : 'Embed chương để dùng AI Chat'}
                        disabled={!isEmbedded || loading}
                        rows={1}
                        className="w-full bg-transparent resize-none text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none px-3 pt-2.5 pb-1"
                        style={{ maxHeight: '120px' }}
                    />
                    <div className="flex items-center justify-between px-2 pb-2">
                        <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                            {input.length > 0 ? `${input.length} ký tự` : 'Shift+Enter xuống dòng'}
                        </span>
                        <button onClick={doChat}
                            disabled={!input.trim() || !isEmbedded || loading}
                            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-25"
                            style={{
                                background: input.trim() && isEmbedded
                                    ? 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(99,102,241,0.9))'
                                    : 'rgba(139,92,246,0.15)',
                                color: input.trim() ? '#fff' : 'var(--accent)',
                            }}>
                            {loading
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Send className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
