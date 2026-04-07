import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Sparkles, History, Bold,
    Italic, Underline,
    ChevronsLeft, ChevronsRight, Trash2, FileText, X,
    Undo2, Redo2, Save, Check, Loader2, Scissors,
    Clock, Pencil, GitBranch, Zap, Type, Bot,
    Map, Users, Tag, AlignLeft, BookOpen, Search, Wand2, AlertCircle,
    Download, Upload, Globe, MapPin, Shield, Scroll,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import RewritePanel from '../components/RewritePanel';
import ChatPanel from '../components/workspace/ChatPanel';
import ChatHistoryPanel from '../components/workspace/ChatHistoryPanel';
import AiWriterPanel from '../components/workspace/AiWriterPanel';
import TimelinePanel from '../components/workspace/TimelinePanel';
import SceneCliffhangerPanel from '../components/workspace/SceneCliffhangerPanel';

import {
    chapterService,
    type ChapterDetailResponse,
} from '../services/chapterService';
import { aiService } from '../services/aiService';
import { useEditorSettings, AVAILABLE_FONTS, AVAILABLE_SIZES } from '../hooks/useEditorSettings';
import {
    worldbuildingService,
    type WorldbuildingEntry,
    type CreateWorldbuildingRequest,
    WORLDBUILDING_CATEGORIES,
    getCategoryLabel,
    getCategoryColor,
    getCategoryPlaceholder,
} from '../services/worldbuildingService';
import {
    characterService,
    type CharacterEntry,
    type CreateCharacterRequest,
    CHARACTER_ROLES,
    getRoleInfo,
} from '../services/characterService';
import { projectService } from '../services/projectService';
import { exportService } from '../services/exportService';
import { genreService } from '../services/genreService';
import type { GenreResponse } from '../services/projectService';
import { styleGuideService, type StyleGuideEntry, type CreateStyleGuideRequest, STYLE_GUIDE_ASPECTS, getStyleGuideAspectLabel, getStyleGuideAspectColor } from '../services/styleGuideService';
import { themeService, type ThemeEntry, type CreateThemeRequest } from '../services/themeService';

import { useToast } from '../components/Toast';
import { diffWords } from 'diff';
import { DeleteConfirmationModal } from '../components/ui';
import { useDeleteConfirm } from '../hooks';

// ── Types ──────────────────────────────────────────────────────────────────

type SavedState = 'idle' | 'saving' | 'saved' | 'error';
type ActiveTab = 'chat' | 'history' | 'chatHistory' | 'worldbuilding' | 'characters' | 'genre' | 'synopsis' | 'aiInstructions' | 'styleGuide' | 'themes' | 'plotTimeline' | 'aiWriter' | 'sceneCliffhanger';

