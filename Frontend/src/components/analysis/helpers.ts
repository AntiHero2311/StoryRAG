export function classifyColor(cls: string) {
    switch (cls) {
        case 'Xuất sắc': return { text: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', gradient: ['#10b981', '#34d399'] };
        case 'Khá': return { text: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', gradient: ['#0ea5e9', '#38bdf8'] };
        case 'Trung bình': return { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', gradient: ['#f59e0b', '#fbbf24'] };
        default: return { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', gradient: ['#ef4444', '#f87171'] };
    }
}

export function groupColor(idx: number) {
    const palette = ['#f5a623', '#10b981', '#0ea5e9', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f59e0b'];
    return palette[idx % palette.length];
}
