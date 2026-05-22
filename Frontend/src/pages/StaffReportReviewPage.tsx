import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  Send,
  BookOpen,
  Search,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { getUserInfo } from '../utils/jwtHelper';
import {
  analysisJobService,
  type StaffReportDetail,
  type StaffReportStoryResponse,
} from '../services/analysisJobService';

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

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

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

function parseOriginalCriteria(detail: StaffReportDetail): Record<string, { feedback: string; evidence: string; errors: string[]; suggestions: string[] }> {
  if (!detail.criteriaJson) return {};
  try {
    const raw = JSON.parse(detail.criteriaJson);
    const arr = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw?.criteria)
        ? raw.criteria
        : (Array.isArray(raw?.Criteria) ? raw.Criteria : []));
    
    const record: Record<string, { feedback: string; evidence: string; errors: string[]; suggestions: string[] }> = {};
    arr.forEach((item: any) => {
      const key = String(item?.key ?? item?.Key ?? '');
      if (key) {
        record[key] = {
          feedback: String(item?.feedback ?? item?.Feedback ?? ''),
          evidence: String(item?.evidence ?? item?.Evidence ?? ''),
          errors: Array.isArray(item?.errors)
            ? item.errors.map((x: any) => String(x))
            : (Array.isArray(item?.Errors) ? item.Errors.map((x: any) => String(x)) : []),
          suggestions: Array.isArray(item?.suggestions)
            ? item.suggestions.map((x: any) => String(x))
            : (Array.isArray(item?.Suggestions) ? item.Suggestions.map((x: any) => String(x)) : []),
        };
      }
    });
    return record;
  } catch {
    return {};
  }
}

