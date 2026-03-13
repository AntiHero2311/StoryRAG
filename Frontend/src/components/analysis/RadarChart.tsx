import { useState, useEffect } from 'react';
import { groupColor } from './helpers';
import type { ProjectReportResponse } from '../../services/reportService';

interface RadarChartProps {
    groups: ProjectReportResponse['groups'];
}

export default function RadarChart({ groups }: RadarChartProps) {
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 80;
    const labelR = maxR + 26;
    const n = groups.length;
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 150);
        return () => clearTimeout(t);
    }, [groups]);

    const angleOf = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;

    const bgPoints = Array.from({ length: n }, (_, i) => {
        const a = angleOf(i);
        return `${cx + maxR * Math.cos(a)},${cy + maxR * Math.sin(a)}`;
    }).join(' ');

    const scorePoints = groups.map((g, i) => {
        const pct = animated ? g.score / g.maxScore : 0;
        const a = angleOf(i);
        const r = maxR * pct;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');

    const ticks = [0.25, 0.5, 0.75, 1];
    const vbPad = 28;
    const vbW = size + vbPad * 2;
    const vbH = size + vbPad * 2;

    return (
        <div className="flex flex-col items-center gap-2">
            <svg width={vbW} height={vbH} viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`}>
                {/* Tick rings */}
                {ticks.map(t => (
                    <polygon key={t}
                        points={Array.from({ length: n }, (_, i) => {
                            const a = angleOf(i);
                            const r = maxR * t;
                            return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
                        }).join(' ')}
                        fill="none" stroke="var(--border-color)" strokeWidth="1" opacity="0.6"
                    />
                ))}
                {/* Axis lines */}
                {Array.from({ length: n }, (_, i) => {
                    const a = angleOf(i);
                    return (
                        <line key={i}
                            x1={cx} y1={cy}
                            x2={cx + maxR * Math.cos(a)}
                            y2={cy + maxR * Math.sin(a)}
                            stroke="var(--border-color)" strokeWidth="1" opacity="0.5"
                        />
                    );
                })}
                {/* Background polygon */}
                <polygon points={bgPoints} fill="var(--bg-hover)" stroke="var(--border-color)" strokeWidth="1" opacity="0.4" />
                {/* Score polygon */}
                <polygon points={scorePoints}
                    fill="rgba(245,166,35,0.18)"
                    stroke="#f5a623"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    style={{ transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1)' }}
                />
                {/* Score dots */}
                {groups.map((g, i) => {
                    const pct = animated ? g.score / g.maxScore : 0;
                    const a = angleOf(i);
                    const r = maxR * pct;
                    return (
                        <circle key={i}
                            cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)}
                            r={4} fill={groupColor(i)} stroke="var(--bg-surface)" strokeWidth="2"
                            style={{ transition: `cx 0.9s, cy 0.9s` }}
                        />
                    );
                })}
                {/* Labels */}
                {groups.map((g, i) => {
                    const a = angleOf(i);
                    const lx = cx + labelR * Math.cos(a);
                    const ly = cy + labelR * Math.sin(a);
                    const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
                    const words = g.name.split(' ').slice(0, 2);
                    return (
                        <text key={i} textAnchor={anchor} fontSize="9.5" fontWeight="600" fill="var(--text-secondary)">
                            {words.map((w, wi) => (
                                <tspan key={wi} x={lx} dy={wi === 0 ? ly + 4 : '1.2em'}>{w}</tspan>
                            ))}
                        </text>
                    );
                })}
            </svg>
            <p className="text-[var(--text-secondary)] text-xs text-center">So sánh 8 nhóm</p>
        </div>
    );
}
