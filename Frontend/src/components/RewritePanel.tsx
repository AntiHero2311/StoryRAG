import { useState } from 'react';
import { Wand2, X, Check, Loader2, RotateCcw, Copy, Sparkles, Feather, AlertTriangle } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useToast } from './Toast';

interface RewritePanelProps {
    projectId: string;
    chapterId?: string;
    selectedText: string;
    mode?: 'rewrite' | 'polish';
    onAccept: (rewrittenText: string) => void;
    onClose: () => void;
}

const REWRITE_PRESETS = [
    { label: 'Thi ca / bay bướm', value: 'Viết lại theo phong cách thơ văn thi ca, bay bướm và giàu hình ảnh' },
    { label: 'Súc tích hơn', value: 'Rút ngắn lại, chỉ giữ phần cốt lõi quan trọng, bỏ phần thừa' },
    { label: 'Kịch tính hơn', value: 'Tăng độ kịch tính, căng thẳng và cảm xúc của đoạn văn' },
    { label: 'Chi tiết hơn', value: 'Mở rộng thêm chi tiết, mô tả phong phú hơn về cảm xúc và không gian' },
    { label: 'Văn phong trẻ', value: 'Viết lại theo phong cách trẻ trung, hiện đại, gần gũi' },
    { label: 'Cổ điển / trang trọng', value: 'Viết theo phong cách cổ điển, trang nhã và chắt lọc' },
];

const POLISH_PRESETS = [
    { label: 'Sửa lỗi & làm mượt', value: 'Sửa lỗi chính tả, ngữ pháp, làm câu văn mượt mà tự nhiên hơn' },
    { label: 'Cải thiện nhịp điệu', value: 'Cải thiện nhịp điệu câu, tránh lặp từ và làm đoạn văn cuốn hơn' },
    { label: 'Tăng cảm xúc', value: 'Tăng cường cảm xúc và cộng hưởng nội tâm của câu văn' },
    { label: 'Rút gọn tinh tế', value: 'Rút gọn câu dài, bỏ phần thừa nhưng giữ nguyên ý nghĩa' },
];

