import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  BookOpen,
  Search,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Sliders,
  BarChart2,
  ShieldAlert,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import {
  analysisJobService,
  type StaffReportDetail,
  type StaffReportStoryResponse,
} from '../services/analysisJobService';
import { reportService, type NarrativeChartsResponse } from '../services/reportService';
import DonutChart from '../components/analysis/DonutChart';
import RadarChart from '../components/analysis/RadarChart';
import GroupCard from '../components/analysis/GroupCard';
import NarrativeChartsPanel from '../components/analysis/NarrativeChartsPanel';
import EvidenceChunksPanel from '../components/analysis/EvidenceChunksPanel';

type EditableCriterion = {
  key: string;
  groupName: string;
  criterionName: string;
  score: number;
  maxScore: number;
  feedback: string;
  evidence: string;
  errors: string[];
  suggestions: string[];
  evidenceChunkOrdinals?: number[];
};

type EditableWarning = {
  code: string;
  severity: string;
  title: string;
  detail: string;
};

const RUBRIC_GROUPS = [
  "Kỳ vọng",
  "Nhân vật",
  "Cốt truyện & Cấu trúc",
  "Ngôn ngữ & Văn phong",
  "Sự hấp dẫn",
  "Tác động cảm xúc",
  "Chủ đề",
  "Xây dựng thế giới"
];

const RUBRIC_METADATA: Record<string, { groupName: string; criterionName: string }> = {
  "1.1": { groupName: "Kỳ vọng", criterionName: "Thể loại" },
  "1.2": { groupName: "Kỳ vọng", criterionName: "Tiền đề" },
  "2.1": { groupName: "Nhân vật", criterionName: "Phát triển nhân vật" },
  "2.2": { groupName: "Nhân vật", criterionName: "Tính cách & Sự hấp dẫn" },
  "2.3": { groupName: "Nhân vật", criterionName: "Mối quan hệ & Tương tác" },
  "2.4": { groupName: "Nhân vật", criterionName: "Sự đa dạng nhân vật" },
  "3.1": { groupName: "Cốt truyện & Cấu trúc", criterionName: "Diễn biến cốt truyện" },
  "3.2": { groupName: "Cốt truyện & Cấu trúc", criterionName: "Cấu trúc & Tổ chức" },
  "3.3": { groupName: "Cốt truyện & Cấu trúc", criterionName: "Kết thúc" },
  "4.1": { groupName: "Ngôn ngữ & Văn phong", criterionName: "Phong cách & Giọng văn" },
  "4.2": { groupName: "Ngôn ngữ & Văn phong", criterionName: "Ngữ pháp & Sự trôi chảy" },
  "4.3": { groupName: "Ngôn ngữ & Văn phong", criterionName: "Tính dễ đọc" },
  "5.1": { groupName: "Sự hấp dẫn", criterionName: "Mức độ thú vị" },
  "5.2": { groupName: "Sự hấp dẫn", criterionName: "Mức độ cuốn hút" },
  "6.1": { groupName: "Tác động cảm xúc", criterionName: "Sự đồng cảm" },
  "6.2": { groupName: "Tác động cảm xúc", criterionName: "Chiều sâu cảm xúc" },
  "7.1": { groupName: "Chủ đề", criterionName: "Khám phá chủ đề" },
  "7.2": { groupName: "Chủ đề", criterionName: "Chiều sâu chủ đề" },
  "8.1": { groupName: "Xây dựng thế giới", criterionName: "Xây dựng thế giới" },
  "8.2": { groupName: "Xây dựng thế giới", criterionName: "Bối cảnh" },
};



