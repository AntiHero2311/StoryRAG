import { useState, useEffect } from 'react';
import { classifyColor } from './helpers';

interface DonutChartProps {
    score: number;
    classification: string;
}

export default function DonutChart({ score, classification }: DonutChartProps) {
    const clr = classifyColor(classification);
    const size = 160;
    const strokeWidth = 14;
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = Math.min(score / 100, 1);

    const [animated, setAnimated] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 80);
        return () => clearTimeout(t);
    }, [score]);

    const dashOffset = animated ? circumference * (1 - pct) : circumference;
    const gradId = `donut-grad-${classification.replace(/\s/g, '')}`;

    return (
        <div className="flex flex-col items-center gap-3">
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={clr.gradient[0]} />
                        <stop offset="100%" stopColor={clr.gradient[1]} />
                    </linearGradient>
                </defs>
                {/* Track */}
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke="var(--bg-hover)" strokeWidth={strokeWidth} />
                {/* Progress */}
                <circle cx={size / 2} cy={size / 2} r={r}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
                />
            </svg>
            {/* Center label — overlaid */}
            <div className="relative" style={{ marginTop: -(size + 8) }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ width: size, height: size }}>
                    <span className="text-3xl font-black text-[var(--text-primary)] leading-none">{score.toFixed(0)}</span>
                    <span className="text-[var(--text-secondary)] text-xs mt-0.5">/ 100 điểm</span>
                </div>
                <div style={{ width: size, height: size }} />
            </div>
            {/* Badge */}
            <div className="px-4 py-1 rounded-full text-xs font-bold"
                style={{ background: clr.bg, border: `1px solid ${clr.border}`, color: clr.text }}>
                {classification}
            </div>
        </div>
    );
}
