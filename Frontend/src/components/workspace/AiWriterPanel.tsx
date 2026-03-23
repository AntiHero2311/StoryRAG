import { useState } from 'react';
import {
    Bot, Loader2, Sparkles, Check, Wand2, BookOpen,
    Users, Globe, Scroll, Zap, RotateCcw, Copy,
    PenLine, Lightbulb, AlertTriangle
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useToast } from '../Toast';

interface AiWriterPanelProps {
    projectId: string;
    onApplyContent?: (content: string) => void;
}

const SUGGEST_TYPES = [
    { value: 'Tên truyện', label: 'Tên truyện', icon: BookOpen, color: '#818cf8', desc: 'Gợi ý tựa đề hấp dẫn' },
    { value: 'Nhân vật', label: 'Nhân vật', icon: Users, color: '#f472b6', desc: 'Xây dựng nhân vật sâu sắc' },
    { value: 'Bối cảnh', label: 'Bối cảnh', icon: Globe, color: '#34d399', desc: 'Thế giới & không gian truyện' },
    { value: 'Tình tiết', label: 'Tình tiết', icon: Scroll, color: '#fb923c', desc: 'Khai triển thêm cốt truyện' },
    { value: 'Nút thắt', label: 'Nút thắt', icon: Zap, color: '#f43f5e', desc: 'Tạo drama & twist bất ngờ' },
];

const WRITE_TEMPLATES = [
    { label: 'Mở đầu chương mới', prompt: 'Viết cảnh mở đầu cho một chương mới: ' },
    { label: 'Cảnh đối thoại', prompt: 'Viết đoạn hội thoại căng thẳng giữa 2 nhân vật: ' },
    { label: 'Mô tả cảnh quan', prompt: 'Mô tả cảnh thiên nhiên hoặc không gian cụ thể: ' },
    { label: 'Cảnh hành động', prompt: 'Viết cảnh đấu tranh hoặc cao trào hành động: ' },
];