function parseCriteria(detail: StaffReportDetail): EditableCriterion[] {
  const source = detail.staffEditedCriteriaJson ?? detail.criteriaJson;
  if (!source) return [];

  let raw: any = null;
  try {
    raw = JSON.parse(source);
  } catch {
    return [];
  }

  const arr = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.criteria)
      ? raw.criteria
      : (Array.isArray(raw?.Criteria)
        ? raw.Criteria
        : []));

  return arr.map((item: any) => {
    const key = String(item?.key ?? item?.Key ?? '');
    const meta = RUBRIC_METADATA[key];
    return {
      key,
      groupName: String(item?.groupName ?? item?.GroupName ?? meta?.groupName ?? ''),
      criterionName: String(item?.criterionName ?? item?.CriterionName ?? meta?.criterionName ?? ''),
      score: Number(item?.score ?? item?.Score ?? 0),
      maxScore: Number(item?.maxScore ?? item?.MaxScore ?? 0),
      feedback: String(item?.feedback ?? item?.Feedback ?? ''),
      evidence: String(item?.evidence ?? item?.Evidence ?? ''),
      errors: Array.isArray(item?.errors)
        ? item.errors.map((x: any) => String(x))
        : (Array.isArray(item?.Errors) ? item.Errors.map((x: any) => String(x)) : []),
      suggestions: Array.isArray(item?.suggestions)
        ? item.suggestions.map((x: any) => String(x))
        : (Array.isArray(item?.Suggestions) ? item.Suggestions.map((x: any) => String(x)) : []),
      evidenceChunkOrdinals: Array.isArray(item?.evidenceChunkOrdinals)
        ? item.evidenceChunkOrdinals.map((x: any) => Number(x))
        : (Array.isArray(item?.evidence_chunk_ordinals)
          ? item.evidence_chunk_ordinals.map((x: any) => Number(x))
          : (Array.isArray(item?.EvidenceChunkOrdinals) ? item.EvidenceChunkOrdinals.map((x: any) => Number(x)) : [])),
    };
  })
  .filter((c: EditableCriterion) => c.key);
}

function parseWarnings(detail: StaffReportDetail): EditableWarning[] {
  const source = detail.staffEditedCriteriaJson ?? detail.criteriaJson;
  if (!source) return [];

  try {
    const raw = JSON.parse(source);
    const arr = Array.isArray(raw?.warnings)
      ? raw.warnings
      : (Array.isArray(raw?.Warnings) ? raw.Warnings : []);
    return arr.map((item: any) => ({
      code: String(item?.code ?? item?.Code ?? ''),
      severity: String(item?.severity ?? item?.Severity ?? 'WARNING'),
      title: String(item?.title ?? item?.Title ?? ''),
      detail: String(item?.detail ?? item?.Detail ?? ''),
    })).filter((w: EditableWarning) => w.code || w.title);
  } catch {
    return [];
  }
}


