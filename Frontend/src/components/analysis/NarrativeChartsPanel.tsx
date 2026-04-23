import { useState } from 'react';
import type { NarrativeChartsResponse } from '../../services/reportService';

interface Props {
    data: NarrativeChartsResponse | null;
    loading: boolean;
}


function AreaChart({ values, color, labels, onPointSelect, selectedIndex }: { 
    values: number[]; 
    color: string; 
    labels?: (string | null | undefined)[];
    onPointSelect?: (index: number) => void;
    selectedIndex?: number | null;
}) {
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

    const pathData = pointCoords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPathData = `${pathData} L ${pointCoords[pointCoords.length - 1].x} ${height} L ${pointCoords[0].x} ${height} Z`;

    const annotatedPoints = labels
        ? pointCoords
            .map((p, i) => ({ ...p, label: labels[i], index: i }))
            .filter(p => p.label)
        : [];

    const gradientId = `grad-${color.replace('#', '')}`;

    return (
        <div className="w-full overflow-hidden rounded-xl p-2" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
            <svg viewBox={`-10 -30 ${width + 20} ${height + 40}`} className="w-full h-40">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.4 }} />
                        <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                <path
                    d={areaPathData}
                    fill={`url(#${gradientId})`}
                />
                <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                />
                
                {/* Interactive Points */}
                {pointCoords.map((p, i) => (
                    <circle 
                        key={i} 
                        cx={p.x} 
                        cy={p.y} 
                        r={selectedIndex === i ? "6" : "3.5"} 
                        fill={selectedIndex === i ? "white" : color} 
                        stroke="var(--bg-app)"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => onPointSelect?.(i)}
                    >
                        <title>Đoạn {i + 1}: {values[i].toFixed(1)}</title>
                    </circle>
                ))}

                {annotatedPoints.map((p, i) => (
                    <g key={i}>
                        <rect 
                            x={p.x - 45} 
                            y={p.y - 30} 
                            width="90" 
                            height="16" 
                            rx="6" 
                            fill="rgba(20,20,20,0.85)" 
                            stroke={color}
                            strokeWidth="0.5"
                            className="backdrop-blur-md"
                        />
                        <text
                            x={p.x}
                            y={p.y - 19}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize="8"
                            fontWeight="700"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                        >
                            {p.label}
                        </text>
                        <path d={`M ${p.x} ${p.y-14} L ${p.x} ${p.y-6}`} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                ))}
            </svg>
        </div>
    );
}

export default function NarrativeChartsPanel({ data, loading }: Props) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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
    const segmentTexts = data.segmentTexts ?? [];

    const handlePointSelect = (idx: number) => {
        setSelectedIdx(idx);
    };

    return (
        <div className="rounded-2xl p-6 mt-5 flex flex-col gap-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <div>
                <p className="text-[var(--text-primary)] font-bold text-lg">Phân tích chuyên biệt (Narrative Analytics)</p>
                <p className="text-[var(--text-secondary)] text-sm mt-1 opacity-70">Nhấp vào các điểm trên biểu đồ để xem nội dung truyện tương ứng.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Pacing (Nhịp độ)
                    </p>
                    <AreaChart values={pacingValues} color="#f59e0b" labels={pacingLabels} onPointSelect={handlePointSelect} selectedIndex={selectedIdx} />
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> Emotion progression (Dòng cảm xúc)
                    </p>
                    <AreaChart values={emotionValues} color="#22c55e" labels={emotionLabels} onPointSelect={handlePointSelect} selectedIndex={selectedIdx} />
                </div>
            </div>

            {/* Segment Preview Section */}
            {selectedIdx !== null && segmentTexts[selectedIdx] && (
                <div className="rounded-xl p-5 animate-in fade-in slide-in-from-top-2 duration-300" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)' }}>
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                            Đối chứng nội dung: Phân đoạn {selectedIdx + 1}
                            {data.pacing[selectedIdx] && ` (Chương ${data.pacing[selectedIdx].chapterNumber})`}
                        </p>
                        <button 
                            onClick={() => setSelectedIdx(null)}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs"
                        >
                            Đóng xem trước
                        </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-sm leading-relaxed italic opacity-90" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            "...{segmentTexts[selectedIdx]}..."
                        </p>
                    </div>
                    <div className="mt-3 flex gap-4 text-[10px] opacity-60 font-medium">
                        <span className="flex items-center gap-1">⏱ Pacing: {data.pacing[selectedIdx]?.score.toFixed(1)}</span>
                        <span className="flex items-center gap-1">🎭 Cảm xúc: {data.emotions[selectedIdx]?.dominantEmotion}</span>
                    </div>
                </div>
            )}

            {topPresence.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-4">Sự xuất hiện của nhân vật (Top 4)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topPresence.map(series => (
                            <div key={series.characterName} className="p-2">
                                <p className="text-[var(--text-secondary)] text-xs font-medium mb-2 opacity-80 uppercase tracking-wider">{series.characterName}</p>
                                <AreaChart 
                                    values={series.points.map(p => p.mentions)} 
                                    color="#a78bfa" 
                                    onPointSelect={handlePointSelect}
                                    selectedIndex={selectedIdx}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-4">Mật độ xuất hiện</p>
                    <div className="flex flex-col gap-3">
                        {topFrequencies.length === 0 && (
                            <p className="text-[var(--text-secondary)] text-xs italic">Chưa có dữ liệu nhân vật.</p>
                        )}
                        {topFrequencies.map(item => (
                            <div key={item.characterName} className="flex items-center gap-4">
                                <span className="text-[var(--text-secondary)] text-xs w-28 truncate font-medium">{item.characterName}</span>
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.max(5, (item.totalMentions / maxMentions) * 100)}%`,
                                            background: 'linear-gradient(90deg,#8b5cf6,#6366f1)',
                                        }}
                                    />
                                </div>
                                <span className="text-[var(--text-primary)] text-xs font-bold w-10 text-right">{item.totalMentions}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-semibold mb-4">Mối quan hệ nhân vật</p>
                    <div className="flex flex-col gap-2.5">
                        {topRelationships.length === 0 && (
                            <p className="text-[var(--text-secondary)] text-xs italic">Chưa đủ dữ liệu đồng xuất hiện.</p>
                        )}
                        {topRelationships.map((edge, idx) => (
                            <div key={`${edge.sourceCharacter}-${edge.targetCharacter}-${idx}`} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <span className="text-[var(--text-secondary)] truncate flex items-center gap-2">
                                    <span className="opacity-60">{edge.sourceCharacter}</span> 
                                    <span className="text-indigo-400">↔</span> 
                                    <span className="opacity-60">{edge.targetCharacter}</span>
                                </span>
                                <span className="text-[var(--text-primary)] font-bold bg-[var(--bg-hover)] px-2 py-0.5 rounded">{edge.weight}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Insights / Chú thích phân tích */}
            {insights.length > 0 && (
                <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <p className="text-[var(--text-primary)] text-sm font-bold mb-4 flex items-center gap-2">
                        <span className="text-lg">✨</span> PHÂN TÍCH CHUYÊN SÂU TỪ AI
                    </p>
                    <div className="flex flex-col gap-3">
                        {insights.map((insight, idx) => {
                            const isHeader = insight.includes('PHÂN TÍCH CHUYÊN SÂU');
                            if (isHeader) return null;
                            
                            return (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#a78bfa' }} />
                                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                        {insight}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
