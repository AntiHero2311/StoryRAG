import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { Sparkles, Bot, Trash2, Send, Loader2, Plus, MessageSquare, Clock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { sanitizeAiResponseForDisplay } from '../../utils/aiResponseSanitizer';
import { type ProjectReportResponse } from '../../services/reportService';

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string; tokens?: number; createdAt: string };

interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
    messages: ChatMsg[];
}

interface AnalysisChatPanelProps {
    projectId: string;
    report: ProjectReportResponse;
}

// ── Inline Markdown Renderer ───────────────────────────────────────────────

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
                parts.push(<strong key={key++} className="font-semibold text-amber-200">{raw.slice(2, -2)}</strong>);
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
                    <span className="text-amber-400 font-bold shrink-0 mt-px">•</span>
                    <span>{parseInline(bulletMatch[2])}</span>
                </div>
            );
            continue;
        }
        nodes.push(<div key={key++} className="leading-relaxed whitespace-pre-wrap">{parseInline(trimmed)}</div>);
    }
    return <div className="flex flex-col gap-1">{nodes}</div>;
}

// ── Combined Prompt builder (Full RAG context + dialogue history) ──────────

const buildCombinedPrompt = (
    report: ProjectReportResponse,
    messages: ChatMsg[],
    newQuestion: string
): string => {
    let context = ``;
    
    // 1. Report info
    context += `[BÁO CÁO PHÂN TÍCH CHI TIẾT CỦA TÁC PHẨM]\n`;
    context += `Tên truyện: ${report.projectTitle}\n`;
    context += `Tổng điểm: ${report.totalScore.toFixed(1)}/100\n`;
    context += `Phân loại chất lượng: ${report.classification}\n`;
    context += `Nhận xét tổng quan của AI: ${report.overallFeedback}\n\n`;
    
    // 2. Evaluation groups
    context += `**Đánh giá chi tiết các nhóm tiêu chí:**\n`;
    report.groups.forEach(g => {
        context += `- Nhóm "${g.name}": ${g.score}/${g.maxScore}\n`;
        g.criteria.forEach(c => {
            context += `  + Tiêu chí "${c.criterionName}": ${c.score}/${c.maxScore}\n`;
            context += `    * Nhận xét chi tiết: ${c.feedback}\n`;
            if (c.errors && c.errors.length > 0) {
                context += `    * Lỗi phát hiện: ${c.errors.join('; ')}\n`;
            }
            if (c.suggestions && c.suggestions.length > 0) {
                context += `    * Gợi ý sửa đổi: ${c.suggestions.join('; ')}\n`;
            }
        });
    });
    
    // 3. Warnings
    if (report.warnings && report.warnings.length > 0) {
        context += `\n**Các cảnh báo đặc biệt trong tác phẩm:**\n`;
        report.warnings.forEach(w => {
            context += `- [Cấp độ ${w.severity}] ${w.title}: ${w.detail}\n`;
        });
    }

    // 4. Story Bible (Cẩm nang truyện)
    if (report.contentAnalysis) {
        const bible = report.contentAnalysis;
        context += `\n**Cẩm nang truyện (Story Bible):**\n`;
        if (bible.characters && bible.characters.length > 0) {
            context += `- Nhân vật:\n`;
            bible.characters.forEach(c => {
                context += `  + ${c.name} (${c.role}): ${c.description}. Bối cảnh: ${c.background}. Traits: ${c.traits.join(', ')}. Xuất hiện từ: Chương ${c.firstAppearance}\n`;
            });
        }
        if (bible.worldSettings && bible.worldSettings.length > 0) {
            context += `- Thiết lập thế giới & bối cảnh:\n`;
            bible.worldSettings.forEach(w => {
                context += `  + ${w.title} (${w.category}): ${w.description}. Độ quan trọng: ${w.importance}\n`;
            });
        }
        if (bible.timelineEvents && bible.timelineEvents.length > 0) {
            context += `- Các sự kiện dòng thời gian:\n`;
            bible.timelineEvents.forEach(e => {
                context += `  + ${e.timeLabel} - ${e.title}: ${e.description}\n`;
            });
        }
    }
    
    // 5. System instructions for this session
    const systemInstruction = `
[HƯỚNG DẪN DÀNH CHO AI TRỢ LÝ]
Bạn đóng vai trò là một chuyên gia phê bình văn học và trợ lý AI thông thái. Bạn đã được cung cấp toàn bộ nội dung của báo cáo phân tích chi tiết ở trên.
Hãy tuân thủ các quy tắc sau:
1. Đọc và hiểu kỹ báo cáo phân tích và Story Bible ở trên. Trả lời mọi câu hỏi của tác giả dựa trên các dữ liệu đánh giá này.
2. Trả lời bằng tiếng Việt, súc tích, mang tính xây dựng, truyền cảm hứng và chuyên nghiệp.
3. Khi trích dẫn hoặc phân tích, hãy trích xuất chính xác các nhận xét, lỗi phát hiện hoặc điểm số trong báo cáo để giải đáp.
4. Mọi thông tin trao đổi phải nhất quán với báo cáo. Tuyệt đối không bịa đặt thông tin không có trong báo cáo hoặc truyện.
5. Đây là cuộc hội thoại đa lượt (multi-turn). Dưới đây là lịch sử chat giữa bạn và tác giả. Hãy tham khảo lịch sử này để trả lời câu hỏi mới một cách mạch lạc.
6. Trả lời trực tiếp vào trọng tâm câu hỏi. Định dạng câu trả lời đẹp mắt bằng Markdown.
`;

    // 6. Conversation history (excluding the very last new question)
    let history = '';
    if (messages.length > 0) {
        history += `\n[LỊCH SỬ TRAO ĐỔI GIỮA BẠN VÀ TÁC GIẢ]\n`;
        messages.forEach(msg => {
            const role = msg.role === 'user' ? 'Tác giả' : 'AI Trợ lý';
            history += `${role}: ${msg.content}\n`;
        });
    }

    return `${context}\n${systemInstruction}\n${history}\n[CÂU HỎI MỚI CỦA TÁC GIẢ]\nTác giả: ${newQuestion}\nAI Trợ lý:`;
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AnalysisChatPanel({ projectId, report }: AnalysisChatPanelProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>('');
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const storageKey = `report_chat_sessions:${report.id}`;

    // Get lowest group for custom recommendations
    const lowestGroup = useMemo(() => {
        if (!report.groups || report.groups.length === 0) return null;
        return [...report.groups].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))[0];
    }, [report]);

    // Dynamic suggestions based on report
    const suggestions = useMemo(() => {
        const list = [
            { icon: '📊', text: `Phân tích tại sao truyện đạt ${report.totalScore.toFixed(1)} điểm? Ưu điểm lớn nhất là gì?` }
        ];
        if (lowestGroup) {
            list.push({ icon: '⚠️', text: `Làm thế nào để cải thiện và khắc phục các lỗi trong nhóm "${lowestGroup.name}"?` });
        }
        if (report.warnings && report.warnings.length > 0) {
            list.push({ icon: '🚨', text: `Đề xuất hướng xử lý chi tiết cho các cảnh báo đặc biệt được phát hiện.` });
        }
        list.push({ icon: '💡', text: 'Hãy gợi ý cách phát triển các chương tiếp theo để tăng tính kịch tính cho cốt truyện.' });
        return list;
    }, [report, lowestGroup]);

    // Load sessions from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as ChatSession[];
                if (parsed.length > 0) {
                    setSessions(parsed);
                    setActiveSessionId(parsed[0].id);
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to load chat sessions:', e);
        }

        // Default session if empty
        const defaultSess: ChatSession = {
            id: 'session-' + Date.now(),
            title: 'Thảo luận tổng quan',
            createdAt: new Date().toISOString(),
            messages: []
        };
        setSessions([defaultSess]);
        setActiveSessionId(defaultSess.id);
    }, [report.id, storageKey]);

    const activeSession = useMemo(() => {
        return sessions.find(s => s.id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    const saveSessions = (updated: ChatSession[]) => {
        setSessions(updated);
        try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save chat sessions:', e);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    useEffect(() => {
        if (activeSession && activeSession.messages.length > 0) {
            scrollToBottom();
        }
    }, [activeSessionId]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const handleCreateSession = () => {
        const newSess: ChatSession = {
            id: 'session-' + Date.now(),
            title: `Cuộc thảo luận mới`,
            createdAt: new Date().toISOString(),
            messages: []
        };
        const updated = [newSess, ...sessions];
        saveSessions(updated);
        setActiveSessionId(newSess.id);
        setInput('');
    };

    const handleDeleteSession = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = sessions.filter(s => s.id !== id);
        if (updated.length === 0) {
            const defaultSess: ChatSession = {
                id: 'session-' + Date.now(),
                title: 'Thảo luận tổng quan',
                createdAt: new Date().toISOString(),
                messages: []
            };
            saveSessions([defaultSess]);
            setActiveSessionId(defaultSess.id);
        } else {
            saveSessions(updated);
            if (activeSessionId === id) {
                setActiveSessionId(updated[0].id);
            }
        }
    };

    const handleSend = async (customText?: string) => {
        const textToSend = (customText || input).trim();
        if (!textToSend || !activeSession || loading) return;

        setInput('');
        
        // Append user question
        const userMsg: ChatMsg = {
            role: 'user',
            content: textToSend,
            createdAt: new Date().toISOString()
        };

        const updatedMessages = [...activeSession.messages, userMsg];
        
        // Dynamically update session title if it's the first message
        let newTitle = activeSession.title;
        if (activeSession.messages.length === 0) {
            newTitle = textToSend.length > 30 ? textToSend.slice(0, 27) + '...' : textToSend;
        }

        const updatedSession: ChatSession = {
            ...activeSession,
            title: newTitle,
            messages: updatedMessages
        };

        const updatedSessions = sessions.map(s => s.id === activeSession.id ? updatedSession : s);
        saveSessions(updatedSessions);
        setLoading(true);
        scrollToBottom();

        // 2. Build full context prompt
        const prompt = buildCombinedPrompt(report, activeSession.messages, textToSend);

        try {
            const result = await aiService.chat(projectId, prompt);
            const safeAnswer = sanitizeAiResponseForDisplay(result.answer);
            
            const assistantMsg: ChatMsg = {
                role: 'assistant',
                content: safeAnswer,
                tokens: result.totalTokens,
                createdAt: new Date().toISOString()
            };

            const finalSession = {
                ...updatedSession,
                messages: [...updatedMessages, assistantMsg]
            };

            saveSessions(sessions.map(s => s.id === activeSession.id ? finalSession : s));
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'Trò chuyện thất bại. Vui lòng thử lại sau.';
            const errMsg: ChatMsg = {
                role: 'assistant',
                content: `⚠️ Có lỗi xảy ra: ${msg}`,
                createdAt: new Date().toISOString()
            };
            const finalSession = {
                ...updatedSession,
                messages: [...updatedMessages, errMsg]
            };
            saveSessions(sessions.map(s => s.id === activeSession.id ? finalSession : s));
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    const handleCopy = (content: string, index: number) => {
        navigator.clipboard.writeText(content);
        setCopiedId(index);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[var(--bg-app)] rounded-2xl overflow-hidden border border-[var(--border-color)]">
            
            {/* Left Sidebar - Chat Sessions List */}
            <div className="w-full md:w-[260px] border-b md:border-b-0 md:border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] shrink-0">
                <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[var(--text-primary)] tracking-wider">Hội thoại lịch sử</span>
                    <button 
                        onClick={handleCreateSession}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--accent-text)] transition-all bg-[var(--accent)]/10 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20"
                        title="Tạo hội thoại mới"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Session list container */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[160px] md:max-h-none scrollbar-thin">
                    {sessions.map(s => {
                        const isActive = s.id === activeSessionId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => {
                                    if (!loading) {
                                        setActiveSessionId(s.id);
                                    }
                                }}
                                className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-left transition-all relative group"
                                style={{
                                    background: isActive ? 'linear-gradient(135deg, rgba(245,166,35,0.12), rgba(249,115,22,0.06))' : 'transparent',
                                    border: isActive ? '1px solid rgba(245,166,35,0.25)' : '1px solid transparent',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                            >
                                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'opacity-40'}`} />
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-semibold truncate leading-snug">{s.title}</p>
                                    <p className="text-[9px] opacity-40 mt-0.5">{new Date(s.createdAt).toLocaleDateString('vi-VN')} {new Date(s.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteSession(s.id, e)}
                                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                                    title="Xóa cuộc thảo luận"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Pane - Conversation Chat */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)]">
                
                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    
                    {/* Empty session state */}
                    {(!activeSession || activeSession.messages.length === 0) && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-8 max-w-xl mx-auto">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(245,166,35,0.18), rgba(249,115,22,0.1))',
                                    border: '1px solid rgba(245,166,35,0.3)',
                                    boxShadow: '0 8px 30px rgba(245,166,35,0.12)',
                                }}>
                                <div className="absolute inset-0 rounded-2xl bg-amber-400/10 animate-pulse" />
                                <Bot className="w-7 h-7 text-amber-400 relative z-10" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[var(--text-primary)] text-sm font-black uppercase tracking-wider">Thảo luận về báo cáo</p>
                                <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                                    AI đã đọc toàn bộ <strong>Báo cáo phân tích {report.totalScore.toFixed(0)} điểm</strong> và <strong>Cẩm nang truyện (Story Bible)</strong> của bộ truyện này. Hãy đặt câu hỏi để AI hướng dẫn chỉnh sửa tác phẩm!
                                </p>
                            </div>

                            {/* Custom suggestion cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-2">
                                {suggestions.map((s, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleSend(s.text)}
                                        className="text-left text-[11px] p-3 rounded-xl transition-all flex items-start gap-2.5 border"
                                        style={{
                                            background: 'var(--bg-surface)',
                                            borderColor: 'var(--border-color)',
                                            color: 'var(--text-secondary)',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,166,35,0.4)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                            (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.04)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                                        }}>
                                        <span className="text-base mt-0.5">{s.icon}</span>
                                        <span className="leading-normal font-medium">{s.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages List */}
                    {activeSession && activeSession.messages.map((msg, i) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={i} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                                style={{ animation: 'fadeSlideIn 0.25s ease-out' }}>
                                
                                {/* AI avatar */}
                                {!isUser && (
                                    <div className="w-8 h-8 rounded-xl shrink-0 mt-0.5 flex items-center justify-center shadow-md"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(249,115,22,0.1))',
                                            border: '1px solid rgba(245,166,35,0.3)',
                                        }}>
                                        <Sparkles className="w-4 h-4 text-amber-400" />
                                    </div>
                                )}
                                
                                <div className="flex flex-col max-w-[85%]">
                                    <div
                                        className="rounded-2xl px-4 py-3 text-xs leading-relaxed relative select-text"
                                        style={isUser
                                            ? {
                                                background: 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(249,115,22,0.08))',
                                                color: 'var(--text-primary)',
                                                border: '1px solid rgba(245,166,35,0.28)',
                                                borderBottomRightRadius: '4px',
                                            }
                                            : {
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border-color)',
                                                color: 'var(--text-primary)',
                                                borderBottomLeftRadius: '4px',
                                            }
                                        }>
                                        {isUser ? msg.content : renderMd(msg.content)}
                                    </div>
                                    
                                    {/* Action row beneath message bubbles */}
                                    <div className={`flex items-center gap-2 mt-1 opacity-60 hover:opacity-100 transition-opacity text-[9px] ${isUser ? 'justify-end pr-1' : 'pl-1'}`}>
                                        {!isUser && (
                                            <button 
                                                onClick={() => handleCopy(msg.content, i)}
                                                className="hover:text-amber-400 transition-colors flex items-center gap-0.5 mr-2"
                                            >
                                                {copiedId === i ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                                {copiedId === i ? 'Đã sao chép' : 'Sao chép'}
                                            </button>
                                        )}
                                        <span>{new Date(msg.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                        {msg.tokens && (
                                            <>
                                                <span>•</span>
                                                <span>{msg.tokens} tokens</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing/Analysis Indicator */}
                    {loading && (
                        <div className="flex gap-3 justify-start" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
                            <div className="w-8 h-8 rounded-xl shrink-0 mt-0.5 flex items-center justify-center shadow-md"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(249,115,22,0.1))',
                                    border: '1px solid rgba(245,166,35,0.3)',
                                }}>
                                <Sparkles className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="px-4 py-3 rounded-2xl flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-color)]"
                                style={{ borderBottomLeftRadius: '4px' }}>
                                <div className="flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[10px] text-[var(--text-secondary)] font-medium">AI đang đọc báo cáo phân tích và soạn câu trả lời...</span>
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>

                {/* Message Input Box */}
                <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <div className="rounded-xl overflow-hidden transition-all"
                        style={{
                            background: 'var(--bg-app)',
                            border: input
                                ? '1px solid rgba(245,166,35,0.45)'
                                : '1px solid var(--border-color)',
                            boxShadow: input ? '0 0 0 3px rgba(245,166,35,0.08)' : 'none',
                        }}>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Nhập câu hỏi thảo luận... (Enter để gửi)"
                            disabled={loading || !activeSession}
                            rows={1}
                            className="w-full bg-transparent resize-none text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none px-3 pt-2.5 pb-1"
                            style={{ maxHeight: '120px' }}
                        />
                        <div className="flex items-center justify-between px-2 pb-2">
                            <span className="text-[9px] text-[var(--text-secondary)] opacity-50 font-medium">
                                {input.length > 0 ? `${input.length} ký tự` : 'Shift + Enter để xuống dòng'}
                            </span>
                            <button 
                                onClick={() => handleSend()}
                                disabled={!input.trim() || loading || !activeSession}
                                className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-25"
                                style={{
                                    background: input.trim()
                                        ? 'linear-gradient(135deg,#f5a623,#f97316)'
                                        : 'rgba(245,166,35,0.15)',
                                    color: input.trim() ? '#fff' : 'var(--text-secondary)',
                                    boxShadow: input.trim() ? '0 4px 12px rgba(245,166,35,0.15)' : 'none',
                                }}>
                                {loading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Local animation keyframes */}
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