export default function RewritePanel({
    projectId, chapterId, selectedText, mode = 'rewrite', onAccept, onClose
}: RewritePanelProps) {
    const toast = useToast();
    const [instruction, setInstruction] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [tokens, setTokens] = useState(0);
    const [copied, setCopied] = useState(false);

    const presets = mode === 'polish' ? POLISH_PRESETS : REWRITE_PRESETS;
    const accentColor = mode === 'polish' ? '#10b981' : '#8b5cf6';
    const accentGradient = mode === 'polish'
        ? 'linear-gradient(135deg,#10b981,#059669)'
        : 'linear-gradient(135deg,#8b5cf6,#7c3aed)';

    const wordCount = selectedText.split(/\s+/).filter(Boolean).length;

    const handleGenerate = async () => {
        if (!selectedText.trim()) return;
        setIsLoading(true);
        setResult(null);
        try {
            let generated = '';
            let tokenCount = 0;

            if (mode === 'polish') {
                const res = await aiService.polish(
                    projectId,
                    selectedText,
                    instruction || 'Sửa lỗi chính tả, ngữ pháp, trau chuốt lại cấu trúc câu cho mượt mà, chuyên nghiệp hơn mà không làm thay đổi ý nghĩa gốc.'
                );
                generated = res.generatedText;
                tokenCount = res.totalTokens;
            } else {
                const res = await aiService.rewrite(projectId, {
                    originalText: selectedText,
                    instruction: instruction || undefined,
                    chapterId,
                });
                generated = res.rewrittenText;
                tokenCount = res.totalTokens;
            }

            setResult(generated);
            setTokens(tokenCount);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Viết lại thất bại. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = () => {
        if (!result) return;
        onAccept(result);
        toast.success('✅ Đã áp dụng đoạn văn mới.');
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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />

            {/* Panel */}
            <div
                className="relative flex flex-col h-full w-[400px] shadow-2xl"
                style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)' }}
            >
                {/* Header */}
                <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `${accentColor}20` }}>
                                {mode === 'polish'
                                    ? <Feather className="w-4 h-4" style={{ color: accentColor }} />
                                    : <Wand2 className="w-4 h-4" style={{ color: accentColor }} />
                                }
                            </div>
                            <div>
                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {mode === 'polish' ? 'Trau Chuốt Văn Phong' : 'Viết Lại Với AI'}
                                </p>
                                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                    {wordCount} từ đã chọn · AI sẽ {mode === 'polish' ? 'cải thiện câu văn' : 'viết lại đoạn này'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                            style={{ color: 'var(--text-secondary)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5 scrollbar-thin">
                    {/* Original text preview */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Đoạn gốc ({wordCount} từ)
                        </label>
                        <div className="rounded-xl p-3 text-xs leading-relaxed italic"
                            style={{
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                maxHeight: '100px',
                                overflowY: 'auto',
                            }}>
                            "{selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText}"
                        </div>
                    </div>

                    {/* Quick presets */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Phong cách nhanh
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {presets.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => setInstruction(p.value)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97]"
                                    style={{
                                        background: instruction === p.value ? `${accentColor}20` : 'var(--bg-app)',
                                        color: instruction === p.value ? accentColor : 'var(--text-secondary)',
                                        border: `1px solid ${instruction === p.value ? accentColor + '55' : 'var(--border-color)'}`,
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom instruction */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Tuỳ chỉnh <span className="normal-case font-normal opacity-60">(hoặc nhập tùy ý)</span>
                        </label>
                        <textarea
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            placeholder={mode === 'polish'
                                ? 'Hoặc nhập yêu cầu chỉnh sửa cụ thể...'
                                : 'Hoặc mô tả phong cách cụ thể muốn AI viết lại...'}
                            rows={3}
                            className="w-full rounded-xl px-3 py-2 text-xs resize-none leading-relaxed outline-none transition-all focus:ring-2"
                            style={{
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                            }}
                            onFocus={e => (e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}25`)}
                            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                        />
                    </div>

                    {/* Loading skeleton */}
                    {isLoading && (
                        <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: accentColor }} />
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    AI đang {mode === 'polish' ? 'trau chuốt' : 'viết lại'}...
                                </span>
                            </div>
                            {[75, 90, 65, 80, 55].map((w, i) => (
                                <div key={i} className="h-1.5 rounded-full animate-pulse"
                                    style={{ width: `${w}%`, background: 'var(--border-color)', animationDelay: `${i * 0.12}s` }} />
                            ))}
                        </div>
                    )}

                    {/* Result */}
                    {result && !isLoading && (
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${accentColor}40` }}>
                            <div className="flex items-center justify-between px-3 py-2"
                                style={{ background: `${accentColor}10`, borderBottom: `1px solid ${accentColor}25` }}>
                                <div className="flex items-center gap-1.5">
                                    <Check className="w-3 h-3" style={{ color: accentColor }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                                        Kết quả AI
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {tokens > 0 && <span className="text-[9px] mr-1" style={{ color: 'var(--text-secondary)' }}>{tokens.toLocaleString()} token</span>}
                                    <button onClick={handleCopy}
                                        className="w-5 h-5 flex items-center justify-center rounded transition-colors"
                                        style={{ color: copied ? '#10b981' : 'var(--text-secondary)' }}
                                        title="Copy">
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                            </div>
                            <div className="p-3 text-xs leading-[1.9] whitespace-pre-wrap select-text max-h-[200px] overflow-y-auto scrollbar-thin"
                                style={{ color: 'var(--text-primary)', background: 'var(--bg-surface)' }}>
                                {result}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex flex-col gap-2 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
                    {/* Disclaimer */}
                    <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-px" />
                        <p className="text-[9px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            AI chỉ gợi ý — không tự ý thay thế nội dung. Kiểm tra kỹ trước khi áp dụng.
                        </p>
                    </div>
                    {result && !isLoading ? (
                        <div className="flex gap-2">
                            <button onClick={handleAccept}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-md"
                                style={{ background: accentGradient }}>
                                <Check className="w-3.5 h-3.5" /> Áp dụng thay thế
                            </button>
                            <button onClick={handleGenerate} disabled={isLoading}
                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:bg-[var(--hover-bg)]"
                                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                                title="Tạo lại">
                                <RotateCcw className="w-3.5 h-3.5" /> Thử lại
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleGenerate}
                            disabled={isLoading || !selectedText.trim()}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 hover:opacity-90 hover:scale-[1.01] active:scale-[0.98] shadow-md"
                            style={{ background: isLoading ? 'var(--bg-app)' : accentGradient, color: isLoading ? 'var(--text-secondary)' : '#fff', border: isLoading ? '1px solid var(--border-color)' : 'none' }}>
                            {isLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xử lý...</>
                                : <>{mode === 'polish' ? <Feather className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />} {mode === 'polish' ? 'Trau Chuốt Ngay' : 'Viết Lại Với AI'}</>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
