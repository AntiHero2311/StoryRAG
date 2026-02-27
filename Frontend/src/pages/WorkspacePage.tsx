import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Sparkles, History, Bold,
    Italic, Underline, List, Heading, AlignJustify, Send,
    ChevronsLeft, ChevronsRight, Trash2, FileText, X,
    Undo2, Redo2, Save, Check, Loader2, Scissors,
    RotateCcw, ChevronDown, Clock, Layers,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';
import {
    chapterService,
    type ChapterDetailResponse,
    type ChapterVersionSummary,
} from '../services/chapterService';

// ── Types ──────────────────────────────────────────────────────────────────

type SavedState = 'idle' | 'saving' | 'saved' | 'error';
type ActiveTab = 'chat' | 'history';
type HistoryView = 'list' | 'detail';

// ── WorkspacePage ─────────────────────────────────────────────────────────

export default function WorkspacePage() {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();

    // ── Layout state ───────────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

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
    const [saveNote, setSaveNote] = useState('');
    const [showSaveNote, setShowSaveNote] = useState(false);

    // ── Version history state ──────────────────────────────────────────────
    const [historyView, setHistoryView] = useState<HistoryView>('list');
    const [selectedVersion, setSelectedVersion] = useState<ChapterVersionSummary | null>(null);
    const [versionContent, setVersionContent] = useState('');
    const [isLoadingVersion, setIsLoadingVersion] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // ── Chat state ─────────────────────────────────────────────────────────
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [isSending, setIsSending] = useState(false);

    // ── Refs ───────────────────────────────────────────────────────────────
    const editorRef = useRef<HTMLDivElement>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // ── Init ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        getUserInfo(token);
        const cached = sessionStorage.getItem(`project_${projectId}`);
        if (cached) setProjectTitle(JSON.parse(cached).title);
        if (projectId) loadChapters();
    }, [projectId]);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

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
                if (editorRef.current) editorRef.current.innerText = detail.content ?? '';
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
        // Auto-save current before switching
        if (activeChapter && editorRef.current && activeChapter.id !== ch.id) {
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
        if (editorRef.current) editorRef.current.innerText = detail.content ?? '';
        // Reset history view
        setHistoryView('list');
        setSelectedVersion(null);
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

    // ── Save ───────────────────────────────────────────────────────────────
    const doSave = useCallback(async (showFeedback = true) => {
        if (!projectId || !activeChapter || !editorRef.current) return;
        const content = editorRef.current.innerText ?? '';
        if (showFeedback) setSavedState('saving');
        try {
            const updated = await chapterService.updateChapter(projectId, activeChapter.id, {
                title: chapterTitle || `Chương ${activeChapter.chapterNumber}`,
                content,
                changeNote: saveNote || undefined,
            });
            setSaveNote('');
            setShowSaveNote(false);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (showFeedback) {
                setSavedState('saved');
                setTimeout(() => setSavedState('idle'), 2500);
            }
        } catch {
            if (showFeedback) setSavedState('error');
        }
    }, [projectId, activeChapter, chapterTitle, saveNote]);

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

    // ── Version restore ────────────────────────────────────────────────────
    const doRestore = async (versionNumber: number) => {
        if (!projectId || !activeChapter) return;
        if (!confirm(`Phục hồi về phiên bản ${versionNumber}? Thao tác này sẽ tạo một version mới với nội dung cũ.`)) return;
        setIsRestoring(true);
        try {
            const updated = await chapterService.restoreVersion(projectId, activeChapter.id, versionNumber);
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            if (editorRef.current) editorRef.current.innerText = updated.content ?? '';
            setHistoryView('list');
            setSelectedVersion(null);
        } catch (e: any) {
            alert(e?.response?.data?.message ?? 'Phục hồi thất bại.');
        } finally {
            setIsRestoring(false);
        }
    };

    // ── View version detail ────────────────────────────────────────────────
    const viewVersion = async (v: ChapterVersionSummary) => {
        if (!projectId || !activeChapter) return;
        setSelectedVersion(v);
        setIsLoadingVersion(true);
        setHistoryView('detail');
        try {
            const detail = await chapterService.getVersionDetail(projectId, activeChapter.id, v.versionNumber);
            setVersionContent(detail.content);
        } catch {
            setVersionContent('Không thể tải nội dung.');
        } finally {
            setIsLoadingVersion(false);
        }
    };

    // ── Chat ───────────────────────────────────────────────────────────────
    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsSending(true);
        await new Promise(r => setTimeout(r, 1000));
        setMessages(prev => [...prev, {
            role: 'ai',
            text: `Đây là phản hồi mô phỏng từ AI về: "${userMsg}". Tính năng AI đang được phát triển!`
        }]);
        setIsSending(false);
    };

    const execFormat = (command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
    };

    const getWordCount = () =>
        (editorRef.current?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length;

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)]">

            {/* ── Top Nav ── */}
            <nav className="flex items-center gap-4 px-5 py-3 shrink-0" style={{ height: '52px' }}>
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
                        <div className="relative">
                            <div className="flex">
                                <button
                                    onClick={() => doSave(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors border-r border-[var(--border-color)]"
                                >
                                    <Save className="w-3.5 h-3.5" /> Lưu
                                </button>
                                <button
                                    onClick={() => setShowSaveNote(o => !o)}
                                    className="px-2 py-1.5 rounded-r-lg bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 transition-colors"
                                    title="Thêm ghi chú version"
                                >
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </div>
                            {showSaveNote && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg p-3 w-60">
                                    <p className="text-[10px] text-[var(--text-secondary)] mb-1.5">Ghi chú cho version này (tuỳ chọn)</p>
                                    <input
                                        type="text"
                                        value={saveNote}
                                        onChange={e => setSaveNote(e.target.value)}
                                        placeholder="VD: Thêm cảnh hội thoại..."
                                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[#f5a623]/40"
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter') doSave(true); }}
                                    />
                                    <button
                                        onClick={() => doSave(true)}
                                        className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                                    >
                                        Lưu
                                    </button>
                                </div>
                            )}
                        </div>
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

                    <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
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
                                    className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeChapter?.id === ch.id
                                        ? 'bg-[#f5a623]/10 text-[#f5a623]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'
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
                        <ToolbarBtn icon={<List className="w-4 h-4" />} title="Danh sách" onClick={() => execFormat('insertUnorderedList')} />
                        <ToolbarBtn icon={<Heading className="w-4 h-4" />} title="Tiêu đề" onClick={() => execFormat('formatBlock', '<h2>')} />
                        <ToolbarBtn icon={<AlignJustify className="w-4 h-4" />} title="Căn đều" onClick={() => execFormat('justifyFull')} />
                        <div className="flex-1" />
                        <span className="text-[var(--text-secondary)] text-xs mr-2" id="wc-display">0 từ</span>
                        <button
                            onClick={() => setRightPanelOpen(o => !o)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-1 ${rightPanelOpen ? 'bg-[#f5a623]/10 text-[#f5a623]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'}`}
                            title="AI Assistant"
                        >
                            <Sparkles className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Writing area */}
                    <div className="flex-1 overflow-y-auto flex justify-center p-6 lg:p-12">
                        <div className="w-full max-w-3xl">
                            {activeChapter ? (
                                <>
                                    {/* Chapter title input */}
                                    <input
                                        type="text"
                                        value={chapterTitle}
                                        onChange={e => setChapterTitle(e.target.value)}
                                        className="w-full text-3xl font-bold text-[var(--text-primary)] bg-transparent outline-none mb-8 placeholder-[var(--text-secondary)]/30 border-none"
                                        placeholder="Tên chương..."
                                    />
                                    {/* Version badge */}
                                    <div className="flex items-center gap-2 mb-6">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f5a623]/10 text-[#f5a623]">
                                            <Layers className="w-2.5 h-2.5" />
                                            Version {activeChapter.currentVersionNum}
                                        </span>
                                        {activeChapter.currentVersionNum > 1 && (
                                            <button
                                                onClick={() => { setActiveTab('history'); setRightPanelOpen(true); }}
                                                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline transition-colors"
                                            >
                                                Xem lịch sử ({activeChapter.currentVersionNum} phiên bản)
                                            </button>
                                        )}
                                    </div>
                                    {/* Editor */}
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={() => {
                                            const wc = getWordCount();
                                            const el = document.getElementById('wc-display');
                                            if (el) el.textContent = `${wc} từ`;
                                        }}
                                        className="w-full min-h-[60vh] text-[var(--text-primary)] bg-transparent outline-none text-base leading-8 focus:outline-none"
                                        style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
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
                        style={{ width: '300px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                    >
                        {/* Panel header tab switcher */}
                        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--border-color)] shrink-0">
                            <div className="flex bg-[var(--bg-app)] rounded-xl p-0.5 gap-0.5 flex-1">
                                <TabBtn active={activeTab === 'history'} onClick={() => { setActiveTab('history'); setHistoryView('list'); }}>
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
                                {/* Back button when in detail view */}
                                {historyView === 'detail' && (
                                    <div className="px-4 pt-3 shrink-0">
                                        <button
                                            onClick={() => { setHistoryView('list'); setSelectedVersion(null); }}
                                            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                        >
                                            <ArrowLeft className="w-3 h-3" /> Quay lại danh sách
                                        </button>
                                    </div>
                                )}

                                {historyView === 'list' ? (
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                        {!activeChapter ? (
                                            <p className="text-center text-[var(--text-secondary)] text-xs py-8 opacity-50">Chọn một chương để xem lịch sử.</p>
                                        ) : (activeChapter.versions ?? []).length === 0 ? (
                                            <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
                                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-app)] flex items-center justify-center">
                                                    <History className="w-6 h-6 text-[var(--text-secondary)] opacity-30" />
                                                </div>
                                                <p className="text-[var(--text-secondary)] text-sm">Chưa có lịch sử</p>
                                                <p className="text-[var(--text-secondary)] text-xs opacity-50">Lưu chương để tạo phiên bản đầu tiên.</p>
                                            </div>
                                        ) : (
                                            [...(activeChapter.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber).map(v => (
                                                <div
                                                    key={v.id}
                                                    className="border border-[var(--border-color)] rounded-xl p-3 hover:border-[#f5a623]/30 transition-colors cursor-pointer group"
                                                    onClick={() => viewVersion(v)}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${v.versionNumber === activeChapter.currentVersionNum ? 'bg-[#f5a623]/20 text-[#f5a623]' : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'}`}>
                                                                v{v.versionNumber}
                                                            </span>
                                                            {v.versionNumber === activeChapter.currentVersionNum && (
                                                                <span className="text-[9px] text-[#f5a623] font-semibold">HIỆN TẠI</span>
                                                            )}
                                                        </div>
                                                        {v.versionNumber !== activeChapter.currentVersionNum && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); doRestore(v.versionNumber); }}
                                                                disabled={isRestoring}
                                                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold text-[var(--text-secondary)] hover:text-[#f5a623] border border-[var(--border-color)] hover:border-[#f5a623]/40 transition-all"
                                                                title="Phục hồi về version này"
                                                            >
                                                                <RotateCcw className="w-2.5 h-2.5" /> Phục hồi
                                                            </button>
                                                        )}
                                                    </div>
                                                    {v.changeNote && (
                                                        <p className="text-xs text-[var(--text-primary)] mt-1.5 font-medium">{v.changeNote}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            {new Date(v.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-secondary)]">{v.wordCount} từ</span>
                                                        {v.isChunked && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">Chunked</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    /* Version detail view */
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="px-4 py-2 border-b border-[var(--border-color)] shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--bg-app)] text-[var(--text-secondary)]">
                                                    v{selectedVersion?.versionNumber}
                                                </span>
                                                <span className="text-xs text-[var(--text-secondary)]">{selectedVersion?.wordCount} từ</span>
                                                {selectedVersion?.versionNumber !== activeChapter?.currentVersionNum && (
                                                    <button
                                                        onClick={() => doRestore(selectedVersion!.versionNumber)}
                                                        disabled={isRestoring}
                                                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white"
                                                        style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                                                    >
                                                        {isRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                        Phục hồi
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {isLoadingVersion ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
                                                </div>
                                            ) : (
                                                <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{versionContent}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Chat Tab ── */}
                        {activeTab === 'chat' && (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
                                            <div className="w-14 h-14 rounded-2xl bg-[#f5a623]/10 flex items-center justify-center">
                                                <Sparkles className="w-7 h-7 text-[#f5a623]" />
                                            </div>
                                            <p className="text-[var(--text-primary)] font-semibold text-sm">Bắt đầu cuộc trò chuyện</p>
                                            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">Hỏi AI về cốt truyện, nhân vật, hoặc gợi ý diễn biến.</p>
                                            <div className="w-full space-y-2 mt-2">
                                                {['Gợi ý diễn biến tiếp theo', 'Phân tích nhân vật chính', 'Kiểm tra plot hole'].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setChatInput(s)}
                                                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[#f5a623]/30 bg-[var(--bg-app)] hover:bg-[#f5a623]/5 transition-all"
                                                    >
                                                        {s} →
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'ai' && (
                                                <div className="w-6 h-6 rounded-lg bg-[#f5a623]/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-[#f5a623]" />
                                                </div>
                                            )}
                                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-[#f5a623] text-white rounded-br-sm' : 'bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-bl-sm'}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    {isSending && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-[#f5a623]/10 flex items-center justify-center shrink-0">
                                                <Sparkles className="w-3.5 h-3.5 text-[#f5a623] animate-pulse" />
                                            </div>
                                            <div className="flex gap-1 px-3 py-2 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                                                {[0, 150, 300].map(d => (
                                                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatBottomRef} />
                                </div>
                                <div className="p-3 border-t border-[var(--border-color)] shrink-0">
                                    <div className="relative">
                                        <textarea
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                            rows={2}
                                            placeholder="Hỏi AI về tác phẩm..."
                                            className="w-full px-3 py-2.5 pr-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-xs placeholder-[var(--text-secondary)]/50 outline-none focus:ring-2 focus:ring-[#f5a623]/40 resize-none"
                                        />
                                        <button
                                            onClick={handleSendChat}
                                            disabled={!chatInput.trim() || isSending}
                                            className="absolute bottom-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg text-white transition-all disabled:opacity-30"
                                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-[var(--text-secondary)] text-[10px] mt-1.5 opacity-50">Enter để gửi · Shift+Enter để xuống dòng</p>
                                </div>
                            </>
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
