import { ChevronDown } from 'lucide-react';
import { groupColor } from './helpers';
import ScoreBar from './ScoreBar';
import type { ProjectReportResponse } from '../../services/reportService';

interface GroupCardProps {
    group: ProjectReportResponse['groups'][0];
    idx: number;
    expanded: boolean;
    onToggle: () => void;
}

export default function GroupCard({ group, idx, expanded, onToggle }: GroupCardProps) {
    const color = groupColor(idx);
    const pct = Math.round((group.score / group.maxScore) * 100);
    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <button onClick={onToggle} className="w-full p-5 flex items-center gap-4 text-left hover:bg-[var(--bg-hover)] transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{ background: `${color}18`, color }}>
                    {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-primary)] font-semibold text-sm mb-2">{group.name}</p>
                    <ScoreBar score={group.score} max={group.maxScore} color={color} delay={idx * 80} />
                </div>
                <div className="text-right shrink-0 ml-3">
                    <span className="text-lg font-black" style={{ color }}>{group.score.toFixed(1)}</span>
                    <span className="text-[var(--text-secondary)] text-xs">/{group.maxScore}</span>
                    <div className="text-xs font-semibold" style={{ color: `${color}99` }}>{pct}%</div>
                </div>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {expanded && (
                <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                    {group.criteria.map((c, ci) => {
                        const cpct = Math.round((c.score / c.maxScore) * 100);
                        const hasErrors = c.errors && c.errors.length > 0;
                        const hasSuggestions = c.suggestions && c.suggestions.length > 0;
                        return (
                            <div key={c.key} className="pt-4" style={{ borderTop: ci > 0 ? '1px solid var(--border-color)' : undefined }}>
                                {/* Header: key + name + score */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{ background: `${color}18`, color }}>
                                            {c.key}
                                        </span>
                                        <span className="text-[var(--text-primary)] text-sm font-semibold">{c.criterionName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        <span className="text-xs font-semibold" style={{ color: `${color}99` }}>{cpct}%</span>
                                        <span className="text-sm font-bold" style={{ color }}>
                                            {c.score.toFixed(1)}<span className="text-[var(--text-secondary)] font-normal text-xs">/{c.maxScore}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Score bar */}
                                <ScoreBar score={c.score} max={c.maxScore} color={color} delay={ci * 50} />

                                {/* Feedback */}
                                {c.feedback && (
                                    <p className="text-[var(--text-secondary)] text-xs leading-relaxed mt-2.5 pl-0.5">
                                        {c.feedback}
                                    </p>
                                )}

                                {/* Errors */}
                                {hasErrors && (
                                    <div className="mt-3 rounded-xl p-3 flex flex-col gap-1.5"
                                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <p className="text-xs font-bold mb-0.5 flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                                            <span>⚠</span> Vấn đề phát hiện
                                        </p>
                                        {c.errors.map((err, ei) => (
                                            <div key={ei} className="flex items-start gap-2">
                                                <span className="text-xs mt-0.5 shrink-0" style={{ color: '#f87171' }}>•</span>
                                                <p className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>{err}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Suggestions */}
                                {hasSuggestions && (
                                    <div className="mt-2 rounded-xl p-3 flex flex-col gap-1.5"
                                        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <p className="text-xs font-bold mb-0.5 flex items-center gap-1.5" style={{ color: '#10b981' }}>
                                            <span>✓</span> Gợi ý cải thiện
                                        </p>
                                        {c.suggestions.map((sug, si) => (
                                            <div key={si} className="flex items-start gap-2">
                                                <span className="text-xs mt-0.5 shrink-0" style={{ color: '#34d399' }}>•</span>
                                                <p className="text-xs leading-relaxed" style={{ color: '#6ee7b7' }}>{sug}</p>
                                            </div>
                                        ))}
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
