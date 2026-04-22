import type { NarrativeChartsResponse } from '../../services/reportService';

interface Props {
    data: NarrativeChartsResponse | null;
    loading: boolean;
}


function LineChart({ values, color, labels }: { values: number[]; color: string; labels?: (string | null | undefined)[] }) {
    if (values.length === 0) {
        return <div className="h-24 rounded-xl" style={{ background: 'var(--bg-hover)' }} />;
    }

    const width = 420;
    const height = 96;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const pointCoords = values.map((value, index) => ({
        x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
        y: height - ((value - min) / range) * height,
    }));

    const polylinePoints = pointCoords.map(p => `${p.x},${p.y}`).join(' ');

    const annotatedPoints = labels
        ? pointCoords
            .map((p, i) => ({ ...p, label: labels[i] }))
            .filter(p => p.label)
        : [];

    return (
        <div className="w-full overflow-hidden rounded-xl p-2" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
            <svg viewBox={`-10 -18 ${width + 20} ${height + 22}`} className="w-full h-28">
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                />
                {annotatedPoints.map((p, i) => (
                    <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--bg-app)" strokeWidth="1.5" />
                        <text
                            x={p.x}
                            y={p.y - 10}
                            textAnchor="middle"
                            fill={color}
                            fontSize="8"
                            fontWeight="bold"
                        >
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

export default function NarrativeChartsPanel({ data, loading }: Props) {
    if (loading) {
        return (
            <div className="rounded-2xl p-5 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="h-5 w-48 mb-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-36 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                    <div className="h-36 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                </div>
            </div>
        );
    }

    if (!data) return null;

    const hasAnyData =
        data.pacing.length > 0 ||
        data.emotions.length > 0 ||
        data.characterFrequencies.length > 0 ||
        data.characterRelationships.length > 0;

    if (!hasAnyData) {
        return (
            <div className="rounded-2xl p-5 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-[var(--text-primary)] font-semibold text-sm">Phân tích chuyên biệt</p>
                <p className="text-[var(--text-secondary)] text-xs mt-2">Chưa đủ dữ liệu để tạo chart pacing/emotion/character.</p>
            </div>
        );
    }

    const pacingValues = data.pacing.map(point => point.score);
    const pacingLabels = data.pacing.map(point => point.label);
    const emotionValues = data.emotions.map(point => ((point.valence + 1) / 2) * 100);
    const emotionLabels = data.emotions.map(point => point.label);
    const topFrequencies = data.characterFrequencies.slice(0, 10);
    const maxMentions = Math.max(1, ...topFrequencies.map(x => x.totalMentions));
    const topRelationships = data.characterRelationships.slice(0, 8);
    const topPresence = data.characterPresence.slice(0, 4);
    const insights = data.insights ?? [];

    return (
        <div className="rounded-2xl p-5 mt-5 flex flex-col gap-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <div>
                <p className="text-[var(--text-primary)] font-bold text-base">Phân tích chuyên biệt (Narrative Analytics)</p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">Pacing, emotion progression, character presence và relationship từ nội dung project.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-2">Pacing</p>
                    <LineChart values={pacingValues} color="#f59e0b" labels={pacingLabels} />
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-2">Emotion progression</p>
                    <LineChart values={emotionValues} color="#22c55e" labels={emotionLabels} />
                </div>
            </div>

            {topPresence.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3">Character presence (top 4)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {topPresence.map(series => (
                            <div key={series.characterName}>
                                <p className="text-[var(--text-secondary)] text-xs mb-1">{series.characterName}</p>
                                <LineChart values={series.points.map(p => p.mentions)} color="#a78bfa" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3">Character frequency</p>
                    <div className="flex flex-col gap-2">
                        {topFrequencies.length === 0 && (
                            <p className="text-[var(--text-secondary)] text-xs">Chưa có dữ liệu nhân vật.</p>
                        )}
                        {topFrequencies.map(item => (
                            <div key={item.characterName} className="flex items-center gap-3">
                                <span className="text-[var(--text-secondary)] text-xs w-28 truncate">{item.characterName}</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${Math.max(5, (item.totalMentions / maxMentions) * 100)}%`,
                                            background: 'linear-gradient(90deg,#8b5cf6,#6366f1)',
                                        }}
                                    />
                                </div>
                                <span className="text-[var(--text-primary)] text-xs font-semibold w-10 text-right">{item.totalMentions}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3">Character relationships</p>
                    <div className="flex flex-col gap-2">
                        {topRelationships.length === 0 && (
                            <p className="text-[var(--text-secondary)] text-xs">Chưa đủ dữ liệu đồng xuất hiện nhân vật.</p>
                        )}
                        {topRelationships.map((edge, idx) => (
                            <div key={`${edge.sourceCharacter}-${edge.targetCharacter}-${idx}`} className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-secondary)] truncate">
                                    {edge.sourceCharacter} ↔ {edge.targetCharacter}
                                </span>
                                <span className="text-[var(--text-primary)] font-semibold">{edge.weight}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Insights / Chú thích phân tích */}
            {insights.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3 flex items-center gap-2">
                        <span>💡</span> Chú thích phân tích tự động
                    </p>
                    <div className="flex flex-col gap-2">
                        {insights.map((insight, idx) => (
                            <p key={idx} className="text-xs leading-relaxed" style={{ color: '#c4b5fd' }}>
                                {insight}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
