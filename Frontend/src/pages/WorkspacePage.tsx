import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Sparkles, History, Bold,
    Italic, Underline, List, Heading, AlignJustify,
    ChevronsLeft, ChevronsRight, Trash2, FileText, X,
    Undo2, Redo2, Save, Check, Loader2, Scissors,
    Clock, Send, Cpu, Pencil, GitBranch, Zap, Type, Bot,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import {
    chapterService,
    type ChapterDetailResponse,
} from '../services/chapterService';
import { aiService } from '../services/aiService';
import { useEditorSettings, AVAILABLE_FONTS, AVAILABLE_SIZES } from '../hooks/useEditorSettings';

// ── Types ──────────────────────────────────────────────────────────────────

type SavedState = 'idle' | 'saving' | 'saved' | 'error';
type ActiveTab = 'chat' | 'history';

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
                    <span className="text-amber-400 font-bold shrink-0 mt-px">•</span>
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

    // ── Layout state ───────────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    const [isChunking, setIsChunking] = useState(false);
    const [wordCount, setWordCount] = useState(0);

    // ── Version state ──────────────────────────────────────────────────────
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);
    const [renamingVersionNum, setRenamingVersionNum] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // ── Chat state ─────────────────────────────────────────────────────────
    type ChatMsg = { role: 'user' | 'assistant'; content: string; tokens?: number };
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // ── Refs ───────────────────────────────────────────────────────────────
    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            alert(e?.response?.data?.message ?? 'Không thể tạo chương mới.');
        } finally {
            setIsCreatingChapter(false);
        }
    };

    // ── Select chapter ─────────────────────────────────────────────────────
    const selectChapter = async (ch: ChapterDetailResponse) => {
        if (!projectId) return;
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
                    if (editorRef.current) editorRef.current.innerText = '';
                }
            }
        } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Không thể xóa chương.');
        }
    };

    // ── Save in-place (updates active version content) ────────────────────
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
        } catch {
            if (showFeedback) setSavedState('error');
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

    // ── Chunk ──────────────────────────────────────────────────────────────
    const doChunk = async () => {
        if (!projectId || !activeChapter) return;
        // Save first
        await doSave(false);
        setIsChunking(true);
        try {
            const result = await chapterService.chunkChapter(projectId, activeChapter.id);
            // Refresh chapter
            const updated = await chapterService.getChapterDetail(projectId, activeChapter.id);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            alert(`✅ Đã chunk thành công: ${result.chunks.length} chunks, ${result.tokenCount} tokens ước tính.`);
        } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Chunk thất bại.');
        } finally {
            setIsChunking(false);
        }
    };

    // ── Embed ──────────────────────────────────────────────────────────────
    const doEmbed = async () => {
        if (!activeChapter) return;
        setIsEmbedding(true);
        try {
            await aiService.embedChapter(activeChapter.id);
            const updated = await chapterService.getChapterDetail(projectId!, activeChapter.id);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ Embedding hoàn tất! Bây giờ bạn có thể hỏi AI về nội dung chương này.',
            }]);
        } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Embedding thất bại. Vui lòng kiểm tra OpenAI API Key.');
        } finally {
            setIsEmbedding(false);
        }
    };

    // ── AI Chat ────────────────────────────────────────────────────────────
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
            alert(e?.response?.data?.message ?? 'Không thể tạo phiên bản mới.');
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
            alert(e?.response?.data?.message ?? 'Không thể chuyển phiên bản.');
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
            alert(e?.response?.data?.message ?? 'Không thể xóa phiên bản.');
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

                {/* Chunk button */}
                {activeChapter && (
                    <button
                        onClick={doChunk}
                        disabled={isChunking}
                        title="Chunk chương để chuẩn bị cho AI"
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[#f5a623]/50 hover:text-[#f5a623] transition-all disabled:opacity-40"
                    >
                        {isChunking
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Scissors className="w-3.5 h-3.5" />}
                        Chunk
                    </button>
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
                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                        >
                            {isCreatingChapter
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />}
                            Chương mới
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 scrollbar-thin">
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
                                    onClick={() => selectChapter(ch)}
                                    className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border-l-2 ${activeChapter?.id === ch.id
                                        ? 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border-transparent'
                                        }`}
                                >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">
                                            {ch.title ?? `Chương ${ch.chapterNumber}`}
                                        </p>
                                        <p className="text-[10px] opacity-50 mt-0.5">{ch.wordCount} từ · v{ch.currentVersionNum}</p>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); deleteChapter(ch.id); }}
                                        className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-rose-400 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))
                        )}
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
                                    background: fontPickerOpen ? 'rgba(245,166,35,0.1)' : 'transparent',
                                    color: fontPickerOpen ? '#f5a623' : 'var(--text-secondary)',
                                    border: fontPickerOpen ? '1px solid rgba(245,166,35,0.3)' : '1px solid transparent',
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
                                                        style={{ background: active ? 'rgba(245,166,35,0.08)' : 'transparent' }}
                                                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
                                                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                                                        <span className="w-8 text-center text-base font-semibold shrink-0"
                                                            style={{ fontFamily: `'${f.name}', serif`, color: active ? '#f5a623' : 'var(--text-secondary)' }}>
                                                            Aa
                                                        </span>
                                                        <span className="text-sm flex-1 text-left"
                                                            style={{ fontFamily: `'${f.name}', serif`, color: active ? '#f5a623' : 'var(--text-primary)' }}>
                                                            {f.label}
                                                        </span>
                                                        {active && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#f5a623' }} />}
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
                                className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-xs font-bold"
                                title="Giảm cỡ chữ">
                                A
                            </button>
                            <span className="text-[var(--text-secondary)] text-xs w-6 text-center tabular-nums">{editorSettings.editorFontSize}</span>
                            <button
                                onClick={() => { const sizes = AVAILABLE_SIZES; const i = sizes.indexOf(editorSettings.editorFontSize); if (i < sizes.length - 1) setFontSize(sizes[i + 1]); }}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-bold"
                                title="Tăng cỡ chữ">
                                A
                            </button>
                        </div>
                        <div className="flex-1" />
                        <span className="text-[var(--text-secondary)] text-xs mr-2">{wordCount} từ</span>
                        <button
                            onClick={() => setRightPanelOpen(o => !o)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-1 ${rightPanelOpen ? 'bg-[#f5a623]/10 text-[#f5a623]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'}`}
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
                                        className="w-full text-3xl font-bold text-[var(--text-primary)] bg-transparent outline-none mb-6 placeholder-[var(--text-secondary)]/30 border-none"
                                        style={{ fontFamily: `'${editorSettings.editorFont}', sans-serif`, letterSpacing: '-0.01em' }}
                                        placeholder="Tên chương..."
                                    />
                                    {/* Version badge */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5a623]/10 text-[#f5a623]">
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
                                    <div className="w-16 h-16 rounded-2xl bg-[#f5a623]/10 flex items-center justify-center">
                                        <FileText className="w-8 h-8 text-[#f5a623]" />
                                    </div>
                                    <p className="text-[var(--text-primary)] font-semibold">Chưa có chương nào</p>
                                    <p className="text-[var(--text-secondary)] text-sm">Nhấn "Chương mới" để bắt đầu viết.</p>
                                    <button
                                        onClick={addChapter}
                                        disabled={isCreatingChapter}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
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
                        {/* Panel header tab switcher */}
                        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--border-color)] shrink-0">
                            <div className="flex bg-[var(--bg-app)] rounded-xl p-0.5 gap-0.5 flex-1">
                                <TabBtn active={activeTab === 'history'} onClick={() => { setActiveTab('history'); }}>
                                    <History className="w-3 h-3" /> Lịch sử
                                </TabBtn>
                                <TabBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
                                    <Sparkles className="w-3 h-3" /> AI Chat
                                </TabBtn>
                            </div>
                            <button onClick={() => setRightPanelOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* ── History Tab ── */}
                        {activeTab === 'history' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Header area */}
                                <div className="px-4 pt-3 pb-3 shrink-0 border-b border-[var(--border-color)]">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="w-3.5 h-3.5 text-[#f5a623]" />
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
                                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
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
                                            <div className="w-12 h-12 rounded-2xl bg-[#f5a623]/10 flex items-center justify-center">
                                                <History className="w-6 h-6 text-[#f5a623] opacity-60" />
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
                                                                ? 'border-[#f5a623] bg-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.5)]'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-app)] group-hover:border-[#f5a623]/50'
                                                        }`} />

                                                        <div className={`rounded-xl border p-3 transition-all ${
                                                            isActive
                                                                ? 'border-[#f5a623]/40 bg-[#f5a623]/5 shadow-[0_0_0_1px_rgba(245,166,35,0.1)]'
                                                                : 'border-[var(--border-color)] hover:border-[#f5a623]/25 hover:bg-[var(--text-primary)]/[0.02]'
                                                        }`}>
                                                            {/* Row 1: badge + name + actions */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className={`shrink-0 w-6 h-5 flex items-center justify-center rounded-md text-[9px] font-bold tabular-nums ${
                                                                        isActive ? 'bg-[#f5a623]/25 text-[#f5a623]' : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'
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
                                                                            className="flex-1 min-w-0 text-xs bg-[var(--bg-app)] border border-[#f5a623]/50 rounded-lg px-2 py-0.5 text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#f5a623]/40"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                                                                            {v.title || `Version ${v.versionNumber}`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Action icons */}
                                                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {!isRenaming && (
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); setRenamingVersionNum(v.versionNumber); setRenameValue(v.title || `Version ${v.versionNumber}`); }}
                                                                            className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[#f5a623] hover:bg-[#f5a623]/10 transition-all"
                                                                            title="Đổi tên"
                                                                        >
                                                                            <Pencil className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                    {(activeChapter.versions ?? []).length > 1 && (
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
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                {isActive && (
                                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#f5a623]/15 text-[#f5a623] uppercase tracking-wider">
                                                                        ● Đang dùng
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
                                            style={{ background: 'rgba(245,166,35,0.15)' }}>
                                            <Sparkles className="w-3 h-3 text-amber-400" />
                                        </div>
                                        <span className="text-xs font-semibold text-[var(--text-primary)]">AI Chat</span>
                                        {activeChapter?.versions?.[0]?.isEmbedded && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                                style={{ background: 'rgba(245,166,35,0.12)', color: '#f5a623' }}>
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
                                        {/* Embed button */}
                                        {activeChapter && activeChapter.versions?.[0]?.isChunked && !activeChapter.versions?.[0]?.isEmbedded && (
                                            <button
                                                onClick={doEmbed}
                                                disabled={isEmbedding}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                                                style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}
                                            >
                                                {isEmbedding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
                                                {isEmbedding ? 'Đang embed...' : 'Embed'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-2.5 min-h-0 scrollbar-thin">
                                    {chatMessages.length === 0 && (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
                                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                                                style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)' }}>
                                                <Bot className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="text-[var(--text-primary)] text-xs font-semibold mb-1">Hỏi về nội dung truyện</p>
                                                <p className="text-[var(--text-secondary)] text-[10px] leading-relaxed max-w-[180px]">
                                                    {activeChapter?.versions?.[0]?.isEmbedded
                                                        ? 'Hỏi bất cứ điều gì về nhân vật, cốt truyện, bối cảnh...'
                                                        : 'Chunk và Embed chương trước để bật AI Chat.'}
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
                                                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,166,35,0.4)';
                                                                (e.currentTarget as HTMLElement).style.color = '#f5a623';
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
                                                    style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.2)' }}>
                                                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                                </div>
                                            )}
                                            <div
                                                className="max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                                                style={msg.role === 'user'
                                                    ? { background: 'rgba(245,166,35,0.13)', color: 'var(--text-primary)', border: '1px solid rgba(245,166,35,0.25)' }
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
                                                style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.2)' }}>
                                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                            </div>
                                            <div className="px-3 py-2.5 rounded-2xl flex items-center gap-2.5"
                                                style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                                                <div className="flex gap-1 items-center">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
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
                                            boxShadow: chatInput ? '0 0 0 2px rgba(245,166,35,0.15)' : 'none',
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
                                                        ? 'rgba(245,166,35,0.9)'
                                                        : 'rgba(245,166,35,0.15)',
                                                    color: chatInput.trim() ? '#fff' : '#f5a623',
                                                }}
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Helper components ──────────────────────────────────────────────────────

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
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${active ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
            {children}
        </button>
    );
}
