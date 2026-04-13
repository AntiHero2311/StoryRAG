import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, BrainCircuit, Loader2, AlertCircle, CheckCircle2, Sparkles, Clock, CreditCard } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';
import { projectService, ProjectResponse } from '../services/projectService';
import { reportService, ProjectAnalysisJobResponse, ProjectReportResponse, ProjectReportSummary } from '../services/reportService';
import { subscriptionService, UserSubscription } from '../services/subscriptionService';
import { classifyColor, groupColor } from '../components/analysis/helpers';
import DonutChart from '../components/analysis/DonutChart';
import RadarChart from '../components/analysis/RadarChart';
import GroupCard from '../components/analysis/GroupCard';

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
    const [analysisJob, setAnalysisJob] = useState<ProjectAnalysisJobResponse | null>(null);
    const [cancelingJob, setCancelingJob] = useState(false);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    // Load projects + subscription
    useEffect(() => {
        projectService.getProjects()
            .then(data => { setProjects(data); if (data.length > 0) setSelectedId(data[0].id); })
            .catch(() => setError('Không thể tải danh sách dự án.'))
            .finally(() => setLoadingProjects(false));
        subscriptionService.getMySubscription().then(setSubscription).catch(() => { });
    }, []);

    useEffect(() => () => {
        mountedRef.current = false;
        if (elapsedRef.current) {
            clearInterval(elapsedRef.current);
            elapsedRef.current = null;
        }
    }, []);

    // Load latest report + history when project changes
    useEffect(() => {
        if (!selectedId) return;
        setReport(null);
        setHistory([]);
        setError(null);
        setAnalysisJob(null);
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

    const pollAnalyzeJob = async (projectId: string, jobId: string) => {
        while (true) {
            const job = await reportService.getAnalyzeJob(projectId, jobId);
            if (!mountedRef.current) return null;

            setAnalysisJob(job);

            if (job.status === 'Completed') {
                const result = await reportService.getAnalyzeJobResult(projectId, jobId);
                return result;
            }

            if (job.status === 'Failed' || job.status === 'Cancelled') {
                throw new Error(job.errorMessage || (job.status === 'Cancelled'
                    ? 'Job phân tích đã bị hủy.'
                    : 'Phân tích thất bại. Vui lòng thử lại.'));
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    };

    const handleAnalyze = async () => {
        if (!selectedId) return;
        setAnalyzing(true);
        setElapsed(0);
        setError(null);
        setAnalysisJob(null);
        elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        try {
            const job = await reportService.enqueueAnalyzeJob(selectedId);
            if (!mountedRef.current) return;

            setAnalysisJob(job);
            const result = await pollAnalyzeJob(selectedId, job.jobId);
            if (!result || !mountedRef.current) return;

            setReport(result);
            setActiveReportId(result.id);
            const all = await reportService.getAll(selectedId).catch(() => []);
            setHistory(all);
            setExpandedGroups({});
            // Refresh subscription usage
            subscriptionService.getMySubscription().then(setSubscription).catch(() => { });
        } catch (e: any) {
            const message = e?.response?.data?.message || e?.message || 'Phân tích thất bại. Vui lòng thử lại.';
            setError(message === 'Job phân tích đã bị hủy.' ? null : message);
        } finally {
            if (!mountedRef.current) return;
            setAnalyzing(false);
            setCancelingJob(false);
            if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
        }
    };

    const handleCancelAnalyzeJob = async () => {
        if (!selectedId || !analysisJob || analysisJob.status !== 'Queued' || cancelingJob) return;
        setCancelingJob(true);
        setError(null);
        try {
            const cancelledJob = await reportService.cancelAnalyzeJob(selectedId, analysisJob.jobId);
            setAnalysisJob(cancelledJob);
            setError(null);
            setAnalyzing(false);
            if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Không thể hủy job phân tích lúc này.');
        } finally {
            setCancelingJob(false);
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
    const stageLabelMap: Record<ProjectAnalysisJobResponse['stage'], string> = {
        Queued: 'Đang xếp hàng',
        Preparing: 'Chuẩn bị dữ liệu',
        Analyzing: 'Đang phân tích bằng AI',
        Saving: 'Đang lưu kết quả',
        Completed: 'Hoàn thành',
        Failed: 'Thất bại',
        Cancelled: 'Đã hủy',
    };
    const currentStageLabel = analysisJob ? stageLabelMap[analysisJob.stage] : 'Đang khởi tạo';
    const progressValue = Math.min(100, Math.max(analysisJob?.progress ?? 10, 8));

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
                                    disabled={analyzing}
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
                                        <p className="text-[var(--text-primary)] font-semibold text-sm">
                                            {analysisJob?.isExistingJob
                                                ? 'Đang tiếp tục job phân tích hiện có...'
                                                : 'AI đang xử lý job phân tích dự án...'}
                                        </p>
                                        <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                                            Giai đoạn: <span className="text-amber-400 font-semibold">{currentStageLabel}</span>
                                            {' · '}
                                            Đã chờ: <span className="text-amber-400 font-semibold">{elapsed}s</span>
                                        </p>
                                    </div>
                                    {analysisJob?.status === 'Queued' && (
                                        <button
                                            onClick={handleCancelAnalyzeJob}
                                            disabled={cancelingJob}
                                            className="h-8 px-3 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-60"
                                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                            {cancelingJob ? 'Đang hủy...' : 'Hủy hàng chờ'}
                                        </button>
                                    )}
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ background: 'linear-gradient(90deg,#f5a623,#f97316)', width: `${progressValue}%` }} />
                                </div>
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

                                {/* Overall Feedback & Warnings */}
                                {(report.overallFeedback || (report.warnings && report.warnings.length > 0)) && (
                                    <div className="rounded-2xl mb-5 p-6"
                                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                        
                                        {/* Nhận xét tổng quan */}
                                        {report.overallFeedback && (
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                                    <h3 className="text-[var(--text-primary)] font-bold text-lg">Nhận xét tổng quan</h3>
                                                </div>
                                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-line">
                                                    {report.overallFeedback}
                                                </p>
                                            </div>
                                        )}

                                        {/* Cảnh báo đặc biệt */}
                                        {report.warnings && report.warnings.length > 0 && (
                                            <div className={`flex flex-col gap-3 ${report.overallFeedback ? 'mt-5 pt-5' : ''}`} 
                                                style={report.overallFeedback ? { borderTop: '1px solid var(--border-color)' } : {}}>
                                                {report.warnings.map(w => (
                                                    <div key={w.code} className="flex gap-3 p-4 rounded-xl"
                                                        style={{
                                                            background: w.severity === 'CRITICAL' ? 'rgba(239,68,68,0.08)' : 'rgba(245,166,35,0.08)',
                                                            border: `1px solid ${w.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(245,166,35,0.2)'}`
                                                        }}>
                                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"
                                                            style={{ color: w.severity === 'CRITICAL' ? '#ef4444' : '#f5a623' }} />
                                                        <div>
                                                            <p className="font-bold text-sm mb-1"
                                                                style={{ color: w.severity === 'CRITICAL' ? '#ef4444' : '#f5a623' }}>
                                                                {w.title}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)] text-xs leading-relaxed whitespace-pre-line">
                                                                {w.detail}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

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
