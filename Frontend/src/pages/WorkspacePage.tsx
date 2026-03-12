import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Sparkles, History, Bold,
    Italic, Underline,
    ChevronsLeft, ChevronsRight, Trash2, FileText, X,
    Undo2, Redo2, Save, Check, Loader2, Scissors,
    Clock, Send, Pencil, GitBranch, Zap, Type, Bot,
    Map, Users, Tag, AlignLeft, BookOpen, Search, Wand2, AlertCircle,
    Download, Upload, Globe, MapPin, Shield, Scroll,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import RewritePanel from '../components/RewritePanel';
import {
    chapterService,
    type ChapterDetailResponse,
} from '../services/chapterService';
import { aiService, type ChatHistoryItem } from '../services/aiService';
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
import { genreService } from '../services/genreService';
import type { GenreResponse } from '../services/projectService';
import { useToast } from '../components/Toast';
import { diffWords } from 'diff';

// ── Types ──────────────────────────────────────────────────────────────────

type SavedState = 'idle' | 'saving' | 'saved' | 'error';
type ActiveTab = 'chat' | 'history' | 'chatHistory' | 'worldbuilding' | 'characters' | 'genre' | 'synopsis' | 'aiInstructions';

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

// ── Markdown renderer for AI chat bubbles ─────────────────────────────────
function renderMd(text: string): ReactNode {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let key = 0;

    // Parse inline: **bold**, __underline__, *italic*, _italic_
    const parseInline = (line: string): ReactNode[] => {
        const parts: React.ReactNode[] = [];
        // Combined regex: **bold**, __underline__, *italic*, _italic_
        const re = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)[^*]+(?<!\*)\*(?!\*)|(?<!_)_(?!_)[^_]+(?<!_)_(?!_))/g;
        let last = 0, m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
            if (m.index > last) parts.push(line.slice(last, m.index));
            const raw = m[0];
            if (raw.startsWith('**')) {
                parts.push(<strong key={key++} className="font-semibold">{raw.slice(2, -2)}</strong>);
            } else if (raw.startsWith('__')) {
                parts.push(<u key={key++}>{raw.slice(2, -2)}</u>);
            } else {
                parts.push(<em key={key++}>{raw.slice(1, -1)}</em>);
            }
            last = m.index + raw.length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return parts;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            // Empty line → small spacing
            nodes.push(<div key={key++} className="h-1.5" />);
            continue;
        }

        // Bullet: lines starting with –, -, •, *
        const bulletMatch = trimmed.match(/^([–\-•]|\*(?!\*))\s+(.*)/s);
        if (bulletMatch) {
            nodes.push(
                <div key={key++} className="flex gap-1.5 items-start my-0.5">
                    <span className="text-[var(--accent-text)] font-bold shrink-0 mt-px">•</span>
                    <span>{parseInline(bulletMatch[2])}</span>
                </div>
            );
            continue;
        }

        // Normal line
        nodes.push(<div key={key++} className="leading-relaxed">{parseInline(trimmed)}</div>);
    }

    return <div className="flex flex-col gap-0.5">{nodes}</div>;
}



