import { ChevronDown, FileText } from 'lucide-react';
import { groupColor } from './helpers';
import ScoreBar from './ScoreBar';
import type { ProjectReportResponse } from '../../services/reportService';

interface GroupCardProps {
    group: ProjectReportResponse['groups'][0];
    idx: number;
    expanded: boolean;
    onToggle: () => void;
    projectId: string;
    onViewEvidence?: (ordinals: number[], evidenceQuote: string, criterionLabel: string) => void;
    isStaff?: boolean;
    onEditCriterion?: (key: string) => void;
}

export default function GroupCard({ group, idx, expanded, onToggle, projectId, onViewEvidence, isStaff, onEditCriterion }: GroupCardProps) {
    const color = groupColor(idx);
    const pct = Math.round((group.score / group.maxScore) * 100);
    return (
                <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl group"
            style={{ 
                background: 'var(--bg-surface)', 
                border: expanded ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border-color)',
                boxShadow: expanded ? '0 10px 30px -10px rgba(99, 102, 241, 0.15)' : 'var(--shadow-sm)'
            }}>
            <button 
                onClick={onToggle} 
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-[var(--bg-hover)] transition-all duration-200 focus:outline-none"
            >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm transition-transform duration-300 group-hover:scale-105"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                    {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-primary)] font-bold text-sm mb-2 tracking-wide group-hover:text-[var(--text-bright)] transition-colors">{group.name}</p>
                    <ScoreBar score={group.score} max={group.maxScore} color={color} delay={idx * 80} />
                </div>
                <div className="text-right shrink-0 ml-3">
                    <span className="text-lg font-black tracking-tight" style={{ color }}>{group.score.toFixed(1)}</span>
                    <span className="text-[var(--text-secondary)] text-xs">/{group.maxScore}</span>
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/20 inline-block mt-0.5" style={{ color: `${color}cc` }}>{pct}%</div>
                </div>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-300"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {expanded && (
                <div className="px-5 pb-5 flex flex-col gap-5 pt-3 animate-in fade-in slide-in-from-top-2 duration-200" 
                    style={{ 
                        borderTop: '1px solid var(--border-color)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.00) 100%)'
                    }}>
                    {group.criteria.map((c, ci) => {
                        const cpct = Math.round((c.score / c.maxScore) * 100);
                        const hasErrors = c.errors && c.errors.length > 0;
                        const hasSuggestions = c.suggestions && c.suggestions.length > 0;
                        const hasEvidenceChunks = onViewEvidence && c.evidenceChunkOrdinals && c.evidenceChunkOrdinals.length > 0 && projectId;

                        return (
                            <div key={c.key} 
                                className="pt-5 pb-2 first:pt-2 flex flex-col gap-3.5 transition-all duration-300 hover:bg-[rgba(255,255,255,0.005)] rounded-xl"
                                style={{ borderTop: ci > 0 ? '1px solid var(--border-color)' : undefined }}>
                                
                                {/* Header: key + name + score */}
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 flex items-center justify-center min-w-[32px] h-6 shadow-sm"
                                            style={{ 
                                                background: `${color}18`, 
                                                color, 
                                                border: `1px solid ${color}35`
                                            }}>
                                            {c.key}
                                        </span>
                                        <h3 className="text-[var(--text-bright)] text-sm font-bold tracking-normal leading-snug">{c.criterionName}</h3>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                                        {isStaff && onEditCriterion && (
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onEditCriterion(c.key);
                                                }}
                                                className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all hover:bg-amber-500/20 active:scale-95 shrink-0 border"
                                                style={{
                                                    background: 'rgba(245,158,11,0.08)',
                                                    color: '#fbbf24',
                                                    borderColor: 'rgba(245,158,11,0.25)',
                                                }}>
                                                ✏️ Sửa Rubric
                                            </button>
                                        )}
                                        {hasEvidenceChunks && (
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onViewEvidence(
                                                        c.evidenceChunkOrdinals!,
                                                        c.evidence ?? '',
                                                        `${c.key} — ${c.criterionName}`
                                                    );
                                                }}
                                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all bg-[rgba(139,92,246,0.18)] border border-[rgba(139,92,246,0.35)] text-violet-200 hover:bg-[rgba(139,92,246,0.28)] hover:-translate-y-0.5 active:scale-95"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                <span>Đoạn gốc</span>
                                            </button>
                                        )}
                                        <div className="flex items-center gap-2 shrink-0 bg-black/25 px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
                                            <span className="text-[10px] font-bold tracking-wider" style={{ color: `${color}d0` }}>{cpct}%</span>
                                            <span className="text-xs font-black tracking-tight" style={{ color }}>
                                                {c.score.toFixed(1)}<span className="text-[var(--text-secondary)] font-normal text-[10px]">/{c.maxScore}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Score bar */}
                                <div className="px-0.5">
                                    <ScoreBar score={c.score} max={c.maxScore} color={color} delay={ci * 50} />
                                </div>

                                {/* Feedback */}
                                {c.feedback && (
                                    <p className="text-[var(--text-muted)] text-[13px] leading-relaxed pl-0.5" style={{ color: 'rgba(228, 228, 231, 0.85)' }}>
                                        {c.feedback}
                                    </p>
                                )}

                                {/* Evidence — trích dẫn nguyên văn & nút liên kết dữ liệu gốc */}
                                {c.evidence && (
                                    <div className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:brightness-105"
                                        style={{ 
                                            background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99, 102, 241, 0.03) 100%)', 
                                            border: '1px solid rgba(139,92,246,0.18)',
                                            borderLeft: '4px solid var(--violet-500)',
                                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.02)'
                                        }}>
                                        <div>
                                            <p className="text-xs font-bold mb-1.5 flex items-center gap-1.5 text-violet-300">
                                                <span className="text-sm">📝</span> Dẫn chứng thực tế từ tác phẩm
                                            </p>
                                            <p className="text-xs leading-relaxed italic text-violet-200 font-sans antialiased pl-0.5">
                                                "{c.evidence}"
                                            </p>
                                        </div>

                                        {hasEvidenceChunks && (
                                            <div className="pt-2 border-t border-[rgba(139,92,246,0.12)] flex items-center">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onViewEvidence(
                                                            c.evidenceChunkOrdinals!,
                                                            c.evidence ?? '',
                                                            `${c.key} — ${c.criterionName}`
                                                        );
                                                    }}
                                                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.22)] text-violet-300 hover:bg-[rgba(139,92,246,0.22)] hover:border-[rgba(139,92,246,0.35)] hover:-translate-y-0.5 active:scale-95"
                                                >
                                                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                                                    <span>🔍 Tra cứu đoạn văn bản gốc trong Bản thảo (RAG Context)</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}



                                {/* Errors */}
                                {hasErrors && (
                                    <div className="rounded-2xl p-4 flex flex-col gap-2 transition-all duration-200 hover:brightness-105"
                                        style={{ 
                                            background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220, 38, 38, 0.03) 100%)', 
                                            border: '1px solid rgba(239,68,68,0.18)',
                                            borderLeft: '4px solid var(--error-500)'
                                        }}>
                                        <p className="text-xs font-bold flex items-center gap-1.5 text-rose-300">
                                            <span className="text-sm">⚠️</span> Sạn cốt truyện / Vấn đề phát hiện
                                        </p>
                                        <div className="space-y-1.5 pl-0.5">
                                            {c.errors.map((err, ei) => (
                                                <div key={ei} className="flex items-start gap-2">
                                                    <span className="text-xs mt-1 shrink-0 text-rose-400">•</span>
                                                    <p className="text-xs leading-relaxed text-rose-200">{err}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {hasSuggestions && (
                                    <div className="rounded-2xl p-4 flex flex-col gap-2 transition-all duration-200 hover:brightness-105"
                                        style={{ 
                                            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5, 150, 105, 0.03) 100%)', 
                                            border: '1px solid rgba(16,185,129,0.18)',
                                            borderLeft: '4px solid var(--success-500)'
                                        }}>
                                        <p className="text-xs font-bold flex items-center gap-1.5 text-emerald-300">
                                            <span className="text-sm">✓</span> Khuyến nghị & Giải pháp cải thiện
                                        </p>
                                        <div className="space-y-1.5 pl-0.5">
                                            {c.suggestions.map((sug, si) => (
                                                <div key={si} className="flex items-start gap-2">
                                                    <span className="text-xs mt-1 shrink-0 text-emerald-400">•</span>
                                                    <p className="text-xs leading-relaxed text-emerald-200">{sug}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
