import { useState, useMemo, useEffect } from 'react';
import type { NarrativeChartsResponse } from '../../services/reportService';

interface Props {
    data: NarrativeChartsResponse | null;
    loading: boolean;
}

// Helper to draw a smooth Catmull-Rom spline as a cubic Bezier curve in SVG
function getBezierPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // Tension control points
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
}

function AreaChart({ values, color, labels, onPointSelect, selectedIndex }: { 
    values: number[]; 
    color: string; 
    labels?: (string | null | undefined)[];
    onPointSelect?: (index: number) => void;
    selectedIndex?: number | null;
}) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (values.length === 0) {
        return <div className="h-32 rounded-xl flex items-center justify-center text-xs text-[var(--text-secondary)]" style={{ background: 'var(--bg-hover)' }}>Không có dữ liệu biểu đồ</div>;
    }

    const width = Math.max(700, values.length * 28);
    const height = 180;

    // Coordinate mapping
    const pointCoords = values.map((value, index) => ({
        x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
        y: height - (Math.min(Math.max(value, 0), 100) / 100) * height,
    }));

    const pathData = getBezierPath(pointCoords);
    const areaPathData = pointCoords.length > 0 
        ? `${pathData} L ${pointCoords[pointCoords.length - 1].x} ${height} L ${pointCoords[0].x} ${height} Z`
        : '';

    const annotatedPoints = labels
        ? pointCoords
            .map((p, i) => ({ ...p, label: labels[i], index: i }))
            .filter(p => p.label && p.label.includes(':')) // Only render special highlights
        : [];

    const gradientId = `grad-${color.replace('#', '')}`;

    return (
        <div className="w-full overflow-hidden rounded-xl p-3 relative group" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
            <style>{`
                .chart-scrollbar::-webkit-scrollbar {
                    height: 6px;
                }
                .chart-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chart-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.12);
                    border-radius: 999px;
                }
                .chart-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
            `}</style>
            <div className="w-full overflow-x-auto scrollbar-thin pb-2 chart-scrollbar">
                <div style={{ width: `${width}px`, minWidth: '100%' }}>
                    <svg viewBox={`-35 -30 ${width + 50} ${height + 55}`} className="w-full h-auto select-none">
                        <defs>
                            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.35 }} />
                                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.00 }} />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5"/>
                            </filter>
                        </defs>

                        {/* Y-axis gridlines & labels */}
                        {[0, 25, 50, 75, 100].map((tick) => {
                            const yVal = height - (tick / 100) * height;
                            return (
                                <g key={tick}>
                                    <line 
                                        x1="0" 
                                        y1={yVal} 
                                        x2={width} 
                                        y2={yVal} 
                                        stroke="rgba(255, 255, 255, 0.06)" 
                                        strokeWidth="1" 
                                        strokeDasharray={tick === 0 || tick === 100 ? "0" : "3 4"}
                                    />
                                    <text
                                        x="-10"
                                        y={yVal + 3.5}
                                        textAnchor="end"
                                        fill="rgba(255, 255, 255, 0.45)"
                                        fontSize="9"
                                        fontWeight="600"
                                        style={{ fontFamily: 'monospace' }}
                                    >
                                        {tick}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Area Gradient */}
                        {pointCoords.length > 0 && (
                            <path
                                d={areaPathData}
                                fill={`url(#${gradientId})`}
                            />
                        )}

                        {/* Curve Line */}
                        {pointCoords.length > 0 && (
                            <path
                                d={pathData}
                                fill="none"
                                stroke={color}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#glow)"
                            />
                        )}

                        {/* Vertical guide line on hover */}
                        {hoveredIdx !== null && pointCoords[hoveredIdx] && (
                            <line 
                                x1={pointCoords[hoveredIdx].x}
                                y1={0}
                                x2={pointCoords[hoveredIdx].x}
                                y2={height}
                                stroke={color}
                                strokeWidth="1.2"
                                strokeDasharray="3 3"
                                opacity="0.75"
                            />
                        )}

                        {/* Interactive Points */}
                        {pointCoords.map((p, i) => {
                            const isSelected = selectedIndex === i;
                            const isHovered = hoveredIdx === i;
                            return (
                                <circle 
                                    key={i} 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isSelected ? "7" : isHovered ? "6.5" : "4"} 
                                    fill={isSelected ? "#ffffff" : color} 
                                    stroke={isSelected ? color : "var(--bg-app)"}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    className="cursor-pointer transition-all duration-150"
                                    style={{ filter: isSelected || isHovered ? 'url(#shadow)' : 'none' }}
                                    onClick={() => onPointSelect?.(i)}
                                    onMouseEnter={() => setHoveredIdx(i)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                />
                            );
                        })}

                        {/* X-axis labels */}
                        {values.map((_, index) => {
                            const pointSpacing = values.length === 1 ? width : width / (values.length - 1);
                            const labelStep = Math.max(1, Math.ceil(65 / pointSpacing));
                            const shouldRenderLabel = index % labelStep === 0 || index === values.length - 1;

                            if (!shouldRenderLabel) return null;

                            const xVal = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
                            const isChapterLabel = labels && labels[index] && labels[index]!.startsWith("Chương");
                            const labelText = isChapterLabel ? labels[index] : `Đoạn ${index + 1}`;

                            return (
                                <text
                                    key={index}
                                    x={xVal}
                                    y={height + 18}
                                    textAnchor="middle"
                                    fill="rgba(255, 255, 255, 0.45)"
                                    fontSize="8.5"
                                    fontWeight="600"
                                >
                                    {labelText}
                                </text>
                            );
                        })}

                        {/* Dynamic SVG Tooltip on Hover */}
                        {hoveredIdx !== null && pointCoords[hoveredIdx] && (
                            <g className="pointer-events-none" style={{ filter: 'url(#shadow)' }}>
                                <rect 
                                    x={Math.max(5, Math.min(width - 115, pointCoords[hoveredIdx].x - 55))} 
                                    y="-24" 
                                    width="110" 
                                    height="18" 
                                    rx="5" 
                                    fill="rgba(15, 23, 42, 0.95)" 
                                    stroke={color}
                                    strokeWidth="1"
                                />
                                <text
                                    x={Math.max(60, Math.min(width - 60, pointCoords[hoveredIdx].x))}
                                    y="-12"
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="9"
                                    fontWeight="700"
                                >
                                    {labels && labels[hoveredIdx] && !labels[hoveredIdx]!.includes(':')
                                        ? `${labels[hoveredIdx]}: ${values[hoveredIdx].toFixed(1)}` 
                                        : `Đoạn ${hoveredIdx + 1}: ${values[hoveredIdx].toFixed(1)}`}
                                </text>
                            </g>
                        )}

                        {/* Peak/Trough Static Badges */}
                        {annotatedPoints.map((p, i) => (
                            <g key={i}>
                                <rect 
                                    x={p.x - 45} 
                                    y={p.y - 30} 
                                    width="90" 
                                    height="16" 
                                    rx="5" 
                                    fill="rgba(20,20,20,0.88)" 
                                    stroke={color}
                                    strokeWidth="1"
                                    style={{ filter: 'url(#shadow)' }}
                                />
                                <text
                                    x={p.x}
                                    y={p.y - 19}
                                    textAnchor="middle"
                                    fill="#fff"
                                    fontSize="8"
                                    fontWeight="800"
                                >
                                    {p.label}
                                </text>
                                <path d={`M ${p.x} ${p.y-14} L ${p.x} ${p.y-6}`} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
}

interface ParsedInsight {
    category: 'pacing' | 'emotion' | 'characters' | 'blueprint' | 'general';
    title: string;
    icon: string;
    color: string;
    bgGradient: string;
    borderColor: string;
    content: string;
}

export default function NarrativeChartsPanel({ data, loading }: Props) {
    const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
    const [selectedChapterState, setSelectedChapterState] = useState<number | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    // Compute list of unique chapters from pacing data
    const uniqueChapters = useMemo(() => {
        if (!data || !data.pacing) return [];
        return Array.from(new Set(data.pacing.map(p => p.chapterNumber))).sort((a, b) => a - b);
    }, [data]);

    // Active selected chapter
    const activeChapter = useMemo(() => {
        if (selectedChapterState !== null) return selectedChapterState;
        return uniqueChapters.length > 0 ? uniqueChapters[0] : 1;
    }, [selectedChapterState, uniqueChapters]);

    // Automatically reset selected segment preview when switching chapters or view mode
    useEffect(() => {
        setSelectedIdx(null);
    }, [viewMode, activeChapter]);

    if (loading) {
        return (
            <div className="rounded-2xl p-6 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="h-6 w-56 mb-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="h-56 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                    <div className="h-56 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                </div>
            </div>
        );
    }

    if (!data) return null;

    const hasAnyData = data.pacing.length > 0 || data.emotions.length > 0;
    if (!hasAnyData) {
        return (
            <div className="rounded-2xl p-6 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-[var(--text-primary)] font-bold text-base">Phân tích chuyên biệt</p>
                <p className="text-[var(--text-secondary)] text-xs mt-2">Chưa đủ dữ liệu để tạo biểu đồ nhịp độ & dòng cảm xúc.</p>
            </div>
        );
    }

    // ── 1. COMPUTE OVERVIEW DATA (Grouped and Averaged by Chapter) ──
    const overviewPacingValues = uniqueChapters.map(ch => {
        const pts = data.pacing.filter(p => p.chapterNumber === ch);
        return pts.reduce((sum, p) => sum + p.score, 0) / Math.max(1, pts.length);
    });
    const overviewPacingLabels = uniqueChapters.map(ch => `Chương ${ch}`);

    const overviewEmotionValues = uniqueChapters.map(ch => {
        const pts = data.emotions.filter(e => e.chapterNumber === ch);
        const avgValence = pts.reduce((sum, e) => sum + e.valence, 0) / Math.max(1, pts.length);
        return ((avgValence + 1) / 2) * 100;
    });
    const overviewEmotionLabels = uniqueChapters.map(ch => `Chương ${ch}`);

    // ── 2. COMPUTE DETAIL DATA (Filtered by selected chapter) ──
    const detailPacingValues = data.pacing
        .filter(p => p.chapterNumber === activeChapter)
        .map(p => p.score);
    const detailPacingLabels = data.pacing
        .filter(p => p.chapterNumber === activeChapter)
        .map(p => p.label);

    const detailEmotionValues = data.emotions
        .filter(e => e.chapterNumber === activeChapter)
        .map(e => ((e.valence + 1) / 2) * 100);
    const detailEmotionLabels = data.emotions
        .filter(e => e.chapterNumber === activeChapter)
        .map(e => e.label);

    // Get original segment index in detail mode to preview text
    const detailPacingPoints = data.pacing.filter(p => p.chapterNumber === activeChapter);

    // Active chart series
    const activePacingValues = viewMode === 'overview' ? overviewPacingValues : detailPacingValues;
    const activePacingLabels = viewMode === 'overview' ? overviewPacingLabels : detailPacingLabels;
    const activeEmotionValues = viewMode === 'overview' ? overviewEmotionValues : detailEmotionValues;
    const activeEmotionLabels = viewMode === 'overview' ? overviewEmotionLabels : detailEmotionLabels;

    const segmentTexts = data.segmentTexts ?? [];

    const handlePointSelect = (idx: number) => {
        if (viewMode === 'overview') {
            // Clicking a chapter point zooms into that chapter's details!
            const chapterNum = uniqueChapters[idx];
            setSelectedChapterState(chapterNum);
            setViewMode('detail');
        } else {
            // Detail mode clicks view the text segment preview
            const originalPt = detailPacingPoints[idx];
            if (originalPt) {
                setSelectedIdx(originalPt.SegmentIndex);
            }
        }
    };

    // Parse deep AI structured insights
    const parsedInsights = useMemo((): ParsedInsight[] => {
        const raw = data.insights ?? [];
        const result: ParsedInsight[] = [];
        
        const categoriesConfig = [
            { key: 'pacing', tag: '[Nhịp độ & Tiết tấu]', title: 'Nhịp độ & Tiết tấu', icon: '⚡', color: '#fbbf24', bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.07) 0%, rgba(251, 191, 36, 0.01) 100%)', borderColor: 'rgba(251, 191, 36, 0.25)' },
            { key: 'emotion', tag: '[Dòng cảm xúc]', title: 'Dòng cảm xúc & Không khí', icon: '🎭', color: '#10b981', bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.01) 100%)', borderColor: 'rgba(16, 185, 129, 0.25)' },
            { key: 'characters', tag: '[Động lực nhân vật]', title: 'Động lực & Tương tác Nhân vật', icon: '👥', color: '#6366f1', bgGradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.07) 0%, rgba(99, 102, 241, 0.01) 100%)', borderColor: 'rgba(99, 102, 241, 0.25)' },
            { key: 'blueprint', tag: '[Đề xuất kịch bản]', title: 'Đề xuất chiến lược chỉnh sửa', icon: '💡', color: '#c084fc', bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.09) 0%, rgba(167, 139, 250, 0.02) 100%)', borderColor: 'rgba(167, 139, 250, 0.35)' }
        ] as const;

        raw.forEach(insight => {
            if (insight.includes('PHÂN TÍCH CHUYÊN SÂU')) return;

            let matched = false;
            // 1. Try exact bracket tag matching
            for (const config of categoriesConfig) {
                if (insight.includes(config.tag)) {
                    const cleanContent = insight.replace(config.tag, '').trim();
                    result.push({
                        category: config.key,
                        title: config.title,
                        icon: config.icon,
                        color: config.color,
                        bgGradient: config.bgGradient,
                        borderColor: config.borderColor,
                        content: cleanContent
                    });
                    matched = true;
                    break;
                }
            }

            // 2. Secondary fallback: keyword checking
            if (!matched) {
                const lowerText = insight.toLowerCase();
                let matchedConfig = null;

                if (lowerText.includes('nhịp độ') || lowerText.includes('tiết tấu') || lowerText.includes('tốc độ') || lowerText.includes('kịch tính') || lowerText.includes('mạch kể')) {
                    matchedConfig = categoriesConfig[0]; // pacing
                } else if (lowerText.includes('cảm xúc') || lowerText.includes('không khí') || lowerText.includes('tâm trạng') || lowerText.includes('u sầu') || lowerText.includes('sắc thái')) {
                    matchedConfig = categoriesConfig[1]; // emotion
                } else if (lowerText.includes('nhân vật') || lowerText.includes('tương tác') || lowerText.includes('động lực') || lowerText.includes('đối thoại') || lowerText.includes('quan hệ')) {
                    matchedConfig = categoriesConfig[2]; // characters
                } else if (lowerText.includes('đề xuất') || lowerText.includes('chỉnh sửa') || lowerText.includes('cải thiện') || lowerText.includes('giải pháp') || lowerText.includes('khuyên')) {
                    matchedConfig = categoriesConfig[3]; // blueprint
                }

                if (matchedConfig) {
                    let cleanContent = insight;
                    categoriesConfig.forEach(c => {
                        cleanContent = cleanContent.replace(c.tag, '');
                    });
                    cleanContent = cleanContent.trim();

                    result.push({
                        category: matchedConfig.key,
                        title: matchedConfig.title,
                        icon: matchedConfig.icon,
                        color: matchedConfig.color,
                        bgGradient: matchedConfig.bgGradient,
                        borderColor: matchedConfig.borderColor,
                        content: cleanContent
                    });
                    matched = true;
                }
            }

            // 3. Absolute fallback
            if (!matched) {
                result.push({
                    category: 'general',
                    title: 'Phân tích tổng hợp',
                    icon: '✨',
                    color: '#38bdf8',
                    bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(56, 189, 248, 0.01) 100%)',
                    borderColor: 'rgba(56, 189, 248, 0.2)',
                    content: insight
                });
            }
        });

        // Deduplicate titles by adding index if multiple exist for a category
        const categoryCounts: Record<string, number> = {};
        result.forEach(insight => {
            categoryCounts[insight.category] = (categoryCounts[insight.category] || 0) + 1;
        });

        const categoryIndices: Record<string, number> = {};
        return result.map(insight => {
            if (categoryCounts[insight.category] > 1) {
                const currentIdx = (categoryIndices[insight.category] || 0) + 1;
                categoryIndices[insight.category] = currentIdx;
                return {
                    ...insight,
                    title: `${insight.title} (${currentIdx})`
                };
            }
            return insight;
        });
    }, [data.insights]);

    const formatInsightContent = (content: string, color: string) => {
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        return lines.map((line, lIdx) => {
            const isListItem = line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim());
            const cleanLine = isListItem 
                ? line.trim().replace(/^[-*\s]+|^\d+\.\s*/, '') 
                : line;

            const parts = cleanLine.split(/(".*?")/g);
            const renderedLine = (
                <span key={lIdx} className="leading-relaxed">
                    {parts.map((part, ptIdx) => {
                        if (part.startsWith('"') && part.endsWith('"')) {
                            return (
                                <span 
                                    key={ptIdx} 
                                    className="px-2 py-0.5 mx-0.5 rounded italic font-serif inline-block text-[13px] border transition-all duration-300"
                                    style={{ 
                                        backgroundColor: `${color}0d`, 
                                        borderColor: `${color}22`,
                                        color: 'rgba(255,255,255,0.95)'
                                    }}
                                >
                                    {part}
                                </span>
                            );
                        }
                        return part;
                    })}
                </span>
            );

            if (isListItem) {
                return (
                    <div key={lIdx} className="flex items-start gap-2 mt-1.5 pl-1">
                        <span className="text-[10px] mt-1.5 select-none" style={{ color }}>●</span>
                        <span className="text-sm leading-relaxed text-[rgba(255,255,255,0.85)]">{renderedLine}</span>
                    </div>
                );
            }

            return (
                <p key={lIdx} className="text-sm leading-relaxed text-[rgba(255,255,255,0.85)] mb-2">
                    {renderedLine}
                </p>
            );
        });
    };

    return (
        <div className="rounded-2xl p-6 mt-5 flex flex-col gap-6 animate-fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            
            {/* Header with Switcher */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                    <h3 className="text-[var(--text-primary)] font-extrabold text-xl tracking-tight flex items-center gap-2">
                        <span className="text-xl">📊</span> Phân tích chuyên biệt (Narrative Analytics)
                    </h3>
                    <p className="text-[var(--text-secondary)] text-sm mt-1 opacity-85">
                        {viewMode === 'overview' 
                            ? 'Báo cáo nhịp độ và cảm xúc trung bình theo từng chương của tác phẩm. Nhấp vào điểm để thu nhỏ chi tiết.' 
                            : `Chi tiết nhịp điệu và dòng cảm xúc từng đoạn trong Chương ${activeChapter}. Nhấp điểm để xem văn bản mẫu.`}
                    </p>
                </div>

                {/* View Mode Controls */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex p-0.5 rounded-lg border text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border-color)' }}>
                        <button 
                            onClick={() => setViewMode('overview')}
                            className="px-3.5 py-1.5 rounded-md transition-all"
                            style={{
                                background: viewMode === 'overview' ? 'var(--bg-hover)' : 'transparent',
                                color: viewMode === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                        >
                            🌐 Toàn cảnh
                        </button>
                        <button 
                            onClick={() => setViewMode('detail')}
                            className="px-3.5 py-1.5 rounded-md transition-all"
                            style={{
                                background: viewMode === 'detail' ? 'var(--bg-hover)' : 'transparent',
                                color: viewMode === 'detail' ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                        >
                            🔎 Chi tiết chương
                        </button>
                    </div>

                    {/* Chapter Dropdown in Detail Mode */}
                    {viewMode === 'detail' && uniqueChapters.length > 0 && (
                        <select
                            value={activeChapter}
                            onChange={(e) => setSelectedChapterState(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-lg border text-xs font-semibold select-custom cursor-pointer transition-all hover:bg-[var(--bg-hover)]"
                            style={{
                                background: 'var(--bg-app)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            {uniqueChapters.map(ch => (
                                <option key={ch} value={ch}>Chương {ch}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Explanations Card */}
            <div className="p-4 rounded-xl text-xs leading-relaxed border" style={{ borderColor: 'rgba(245,166,35,0.15)', background: 'linear-gradient(145deg, rgba(245,166,35,0.04), rgba(249,115,22,0.01))' }}>
                <details className="cursor-pointer group">
                    <summary className="font-bold mb-1 flex items-center justify-between text-sm" style={{ color: '#fbbf24' }}>
                        <span className="flex items-center gap-1.5 select-none">
                            ℹ️ Hướng dẫn đọc biểu đồ Nhịp độ & Cảm xúc (Mở rộng)
                        </span>
                        <span className="text-xs transition-transform duration-200 group-open:rotate-180 opacity-70">▼</span>
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3 pt-3 border-t border-[rgba(245,166,35,0.1)]">
                        <div>
                            <span className="font-bold text-[var(--text-primary)] text-sm">📈 Pacing (Nhịp độ kịch tính):</span>
                            <p className="text-[var(--text-secondary)] mt-1">Được tính từ mật độ hành động, tỷ lệ đối thoại trực tiếp, độ dài trung bình câu và tần suất dấu câu kịch tính (! hoặc ?):</p>
                            <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 text-[var(--text-secondary)]">
                                <li><span className="text-[var(--text-primary)] font-medium">Nhịp độ cao (&gt; 65)</span>: Hồi hộp, các cảnh hành động, cao trào, nhịp kịch bản nhanh gấp.</li>
                                <li><span className="text-[var(--text-primary)] font-medium">Nhịp độ thấp (&lt; 35)</span>: Trầm lặng, tả cảnh, suy tư nội tâm nhân vật, tạo quãng nghỉ cần thiết.</li>
                            </ul>
                        </div>
                        <div>
                            <span className="font-bold text-[var(--text-primary)] text-sm">🟢 Emotion (Dòng cảm xúc):</span>
                            <p className="text-[var(--text-secondary)] mt-1">Đo lường sắc thái biểu cảm dựa trên từ điển tình thái cảm xúc văn học:</p>
                            <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 text-[var(--text-secondary)]">
                                <li><span className="text-[var(--text-primary)] font-medium">Điểm cao (&gt; 50)</span>: Cảm xúc tích cực, tươi vui, hạnh phúc, ấm áp (Tương ứng với Joy/Hope).</li>
                                <li><span className="text-[var(--text-primary)] font-medium">Điểm thấp (&lt; 50)</span>: U sầu, buồn bã, giận dữ hoặc căng thẳng tột độ (Tương ứng với Sadness/Fear/Anger).</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </div>

            {/* Charts Vertical Stack */}
            <div className="flex flex-col gap-6">
                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[var(--text-primary)] text-sm font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Nhịp độ kể chuyện (Pacing Arc)
                        </p>
                        {viewMode === 'detail' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/25 text-amber-400 bg-amber-500/5 font-semibold">Chương {activeChapter}</span>
                        )}
                    </div>
                    <AreaChart values={activePacingValues} color="#f59e0b" labels={activePacingLabels} onPointSelect={handlePointSelect} selectedIndex={viewMode === 'detail' ? (detailPacingPoints.findIndex(p => p.SegmentIndex === selectedIdx)) : null} />
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[var(--text-primary)] text-sm font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Biến thiên cảm xúc (Emotion Progression)
                        </p>
                        {viewMode === 'detail' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/25 text-emerald-400 bg-emerald-500/5 font-semibold">Chương {activeChapter}</span>
                        )}
                    </div>
                    <AreaChart values={activeEmotionValues} color="#10b981" labels={activeEmotionLabels} onPointSelect={handlePointSelect} selectedIndex={viewMode === 'detail' ? (detailPacingPoints.findIndex(p => p.SegmentIndex === selectedIdx)) : null} />
                </div>
            </div>

            {/* Segment Preview Section */}
            {viewMode === 'detail' && selectedIdx !== null && segmentTexts[selectedIdx] && (
                <div className="rounded-xl p-5 animate-in fade-in slide-in-from-top-3 duration-300 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)' }}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    
                    <div className="flex justify-between items-center mb-3.5 pl-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                            <span>📖</span> Đối chứng nội dung chương {activeChapter} — Phân đoạn {detailPacingPoints.findIndex(p => p.SegmentIndex === selectedIdx) + 1}
                        </p>
                        <button 
                            onClick={() => setSelectedIdx(null)}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-all"
                        >
                            Đóng xem trước
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar pl-2">
                        <p className="text-sm leading-relaxed italic opacity-95 text-[rgba(255,255,255,0.92)] font-serif">
                            "...{segmentTexts[selectedIdx]}..."
                        </p>
                    </div>
                    <div className="mt-4 flex gap-4 text-xs opacity-75 font-semibold pl-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                        <span className="flex items-center gap-1.5 text-amber-400">⚡ Pacing: {data.pacing[selectedIdx]?.score.toFixed(1)}</span>
                        <span className="flex items-center gap-1.5 text-emerald-400">🎭 Cảm xúc chủ đạo: {data.emotions[selectedIdx]?.dominantEmotion} (Valence: {data.emotions[selectedIdx]?.valence.toFixed(2)})</span>
                    </div>
                </div>
            )}

            {/* structured Deep AI Insights Grid */}
            {parsedInsights.length > 0 && (
                <div 
                    className="rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden backdrop-blur-md" 
                    style={{ 
                        background: 'linear-gradient(135deg, rgba(30,30,45,0.7) 0%, rgba(15,15,25,0.5) 100%)', 
                        border: '1px solid rgba(99,102,241,0.18)' 
                    }}
                >
                    <div className="flex flex-col gap-1 border-b border-[rgba(255,255,255,0.06)] pb-4">
                        <h4 className="text-[var(--text-primary)] text-lg font-extrabold flex items-center gap-2.5 tracking-tight text-gradient-bright">
                            <span className="text-xl">✨</span> PHÂN TÍCH CHUYÊN SÂU TỪ AI (Literary Insights)
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 opacity-80">Đánh giá cấu trúc nhịp điệu kể chuyện và gợi ý định hướng viết nâng cao từ trí tuệ nhân tạo.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {parsedInsights.map((insight, idx) => {
                            return (
                                <div 
                                    key={idx} 
                                    className="group rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative" 
                                    style={{ 
                                        background: `linear-gradient(135deg, rgba(20, 20, 25, 0.7) 0%, ${insight.color}05 100%)`,
                                        border: `1px solid ${insight.borderColor}`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = insight.color;
                                        e.currentTarget.style.boxShadow = `0 10px 30px -10px ${insight.color}25`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = insight.borderColor;
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl p-2 rounded-xl bg-opacity-10 transition-transform duration-300 group-hover:scale-110 select-none" style={{ backgroundColor: `${insight.color}1c`, color: insight.color }}>
                                                {insight.icon}
                                            </span>
                                            <span className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
                                                {insight.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border" style={{ borderColor: `${insight.color}33`, color: insight.color, backgroundColor: `${insight.color}0f` }}>
                                            {insight.category === 'pacing' ? 'Nhịp kể' : insight.category === 'emotion' ? 'Cảm xúc' : insight.category === 'characters' ? 'Nhân vật' : insight.category === 'blueprint' ? 'Chiến lược' : 'Tổng hợp'}
                                        </span>
                                    </div>
                                    
                                    <div className="text-sm leading-relaxed text-[rgba(255,255,255,0.85)] font-medium">
                                        {formatInsightContent(insight.content, insight.color)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