export default function StaffReportReviewPage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<StaffReportDetail | null>(null);
  const [story, setStory] = useState<StaffReportStoryResponse | null>(null);
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);

  // Narrative charts state
  const [narrativeCharts, setNarrativeCharts] = useState<NarrativeChartsResponse | null>(null);
  const [loadingNarrativeCharts, setLoadingNarrativeCharts] = useState(false);

  // Evidence panel state
  const [evidencePanel, setEvidencePanel] = useState<{
    ordinals: number[];
    highlight: string;
    label: string;
  } | null>(null);

  // Reader states
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  
  // Wide reader modal states
  const [isWideReaderOpen, setIsWideReaderOpen] = useState(false);
  const [activeModalChapterId, setActiveModalChapterId] = useState<string | null>(null);
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerFontSize, setReaderFontSize] = useState<number>(16);
  const [readerTheme, setReaderTheme] = useState<'dark' | 'cream' | 'dim'>('dark');

  // Tab & Collapsibles States
  const [activeTab, setActiveTab] = useState<'rubric' | 'narrative'>('rubric');
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });

  const warnings = useMemo(() => {
    if (!detail) return [];
    return parseWarnings(detail);
  }, [detail]);

  // Reconstructed mapped groups exactly matching Author's report format
  const mappedGroups = useMemo(() => {
    if (!criteria.length) return [];
    
    const groupsMap = new Map<string, EditableCriterion[]>();
    criteria.forEach(c => {
      const g = c.groupName || 'Khác';
      if (!groupsMap.has(g)) {
        groupsMap.set(g, []);
      }
      groupsMap.get(g)!.push(c);
    });

    return RUBRIC_GROUPS.map((g) => {
      const groupCriteria = groupsMap.get(g) || [];
      const score = groupCriteria.reduce((sum, c) => sum + c.score, 0);
      const maxScore = groupCriteria.reduce((sum, c) => sum + c.maxScore, 0);
      
      return {
        name: g,
        score,
        maxScore,
        criteria: groupCriteria.map(c => ({
          key: c.key,
          criterionName: c.criterionName,
          score: c.score,
          maxScore: c.maxScore,
          feedback: c.feedback,
          evidence: c.evidence,
          errors: c.errors,
          suggestions: c.suggestions,
          evidenceChunkOrdinals: c.evidenceChunkOrdinals,
          groupName: c.groupName,
          bibleComparison: '',
        })),
      };
    }).filter(g => g.criteria.length > 0);
  }, [criteria]);

  // Filter chapters based on search term
  const filteredChapters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return story?.chapters ?? [];
    return (story?.chapters ?? []).filter(
      ch =>
        ch.title.toLowerCase().includes(term) ||
        `chương ${ch.chapter_number}`.includes(term) ||
        (ch.content && ch.content.toLowerCase().includes(term))
    );
  }, [story, searchTerm]);

  // Active chapter in fullscreen modal
  const activeModalChapter = useMemo(() => {
    if (!story?.chapters) return null;
    return story.chapters.find(ch => ch.chapter_id === activeModalChapterId) || story.chapters[0] || null;
  }, [story, activeModalChapterId]);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWideReaderOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadNarrativeCharts = async (projectId: string) => {
    setLoadingNarrativeCharts(true);
    try {
      const charts = await reportService.getNarrativeCharts(projectId);
      setNarrativeCharts(charts);
    } catch {
      setNarrativeCharts(null);
    } finally {
      setLoadingNarrativeCharts(false);
    }
  };

  const load = async (targetReportId: string) => {
    setLoading(true);
    setError('');
    try {
      const [reportDetail, storyData] = await Promise.all([
        analysisJobService.getReportDetail(targetReportId),
        analysisJobService.getReportStory(targetReportId),
      ]);
      setDetail(reportDetail);
      setStory(storyData);
      setCriteria(parseCriteria(reportDetail));

      if (reportDetail.projectId) {
        void loadNarrativeCharts(reportDetail.projectId);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message
        ?? err?.response?.data?.Message
        ?? 'Không thể tải dữ liệu review report.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const info = getUserInfo(token);
    if (info.role !== 'Staff' && info.role !== 'Admin') {
      navigate('/home');
      return;
    }
    if (!reportId) {
      setError('Thiếu reportId.');
      setLoading(false);
      return;
    }
    void load(reportId);
  }, [navigate, reportId]);

  const toggleGroup = (idx: number) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const chapterCount = story?.chapters?.length ?? 0;

  return (
    <MainLayout pageTitle="Staff Review Report">
      {() => (
        <div className="p-6 max-w-[1600px] mx-auto w-full space-y-6">
          {/* Top Bar with Back Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/staff/analysis-jobs')}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 hover:opacity-85 transition-opacity"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại danh sách
            </button>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Xem chi tiết report (Staff)</h1>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            </div>
          ) : !detail ? null : (
            <div className="space-y-6">
              {/* Cockpit Header Card: Visual Score Overview */}
              <div
                className="relative overflow-hidden rounded-3xl p-6 border"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01) 45%, var(--bg-surface) 100%)',
                }}
              >
                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: '#f59e0b' }} />

                <div className="flex flex-col lg:flex-row items-center gap-8 justify-around">
                  {/* Left: Score Donut & Radar Chart */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0">
                    <DonutChart score={detail.totalScore} classification={detail.classification} />
                    <RadarChart groups={mappedGroups} />
                  </div>

                  {/* Right: Project details & status */}
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <h2 className="text-xl font-black text-[var(--text-bright)] leading-snug">
                        {detail.projectTitle}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15">
                          {detail.classification}
                        </span>
                        <span className="text-xs text-zinc-400">
                          Phiên bản: <span className="font-semibold text-zinc-300 font-mono">{detail.projectVersion || 'v1.0.0'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        detail.reviewStatus === 'Released'
                          ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                          : 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse'
                      }`} />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        Trạng thái duyệt: {
                          detail.reviewStatus === 'Released' ? 'Đã phát hành' : 
                          detail.reviewStatus === 'StaffReviewing' ? 'Staff đang xem' : 
                          'Chờ duyệt (Pending)'
                        }
                      </span>
                    </div>

                    {/* Overall Feedback card inside header */}
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-hover)]/30 p-4 relative overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Nhận xét tổng quan của AI
                      </p>
                      <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-medium select-text">
                        {detail.overallFeedback || 'Chưa có nhận xét tổng quan.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Content Flags Alert panel */}
              {warnings.length > 0 && (
                <div
                  className="rounded-2xl p-5 border relative overflow-hidden shadow-lg shadow-rose-500/5 animate-fade-in"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.04) 45%, var(--bg-surface) 100%)',
                  }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: '#ef4444' }} />
                  
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-500/20">
                    <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                    <h2 className="text-xs font-black text-rose-300 uppercase tracking-wider">
                      Cảnh báo đặc biệt từ hệ thống AI ({warnings.length})
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {warnings.map((w, idx) => {
                      const isCritical = w.severity === 'CRITICAL' || w.code === 'PLAGIARISM_RISK' || w.code === 'SEXUAL_CONTENT' || w.code === 'ANTI_STATE';
                      return (
                        <div
                          key={`${w.code}-${idx}`}
                          className={`flex gap-3 p-3.5 rounded-xl border transition-all ${
                            isCritical
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-md shadow-rose-500/5'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          }`}
                        >
                          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-xs uppercase tracking-wide">
                                {w.code === 'PLAGIARISM_RISK' ? '🚩 NGHI VẤN ĐẠO NHÁI' : 
                                 w.code === 'SEXUAL_CONTENT' ? '⚠️ NỘI DUNG TÌNH DỤC / NHẠY CẢM' :
                                 w.code === 'ANTI_STATE' ? '🚫 XUYÊN TẠC CHỐNG PHÁ / PHẢN ĐỘNG' :
                                 w.code === 'INCONSISTENCY' ? '⚡ MÂU THUẪN LOGIC' :
                                 w.code === 'INCOMPLETE' ? '💤 TRUYỆN CHƯA HOÀN THÀNH' :
                                 w.code === 'REPETITION' ? '🔄 LẶP TỪ / LẶP CẢNH' :
                                 `⚠️ CẢNH BÁO ${w.code}`}
                              </p>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-none ${
                                isCritical ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {w.severity}
                              </span>
                            </div>
                            <p className="text-xs font-bold mt-1.5 text-[var(--text-bright)]">
                              {w.title}
                            </p>
                            <p className="text-[11px] mt-1 text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap select-text">
                              {w.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Content Workspace Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Left Columns (Col 1-2): Visual Tab Switcher Workspace */}
                <div className="xl:col-span-2 space-y-4">
                  {/* Visual Tab Bar */}
                  <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-px">
                    <button
                      onClick={() => setActiveTab('rubric')}
                      className={`h-11 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all relative ${
                        activeTab === 'rubric'
                          ? 'border-amber-500 text-amber-400 font-bold'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Sliders className="w-4 h-4" />
                      Chi tiết Rubric
                    </button>
                    <button
                      onClick={() => setActiveTab('narrative')}
                      className={`h-11 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all relative ${
                        activeTab === 'narrative'
                          ? 'border-amber-500 text-amber-400 font-bold'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <BarChart2 className="w-4 h-4" />
                      Biểu đồ Cốt truyện
                    </button>
                  </div>

                  {/* Tab Contents */}
                  {activeTab === 'rubric' ? (
                    <div className="space-y-3">
                      {mappedGroups.map((g, i) => (
                        <GroupCard
                          key={g.name}
                          group={g}
                          idx={i}
                          expanded={!!expandedGroups[i]}
                          onToggle={() => toggleGroup(i)}
                          projectId={detail.projectId}
                          isStaff={false}
                          onViewEvidence={(ordinals, highlight, label) => {
                            setEvidencePanel({ ordinals, highlight, label });
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-black text-[var(--text-bright)]">Biểu đồ phân tích nhịp độ & nhân vật</h3>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Phân tích dòng chảy cảm xúc, nhịp độ và tần suất xuất hiện của các nhân vật</p>
                        </div>
                      </div>
                      <NarrativeChartsPanel data={narrativeCharts} loading={loadingNarrativeCharts} />
                    </div>
                  )}
                </div>

                {/* Right Column (Col 3): Actions and Manuscript widget */}
                <div className="space-y-4">
                  {/* Manuscript widget panel */}
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">Bản thảo truyện</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-medium">
                          {chapterCount} chương • {story?.chapters?.reduce((acc, c) => acc + (c.word_count || 0), 0).toLocaleString() ?? 0} từ
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (story?.chapters && story.chapters.length > 0) {
                            setActiveModalChapterId(story.chapters[0].chapter_id);
                          }
                          setIsWideReaderOpen(true);
                        }}
                        disabled={!story?.chapters?.length}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-bold inline-flex items-center gap-1.5 text-amber-400 border border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Chế độ đọc rộng
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-secondary)]">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Tìm chương hoặc nội dung..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/40 transition-colors"
                      />
                    </div>

                    {/* Accordion list */}
                    <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto pr-1 select-none">
                      {filteredChapters.length === 0 ? (
                        <p className="text-xs text-center text-[var(--text-secondary)] py-8">Không tìm thấy chương phù hợp</p>
                      ) : (
                        filteredChapters.map(ch => {
                          const isExpanded = expandedChapterId === ch.chapter_id;
                          return (
                            <div
                              key={ch.chapter_id}
                              className={`rounded-xl border transition-all ${
                                isExpanded
                                  ? 'border-amber-500/30 bg-[var(--bg-hover)]'
                                  : 'border-[var(--border-color)] bg-[var(--bg-hover)]/30 hover:bg-[var(--bg-hover)]/50'
                              }`}
                            >
                              <button
                                onClick={() => setExpandedChapterId(isExpanded ? null : ch.chapter_id)}
                                className="w-full text-left px-3.5 py-3 flex items-center justify-between gap-2 focus:outline-none"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                    Chương {ch.chapter_number}: {ch.title}
                                  </p>
                                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-medium">
                                    {ch.word_count?.toLocaleString() || 0} từ
                                  </p>
                                </div>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180 text-amber-400' : ''
                                  }`}
                                />
                              </button>

                              {isExpanded && (
                                <div className="px-3.5 pb-3 border-t border-[var(--border-color)]/40 pt-2.5 select-text">
                                  <div
                                    className="text-[11px] text-[var(--text-primary)] leading-relaxed font-serif overflow-y-auto max-h-[250px] pr-1 space-y-2"
                                    style={{ fontFamily: 'Georgia, serif' }}
                                  >
                                    {ch.content ? (
                                      ch.content.split('\n').map((para, pIdx) => (
                                        <p key={`${ch.chapter_id}-p-${pIdx}`} className="mb-2">
                                          {para}
                                        </p>
                                      ))
                                    ) : (
                                      <p className="italic text-[var(--text-secondary)]">Không có nội dung</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Wide Book Reader Modal */}
          {isWideReaderOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-md animate-fade-in select-none">
              <div
                className="flex-1 flex flex-col md:flex-row h-full overflow-hidden shadow-2xl transition-all"
                style={{
                  background:
                    readerTheme === 'cream'
                      ? '#f8f4eb'
                      : readerTheme === 'dim'
                      ? '#1e222b'
                      : '#0f1115',
                  color:
                    readerTheme === 'cream'
                      ? '#2d251e'
                      : readerTheme === 'dim'
                      ? '#d1d8e0'
                      : '#e9ecef',
                }}
              >
                {/* TOC Sidebar */}
                <div
                  className="w-full md:w-80 shrink-0 flex flex-col border-b md:border-b-0 md:border-r"
                  style={{
                    borderColor:
                      readerTheme === 'cream'
                        ? 'rgba(45, 37, 30, 0.1)'
                        : 'rgba(255, 255, 255, 0.1)',
                    background:
                      readerTheme === 'cream'
                        ? '#f2edd9'
                        : readerTheme === 'dim'
                        ? '#181b22'
                        : '#0b0c0f',
                  }}
                >
                  <div
                    className="p-4 border-b flex items-center justify-between"
                    style={{
                      borderColor:
                        readerTheme === 'cream'
                          ? 'rgba(45, 37, 30, 0.1)'
                          : 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div>
                      <p
                        className="text-xs font-black truncate max-w-[200px]"
                        style={{
                          color: readerTheme === 'cream' ? '#1c1510' : '#ffffff',
                        }}
                      >
                        {detail?.projectTitle}
                      </p>
                      <p className="text-[9px] opacity-70 mt-0.5">{chapterCount} chương</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
                    {(story?.chapters ?? []).map(ch => {
                      const isActive = ch.chapter_id === activeModalChapterId;
                      return (
                        <button
                          key={ch.chapter_id}
                          onClick={() => setActiveModalChapterId(ch.chapter_id)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? readerTheme === 'cream'
                                ? 'bg-[#d8d0b2] text-[#1c1510] shadow-sm font-bold'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                              : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="truncate">
                              Chương {ch.chapter_number}: {ch.title}
                            </span>
                            <span className="text-[8px] shrink-0 opacity-60 font-mono">
                              {ch.word_count} từ
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 h-full">
                  {/* Controls Header */}
                  <div
                    className="h-16 px-6 border-b flex items-center justify-between shrink-0"
                    style={{
                      borderColor:
                        readerTheme === 'cream'
                          ? 'rgba(45, 37, 30, 0.1)'
                          : 'rgba(255, 255, 255, 0.1)',
                      background:
                        readerTheme === 'cream'
                          ? '#f8f4eb'
                          : readerTheme === 'dim'
                          ? '#1e222b'
                          : '#0f1115',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Font family selector */}
                      <div className="flex items-center gap-1 bg-black/10 rounded-lg p-0.5">
                        <button
                          onClick={() => setReaderFontFamily('serif')}
                          className={`px-3 py-1 rounded-md text-xs font-serif font-bold transition-all ${
                            readerFontFamily === 'serif'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          Serif
                        </button>
                        <button
                          onClick={() => setReaderFontFamily('sans')}
                          className={`px-3 py-1 rounded-md text-xs font-sans font-bold transition-all ${
                            readerFontFamily === 'sans'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          Sans
                        </button>
                      </div>

                      {/* Font size adjuster */}
                      <div className="flex items-center gap-1.5 bg-black/10 rounded-lg p-0.5">
                        <button
                          onClick={() => setReaderFontSize(prev => Math.max(12, prev - 1))}
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold rounded-md hover:bg-black/10 transition-colors"
                        >
                          A-
                        </button>
                        <span className="text-xs font-bold px-1.5 shrink-0">{readerFontSize}px</span>
                        <button
                          onClick={() => setReaderFontSize(prev => Math.min(26, prev + 1))}
                          className="w-7 h-7 flex items-center justify-center text-xs font-bold rounded-md hover:bg-black/10 transition-colors"
                        >
                          A+
                        </button>
                      </div>

                      {/* Theme chooser */}
                      <div className="flex items-center gap-2 bg-black/10 rounded-lg p-1">
                        <button
                          onClick={() => setReaderTheme('dark')}
                          title="Tối"
                          className={`w-5 h-5 rounded-full bg-[#0f1115] border ${
                            readerTheme === 'dark' ? 'border-amber-400 scale-110 shadow-sm' : 'border-white/10'
                          }`}
                        />
                        <button
                          onClick={() => setReaderTheme('dim')}
                          title="Mờ"
                          className={`w-5 h-5 rounded-full bg-[#1e222b] border ${
                            readerTheme === 'dim' ? 'border-amber-400 scale-110 shadow-sm' : 'border-white/10'
                          }`}
                        />
                        <button
                          onClick={() => setReaderTheme('cream')}
                          title="Sách"
                          className={`w-5 h-5 rounded-full bg-[#f8f4eb] border ${
                            readerTheme === 'cream' ? 'border-amber-800 scale-110 shadow-sm' : 'border-black/10'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setIsWideReaderOpen(false)}
                      className="h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-black/10"
                      style={{
                        color: readerTheme === 'cream' ? '#8a7765' : '#8892b0',
                      }}
                    >
                      Đóng chế độ đọc (Esc)
                    </button>
                  </div>

                  {/* Main Book Reader Pane */}
                  <div className="flex-1 overflow-y-auto px-6 py-10 flex justify-center select-text">
                    <div className="w-full max-w-[720px] flex flex-col animate-fade-in">
                      {activeModalChapter ? (
                        <>
                          <div className="text-center border-b pb-6 mb-8" style={{ borderColor: readerTheme === 'cream' ? 'rgba(45, 37, 30, 0.1)' : 'rgba(255, 255, 255, 0.1)' }}>
                            <h2
                              className="text-xl font-bold font-serif mb-2"
                              style={{
                                color: readerTheme === 'cream' ? '#1c1510' : '#ffffff',
                              }}
                            >
                              Chương {activeModalChapter.chapter_number}: {activeModalChapter.title}
                            </h2>
                            <p className="text-[10px] opacity-75 font-serif">
                              ~{activeModalChapter.word_count?.toLocaleString() || 0} từ • Bản thảo gốc (Chỉ đọc)
                            </p>
                          </div>

                          <div
                            className={`flex-1 selection:bg-amber-500/30 whitespace-pre-wrap leading-loose ${
                              readerFontFamily === 'serif' ? 'font-serif' : 'font-sans'
                            }`}
                            style={{
                              fontSize: `${readerFontSize}px`,
                              lineHeight: '1.9',
                            }}
                          >
                            {activeModalChapter.content ? (
                              activeModalChapter.content.split('\n').map((pNode, pIdx) => (
                                <p key={`modal-${activeModalChapter.chapter_id}-p-${pIdx}`} className="mb-4 text-[var(--text-primary)]" style={{ color: readerTheme === 'cream' ? '#2d251e' : undefined }}>
                                  {pNode}
                                </p>
                              ))
                            ) : (
                              <p className="italic opacity-60 text-center py-20 font-serif">
                                Không có nội dung bản thảo
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-center italic opacity-60 py-20 font-serif">
                          Chọn một chương để đọc bản thảo
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Evidence chunks panel */}
          {detail && (
            <EvidenceChunksPanel
              open={evidencePanel !== null}
              onClose={() => setEvidencePanel(null)}
              projectId={detail.projectId}
              ordinals={evidencePanel?.ordinals ?? []}
              evidenceHighlight={evidencePanel?.highlight ?? ''}
              criterionLabel={evidencePanel?.label ?? ''}
            />
          )}
        </div>
      )}
    </MainLayout>
  );
}
