import { useState } from 'react';
import { Wand2, X, Check, Loader2, RotateCcw, Copy } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useToast } from './Toast';

interface RewritePanelProps {
    projectId: string;
    chapterId?: string;
    selectedText: string;
    onAccept: (rewrittenText: string) => void;
    onClose: () => void;
}

export default function RewritePanel({ projectId, chapterId, selectedText, onAccept, onClose }: RewritePanelProps) {
    const toast = useToast();
    const [instruction, setInstruction] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [tokens, setTokens] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!selectedText.trim()) return;
        setIsLoading(true);
        setResult(null);
        try {
            const res = await aiService.rewrite(projectId, {
                originalText: selectedText,
                instruction: instruction || undefined,
                chapterId,
            });
            setResult(res.rewrittenText);
            setTokens(res.totalTokens);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Viết lại thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = () => {
        if (!result) return;
        onAccept(result);
        toast.success('✅ Đã áp dụng đoạn văn viết lại.');
        onClose();
    };

    const handleCopy = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-end"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

            {/* Panel */}
            <div
                className="relative flex flex-col h-full w-[380px] shadow-2xl animate-toast-in"
                style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-subtle)' }}>
                        <Wand2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Viết lại với AI</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {selectedText.split(/\s+/).filter(Boolean).length} từ đã chọn
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 scrollbar-thin">
                    {/* Original text */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Đoạn gốc
                        </label>
                        <div
                            className="rounded-xl p-3 text-xs leading-relaxed"
                            style={{
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                maxHeight: '140px',
                                overflowY: 'auto',
                            }}
                        >
                            {selectedText}
                        </div>
                    </div>

                    {/* Instruction */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Hướng dẫn <span className="normal-case font-normal opacity-60">(tùy chọn)</span>
                        </label>
                        <textarea
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            placeholder="VD: Viết theo phong cách thi ca, mô tả chi tiết hơn, rút ngắn..."
                            rows={3}
                            className="w-full rounded-xl px-3 py-2 text-xs resize-none leading-relaxed outline-none transition-all"
                            style={{
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                            }}
                            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-subtle)')}
                            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                        />
                    </div>

                    {/* Result */}
                    {(result || isLoading) && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                    Kết quả AI
                                </label>
                                {result && !isLoading && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{tokens.toLocaleString()} tk</span>
                                        <button
                                            onClick={handleCopy}
                                            className="w-5 h-5 flex items-center justify-center rounded transition-colors"
                                            style={{ color: copied ? 'var(--success)' : 'var(--text-secondary)' }}
                                            title="Copy"
                                        >
                                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div
                                className="rounded-xl p-3 text-xs leading-relaxed"
                                style={{
                                    background: 'var(--accent-subtle)',
                                    border: '1px solid rgba(139,92,246,0.3)',
                                    color: 'var(--text-primary)',
                                    minHeight: '80px',
                                }}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                        <span>AI đang viết lại...</span>
                                    </div>
                                ) : result}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-4 py-3 flex flex-col gap-2 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
                    {result ? (
                        <>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAccept}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Áp dụng
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                                    style={{
                                        background: 'var(--bg-app)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-secondary)',
                                    }}
                                    title="Tạo lại"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Thử lại
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !selectedText.trim()}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                        >
                            {isLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang viết lại...</>
                                : <><Wand2 className="w-3.5 h-3.5" /> Viết lại với AI</>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
