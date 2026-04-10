import { useState, useEffect, useCallback } from 'react';
import { Scissors, Zap, Loader2, ChevronDown, ChevronRight, BookOpen, MessageCircle, Brain, ArrowRight, Eye, AlertCircle, History, Clock, X } from 'lucide-react';
import { aiAnalysisService, type AiSceneAnalysisResult, type AiCliffhangerResult, type AiAnalysisHistoryDto, SCENE_TYPE_COLORS, getSceneTypeLabel } from '../../services/aiAnalysisService';

interface Props {
    projectId: string;
    chapterId?: string | null;
    chapterContent: string;
    onHighlightScenes?: (quotes: { quote: string, color: string }[]) => void;
    onClearHighlights?: () => void;
}

type ActiveView = 'scenes' | 'cliffhanger';
type Mode = 'new' | 'history';

const SCENE_TYPE_ICONS: Record<string, React.ElementType> = {
    Action:        Zap,
    Dialogue:      MessageCircle,
    Introspection: Brain,
    Transition:    ArrowRight,
    Revelation:    Eye,
};

export default function SceneCliffhangerPanel({
    projectId,
    chapterId,
    chapterContent,
    onHighlightScenes,
    onClearHighlights,
}: Props) {
    const [activeView, setActiveView] = useState<ActiveView>('scenes');
    const [mode, setMode] = useState<Mode>('new');

    // New Analysis State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sceneResult, setSceneResult] = useState<AiSceneAnalysisResult | null>(null);
    const [cliffResult, setCliffResult] = useState<AiCliffhangerResult | null>(null);
    const [expandedScene, setExpandedScene] = useState<number | null>(null);

    // Active (clicked) scene — for click-to-highlight
    const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);

    // History State
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyItems, setHistoryItems] = useState<AiAnalysisHistoryDto[]>([]);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const hasContent = chapterContent.trim().length >= 50;

    // Load history whenever mode/view/chapter/project changes
    useEffect(() => {
        if (mode === 'history') {
            const typeParam = activeView === 'scenes' ? 'Scenes' : 'Cliffhanger';
            setHistoryLoading(true);
            setHistoryItems([]);
            setExpandedHistoryId(null);
            aiAnalysisService
                .getAnalysisHistory(projectId, typeParam, chapterId ?? undefined)
                .then(res => setHistoryItems(res.items))
                .catch(e => console.error('Failed to load history', e))
                .finally(() => setHistoryLoading(false));
        }
    }, [mode, activeView, projectId, chapterId]);

    // Clear highlights when switching away from a result
    useEffect(() => {
        setActiveSceneIndex(null);
        if (onClearHighlights) onClearHighlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneResult]);

    const analyze = async () => {
        if (!hasContent) {
            setError('Nội dung chương cần ít nhất 50 ký tự để phân tích.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (activeView === 'scenes') {
                const res = await aiAnalysisService.analyzeScenes(projectId, chapterContent, chapterId || undefined);
                setSceneResult(res);
            } else {
                const res = await aiAnalysisService.analyzeCliffhanger(projectId, chapterContent, chapterId || undefined);
                setCliffResult(res);
            }
        } catch (e: unknown) {
            setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    // Highlight a single scene and smoothly scroll the editor to it
    const handleSceneClick = useCallback((index: number, quote: string, color: string) => {
        if (activeSceneIndex === index) {
            // Second click = deselect
            setActiveSceneIndex(null);
            if (onClearHighlights) onClearHighlights();
            return;
        }

        setActiveSceneIndex(index);
        setExpandedScene(expandedScene === index ? index : index); // keep expanded

        if (onHighlightScenes && quote) {
            onHighlightScenes([{ quote, color }]);

            // After a short delay, scroll the highlighted mark into view
            setTimeout(() => {
                const mark = document.querySelector('.ai-highlight');
                if (mark) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [activeSceneIndex, expandedScene, onHighlightScenes, onClearHighlights]);

    const renderScenes = (result: AiSceneAnalysisResult, isHistoryMode = false) => (
        <div className="flex flex-col gap-3">
            {result.chapterSummary && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Tóm tắt chương</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{result.chapterSummary}</p>
                </div>
            )}
            <div className="flex items-center justify-between mb-1 mt-1">
                <p className="text-xs text-[var(--text-secondary)] font-semibold">{result.scenes.length} phân cảnh được phát hiện</p>
                <div className="flex items-center gap-2">
                    {activeSceneIndex !== null && onClearHighlights && !isHistoryMode && (
                        <button
                            onClick={() => {
                                setActiveSceneIndex(null);
                                onClearHighlights();
                            }}
                            className="text-[10px] font-bold text-rose-400 hover:underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Xóa highlight
                        </button>
                    )}
                    {onHighlightScenes && (
                        <button
                            onClick={() => {
                                setActiveSceneIndex(null);
                                const quotes = result.scenes.filter(s => s.exactQuote).map(s => ({
                                    quote: s.exactQuote,
                                    color: SCENE_TYPE_COLORS[s.type] ?? '#6b7280'
                                }));
                                onHighlightScenes(quotes);
                            }}
                            className="text-[10px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                        >
                            <Eye className="w-3 h-3" /> Hiện toàn bộ
                        </button>
                    )}
                </div>
            </div>

            {/* Hint text for click behavior */}
            {!isHistoryMode && onHighlightScenes && (
                <p className="text-[10px] text-[var(--text-secondary)] opacity-60 flex items-center gap-1 -mt-1 mb-1">
                    <Eye className="w-3 h-3" /> Bấm vào cảnh để highlight trong văn bản
                </p>
            )}

            {result.scenes.map((scene, i) => {
                const color = SCENE_TYPE_COLORS[scene.type] ?? '#6b7280';
                const Icon = SCENE_TYPE_ICONS[scene.type] ?? BookOpen;
                const isExpanded = isHistoryMode ? true : expandedScene === i;
                const isActive = !isHistoryMode && activeSceneIndex === i;

                return (
                    <div
                        key={i}
                        className="rounded-xl overflow-hidden transition-all duration-200"
                        style={{
                            border: isActive
                                ? `2px solid ${color}`
                                : '1px solid var(--border-color)',
                            boxShadow: isActive ? `0 0 12px ${color}33` : 'none',
                            transform: isActive ? 'scale(1.005)' : 'scale(1)',
                        }}
                    >
                        <button
                            className={`w-full flex items-center gap-2 p-3 text-left transition-all duration-150 ${!isHistoryMode ? 'cursor-pointer' : 'cursor-default'}`}
                            style={{
                                background: isActive ? `${color}18` : 'var(--bg-surface)',
                            }}
                            onClick={() => {
                                if (isHistoryMode) return;
                                // Toggle expand
                                setExpandedScene(isExpanded && activeSceneIndex === i ? null : i);
                                // Click-to-highlight
                                handleSceneClick(i, scene.exactQuote, color);
                            }}
                        >
                            <div
                                className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors"
                                style={{
                                    background: isActive ? `${color}33` : `${color}22`,
                                    border: isActive ? `1px solid ${color}55` : 'none',
                                }}
                            >
                                <Icon className="w-3.5 h-3.5" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[var(--text-primary)] block truncate">Cảnh {i + 1}: {scene.title}</span>
                                    {isActive && (
                                        <span
                                            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ background: `${color}22`, color }}
                                        >
                                            ● Đang xem
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium" style={{ color }}>{getSceneTypeLabel(scene.type)}</span>
                            </div>
                            {!isHistoryMode && (
                                isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                            )}
                        </button>
                        {isExpanded && (
                            <div
                                className="px-3 pb-3 pt-1 flex flex-col gap-2"
                                style={{ background: isActive ? `${color}08` : 'var(--bg-app)' }}
                            >
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{scene.description}</p>
                                {scene.exactQuote && (
                                    <div
                                        className="rounded-lg p-2 border-l-2 pl-3"
                                        style={{
                                            borderColor: color,
                                            background: `${color}${isActive ? '1a' : '10'}`,
                                        }}
                                    >
                                        <p className="text-[10px] text-[var(--text-secondary)] italic">"{scene.exactQuote}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderCliffhanger = (result: AiCliffhangerResult) => (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl p-3" style={{
                background: result.hasCliffhanger ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                border: `1px solid ${result.hasCliffhanger ? 'rgba(249,115,22,0.25)' : 'rgba(34,197,94,0.25)'}`,
            }}>
                <Zap className="w-5 h-5 shrink-0" style={{ color: result.hasCliffhanger ? '#f97316' : '#22c55e' }} />
                <div>
                    <p className="text-sm font-bold" style={{ color: result.hasCliffhanger ? '#f97316' : '#22c55e' }}>
                        {result.hasCliffhanger ? 'Chương có Cliffhanger' : 'Chương có Kết thúc hoàn chỉnh'}
                    </p>
                    {result.cliffhangerDescription && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{result.cliffhangerDescription}</p>
                    )}
                </div>
            </div>
            {result.cliffhangerQuote && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', borderLeft: '3px solid #f97316' }}>
                    <p className="text-[10px] text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">Điểm rơi</p>
                    <p className="text-xs text-[var(--text-primary)] italic leading-relaxed">"{result.cliffhangerQuote}"</p>
                </div>
            )}
            {[
                { label: 'Hồi 1 — Thiết lập', value: result.actSetup, color: '#60a5fa' },
                { label: 'Hồi 2 — Mâu thuẫn', value: result.actConflict, color: '#fb923c' },
                { label: 'Hồi 3 — Cao trào', value: result.actClimax, color: '#f97316' },
            ].filter(a => a.value).map(act => (
                <div key={act.label} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[10px] font-bold mb-1" style={{ color: act.color }}>{act.label}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{act.value}</p>
                </div>
            ))}
            {result.structureFeedback && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <p className="text-xs font-bold text-[var(--text-primary)]">Nhận xét cấu trúc</p>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{result.structureFeedback}</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 h-full pr-1">
            {/* View Switch */}
            <div className="flex gap-1 p-1 rounded-xl shrink-0" style={{ background: 'var(--bg-app)' }}>
                <button
                    onClick={() => setActiveView('scenes')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeView === 'scenes' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    <Scissors className="w-3.5 h-3.5" /> Phân rã Cảnh
                </button>
                <button
                    onClick={() => setActiveView('cliffhanger')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeView === 'cliffhanger' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    <Zap className="w-3.5 h-3.5" /> Hạ hồi Phân giải
                </button>
            </div>

            {/* Mode Switch */}
            <div className="flex gap-4 shrink-0 border-b border-[var(--border-color)]">
                <button
                    className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${mode === 'new' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'}`}
                    onClick={() => setMode('new')}>
                    <BookOpen className="w-3 h-3" /> Phân tích mới
                </button>
                <button
                    className={`pb-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${mode === 'history' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-b-2 border-transparent'}`}
                    onClick={() => setMode('history')}>
                    <History className="w-3 h-3" /> Lịch sử
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 pb-10">
                {mode === 'new' ? (
                    <div className="flex flex-col gap-3">
                        <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                            {activeView === 'scenes'
                                ? 'AI đọc nội dung chương hiện tại và phân chia thành các phân cảnh (Cảnh hành động, Đối thoại, Nội tâm...).'
                                : 'AI phân tích cấu trúc 3 hồi (Setup / Conflict / Climax) và phát hiện điểm Hạ hồi phân giải (Cliffhanger).'}
                        </p>

                        <button
                            onClick={analyze}
                            disabled={loading || !hasContent}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (activeView === 'scenes' ? <Scissors className="w-4 h-4" /> : <Zap className="w-4 h-4" />)}
                            {loading ? 'Đang phân tích...' : (activeView === 'scenes' ? 'Phân rã Cảnh' : 'Phân tích hồi truyện')}
                        </button>

                        {!hasContent && (
                            <p className="text-xs text-amber-500 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Nội dung chương quá ngắn để phân tích.
                            </p>
                        )}

                        {error && (
                            <div className="rounded-xl p-3 text-xs text-red-400 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                            </div>
                        )}

                        {activeView === 'scenes' && sceneResult && renderScenes(sceneResult, false)}
                        {activeView === 'cliffhanger' && cliffResult && renderCliffhanger(cliffResult)}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {historyLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 text-[var(--text-secondary)] gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-xs">Đang tải lịch sử...</span>
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-[var(--text-secondary)] gap-2">
                                <History className="w-6 h-6 opacity-30" />
                                <span className="text-xs">Chưa có lịch sử phân tích nào.</span>
                            </div>
                        ) : (
                            historyItems.map((item) => {
                                const isExpanded = expandedHistoryId === item.id;
                                let parsedResult: AiSceneAnalysisResult | AiCliffhangerResult | null = null;
                                try { parsedResult = JSON.parse(item.resultJson); } catch { /* ignore */ }

                                return (
                                    <div key={item.id} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                                        <button
                                            className="w-full flex items-center justify-between p-3"
                                            onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
                                                    {activeView === 'scenes' ? <Scissors className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />}
                                                </div>
                                                <div className="text-left flex flex-col items-start gap-1">
                                                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                                                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                                                        <Clock className="w-3 h-3" /> {item.totalTokens.toLocaleString()} tokens
                                                    </div>
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />}
                                        </button>

                                        {isExpanded && parsedResult && (
                                            <div className="p-3 border-t border-[var(--border-color)]" style={{ background: 'var(--bg-app)' }}>
                                                {activeView === 'scenes'
                                                    ? renderScenes(parsedResult as AiSceneAnalysisResult, true)
                                                    : renderCliffhanger(parsedResult as AiCliffhangerResult)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
