import { useState, useMemo } from 'react';
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

function DualAreaChart({ 
    pacingValues, 
    emotionValues, 
    labels, 
    onPointSelect, 
    selectedIndex 
}: { 
    pacingValues: number[]; 
    emotionValues: number[]; 
    labels?: (string | null | undefined)[];
    onPointSelect?: (index: number) => void;
    selectedIndex?: number | null;
}) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (pacingValues.length === 0) {
        return <div className="h-32 rounded-xl flex items-center justify-center text-xs text-[var(--text-secondary)]" style={{ background: 'var(--bg-hover)' }}>Không có dữ liệu biểu đồ</div>;
    }

    const width = Math.max(700, pacingValues.length * 28);
    const height = 180;

    // Coordinate mapping
    const pacingCoords = pacingValues.map((value, index) => ({
        x: pacingValues.length === 1 ? width / 2 : (index / (pacingValues.length - 1)) * width,
        y: height - (Math.min(Math.max(value, 0), 100) / 100) * height,
    }));

    const emotionCoords = emotionValues.map((value, index) => ({
        x: emotionValues.length === 1 ? width / 2 : (index / (emotionValues.length - 1)) * width,
        y: height - (Math.min(Math.max(value, 0), 100) / 100) * height,
    }));

    const pacingPathData = getBezierPath(pacingCoords);
    const pacingAreaPathData = pacingCoords.length > 0 
        ? `${pacingPathData} L ${pacingCoords[pacingCoords.length - 1].x} ${height} L ${pacingCoords[0].x} ${height} Z`
        : '';

    const emotionPathData = getBezierPath(emotionCoords);
    const emotionAreaPathData = emotionCoords.length > 0 
        ? `${emotionPathData} L ${emotionCoords[emotionCoords.length - 1].x} ${height} L ${emotionCoords[0].x} ${height} Z`
        : '';

    const annotatedPoints = labels
        ? pacingCoords
            .map((p, i) => ({ ...p, label: labels[i], index: i }))
            .filter(p => p.label && p.label.includes(':')) // Only render special highlights
        : [];

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
                            <linearGradient id="grad-pacing" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 0.22 }} />
                                <stop offset="100%" style={{ stopColor: '#f59e0b', stopOpacity: 0.00 }} />
                            </linearGradient>
                            <linearGradient id="grad-emotion" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.18 }} />
                                <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0.00 }} />
                            </linearGradient>
                            <filter id="glow-pacing" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="glow-emotion" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
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

                        {/* Area Gradients */}
                        {pacingCoords.length > 0 && (
                            <path
                                d={pacingAreaPathData}
                                fill="url(#grad-pacing)"
                            />
                        )}
                        {emotionCoords.length > 0 && (
                            <path
                                d={emotionAreaPathData}
                                fill="url(#grad-emotion)"
                            />
                        )}

                        {/* Curve Lines */}
                        {pacingCoords.length > 0 && (
                            <path
                                d={pacingPathData}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#glow-pacing)"
                            />
                        )}
                        {emotionCoords.length > 0 && (
                            <path
                                d={emotionPathData}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#glow-emotion)"
                            />
                        )}

                        {/* Vertical guide line on hover */}
                        {hoveredIdx !== null && pacingCoords[hoveredIdx] && (
                            <line 
                                x1={pacingCoords[hoveredIdx].x}
                                y1={0}
                                x2={pacingCoords[hoveredIdx].x}
                                y2={height}
                                stroke="rgba(255, 255, 255, 0.25)"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                opacity="0.8"
                            />
                        )}

                        {/* Pacing dots */}
                        {pacingCoords.map((p, i) => {
                            const isSelected = selectedIndex === i;
                            const isHovered = hoveredIdx === i;
                            return (
                                <circle
                                    key={`pacing-dot-${i}`}
                                    cx={p.x}
                                    cy={p.y}
                                    r={isSelected ? "5.5" : isHovered ? "4.5" : "2.2"}
                                    fill={isSelected ? "#ffffff" : "#f59e0b"}
                                    stroke="#f59e0b"
                                    strokeWidth={isSelected ? "2.5" : "1"}
                                    pointerEvents="none"
                                />
                            );
                        })}

                        {/* Emotion dots */}
                        {emotionCoords.map((p, i) => {
                            const isSelected = selectedIndex === i;
                            const isHovered = hoveredIdx === i;
                            return (
                                <circle
                                    key={`emotion-dot-${i}`}
                                    cx={p.x}
                                    cy={p.y}
                                    r={isSelected ? "5.5" : isHovered ? "4.5" : "2.2"}
                                    fill={isSelected ? "#ffffff" : "#10b981"}
                                    stroke="#10b981"
                                    strokeWidth={isSelected ? "2.5" : "1"}
                                    pointerEvents="none"
                                />
                            );
                        })}

                        {/* X-axis labels */}
                        {pacingValues.map((_, index) => {
                            const pointSpacing = pacingValues.length === 1 ? width : width / (pacingValues.length - 1);
                            const labelStep = Math.max(1, Math.ceil(65 / pointSpacing));
                            const shouldRenderLabel = index % labelStep === 0 || index === pacingValues.length - 1;

                            if (!shouldRenderLabel) return null;

                            const xVal = pacingValues.length === 1 ? width / 2 : (index / (pacingValues.length - 1)) * width;
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

                        {/* Transparent capture vertical bars for hover and click */}
                        {pacingCoords.map((p, i) => {
                            const rectWidth = width / Math.max(1, pacingValues.length - 1);
                            const xStart = pacingValues.length === 1 ? 0 : p.x - rectWidth / 2;
                            return (
                                <rect
                                    key={`capture-${i}`}
                                    x={xStart}
                                    y={-25}
                                    width={pacingValues.length === 1 ? width : rectWidth}
                                    height={height + 50}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredIdx(i)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    onClick={() => onPointSelect?.(i)}
                                />
                            );
                        })}

                        {/* Dynamic SVG Tooltip on Hover */}
                        {hoveredIdx !== null && pacingCoords[hoveredIdx] && (
                            <g className="pointer-events-none" style={{ filter: 'url(#shadow)' }}>
                                <rect 
                                    x={Math.max(5, Math.min(width - 125, pacingCoords[hoveredIdx].x - 60))} 
                                    y="-36" 
                                    width="120" 
                                    height="30" 
                                    rx="5" 
                                    fill="rgba(15, 23, 42, 0.95)" 
                                    stroke="rgba(255, 255, 255, 0.15)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={Math.max(65, Math.min(width - 65, pacingCoords[hoveredIdx].x))}
                                    y="-24"
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="9"
                                    fontWeight="700"
                                >
                                    {labels && labels[hoveredIdx] && !labels[hoveredIdx]!.includes(':')
                                        ? labels[hoveredIdx]
                                        : `Đoạn ${hoveredIdx + 1}`}
                                </text>
                                <text
                                    x={Math.max(65, Math.min(width - 65, pacingCoords[hoveredIdx].x))}
                                    y="-12"
                                    textAnchor="middle"
                                    fontSize="8.5"
                                    fontWeight="600"
                                >
                                    <tspan fill="#f59e0b">⚡ Pacing: {pacingValues[hoveredIdx].toFixed(0)}</tspan>
                                    <tspan fill="rgba(255,255,255,0.3)"> | </tspan>
                                    <tspan fill="#10b981">🎭 Emotion: {emotionValues[hoveredIdx].toFixed(0)}</tspan>
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
                                    stroke="#f59e0b"
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
                                <path d={`M ${p.x} ${p.y-14} L ${p.x} ${p.y-6}`} stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
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
    // Compute list of unique chapters from pacing data
    const uniqueChapters = useMemo(() => {
        if (!data || !data.pacing) return [];
        return Array.from(new Set(data.pacing.map(p => p.chapterNumber))).sort((a, b) => a - b);
    }, [data]);

    // Parse deep AI structured insights
    const parsedInsights = useMemo((): ParsedInsight[] => {
        if (!data) return [];
        const raw = data.insights ?? [];
        const result: ParsedInsight[] = [];
        
        const categoriesConfig = [
            { key: 'pacing', tag: '[Nhịp độ & Tiết tấu]', title: 'Nhịp độ & Tiết tấu', icon: '⚡', color: '#fbbf24', bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.07) 0%, rgba(251, 191, 36, 0.01) 100%)', borderColor: 'rgba(251, 191, 36, 0.25)' },
            { key: 'emotion', tag: '[Dòng cảm xúc]', title: 'Dòng cảm xúc & Không khí', icon: '🎭', color: '#10b981', bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.01) 100%)', borderColor: 'rgba(16, 185, 129, 0.25)' },
            { key: 'characters', tag: '[Động lực nhân vật]', title: 'Động lực & Tương tác Nhân vật', icon: '👥', color: '#6366f1', bgGradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.07) 0%, rgba(99, 102, 241, 0.01) 100%)', borderColor: 'rgba(99, 102, 241, 0.25)' },
            { key: 'blueprint', tag: '[Đề xuất kịch bản]', title: 'Đề xuất chiến lược chỉnh sửa', icon: '💡', color: '#c084fc', bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.09) 0%, rgba(167, 139, 250, 0.02) 100%)', borderColor: 'rgba(167, 139, 250, 0.35)' }
        ] as const;

        raw.forEach(rawInsight => {
            let insight = rawInsight.trim();

            // 1. Normalize quotes to straight quotes for parsing and stripping
            insight = insight
                .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

            // 2. Filter out obvious JSON structure lines
            const cleanCheck = insight.replace(/^["'\s,\[\]\{\}:“”«»\\/]+|["'\s,\[\]\{\}:“”«»\\/]+$/g, '').toLowerCase().trim();
            const hasNoLettersOrDigits = !/[a-zA-Z0-9\u00C0-\u1EF9]/.test(insight);
            const isJsonBoilerplate = 
                hasNoLettersOrDigits ||
                cleanCheck === 'insights' ||
                cleanCheck === 'insight' ||
                cleanCheck === '{' || 
                cleanCheck === '}' || 
                cleanCheck === '[' || 
                cleanCheck === ']' || 
                cleanCheck === ',' ||
                cleanCheck === '';

            if (isJsonBoilerplate || !insight) return;

            // 3. Strip leading/trailing double/single quotes, commas, braces, and formatting spaces (leave brackets to keep tags intact)
            insight = insight.replace(/^["'\s,\{\}“”«»]+|["'\s,\{\}“”«»]+$/g, '').trim();
            if (!insight || insight.length < 5) return;

            if (insight.includes('PHÂN TÍCH CHUYÊN SÂU')) return;

            let matched = false;
            // 1. Try exact bracket tag matching (including common bracket-stripped variations)
            for (const config of categoriesConfig) {
                const malformedTag1 = config.tag.replace('[', ''); // "Nhịp độ & Tiết tấu]"
                const malformedTag2 = config.tag.replace(']', ''); // "[Nhịp độ & Tiết tấu"
                const malformedTag3 = config.tag.replace(/[\[\]]/g, ''); // "Nhịp độ & Tiết tấu"
                
                let foundTag = '';
                if (insight.includes(config.tag)) {
                    foundTag = config.tag;
                } else if (insight.includes(malformedTag1)) {
                    foundTag = malformedTag1;
                } else if (insight.includes(malformedTag2)) {
                    foundTag = malformedTag2;
                } else if (insight.includes(malformedTag3)) {
                    foundTag = malformedTag3;
                }

                if (foundTag) {
                    let cleanContent = insight.replace(foundTag, '').trim();
                    cleanContent = cleanContent.replace(/^["'\s,\[\]\{\}“”«»]+|["'\s,\[\]\{\}“”«»]+$/g, '').trim();
                    if (cleanContent) {
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
                    }
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
                        const tagWithoutBrackets = c.tag.replace(/[\[\]]/g, '');
                        cleanContent = cleanContent.replace(tagWithoutBrackets + ']', '');
                        cleanContent = cleanContent.replace('[' + tagWithoutBrackets, '');
                        cleanContent = cleanContent.replace(tagWithoutBrackets, '');
                    });
                    cleanContent = cleanContent.replace(/^["'\s,\[\]\{\}“”«»]+|["'\s,\[\]\{\}“”«»]+$/g, '').trim();

                    if (cleanContent) {
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
    }, [data?.insights]);

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

    const hasAnyData = data.pacing.length > 0;
    if (!hasAnyData) {
        return (
            <div className="rounded-2xl p-6 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-[var(--text-primary)] font-bold text-base">Phân tích chuyên biệt</p>
                <p className="text-[var(--text-secondary)] text-xs mt-2">Chưa đủ dữ liệu để tạo biểu đồ nhịp độ kể chuyện.</p>
            </div>
        );
    }

    const mapValenceToScore = (valence: number) => ((valence + 1) / 2) * 100;

    // ── COMPUTE OVERVIEW DATA (Grouped and Averaged by Chapter) ──
    const overviewPacingValues = uniqueChapters.map(ch => {
        const pts = data.pacing.filter(p => p.chapterNumber === ch);
        return pts.reduce((sum, p) => sum + p.score, 0) / Math.max(1, pts.length);
    });

    const overviewEmotionValues = uniqueChapters.map(ch => {
        const pts = data.emotions.filter(e => e.chapterNumber === ch);
        const scores = pts.map(e => mapValenceToScore(e.valence));
        return scores.reduce((sum, s) => sum + s, 0) / Math.max(1, scores.length);
    });

    const overviewLabels = uniqueChapters.map(ch => `Chương ${ch}`);

    const formatInsightContent = (content: string, color: string) => {
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        return lines.map((line, lIdx) => {
            const isListItem = line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim());
            const cleanLine = isListItem 
                ? line.trim().replace(/^[-*\s]+|^\d+\.\s*/, '') 
                : line;

            // Split by straight double quotes or curly double quotes to style quotes nicely
            const parts = cleanLine.split(/("[^"]*?"|“[^”]*?”)/g);
            const renderedLine = (
                <span key={lIdx} className="leading-relaxed" style={{ fontFamily: "var(--font-sans)" }}>
                    {parts.map((part, ptIdx) => {
                        const isQuote = (part.startsWith('"') && part.endsWith('"')) || 
                                        (part.startsWith('“') && part.endsWith('”'));
                        if (isQuote) {
                            return (
                                <span 
                                    key={ptIdx} 
                                    className="px-1 py-0.5 mx-0.5 rounded italic inline border transition-all duration-300 font-sans text-[13px] bg-white/5 border-white/10 text-amber-300"
                                    style={{ fontFamily: "var(--font-sans)" }}
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
                    <div key={lIdx} className="flex items-start gap-2 mt-1.5 pl-1" style={{ fontFamily: "var(--font-sans)" }}>
                        <span className="text-[10px] mt-1.5 select-none" style={{ color }}>●</span>
                        <span className="text-sm leading-relaxed text-[rgba(255,255,255,0.85)] font-sans">{renderedLine}</span>
                    </div>
                );
            }

            return (
                <p key={lIdx} className="text-sm leading-relaxed text-[rgba(255,255,255,0.85)] mb-2 font-sans" style={{ fontFamily: "var(--font-sans)" }}>
                    {renderedLine}
                </p>
            );
        });
    };

    return (
        <div className="rounded-2xl p-6 mt-5 flex flex-col gap-6 animate-fade-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fontFamily: "var(--font-sans)" }}>
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                    <h3 className="text-[var(--text-primary)] font-extrabold text-xl tracking-tight flex items-center gap-2 font-sans">
                        <span className="text-xl">📊</span> Phân tích chuyên biệt (Narrative Analytics)
                    </h3>
                    <p className="text-[var(--text-secondary)] text-sm mt-1 opacity-85 font-sans">
                        Báo cáo nhịp độ và cảm xúc trung bình theo từng chương của tác phẩm.
                    </p>
                </div>
            </div>

            {/* Explanations Card */}
            <div className="p-4 rounded-xl text-xs leading-relaxed border font-sans" style={{ borderColor: 'rgba(245,166,35,0.15)', background: 'linear-gradient(145deg, rgba(245,166,35,0.04), rgba(249,115,22,0.01))' }}>
                <details className="cursor-pointer group">
                    <summary className="font-bold mb-1 flex items-center justify-between text-sm text-gradient-bright font-sans" style={{ color: '#fbbf24' }}>
                        <span className="flex items-center gap-1.5 select-none font-sans">
                            ℹ️ Hướng dẫn đọc biểu đồ Nhịp độ & Cảm xúc (Mở rộng)
                        </span>
                        <span className="text-xs transition-transform duration-200 group-open:rotate-180 opacity-70">▼</span>
                    </summary>
                    <div className="mt-3 pt-3 border-t border-[rgba(245,166,35,0.1)] grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                        <div>
                            <span className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1 font-sans">📈 <span className="text-amber-400">Pacing (Nhịp độ kịch tính):</span></span>
                            <p className="text-[var(--text-secondary)] mt-1 font-sans">Được tính toán tự động dựa trên tần suất hành động, tỷ lệ hội thoại, độ dài câu và dấu câu kịch tính:</p>
                            <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 text-[var(--text-secondary)] font-sans">
                                <li><span className="text-[var(--text-primary)] font-medium font-sans">Nhịp độ cao (&gt; 65)</span>: Hồi hộp, hành động gay cấn, mâu thuẫn đẩy lên cao trào.</li>
                                <li><span className="text-[var(--text-primary)] font-medium font-sans">Nhịp độ thấp (&lt; 35)</span>: Tĩnh lặng, tả cảnh, suy ngẫm nội tâm hoặc chuẩn bị sự kiện mới.</li>
                            </ul>
                        </div>
                        <div>
                            <span className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-1 font-sans">🎭 <span className="text-emerald-400">Emotion (Tích cực & Tiêu cực):</span></span>
                            <p className="text-[var(--text-secondary)] mt-1 font-sans">Quy đổi từ chỉ số Valence (-1 đến +1) phản ánh sắc thái tâm lý nhân vật và bầu không khí:</p>
                            <ul className="list-disc list-inside mt-1.5 space-y-1 pl-1 text-[var(--text-secondary)] font-sans">
                                <li><span className="text-[var(--text-primary)] font-medium font-sans">Cảm xúc tích cực (&gt; 65)</span>: Vui tươi, chiến thắng, ấm áp, lãng mạn hoặc chữa lành.</li>
                                <li><span className="text-[var(--text-primary)] font-medium font-sans">Cảm xúc tiêu cực (&lt; 35)</span>: Bi thương, tuyệt vọng, giận dữ, u ám hoặc lo lắng hiểm họa.</li>
                            </ul>
                        </div>
                    </div>
                </details>
            </div>

            {/* Charts Vertical Stack */}
            <div className="flex flex-col gap-6 font-sans">
                <div className="rounded-xl p-5" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <p className="text-[var(--text-primary)] text-sm font-bold flex items-center gap-2 font-sans">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" /> Biểu đồ Nhịp độ & Cảm xúc tích hợp
                        </p>
                        <div className="flex items-center gap-4 text-xs font-semibold font-sans">
                            <div className="flex items-center gap-1.5 text-amber-400 font-sans">
                                <span className="w-3 h-1.5 rounded-full bg-amber-500" />
                                <span>⚡ Nhịp độ (Pacing)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-400 font-sans">
                                <span className="w-3 h-1.5 rounded bg-emerald-500" />
                                <span>🎭 Cảm xúc (Emotion)</span>
                            </div>
                        </div>
                    </div>
                    <DualAreaChart 
                        pacingValues={overviewPacingValues} 
                        emotionValues={overviewEmotionValues} 
                        labels={overviewLabels} 
                    />
                </div>
            </div>

            {/* structured Deep AI Insights Grid */}
            {parsedInsights.length > 0 && (
                <div 
                    className="rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden backdrop-blur-md font-sans" 
                    style={{ 
                        background: 'linear-gradient(135deg, rgba(30,30,45,0.7) 0%, rgba(15,15,25,0.5) 100%)', 
                        border: '1px solid rgba(99,102,241,0.18)' 
                    }}
                >
                    <div className="flex flex-col gap-1 border-b border-[rgba(255,255,255,0.06)] pb-4 font-sans">
                        <h4 className="text-[var(--text-primary)] text-lg font-extrabold flex items-center gap-2.5 tracking-tight text-gradient-bright font-sans">
                            <span className="text-xl">✨</span> PHÂN TÍCH CHUYÊN SÂU TỪ AI (Literary Insights)
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 opacity-80 font-sans">Đánh giá cấu trúc nhịp điệu kể chuyện và gợi ý định hướng viết nâng cao từ trí tuệ nhân tạo.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                        {parsedInsights.map((insight, idx) => {
                            return (
                                <div 
                                    key={idx} 
                                    className="group rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative font-sans" 
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
                                    <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)] font-sans">
                                        <div className="flex items-center gap-3 font-sans">
                                            <span className="text-xl p-2 rounded-xl bg-opacity-10 transition-transform duration-300 group-hover:scale-110 select-none font-sans" style={{ backgroundColor: `${insight.color}1c`, color: insight.color }}>
                                                {insight.icon}
                                            </span>
                                            <span className="text-sm font-extrabold tracking-tight text-[var(--text-primary)] font-sans">
                                                {insight.title}
                                            </span>
                                        </div>
                                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border font-sans" style={{ borderColor: `${insight.color}33`, color: insight.color, backgroundColor: `${insight.color}0f` }}>
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
