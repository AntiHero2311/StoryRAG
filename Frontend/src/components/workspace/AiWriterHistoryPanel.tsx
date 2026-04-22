import { useState, useEffect } from 'react';
import { Loader2, RotateCcw, Copy, Check, Clock, Edit3, PenLine, Wand2, RefreshCw } from 'lucide-react';
import { useToast } from '../Toast';
import axios from 'axios';

interface AiWriterHistoryPanelProps {
    projectId: string;
    chapterId?: string;
    onApplyContent?: (content: string) => void;
}

interface RewriteHistoryItem {
    id: string;
    chapterId?: string;
    originalText: string;
    rewrittenText: string;
    instruction: string;
    actionType: string;
    totalTokens: number;
    createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string, icon: any, color: string }> = {
    'ContinueWriting': { label: 'Viết tiếp', icon: PenLine, color: '#8b5cf6' },
    'WriteNew': { label: 'Viết mới', icon: Wand2, color: '#ec4899' },
    'Rewrite': { label: 'Viết lại', icon: Edit3, color: '#f59e0b' },
    'Polish': { label: 'Trau chuốt', icon: SparklesIcon, color: '#10b981' },
};

function SparklesIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
            <path d="M4 17v2" />
            <path d="M5 18H3" />
        </svg>
    );
}

export default function AiWriterHistoryPanel({ projectId, chapterId, onApplyContent }: AiWriterHistoryPanelProps) {
    const toast = useToast();
    const [histories, setHistories] = useState<RewriteHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5242/api/ai/${projectId}/rewrite/history`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: 1, pageSize: 30 }
            });
            setHistories(res.data.items || []);
        } catch (e: any) {
            toast.error('Không thể tải lịch sử AI.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchHistory();
        }
    }, [projectId]);

    const handleCopy = async (id: string, text: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                <p className="text-sm">Đang tải lịch sử...</p>
            </div>
        );
    }

    if (histories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Chưa có lịch sử</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Khi bạn sử dụng tính năng AI Viết tiếp hoặc Trau chuốt, các nội dung sinh ra sẽ được lưu tại đây.</p>
                <button onClick={fetchHistory} className="mt-2 text-xs flex items-center gap-1.5 text-[var(--accent)] hover:underline">
                    <RefreshCw className="w-3.5 h-3.5" /> Làm mới
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 shrink-0 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Lịch sử sinh nội dung</span>
                <button onClick={fetchHistory} title="Làm mới" className="p-1.5 rounded-md hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]">
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
                {histories.map(h => {
                    const actionInfo = ACTION_LABELS[h.actionType] || { label: h.actionType || 'Khác', icon: Wand2, color: 'var(--text-secondary)' };
                    const Icon = actionInfo.icon;

                    return (
                        <div key={h.id} className="rounded-xl overflow-hidden shadow-sm" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                                <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5" style={{ color: actionInfo.color }} />
                                    <span className="text-xs font-bold" style={{ color: actionInfo.color }}>{actionInfo.label}</span>
                                    <span className="text-[10px] text-[var(--text-secondary)] ml-1">{formatDate(h.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleCopy(h.id, h.rewrittenText)} title="Copy nội dung AI"
                                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                                        style={{ color: copiedId === h.id ? '#10b981' : 'var(--text-secondary)' }}>
                                        {copiedId === h.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                            
                            {h.instruction && (
                                <div className="px-3 py-1.5 text-[11px] italic border-b border-[var(--border-color)]/50" style={{ color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)' }}>
                                    <strong>Prompt:</strong> {h.instruction}
                                </div>
                            )}

                            <div className="p-3 text-xs leading-[1.8] whitespace-pre-wrap select-text max-h-[200px] overflow-y-auto scrollbar-thin" style={{ color: 'var(--text-primary)' }}>
                                {h.rewrittenText}
                            </div>

                            {onApplyContent && (
                                <button
                                    onClick={() => { onApplyContent(h.rewrittenText); toast.success('Đã thêm vào editor!'); }}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold transition-all hover:bg-[var(--hover-bg)]"
                                    style={{ color: 'var(--accent)', borderTop: '1px solid var(--border-color)' }}
                                >
                                    <Check className="w-3.5 h-3.5" /> Chèn lại vào bài viết
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