export default function WorkspacePage() {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const toast = useToast();
    void Wand2; // reserved for future rewrite feature

    // ── Layout state ───────────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [storyBibleOpen, setStoryBibleOpen] = useState(true);
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
    type ChatMsg = { role: 'user' | 'assistant'; content: string; tokens?: number };
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    // isEmbedding state removed — auto-embed via aiSyncState
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // ── Chat History state ─────────────────────────────────────────────────
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
    const [chatHistoryTotal, setChatHistoryTotal] = useState(0);
    const [chatHistoryPage, setChatHistoryPage] = useState(1);
    const [isChatHistoryLoading, setIsChatHistoryLoading] = useState(false);
    const CHAT_HISTORY_PAGE_SIZE = 20;

    // ── Rewrite state ──────────────────────────────────────────────────────
    const [rewritePanelOpen, setRewritePanelOpen] = useState(false);
    const [rewriteSelectedText, setRewriteSelectedText] = useState('');
    const [selectionToolbar, setSelectionToolbar] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
    const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                    editorRef.current.innerText = detail.content ?? '';
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
            editorRef.current.innerText = detail.content ?? '';
            setWordCount((detail.content ?? '').trim().split(/\s+/).filter(Boolean).length);
        }
        // Reset version rename state
        setRenamingVersionNum(null);
    };

    // ── Delete chapter ─────────────────────────────────────────────────────
    const deleteChapter = async (chapterId: string) => {
        if (!projectId) return;
        if (!confirm('Xóa chương này không?')) return;
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
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể xóa chương.');
        }
    };

    // ── Export / Import chapter ─────────────────────────────────────────────
    const handleExportChapter = () => {
        if (!activeChapter || !editorRef.current) return;
        const content = editorRef.current.innerText;
        const title = chapterTitle || activeChapter.title || `Chương ${activeChapter.chapterNumber}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    // ── Save → background Chunk + Embed ──────────────────────────────────
    const doSave = useCallback(async (showFeedback = true) => {
        if (!projectId || !activeChapter || !editorRef.current) return;
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        const content = editorRef.current.innerText ?? '';
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

    // ── AI Chat ────────────────────────────────────────────────────────────
    const loadChatHistory = async (page = 1) => {
        if (!projectId) return;
        setIsChatHistoryLoading(true);
        try {
            const result = await aiService.getChatHistory(projectId, page, CHAT_HISTORY_PAGE_SIZE);
            if (page === 1) {
                setChatHistory(result.items);
            } else {
                setChatHistory(prev => [...prev, ...result.items]);
            }
            setChatHistoryTotal(result.totalCount);
            setChatHistoryPage(page);
        } catch {
            // silent fail
        } finally {
            setIsChatHistoryLoading(false);
        }
    };

    const doChat = async () => {
        if (!projectId || !chatInput.trim() || isChatLoading) return;
        const question = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: question }]);
        setIsChatLoading(true);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        try {
            const result = await aiService.chat(projectId, question);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: result.answer,
                tokens: result.totalTokens,
            }]);
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'AI Chat thất bại. Vui lòng thử lại.';
            setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
        } finally {
            setIsChatLoading(false);
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    };

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
            if (editorRef.current) editorRef.current.innerText = '';
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
            if (editorRef.current) editorRef.current.innerText = updated.content ?? '';
            setWordCount((updated.content ?? '').trim().split(/\s+/).filter(Boolean).length);
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
            const currentContent = editorRef.current?.innerText ?? '';
            const compareContent = await chapterService.getVersionContent(projectId, activeChapter.id, versionNumber);
            setDiffModal({ compareVersionNum: versionNumber, currentContent, compareContent });
        } catch (e: any) {
            toast.error('Không thể tải nội dung phiên bản.');
        }
    };

    const execFormat = (command: string, value?: string) => {
        editorRef.current?.focus();
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
                                setRewritePanelOpen(true);
                                setSelectionToolbar(prev => ({ ...prev, visible: false }));
                            }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
                    >
                        <Wand2 className="w-3 h-3" />
                        Viết lại
                    </button>
                </div>
            )}

            {/* ── Rewrite Panel ── */}
            {rewritePanelOpen && (
                <RewritePanel
                    projectId={projectId!}
                    chapterId={activeChapter?.id}
                    selectedText={rewriteSelectedText}
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
            <nav className="flex items-center gap-4 px-5 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-topbar)]" style={{ height: '52px' }}>
                <button
                    onClick={() => navigate('/projects')}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium group shrink-0"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    Quay lại
                </button>

                <div className="flex-1 flex justify-center">
                    <span className="text-[var(--text-primary)] font-bold text-sm truncate max-w-xs">{projectTitle}</span>
                </div>

                {/* AI Sync status indicator */}
                {activeChapter && aiSyncState !== 'idle' && (
                    <div
                        title={
                            aiSyncState === 'syncing' ? '⏳ AI đang đồng bộ dữ liệu...' :
                            aiSyncState === 'ready'   ? '✨ AI đã sẵn sàng' :
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
                        {aiSyncState === 'ready'   && <Sparkles className="w-3 h-3" />}
                        {aiSyncState === 'error'   && <AlertCircle className="w-3 h-3" />}
                        <span>
                            {aiSyncState === 'syncing' ? 'Đồng bộ AI...' :
                             aiSyncState === 'ready'   ? 'AI sẵn sàng' :
                                                         'Lỗi đồng bộ'}
                        </span>
                    </div>
                )}

                {/* Save status */}
                <div className="shrink-0 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    {savedState === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...</>}
                    {savedState === 'saved' && <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Đã lưu</span></>}
                    {savedState === 'error' && <span className="text-rose-400">Lưu thất bại</span>}
                    {savedState === 'idle' && activeChapter && (
                        <button
                            onClick={() => doSave(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors"
                        >
                            <Save className="w-3.5 h-3.5" /> Lưu
                        </button>
                    )}
                </div>
            </nav>

            {/* ── Three Panels ── */}
            <div className="flex flex-1 min-h-0 gap-3 px-3 pb-3">

                {/* Left Sidebar */}
                <aside
                    className="flex flex-col h-full transition-all duration-300 overflow-hidden shrink-0 rounded-2xl"
                    style={{
                        width: sidebarCollapsed ? '0px' : '220px',
                        background: 'var(--bg-sidebar)',
                        border: sidebarCollapsed ? 'none' : '1px solid var(--border-color)',
                    }}
                >
                    <div className="px-3 pt-3 pb-1 shrink-0 flex items-center justify-between">
                        <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider pl-1 opacity-60">Chương</span>
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="px-3 py-2 shrink-0">
                        <button
                            onClick={addChapter}
                            disabled={isCreatingChapter}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                        >
                            {isCreatingChapter
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />}
                            Chương mới
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin">
                        {isLoadingChapters ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
                            </div>
                        ) : chapters.length === 0 ? (
                            <p className="text-center text-[var(--text-secondary)] text-xs py-6 opacity-50">Chưa có chương nào</p>
                        ) : (
                            chapters.map((ch) => (
                                <div
                                    key={ch.id}
                                    onClick={() => renamingChapterId !== ch.id && selectChapter(ch)}
                                    className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border-l-2 ${activeChapter?.id === ch.id
                                        ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border-transparent'
                                        }`}
                                >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
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
                                                className="w-full text-xs font-medium bg-[var(--bg-primary)] border border-[var(--accent)] rounded px-1.5 py-0.5 text-[var(--text-primary)] outline-none"
                                            />
                                        ) : (
                                            <p className="text-xs font-medium truncate">
                                                {ch.title ?? `Chương ${ch.chapterNumber}`}
                                            </p>
                                        )}
                                        <p className="text-[10px] opacity-50 mt-0.5">{ch.wordCount} từ · v{ch.currentVersionNum}</p>
                                    </div>
                                    {renamingChapterId !== ch.id && (
                                        <div className="hidden group-hover:flex items-center gap-0.5">
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setRenameChapterValue(ch.title ?? `Chương ${ch.chapterNumber}`);
                                                    setRenamingChapterId(ch.id);
                                                }}
                                                className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                                                title="Đổi tên chương"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}
                                                className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-rose-400 transition-colors"
                                                title="Xóa chương"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Cẩm Nang Truyện (Story Bible) ── */}
                    <div className="px-2 pb-3 pt-1 shrink-0">
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            {/* Header row with toggle */}
                            <button
                                onClick={() => setStoryBibleOpen(o => !o)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--text-primary)]/5"
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
                                <div className="py-1">
                                    {([
                                        { tab: 'genre' as ActiveTab, label: 'Thể loại', icon: Tag, color: '#818cf8' },
                                        { tab: 'synopsis' as ActiveTab, label: 'Tóm tắt', icon: AlignLeft, color: '#c084fc' },
                                        { tab: 'characters' as ActiveTab, label: 'Nhân vật', icon: Users, color: '#f472b6' },
                                        { tab: 'worldbuilding' as ActiveTab, label: 'Thế giới', icon: Map, color: 'var(--accent)' },
                                        { tab: 'aiInstructions' as ActiveTab, label: 'Ghi chú AI', icon: Bot, color: '#34d399' },
                                    ] as const).map(item => {
                                        const isActive = activeTab === item.tab && rightPanelOpen;
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.tab}
                                                onClick={() => { setActiveTab(item.tab); setRightPanelOpen(true); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all"
                                                style={{
                                                    background: isActive ? `${item.color}18` : 'transparent',
                                                    color: isActive ? item.color : 'var(--text-secondary)',
                                                }}
                                            >
                                                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? item.color : 'var(--text-secondary)' }} />
                                                <span className="flex-1 text-xs font-medium text-left">{item.label}</span>
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                                                )}
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

                {/* Center - Editor */}
                <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>

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
                                    onClick={handleExportChapter}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5"
                                    title="Xuất chương (.txt)"
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
                                        className="w-full text-3xl font-bold text-[var(--text-primary)] bg-transparent outline-none mb-6 placeholder-[var(--text-secondary)]/30 border-none"
                                        style={{ fontFamily: `'${editorSettings.editorFont}', sans-serif`, letterSpacing: '-0.01em' }}
                                        placeholder="Tên chương..."
                                    />
                                    {/* Version badge */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent)]/10 text-[var(--accent)]">
                                            Version {activeChapter.currentVersionNum}
                                        </span>
                                        <button
                                            onClick={() => { setActiveTab('history'); setRightPanelOpen(true); }}
                                            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline transition-colors"
                                        >
                                            {(activeChapter.versions ?? []).length} phiên bản
                                        </button>
                                    </div>
                                    {/* Editor */}
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={() => { updateWordCount(); scheduleAutoSave(); }}
                                        className={`w-full min-h-[60vh] text-[var(--text-primary)] bg-transparent outline-none leading-[1.9] focus:outline-none`}
                                        style={{ fontFamily: `'${editorSettings.editorFont}', sans-serif`, fontSize: `${editorSettings.editorFontSize}px`, letterSpacing: '0.01em' }}
                                        data-placeholder="Bắt đầu viết tác phẩm của bạn tại đây..."
                                    />
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                                        <FileText className="w-8 h-8 text-[var(--accent)]" />
                                    </div>
                                    <p className="text-[var(--text-primary)] font-semibold">Chưa có chương nào</p>
                                    <p className="text-[var(--text-secondary)] text-sm">Nhấn "Chương mới" để bắt đầu viết.</p>
                                    <button
                                        onClick={addChapter}
                                        disabled={isCreatingChapter}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
                                    >
                                        <Plus className="w-4 h-4" /> Tạo chương đầu tiên
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                {rightPanelOpen && (
                    <div
                        className="flex flex-col h-full shrink-0 transition-all duration-300 rounded-2xl overflow-hidden"
                        style={{ width: '320px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                    >
                        {/* Panel header — tab switcher for History/AI, breadcrumb for Story Bible panels */}
                        {(['worldbuilding', 'characters', 'genre', 'synopsis', 'aiInstructions'] as ActiveTab[]).includes(activeTab) ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-color)] shrink-0">
                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors text-sm">
                                    ←
                                </button>
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="flex-1 text-xs font-bold text-[var(--text-primary)]">Cẩm Nang Truyện</span>
                                <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
                                    {activeTab === 'worldbuilding' && 'Thế giới'}
                                    {activeTab === 'characters' && 'Nhân vật'}
                                    {activeTab === 'genre' && 'Thể loại'}
                                    {activeTab === 'synopsis' && 'Tóm tắt'}
                                    {activeTab === 'aiInstructions' && 'Ghi chú AI'}
                                </span>
                                <button onClick={() => setRightPanelOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                        <div className="flex items-center gap-2 px-2 py-2.5 border-b border-[var(--border-color)] shrink-0">
                            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                <div className="flex bg-[var(--bg-app)] rounded-xl p-0.5 gap-0.5 w-max min-w-full">
                                    <TabBtn active={activeTab === 'history'} onClick={() => { setActiveTab('history'); }}>
                                        <History className="w-3 h-3" /> Lịch sử
                                    </TabBtn>
                                    <TabBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
                                        <Sparkles className="w-3 h-3" /> AI Chat
                                    </TabBtn>
                                    <TabBtn active={activeTab === 'chatHistory'} onClick={() => { setActiveTab('chatHistory'); loadChatHistory(1); }}>
                                        <Clock className="w-3 h-3" /> Chat cũ
                                    </TabBtn>
                                </div>
                            </div>
                            <button onClick={() => setRightPanelOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        )}

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
                                                        <div className={`absolute left-[13px] top-3.5 w-[13px] h-[13px] rounded-full border-2 transition-all z-10 ${
                                                            isActive
                                                                ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-app)] group-hover:border-[var(--accent)]/50'
                                                        }`} />

                                                        <div className={`rounded-xl border p-3 transition-all ${
                                                            isActive
                                                                ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 shadow-[0_0_0_1px_rgba(139,92,246,0.1)]'
                                                                : 'border-[var(--border-color)] hover:border-[var(--accent)]/25 hover:bg-[var(--text-primary)]/[0.02]'
                                                        }`}>
                                                            {/* Row 1: badge + name + actions */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className={`shrink-0 w-6 h-5 flex items-center justify-center rounded-md text-[9px] font-bold tabular-nums ${
                                                                        isActive ? 'bg-[var(--accent)]/25 text-[var(--accent)]' : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'
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
                                                                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                                                                    v.isChunked
                                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] opacity-50'
                                                                }`}>
                                                                    <Scissors className="w-2 h-2 inline mr-0.5 -mt-px" />
                                                                    {v.isChunked ? 'Chunked' : 'Chưa chunk'}
                                                                </span>
                                                                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                                                                    v.isEmbedded
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
                        {activeTab === 'chat' && (
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Header */}
                                <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                                            style={{ background: 'rgba(139,92,246,0.15)' }}>
                                            <Sparkles className="w-3 h-3 text-[var(--accent-text)]" />
                                        </div>
                                        <span className="text-xs font-semibold text-[var(--text-primary)]">AI Chat</span>
                                        {activeChapter?.versions?.[0]?.isEmbedded && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                                style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent)' }}>
                                                ● Sẵn sàng
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* Clear chat */}
                                        {chatMessages.length > 0 && (
                                            <button
                                                onClick={() => setChatMessages([])}
                                                title="Xóa lịch sử chat"
                                                className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-2.5 min-h-0 scrollbar-thin">
                                    {chatMessages.length === 0 && (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
                                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                                                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                                <Bot className="w-5 h-5 text-[var(--accent-text)]" />
                                            </div>
                                            <div>
                                                <p className="text-[var(--text-primary)] text-xs font-semibold mb-1">Hỏi về nội dung truyện</p>
                                                <p className="text-[var(--text-secondary)] text-[10px] leading-relaxed max-w-[180px]">
                                                    {activeChapter?.versions?.[0]?.isEmbedded
                                                        ? 'Hỏi bất cứ điều gì về nhân vật, cốt truyện, bối cảnh...'
                                                        : 'Lưu chương để AI tự động đồng bộ dữ liệu.'}
                                                </p>
                                            </div>
                                            {/* Suggestion chips */}
                                            {activeChapter?.versions?.[0]?.isEmbedded && (
                                                <div className="flex flex-col gap-1.5 w-full px-1">
                                                    {[
                                                        'Nhân vật chính là ai?',
                                                        'Tóm tắt cốt truyện chương này',
                                                        'Bối cảnh câu chuyện ở đâu?',
                                                    ].map(q => (
                                                        <button
                                                            key={q}
                                                            onClick={() => setChatInput(q)}
                                                            className="text-left text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                                                            style={{
                                                                background: 'var(--bg-app)',
                                                                border: '1px solid var(--border-color)',
                                                                color: 'var(--text-secondary)',
                                                            }}
                                                            onMouseEnter={e => {
                                                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)';
                                                                (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                                                                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                                            }}
                                                        >
                                                            💬 {q}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {/* AI avatar */}
                                            {msg.role === 'assistant' && (
                                                <div className="w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center"
                                                    style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                                    <Sparkles className="w-2.5 h-2.5 text-[var(--accent-text)]" />
                                                </div>
                                            )}
                                            <div
                                                className="max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                                                style={msg.role === 'user'
                                                    ? { background: 'rgba(139,92,246,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(139,92,246,0.2)' }
                                                    : { background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }
                                                }
                                            >
                                                {msg.role === 'assistant' ? renderMd(msg.content) : msg.content}
                                                {msg.tokens && (
                                                    <div className="mt-1 text-[9px] opacity-40">{msg.tokens.toLocaleString()} tokens</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Loading dots */}
                                    {isChatLoading && (
                                        <div className="flex gap-2 justify-start">
                                            <div className="w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center"
                                                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                                <Sparkles className="w-2.5 h-2.5 text-[var(--accent-text)]" />
                                            </div>
                                            <div className="px-3 py-2.5 rounded-2xl flex items-center gap-2.5"
                                                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                                                <div className="flex gap-1 items-center">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                                <span className="text-[10px] text-[var(--text-secondary)]">Đang phân tích...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatBottomRef} />
                                </div>

                                {/* Input */}
                                <div className="px-3 pb-3 shrink-0">
                                    <div className="rounded-xl overflow-hidden transition-all"
                                        style={{
                                            background: 'var(--bg-app)',
                                            border: '1px solid var(--border-color)',
                                            boxShadow: chatInput ? '0 0 0 2px rgba(139,92,246,0.15)' : 'none',
                                        }}>
                                        <textarea
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doChat(); } }}
                                            placeholder={activeChapter?.versions?.[0]?.isEmbedded ? 'Nhập câu hỏi... (Enter để gửi)' : 'Embed chương để dùng AI Chat'}
                                            disabled={!activeChapter?.versions?.[0]?.isEmbedded || isChatLoading}
                                            rows={1}
                                            className="w-full bg-transparent resize-none text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none px-3 pt-2.5 pb-1"
                                            style={{ maxHeight: '96px' }}
                                        />
                                        <div className="flex items-center justify-between px-2 pb-2">
                                            <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                                                {chatInput.length > 0 ? `${chatInput.length} ký tự` : 'Shift+Enter xuống dòng'}
                                            </span>
                                            <button
                                                onClick={doChat}
                                                disabled={!chatInput.trim() || !activeChapter?.versions?.[0]?.isEmbedded || isChatLoading}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-25"
                                                style={{
                                                    background: chatInput.trim() && activeChapter?.versions?.[0]?.isEmbedded
                                                        ? 'rgba(139,92,246,0.9)'
                                                        : 'rgba(139,92,246,0.15)',
                                                    color: chatInput.trim() ? '#fff' : 'var(--accent)',
                                                }}
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* ── Chat History Tab ── */}
                        {activeTab === 'chatHistory' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-4 pt-3 pb-2 shrink-0 border-b border-[var(--border-color)] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Lịch sử AI Chat</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-app)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
                                        {chatHistoryTotal} cuộc trò chuyện
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
                                    {isChatHistoryLoading && chatHistory.length === 0 ? (
                                        <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-xs">Đang tải...</span>
                                        </div>
                                    ) : chatHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                                            <Bot className="w-8 h-8 text-[var(--text-secondary)] opacity-30" />
                                            <p className="text-xs text-[var(--text-secondary)]">Chưa có lịch sử chat nào.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {chatHistory.map(item => (
                                                <div key={item.id} className="rounded-xl overflow-hidden border border-[var(--border-color)]"
                                                    style={{ background: 'var(--bg-app)' }}>
                                                    {/* Question */}
                                                    <div className="px-3 py-2 flex items-start gap-2"
                                                        style={{ background: 'rgba(139,92,246,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                                                        <Search className="w-3 h-3 text-[var(--accent-text)] shrink-0 mt-0.5" />
                                                        <p className="text-xs text-[var(--text-primary)] leading-relaxed">{item.question}</p>
                                                    </div>
                                                    {/* Answer */}
                                                    <div className="px-3 py-2 flex items-start gap-2">
                                                        <Sparkles className="w-3 h-3 text-[var(--accent-text)] shrink-0 mt-0.5" />
                                                        <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                                            {renderMd(item.answer)}
                                                        </div>
                                                    </div>
                                                    {/* Footer */}
                                                    <div className="px-3 pb-2 flex items-center justify-between">
                                                        <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                                                            {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                        </span>
                                                        <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
                                                            {item.totalTokens.toLocaleString()} tokens
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Load more */}
                                            {chatHistory.length < chatHistoryTotal && (
                                                <button
                                                    onClick={() => loadChatHistory(chatHistoryPage + 1)}
                                                    disabled={isChatHistoryLoading}
                                                    className="w-full py-2 text-xs text-[var(--accent-text)] hover:text-[var(--accent-text)] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    {isChatHistoryLoading
                                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</>
                                                        : `Tải thêm (${chatHistoryTotal - chatHistory.length} còn lại)`}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Worldbuilding Tab ── */}
                        {activeTab === 'worldbuilding' && projectId && (
                            <WorldbuildingPanel projectId={projectId} />
                        )}

                        {/* ── Characters Tab ── */}
                        {activeTab === 'characters' && projectId && (
                            <CharactersPanel projectId={projectId} />
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
                    </div>
                )}
            </div>
        </div>
    );
}

// ── WorldbuildingPanel ─────────────────────────────────────────────────────

function wbCategoryIcon(cat: string, size = 'w-3.5 h-3.5') {
    const cls = `${size} shrink-0`;
    switch (cat) {
        case 'Setting':    return <Globe    className={cls} />;
        case 'Location':   return <MapPin   className={cls} />;
        case 'Rules':      return <Shield   className={cls} />;
        case 'Glossary':   return <BookOpen className={cls} />;
        case 'Timeline':   return <Clock    className={cls} />;
        case 'Magic':      return <Zap      className={cls} />;
        case 'History':    return <Scroll   className={cls} />;
        default:           return <Map      className={cls} />;
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
                        <div className="px-3 pb-2.5 flex items-center gap-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
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
                            <div className="px-3 pb-2.5 flex items-center gap-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
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

function ToolbarBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }){
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