// ── Export Modal ───────────────────────────────────────────────────────────
function ExportModal({
    target, // 'project' or 'chapter'
    onClose,
    onExport,
    isLoading
}: {
    target: 'project' | 'chapter';
    onClose: () => void;
    onExport: (format: string) => void;
    isLoading: boolean;
}) {
    const formats = [
        { id: 'docx', label: 'Word (.docx)', icon: FileText, color: 'text-blue-500' },
        { id: 'txt', label: 'Text (.txt)', icon: AlignLeft, color: 'text-gray-500' },
        { id: 'md', label: 'Markdown (.md)', icon: BookOpen, color: 'text-gray-300' },
        { id: 'html', label: 'HTML (.html)', icon: Globe, color: 'text-orange-500' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
            <div className="w-full max-w-sm flex flex-col rounded-2xl overflow-hidden shadow-2xl p-5"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Download className="w-5 h-5 text-[var(--accent)]" /> 
                        Xuất {target === 'project' ? 'Toàn bộ truyện' : 'Chương hiện tại'}
                    </h3>
                    <button onClick={onClose} disabled={isLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {formats.map(fmt => {
                        const Icon = fmt.icon;
                        return (
                            <button key={fmt.id} onClick={() => onExport(fmt.id)} disabled={isLoading}
                                className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all disabled:opacity-50">
                                <Icon className={`w-8 h-8 ${fmt.color} mb-2`} />
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{fmt.label}</span>
                            </button>
                        );
                    })}
                </div>
                {isLoading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--accent)]">
                        <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo file xuất...
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Diff Modal ─────────────────────────────────────────────────────────────
function DiffModal({
    currentVersionNum,
    compareVersionNum,
    currentContent,
    compareContent,
    onClose,
    onRestore,
}: {
    currentVersionNum: number;
    compareVersionNum: number;
    currentContent: string;
    compareContent: string;
    onClose: () => void;
    onRestore: () => void;
}) {
    const diffs = diffWords(compareContent, currentContent);
    const added = diffs.filter(d => d.added).reduce((s, d) => s + d.count!, 0);
    const removed = diffs.filter(d => d.removed).reduce((s, d) => s + d.count!, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                        <GitBranch className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                            So sánh V{compareVersionNum} → V{currentVersionNum} (hiện tại)
                        </span>
                        <span className="text-xs text-emerald-400 font-medium">+{added} từ</span>
                        <span className="text-xs text-rose-400 font-medium">−{removed} từ</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onRestore}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                            <History className="w-3.5 h-3.5" /> Dùng V{compareVersionNum}
                        </button>
                        <button onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/10 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 px-5 py-2 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-app)]">
                    <span className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wider">Chú thích:</span>
                    <span className="flex items-center gap-1.5 text-xs">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500/25 border border-emerald-500/40 inline-block" />
                        <span className="text-emerald-400">Thêm vào (V{currentVersionNum})</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                        <span className="w-3 h-3 rounded-sm bg-rose-500/25 border border-rose-500/40 inline-block" />
                        <span className="text-rose-400">Đã xóa (V{compareVersionNum})</span>
                    </span>
                </div>
                {/* Diff content */}
                <div className="flex-1 overflow-y-auto p-6 leading-[2] text-sm font-[var(--editor-font,serif)] scrollbar-thin"
                    style={{ color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {diffs.map((part, i) => {
                        if (part.added) return (
                            <mark key={i} className="bg-emerald-500/20 text-emerald-300 rounded-sm px-[1px] not-italic">
                                {part.value}
                            </mark>
                        );
                        if (part.removed) return (
                            <del key={i} className="bg-rose-500/20 text-rose-300 rounded-sm px-[1px] no-underline line-through decoration-rose-400/60">
                                {part.value}
                            </del>
                        );
                        return <span key={i}>{part.value}</span>;
                    })}
                </div>
            </div>
        </div>
    );
}





export default function WorkspacePage() {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const toast = useToast();
    void Wand2; // reserved for future rewrite feature

    // ── Layout state ───────────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [storyBibleOpen, setStoryBibleOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

    // ── Editor settings (font) ─────────────────────────────────────────────
    const { settings: editorSettings, setFont, setFontSize } = useEditorSettings();
    const [fontPickerOpen, setFontPickerOpen] = useState(false);

    // ── Project state ──────────────────────────────────────────────────────
    const [projectTitle, setProjectTitle] = useState('Dự án');

    // ── Chapter state ──────────────────────────────────────────────────────
    const [chapters, setChapters] = useState<ChapterDetailResponse[]>([]);
    const [activeChapter, setActiveChapter] = useState<ChapterDetailResponse | null>(null);
    const [chapterTitle, setChapterTitle] = useState('');
    const [isLoadingChapters, setIsLoadingChapters] = useState(true);
    const [isCreatingChapter, setIsCreatingChapter] = useState(false);

    // ── Save/chunk state ───────────────────────────────────────────────────
    const [savedState, setSavedState] = useState<SavedState>('idle');
    const [wordCount, setWordCount] = useState(0);
    type AiSyncState = 'idle' | 'syncing' | 'ready' | 'error';
    const [aiSyncState, setAiSyncState] = useState<AiSyncState>('idle');

    // ── Version state ──────────────────────────────────────────────────────
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);
    const [renamingVersionNum, setRenamingVersionNum] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renamingChapterId, setRenamingChapterId] = useState<string | null>(null);
    const [renameChapterValue, setRenameChapterValue] = useState('');

    // ── Diff state ─────────────────────────────────────────────────────────
    const [diffModal, setDiffModal] = useState<{
        compareVersionNum: number;
        currentContent: string;
        compareContent: string;
    } | null>(null);

    // ── Export state ───────────────────────────────────────────────────────
    const [exportModal, setExportModal] = useState<{ open: boolean; target: 'project' | 'chapter' }>({ open: false, target: 'project' });
    const [isExporting, setIsExporting] = useState(false);

    // ── Delete confirmation ────────────────────────────────────────────────
    const deleteConfirm = useDeleteConfirm();

    // ── Highlighting State ─────────────────────────────────────────────────
    const [highlightsVisible, setHighlightsVisible] = useState(true);

    // Chat state is now managed inside ChatPanel / ChatHistoryPanel components


    // ── Rewrite state ──────────────────────────────────────────────────────
    const [rewritePanelOpen, setRewritePanelOpen] = useState(false);
    const [rewriteMode, setRewriteMode] = useState<'rewrite' | 'polish'>('rewrite');
    const [rewriteSelectedText, setRewriteSelectedText] = useState('');
    const [selectionToolbar, setSelectionToolbar] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
    const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Continue Writing ───────────────────────────────────────────────────
    const [isContinuingWriting, setIsContinuingWriting] = useState(false);

    // ── Refs ───────────────────────────────────────────────────────────────
    const editorRef = useRef<HTMLDivElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks last time chunk+embed ran — Ctrl+S cooldown to avoid spam
    const lastEmbedRef = useRef<number>(0);
    const isEmbeddingRef = useRef<boolean>(false);
    // Tracks which chapter is currently active to prevent stale async callbacks from overwriting it
    const activeChapterIdRef = useRef<string | null>(null);

    // ── Init ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        getUserInfo(token);
        const cached = sessionStorage.getItem(`project_${projectId}`);
        if (cached) setProjectTitle(JSON.parse(cached).title);
        if (projectId) loadChapters();
    }, [projectId]);

    // ── Load chapters ──────────────────────────────────────────────────────
    const loadChapters = async () => {
        if (!projectId) return;
        setIsLoadingChapters(true);
        try {
            const list = await chapterService.getChapters(projectId);
            // Load detail for each (or just first, rest lazily)
            if (list.length > 0) {
                const detail = await chapterService.getChapterDetail(projectId, list[0].id);
                const rest = list.slice(1).map(c => ({ ...c, content: null, versions: [] } as ChapterDetailResponse));
                const all = [detail, ...rest];
                setChapters(all);
                setActiveChapter(detail);
                setChapterTitle(detail.title ?? `Chương ${detail.chapterNumber}`);
                if (editorRef.current) {
                    editorRef.current.innerHTML = detail.content ?? '';
                }
            } else {
                setChapters([]);
                setActiveChapter(null);
            }
        } catch {
            // no chapters yet
        } finally {
            setIsLoadingChapters(false);
        }
    };

    // ── Add chapter ────────────────────────────────────────────────────────
    const addChapter = async () => {
        if (!projectId) return;
        setIsCreatingChapter(true);
        try {
            const nextNum = chapters.length > 0
                ? Math.max(...chapters.map(c => c.chapterNumber)) + 1
                : 1;
            const newChapter = await chapterService.createChapter(projectId, {
                chapterNumber: nextNum,
                title: `Chương ${nextNum}`,
                content: '',
            });
            setChapters(prev => [...prev, newChapter]);
            await selectChapter(newChapter);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể tạo chương mới.');
        } finally {
            setIsCreatingChapter(false);
        }
    };

    // ── Select chapter ─────────────────────────────────────────────────────
    const selectChapter = async (ch: ChapterDetailResponse) => {
        if (!projectId) return;
        // Mark intent early so stale background embeds won't overwrite after we switch
        activeChapterIdRef.current = ch.id;
        // Save current before switching
        if (activeChapter && editorRef.current && activeChapter.id !== ch.id) {
            if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
            await doSave(false);
        }
        // Load full detail if not already loaded
        let detail = ch;
        if (ch.content === null || ch.content === undefined) {
            detail = await chapterService.getChapterDetail(projectId, ch.id);
            setChapters(prev => prev.map(c => c.id === ch.id ? detail : c));
        }
        setActiveChapter(detail);
        setChapterTitle(detail.title ?? `Chương ${detail.chapterNumber}`);
        if (editorRef.current) {
            editorRef.current.innerHTML = detail.content ?? '';
            setWordCount((editorRef.current.innerText ?? '').trim().split(/\s+/).filter(Boolean).length);
        }
        // Reset version rename state
        setRenamingVersionNum(null);
    };

    // ── Delete chapter ─────────────────────────────────────────────────────
    const deleteChapter = async (chapterId: string) => {
        if (!projectId) return;
        
        const chapter = chapters.find(c => c.id === chapterId);
        const chapterName = chapter?.title || `Chương ${chapter?.chapterNumber}`;
        
        deleteConfirm.confirm({
            itemName: chapterName,
            itemType: 'chương',
            title: 'Xác nhận xóa chương',
            message: `Bạn có chắc chắn muốn xóa chương "${chapterName}"?\n\nToàn bộ nội dung và các phiên bản của chương này sẽ bị xóa vĩnh viễn.`,
            confirmText: 'Xóa chương',
            requireTyping: true,
            typingConfirmText: 'XOA',
            showWarnings: true,
            warnings: [
                'Tất cả các phiên bản của chương sẽ bị xóa',
                'Dữ liệu nhúng (embeddings) liên quan sẽ bị xóa',
                'Hành động này không thể hoàn tác',
            ],
            onConfirm: async () => {
                try {
                    await chapterService.deleteChapter(projectId, chapterId);
                    const remaining = chapters.filter(c => c.id !== chapterId);
                    setChapters(remaining);
                    if (activeChapter?.id === chapterId) {
                        const next = remaining[0] ?? null;
                        if (next) await selectChapter(next);
                        else {
                            setActiveChapter(null);
                            setChapterTitle('');
                            activeChapterIdRef.current = null;
                            if (editorRef.current) editorRef.current.innerText = '';
                        }
                    }
                    toast.success(`Đã xóa chương "${chapterName}"`);
                } catch (e: any) {
                    toast.error(e?.response?.data?.message ?? 'Không thể xóa chương.');
                    throw e; // Re-throw để DeleteConfirmationModal biết có lỗi
                }
            },
        });
    };

    // ── Export / Import chapter ─────────────────────────────────────────────
    const doExport = async (format: string) => {
        if (!projectId) return;
        setIsExporting(true);
        try {
            if (exportModal.target === 'chapter') {
                if (!activeChapter) return;
                await exportService.exportChapter(projectId, activeChapter.id, format);
            } else {
                await exportService.exportProject(projectId, format);
            }
            setExportModal({ ...exportModal, open: false });
            toast.success('Đã xuất file thành công.');
        } catch (e: any) {
            toast.error('Có lỗi xảy ra khi xuất file.');
        } finally {
            setIsExporting(false);
        }
    };

    // ── Continue Writing ────────────────────────────────────────────────────
    const handleContinueWriting = async () => {
        if (!projectId || !activeChapter || !editorRef.current) return;
        setIsContinuingWriting(true);
        try {
            const previousText = (editorRef.current.innerText || '').slice(-1500);
            const res = await aiService.continueWriting(
                projectId, 
                previousText, 
                "Hãy viết tiếp đoạn mạch truyện này một cách tự nhiên, chú ý giữ nguyên văn phong và nhịp truyện nội dung ở trên."
            );
            if (res.generatedText) {
                // Ensure there is some spacing before appending
                let textToAppend = res.generatedText;
                editorRef.current.innerHTML += `<br><br>${textToAppend.replace(/\n/g, '<br>')}`;
                updateWordCount();
                scheduleAutoSave();
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'AI không thể viết tiếp lúc này. Hãy thử lại.');
        } finally {
            setIsContinuingWriting(false);
        }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editorRef.current) return;
        if (!confirm('Nội dung hiện tại sẽ bị thay thế bằng nội dung từ file. Tiếp tục?')) {
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            if (editorRef.current) {
                // If importing plain text, we can use innerText to safely escape HTML
                editorRef.current.innerText = text;
                updateWordCount();
                scheduleAutoSave();
            }
        };
        reader.readAsText(file, 'utf-8');
        e.target.value = '';
    };

    // ── Rename chapter ─────────────────────────────────────────────────────
    const doRenameChapter = async (chapterId: string, newTitle: string) => {
        if (!projectId) return;
        const trimmed = newTitle.trim();
        if (!trimmed) { setRenamingChapterId(null); return; }
        const ch = chapters.find(c => c.id === chapterId);
        if (ch && (ch.title ?? `Chương ${ch.chapterNumber}`) === trimmed) {
            setRenamingChapterId(null);
            return;
        }
        try {
            const updated = await chapterService.renameChapter(projectId, chapterId, trimmed);
            setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: updated.title } : c));
            if (activeChapter?.id === chapterId) {
                setActiveChapter(prev => prev ? { ...prev, title: updated.title } : prev);
                setChapterTitle(updated.title ?? trimmed);
            }
            toast.success('Đã đổi tên chương.');
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể đổi tên chương.');
        } finally {
            setRenamingChapterId(null);
        }
    };

    // ── Highlighting logic ──────────────────────────────────────────────────
    const clearHighlights = useCallback(() => {
        if (!editorRef.current) return;
        let html = editorRef.current.innerHTML;
        if (!html.includes('ai-highlight')) return;
        html = html.replace(/<mark class="ai-highlight"[^>]*>/g, '');
        html = html.replace(/<\/mark>/g, '');
        editorRef.current.innerHTML = html;
        setHighlightsVisible(true);
    }, []);

    const highlightScenes = useCallback((scenes: { quote: string, color: string }[]) => {
        if (!editorRef.current) return;
        clearHighlights();
        let html = editorRef.current.innerHTML;
        let hasChanges = false;
        scenes.forEach(scene => {
            if (!scene.quote || scene.quote.length < 5) return;
            const targetHtml = scene.quote.replace(/\n/g, '<br>');
            const escaped = targetHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'g');
            if (regex.test(html)) {
                html = html.replace(regex, `<mark class="ai-highlight" style="background-color: ${scene.color}66; color: inherit; padding: 2px 0; border-radius: 4px; transition: background-color 0.2s;">$1</mark>`);
                hasChanges = true;
            } else {
                const shortTarget = targetHtml.substring(0, 40);
                if (shortTarget.length >= 10 && html.includes(shortTarget)) {
                    const escapedShort = shortTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regexShort = new RegExp(`(${escapedShort}[^<]*)`, 'g'); 
                    html = html.replace(regexShort, `<mark class="ai-highlight" style="background-color: ${scene.color}66; color: inherit; padding: 2px 0; border-radius: 4px; transition: background-color 0.2s;">$1</mark>`);
                    hasChanges = true;
                }
            }
        });
        if (hasChanges) {
            editorRef.current.innerHTML = html;
            setHighlightsVisible(true);
        }
    }, [clearHighlights]);

    // ── Save → background Chunk + Embed ──────────────────────────────────
    const doSave = useCallback(async (showFeedback = true) => {
        if (!projectId || !activeChapter || !editorRef.current) return;
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        // Strip highlighting tags before saving
        let content = editorRef.current.innerHTML ?? '';
        content = content.replace(/<mark class="ai-highlight"[^>]*>/g, '').replace(/<\/mark>/g, '');
        if (showFeedback) setSavedState('saving');
        try {
            const updated = await chapterService.updateChapter(projectId, activeChapter.id, {
                title: chapterTitle || `Chương ${activeChapter.chapterNumber}`,
                content,
            });
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (showFeedback) {
                setSavedState('saved');
                setTimeout(() => setSavedState('idle'), 2000);
            }
            // Background chunk + embed (skip if already in progress)
            if (!isEmbeddingRef.current) {
                isEmbeddingRef.current = true;
                const embeddingChapterId = updated.id;
                setAiSyncState('syncing');
                (async () => {
                    try {
                        await chapterService.chunkChapter(projectId, embeddingChapterId);
                        await aiService.embedChapter(embeddingChapterId);
                        lastEmbedRef.current = Date.now();
                        const embedded = await chapterService.getChapterDetail(projectId, embeddingChapterId);
                        setChapters(prev => prev.map(c => c.id === embedded.id ? embedded : c));
                        // Only update active chapter if user hasn't switched away
                        if (activeChapterIdRef.current === embeddingChapterId) {
                            setActiveChapter(embedded);
                        }
                        setAiSyncState('ready');
                        // Auto-reset to idle after 30s
                        setTimeout(() => setAiSyncState('idle'), 30_000);
                    } catch {
                        setAiSyncState('error');
                        setTimeout(() => setAiSyncState('idle'), 10_000);
                    } finally {
                        isEmbeddingRef.current = false;
                    }
                })();
            }
            return updated;
        } catch {
            if (showFeedback) setSavedState('error');
            return null;
        }
    }, [projectId, activeChapter, chapterTitle]);

    // ── Debounced auto-save (in-place) ─────────────────────────────────────
    const scheduleAutoSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { doSave(false); }, 4000);
    }, [doSave]);

    // ── Ctrl+S shortcut ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                doSave(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [doSave]);

    // ── Selection toolbar (floating, inside editor) ────────────────────────
    useEffect(() => {
        const handleSelection = () => {
            if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
            selectionTimerRef.current = setTimeout(() => {
                const sel = window.getSelection();
                const text = sel?.toString().trim() ?? '';
                if (!text || text.length < 5 || !editorRef.current?.contains(sel?.anchorNode ?? null)) {
                    setSelectionToolbar(prev => ({ ...prev, visible: false }));
                    return;
                }
                const range = sel!.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelectionToolbar({
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                });
            }, 200);
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => {
            document.removeEventListener('selectionchange', handleSelection);
            if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
        };
    }, []);

    // AI Chat logic is now inside ChatPanel / ChatHistoryPanel components

    // ── Create new version ─────────────────────────────────────────────────
    const doCreateVersion = async () => {
        if (!projectId || !activeChapter) return;
        // Save current first
        await doSave(false);
        setIsCreatingVersion(true);
        try {
            const updated = await chapterService.createNewVersion(projectId, activeChapter.id, {});
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (editorRef.current) editorRef.current.innerHTML = '';
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể tạo phiên bản mới.');
        } finally {
            setIsCreatingVersion(false);
        }
    };

    // ── Switch to a different version ──────────────────────────────────────
    const doSwitchVersion = async (versionNumber: number) => {
        if (!projectId || !activeChapter) return;
        if (activeChapter.currentVersionNum === versionNumber) return;
        // Save current first
        await doSave(false);
        try {
            const updated = await chapterService.setActiveVersion(projectId, activeChapter.id, versionNumber);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (editorRef.current) editorRef.current.innerHTML = updated.content ?? '';
            setWordCount((editorRef.current?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể chuyển phiên bản.');
        }
    };

    // ── Delete version ─────────────────────────────────────────────────────
    const doDeleteVersion = async (versionNumber: number) => {
        if (!projectId || !activeChapter) return;
        if (!confirm(`Xóa phiên bản ${versionNumber}?`)) return;
        try {
            await chapterService.deleteVersion(projectId, activeChapter.id, versionNumber);
            const updated = await chapterService.getChapterDetail(projectId, activeChapter.id);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (editorRef.current) editorRef.current.innerText = updated.content ?? '';
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể xóa phiên bản.');
        }
    };

    // ── Rename version ─────────────────────────────────────────────────────
    const doRenameVersion = async (versionNumber: number) => {
        if (!projectId || !activeChapter || !renameValue.trim()) {
            setRenamingVersionNum(null);
            return;
        }
        try {
            const updatedVersion = await chapterService.updateVersionTitle(projectId, activeChapter.id, versionNumber, renameValue.trim());
            setActiveChapter(prev => prev ? {
                ...prev,
                versions: prev.versions.map(v => v.versionNumber === versionNumber ? { ...v, title: updatedVersion.title } : v)
            } : prev);
        } catch { /* silent */ } finally {
            setRenamingVersionNum(null);
        }
    };

    const doTogglePin = async (versionNumber: number) => {
        if (!projectId || !activeChapter) return;
        try {
            const updated = await chapterService.pinVersion(projectId, activeChapter.id, versionNumber);
            setActiveChapter(prev => prev ? {
                ...prev,
                versions: prev.versions.map(v => v.versionNumber === versionNumber ? { ...v, isPinned: updated.isPinned } : v)
            } : prev);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể ghim phiên bản.');
        }
    };

    const doCompareVersion = async (versionNumber: number) => {
        if (!projectId || !activeChapter) return;
        try {
            const currentContent = editorRef.current?.innerHTML ?? '';
            const compareContent = await chapterService.getVersionContent(projectId, activeChapter.id, versionNumber);
            setDiffModal({ compareVersionNum: versionNumber, currentContent, compareContent });
        } catch (e: any) {
            toast.error('Không thể tải nội dung phiên bản.');
        }
    };

    const execFormat = (command: string, value?: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
    };

    const getWordCount = () =>
        (editorRef.current?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length;

    const updateWordCount = () => {
        setWordCount(getWordCount());
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)]">

            {/* ── Floating selection toolbar ── */}
            {selectionToolbar.visible && !rewritePanelOpen && (
                <div
                    className="fixed z-40 -translate-x-1/2 -translate-y-full flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-xl"
                    style={{
                        left: selectionToolbar.x,
                        top: selectionToolbar.y,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                    }}
                    onMouseDown={e => e.preventDefault()}
                >
                    <button
                        onClick={() => {
                            const sel = window.getSelection()?.toString().trim() ?? '';
                            if (sel.length >= 5) {
                                setRewriteSelectedText(sel);
                                setRewriteMode('rewrite');
                                setRewritePanelOpen(true);
                                setSelectionToolbar(prev => ({ ...prev, visible: false }));
                            }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                        <Wand2 className="w-3 h-3" />
                        Viết lại
                    </button>
                    <div className="w-px h-3 bg-[var(--border-color)] mx-1" />
                    <button
                        onClick={() => {
                            const sel = window.getSelection()?.toString().trim() ?? '';
                            if (sel.length >= 5) {
                                setRewriteSelectedText(sel);
                                setRewriteMode('polish');
                                setRewritePanelOpen(true);
                                setSelectionToolbar(prev => ({ ...prev, visible: false }));
                            }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
                    >
                        <Sparkles className="w-3 h-3" />
                        Trau chuốt
                    </button>
                </div>
            )}

            {/* ── Export Modal ── */}
            {exportModal.open && (
                <ExportModal
                    target={exportModal.target}
                    isLoading={isExporting}
                    onClose={() => setExportModal({ ...exportModal, open: false })}
                    onExport={doExport}
                />
            )}

            {/* ── Rewrite Panel ── */}
            {rewritePanelOpen && (
                <RewritePanel
                    projectId={projectId!}
                    chapterId={activeChapter?.id}
                    selectedText={rewriteSelectedText}
                    mode={rewriteMode}
                    onAccept={(rewritten) => {
                        // Replace selected text in editor
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(document.createTextNode(rewritten));
                            sel.removeAllRanges();
                        }
                        updateWordCount();
                        scheduleAutoSave();
                    }}
                    onClose={() => setRewritePanelOpen(false)}
                />
            )}

            {/* ── Top Nav ── */}
            <nav className="flex items-center gap-4 px-5 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-topbar)]" style={{ height: '60px' }}>
                <button
                    onClick={() => navigate('/projects')}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium group shrink-0"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-[var(--text-primary)] font-bold text-[15px] truncate max-w-xs tracking-tight">{projectTitle}</span>
                    <button
                        onClick={() => setExportModal({ open: true, target: 'project' })}
                        className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/10 transition-colors"
                    >
                        <Download className="w-3 h-3" /> Xuất dự án
                    </button>
                </div>

                <div className="flex-1" />

                {/* AI Sync status indicator */}
                {activeChapter && aiSyncState !== 'idle' && (
                    <div
                        title={
                            aiSyncState === 'syncing' ? '⏳ AI đang đồng bộ dữ liệu...' :
                                aiSyncState === 'ready' ? '✨ AI đã sẵn sàng' :
                                    '⚠️ Đồng bộ thất bại'
                        }
                        className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all"
                        style={{
                            background: aiSyncState === 'error'
                                ? 'rgba(239,68,68,0.1)'
                                : 'var(--accent-subtle)',
                            color: aiSyncState === 'error'
                                ? 'rgb(239,68,68)'
                                : 'var(--accent)',
                        }}
                    >
                        {aiSyncState === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {aiSyncState === 'ready' && <Sparkles className="w-3 h-3" />}
                        {aiSyncState === 'error' && <AlertCircle className="w-3 h-3" />}
                        <span>
                            {aiSyncState === 'syncing' ? 'Đồng bộ AI...' :
                                aiSyncState === 'ready' ? 'AI sẵn sàng' :
                                    'Lỗi đồng bộ'}
                        </span>
                    </div>
                )}

                {/* Save status */}
                <div className="shrink-0 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {savedState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>Đang lưu...</span></>}
                    {savedState === 'saved' && <><Check className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 font-medium">Đã lưu</span></>}
                    {savedState === 'error' && <><AlertCircle className="w-4 h-4 text-rose-400" /><span className="text-rose-400 font-medium">Lưu thất bại</span></>}
                    {savedState === 'idle' && activeChapter && (
                        <button
                            onClick={() => doSave(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Save className="w-3.5 h-3.5" /> Lưu ngay
                        </button>
                    )}
                </div>
            </nav>

            {/* ── Three Panels ── */}
            <div className="flex flex-1 min-h-0 gap-3 px-3 pb-3">

                {/* Left Sidebar */}
                <aside
                    className="flex flex-col h-full transition-all duration-300 overflow-hidden shrink-0 rounded-2xl relative"
                    style={{
                        width: sidebarCollapsed ? '0px' : '280px',
                        background: 'var(--bg-sidebar)',
                        border: sidebarCollapsed ? 'none' : '1px solid var(--border-color)',
                        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.2)'
                    }}
                >
                    <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
                        <span className="text-[var(--text-secondary)] text-[11px] font-bold uppercase tracking-widest opacity-80">Mục lục</span>
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition-all"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 scrollbar-thin">
                        {isLoadingChapters ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
                            </div>
                        ) : chapters.length === 0 ? (
                            <div className="flex flex-col items-center py-10 gap-3 opacity-50">
                                <FileText className="w-8 h-8 text-[var(--text-secondary)]" />
                                <p className="text-center text-[var(--text-secondary)] text-sm font-medium">Chưa có chương nào</p>
                            </div>
                        ) : (
                            chapters.map((ch) => {
                                const isActive = activeChapter?.id === ch.id;
                                return (
                                    <div
                                        key={ch.id}
                                        onClick={() => renamingChapterId !== ch.id && selectChapter(ch)}
                                        className={`group relative w-full flex flex-col gap-1.5 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent ${isActive
                                            ? 'bg-[var(--accent)]/10 border-[var(--accent)]/20 shadow-sm'
                                            : 'hover:bg-[var(--bg-surface)] hover:border-[var(--border-color)]'
                                            }`}
                                    >
                                        {/* Active Indicator Line */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[var(--accent)]" />
                                        )}

                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2 max-w-[80%]">
                                                <span className={`flex items-center justify-center w-6 h-6 rounded bg-[var(--bg-app)] text-[10px] font-bold ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                                                    {ch.chapterNumber}
                                                </span>
                                                {renamingChapterId === ch.id ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={renameChapterValue}
                                                        onChange={e => setRenameChapterValue(e.target.value)}
                                                        onBlur={() => doRenameChapter(ch.id, renameChapterValue)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') { e.preventDefault(); doRenameChapter(ch.id, renameChapterValue); }
                                                            if (e.key === 'Escape') { e.preventDefault(); setRenamingChapterId(null); }
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                        className="w-full text-sm font-bold bg-[var(--bg-primary)] border border-[var(--accent)] rounded px-1.5 py-0.5 text-[var(--text-primary)] outline-none"
                                                    />
                                                ) : (
                                                    <p className={`text-sm font-bold truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                                        {ch.title ?? `Chương ${ch.chapterNumber}`}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Context Menu Hook */}
                                            {renamingChapterId !== ch.id && (
                                                <div className="opacity-0 group-hover:opacity-100 flex flex-col items-center gap-1 transition-opacity bg-[var(--bg-surface)] rounded-md shadow p-0.5 border border-[var(--border-color)] absolute right-2 top-2 z-10">
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setRenameChapterValue(ch.title ?? `Chương ${ch.chapterNumber}`);
                                                            setRenamingChapterId(ch.id);
                                                        }}
                                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--text-primary)]/10 text-[var(--text-primary)] transition-colors"
                                                        title="Đổi tên"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}
                                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                                                        title="Xóa chương"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 pl-8">
                                            <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-80 bg-[var(--bg-app)] px-1.5 py-0.5 rounded">
                                                {ch.wordCount} từ
                                            </span>
                                            <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-80 bg-[var(--bg-app)] px-1.5 py-0.5 rounded">
                                                v{ch.currentVersionNum}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="px-4 py-3 shrink-0 border-t border-[var(--border-color)]">
                        <button
                            onClick={addChapter}
                            disabled={isCreatingChapter}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-lg shadow-[var(--accent)]/20"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                        >
                            {isCreatingChapter
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Plus className="w-4 h-4" />}
                            Chương mới
                        </button>
                    </div>

                    {/* ── Cẩm Nang Truyện (Story Bible) ── */}
                    <div className="px-2 pb-3 pt-1 shrink-0 flex flex-col min-h-0 max-h-[50vh]">
                        <div className="rounded-2xl overflow-hidden flex flex-col min-h-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            {/* Header row with toggle */}
                            <button
                                onClick={() => setStoryBibleOpen(o => !o)}
                                className="w-full shrink-0 flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--text-primary)]/5"
                                style={{ borderBottom: storyBibleOpen ? '1px solid var(--border-color)' : 'none' }}
                            >
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="flex-1 text-xs font-bold text-[var(--text-primary)] text-left">Cẩm Nang Truyện</span>
                                {/* iOS-style toggle */}
                                <div
                                    className="relative shrink-0 rounded-full transition-colors"
                                    style={{ width: '32px', height: '18px', background: storyBibleOpen ? '#6366f1' : 'var(--border-color)' }}
                                >
                                    <div
                                        className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all"
                                        style={{ left: storyBibleOpen ? '16px' : '2px' }}
                                    />
                                </div>
                            </button>

                            {/* Items */}
                            {storyBibleOpen && (
                                <div className="py-1 overflow-y-auto scrollbar-thin min-h-0">
                                    {([
                                        { tab: 'genre' as ActiveTab, label: 'Thể loại', desc: 'Định dạng thể loại truyền tải (Fantasy, Sci-Fi...)', icon: Tag, color: '#818cf8' },
                                        { tab: 'synopsis' as ActiveTab, label: 'Tóm tắt', desc: 'Nắm bắt nhanh diễn biến & cốt truyện trọng tâm', icon: AlignLeft, color: '#c084fc' },
                                        { tab: 'characters' as ActiveTab, label: 'Nhân vật', desc: 'Lưu trữ hồ sơ, tính cách và thiết lập năng lực', icon: Users, color: '#f472b6' },
                                        { tab: 'worldbuilding' as ActiveTab, label: 'Thế giới', desc: 'Xây dựng bối cảnh, địa lý, và quy tắc phép thuật', icon: Map, color: 'var(--accent)' },
                                        { tab: 'styleGuide' as ActiveTab, label: 'Phong cách', desc: 'Thiết lập quy tắc, giọng văn và góc nhìn (POV)', icon: Zap, color: '#f59e0b' },
                                        { tab: 'themes' as ActiveTab, label: 'Chủ đề', desc: 'Ghi chú thông điệp cốt lõi và ẩn ý tác phẩm', icon: Sparkles, color: '#10b981' },
                                        { tab: 'plotTimeline' as ActiveTab, label: 'Tuyến truyện', desc: 'Cấu trúc cốt truyện & trình tự sự kiện', icon: Map, color: '#f59e0b' },
                                        { tab: 'aiInstructions' as ActiveTab, label: 'Ghi chú AI', desc: 'Cung cấp bối cảnh đặc biệt để AI hiểu đúng ý', icon: Bot, color: '#34d399' },
                                        { tab: 'aiWriter' as ActiveTab, label: 'AI Writer', desc: 'Trợ lý AI giúp viết, trau chuốt và nảy ý tưởng', icon: Wand2, color: '#ec4899' },
                                        { tab: 'sceneCliffhanger' as ActiveTab, label: 'Phân tích Cảnh', desc: 'Phân rã chương & phát hiện điểm rơi kịch tính', icon: Scissors, color: '#f97316' },
                                    ] as const).map(item => {
                                        const isActive = activeTab === item.tab && rightPanelOpen;
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.tab}
                                                onClick={() => { setActiveTab(item.tab); setRightPanelOpen(true); }}
                                                title={`${item.label}: ${item.desc}`}
                                                className="w-full flex items-start gap-3 px-3 py-2.5 transition-all outline-none"
                                                style={{
                                                    background: isActive ? `${item.color}15` : 'transparent',
                                                    color: isActive ? item.color : 'var(--text-secondary)',
                                                    borderLeft: `2px solid ${isActive ? item.color : 'transparent'}`
                                                }}
                                            >
                                                <div className="shrink-0 mt-[2px]">
                                                    <Icon className="w-4 h-4" style={{ color: isActive ? item.color : 'var(--text-tertiary)' }} />
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <span className={`block text-[13px] font-semibold tracking-wide ${isActive ? '' : 'text-[var(--text-primary)] group-hover:text-[var(--accent)]'}`} style={{ color: isActive ? item.color : '' }}>{item.label}</span>
                                                    <span className="block text-[11px] text-[var(--text-tertiary)] opacity-80 mt-0.5 leading-snug line-clamp-2">
                                                        {item.desc}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Sidebar reveal */}
                {sidebarCollapsed && (
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="w-9 h-9 self-start mt-2 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                )}

                {/* Center - Editor & Boards */}
                <div className="flex flex-col flex-1 min-h-0 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <div className={activeTab === 'plotTimeline' && projectId ? "flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col bg-[var(--bg-app)]" : "hidden"}>
                        {projectId && <TimelinePanel projectId={projectId} />}
                    </div>
                    
                    <div className={activeTab !== 'plotTimeline' ? "flex-1 min-h-0 flex flex-col min-w-0" : "hidden"}>
                        <>
                            {/* Toolbar */}
                            <div className="h-[48px] shrink-0 flex items-center gap-1 px-4 border-b border-[var(--border-color)]" style={{ background: 'var(--bg-topbar)' }}>
                                <ToolbarBtn icon={<Undo2 className="w-4 h-4" />} title="Hoàn tác (Ctrl+Z)" onClick={() => execFormat('undo')} />
                                <ToolbarBtn icon={<Redo2 className="w-4 h-4" />} title="Làm lại (Ctrl+Y)" onClick={() => execFormat('redo')} />
                                <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
                                <ToolbarBtn icon={<Bold className="w-4 h-4" />} title="In đậm (Ctrl+B)" onClick={() => execFormat('bold')} />
                                <ToolbarBtn icon={<Italic className="w-4 h-4" />} title="In nghiêng (Ctrl+I)" onClick={() => execFormat('italic')} />
                                <ToolbarBtn icon={<Underline className="w-4 h-4" />} title="Gạch dưới (Ctrl+U)" onClick={() => execFormat('underline')} />
                                <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
                                {/* Font family picker */}
                                <div className="relative">
                                    <button
                                        onClick={() => setFontPickerOpen(o => !o)}
                                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs transition-all"
                                        title="Chọn font chữ"
                                        style={{
                                            fontFamily: `'${editorSettings.editorFont}', sans-serif`,
                                            background: fontPickerOpen ? 'rgba(139,92,246,0.1)' : 'transparent',
                                            color: fontPickerOpen ? 'var(--accent)' : 'var(--text-secondary)',
                                            border: fontPickerOpen ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                                        }}>
                                        <Type className="w-3.5 h-3.5 shrink-0" />
                                        <span className="max-w-[90px] truncate ml-1">{editorSettings.editorFont}</span>
                                    </button>
                                    {fontPickerOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setFontPickerOpen(false)} />
                                            <div className="absolute top-full left-0 mt-1.5 z-50 rounded-2xl shadow-2xl overflow-hidden"
                                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', minWidth: '220px' }}>
                                                <div className="px-4 pt-3 pb-1">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Font chữ</p>
                                                </div>
                                                <div className="pb-3">
                                                    {AVAILABLE_FONTS.map(f => {
                                                        const active = editorSettings.editorFont === f.name;
                                                        return (
                                                            <button key={f.name}
                                                                onClick={() => { setFont(f.name); setFontPickerOpen(false); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2 transition-colors"
                                                                style={{ background: active ? 'rgba(139,92,246,0.08)' : 'transparent' }}
                                                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-bg)'; }}
                                                                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                                                                <span className="w-8 text-center text-base font-semibold shrink-0"
                                                                    style={{ fontFamily: `'${f.name}', serif`, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                                                    Aa
                                                                </span>
                                                                <span className="text-sm flex-1 text-left"
                                                                    style={{ fontFamily: `'${f.name}', serif`, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                                    {f.label}
                                                                </span>
                                                                {active && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* Font size — outside dropdown */}
                                <div className="flex items-center gap-0.5 ml-1">
                                    <button
                                        onClick={() => { const sizes = AVAILABLE_SIZES; const i = sizes.indexOf(editorSettings.editorFontSize); if (i > 0) setFontSize(sizes[i - 1]); }}
                                        className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-xs font-bold"
                                        title="Giảm cỡ chữ">
                                        A
                                    </button>
                                    <span className="text-[var(--text-secondary)] text-xs w-6 text-center tabular-nums">{editorSettings.editorFontSize}</span>
                                    <button
                                        onClick={() => { const sizes = AVAILABLE_SIZES; const i = sizes.indexOf(editorSettings.editorFontSize); if (i < sizes.length - 1) setFontSize(sizes[i + 1]); }}
                                        className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-bold"
                                        title="Tăng cỡ chữ">
                                        A
                                    </button>
                                </div>
                                <div className="flex-1" />
                                <span className="text-[var(--text-secondary)] text-xs mr-2">{wordCount} từ</span>
                                {activeChapter && (
                                    <>
                                        <button
                                            onClick={() => setExportModal({ open: true, target: 'chapter' })}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5"
                                            title="Xuất chương"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => importFileRef.current?.click()}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5"
                                            title="Nhập chương từ file (.txt)"
                                        >
                                            <Upload className="w-4 h-4" />
                                        </button>
                                        <input
                                            ref={importFileRef}
                                            type="file"
                                            accept=".txt"
                                            className="hidden"
                                            onChange={handleImportFile}
                                        />
                                    </>
                                )}
                                <button
                                    onClick={() => setRightPanelOpen(o => !o)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-1 ${rightPanelOpen ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'}`}
                                    title="AI Assistant"
                                >
                                    <Sparkles className="w-4 h-4" />
                                </button>
                            </div>
        
                            {/* Writing area */}
                            <div className="flex-1 overflow-y-auto flex justify-center p-6 lg:p-12 scrollbar-thin">
                                <div className="w-full max-w-3xl">
                                    {activeChapter ? (
                                        <>
                                            {/* Chapter title input */}
                                            <input
                                                type="text"
                                                value={chapterTitle}
                                                onChange={e => setChapterTitle(e.target.value)}
                                                onBlur={() => {
                                                    if (activeChapter && projectId && chapterTitle.trim() &&
                                                        chapterTitle !== (activeChapter.title ?? `Chương ${activeChapter.chapterNumber}`)) {
                                                        doRenameChapter(activeChapter.id, chapterTitle);
                                                    }
                                                }}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                className="w-full text-4xl font-extrabold text-[var(--text-primary)] bg-transparent outline-none mb-4 placeholder-[var(--text-secondary)]/30 border-b-2 border-transparent focus:border-[var(--accent)]/20 pb-2 transition-colors"
                                                style={{ fontFamily: `'${editorSettings.editorFont}', sans-serif`, letterSpacing: '-0.02em' }}
                                                placeholder="Nhập tên chương..."
                                            />
                                            {/* Meta bar */}
                                            <div className="flex items-center gap-3 mb-8">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-app)] border border-[var(--border-color)]">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                    <span className="text-[11px] font-bold text-[var(--text-secondary)]">V{activeChapter.currentVersionNum}</span>
                                                </div>
                                                <button
                                                    onClick={() => { setActiveTab('history'); setRightPanelOpen(true); }}
                                                    className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1"
                                                >
                                                    <History className="w-3 h-3" />
                                                    {(activeChapter.versions ?? []).length} phiên bản
                                                </button>
                                                <span className="text-[11px] text-[var(--text-secondary)] opacity-50">•</span>
                                                <span className="text-[11px] font-medium text-[var(--text-secondary)] inline-flex items-center gap-1">
                                                    <AlignLeft className="w-3 h-3" />
                                                    {wordCount} từ
                                                </span>
        
                                                <div className="flex-1" />
        
                                                <button
                                                    onClick={handleContinueWriting}
                                                    disabled={isContinuingWriting}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-md shadow-[var(--accent)]/10 disabled:opacity-50"
                                                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                                                    title="AI đọc 1500 ký tự cuối và viết tiếp"
                                                >
                                                    {isContinuingWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                                                    AI Viết tiếp
                                                </button>
                                            </div>
                                            {/* Editor */}
                                            <div
                                                ref={editorRef}
                                                contentEditable
                                                suppressContentEditableWarning
                                                onInput={() => { updateWordCount(); scheduleAutoSave(); setHighlightsVisible(false); }}
                                                className={`w-full min-h-[60vh] text-[var(--text-primary)] bg-transparent outline-none leading-[1.9] focus:outline-none ${!highlightsVisible ? 'hide-ai-highlights' : ''}`}
                                                style={{ fontFamily: `'${editorSettings.editorFont}', sans-serif`, fontSize: `${editorSettings.editorFontSize}px`, letterSpacing: '0.01em' }}
                                                data-placeholder="Bắt đầu viết tác phẩm của bạn tại đây..."
                                            />
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-[60vh] gap-5 text-center px-4">
                                            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl flex items-center justify-center relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/20 to-transparent rounded-3xl" />
                                                <Wand2 className="w-10 h-10 text-[var(--text-primary)] relative z-10" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-xl text-[var(--text-primary)] font-bold tracking-tight">Hành trình bắt đầu</p>
                                                <p className="text-[var(--text-secondary)] text-sm max-w-sm">Tạo chương đầu tiên để bắt đầu viết tác phẩm của bạn. AI Copilot đã sẵn sàng hỗ trợ.</p>
                                            </div>
                                            <button
                                                onClick={addChapter}
                                                disabled={isCreatingChapter}
                                                className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[var(--accent)]/20"
                                                style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                                            >
                                                <Plus className="w-4 h-4" /> Bắt đầu chương 1
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    </div>
                </div>

                {/* Right Panel */}
                {rightPanelOpen && (
                    <div
                        className="flex flex-col h-full shrink-0 transition-all duration-300 rounded-2xl overflow-hidden relative"
                        style={{ width: '360px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.2)' }}
                    >
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-app)]">
                            <div className="flex items-center gap-2">
                                {(['worldbuilding', 'characters', 'genre', 'synopsis', 'aiInstructions', 'styleGuide', 'themes', 'plotTimeline', 'aiWriter', 'sceneCliffhanger'] as ActiveTab[]).includes(activeTab) ? (
                                    <>
                                        <button onClick={() => setActiveTab('chat')} className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition-colors">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                                        <span className="text-sm font-bold text-[var(--text-primary)]">
                                            {activeTab === 'worldbuilding' && 'Thế giới'}
                                            {activeTab === 'characters' && 'Nhân vật'}
                                            {activeTab === 'genre' && 'Thể loại'}
                                            {activeTab === 'synopsis' && 'Tóm tắt'}
                                            {activeTab === 'styleGuide' && 'Phong cách'}
                                            {activeTab === 'themes' && 'Chủ đề'}
                                            {activeTab === 'plotTimeline' && 'Tuyến truyện'}
                                            {activeTab === 'aiInstructions' && 'Ghi chú AI'}
                                            {activeTab === 'aiWriter' && 'AI Writer'}
                                            {activeTab === 'sceneCliffhanger' && 'Phân tích Cảnh'}
                                        </span>
                                    </>
                                ) : (
                                    <div className="flex bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-1 gap-1 w-max">
                                        <TabBtn active={activeTab === 'history'} onClick={() => { setActiveTab('history'); }}>
                                            <History className="w-3.5 h-3.5" /> Lịch sử
                                        </TabBtn>
                                        <TabBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
                                            <Sparkles className="w-3.5 h-3.5" /> AI Chat
                                        </TabBtn>
                                        <TabBtn active={activeTab === 'chatHistory'} onClick={() => { setActiveTab('chatHistory'); }}>
                                            <Clock className="w-3.5 h-3.5" /> Chat cũ
                                        </TabBtn>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setRightPanelOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* ── History Tab ── */}
                        {activeTab === 'history' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Header area */}
                                <div className="px-4 pt-3 pb-3 shrink-0 border-b border-[var(--border-color)]">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="w-3.5 h-3.5 text-[var(--accent)]" />
                                            <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Phiên bản</span>
                                        </div>
                                        {activeChapter && (
                                            <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
                                                {(activeChapter.versions ?? []).length} phiên bản
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={doCreateVersion}
                                        disabled={isCreatingVersion || !activeChapter}
                                        className="relative w-full group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                                    >
                                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ background: 'linear-gradient(135deg,#d98c1d,#ea6c00)' }} />
                                        <span className="relative flex items-center gap-2 w-full">
                                            {isCreatingVersion
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                                : <Plus className="w-3.5 h-3.5 shrink-0" />}
                                            <span>{isCreatingVersion ? 'Đang tạo...' : 'Tạo phiên bản mới'}</span>
                                        </span>
                                    </button>
                                </div>

                                {/* Version list */}
                                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin">
                                    {!activeChapter ? (
                                        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                            <GitBranch className="w-8 h-8 text-[var(--text-secondary)] opacity-15" />
                                            <p className="text-[var(--text-secondary)] text-xs opacity-60">Chọn một chương để xem phiên bản.</p>
                                        </div>
                                    ) : (activeChapter.versions ?? []).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-3 text-center py-12">
                                            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                                                <History className="w-6 h-6 text-[var(--accent)] opacity-60" />
                                            </div>
                                            <div>
                                                <p className="text-[var(--text-primary)] text-xs font-semibold mb-1">Chưa có phiên bản</p>
                                                <p className="text-[var(--text-secondary)] text-[11px] opacity-60 leading-relaxed">Lưu chương để tạo<br />phiên bản đầu tiên.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* Timeline line */}
                                            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[var(--border-color)]" />

                                            <div className="space-y-2">
                                                {[...(activeChapter.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber).map(v => {
                                                    const isActive = v.versionNumber === activeChapter.currentVersionNum;
                                                    const isRenaming = renamingVersionNum === v.versionNumber;
                                                    return (
                                                        <div
                                                            key={v.id}
                                                            onClick={() => !isActive && doSwitchVersion(v.versionNumber)}
                                                            className={`relative pl-9 group transition-all ${!isActive ? 'cursor-pointer' : 'cursor-default'}`}
                                                        >
                                                            {/* Timeline dot */}
                                                            <div className={`absolute left-[13px] top-3.5 w-[13px] h-[13px] rounded-full border-2 transition-all z-10 ${isActive
                                                                ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-app)] group-hover:border-[var(--accent)]/50'
                                                                }`} />

                                                            <div className={`rounded-xl border p-3 transition-all ${isActive
                                                                ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 shadow-[0_0_0_1px_rgba(139,92,246,0.1)]'
                                                                : 'border-[var(--border-color)] hover:border-[var(--accent)]/25 hover:bg-[var(--text-primary)]/[0.02]'
                                                                }`}>
                                                                {/* Row 1: badge + name + actions */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        <span className={`shrink-0 w-6 h-5 flex items-center justify-center rounded-md text-[9px] font-bold tabular-nums ${isActive ? 'bg-[var(--accent)]/25 text-[var(--accent)]' : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'
                                                                            }`}>
                                                                            V{v.versionNumber}
                                                                        </span>
                                                                        {isRenaming ? (
                                                                            <input
                                                                                autoFocus
                                                                                value={renameValue}
                                                                                onChange={e => setRenameValue(e.target.value)}
                                                                                onBlur={() => doRenameVersion(v.versionNumber)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') doRenameVersion(v.versionNumber);
                                                                                    if (e.key === 'Escape') setRenamingVersionNum(null);
                                                                                }}
                                                                                onClick={e => e.stopPropagation()}
                                                                                className="flex-1 min-w-0 text-xs bg-[var(--bg-app)] border border-[var(--accent)]/50 rounded-lg px-2 py-0.5 text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                                                                                {v.title || `Version ${v.versionNumber}`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Action icons */}
                                                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {!isRenaming && !isActive && (
                                                                            <button
                                                                                onClick={e => { e.stopPropagation(); doCompareVersion(v.versionNumber); }}
                                                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-sky-400 hover:bg-sky-400/10 transition-all"
                                                                                title="So sánh với hiện tại"
                                                                            >
                                                                                <GitBranch className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); doTogglePin(v.versionNumber); }}
                                                                            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${v.isPinned ? 'text-amber-400 bg-amber-400/10' : 'text-[var(--text-secondary)] hover:text-amber-400 hover:bg-amber-400/10'}`}
                                                                            title={v.isPinned ? 'Bỏ ghim' : 'Ghim phiên bản (không bị xóa tự động)'}
                                                                        >
                                                                            <Tag className="w-3 h-3" />
                                                                        </button>
                                                                        {!isRenaming && (
                                                                            <button
                                                                                onClick={e => { e.stopPropagation(); setRenamingVersionNum(v.versionNumber); setRenameValue(v.title || `Version ${v.versionNumber}`); }}
                                                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                                                                                title="Đổi tên"
                                                                            >
                                                                                <Pencil className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                        {(activeChapter.versions ?? []).length > 1 && !v.isPinned && (
                                                                            <button
                                                                                onClick={e => { e.stopPropagation(); doDeleteVersion(v.versionNumber); }}
                                                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                                                                                title="Xóa phiên bản"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Row 2: meta */}
                                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                    <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {new Date(v.updatedAt ?? v.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                    <span className="text-[10px] text-[var(--text-secondary)]">·</span>
                                                                    <span className="text-[10px] text-[var(--text-secondary)]">{v.wordCount} từ</span>
                                                                    {v.tokenCount > 0 && <>
                                                                        <span className="text-[10px] text-[var(--text-secondary)]">·</span>
                                                                        <span className="text-[10px] text-[var(--text-secondary)]">{v.tokenCount} tk</span>
                                                                    </>}
                                                                </div>

                                                                {/* Row 3: status badges */}
                                                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                                    {isActive && (
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] uppercase tracking-wider">
                                                                            ● Đang dùng
                                                                        </span>
                                                                    )}
                                                                    {v.isPinned && (
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase tracking-wider flex items-center gap-0.5">
                                                                            <Tag className="w-2 h-2" /> Ghim
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${v.isChunked
                                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] opacity-50'
                                                                        }`}>
                                                                        <Scissors className="w-2 h-2 inline mr-0.5 -mt-px" />
                                                                        {v.isChunked ? 'Chunked' : 'Chưa chunk'}
                                                                    </span>
                                                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${v.isEmbedded
                                                                        ? 'bg-indigo-500/10 text-indigo-400'
                                                                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] opacity-50'
                                                                        }`}>
                                                                        <Zap className="w-2 h-2 inline mr-0.5 -mt-px" />
                                                                        {v.isEmbedded ? 'Embedded' : 'Chưa embed'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Chat Tab ── */}
                        {activeTab === 'chat' && projectId && (
                            <ChatPanel
                                projectId={projectId}
                                isEmbedded={!!activeChapter?.versions?.[0]?.isEmbedded}
                            />
                        )}
                        {/* ── Chat History Tab ── */}
                        {activeTab === 'chatHistory' && projectId && (
                            <ChatHistoryPanel projectId={projectId} />
                        )}

                        {/* ── Worldbuilding Tab ── */}
                        {activeTab === 'worldbuilding' && projectId && (
                            <WorldbuildingPanel projectId={projectId} />
                        )}

                        {/* ── Characters Tab ── */}
                        {activeTab === 'characters' && projectId && (
                            <CharactersPanel projectId={projectId} />
                        )}

                        {/* ── Style Guide Tab ── */}
                        {activeTab === 'styleGuide' && projectId && (
                            <StyleGuidePanel projectId={projectId} />
                        )}

                        {/* ── Themes Tab ── */}
                        {activeTab === 'themes' && projectId && (
                            <ThemePanel projectId={projectId} />
                        )}

                        {/* ── Genre Tab ── */}
                        {activeTab === 'genre' && projectId && (
                            <GenrePanel projectId={projectId} />
                        )}

                        {/* ── Synopsis Tab ── */}
                        {activeTab === 'synopsis' && projectId && (
                            <SynopsisPanel projectId={projectId} />
                        )}

                        {/* ── AI Instructions Tab ── */}
                        {activeTab === 'aiInstructions' && projectId && (
                            <AiInstructionsPanel projectId={projectId} />
                        )}

                        {/* ── AI Writer Tab ── */}
                        {activeTab === 'aiWriter' && projectId && (
                            <AiWriterPanel
                                projectId={projectId}
                                onApplyContent={(content) => {
                                    if (editorRef.current) {
                                        editorRef.current.innerHTML += (editorRef.current.innerHTML.endsWith('<br>') ? '' : '<br><br>') + content.replace(/\n/g, '<br>');
                                        updateWordCount();
                                        scheduleAutoSave();
                                    }
                                }}
                            />
                        )}


                        {/* ── Scene & Cliffhanger Analysis Tab ── */}
                        {activeTab === 'sceneCliffhanger' && projectId && (
                            <div className="flex-1 overflow-y-auto p-4">
                                <SceneCliffhangerPanel
                                    projectId={projectId}
                                    chapterId={activeChapter?.id ?? null}
                                    chapterContent={editorRef.current?.innerText ?? ''}
                                    onHighlightScenes={highlightScenes}
                                    onClearHighlights={clearHighlights}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm.isOpen && deleteConfirm.options && (
                <DeleteConfirmationModal
                    isOpen={deleteConfirm.isOpen}
                    onClose={deleteConfirm.handleClose}
                    onConfirm={deleteConfirm.handleConfirm}
                    title={deleteConfirm.options.title}
                    message={deleteConfirm.options.message}
                    itemName={deleteConfirm.options.itemName}
                    itemType={deleteConfirm.options.itemType}
                    confirmText={deleteConfirm.options.confirmText}
                    cancelText={deleteConfirm.options.cancelText}
                    requireTyping={deleteConfirm.options.requireTyping}
                    typingConfirmText={deleteConfirm.options.typingConfirmText}
                    showWarnings={deleteConfirm.options.showWarnings}
                    warnings={deleteConfirm.options.warnings}
                    variant={deleteConfirm.options.variant}
                />
            )}
        </div>
    );
}

// ── WorldbuildingPanel ─────────────────────────────────────────────────────

function wbCategoryIcon(cat: string, size = 'w-3.5 h-3.5') {
    const cls = `${size} shrink-0`;
    switch (cat) {
        case 'Setting': return <Globe className={cls} />;
        case 'Location': return <MapPin className={cls} />;
        case 'Rules': return <Shield className={cls} />;
        case 'Glossary': return <BookOpen className={cls} />;
        case 'Timeline': return <Clock className={cls} />;
        case 'Magic': return <Zap className={cls} />;
        case 'History': return <Scroll className={cls} />;
        default: return <Map className={cls} />;
    }
}

function WorldbuildingPanel({ projectId }: { projectId: string }) {
    const [entries, setEntries] = useState<WorldbuildingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingEntry, setEditingEntry] = useState<WorldbuildingEntry | null>(null);
    const [filterCat, setFilterCat] = useState<string>('all');
    const [form, setForm] = useState<CreateWorldbuildingRequest>({ title: '', content: '', category: 'Other' });
    const [saving, setSaving] = useState(false);
    const [embeddingId, setEmbeddingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        worldbuildingService.getAll(projectId)
            .then(setEntries)
            .catch(() => setError('Không thể tải dữ liệu.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const openAdd = () => {
        setForm({ title: '', content: '', category: 'Other' });
        setEditingEntry(null);
        setError(null);
        setView('form');
    };

    const openEdit = (e: WorldbuildingEntry) => {
        setForm({ title: e.title, content: e.content, category: e.category });
        setEditingEntry(e);
        setError(null);
        setView('form');
    };

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editingEntry) {
                const updated = await worldbuildingService.update(projectId, editingEntry.id, form);
                setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e));
            } else {
                const created = await worldbuildingService.create(projectId, form);
                setEntries(prev => [...prev, created]);
            }
            setView('list');
        } catch { setError('Lưu thất bại.'); }
        finally { setSaving(false); }
    };

    const handleEmbed = async (id: string) => {
        setEmbeddingId(id);
        setError(null);
        try {
            const updated = await worldbuildingService.embed(projectId, id);
            setEntries(prev => prev.map(e => e.id === id ? updated : e));
        } catch { setError('Embed thất bại. Kiểm tra LM Studio.'); }
        finally { setEmbeddingId(null); }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await worldbuildingService.delete(projectId, id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch { setError('Xóa thất bại.'); }
        finally { setDeletingId(null); }
    };

    const usedCats = Array.from(new Set(entries.map(e => e.category)));
    const filtered = filterCat === 'all' ? entries : entries.filter(e => e.category === filterCat);

    /* ── Form view ── */
    if (view === 'form') {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2.5 flex items-center gap-2 shrink-0 border-b border-[var(--border-color)]">
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-sm">
                        ←
                    </button>
                    <Map className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {editingEntry ? 'Chỉnh sửa' : 'Thêm mới'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div className="text-xs text-red-400 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Tiêu đề *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Nhập tiêu đề..." maxLength={255} autoFocus
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Danh mục</label>
                        <div className="flex flex-wrap gap-1.5">
                            {WORLDBUILDING_CATEGORIES.map(c => {
                                const active = form.category === c.value;
                                return (
                                    <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                                        style={active
                                            ? { background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55` }
                                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                        {wbCategoryIcon(c.value, 'w-2.5 h-2.5')}
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Nội dung</label>
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            placeholder={getCategoryPlaceholder(form.category ?? 'Other')} rows={9}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>

                <div className="px-4 pb-4 pt-2.5 flex gap-2 shrink-0 border-t border-[var(--border-color)]">
                    <button onClick={handleSave} disabled={saving || !form.title.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingEntry ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        Hủy
                    </button>
                </div>
            </div>
        );
    }

    /* ── List view ── */
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Thế giới</span>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent)' }}>
                        {entries.length}
                    </span>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <Plus className="w-3 h-3" /> Thêm
                </button>
            </div>

            {/* Category filter chips */}
            {usedCats.length > 1 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                    <button onClick={() => setFilterCat('all')}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                        style={filterCat === 'all'
                            ? { background: 'var(--accent)', color: '#fff' }
                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        Tất cả
                    </button>
                    {usedCats.map(cat => {
                        const color = getCategoryColor(cat);
                        const active = filterCat === cat;
                        return (
                            <button key={cat} onClick={() => setFilterCat(cat)}
                                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                                style={active
                                    ? { background: `${color}22`, color, border: `1px solid ${color}55` }
                                    : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                {wbCategoryIcon(cat, 'w-2.5 h-2.5')}
                                {getCategoryLabel(cat)}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && (
                <div className="mx-3 mb-2 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
                {loading && <div className="text-xs text-[var(--text-secondary)] text-center py-10">Đang tải...</div>}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                            <Map className="w-6 h-6 opacity-30" style={{ color: 'var(--accent)' }} />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Chưa có thông tin thế giới</p>
                        <button onClick={openAdd}
                            className="mt-1 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                            style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)' }}>
                            <Plus className="w-3 h-3" /> Thêm ngay
                        </button>
                    </div>
                )}
                {filtered.map(entry => {
                    const color = getCategoryColor(entry.category);
                    const isTimeline = entry.category === 'Timeline';
                    return (
                        <div key={entry.id} className="rounded-2xl overflow-hidden transition-all"
                            style={{
                                background: 'var(--bg-app)',
                                border: `1px solid var(--border-color)`,
                                borderLeft: isTimeline ? `3px solid ${color}` : undefined,
                            }}>
                            {/* Card body */}
                            <div className="px-3 pt-3 pb-2 flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `${color}18`, color }}>
                                    {wbCategoryIcon(entry.category)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">{entry.title}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                            style={{ background: `${color}15`, color }}>
                                            {getCategoryLabel(entry.category)}
                                        </span>
                                        {entry.hasEmbedding
                                            ? <span className="text-[10px] font-semibold" style={{ color: '#10b981' }}>✦ AI ready</span>
                                            : <span className="text-[10px] opacity-40 text-[var(--text-secondary)]">○ chưa embed</span>}
                                    </div>
                                    {entry.content && (
                                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed"
                                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {entry.content}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* Action bar */}
                            <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <button onClick={() => handleEmbed(entry.id)} disabled={embeddingId === entry.id}
                                    title={entry.hasEmbedding ? 'Re-embed' : 'Embed cho AI'}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    style={entry.hasEmbedding
                                        ? { background: 'rgba(16,185,129,0.08)', color: '#10b981' }
                                        : { background: 'rgba(139,92,246,0.08)', color: 'var(--accent)' }}>
                                    {embeddingId === entry.id
                                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        : <Zap className="w-2.5 h-2.5" />}
                                    {entry.hasEmbedding ? 'Re-embed' : 'Embed AI'}
                                </button>
                                <button onClick={() => openEdit(entry)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                                    style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                                    <Pencil className="w-2.5 h-2.5" /> Sửa
                                </button>
                                <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 ml-auto"
                                    style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                                    {deletingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── CharactersPanel ────────────────────────────────────────────────────────────

function CharactersPanel({ projectId }: { projectId: string }) {
    const [entries, setEntries] = useState<CharacterEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingEntry, setEditingEntry] = useState<CharacterEntry | null>(null);
    const [filterRole, setFilterRole] = useState<string>('all');
    const [form, setForm] = useState<CreateCharacterRequest>({ name: '', role: 'Supporting', description: '', background: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [embeddingId, setEmbeddingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        characterService.getAll(projectId)
            .then(setEntries)
            .catch(() => setError('Không thể tải dữ liệu.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const openAdd = () => {
        setForm({ name: '', role: 'Supporting', description: '', background: '', notes: '' });
        setEditingEntry(null);
        setError(null);
        setView('form');
    };

    const openEdit = (e: CharacterEntry) => {
        setForm({ name: e.name, role: e.role, description: e.description, background: e.background ?? '', notes: e.notes ?? '' });
        setEditingEntry(e);
        setError(null);
        setView('form');
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editingEntry) {
                const updated = await characterService.update(projectId, editingEntry.id, form);
                setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e));
            } else {
                const created = await characterService.create(projectId, form);
                setEntries(prev => [...prev, created]);
            }
            setView('list');
        } catch { setError('Lưu thất bại.'); }
        finally { setSaving(false); }
    };

    const handleEmbed = async (id: string) => {
        setEmbeddingId(id);
        setError(null);
        try {
            const updated = await characterService.embed(projectId, id);
            setEntries(prev => prev.map(e => e.id === id ? updated : e));
        } catch { setError('Embed thất bại. Kiểm tra LM Studio.'); }
        finally { setEmbeddingId(null); }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await characterService.delete(projectId, id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch { setError('Xóa thất bại.'); }
        finally { setDeletingId(null); }
    };

    const usedRoles = Array.from(new Set(entries.map(e => e.role)));
    const filtered = filterRole === 'all' ? entries : entries.filter(e => e.role === filterRole);

    /* ── Form view ── */
    if (view === 'form') {
        const roleColors: Record<string, string> = {
            Protagonist: 'var(--accent)', Antagonist: '#ef4444', Supporting: '#3b82f6', Minor: '#6b7280'
        };
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2.5 flex items-center gap-2 shrink-0 border-b border-[var(--border-color)]">
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-sm">
                        ←
                    </button>
                    <Users className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {editingEntry ? 'Chỉnh sửa nhân vật' : 'Thêm nhân vật'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div className="text-xs text-red-400 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Tên nhân vật *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Nhập tên nhân vật..." maxLength={255} autoFocus
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Vai trò</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {CHARACTER_ROLES.map(r => (
                                <button key={r.value} onClick={() => setForm(f => ({ ...f, role: r.value }))}
                                    className="px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all text-left flex items-center gap-1.5"
                                    style={form.role === r.value
                                        ? { background: roleColors[r.value] ?? '#6b7280', color: '#fff' }
                                        : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: form.role === r.value ? 'rgba(255,255,255,0.6)' : roleColors[r.value] ?? '#6b7280' }} />
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Ngoại hình &amp; Tính cách</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Mô tả ngoại hình, tính cách, đặc điểm..." rows={4}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                            Backstory <span className="normal-case font-normal opacity-60">(tùy chọn)</span>
                        </label>
                        <textarea value={form.background} onChange={e => setForm(f => ({ ...f, background: e.target.value }))}
                            placeholder="Quá khứ, xuất thân, lý do hành động..." rows={3}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                            Ghi chú <span className="normal-case font-normal opacity-60">(tùy chọn)</span>
                        </label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Thông tin thêm, arc phát triển nhân vật..." rows={2}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>

                <div className="px-4 pb-4 pt-2.5 flex gap-2 shrink-0 border-t border-[var(--border-color)]">
                    <button onClick={handleSave} disabled={saving || !form.name.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingEntry ? 'Cập nhật' : 'Thêm nhân vật'}
                    </button>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        Hủy
                    </button>
                </div>
            </div>
        );
    }

    /* ── List view ── */
    const roleColors: Record<string, string> = {
        Protagonist: 'var(--accent)', Antagonist: '#ef4444', Supporting: '#3b82f6', Minor: '#6b7280'
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Nhân vật</span>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent)' }}>
                        {entries.length}
                    </span>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <Plus className="w-3 h-3" /> Thêm
                </button>
            </div>

            {/* Role filter chips */}
            {usedRoles.length > 1 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                    <button onClick={() => setFilterRole('all')}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                        style={filterRole === 'all'
                            ? { background: 'var(--accent)', color: '#fff' }
                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        Tất cả
                    </button>
                    {usedRoles.map(role => {
                        const ri = getRoleInfo(role);
                        return (
                            <button key={role} onClick={() => setFilterRole(role)}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                                style={filterRole === role
                                    ? { background: ri.color, color: '#fff' }
                                    : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                {ri.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && (
                <div className="mx-3 mb-2 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
                {loading && <div className="text-xs text-[var(--text-secondary)] text-center py-10">Đang tải...</div>}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                            <Users className="w-6 h-6 opacity-30" style={{ color: 'var(--accent)' }} />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Chưa có nhân vật nào</p>
                        <button onClick={openAdd}
                            className="mt-1 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all"
                            style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)' }}>
                            <Plus className="w-3 h-3" /> Thêm ngay
                        </button>
                    </div>
                )}
                {filtered.map(entry => {
                    const roleInfo = getRoleInfo(entry.role);
                    const avatarColor = roleColors[entry.role] ?? '#6b7280';
                    const initial = entry.name.trim().charAt(0).toUpperCase();
                    return (
                        <div key={entry.id} className="rounded-2xl overflow-hidden transition-all"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                            {/* Card body */}
                            <div className="px-3 pt-3 pb-2 flex items-start gap-2.5">
                                {/* Avatar circle */}
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black text-white"
                                    style={{ background: `linear-gradient(135deg, ${avatarColor}cc, ${avatarColor})` }}>
                                    {initial}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">{entry.name}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                            style={{ background: `${roleInfo.color}18`, color: roleInfo.color }}>
                                            {roleInfo.label}
                                        </span>
                                        {entry.hasEmbedding
                                            ? <span className="text-[10px] font-semibold" style={{ color: '#10b981' }}>✦ AI ready</span>
                                            : <span className="text-[10px] opacity-40 text-[var(--text-secondary)]">○ chưa embed</span>}
                                    </div>
                                    {entry.description && (
                                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed"
                                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {entry.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* Action bar */}
                            <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <button onClick={() => handleEmbed(entry.id)} disabled={embeddingId === entry.id}
                                    title={entry.hasEmbedding ? 'Re-embed' : 'Embed cho AI'}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    style={entry.hasEmbedding
                                        ? { background: 'rgba(16,185,129,0.08)', color: '#10b981' }
                                        : { background: 'rgba(139,92,246,0.08)', color: 'var(--accent)' }}>
                                    {embeddingId === entry.id
                                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        : <Zap className="w-2.5 h-2.5" />}
                                    {entry.hasEmbedding ? 'Re-embed' : 'Embed AI'}
                                </button>
                                <button onClick={() => openEdit(entry)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                                    style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                                    <Pencil className="w-2.5 h-2.5" /> Sửa
                                </button>
                                <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 ml-auto"
                                    style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                                    {deletingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Helper components ──────────────────────────────────────────────────────

// ── GenrePanel ─────────────────────────────────────────────────────────────

function GenrePanel({ projectId }: { projectId: string }) {
    const [allGenres, setAllGenres] = useState<GenreResponse[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [projectTitle, setProjectTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        Promise.all([genreService.getGenres(), projectService.getProject(projectId)])
            .then(([genres, project]) => {
                setAllGenres(genres);
                setSelectedIds(project.genres.map(g => g.id));
                setProjectTitle(project.title);
            })
            .catch(() => setError('Không thể tải thể loại.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const toggle = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        setSaved(false);
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            await projectService.updateProject(projectId, { title: projectTitle, genreIds: selectedIds });
            setSaved(true); setDirty(false);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            setError('Lưu thất bại. Thử lại.');
        } finally {
            setSaving(false);
        }
    };

    const q = searchQuery.toLowerCase().trim();
    const selectedGenres = allGenres.filter(g => selectedIds.includes(g.id));
    const availableGenres = allGenres.filter(g => !selectedIds.includes(g.id));
    const filteredAvailable = q ? availableGenres.filter(g => g.name.toLowerCase().includes(q)) : availableGenres;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Thể loại</span>
                    {selectedIds.length > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                            {selectedIds.length}
                        </span>
                    )}
                </div>
                <button onClick={handleSave} disabled={saving || !dirty}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
                    style={{
                        background: saved ? 'rgba(16,185,129,0.12)' : dirty ? 'rgba(99,102,241,0.15)' : 'var(--hover-bg)',
                        color: saved ? '#10b981' : dirty ? '#818cf8' : 'var(--text-secondary)',
                        border: `1px solid ${saved ? 'rgba(16,185,129,0.2)' : dirty ? 'rgba(99,102,241,0.25)' : 'var(--border-color)'}`,
                    }}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                    {saved ? 'Đã lưu' : 'Lưu'}
                </button>
            </div>

            {error && (
                <div className="mx-3 mb-1 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400 opacity-60" />
                    </div>
                ) : allGenres.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(99,102,241,0.08)' }}>
                            <Tag className="w-6 h-6 opacity-30" style={{ color: '#818cf8' }} />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Chưa có thể loại nào</p>
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-60 text-center px-4">
                            Admin cần tạo thể loại trước trong hệ thống.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selected genres */}
                        {selectedGenres.length > 0 && (
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                                <div className="px-3 py-2 flex items-center gap-1.5"
                                    style={{ background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                                    <Check className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Đã chọn</span>
                                </div>
                                <div className="p-3 flex flex-wrap gap-2">
                                    {selectedGenres.map(g => (
                                        <button key={g.id} onClick={() => toggle(g.id)}
                                            title="Bấm để bỏ chọn"
                                            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-all hover:scale-95 active:scale-90 shadow-sm"
                                            style={{ background: `linear-gradient(135deg, ${g.color || '#6366f1'}cc, ${g.color || '#6366f1'})` }}>
                                            <span>{g.name}</span>
                                            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors"
                                                style={{ background: 'rgba(255,255,255,0.25)' }}>
                                                <X className="w-2 h-2" />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Available genres with search */}
                        {availableGenres.length > 0 && (
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                                <div className="px-3 py-2 flex items-center gap-1.5"
                                    style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border-color)' }}>
                                    <Plus className="w-3 h-3 text-[var(--text-secondary)]" />
                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Thêm thể loại</span>
                                </div>
                                {/* Search box */}
                                <div className="px-3 pt-2.5 pb-1">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                                        <Search className="w-3 h-3 text-[var(--text-secondary)] shrink-0 opacity-50" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Tìm thể loại..."
                                            className="flex-1 text-xs text-[var(--text-primary)] bg-transparent outline-none placeholder-[var(--text-secondary)]/40"
                                        />
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')}
                                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3 pt-2 flex flex-wrap gap-2">
                                    {filteredAvailable.length === 0 ? (
                                        <p className="text-[10px] text-[var(--text-secondary)] opacity-50 w-full text-center py-2">
                                            Không tìm thấy thể loại nào
                                        </p>
                                    ) : (
                                        filteredAvailable.map(g => (
                                            <button key={g.id} onClick={() => toggle(g.id)}
                                                title="Bấm để chọn"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:scale-[1.03] active:scale-95"
                                                style={{
                                                    background: `${g.color || '#6366f1'}14`,
                                                    color: g.color || '#6366f1',
                                                    border: `1px solid ${g.color || '#6366f1'}33`,
                                                }}>
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color || '#6366f1' }} />
                                                {g.name}
                                                <Plus className="w-3 h-3 opacity-60" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedGenres.length === 0 && availableGenres.length > 0 && (
                            <p className="text-[10px] text-center text-[var(--text-secondary)] opacity-50 -mt-1">
                                Chưa chọn thể loại nào — bấm vào chip để thêm
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── SynopsisPanel ──────────────────────────────────────────────────────────

function SynopsisPanel({ projectId }: { projectId: string }) {
    const [summary, setSummary] = useState('');
    const [savedSummary, setSavedSummary] = useState('');
    const [projectTitle, setProjectTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dirty = summary !== savedSummary;
    const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0;

    useEffect(() => {
        setLoading(true);
        projectService.getProject(projectId)
            .then(p => {
                const s = p.summary ?? '';
                setSummary(s);
                setSavedSummary(s);
                setProjectTitle(p.title);
            })
            .catch(() => setError('Không thể tải tóm tắt.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            await projectService.updateProject(projectId, { title: projectTitle, summary });
            setSavedSummary(summary);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            setError('Lưu thất bại. Thử lại.');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => { setSummary(savedSummary); setSaved(false); };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <AlignLeft className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Tóm tắt</span>
                    {dirty && !loading && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            Chưa lưu
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {dirty && !loading && (
                        <button onClick={handleDiscard}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                            style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                            Hoàn tác
                        </button>
                    )}
                    <button onClick={handleSave} disabled={saving || loading || !dirty}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
                        style={{
                            background: saved ? 'rgba(16,185,129,0.12)' : dirty ? 'rgba(168,85,247,0.15)' : 'var(--hover-bg)',
                            color: saved ? '#10b981' : dirty ? '#c084fc' : 'var(--text-secondary)',
                            border: `1px solid ${saved ? 'rgba(16,185,129,0.2)' : dirty ? 'rgba(168,85,247,0.25)' : 'var(--border-color)'}`,
                        }}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                        {saved ? 'Đã lưu' : 'Lưu'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-3 mb-1 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    {error}
                </div>
            )}

            <div className="flex-1 flex flex-col px-3 pb-3 gap-2 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-purple-400 opacity-60" />
                    </div>
                ) : (
                    <>
                        <div className="flex-1 relative min-h-0">
                            <textarea
                                value={summary}
                                onChange={e => { setSummary(e.target.value); setSaved(false); }}
                                placeholder="Tóm tắt nội dung câu chuyện — nhân vật chính, xung đột, và kết thúc dự kiến..."
                                className="w-full h-full resize-none rounded-2xl text-[13px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all p-3.5"
                                style={{
                                    background: 'var(--bg-app)',
                                    border: `1px solid ${dirty ? 'rgba(168,85,247,0.3)' : 'var(--border-color)'}`,
                                }}
                            />
                        </div>
                        {/* Footer stats */}
                        <div className="flex items-center justify-between px-1 shrink-0">
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-50">
                                {wordCount > 0 ? `${wordCount} từ` : 'Chưa có nội dung'}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-50">
                                {summary.length} ký tự
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── StyleGuidePanel ──────────────────────────────────────────────────────────

function StyleGuidePanel({ projectId }: { projectId: string }) {
    const [entries, setEntries] = useState<StyleGuideEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingEntry, setEditingEntry] = useState<StyleGuideEntry | null>(null);
    const [filterAspect, setFilterAspect] = useState<string>('all');
    const [form, setForm] = useState<CreateStyleGuideRequest>({ content: '', aspect: 'Other' });
    const [saving, setSaving] = useState(false);
    const [embeddingId, setEmbeddingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        styleGuideService.getAll(projectId)
            .then(setEntries)
            .catch(() => setError('Không thể tải dữ liệu.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const openAdd = () => {
        setForm({ content: '', aspect: 'Other' });
        setEditingEntry(null);
        setError(null);
        setView('form');
    };

    const openEdit = (e: StyleGuideEntry) => {
        setForm({ content: e.content, aspect: e.aspect });
        setEditingEntry(e);
        setError(null);
        setView('form');
    };

    const handleSave = async () => {
        if (!form.content.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editingEntry) {
                const updated = await styleGuideService.update(projectId, editingEntry.id, form);
                setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e));
            } else {
                const created = await styleGuideService.create(projectId, form);
                setEntries(prev => [...prev, created]);
            }
            setView('list');
        } catch { setError('Lưu thất bại.'); }
        finally { setSaving(false); }
    };

    const handleEmbed = async (id: string) => {
        setEmbeddingId(id);
        setError(null);
        try {
            const updated = await styleGuideService.embed(projectId, id);
            setEntries(prev => prev.map(e => e.id === id ? updated : e));
        } catch { setError('Embed thất bại. Kiểm tra LM Studio.'); }
        finally { setEmbeddingId(null); }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await styleGuideService.delete(projectId, id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch { setError('Xóa thất bại.'); }
        finally { setDeletingId(null); }
    };

    const usedAspects = Array.from(new Set(entries.map(e => e.aspect)));
    const filtered = filterAspect === 'all' ? entries : entries.filter(e => e.aspect === filterAspect);

    /* ── Form view ── */
    if (view === 'form') {
        const p = STYLE_GUIDE_ASPECTS.find(a => a.value === form.aspect)?.placeholder || 'Mô tả...';
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2.5 flex items-center gap-2 shrink-0 border-b border-[var(--border-color)]">
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-sm">
                        ←
                    </button>
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {editingEntry ? 'Sửa Phong Cách' : 'Thêm Phong Cách'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {error && (
                        <div className="text-xs text-red-400 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Khía cạnh</label>
                        <div className="flex flex-wrap gap-1.5">
                            {STYLE_GUIDE_ASPECTS.map(a => {
                                const active = form.aspect === a.value;
                                return (
                                    <button key={a.value} onClick={() => setForm(f => ({ ...f, aspect: a.value }))}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                                        style={active
                                            ? { background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}55` }
                                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                        {a.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Nội dung *</label>
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            placeholder={p} rows={10} autoFocus
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>

                <div className="px-4 pb-4 pt-2.5 flex gap-2 shrink-0 border-t border-[var(--border-color)]">
                    <button onClick={handleSave} disabled={saving || !form.content.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent)' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingEntry ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                        Hủy
                    </button>
                </div>
            </div>
        );
    }

    /* ── List view ── */
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Phong cách</span>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        {entries.length}
                    </span>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <Plus className="w-3 h-3" /> Thêm
                </button>
            </div>

            {usedAspects.length > 1 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                    <button onClick={() => setFilterAspect('all')}
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                        style={filterAspect === 'all'
                            ? { background: 'var(--accent)', color: '#fff' }
                            : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        Tất cả
                    </button>
                    {usedAspects.map(a => {
                        const color = getStyleGuideAspectColor(a);
                        const active = filterAspect === a;
                        return (
                            <button key={a} onClick={() => setFilterAspect(a)}
                                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition-all"
                                style={active
                                    ? { background: `${color}22`, color, border: `1px solid ${color}55` }
                                    : { background: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                {getStyleGuideAspectLabel(a)}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && <div className="mx-3 mb-2 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>}

            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
                {loading && <div className="text-xs text-[var(--text-secondary)] text-center py-10">Đang tải...</div>}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
                            <BookOpen className="w-6 h-6 opacity-30 text-amber-500" />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Chưa có quy tắc phong cách</p>
                    </div>
                )}
                {filtered.map(entry => {
                    const color = getStyleGuideAspectColor(entry.aspect);
                    return (
                        <div key={entry.id} className="rounded-2xl overflow-hidden transition-all"
                            style={{ background: 'var(--bg-app)', border: `1px solid var(--border-color)` }}>
                            <div className="px-3 pt-3 pb-2 flex items-start gap-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                            style={{ background: `${color}15`, color }}>
                                            {getStyleGuideAspectLabel(entry.aspect)}
                                        </span>
                                        {entry.hasEmbedding
                                            ? <span className="text-[10px] font-semibold text-emerald-500">✦ AI ready</span>
                                            : <span className="text-[10px] opacity-40 text-[var(--text-secondary)]">○ chưa embed</span>}
                                    </div>
                                    <p className="text-[11px] text-[var(--text-primary)] mt-1.5 leading-relaxed"
                                        style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {entry.content}
                                    </p>
                                </div>
                            </div>
                            <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <button onClick={() => handleEmbed(entry.id)} disabled={embeddingId === entry.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    style={entry.hasEmbedding
                                        ? { background: 'rgba(16,185,129,0.08)', color: '#10b981' }
                                        : { background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                                    {embeddingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                                    {entry.hasEmbedding ? 'Re-embed' : 'Embed AI'}
                                </button>
                                <button onClick={() => openEdit(entry)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                                    style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                                    <Pencil className="w-2.5 h-2.5" /> Sửa
                                </button>
                                <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50 ml-auto"
                                    style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                                    {deletingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── ThemePanel ─────────────────────────────────────────────────────────────

function ThemePanel({ projectId }: { projectId: string }) {
    const [entries, setEntries] = useState<ThemeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingEntry, setEditingEntry] = useState<ThemeEntry | null>(null);
    const [form, setForm] = useState<CreateThemeRequest>({ title: '', description: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [embeddingId, setEmbeddingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        themeService.getAll(projectId)
            .then(setEntries)
            .catch(() => setError('Không thể tải dữ liệu.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const openAdd = () => {
        setForm({ title: '', description: '', notes: '' });
        setEditingEntry(null);
        setError(null);
        setView('form');
    };

    const openEdit = (e: ThemeEntry) => {
        setForm({ title: e.title, description: e.description, notes: e.notes ?? '' });
        setEditingEntry(e);
        setError(null);
        setView('form');
    };

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editingEntry) {
                const updated = await themeService.update(projectId, editingEntry.id, form);
                setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e));
            } else {
                const created = await themeService.create(projectId, form);
                setEntries(prev => [...prev, created]);
            }
            setView('list');
        } catch { setError('Lưu thất bại.'); }
        finally { setSaving(false); }
    };

    const handleEmbed = async (id: string) => {
        setEmbeddingId(id);
        setError(null);
        try {
            const updated = await themeService.embed(projectId, id);
            setEntries(prev => prev.map(e => e.id === id ? updated : e));
        } catch { setError('Embed thất bại. Kiểm tra LM Studio.'); }
        finally { setEmbeddingId(null); }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await themeService.delete(projectId, id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch { setError('Xóa thất bại.'); }
        finally { setDeletingId(null); }
    };

    /* ── Form view ── */
    if (view === 'form') {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-2.5 flex items-center gap-2 shrink-0 border-b border-[var(--border-color)]">
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors text-sm">
                        ←
                    </button>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                        {editingEntry ? 'Sửa Chủ Đề' : 'Thêm Chủ Đề'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {error && <div className="text-xs text-red-400 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>}
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Chủ đề *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Ví dụ: Lòng tham, Sự chuộc lỗi..." maxLength={255} autoFocus
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Diễn giải *</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Chủ đề này được thể hiện như thế nào trong truyện?" rows={4}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">Ghi chú thêm</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Ví dụ cụ thể, trích dẫn, hoặc cách nó phát triển..." rows={3}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>

                <div className="px-4 pb-4 pt-2.5 flex gap-2 shrink-0 border-t border-[var(--border-color)]">
                    <button onClick={handleSave} disabled={saving || !form.title.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent)' }}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {editingEntry ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                    <button onClick={() => { setView('list'); setError(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>Hủy</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Chủ đề</span>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>{entries.length}</span>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <Plus className="w-3 h-3" /> Thêm
                </button>
            </div>

            {error && <div className="mx-3 mb-2 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>{error}</div>}

            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
                {loading && <div className="text-xs text-[var(--text-secondary)] text-center py-10">Đang tải...</div>}
                {!loading && entries.length === 0 && (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                            <Sparkles className="w-6 h-6 opacity-30 text-emerald-500" />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Chưa có chủ đề trọng tâm</p>
                    </div>
                )}
                {entries.map(entry => (
                    <div key={entry.id} className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'var(--bg-app)', border: `1px solid var(--border-color)` }}>
                        <div className="px-3 pt-3 pb-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-[var(--text-primary)]">{entry.title}</p>
                                {entry.hasEmbedding
                                    ? <span className="text-[10px] font-semibold text-emerald-500">✦ AI ready</span>
                                    : <span className="text-[10px] opacity-40 text-[var(--text-secondary)]">○ chưa embed</span>}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{entry.description}</p>
                        </div>
                        <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <button onClick={() => handleEmbed(entry.id)} disabled={embeddingId === entry.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50"
                                style={entry.hasEmbedding
                                    ? { background: 'rgba(16,185,129,0.08)', color: '#10b981' }
                                    : { background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                                {embeddingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                                {entry.hasEmbedding ? 'Re-embed' : 'Embed AI'}
                            </button>
                            <button onClick={() => openEdit(entry)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                                <Pencil className="w-2.5 h-2.5" /> Sửa
                            </button>
                            <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ml-auto" style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                                {deletingId === entry.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}



function AiInstructionsPanel({ projectId }: { projectId: string }) {
    const [instructions, setInstructions] = useState('');
    const [savedInstructions, setSavedInstructions] = useState('');
    const [projectTitle, setProjectTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dirty = instructions !== savedInstructions;

    useEffect(() => {
        setLoading(true);
        projectService.getProject(projectId)
            .then(p => {
                const s = p.aiInstructions ?? '';
                setInstructions(s);
                setSavedInstructions(s);
                setProjectTitle(p.title);
            })
            .catch(() => setError('Không thể tải ghi chú.'))
            .finally(() => setLoading(false));
    }, [projectId]);

    const handleSave = async () => {
        setSaving(true); setError(null);
        try {
            await projectService.updateProject(projectId, { title: projectTitle, aiInstructions: instructions });
            setSavedInstructions(instructions);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            setError('Lưu thất bại. Thử lại.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Ghi chú AI</span>
                    {dirty && !loading && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            Chưa lưu
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {dirty && !loading && (
                        <button onClick={() => { setInstructions(savedInstructions); setSaved(false); }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                            style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                            Hoàn tác
                        </button>
                    )}
                    <button onClick={handleSave} disabled={saving || loading || !dirty}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
                        style={{
                            background: saved ? 'rgba(16,185,129,0.12)' : dirty ? 'rgba(52,211,153,0.15)' : 'var(--hover-bg)',
                            color: saved ? '#10b981' : dirty ? '#34d399' : 'var(--text-secondary)',
                            border: `1px solid ${saved ? 'rgba(16,185,129,0.2)' : dirty ? 'rgba(52,211,153,0.25)' : 'var(--border-color)'}`,
                        }}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                        {saved ? 'Đã lưu' : 'Lưu'}
                    </button>
                </div>
            </div>

            {/* Hint */}
            <div className="mx-3 mb-2 px-3 py-2 rounded-xl text-[10px] leading-relaxed shrink-0"
                style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)', color: 'var(--text-secondary)' }}>
                💡 Những ghi chú này sẽ <strong>luôn được đưa vào context</strong> khi AI Chat và Phân tích. Dùng để dặn AI: giọng văn, quy tắc, spoiler, nhân vật bí ẩn...
            </div>

            {error && (
                <div className="mx-3 mb-1 text-xs text-red-400 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    {error}
                </div>
            )}

            <div className="flex-1 flex flex-col px-3 pb-3 gap-2 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-400 opacity-60" />
                    </div>
                ) : (
                    <div className="flex-1 relative min-h-0">
                        <textarea
                            value={instructions}
                            onChange={e => { setInstructions(e.target.value); setSaved(false); }}
                            placeholder={`Ví dụ:\n- Giọng văn: tối, buồn, gothic\n- Nhân vật X thực ra là phản diện, không tiết lộ\n- Magic system: không thể hồi sinh người chết\n- Truyện kết thúc bi kịch`}
                            className="w-full h-full resize-none rounded-2xl text-[13px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all p-3.5"
                            style={{
                                background: 'var(--bg-app)',
                                border: `1px solid ${dirty ? 'rgba(52,211,153,0.3)' : 'var(--border-color)'}`,
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolbarBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
    return (
        <button
            title={title}
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors active:bg-[var(--text-primary)]/10"
        >
            {icon}
        </button>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${active ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
            {children}
        </button>
    );
}
