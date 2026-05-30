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

    // Phân tích tuyệt đối trên thang đo [0, 100] thay vì tỉ lệ co dãn tương đối của dữ liệu cục bộ
    // giúp người dùng dễ dàng đối sánh nhịp độ và cảm xúc cùng một hệ quy chiếu.
    const pointCoords = values.map((value, index) => ({
        x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
        y: height - (Math.min(Math.max(value, 0), 100) / 100) * height,
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
            <svg viewBox={`-35 -30 ${width + 45} ${height + 55}`} className="w-full h-44">
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

                {/* Đường lưới kẻ ngang (Gridlines) & Nhãn trục Y từ 0 đến 100 */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const yVal = height - (tick / 100) * height;
                    return (
                        <g key={tick}>
                            <line 
                                x1="0" 
                                y1={yVal} 
                                x2={width} 
                                y2={yVal} 
                                stroke="rgba(255, 255, 255, 0.08)" 
                                strokeWidth="1" 
                                strokeDasharray={tick === 0 || tick === 100 ? "0" : "4 4"}
                            />
                            <text
                                x="-10"
                                y={yVal + 3.5}
                                textAnchor="end"
                                fill="rgba(255, 255, 255, 0.5)"
                                fontSize="9"
                                fontWeight="500"
                                style={{ fontFamily: 'monospace' }}
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

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

                {/* Nhãn mốc phân đoạn trên trục X ở dưới đáy biểu đồ */}
                {values.map((_, index) => {
                    const shouldRenderLabel = 
                        values.length <= 8 || 
                        index === 0 || 
                        index === values.length - 1 || 
                        (values.length <= 16 && index % 2 === 0) || 
                        (values.length <= 30 && index % 5 === 0) || 
                        (index % 10 === 0);

                    if (!shouldRenderLabel) return null;

                    const xVal = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
                    return (
                        <text
                            key={index}
                            x={xVal}
                            y={height + 16}
                            textAnchor="middle"
                            fill="rgba(255, 255, 255, 0.38)"
                            fontSize="8"
                            fontWeight="500"
                        >
                            Đoạn {index + 1}
                        </text>
                    );
                })}

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

    const hasAnyData = data.pacing.length > 0 || data.emotions.length > 0;

    if (!hasAnyData) {
        return (
            <div className="rounded-2xl p-5 mt-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-[var(--text-primary)] font-semibold text-sm">Phân tích chuyên biệt</p>
                <p className="text-[var(--text-secondary)] text-xs mt-2">Chưa đủ dữ liệu để tạo chart pacing/emotion.</p>
            </div>
        );
    }

    const pacingValues = data.pacing.map(point => point.score);
    const pacingLabels = data.pacing.map(point => point.label);
    const emotionValues = data.emotions.map(point => ((point.valence + 1) / 2) * 100);
    const emotionLabels = data.emotions.map(point => point.label);

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

            {/* Pacing & Emotion Explanation Card */}
            <div className="p-4 rounded-xl text-xs leading-relaxed border" style={{ borderColor: 'rgba(245,166,35,0.2)', background: 'linear-gradient(145deg, rgba(245,166,35,0.05), rgba(249,115,22,0.02))' }}>
                <p className="font-bold mb-2 flex items-center gap-1.5 text-sm" style={{ color: '#fbbf24' }}>
                    ℹ️ Giải thích: Cơ chế AI phân tích Nhịp độ & Cảm xúc
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <span className="font-bold text-[var(--text-primary)] text-sm">📈 Pacing (Nhịp độ truyện):</span>
                        <p className="text-[var(--text-secondary)] mt-1">Được tính toán động từ nội dung bản thảo dựa trên 4 chỉ số ngữ pháp kịch bản chính:</p>
                        <ul className="list-disc list-inside mt-1.5 space-y-1.5 pl-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <li><span className="font-semibold text-[var(--text-primary)]">Mật độ động từ hành động:</span> Các từ động thái mạnh (lao, chém, chạy, bắn, đập...) đẩy nhịp điệu nhanh hơn.</li>
                            <li><span className="font-semibold text-[var(--text-primary)]">Độ dài câu trung bình:</span> Các câu cực ngắn tạo cảm giác giật gân, khẩn trương; câu dài dùng để tả bối cảnh và suy tư nội tâm chậm rãi.</li>
                            <li><span className="font-semibold text-[var(--text-primary)]">Tỷ lệ đối thoại trực tiếp:</span> Sử dụng lời thoại đẩy nhanh nhịp câu chuyện so với các phân đoạn tự sự trần thuật.</li>
                            <li><span className="font-semibold text-[var(--text-primary)]">Dấu câu kịch tính:</span> Tần suất sử dụng dấu <code className="px-1 py-0.5 bg-[var(--bg-hover)] rounded font-mono font-bold text-amber-300">!</code> hoặc <code className="px-1 py-0.5 bg-[var(--bg-hover)] rounded font-mono font-bold text-amber-300">?</code> biểu thị xung đột cao độ.</li>
                        </ul>
                    </div>
                    <div>
                        <span className="font-bold text-[var(--text-primary)] text-sm">🟢 Emotion (Dòng cảm xúc chủ đạo):</span>
                        <p className="text-[var(--text-secondary)] mt-1">Đo lường mức độ tương tác cảm xúc qua thuật toán Phân tích Sắc thái văn học:</p>
                        <ul className="list-disc list-inside mt-1.5 space-y-1.5 pl-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <li><span className="font-semibold text-[var(--text-primary)]">Valence (Chiều hướng):</span> Điểm sắc thái dao động từ bi kịch u ám (-1.0) sang tích cực, hài kịch tươi sáng (+1.0).</li>
                            <li><span className="font-semibold text-[var(--text-primary)]">Intensity (Cường độ):</span> Độ mạnh hoặc độ tập trung của từ ngữ mang năng lượng cảm xúc trong phân đoạn.</li>
                            <li><span className="font-semibold text-[var(--text-primary)]">Dominant Emotion (Cảm xúc chủ trị):</span> Phân loại các trạng thái Joy (Hạnh phúc), Sadness (U sầu), Anger (Giận dữ), Fear (Sợ hãi) để phát hiện mạch chuyển cảm xúc.</li>
                        </ul>
                    </div>
                </div>
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
