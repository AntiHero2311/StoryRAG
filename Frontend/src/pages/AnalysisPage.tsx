import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, BrainCircuit, ChevronDown, Loader2, AlertCircle, CheckCircle2, Sparkles, Clock, CreditCard } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';
import { projectService, ProjectResponse } from '../services/projectService';
import { reportService, ProjectReportResponse, ProjectReportSummary } from '../services/reportService';
import { subscriptionService, UserSubscription } from '../services/subscriptionService';

// ─── Score helpers ────────────────────────────────────────────────────────────
function classifyColor(cls: string) {
    switch (cls) {
        case 'Xuất sắc': return { text: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', gradient: ['#10b981', '#34d399'] };
        case 'Khá': return { text: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', gradient: ['#0ea5e9', '#38bdf8'] };
        case 'Trung bình': return { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', gradient: ['#f59e0b', '#fbbf24'] };
        default: return { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', gradient: ['#ef4444', '#f87171'] };
    }
}

function groupColor(idx: number) {
    const palette = ['#f5a623', '#10b981', '#0ea5e9', '#ec4899', '#8b5cf6'];
    return palette[idx % palette.length];
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ score, classification }: { score: number; classification: string }) {
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

// ─── SVG Radar Chart ──────────────────────────────────────────────────────────
function RadarChart({ groups }: { groups: ProjectReportResponse['groups'] }) {
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
            <p className="text-[var(--text-secondary)] text-xs text-center">So sánh 5 nhóm</p>
        </div>
    );
}

// ─── Animated Score Bar ───────────────────────────────────────────────────────
function ScoreBar({ score, max, color, delay = 0 }: { score: number; max: number; color: string; delay?: number }) {
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

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, idx, expanded, onToggle }: {
    group: ProjectReportResponse['groups'][0];
    idx: number;
    expanded: boolean;
    onToggle: () => void;
}) {
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

                                    {/* Feedback — general assessment */}
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

// ─── Main content ─────────────────────────────────────────────────────────────
function AnalysisContent() {
    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [report, setReport] = useState<ProjectReportResponse | null>(null);
    const [history, setHistory] = useState<ProjectReportSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [loadingHistoryReport, setLoadingHistoryReport] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const [elapsed, setElapsed] = useState(0);
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load projects + subscription
    useEffect(() => {
        projectService.getProjects()
            .then(data => { setProjects(data); if (data.length > 0) setSelectedId(data[0].id); })
            .catch(() => setError('Không thể tải danh sách dự án.'))
            .finally(() => setLoadingProjects(false));
        subscriptionService.getMySubscription().then(setSubscription).catch(() => {});
    }, []);

    // Load latest report + history when project changes
    useEffect(() => {
        if (!selectedId) return;
        setReport(null);
        setHistory([]);
        setError(null);
        setActiveReportId(null);
        setLoadingReport(true);
        Promise.all([
            reportService.getLatest(selectedId).catch(() => null),
            reportService.getAll(selectedId).catch(() => []),
        ]).then(([latest, all]) => {
            setReport(latest);
            setActiveReportId(latest?.id ?? null);
            setHistory(all);
        }).finally(() => setLoadingReport(false));
    }, [selectedId]);

    const handleAnalyze = async () => {
        if (!selectedId) return;
        setAnalyzing(true);
        setElapsed(0);
        setError(null);
        elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        try {
            const result = await reportService.analyze(selectedId);
            setReport(result);
            setActiveReportId(result.id);
            const all = await reportService.getAll(selectedId).catch(() => []);
            setHistory(all);
            setExpandedGroups({});
            // Refresh subscription usage
            subscriptionService.getMySubscription().then(setSubscription).catch(() => {});
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Phân tích thất bại. Vui lòng thử lại.');
        } finally {
            setAnalyzing(false);
            if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
        }
    };

    const handleLoadHistory = async (h: ProjectReportSummary) => {
        if (h.id === activeReportId || loadingHistoryReport) return;
        setLoadingHistoryReport(h.id);
        setError(null);
        try {
            const full = await reportService.getById(selectedId, h.id);
            if (full) {
                setReport(full);
                setActiveReportId(full.id);
                setExpandedGroups({});
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch {
            setError('Không thể tải báo cáo này.');
        } finally {
            setLoadingHistoryReport(null);
        }
    };

    const toggleGroup = (idx: number) =>
        setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));

    const classColors = report ? classifyColor(report.classification) : null;

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                        <BarChart2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-[var(--text-primary)] font-black text-2xl">Phân tích AI</h1>
                        <p className="text-[var(--text-secondary)] text-sm">Đánh giá bản thảo theo rubric 100 điểm</p>
                    </div>
                </div>

                {/* Project selector + Analyze button */}
                <div className="rounded-2xl p-5 mb-6 flex flex-col gap-4"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1.5 uppercase tracking-wider">
                                Chọn dự án
                            </label>
                            {loadingProjects ? (
                                <div className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                            ) : (
                                <select
                                    value={selectedId}
                                    onChange={e => setSelectedId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl text-sm text-[var(--text-primary)] outline-none"
                                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                                    {projects.length === 0 && <option value="">— Chưa có dự án —</option>}
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button
                            onClick={handleAnalyze}
                            disabled={!selectedId || analyzing || loadingProjects}
                            className="h-10 px-6 rounded-xl font-semibold text-sm text-white flex items-center gap-2 shrink-0 transition-opacity disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                            {analyzing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...</>
                            ) : (
                                <><Sparkles className="w-4 h-4" /> Phân tích ngay</>
                            )}
                        </button>
                    </div>
                    {/* Subscription usage bar */}
                    {subscription && (
                        <div className="pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>{subscription.planName}</span>
                                </div>
                                <span className="text-xs font-semibold" style={{
                                    color: subscription.usedAnalysisCount >= subscription.maxAnalysisCount ? '#ef4444' : '#f5a623'
                                }}>
                                    {subscription.usedAnalysisCount} / {subscription.maxAnalysisCount} lần phân tích
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${Math.min((subscription.usedAnalysisCount / subscription.maxAnalysisCount) * 100, 100)}%`,
                                        background: subscription.usedAnalysisCount >= subscription.maxAnalysisCount
                                            ? 'linear-gradient(90deg,#ef4444,#f87171)'
                                            : 'linear-gradient(90deg,#f5a623,#f97316)',
                                    }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Two-column layout: main content + history sidebar */}
                <div className="flex flex-col xl:flex-row gap-6 items-start">

                    {/* ── Left: main report area ── */}
                    <div className="flex-1 min-w-0">

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl mb-5 text-sm"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Analyzing progress */}
                        {analyzing && (
                            <div className="rounded-2xl p-5 mb-5 overflow-hidden"
                                style={{ background: 'var(--bg-surface)', border: '1px solid rgba(245,166,35,0.3)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: 'rgba(245,166,35,0.12)' }}>
                                        <BrainCircuit className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[var(--text-primary)] font-semibold text-sm">AI đang phân tích toàn bộ dự án...</p>
                                        <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                                            Có thể mất vài phút · Đã chờ: <span className="text-amber-400 font-semibold">{elapsed}s</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                                    <div className="h-full rounded-full animate-[analyzing_1.8s_ease-in-out_infinite]"
                                        style={{ background: 'linear-gradient(90deg,transparent,#f5a623,transparent)', width: '40%' }} />
                                </div>
                                <style>{`@keyframes analyzing{0%{transform:translateX(-120%)}100%{transform:translateX(350%)}}`}</style>
                            </div>
                        )}

                        {/* Loading skeleton */}
                        {loadingReport && !report && (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
                                ))}
                            </div>
                        )}

                        {/* Report result */}
                        {report && (
                            <>
                                {/* Project title + MockData warning */}
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: classColors!.text }} />
                                    <span className="text-[var(--text-primary)] font-bold text-base truncate">{report.projectTitle}</span>
                                    {report.status === 'MockData' && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ml-auto shrink-0"
                                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                            <AlertCircle className="w-3 h-3" /> Dữ liệu mẫu
                                        </div>
                                    )}
                                </div>

                                {/* Score Hero — 2 columns */}
                                <div className="rounded-2xl mb-5 overflow-hidden"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
                                        {/* Left: Donut */}
                                        <div className="flex flex-col items-center justify-center p-8 gap-1">
                                            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
                                                Tổng điểm
                                            </p>
                                            <DonutChart score={report.totalScore} classification={report.classification} />
                                        </div>
                                        {/* Right: Radar */}
                                        <div className="flex flex-col items-center justify-center p-6">
                                            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">
                                                Phân bố điểm
                                            </p>
                                            <RadarChart groups={report.groups} />
                                            {/* Mini legend */}
                                            <div className="flex flex-col gap-1.5 w-full max-w-[200px] mt-2">
                                                {report.groups.map((g, i) => (
                                                    <div key={g.name} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: groupColor(i) }} />
                                                        <span className="text-[var(--text-secondary)] text-xs truncate flex-1">{g.name}</span>
                                                        <span className="text-[var(--text-primary)] text-xs font-bold shrink-0">
                                                            {g.score.toFixed(0)}<span className="text-[var(--text-secondary)] font-normal">/{g.maxScore}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Group breakdown */}
                                <div className="space-y-3">
                                    {report.groups.map((g, i) => (
                                        <GroupCard key={g.name} group={g} idx={i}
                                            expanded={!!expandedGroups[i]}
                                            onToggle={() => toggleGroup(i)} />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Empty state */}
                        {!loadingReport && !report && !error && selectedId && (
                            <div className="rounded-2xl p-10 text-center"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                    style={{ background: 'rgba(245,166,35,0.08)' }}>
                                    <BrainCircuit className="w-8 h-8" style={{ color: '#f5a623' }} />
                                </div>
                                <p className="text-[var(--text-primary)] font-semibold mb-2">Chưa có báo cáo</p>
                                <p className="text-[var(--text-secondary)] text-sm mb-5">
                                    Nhấn <strong>Phân tích ngay</strong> để AI đánh giá bản thảo theo rubric 100 điểm.
                                </p>
                                <p className="text-[var(--text-secondary)] text-xs">
                                    💡 Hãy chunk và embed các chương trong Workspace trước để kết quả chính xác hơn.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Right: history sidebar ── */}
                    {history.length > 0 && (
                        <div className="w-full xl:w-72 xl:sticky xl:top-6 shrink-0">
                            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
                                    <span className="text-[var(--text-primary)] font-semibold text-sm">Lịch sử phân tích</span>
                                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                                        style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                                        {history.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-[var(--border-color)] max-h-[600px] overflow-y-auto">
                                    {history.map(h => {
                                        const c = classifyColor(h.classification);
                                        const isActive = h.id === activeReportId;
                                        const isLoading = loadingHistoryReport === h.id;
                                        return (
                                            <button key={h.id} onClick={() => handleLoadHistory(h)}
                                                className="w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors"
                                                style={{
                                                    background: isActive ? 'rgba(245,166,35,0.06)' : undefined,
                                                    borderLeft: isActive ? '3px solid #f5a623' : '3px solid transparent',
                                                    cursor: isActive ? 'default' : 'pointer',
                                                }}>
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                                                    style={{ background: c.bg, color: c.text }}>
                                                    {isLoading
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : h.totalScore.toFixed(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[var(--text-primary)] font-medium text-sm">
                                                            {h.totalScore.toFixed(1)} điểm
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                            style={{ background: c.bg, color: c.text }}>
                                                            {h.classification}
                                                        </span>
                                                        {isActive && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                                style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>
                                                                Đang xem
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                                                        {new Date(h.createdAt).toLocaleString('vi-VN')}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default function AnalysisPage() {
    const navigate = useNavigate();
    return (
        <MainLayout pageTitle="Phân tích AI">
            {(userInfo: UserInfo) => {
                if (userInfo.role === 'Admin') {
                    setTimeout(() => navigate('/home'), 0);
                    return null;
                }
                return <AnalysisContent />;
            }}
        </MainLayout>
    );
}


