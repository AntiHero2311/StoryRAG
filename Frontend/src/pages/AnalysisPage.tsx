import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, BrainCircuit, Loader2, AlertCircle, CheckCircle2, Sparkles, Clock, CreditCard, Download, ChevronDown, Check } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';
import { projectService, ProjectResponse } from '../services/projectService';
import { reportService, type ProjectAnalysisJobResponse, type ProjectReportResponse, type ProjectReportSummary, type NarrativeChartsResponse } from '../services/reportService';
import { subscriptionService, UserSubscription } from '../services/subscriptionService';
import { chapterService, type ChapterResponse } from '../services/chapterService';
import { classifyColor, groupColor } from '../components/analysis/helpers';
import DonutChart from '../components/analysis/DonutChart';
import RadarChart from '../components/analysis/RadarChart';
import GroupCard from '../components/analysis/GroupCard';
import NarrativeChartsPanel from '../components/analysis/NarrativeChartsPanel';
import { useToast } from '../components/Toast';
import { browserNotificationService } from '../services/browserNotificationService';
import { appNotificationService } from '../services/appNotificationService';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const ANALYSIS_SELECTED_PROJECT_KEY = 'analysis:selectedProjectId';

// ─── Main content ─────────────────────────────────────────────────────────────
function AnalysisContent() {
    const [projects, setProjects] = useState<ProjectResponse[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [projectPickerOpen, setProjectPickerOpen] = useState(false);
    const [projectQuery, setProjectQuery] = useState('');
    const [report, setReport] = useState<ProjectReportResponse | null>(null);
    const [history, setHistory] = useState<ProjectReportSummary[]>([]);
    const [projectChapters, setProjectChapters] = useState<ChapterResponse[]>([]);
    const [chartChapterFilter, setChartChapterFilter] = useState<string>('all');
    const [narrativeCharts, setNarrativeCharts] = useState<NarrativeChartsResponse | null>(null);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [loadingNarrativeCharts, setLoadingNarrativeCharts] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [loadingHistoryReport, setLoadingHistoryReport] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const [activeTab, setActiveTab] = useState<'overall' | 'charts'>('overall');
    const [elapsed, setElapsed] = useState(0);
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [analysisJob, setAnalysisJob] = useState<ProjectAnalysisJobResponse | null>(null);
    const [analysisStatus, setAnalysisStatus] = useState<{ type: 'info' | 'success'; message: string } | null>(null);
    const [cancelingJob, setCancelingJob] = useState(false);
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [showAnalyzeConfirm, setShowAnalyzeConfirm] = useState(false);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const pollingJobRef = useRef<string | null>(null);
    const notifiedJobRef = useRef<string | null>(null);
    const interactiveJobRef = useRef<string | null>(null);
    const processingAnnouncedRef = useRef<string | null>(null);
    const projectPickerRef = useRef<HTMLDivElement | null>(null);
    const toast = useToast();
    const getApiErrorMessage = (err: any, fallback: string) =>
        err?.response?.data?.message
        || err?.response?.data?.Message
        || err?.message
        || fallback;

    const stopElapsedTimer = () => {
        if (elapsedRef.current) {
            clearInterval(elapsedRef.current);
            elapsedRef.current = null;
        }
    };

    const startElapsedTimer = (startedAt?: string | null) => {
        stopElapsedTimer();
        const baseElapsed = startedAt
            ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
            : 0;
        setElapsed(baseElapsed);
        elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    };

    // Load projects + subscription
    useEffect(() => {
        projectService.getProjects()
            .then(data => {
                setProjects(data);
                const savedProjectId = localStorage.getItem(ANALYSIS_SELECTED_PROJECT_KEY);
                const initialProjectId = savedProjectId && data.some(p => p.id === savedProjectId)
                    ? savedProjectId
                    : (data[0]?.id ?? '');
                setSelectedId(initialProjectId);
            })
            .catch(() => setError('Không thể tải danh sách dự án.'))
            .finally(() => setLoadingProjects(false));
        subscriptionService.getMySubscription().then(setSubscription).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        localStorage.setItem(ANALYSIS_SELECTED_PROJECT_KEY, selectedId);
    }, [selectedId]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            if (!projectPickerRef.current) return;
            if (!projectPickerRef.current.contains(event.target as Node)) {
                setProjectPickerOpen(false);
                setProjectQuery('');
            }
        };

        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, []);

    useEffect(() => () => {
        mountedRef.current = false;
        stopElapsedTimer();
    }, []);

    const loadNarrativeCharts = async (projectId: string, chapterId?: string) => {
        setLoadingNarrativeCharts(true);
        try {
            const charts = await reportService.getNarrativeCharts(projectId, chapterId);
            if (!mountedRef.current) return;
            setNarrativeCharts(charts);
        } catch {
            if (!mountedRef.current) return;
            setNarrativeCharts(null);
        } finally {
            if (mountedRef.current) setLoadingNarrativeCharts(false);
        }
    };

    // Load latest report + history when project changes
    useEffect(() => {
        if (!selectedId) return;
        let cancelled = false;

        setReport(null);
        setHistory([]);
        setProjectChapters([]);
        setChartChapterFilter('all');
        setNarrativeCharts(null);
        setError(null);
        setAnalysisJob(null);
        setAnalysisStatus(null);
        setActiveReportId(null);
        setLoadingReport(true);
        interactiveJobRef.current = null;
        processingAnnouncedRef.current = null;

        const projectId = selectedId;

        void chapterService.getChapters(projectId)
            .then(chapters => {
                if (!mountedRef.current || cancelled) return;
                setProjectChapters(chapters);
            })
            .catch(() => {
                if (!mountedRef.current || cancelled) return;
                setProjectChapters([]);
            });

        const loadProjectAnalysis = async () => {
            const [latestResult, allResult, activeJobResult, latestJobResult, globalActiveJobResult] = await Promise.allSettled([
                reportService.getLatest(projectId),
                reportService.getAll(projectId),
                reportService.getActiveAnalyzeJob(projectId),
                reportService.getLatestAnalyzeJob(projectId),
                reportService.getActiveAnalyzeJob(),
            ]);

            if (!mountedRef.current || cancelled) return;

            const latest = latestResult.status === 'fulfilled' ? latestResult.value : null;
            const all = allResult.status === 'fulfilled' ? allResult.value : [];
            const activeJob = activeJobResult.status === 'fulfilled' ? activeJobResult.value : null;
            const latestJob = latestJobResult.status === 'fulfilled' ? latestJobResult.value : null;
            const globalActiveJob = globalActiveJobResult.status === 'fulfilled' ? globalActiveJobResult.value : null;
            const resumableSelectedJob = activeJob
                ?? (globalActiveJob?.projectId === projectId ? globalActiveJob : null);

            if (!resumableSelectedJob
                && globalActiveJob
                && (globalActiveJob.status === 'Queued' || globalActiveJob.status === 'Processing')
                && globalActiveJob.projectId !== projectId) {
                setAnalysisStatus({
                    type: 'info',
                    message: 'Đã phát hiện job đang chạy ở dự án khác. Đang chuyển về đúng dự án để khôi phục tiến trình...',
                });
                setSelectedId(globalActiveJob.projectId);
                return;
            }

            const reportReadFailed =
                latestResult.status === 'rejected' &&
                allResult.status === 'rejected';
            if (reportReadFailed) {
                const firstError = latestResult.reason ?? allResult.reason;
                setError(getApiErrorMessage(firstError, 'Không thể tải dữ liệu phân tích. Vui lòng tải lại trang.'));
            }

            let effectiveLatest = latest;
            let effectiveHistory = mergeHistory(all, latest);

            if (!effectiveLatest && effectiveHistory.length === 0 && latestJob?.reportId) {
                const recoveredByReportId = await reportService
                    .getById(projectId, latestJob.reportId)
                    .catch(() => null);
                if (recoveredByReportId && mountedRef.current && !cancelled) {
                    effectiveLatest = recoveredByReportId;
                    effectiveHistory = mergeHistory(all, recoveredByReportId);
                }
            }

            // Recovery path: report/job đã hoàn tất nhưng endpoint lịch sử/latest chưa đồng bộ kịp.
            if (!effectiveLatest && effectiveHistory.length === 0 && latestJob?.status === 'Completed') {
                const recovered = await reportService
                    .getAnalyzeJobResult(projectId, latestJob.jobId)
                    .catch(() => null);
                if (recovered && mountedRef.current && !cancelled) {
                    effectiveLatest = recovered;
                    effectiveHistory = mergeHistory(all, recovered);
                }
            }

            // Fallback path: latest endpoint lỗi/đồng bộ chậm nhưng danh sách lịch sử đã có.
            if (!effectiveLatest && effectiveHistory.length > 0) {
                const newestFromHistory = await reportService
                    .getById(projectId, effectiveHistory[0].id)
                    .catch(() => null);
                if (newestFromHistory && mountedRef.current && !cancelled) {
                    effectiveLatest = newestFromHistory;
                    effectiveHistory = mergeHistory(all, newestFromHistory);
                }
            }

            setReport(effectiveLatest);
            setActiveReportId(effectiveLatest?.id ?? null);
            setHistory(effectiveHistory);

            if (resumableSelectedJob && (resumableSelectedJob.status === 'Queued' || resumableSelectedJob.status === 'Processing')) {
                void runAnalyzeFlow(resumableSelectedJob.projectId, resumableSelectedJob);
            } else {
                setAnalyzing(false);
                setAnalysisJob(null);
                stopElapsedTimer();

                if (!effectiveLatest && latestJob?.status === 'Failed' && latestJob.errorMessage) {
                    setError(latestJob.errorMessage);
                }
            }
        };

        loadProjectAnalysis().finally(() => {
            if (!cancelled && mountedRef.current) setLoadingReport(false);
        });

        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    useEffect(() => {
        if (!selectedId) return;
        const chapterId = chartChapterFilter === 'all' ? undefined : chartChapterFilter;
        void loadNarrativeCharts(selectedId, chapterId);
    }, [selectedId, chartChapterFilter]);

    const pollAnalyzeJob = async (projectId: string, jobId: string) => {
        while (true) {
            const job = await reportService.getAnalyzeJob(projectId, jobId);
            if (!mountedRef.current) return null;

            setAnalysisJob(job);

            if (job.status === 'Queued' || job.stage === 'Queued' || job.stage === 'Preparing') {
                setAnalysisStatus({ type: 'info', message: 'AI đã nhận được request. Job đang chờ xử lý...' });
            } else if (job.status === 'Processing' || job.stage === 'Analyzing' || job.stage === 'Saving') {
                setAnalysisStatus({ type: 'info', message: 'AI đang phân tích nội dung dự án...' });
                if (interactiveJobRef.current === jobId && processingAnnouncedRef.current !== jobId) {
                    processingAnnouncedRef.current = jobId;
                    toast.info('AI đang phân tích nội dung dự án...');
                }
            }

            if (job.status === 'Completed') {
                let lastResultError: any = null;
                for (let attempt = 1; attempt <= 5; attempt++) {
                    try {
                        const result = await reportService.getAnalyzeJobResult(projectId, jobId);
                        return result;
                    } catch (err: any) {
                        lastResultError = err;
                        const status = err?.response?.status;
                        if (status !== 404 && status !== 409) throw err;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
                throw lastResultError ?? new Error('Không thể tải kết quả job phân tích đã hoàn thành.');
            }

            if (job.status === 'Failed' || job.status === 'Cancelled') {
                throw new Error(job.errorMessage || (job.status === 'Cancelled'
                    ? 'Job phân tích đã bị hủy.'
                    : 'Phân tích thất bại. Vui lòng thử lại.'));
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    };

    const runAnalyzeFlow = async (projectId: string, job: ProjectAnalysisJobResponse) => {
        if (pollingJobRef.current === job.jobId) return;

        pollingJobRef.current = job.jobId;
        setAnalyzing(true);
        setAnalysisJob(job);
        setError(null);
        setAnalysisStatus({
            type: 'info',
            message: job.isExistingJob
                ? 'AI đã nhận được request trước đó. Đang tiếp tục job phân tích...'
                : 'AI đã nhận được request. Đang khởi tạo job phân tích. Vui lòng chờ trong ít phút...',
        });
        startElapsedTimer(job.startedAt ?? job.createdAt);

        try {
            const result = await pollAnalyzeJob(projectId, job.jobId);
            if (!result || !mountedRef.current) return;

            setReport(result);
            setActiveReportId(result.id);
            const all = await reportService.getAll(projectId).catch(() => []);
            setHistory(mergeHistory(all, result));
            setExpandedGroups({});
            const chapterId = chartChapterFilter === 'all' ? undefined : chartChapterFilter;
            await loadNarrativeCharts(projectId, chapterId);
            subscriptionService.getMySubscription().then(setSubscription).catch(() => { });
            setAnalysisStatus({ type: 'success', message: 'AI đã phân tích xong. Kết quả đã sẵn sàng bên dưới.' });

            if (notifiedJobRef.current !== job.jobId) {
                notifiedJobRef.current = job.jobId;
                toast.success(`Phân tích hoàn tất: ${result.totalScore.toFixed(1)} điểm (${result.classification}).`);
                appNotificationService.add({
                    type: 'success',
                    title: 'Phân tích AI đã hoàn tất',
                    message: `${result.projectTitle}: ${result.totalScore.toFixed(1)} điểm (${result.classification}).`,
                    tag: `analysis-complete-${job.jobId}`,
                });
                void browserNotificationService.notify(
                    'Phân tích AI đã hoàn tất',
                    `${result.projectTitle}: ${result.totalScore.toFixed(1)} điểm (${result.classification}).`,
                    `analysis-complete-${job.jobId}`
                );
            }
        } catch (e: any) {
            const message = getApiErrorMessage(e, 'Phân tích thất bại. Vui lòng thử lại.');
            const isCancelled = message === 'Job phân tích đã bị hủy.';
            setError(isCancelled ? null : message);
            setAnalysisStatus(null);

            if (isCancelled) {
                toast.warning('Job phân tích đã bị hủy.');
                appNotificationService.add({
                    type: 'warning',
                    title: 'Job phân tích đã bị hủy',
                    message: 'Yêu cầu phân tích đã được dừng trước khi hoàn tất.',
                    tag: `analysis-cancelled-${job.jobId}`,
                });
            } else {
                toast.error(message);
                appNotificationService.add({
                    type: 'error',
                    title: 'Phân tích AI thất bại',
                    message,
                    tag: `analysis-failed-${job.jobId}`,
                });
                void browserNotificationService.notify(
                    'Phân tích AI thất bại',
                    message,
                    `analysis-failed-${job.jobId}`
                );
            }
        } finally {
            if (!mountedRef.current) return;
            if (pollingJobRef.current === job.jobId) pollingJobRef.current = null;
            setAnalyzing(false);
            setCancelingJob(false);
            stopElapsedTimer();
            interactiveJobRef.current = null;
        }
    };

    const handleAnalyze = async () => {
        if (!selectedId || analyzing) return;
        setError(null);
        setAnalysisJob(null);
        setAnalyzing(true);
        setAnalysisStatus({ type: 'info', message: 'AI đã nhận được request. Đang gửi yêu cầu phân tích. Vui lòng chờ trong ít phút...' });
        startElapsedTimer();
        try {
            void browserNotificationService.ensurePermission();
            const job = await reportService.enqueueAnalyzeJob(selectedId);
            if (!mountedRef.current) return;
            interactiveJobRef.current = job.jobId;
            processingAnnouncedRef.current = null;
            toast.info('AI đã nhận được request phân tích.');
            await runAnalyzeFlow(selectedId, job);
        } catch (e: any) {
            const message = getApiErrorMessage(e, 'Phân tích thất bại. Vui lòng thử lại.');
            setError(message);
            setAnalysisStatus(null);
            toast.error(message);
            setAnalyzing(false);
            stopElapsedTimer();

            const activeJob = await reportService.getActiveAnalyzeJob(selectedId).catch(() => null)
                ?? await reportService.getActiveAnalyzeJob().catch(() => null);
            if (!activeJob || !mountedRef.current) return;

            if (activeJob.projectId !== selectedId) {
                setAnalysisStatus({
                    type: 'info',
                    message: 'Bạn đang có job phân tích ở dự án khác. Đang chuyển đến dự án đó để tiếp tục theo dõi tiến trình...',
                });
                setSelectedId(activeJob.projectId);
                return;
            }

            await runAnalyzeFlow(activeJob.projectId, activeJob);
        }
    };

    const openAnalyzeConfirm = () => {
        if (!selectedId || analyzing || loadingProjects) return;
        setShowAnalyzeConfirm(true);
    };

    const handleConfirmAnalyze = async () => {
        setShowAnalyzeConfirm(false);
        await handleAnalyze();
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
            stopElapsedTimer();
        } catch (e: any) {
            setError(getApiErrorMessage(e, 'Không thể hủy job phân tích lúc này.'));
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

    const handleExportReportPdf = async () => {
        if (!selectedId || !activeReportId || exportingPdf) return;
        if (subscription?.price === 0) {
            const message = 'Gói Free không hỗ trợ xuất PDF. Vui lòng nâng cấp để sử dụng tính năng này.';
            setError(message);
            toast.error(message);
            return;
        }
        setExportingPdf(true);
        try {
            await reportService.exportReportPdf(selectedId, activeReportId);
            toast.success('Đã xuất PDF báo cáo phân tích.');
        } catch (e: any) {
            const message = getApiErrorMessage(e, 'Không thể xuất PDF báo cáo.');
            setError(message);
            toast.error(message);
        } finally {
            setExportingPdf(false);
        }
    };

    const handleRefreshNarrativeCharts = async () => {
        if (!selectedId || loadingNarrativeCharts) return;
        const chapterId = chartChapterFilter === 'all' ? undefined : chartChapterFilter;
        await loadNarrativeCharts(selectedId, chapterId);
    };

    const toggleGroup = (idx: number) =>
        setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));

    const toSummary = (item: ProjectReportResponse): ProjectReportSummary => ({
        id: item.id,
        status: item.status,
        totalScore: item.totalScore,
        classification: item.classification,
        createdAt: item.createdAt,
    });

    const mergeHistory = (all: ProjectReportSummary[], latest?: ProjectReportResponse | null) => {
        const byId = new Map<string, ProjectReportSummary>();
        all.forEach(item => byId.set(item.id, item));
        if (latest) byId.set(latest.id, toSummary(latest));
        return Array.from(byId.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    };

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
    const selectedProject = projects.find(p => p.id === selectedId) ?? null;
    const selectedProjectTitle = selectedProject?.title ?? 'Chưa chọn dự án';
    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(projectQuery.trim().toLowerCase()));
    const usagePercent = subscription && subscription.maxAnalysisCount > 0
        ? Math.min((subscription.usedAnalysisCount / subscription.maxAnalysisCount) * 100, 100)
        : 0;
    const canExportReportPdf = subscription?.price !== 0;

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* Header */}
                <div
                    className="relative overflow-hidden rounded-3xl p-5 md:p-6 border"
                    style={{
                        borderColor: 'rgba(245,166,35,0.2)',
                        background: 'linear-gradient(145deg, rgba(245,166,35,0.08), rgba(249,115,22,0.04) 45%, var(--bg-surface) 100%)',
                    }}>
                    <div className="absolute -top-10 -right-12 w-52 h-52 rounded-full blur-3xl" style={{ background: 'rgba(245,166,35,0.15)' }} />
                    <div className="relative flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                                style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                <BarChart2 className="w-7 h-7 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-[var(--text-primary)] font-black text-2xl md:text-[30px] leading-tight">Phân tích AI</h1>
                                <p className="text-[var(--text-secondary)] text-sm">Đánh giá bản thảo theo rubric 100 điểm, theo dõi lịch sử và xuất báo cáo nhanh.</p>
                            </div>
                        </div>
                        <div className="md:ml-auto flex items-center gap-2 shrink-0">
                            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                                {history.length} report
                            </div>
                            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                                style={{
                                    background: analyzing ? 'rgba(245,166,35,0.12)' : 'rgba(34,197,94,0.12)',
                                    color: analyzing ? '#fbbf24' : '#86efac',
                                    border: analyzing ? '1px solid rgba(245,166,35,0.35)' : '1px solid rgba(34,197,94,0.35)',
                                }}>
                                {analyzing ? 'Đang chạy phân tích' : 'Sẵn sàng'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project selector + Analyze button */}
                <div className="rounded-3xl p-5 md:p-6 flex flex-col gap-4 border"
                    style={{
                        borderColor: 'rgba(255,255,255,0.08)',
                        background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01) 45%, var(--bg-surface) 100%)',
                    }}>
                    <div className="flex flex-col lg:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-2 uppercase tracking-wider">
                                Chọn dự án
                            </label>
                            {loadingProjects ? (
                                <div className="h-11 rounded-2xl animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                            ) : (
                                <div ref={projectPickerRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (analyzing) return;
                                            setProjectPickerOpen(prev => !prev);
                                        }}
                                        disabled={analyzing || projects.length === 0}
                                        className="w-full h-11 px-4 rounded-2xl text-sm flex items-center gap-3 disabled:opacity-60"
                                        style={{ background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}>
                                        <span className="flex-1 text-left truncate">
                                            {selectedProjectTitle}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${projectPickerOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {projectPickerOpen && projects.length > 0 && (
                                        <div
                                            className="absolute z-30 mt-2 w-full rounded-2xl overflow-hidden"
                                            style={{ background: 'var(--bg-dropdown)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
                                            <div className="p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                                <input
                                                    value={projectQuery}
                                                    onChange={e => setProjectQuery(e.target.value)}
                                                    placeholder="Tìm tác phẩm..."
                                                    className="w-full h-9 px-3 rounded-xl text-sm outline-none"
                                                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredProjects.length === 0 ? (
                                                    <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                        Không tìm thấy tác phẩm phù hợp.
                                                    </div>
                                                ) : (
                                                    filteredProjects.map(p => {
                                                        const isActive = p.id === selectedId;
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedId(p.id);
                                                                    setChartChapterFilter('all');
                                                                    setProjectPickerOpen(false);
                                                                    setProjectQuery('');
                                                                }}
                                                                className="w-full px-4 py-2.5 text-left flex items-center gap-3"
                                                                style={{
                                                                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                                                                    color: 'var(--text-primary)',
                                                                    borderBottom: '1px solid var(--border-subtle)',
                                                                }}>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">{p.title}</p>
                                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                                        Cập nhật: {new Date(p.updatedAt ?? p.createdAt).toLocaleString('vi-VN')}
                                                                    </p>
                                                                </div>
                                                                {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="mt-2 text-xs text-[var(--text-secondary)] truncate">
                                Dự án hiện tại: <span className="text-[var(--text-primary)] font-medium">{selectedProjectTitle}</span>
                                {selectedProject && (
                                    <span className="ml-2 text-[var(--text-secondary)]">
                                        · cập nhật {new Date(selectedProject.updatedAt ?? selectedProject.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={openAnalyzeConfirm}
                            disabled={!selectedId || analyzing || loadingProjects}
                            className="h-11 px-7 rounded-2xl font-semibold text-sm text-white flex items-center gap-2 shrink-0 transition-all disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)', boxShadow: '0 8px 24px rgba(245,166,35,0.25)' }}>
                            {analyzing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...</>
                            ) : (
                                <><Sparkles className="w-4 h-4" /> Phân tích ngay</>
                            )}
                        </button>
                    </div>
                    {analyzing && analysisJob && (
                        <p className="text-xs text-amber-300">
                            Mỗi tài khoản chỉ chạy 1 bộ truyện mỗi lần. Vui lòng chờ job hiện tại hoàn tất trước khi phân tích truyện khác.
                        </p>
                    )}
                    {/* Subscription usage bar */}
                    {subscription && (
                        <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center justify-between mb-2">
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
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${usagePercent}%`,
                                        background: subscription.usedAnalysisCount >= subscription.maxAnalysisCount
                                            ? 'linear-gradient(90deg,#ef4444,#f87171)'
                                            : 'linear-gradient(90deg,#f5a623,#f97316)',
                                    }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Two-column layout: main content + history sidebar */}
                <div className="flex flex-col xl:flex-row gap-5 xl:gap-6 items-start">

                    {/* ── Left: main report area ── */}
                    <div className="flex-1 min-w-0 space-y-5">

                        {/* Error */}
                        {analysisStatus && !error && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl text-sm"
                                style={analysisStatus.type === 'success'
                                    ? { background: 'linear-gradient(135deg,rgba(34,197,94,0.14),rgba(34,197,94,0.05))', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }
                                    : { background: 'linear-gradient(135deg,rgba(59,130,246,0.14),rgba(59,130,246,0.05))', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                                {analysisStatus.type === 'success'
                                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    : <BrainCircuit className="w-4 h-4 shrink-0" />}
                                {analysisStatus.message}
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl text-sm"
                                style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Analyzing progress */}
                        {analyzing && (
                            <div className="rounded-2xl p-5 overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(249,115,22,0.04), var(--bg-surface))', border: '1px solid rgba(245,166,35,0.35)' }}>
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
                                    <div className="ml-auto flex items-center gap-2 shrink-0">
                                        {report.status === 'MockData' && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                <AlertCircle className="w-3 h-3" /> Dữ liệu mẫu
                                            </div>
                                        )}
                                        <button
                                            onClick={handleExportReportPdf}
                                            disabled={exportingPdf || !canExportReportPdf}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-opacity disabled:opacity-50"
                                            style={canExportReportPdf
                                                ? { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }
                                                : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
                                            title={canExportReportPdf ? 'Xuất báo cáo PDF' : 'Nâng cấp gói để xuất PDF'}>
                                            {exportingPdf
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : canExportReportPdf ? <Download className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                            {canExportReportPdf ? 'Xuất PDF' : 'Nâng cấp để xuất PDF'}
                                        </button>
                                    </div>
                                </div>
                                {/* Tabs */}
                                <div className="flex items-center gap-4 border-b mb-5 px-2" style={{ borderColor: 'var(--border-color)' }}>
                                    <button
                                        onClick={() => setActiveTab('overall')}
                                        className={`pb-3 text-sm font-bold relative transition-colors ${activeTab === 'overall' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Tổng quan
                                        {activeTab === 'overall' && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-t-full bg-amber-500" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('charts')}
                                        className={`pb-3 text-sm font-bold relative transition-colors ${activeTab === 'charts' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Biểu đồ chuyên sâu
                                        {activeTab === 'charts' && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-t-full bg-amber-500" />
                                        )}
                                    </button>
                                </div>

                                {activeTab === 'overall' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                    </div>
                                )}

                                {activeTab === 'charts' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="rounded-2xl mb-5 p-4 flex flex-col gap-3"
                                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[var(--text-primary)] text-sm font-semibold">Bộ lọc chart narrative</p>
                                                    <p className="text-[var(--text-secondary)] text-xs">Chọn phạm vi phân tích theo toàn bộ project hoặc từng chapter.</p>
                                                </div>
                                                <button
                                                    onClick={handleRefreshNarrativeCharts}
                                                    disabled={!selectedId || loadingNarrativeCharts}
                                                    className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                                                    style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.35)' }}>
                                                    {loadingNarrativeCharts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                    Làm mới chart
                                                </button>
                                            </div>
                                            <div className="w-full sm:max-w-sm">
                                                <label className="block text-[var(--text-secondary)] text-xs font-semibold mb-1.5 uppercase tracking-wider">
                                                    Phạm vi chart
                                                </label>
                                                <select
                                                    value={chartChapterFilter}
                                                    onChange={e => setChartChapterFilter(e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl text-sm text-[var(--text-primary)] outline-none"
                                                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                                                    <option value="all">Toàn bộ project</option>
                                                    {projectChapters.map(ch => (
                                                        <option key={ch.id} value={ch.id}>
                                                            {ch.title ?? `Chương ${ch.chapterNumber}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <NarrativeChartsPanel data={narrativeCharts} loading={loadingNarrativeCharts} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Empty state */}
                        {!loadingReport && !report && !error && selectedId && (
                            <div className="rounded-3xl p-8 md:p-12 text-center border"
                                style={{
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01) 45%, var(--bg-surface) 100%)',
                                }}>
                                <div className="w-[72px] h-[72px] rounded-3xl mx-auto mb-5 flex items-center justify-center"
                                    style={{ background: 'rgba(245,166,35,0.12)' }}>
                                    <BrainCircuit className="w-9 h-9" style={{ color: '#f5a623' }} />
                                </div>
                                <p className="text-[var(--text-primary)] font-bold text-2xl mb-2">Chưa có báo cáo</p>
                                <p className="text-[var(--text-secondary)] text-base mb-6">
                                    Nhấn <strong>Phân tích ngay</strong> để AI đánh giá bản thảo theo rubric 100 điểm.
                                </p>
                                <button
                                    onClick={openAnalyzeConfirm}
                                    disabled={analyzing}
                                    className="h-11 px-7 rounded-2xl font-semibold text-sm text-white inline-flex items-center gap-2 transition-all disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)', boxShadow: '0 10px 28px rgba(245,166,35,0.24)' }}>
                                    <Sparkles className="w-4 h-4" />
                                    Bắt đầu phân tích
                                </button>
                                <p className="text-[var(--text-secondary)] text-xs mt-6">
                                    💡 Hãy chunk và embed các chương trong Workspace trước để kết quả chính xác hơn.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Right: history sidebar ── */}
                    <div className="w-full xl:w-80 xl:sticky xl:top-8 shrink-0 order-first xl:order-none">
                        <div
                            className="rounded-3xl overflow-hidden border"
                            style={{
                                borderColor: 'rgba(255,255,255,0.08)',
                                background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01) 45%, var(--bg-surface) 100%)',
                            }}>
                            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
                                <span className="text-[var(--text-primary)] font-semibold text-sm">Lịch sử phân tích</span>
                                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                    {history.length}
                                </span>
                            </div>
                            <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                {history.length === 0 && (
                                    <div className="px-5 py-6">
                                        <p className="text-[var(--text-primary)] text-sm font-semibold mb-1">Chưa có report nào</p>
                                        <p className="text-[var(--text-secondary)] text-xs">
                                            Sau khi phân tích xong, lịch sử report sẽ xuất hiện tại đây.
                                        </p>
                                    </div>
                                )}
                                {history.map(h => {
                                    const c = classifyColor(h.classification);
                                    const isActive = h.id === activeReportId;
                                    const isLoading = loadingHistoryReport === h.id;
                                    return (
                                        <button key={h.id} onClick={() => handleLoadHistory(h)}
                                            className="w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                                            style={{
                                                background: isActive ? 'rgba(245,166,35,0.08)' : undefined,
                                                borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                                                cursor: isActive ? 'default' : 'pointer',
                                            }}>
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
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

                </div>
            </div>
            <ConfirmDialog
                isOpen={showAnalyzeConfirm}
                onClose={() => setShowAnalyzeConfirm(false)}
                onConfirm={handleConfirmAnalyze}
                title="Xác nhận phân tích bộ truyện"
                message="Hệ thống sẽ dùng 1 lượt phân tích để chạy AI trên toàn bộ dự án đang chọn. Lưu ý: mỗi lần chỉ có thể chạy 1 phân tích thôi. Bạn có muốn tiếp tục không?"
                confirmText="Xác nhận phân tích"
                cancelText="Hủy"
                variant="warning"
            />
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