export default function StaffReportReviewPage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<StaffReportDetail | null>(null);
  const [story, setStory] = useState<StaffReportStoryResponse | null>(null);
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [originalCriteria, setOriginalCriteria] = useState<Record<string, { feedback: string; evidence: string; errors: string[]; suggestions: string[] }>>({});
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Reader states
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  
  // Wide reader modal states
  const [isWideReaderOpen, setIsWideReaderOpen] = useState(false);
  const [activeModalChapterId, setActiveModalChapterId] = useState<string | null>(null);
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerFontSize, setReaderFontSize] = useState<number>(16);
  const [readerTheme, setReaderTheme] = useState<'dark' | 'cream' | 'dim'>('dark');

  // Categories & Collapsibles States
  const [activeGroup, setActiveGroup] = useState('Kỳ vọng');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});

  const isReadOnly = useMemo(() => {
    return detail?.reviewStatus === 'Released';
  }, [detail]);

  const warnings = useMemo(() => {
    if (!detail) return [];
    return parseWarnings(detail);
  }, [detail]);

  // Group statistics for display in vertical tabs
  const groupStats = useMemo(() => {
    const stats: Record<string, { score: number; maxScore: number; count: number; modifiedCount: number }> = {};
    RUBRIC_GROUPS.forEach(g => {
      stats[g] = { score: 0, maxScore: 0, count: 0, modifiedCount: 0 };
    });

    criteria.forEach(c => {
      const g = c.groupName || 'Khác';
      if (!stats[g]) {
        stats[g] = { score: 0, maxScore: 0, count: 0, modifiedCount: 0 };
      }
      stats[g].score += c.score;
      stats[g].maxScore += c.maxScore;
      stats[g].count += 1;

      // Check if modified
      const orig = originalCriteria[c.key];
      const isFeedbackModified = !!(orig && c.feedback !== orig.feedback);
      const isEvidenceModified = !!(orig && c.evidence !== orig.evidence);
      const isErrorsModified = !!(orig && JSON.stringify(c.errors) !== JSON.stringify(orig.errors));
      const isSuggestionsModified = !!(orig && JSON.stringify(c.suggestions) !== JSON.stringify(orig.suggestions));
      const isModified = isFeedbackModified || isEvidenceModified || isErrorsModified || isSuggestionsModified;
      if (isModified) {
        stats[g].modifiedCount += 1;
      }
    });

    return stats;
  }, [criteria, originalCriteria]);

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

  const load = async (targetReportId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [reportDetail, storyData] = await Promise.all([
        analysisJobService.getReportDetail(targetReportId),
        analysisJobService.getReportStory(targetReportId),
      ]);
      setDetail(reportDetail);
      setStory(storyData);
      setCriteria(parseCriteria(reportDetail));
      setOriginalCriteria(parseOriginalCriteria(reportDetail));
      
      // Auto expand first criterion key of first group on load
      const parsed = parseCriteria(reportDetail);
      if (parsed.length > 0) {
        const firstKey = parsed[0].key;
        setExpandedKeys({ [firstKey]: true });
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

  const updateCriterion = (index: number, patch: Partial<EditableCriterion>) => {
    if (isReadOnly) return;
    setCriteria(prev => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleShowOriginal = (key: string) => {
    setShowOriginalMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const submitEdit = async (releaseToUser: boolean) => {
    if (!reportId || !detail || saving || isReadOnly) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await analysisJobService.editReport(reportId, {
        editedCriteria: criteria.map(c => ({
          key: c.key,
          feedback: c.feedback,
          evidence: c.evidence,
          errors: c.errors,
          suggestions: c.suggestions,
        })),
        releaseToUser,
        expectedUpdatedAt: detail.updatedAt ?? detail.createdAt,
        feedbackMessage: feedbackMessage.trim() || undefined,
      });

      setDetail(updated);
      setCriteria(parseCriteria(updated));
      setFeedbackMessage(''); // Reset sau khi submit thành công
      setSuccess(releaseToUser
        ? 'Đã phát hành report cho tác giả.'
        : 'Đã lưu bản chỉnh sửa cho staff. Report chưa phát hành.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const message = err?.response?.data?.message
        ?? err?.response?.data?.Message
        ?? 'Lưu chỉnh sửa thất bại.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const chapterCount = story?.chapters?.length ?? 0;

  return (
    <MainLayout pageTitle="Staff Review Report">
      {() => (
        <div className="p-6 max-w-[1400px] mx-auto w-full space-y-5">
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
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Review & Phê duyệt report</h1>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            </div>
          ) : !detail ? null : (
            <div className="space-y-5">
              {/* Cockpit Header Card */}
              <div
                className="relative overflow-hidden rounded-2xl p-5 border"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01) 45%, var(--bg-surface) 100%)',
                }}
              >
                <div className="absolute -top-10 -right-12 w-52 h-52 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: '#f59e0b' }} />
                
                {/* Read Only Indicator Banner */}
                {isReadOnly && (
                  <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-300 text-xs font-semibold">
                    <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                    Báo cáo này đã được phát hành cho tác giả. Dữ liệu hiện ở chế độ ĐỌC (Read-Only) để bảo vệ lịch sử.
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-5 lg:items-center">
                  {/* Score badge */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div
                      className="w-16 h-16 rounded-xl flex flex-col items-center justify-center border shadow-lg shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))',
                        borderColor: 'rgba(245,158,11,0.25)',
                      }}
                    >
                      <span className="text-xl font-black text-amber-400 leading-none">
                        {detail.totalScore.toFixed(0)}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1">
                        Điểm AI
                      </span>
                    </div>
                    
                    <div>
                      <h2 className="text-base font-black text-[var(--text-bright)] leading-snug truncate max-w-[320px] sm:max-w-[480px]">
                        {detail.projectTitle}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15">
                          {detail.classification}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Phiên bản: <span className="font-semibold text-zinc-300 font-mono">{detail.projectVersion || 'v1.0.0'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status review progress indicator */}
                  <div className="lg:ml-auto flex items-center gap-4 shrink-0">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Trạng thái duyệt</p>
                      <div className="flex items-center gap-2 mt-1 lg:justify-end">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          detail.reviewStatus === 'Released'
                            ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                            : 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse'
                        }`} />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {detail.reviewStatus === 'Released' ? 'Đã phát hành' : 
                           detail.reviewStatus === 'StaffReviewing' ? 'Staff đang xem' : 
                           'Chờ duyệt (Pending)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Feedback card inside header */}
                <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-hover)]/30 p-4 relative overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Nhận xét tổng quan của AI
                  </p>
                  <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-medium select-text">
                    {detail.overallFeedback || 'Chưa có nhận xét tổng quan.'}
                  </p>
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
                {/* Left Columns (Col 1-2): Criteria Categorized Dashboard */}
                <div className="xl:col-span-2 space-y-4">
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
                      <div>
                        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-amber-400" />
                          Đánh giá & Điều chỉnh Rubric chuyên sâu
                        </h2>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Nhấn vào từng tiêu chí để điều chỉnh Feedback, Evidence, Errors, Suggestions gửi tác giả.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      {/* Left vertical tabs for Rubric Groups */}
                      <div className="md:col-span-1 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 pr-0 md:pr-2 border-r-0 md:border-r border-[var(--border-color)] scrollbar-none pb-2 md:pb-0">
                        {RUBRIC_GROUPS.map(g => {
                          const isActive = activeGroup === g;
                          const stat = groupStats[g] || { score: 0, maxScore: 0, count: 0, modifiedCount: 0 };
                          if (stat.count === 0) return null; // Hide empty groups
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setActiveGroup(g)}
                              disabled={loading}
                              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shrink-0 md:shrink transition-all ${
                                isActive
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-transparent'
                              }`}
                            >
                              <span className="truncate flex items-center gap-1.5">
                                {g}
                                {stat.modifiedCount > 0 && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title={`Đã sửa ${stat.modifiedCount} tiêu chí`} />
                                )}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                                isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                              }`}>
                                {stat.score.toFixed(1)}/{stat.maxScore}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right criteria content edit panels */}
                      <div className="md:col-span-3 space-y-4">
                        {criteria.length === 0 ? (
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Không thể tải dữ liệu criteria. Dữ liệu JSON của report có thể bị lỗi hoặc chưa có phân tích.
                          </div>
                        ) : (
                          criteria
                            .map((c, idx) => ({ c, originalIdx: idx }))
                            .filter(({ c }) => c.groupName === activeGroup)
                            .map(({ c, originalIdx }) => {
                              const isExpanded = !!expandedKeys[c.key];
                              const showOriginal = !!showOriginalMap[c.key];
                              const orig = originalCriteria[c.key];
                              
                              const isFeedbackModified = !!(orig && c.feedback !== orig.feedback);
                              const isEvidenceModified = !!(orig && c.evidence !== orig.evidence);
                              const isErrorsModified = !!(orig && JSON.stringify(c.errors) !== JSON.stringify(orig.errors));
                              const isSuggestionsModified = !!(orig && JSON.stringify(c.suggestions) !== JSON.stringify(orig.suggestions));
                              const isAnyModified = isFeedbackModified || isEvidenceModified || isErrorsModified || isSuggestionsModified;
                              
                              return (
                                <div
                                  key={c.key}
                                  className={`rounded-xl border transition-all ${
                                    isExpanded
                                      ? 'border-amber-500/30 bg-[var(--bg-hover)]/30 shadow-md shadow-amber-500/5'
                                      : 'border-[var(--border-color)] bg-[var(--bg-hover)]/10 hover:bg-[var(--bg-hover)]/20'
                                  }`}
                                >
                                  {/* Collapsed/Header view */}
                                  <div
                                    onClick={() => toggleExpand(c.key)}
                                    className="px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/15">
                                          {c.key}
                                        </span>
                                        <h3 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                          {c.criterionName}
                                        </h3>
                                      </div>
                                      {!isExpanded && (
                                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 truncate leading-relaxed">
                                          {c.feedback || 'Chưa có nhận xét.'}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      {orig && (
                                        isAnyModified ? (
                                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse shrink-0">
                                            ✍️ Staff sửa
                                          </span>
                                        ) : (
                                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/50 shrink-0">
                                            🤖 Gốc AI
                                          </span>
                                        )
                                      )}
                                      <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
                                        AI: {c.score}/{c.maxScore}
                                      </span>
                                      <ChevronDown
                                        className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-200 ${
                                          isExpanded ? 'rotate-180 text-amber-400' : ''
                                        }`}
                                      />
                                    </div>
                                  </div>

                                  {/* Expanded detailed editor view */}
                                  {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 border-t border-[var(--border-color)]/30 space-y-4">
                                      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)]/30 pb-2">
                                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                                          Rubric: {c.groupName} &raquo; {c.criterionName}
                                        </span>
                                        {orig && (
                                          <button
                                            type="button"
                                            onClick={() => toggleShowOriginal(c.key)}
                                            className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 border transition-all ${
                                              showOriginal
                                                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                            }`}
                                          >
                                            {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            {showOriginal ? 'Ẩn bản gốc AI' : 'Xem bản gốc AI'}
                                          </button>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Feedback & Evidence */}
                                        <div className="space-y-3">
                                          <label className="block">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                                                Feedback {isFeedbackModified ? (
                                                  <span className="text-[9px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">✍️ Đã sửa</span>
                                                ) : (
                                                  <span className="text-[9px] font-medium text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded">🤖 Bản gốc AI</span>
                                                )}
                                              </span>
                                              {isFeedbackModified && orig && !isReadOnly && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateCriterion(originalIdx, { feedback: orig.feedback });
                                                  }}
                                                  className="text-[9px] font-bold text-amber-400/80 hover:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                  Khôi phục gốc
                                                </button>
                                              )}
                                            </div>
                                            <textarea
                                              readOnly={isReadOnly}
                                              value={c.feedback}
                                              onChange={e => updateCriterion(originalIdx, { feedback: e.target.value })}
                                              rows={4}
                                              className="mt-1.5 w-full px-3 py-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600 leading-relaxed disabled:opacity-60"
                                              placeholder="Nhận xét cụ thể về tiêu chí này..."
                                            />
                                          </label>

                                          <label className="block">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                                                Minh chứng (Evidence) {isEvidenceModified ? (
                                                  <span className="text-[9px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">✍️ Đã sửa</span>
                                                ) : (
                                                  <span className="text-[9px] font-medium text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded">🤖 Bản gốc AI</span>
                                                )}
                                              </span>
                                              {isEvidenceModified && orig && !isReadOnly && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateCriterion(originalIdx, { evidence: orig.evidence });
                                                  }}
                                                  className="text-[9px] font-bold text-amber-400/80 hover:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                  Khôi phục gốc
                                                </button>
                                              )}
                                            </div>
                                            <textarea
                                              readOnly={isReadOnly}
                                              value={c.evidence}
                                              onChange={e => updateCriterion(originalIdx, { evidence: e.target.value })}
                                              rows={4}
                                              className="mt-1.5 w-full px-3 py-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600 leading-relaxed disabled:opacity-60"
                                              placeholder="Dẫn chứng từ truyện (số chương, trích dẫn)..."
                                            />
                                          </label>
                                        </div>

                                        {/* Errors & Suggestions */}
                                        <div className="space-y-3">
                                          <label className="block">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                                                Lỗi cần sửa (Errors - mỗi dòng 1 ý) {isErrorsModified ? (
                                                  <span className="text-[9px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">✍️ Đã sửa</span>
                                                ) : (
                                                  <span className="text-[9px] font-medium text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded">🤖 Bản gốc AI</span>
                                                )}
                                              </span>
                                              {isErrorsModified && orig && !isReadOnly && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateCriterion(originalIdx, { errors: orig.errors });
                                                  }}
                                                  className="text-[9px] font-bold text-amber-400/80 hover:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                  Khôi phục gốc
                                                </button>
                                              )}
                                            </div>
                                            <textarea
                                              readOnly={isReadOnly}
                                              value={c.errors.join('\n')}
                                              onChange={e => updateCriterion(originalIdx, { errors: splitLines(e.target.value) })}
                                              rows={4}
                                              className="mt-1.5 w-full px-3 py-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600 leading-relaxed disabled:opacity-60"
                                              placeholder="Các lỗi cụ thể phát hiện..."
                                            />
                                          </label>

                                          <label className="block">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                                                Gợi ý sửa đổi (Suggestions - mỗi dòng 1 ý) {isSuggestionsModified ? (
                                                  <span className="text-[9px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">✍️ Đã sửa</span>
                                                ) : (
                                                  <span className="text-[9px] font-medium text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded">🤖 Bản gốc AI</span>
                                                )}
                                              </span>
                                              {isSuggestionsModified && orig && !isReadOnly && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateCriterion(originalIdx, { suggestions: orig.suggestions });
                                                  }}
                                                  className="text-[9px] font-bold text-amber-400/80 hover:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                  Khôi phục gốc
                                                </button>
                                              )}
                                            </div>
                                            <textarea
                                              readOnly={isReadOnly}
                                              value={c.suggestions.join('\n')}
                                              onChange={e => updateCriterion(originalIdx, { suggestions: splitLines(e.target.value) })}
                                              rows={4}
                                              className="mt-1.5 w-full px-3 py-2 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-zinc-600 leading-relaxed disabled:opacity-60"
                                              placeholder="Hướng dẫn tác giả cách sửa..."
                                            />
                                          </label>
                                        </div>
                                      </div>

                                      {/* Original AI panel (Only visible when toggled) */}
                                      {showOriginal && orig && (
                                        <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-400 space-y-3 animate-fade-in select-none">
                                          <p className="font-bold text-amber-500/90 uppercase tracking-wider text-[9px] border-b border-zinc-800 pb-1.5 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Bản phân tích gốc do AI tạo ra (Chỉ đọc)
                                          </p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                              <p className="font-semibold text-zinc-300">Feedback của AI:</p>
                                              <p className="mt-1 whitespace-pre-wrap leading-relaxed bg-black/20 p-2.5 rounded border border-zinc-800/50 select-text">{orig.feedback || '—'}</p>

                                              <p className="font-semibold text-zinc-300 mt-2.5">Minh chứng của AI:</p>
                                              <p className="mt-1 whitespace-pre-wrap leading-relaxed bg-black/20 p-2.5 rounded border border-zinc-800/50 select-text">{orig.evidence || '—'}</p>
                                            </div>
                                            <div>
                                              <p className="font-semibold text-zinc-300">Lỗi do AI phát hiện:</p>
                                              <ul className="mt-1 list-disc pl-4 space-y-1 leading-relaxed select-text">
                                                {orig.errors.length > 0 ? orig.errors.map((x, i) => <li key={i}>{x}</li>) : <li className="italic">Không có lỗi nào</li>}
                                              </ul>

                                              <p className="font-semibold text-zinc-300 mt-2.5">Gợi ý sửa đổi từ AI:</p>
                                              <ul className="mt-1 list-disc pl-4 space-y-1 leading-relaxed select-text">
                                                {orig.suggestions.length > 0 ? orig.suggestions.map((x, i) => <li key={i}>{x}</li>) : <li className="italic">Không có gợi ý nào</li>}
                                              </ul>
                                            </div>
                                          </div>
                                          {!isReadOnly && (
                                            <div className="flex justify-end gap-2 pt-1 border-t border-zinc-800/30">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (confirm('Khôi phục toàn bộ Feedback, Evidence, Lỗi & Gợi ý từ bản AI gốc cho tiêu chí này?')) {
                                                    updateCriterion(originalIdx, {
                                                      feedback: orig.feedback,
                                                      evidence: orig.evidence,
                                                      errors: orig.errors,
                                                      suggestions: orig.suggestions
                                                    });
                                                  }
                                                }}
                                                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold border border-amber-500/20 transition-all text-[10px]"
                                              >
                                                Khôi phục bản gốc AI
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
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

                {/* Right Column (Col 3): Actions and Manuscript widget */}
                <div className="space-y-4">
                  {/* Actions & Feedback Card */}
                  <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3 shadow-sm">
                    <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-amber-500" />
                      Feedback gửi tác giả (tuỳ chọn)
                    </p>
                    <textarea
                      readOnly={isReadOnly}
                      value={feedbackMessage}
                      onChange={e => setFeedbackMessage(e.target.value)}
                      rows={5}
                      placeholder="Lời nhắn chân thành hoặc hướng dẫn định hướng phát triển thêm cho tác giả..."
                      className="w-full px-3 py-2.5 rounded-xl text-xs bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/40 transition-colors resize-none leading-relaxed disabled:opacity-60"
                    />
                    
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        onClick={() => void submitEdit(false)}
                        disabled={saving || isReadOnly}
                        className="h-10 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-98"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-zinc-400" />}
                        Lưu nháp Staff
                      </button>
                      <button
                        onClick={() => void submitEdit(true)}
                        disabled={saving || isReadOnly}
                        className="h-10 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 text-white disabled:opacity-60 transition-all hover:brightness-105 active:scale-98 shadow-md"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Phát hành cho Tác giả
                      </button>
                      {isReadOnly && (
                        <p className="text-[10px] text-center text-rose-400 font-semibold mt-1">
                          Không thể thay đổi vì report đã gửi đi.
                        </p>
                      )}
                    </div>
                  </div>

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

          {/* Fullscreen Wide Reader Modal */}
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
        </div>
      )}
    </MainLayout>
  );
}
