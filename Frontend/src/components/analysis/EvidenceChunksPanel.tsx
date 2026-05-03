import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
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
            .getEvidenceChunks(projectId, { ordinals: ordinalsParam })
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
    }, [open, projectId, ordinalsParam, ordinals.length]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Đoạn truyện gốc">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 border-0 cursor-pointer"
                aria-label="Đóng"
                onClick={onClose}
            />
            <div
                className="relative h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)' }}>
                <div className="flex items-start justify-between gap-3 p-4 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                            Bằng chứng từ bản thảo
                        </p>
                        <h2 className="text-[var(--text-primary)] font-bold text-sm leading-snug">{criterionLabel}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 p-2 rounded-xl transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Đóng panel">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang tải đoạn gốc…
                        </div>
                    )}
                    {error && (
                        <p className="text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
                            {error}
                        </p>
                    )}
                    {!loading && !error && chunks.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Không có chunk tương ứng (có thể báo cáo cũ trước khi bật RAG).
                        </p>
                    )}
                    {chunks.map(ch => (
                        <article
                            key={ch.chunkId}
                            className="rounded-2xl p-4 space-y-2"
                            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                            <p className="text-xs font-bold" style={{ color: '#c4b5fd' }}>
                                {ch.chapterTitle}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                Chunk #{ch.chunkIndex} trong chương · ordinal {ch.ordinal} · offset ký tự trong chương:{' '}
                                {ch.offsetInChapterChars} · ~{ch.tokenCount} token
                            </p>
                            <pre
                                className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans mt-2 p-3 rounded-xl max-h-[min(55vh,480px)] overflow-y-auto"
                                style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                {renderHighlightedContent(ch.content, evidenceHighlight)}
                            </pre>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
