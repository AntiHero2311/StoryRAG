import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, X, FileText } from 'lucide-react';
import { reportService, type EvidenceChunkItemDto } from '../../services/reportService';

function renderHighlightedContent(text: string, highlight: string): ReactNode {
    const needle = highlight.replace(/\s+/g, ' ').trim().slice(0, 100);
    if (needle.length < 6) return text;

    let idx = text.indexOf(needle);
    let matchLen = needle.length;
    if (idx < 0) {
        const low = needle.toLowerCase();
        idx = text.toLowerCase().indexOf(low);
    }
    if (idx < 0) {
        for (let n = Math.min(needle.length, 72); n >= 12; n -= 6) {
            const sub = needle.slice(0, n);
            idx = text.indexOf(sub);
            if (idx >= 0) {
                matchLen = sub.length;
                break;
            }
            idx = text.toLowerCase().indexOf(sub.toLowerCase());
            if (idx >= 0) {
                matchLen = sub.length;
                break;
            }
        }
    }
    if (idx < 0) return text;

    const before = text.slice(0, idx);
    const mid = text.slice(idx, idx + matchLen);
    const after = text.slice(idx + matchLen);

    return (
        <>
            {before}
            <mark className="rounded px-0.5" style={{ background: 'rgba(245,166,35,0.35)', color: 'inherit' }}>
                {mid}
            </mark>
            {after}
        </>
    );
}

export interface EvidenceChunksPanelProps {
    open: boolean;
    onClose: () => void;
    projectId: string;
    ordinals: number[];
    evidenceHighlight: string;
    criterionLabel: string;
}

export default function EvidenceChunksPanel({
    open,
    onClose,
    projectId,
    ordinals,
    evidenceHighlight,
    criterionLabel,
}: EvidenceChunksPanelProps) {
    const [chunks, setChunks] = useState<EvidenceChunkItemDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const seen = new Set<number>();
    const uniqueOrdinals: number[] = [];
    for (const o of ordinals) {
        if (!seen.has(o)) {
            seen.add(o);
            uniqueOrdinals.push(o);
        }
    }
    const ordinalsParam = uniqueOrdinals.join(',');

    useEffect(() => {
        if (!open || !projectId || ordinals.length === 0) {
            setChunks([]);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        reportService
            .getEvidenceChunks(projectId, { ordinals: ordinalsParam, highlight: evidenceHighlight })
            .then(data => {
                if (!cancelled) {
                    setChunks(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err?.response?.data?.message || err?.message || 'Không tải được chunk.');
                    setChunks([]);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, projectId, ordinalsParam, ordinals.length, evidenceHighlight]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1200] flex justify-end transition-all duration-300" role="dialog" aria-modal="true" aria-label="Đoạn truyện gốc">
            {/* Backdrop with blur */}
            <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0 cursor-pointer transition-opacity duration-300"
                aria-label="Đóng"
                onClick={onClose}
            />
            
            {/* Glassmorphic Side Panel */}
            <div
                className="relative h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out"
                style={{ 
                    background: 'rgba(19, 19, 37, 0.94)', 
                    backdropFilter: 'blur(24px)',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '-10px 0 40px rgba(0,0,0,0.6)'
                }}>
                
                {/* Header Section */}
                <div className="flex items-start justify-between gap-3 p-5 shrink-0" 
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
                                BẰNG CHỨNG GỐC TỪ BẢN THẢO
                            </p>
                        </div>
                        <h2 className="text-[var(--text-bright)] font-extrabold text-sm leading-snug tracking-wide">
                            {criterionLabel}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 p-2 rounded-xl transition-all duration-200 hover:bg-white/5 active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-bright)]"
                        aria-label="Đóng panel">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-violet-300">
                            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                            <span className="font-semibold tracking-wide animate-pulse">Đang truy xuất phân đoạn gốc...</span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="rounded-2xl p-4 border border-rose-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
                            <p className="text-xs font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                                <span>⚠️</span> Lỗi truy hồi dữ liệu
                            </p>
                            <p className="text-xs text-rose-200/80 leading-relaxed">{error}</p>
                        </div>
                    )}
                    
                    {!loading && !error && chunks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                <FileText className="w-6 h-6 text-[var(--text-secondary)] opacity-40" />
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] max-w-[280px] leading-relaxed">
                                Không tìm thấy đoạn văn tương ứng (Báo cáo này được tạo từ phiên bản phân tích cũ trước khi cập nhật RAG).
                            </p>
                        </div>
                    )}
                    
                    {chunks.map((ch, idx) => (
                        <article
                            key={ch.chunkId}
                            className="rounded-2xl p-4 space-y-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                            style={{ 
                                background: 'linear-gradient(185deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)', 
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                boxShadow: '0 4px 20px -5px rgba(0,0,0,0.3)'
                            }}>
                            
                            {/* Card Meta Header */}
                            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300 shrink-0">
                                        Đoạn #{idx + 1}
                                    </span>
                                    <p className="text-xs font-bold text-violet-100 truncate">
                                        {ch.chapterTitle || `Chương ${ch.chunkIndex}`}
                                    </p>
                                </div>
                                <div className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                                    Ordinal {ch.ordinal}
                                </div>
                            </div>
                            
                            {/* Original Text Block */}
                            <div className="relative">
                                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                                    <span className="text-[9px] font-semibold bg-white/5 px-2 py-0.5 rounded text-[var(--text-secondary)] border border-white/5">
                                        ~{ch.tokenCount} tokens
                                    </span>
                                </div>
                                <pre
                                    className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans p-4 rounded-xl max-h-[min(50vh,420px)] overflow-y-auto antialiased border"
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        color: 'rgba(228, 228, 231, 0.9)',
                                        borderColor: 'rgba(255, 255, 255, 0.04)',
                                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
                                    }}>
                                    {renderHighlightedContent(ch.content, evidenceHighlight)}
                                </pre>
                            </div>
                            
                            {/* Offset indicators */}
                            <div className="flex items-center justify-between text-[9px] text-[var(--text-secondary)] px-0.5">
                                <span>RAG Segment Match</span>
                                <span>Vị trí trong chương: ký tự {ch.offsetInChapterChars.toLocaleString()}</span>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
