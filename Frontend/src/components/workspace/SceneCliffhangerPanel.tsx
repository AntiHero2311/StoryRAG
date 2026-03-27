import { useState } from 'react';
import { Scissors, Zap, Loader2, ChevronDown, ChevronRight, BookOpen, MessageCircle, Brain, ArrowRight, Eye, AlertCircle } from 'lucide-react';
import { aiAnalysisService, type AiSceneAnalysisResult, type AiCliffhangerResult, SCENE_TYPE_COLORS, getSceneTypeLabel } from '../../services/aiAnalysisService';

interface Props {
    projectId: string;
    chapterContent: string;
}

type ActiveView = 'scenes' | 'cliffhanger';

const SCENE_TYPE_ICONS: Record<string, React.ElementType> = {
    Action:        Zap,
    Dialogue:      MessageCircle,
    Introspection: Brain,
    Transition:    ArrowRight,
    Revelation:    Eye,
};

export default function SceneCliffhangerPanel({ projectId, chapterContent }: Props) {
    const [activeView, setActiveView] = useState<ActiveView>('scenes');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sceneResult, setSceneResult] = useState<AiSceneAnalysisResult | null>(null);
    const [cliffResult, setCliffResult] = useState<AiCliffhangerResult | null>(null);
    const [expandedScene, setExpandedScene] = useState<number | null>(null);

    const hasContent = chapterContent.trim().length >= 50;

    const analyze = async () => {
        if (!hasContent) {
            setError('Nội dung chương cần ít nhất 50 ký tự để phân tích.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (activeView === 'scenes') {
                const res = await aiAnalysisService.analyzeScenes(projectId, chapterContent);
                setSceneResult(res);
            } else {
                const res = await aiAnalysisService.analyzeCliffhanger(projectId, chapterContent);
                setCliffResult(res);
            }
        } catch (e: unknown) {
            setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {/* Tab switch */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-app)' }}>
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

            {/* Description */}
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                {activeView === 'scenes'
                    ? 'AI đọc nội dung chương hiện tại và phân chia thành các phân cảnh (Cảnh hành động, Đối thoại, Nội tâm...).'
                    : 'AI phân tích cấu trúc 3 hồi (Setup / Conflict / Climax) và phát hiện điểm Hạ hồi phân giải (Cliffhanger).'}
            </p>

            {/* Analyze button */}
            <button
                onClick={analyze}
                disabled={loading || !hasContent}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
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

            {/* Scene Results */}
            {activeView === 'scenes' && sceneResult && (
                <div className="flex flex-col gap-3">
                    {sceneResult.chapterSummary && (
                        <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span className="text-xs font-bold text-[var(--text-primary)]">Tóm tắt chương</span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{sceneResult.chapterSummary}</p>
                        </div>
                    )}
                    <p className="text-xs text-[var(--text-secondary)] font-semibold">{sceneResult.scenes.length} phân cảnh được phát hiện</p>
                    {sceneResult.scenes.map((scene, i) => {
                        const color = SCENE_TYPE_COLORS[scene.type] ?? '#6b7280';
                        const Icon = SCENE_TYPE_ICONS[scene.type] ?? BookOpen;
                        const isExpanded = expandedScene === i;
                        return (
                            <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                                <button
                                    className="w-full flex items-center gap-2 p-3 text-left"
                                    style={{ background: 'var(--bg-surface)' }}
                                    onClick={() => setExpandedScene(isExpanded ? null : i)}>
                                    <div className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0" style={{ background: `${color}22` }}>
                                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-[var(--text-primary)] block truncate">Cảnh {i + 1}: {scene.title}</span>
                                        <span className="text-[10px] font-medium" style={{ color }}>{getSceneTypeLabel(scene.type)}</span>
                                    </div>
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />}
                                </button>
                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-1 flex flex-col gap-2" style={{ background: 'var(--bg-app)' }}>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{scene.description}</p>
                                        {scene.openingLine && (
                                            <div className="rounded-lg p-2 border-l-2 pl-3" style={{ borderColor: color, background: `${color}10` }}>
                                                <p className="text-[10px] text-[var(--text-secondary)] italic">"{scene.openingLine}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Cliffhanger Results */}
            {activeView === 'cliffhanger' && cliffResult && (
                <div className="flex flex-col gap-3">
                    {/* Has cliffhanger badge */}
                    <div className="flex items-center gap-2 rounded-xl p-3" style={{
                        background: cliffResult.hasCliffhanger ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                        border: `1px solid ${cliffResult.hasCliffhanger ? 'rgba(249,115,22,0.25)' : 'rgba(34,197,94,0.25)'}`,
                    }}>
                        <Zap className="w-5 h-5 shrink-0" style={{ color: cliffResult.hasCliffhanger ? '#f97316' : '#22c55e' }} />
                        <div>
                            <p className="text-sm font-bold" style={{ color: cliffResult.hasCliffhanger ? '#f97316' : '#22c55e' }}>
                                {cliffResult.hasCliffhanger ? 'Chương có Cliffhanger' : 'Chương có Kết thúc hoàn chỉnh'}
                            </p>
                            {cliffResult.cliffhangerDescription && (
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{cliffResult.cliffhangerDescription}</p>
                            )}
                        </div>
                    </div>

                    {/* Cliffhanger quote */}
                    {cliffResult.cliffhangerQuote && (
                        <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', borderLeft: '3px solid #f97316' }}>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wider">Điểm rơi</p>
                            <p className="text-xs text-[var(--text-primary)] italic leading-relaxed">"{cliffResult.cliffhangerQuote}"</p>
                        </div>
                    )}

                    {/* 3 Acts */}
                    {[
                        { label: 'Hồi 1 — Thiết lập', value: cliffResult.actSetup, color: '#60a5fa' },
                        { label: 'Hồi 2 — Mâu thuẫn', value: cliffResult.actConflict, color: '#fb923c' },
                        { label: 'Hồi 3 — Cao trào', value: cliffResult.actClimax, color: '#f97316' },
                    ].filter(a => a.value).map(act => (
                        <div key={act.label} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            <p className="text-[10px] font-bold mb-1" style={{ color: act.color }}>{act.label}</p>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{act.value}</p>
                        </div>
                    ))}

                    {/* Structure feedback */}
                    {cliffResult.structureFeedback && (
                        <div className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <p className="text-xs font-bold text-[var(--text-primary)]">Nhận xét cấu trúc</p>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{cliffResult.structureFeedback}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
