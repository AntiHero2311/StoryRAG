import { useState, useEffect, useRef } from 'react';

interface ScoreBarProps {
    score: number;
    max: number;
    color: string;
    delay?: number;
}

export default function ScoreBar({ score, max, color, delay = 0 }: ScoreBarProps) {
    const pct = Math.round((score / max) * 100);
    const [animated, setAnimated] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), delay);
        return () => clearTimeout(t);
    }, [score, delay]);

    return (
        <div ref={ref} className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div className="h-full rounded-full"
                style={{
                    width: animated ? `${pct}%` : '0%',
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    transition: `width 0.7s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
                }} />
        </div>
    );
}