export default function AiWriterPanel({ projectId, onApplyContent }: AiWriterPanelProps) {
    const toast = useToast();
    const [mode, setMode] = useState<'write' | 'suggest'>('write');
    const [instruction, setInstruction] = useState('');
    const [targetType, setTargetType] = useState('Nhân vật');
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const selectedSuggestType = SUGGEST_TYPES.find(t => t.value === targetType)!;

    const handleGenerate = async () => {
        if (!instruction.trim() && mode === 'write') return;
        setIsLoading(true);
        setResult('');
        try {
            if (mode === 'write') {
                const res = await aiService.writeNew(projectId, instruction);
                setResult(res.generatedText);
            } else {
                const res = await aiService.suggest(projectId, instruction, targetType);
                let formatted = `📝 Phân tích:\n${res.analysis}\n\n💡 Gợi ý:\n`;
                res.suggestions.forEach((s, idx) => formatted += `${idx + 1}. ${s}\n`);
                setResult(formatted);
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Đã có lỗi xảy ra. Hãy thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Mode Switcher */}
            <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => { setMode('write'); setResult(''); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                            background: mode === 'write' ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'transparent',
                            color: mode === 'write' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: mode === 'write' ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
                        }}
                    >
                        <PenLine className="w-3.5 h-3.5" />
                        Viết Mới
                    </button>
                    <button
                        onClick={() => { setMode('suggest'); setResult(''); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                            background: mode === 'suggest' ? 'linear-gradient(135deg,#ec4899,#db2777)' : 'transparent',
                            color: mode === 'suggest' ? '#fff' : 'var(--text-secondary)',
                            boxShadow: mode === 'suggest' ? '0 2px 8px rgba(236,72,153,0.3)' : 'none',
                        }}
                    >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Gợi ý AI
                    </button>
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3 scrollbar-thin">

                {/* --- WRITE MODE --- */}
                {mode === 'write' && (
                    <>
                        {/* Quick templates */}
                        <div>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Mẫu nhanh</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {WRITE_TEMPLATES.map(t => (
                                    <button
                                        key={t.label}
                                        onClick={() => setInstruction(t.prompt)}
                                        className="text-left px-2.5 py-2 rounded-xl text-[10px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Instruction */}
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Yêu cầu <span className="text-rose-400">*</span></label>
                            <div className="relative">
                                <textarea
                                    value={instruction}
                                    onChange={e => setInstruction(e.target.value)}
                                    placeholder="Mô tả chi tiết đoạn văn muốn AI viết&#10;VD: Cảnh gặp gỡ đầu tiên giữa hai nhân vật ở thư viện dưới mưa, có chút bẽn lẽn và hồi hộp..."
                                    className="w-full p-3 h-[130px] rounded-xl text-xs outline-none resize-none leading-relaxed transition-all focus:ring-2 focus:ring-[var(--accent)]/30"
                                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                />
                                <span className="absolute bottom-2 right-2.5 text-[9px]" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                                    {instruction.length} ký tự
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* --- SUGGEST MODE --- */}
                {mode === 'suggest' && (
                    <>
                        {/* Type picker */}
                        <div>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Loại gợi ý</p>
                            <div className="grid grid-cols-1 gap-1.5">
                                {SUGGEST_TYPES.map(t => {
                                    const Icon = t.icon;
                                    const active = targetType === t.value;
                                    return (
                                        <button
                                            key={t.value}
                                            onClick={() => setTargetType(t.value)}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                                            style={{
                                                background: active ? `${t.color}18` : 'var(--bg-app)',
                                                border: `1px solid ${active ? t.color + '55' : 'var(--border-color)'}`,
                                            }}
                                        >
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ background: `${t.color}20` }}>
                                                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold" style={{ color: active ? t.color : 'var(--text-primary)' }}>{t.label}</p>
                                                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t.desc}</p>
                                            </div>
                                            {active && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Context */}
                        <div>
                            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                                Bối cảnh <span className="normal-case font-normal opacity-60">(không bắt buộc)</span>
                            </label>
                            <textarea
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                placeholder={`Mô tả ngắn về bối cảnh truyện để AI gợi ý ${selectedSuggestType.label.toLowerCase()} phù hợp hơn...`}
                                className="w-full p-3 h-[100px] rounded-xl text-xs outline-none resize-none leading-relaxed transition-all focus:ring-2"
                                style={{
                                    background: 'var(--bg-app)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || (mode === 'write' && !instruction.trim())}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shadow-lg shrink-0"
                    style={{
                        background: isLoading ? 'var(--bg-app)' : mode === 'write'
                            ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)'
                            : 'linear-gradient(135deg,#ec4899,#db2777)',
                        boxShadow: isLoading ? 'none' : mode === 'write'
                            ? '0 4px 14px rgba(139,92,246,0.35)'
                            : '0 4px 14px rgba(236,72,153,0.35)',
                        color: isLoading ? 'var(--text-secondary)' : '#fff',
                        border: isLoading ? '1px solid var(--border-color)' : 'none',
                    }}
                >
                    {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> AI đang xử lý...</>
                        : mode === 'write'
                            ? <><Wand2 className="w-4 h-4" /> Bắt đầu viết</>
                            : <><Sparkles className="w-4 h-4" /> Lấy gợi ý từ AI</>
                    }
                </button>

                {/* Loading animation */}
                {isLoading && (
                    <div className="rounded-2xl p-4 flex flex-col gap-2.5 shrink-0" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>AI đang sáng tác...</span>
                        </div>
                        {[60, 80, 50, 70].map((w, i) => (
                            <div key={i} className="h-2 rounded-full animate-pulse" style={{ width: `${w}%`, background: 'var(--border-color)', animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                )}

                {/* Result */}
                {result && !isLoading && (
                    <div className="rounded-2xl overflow-hidden shrink-0" style={{ border: '1px solid var(--border-color)' }}>
                        {/* Result header */}
                        <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                </div>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Kết quả từ AI</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={handleCopy} title="Copy toàn bộ"
                                    className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
                                    style={{ color: copied ? '#10b981' : 'var(--text-secondary)' }}>
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <button onClick={handleGenerate} title="Tạo lại"
                                    className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
                                    style={{ color: 'var(--text-secondary)' }}>
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        {/* Result body */}
                        <div className="p-3 text-xs leading-[1.9] whitespace-pre-wrap select-text max-h-[250px] overflow-y-auto scrollbar-thin"
                            style={{ color: 'var(--text-primary)', background: 'var(--bg-surface)' }}>
                            {result}
                        </div>
                        {/* Apply button */}
                        {mode === 'write' && onApplyContent && (
                            <button
                                onClick={() => { onApplyContent(result); toast.success('✅ Đã thêm vào trình soạn thảo!'); }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold transition-all hover:opacity-80"
                                style={{ background: 'rgba(139,92,246,0.08)', color: 'var(--accent)', borderTop: '1px solid rgba(139,92,246,0.15)' }}
                            >
                                <Check className="w-3.5 h-3.5" />
                                Thêm vào trình soạn thảo
                            </button>
                        )}
                    </div>
                )}

                {/* Tips section */}
                {!result && !isLoading && (
                    <div className="rounded-xl p-3 shrink-0" style={{ background: 'rgba(139,92,246,0.04)', border: '1px dashed rgba(139,92,246,0.2)' }}>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[var(--accent)]" /> Mẹo sử dụng
                        </p>
                        {mode === 'write' ? (
                            <ul className="text-[10px] leading-relaxed space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                <li>• Mô tả càng chi tiết, kết quả càng tốt</li>
                                <li>• Dùng mẫu nhanh để bắt đầu nhanh hơn</li>
                                <li>• Kết quả sẽ được thêm vào cuối chương</li>
                            </ul>
                        ) : (
                            <ul className="text-[10px] leading-relaxed space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                <li>• Chọn loại gợi ý phù hợp với nhu cầu</li>
                                <li>• Nhập bối cảnh để AI gợi ý sát hơn</li>
                                <li>• Thử nhiều lần để có nhiều ý tưởng</li>
                            </ul>
                        )}
                    </div>
                )}

                {/* AI Disclaimer */}
                <div className="rounded-xl p-3 shrink-0 flex gap-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        <strong className="text-amber-400">Lưu ý:</strong> AI chỉ hỗ trợ sáng tác — không thay thế quyết định của bạn. Nội dung sinh ra có thể chứa lỗi, cần kiểm tra kỹ trước khi sử dụng.
                    </p>
                </div>
            </div>
        </div>
    );
}
