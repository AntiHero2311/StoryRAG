import { useState, useEffect, useRef, useCallback, useMemo, type ClipboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, History, Bold,
    Italic, Underline,
    ChevronsLeft, ChevronsRight, Trash2, FileText, X,
    Undo2, Redo2, Save, Check, Loader2, Scissors,
    Clock, Pencil, GitBranch, Zap, Type, Tag, AlignLeft,
    BookOpen, Search, Wand2, AlertCircle, Download, Upload,
} from 'lucide-react';
import { getUserInfo } from '../utils/jwtHelper';


import {
    chapterService,
    type ChapterDetailResponse,
    type ChapterVersionDiffResponse,
} from '../services/chapterService';
import { aiService } from '../services/aiService';
import { useEditorSettings, AVAILABLE_FONTS, AVAILABLE_SIZES } from '../hooks/useEditorSettings';
import { exportService } from '../services/exportService';

import { useToast } from '../components/Toast';
import { DeleteConfirmationModal } from '../components/ui';
import { useDeleteConfirm } from '../hooks';

// ── Types ──────────────────────────────────────────────────────────────────

type SavedState = 'idle' | 'saving' | 'saved' | 'error';
type ActiveTab = 'chat' | 'history' | 'chatHistory' | 'genre' | 'synopsis' | 'aiInstructions';
const AUTO_EMBED_QUEUE_DELAY_MS = 5_000;


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
        { id: 'pdf', label: 'PDF (.pdf)', icon: FileText, color: 'text-red-500' },
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
                <div className="grid grid-cols-3 gap-3">
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

// ── Import Confirm Modal ───────────────────────────────────────────────────
function ImportConfirmModal({
    file,
    onClose,
    onConfirm,
    isLoading
}: {
    file: File | null;
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
}) {
    if (!file) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
            <div className="w-full max-w-sm flex flex-col rounded-2xl overflow-hidden shadow-2xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                            <Upload className="w-5 h-5 text-[var(--accent)]" />
                            Import Manuscript
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Xác nhận import file này
                        </p>
                    </div>
                    <button onClick={onClose} disabled={isLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/10 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="mb-5 p-3 rounded-lg" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-sm font-semibold text-[var(--text-primary)] break-all">
                            {file.name}
                        </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                        <div>Kích thước: {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        <div>Định dạng: {file.type || 'Unknown'}</div>
                    </div>
                </div>

                <div className="mb-5 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div className="flex gap-2 text-sm text-blue-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Hệ thống sẽ tự động tách manuscript thành các chapter dựa trên heading nếu có.</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                        style={{ 
                            background: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)'
                        }}>
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
                        style={{ 
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        }}>
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang import...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Diff Modal ─────────────────────────────────────────────────────────────
function DiffModal({
    currentVersionNum,
    compareVersionNum,
    diff,
    onClose,
    onRestore,
}: {
    currentVersionNum: number;
    compareVersionNum: number;
    diff: ChapterVersionDiffResponse;
    onClose: () => void;
    onRestore: () => void;
}) {
    const lines = diff.unifiedDiff.split('\n');

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
                        <span className="text-xs text-emerald-400 font-medium">+{diff.addedLines} dòng</span>
                        <span className="text-xs text-rose-400 font-medium">−{diff.removedLines} dòng</span>
                        <span className="text-xs text-slate-300 font-medium">={diff.unchangedLines} dòng</span>
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
                <div className="flex-1 overflow-y-auto p-4 text-xs font-mono scrollbar-thin"
                    style={{ color: 'var(--text-primary)', whiteSpace: 'pre', lineHeight: 1.65 }}>
                    {!diff.hasChanges && (
                        <div className="mb-3 px-2 py-1 rounded-lg text-[11px]"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>
                            Hai phiên bản không có thay đổi nội dung.
                        </div>
                    )}
                    {lines.map((line, i) => {
                        const isHeader = line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@ ');
                        const isAdded = line.startsWith('+') && !line.startsWith('+++ ');
                        const isRemoved = line.startsWith('-') && !line.startsWith('--- ');

                        const style = isHeader
                            ? { color: 'var(--text-secondary)', opacity: 0.85 }
                            : isAdded
                                ? { background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }
                                : isRemoved
                                    ? { background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }
                                    : { color: 'var(--text-primary)' };

                        return (
                            <div key={`${i}-${line}`} style={style} className="px-2 rounded-sm">
                                {line || ' '}
                            </div>
                        );
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

    // ── Layout state ───────────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('history');

    // ── Editor settings (font) ─────────────────────────────────────────────
    const { settings: editorSettings, setFont, setFontSize } = useEditorSettings();
    const [fontPickerOpen, setFontPickerOpen] = useState(false);

    // ── Project state ──────────────────────────────────────────────────────
    const [projectTitle, setProjectTitle] = useState('Dự án');

    // ── Chapter state ──────────────────────────────────────────────────────
    const [chapters, setChapters] = useState<ChapterDetailResponse[]>([]);
    const [activeChapter, setActiveChapter] = useState<ChapterDetailResponse | null>(null);
    const [chapterTitle, setChapterTitle] = useState('');
    const [chapterSearch, setChapterSearch] = useState('');
    const [isLoadingChapters, setIsLoadingChapters] = useState(true);
    const [isCreatingChapter, setIsCreatingChapter] = useState(false);

    // ── Save/chunk state ───────────────────────────────────────────────────
    const [savedState, setSavedState] = useState<SavedState>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    type AiSyncState = 'idle' | 'syncing' | 'ready' | 'error';
    const [aiSyncState, setAiSyncState] = useState<AiSyncState>('idle');
    const aiSyncStateRef = useRef<AiSyncState>('idle');
    const aiSyncResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Version state ──────────────────────────────────────────────────────
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);
    const [renamingVersionNum, setRenamingVersionNum] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renamingChapterId, setRenamingChapterId] = useState<string | null>(null);
    const [renameChapterValue, setRenameChapterValue] = useState('');

    // ── Diff state ─────────────────────────────────────────────────────────
    const [diffModal, setDiffModal] = useState<{
        compareVersionNum: number;
        diff: ChapterVersionDiffResponse;
    } | null>(null);

    // ── Export state ───────────────────────────────────────────────────────
    const [exportModal, setExportModal] = useState<{ open: boolean; target: 'project' | 'chapter' }>({ open: false, target: 'project' });
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importConfirmModal, setImportConfirmModal] = useState<{ open: boolean; file: File | null }>({ open: false, file: null });

    // ── Delete confirmation ────────────────────────────────────────────────
    const deleteConfirm = useDeleteConfirm();

    // ── Highlighting State ─────────────────────────────────────────────────
    const [highlightsVisible, setHighlightsVisible] = useState(true);

    // Chat state is now managed inside ChatPanel / ChatHistoryPanel components

    const editorScrollRef = useRef<HTMLDivElement | null>(null);


    // ── Refs ───────────────────────────────────────────────────────────────
    const editorRef = useRef<HTMLDivElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoEmbedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isAutoEmbeddingRef = useRef(false);
    const pendingAutoEmbedChapterIdRef = useRef<string | null>(null);
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

    useEffect(() => {
        aiSyncStateRef.current = aiSyncState;
    }, [aiSyncState]);

    // ── Editor Mount & Chapter Switch Sync ─────────────────────────────────
    useEffect(() => {
        if (activeChapter && editorRef.current) {
            const currentMountedId = editorRef.current.getAttribute('data-chapter-id');
            if (currentMountedId !== activeChapter.id) {
                editorRef.current.innerHTML = activeChapter.content ?? '';
                editorRef.current.setAttribute('data-chapter-id', activeChapter.id);
                setWordCount((editorRef.current.innerText ?? '').trim().split(/\s+/).filter(Boolean).length);
            }
        }
    }, [activeChapter?.id, activeChapter?.content]);

    // ── Load chapters ──────────────────────────────────────────────────────
    const loadChapters = async (preferredChapterId?: string) => {
        if (!projectId) return;
        setIsLoadingChapters(true);
        try {
            const list = await chapterService.getChapters(projectId);
            // Load detail for each (or just first, rest lazily)
            if (list.length > 0) {
                const selected = preferredChapterId
                    ? list.find(c => c.id === preferredChapterId) ?? list[0]
                    : list[0];
                const detail = await chapterService.getChapterDetail(projectId, selected.id);
                const all = list.map(c => 
                    c.id === selected.id 
                        ? detail 
                        : { ...c, content: null, versions: [] } as ChapterDetailResponse
                );
                setChapters(all);
                setActiveChapter(detail);
                setChapterTitle(detail.title ?? `Chương ${detail.chapterNumber}`);
                setHasUnsavedChanges(false);
                if (editorRef.current) {
                    editorRef.current.innerHTML = detail.content ?? '';
                }
            } else {
                setChapters([]);
                setActiveChapter(null);
                setHasUnsavedChanges(false);
                if (editorRef.current) editorRef.current.innerHTML = '';
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
        setHasUnsavedChanges(false);
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
            requireTyping: false,
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
                            setHasUnsavedChanges(false);
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

    
    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        const allowedExt = new Set(['txt', 'docx', 'pdf']);
        if (!ext || !allowedExt.has(ext)) {
            toast.error('Định dạng không hỗ trợ. Vui lòng chọn file .txt, .docx hoặc .pdf.');
            e.target.value = '';
            return;
        }

        const maxSize = 25 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('File quá lớn. Vui lòng chọn file nhỏ hơn 25MB.');
            e.target.value = '';
            return;
        }

        setImportConfirmModal({ open: true, file });
    };

    const handleConfirmImport = async () => {
        const file = importConfirmModal.file;
        if (!file || !projectId) return;

        setIsImporting(true);
        try {
            const result = await chapterService.importManuscript(projectId, file, true);
            const firstImportedChapterId = result.importedChapters[0]?.chapterId;
            await loadChapters(firstImportedChapterId);
            toast.success(`Đã import ${result.importedChapterCount} chapter từ file ${result.sourceFileName}.`);
            setImportConfirmModal({ open: false, file: null });
            if (importFileRef.current) importFileRef.current.value = '';
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể import file manuscript.');
        } finally {
            setIsImporting(false);
        }
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

    const scheduleAiSyncReset = useCallback((state: Extract<AiSyncState, 'ready' | 'error'>) => {
        if (aiSyncResetTimerRef.current) {
            clearTimeout(aiSyncResetTimerRef.current);
            aiSyncResetTimerRef.current = null;
        }
        const delay = state === 'ready' ? 30_000 : 10_000;
        aiSyncResetTimerRef.current = setTimeout(() => setAiSyncState('idle'), delay);
    }, []);

    const embedChapterImmediately = useCallback(async (
        targetChapterId: string,
        options?: {
            allowWhileSyncing?: boolean;
            showSuccessToast?: boolean;
            showErrorToast?: boolean;
        }
    ) => {
        if (!projectId) return;
        if (!options?.allowWhileSyncing && aiSyncStateRef.current === 'syncing') {
            if (options?.showErrorToast) {
                toast.error('Tiến trình AI đang chạy, vui lòng đợi trong giây lát.');
            }
            return;
        }

        setAiSyncState('syncing');
        try {
            await aiService.embedChapter(targetChapterId);

            // Mark UI immediately after embed succeeds, then refresh detail in background.
            setChapters(prev => prev.map(c => {
                if (c.id !== targetChapterId) return c;
                return {
                    ...c,
                    versions: (c.versions ?? []).map(v => v.versionNumber === c.currentVersionNum
                        ? { ...v, isChunked: true, isEmbedded: true }
                        : v
                    ),
                };
            }));
            if (activeChapterIdRef.current === targetChapterId) {
                setActiveChapter(prev => {
                    if (!prev || prev.id !== targetChapterId) return prev;
                    return {
                        ...prev,
                        versions: (prev.versions ?? []).map(v => v.versionNumber === prev.currentVersionNum
                            ? { ...v, isChunked: true, isEmbedded: true }
                            : v
                        ),
                    };
                });
            }
            setAiSyncState('ready');
            scheduleAiSyncReset('ready');
            if (options?.showSuccessToast) {
                toast.success('Đồng bộ AI cho chương hoàn tất! Bạn có thể bắt đầu chat hoặc phân tích.');
            }

            void (async () => {
                try {
                    const embedded = await chapterService.getChapterDetail(projectId, targetChapterId);
                    setChapters(prev => prev.map(c => c.id === embedded.id ? embedded : c));
                    if (activeChapterIdRef.current === targetChapterId) {
                        setActiveChapter(embedded);
                    }
                } catch {
                    // Keep optimistic UI state; no toast needed when refresh fails.
                }
            })();
        } catch (e: any) {
            setAiSyncState('error');
            scheduleAiSyncReset('error');
            if (options?.showErrorToast) {
                const msg = e?.response?.data?.message ?? 'Đồng bộ AI thất bại. Vui lòng thử lại.';
                toast.error(msg);
            }
            throw e;
        }
    }, [projectId, toast, scheduleAiSyncReset]);

    const queueAutoEmbed = useCallback((targetChapterId: string) => {
        pendingAutoEmbedChapterIdRef.current = targetChapterId;
        if (autoEmbedTimerRef.current) {
            clearTimeout(autoEmbedTimerRef.current);
            autoEmbedTimerRef.current = null;
        }

        autoEmbedTimerRef.current = setTimeout(() => {
            autoEmbedTimerRef.current = null;
            if (isAutoEmbeddingRef.current) return;

            isAutoEmbeddingRef.current = true;
            const run = async () => {
                while (pendingAutoEmbedChapterIdRef.current) {
                    const chapterIdToEmbed = pendingAutoEmbedChapterIdRef.current;
                    pendingAutoEmbedChapterIdRef.current = null;
                    if (!chapterIdToEmbed) continue;
                    try {
                        await embedChapterImmediately(chapterIdToEmbed, {
                            allowWhileSyncing: true,
                            showSuccessToast: false,
                            showErrorToast: false,
                        });
                    } catch {
                        // Silent for autosync; trạng thái đã phản ánh trên UI.
                    }
                }
                isAutoEmbeddingRef.current = false;
            };
            void run();
        }, AUTO_EMBED_QUEUE_DELAY_MS);
    }, [embedChapterImmediately]);

    // ── Save → background Chunk + Embed ──────────────────────────────────
    const doSave = useCallback(async (showFeedback = true, triggerImmediateEmbed = true) => {
        if (!projectId || !activeChapter || !editorRef.current) return;
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        // Strip highlighting marks before saving (unwrap DOM nodes, then read innerHTML)
        const marks = Array.from(editorRef.current.querySelectorAll('mark.ai-highlight'));
        marks.forEach(mark => {
            const parent = mark.parentNode;
            if (!parent) return;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            parent.normalize();
        });
        const content = editorRef.current.innerHTML ?? '';
        const effectiveTitle = chapterTitle || `Chương ${activeChapter.chapterNumber}`;
        const currentTitle = activeChapter.title ?? `Chương ${activeChapter.chapterNumber}`;
        const shouldPersistContent = hasUnsavedChanges;
        const shouldPersistTitle = effectiveTitle !== currentTitle;

        if (!shouldPersistContent && !shouldPersistTitle) {
            if (showFeedback) {
                setSavedState('saved');
                setTimeout(() => setSavedState('idle'), 2000);
            }
            return activeChapter;
        }

        if (showFeedback) setSavedState('saving');
        try {
            const updated = await chapterService.updateChapter(projectId, activeChapter.id, {
                title: effectiveTitle,
                content,
            });
            setChapters(prev => prev.map(c => c.id === updated.id ? updated : c));
            setActiveChapter(updated);
            setHasUnsavedChanges(false);
            if (showFeedback) {
                setSavedState('saved');
                setTimeout(() => setSavedState('idle'), 2000);
            }
            if (triggerImmediateEmbed && shouldPersistContent) {
                queueAutoEmbed(updated.id);
            }
            return updated;
        } catch {
            if (showFeedback) setSavedState('error');
            return null;
        }
    }, [projectId, activeChapter, chapterTitle, hasUnsavedChanges, queueAutoEmbed]);


    // ── Debounced auto-save (in-place) ─────────────────────────────────────
    const scheduleAutoSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { doSave(false); }, 4000);
    }, [doSave]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            if (autoEmbedTimerRef.current) clearTimeout(autoEmbedTimerRef.current);
            if (aiSyncResetTimerRef.current) clearTimeout(aiSyncResetTimerRef.current);
        };
    }, []);

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
            if (editorRef.current) {
                editorRef.current.innerHTML = updated.content ?? '';
                setWordCount((editorRef.current.innerText ?? '').trim().split(/\s+/).filter(Boolean).length);
            }
            setHasUnsavedChanges(false);
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
            setHasUnsavedChanges(false);
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
            const diff = await chapterService.compareVersions(
                projectId,
                activeChapter.id,
                versionNumber,
                activeChapter.currentVersionNum
            );
            setDiffModal({ compareVersionNum: versionNumber, diff });
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Không thể tải dữ liệu so sánh phiên bản.');
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

    const markEditorDirty = () => {
        setHasUnsavedChanges(true);
        setHighlightsVisible(false);
        updateWordCount();
        scheduleAutoSave();
    };

    const normalizePastedHtml = (rawHtml: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // Remove script, style, link, meta, etc.
        doc.body.querySelectorAll('script,style,link,meta,iframe,object,embed').forEach(node => node.remove());

        // Remove all HTML comment nodes (e.g. <!--StartFragment-->)
        const removeComments = (node: Node) => {
            let child = node.firstChild;
            while (child) {
                const next = child.nextSibling;
                if (child.nodeType === Node.COMMENT_NODE) {
                    node.removeChild(child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    removeComments(child);
                }
                child = next;
            }
        };
        removeComments(doc.body);

        // Allowed tags: p, br, b, strong, i, em, u
        const allowedTags = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U']);
        
        const cleanNode = (node: Node) => {
            let child = node.firstChild;
            while (child) {
                const next = child.nextSibling;
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const el = child as HTMLElement;
                    cleanNode(el); // Depth-first cleaning
                    
                    const tagName = el.tagName.toUpperCase();
                    if (allowedTags.has(tagName)) {
                        // Remove all attributes (style, class, id, etc.)
                        while (el.attributes.length > 0) {
                            el.removeAttribute(el.attributes[0].name);
                        }
                    } else {
                        // Unwrap unsupported tag: move children to parent, then remove
                        const parent = el.parentNode;
                        if (parent) {
                            while (el.firstChild) {
                                parent.insertBefore(el.firstChild, el);
                            }
                            parent.removeChild(el);
                        }
                    }
                }
                child = next;
            }
        };
        cleanNode(doc.body);

        let html = doc.body.innerHTML;

        // Replace non-breaking spaces (unicode and HTML entities) with regular space
        html = html.replace(/\u00A0/g, ' ');
        html = html.replace(/&nbsp;/g, ' ');

        // Replace multiple consecutive spaces with a single space
        html = html.replace(/ {2,}/g, ' ');

        // Normalize empty paragraphs (e.g. <p></p> or <p><br></p>)
        html = html.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '<p><br></p>');

        // Limit consecutive empty paragraphs/newlines to maximum 1 empty line
        html = html.replace(/(?:<p><br><\/p>\s*){2,}/gi, '<p><br></p>');
        html = html.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>');

        return html.trim();
    };

    const cleanPlainText = (text: string): string => {
        if (!text) return '';
        let cleaned = text.replace(/\u00A0/g, ' ');
        cleaned = cleaned.replace(/ {2,}/g, ' ');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        return cleaned;
    };

    const handleEditorPaste = (e: ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        const html = e.clipboardData.getData('text/html');
        const plain = e.clipboardData.getData('text/plain');

        if (html) {
            const sanitizedHtml = normalizePastedHtml(html);
            document.execCommand('insertHTML', false, sanitizedHtml);
        } else {
            const cleanedPlain = cleanPlainText(plain);
            document.execCommand('insertText', false, cleanedPlain);
        }

        markEditorDirty();
    };

    const chapterSearchNormalized = chapterSearch.trim().toLowerCase();
    const filteredChapters = useMemo(() => {
        if (!chapterSearchNormalized) return chapters;
        return chapters.filter(ch => {
            const title = (ch.title ?? `Chương ${ch.chapterNumber}`).toLowerCase();
            return title.includes(chapterSearchNormalized) || String(ch.chapterNumber).includes(chapterSearchNormalized);
        });
    }, [chapters, chapterSearchNormalized]);

    const activeChapterIndex = activeChapter ? chapters.findIndex(c => c.id === activeChapter.id) : -1;
    const previousChapter = activeChapterIndex > 0 ? chapters[activeChapterIndex - 1] : null;
    const nextChapter = activeChapterIndex >= 0 && activeChapterIndex < chapters.length - 1
        ? chapters[activeChapterIndex + 1]
        : null;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!e.altKey || !projectId) return;
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName;
            const isTypingTarget = !!target && (target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT');
            if (isTypingTarget) return;

            if (e.key === 'ArrowUp' && previousChapter) {
                e.preventDefault();
                void selectChapter(previousChapter);
            } else if (e.key === 'ArrowDown' && nextChapter) {
                e.preventDefault();
                void selectChapter(nextChapter);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [projectId, previousChapter, nextChapter, selectChapter]);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)]">

            
            {/* ── Export Modal ── */}
            {exportModal.open && (
                <ExportModal
                    target={exportModal.target}
                    isLoading={isExporting}
                    onClose={() => setExportModal({ ...exportModal, open: false })}
                    onExport={doExport}
                />
            )}

            {/* ── Diff Modal ── */}
            {diffModal && activeChapter && (
                <DiffModal
                    currentVersionNum={activeChapter.currentVersionNum}
                    compareVersionNum={diffModal.compareVersionNum}
                    diff={diffModal.diff}
                    onClose={() => setDiffModal(null)}
                    onRestore={async () => {
                        await doSwitchVersion(diffModal.compareVersionNum);
                        setDiffModal(null);
                    }}
                />
            )}

            {/* ── Import Confirm Modal ── */}
            {importConfirmModal.open && (
                <ImportConfirmModal
                    file={importConfirmModal.file}
                    isLoading={isImporting}
                    onClose={() => {
                        setImportConfirmModal({ open: false, file: null });
                        if (importFileRef.current) importFileRef.current.value = '';
                    }}
                    onConfirm={handleConfirmImport}
                />
            )}

            
            {/* ── Top Nav ── */}
            <nav className="flex items-center gap-4 px-5 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-topbar)]" style={{ height: '60px' }}>
                <button
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium group shrink-0"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                        <img src="/logo.png" alt="StoryNest" className="w-8 h-8 object-contain" />
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

                {/* Save status */}
                <div className="shrink-0 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {savedState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>Đang lưu...</span></>}
                    {savedState === 'saved' && <><Check className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 font-medium">Đã lưu</span></>}
                    {savedState === 'error' && <><AlertCircle className="w-4 h-4 text-rose-400" /><span className="text-rose-400 font-medium">Lưu thất bại</span></>}
                    {savedState === 'idle' && hasUnsavedChanges && activeChapter && (
                        <span className="flex items-center gap-1.5 text-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-300" />
                            Chưa lưu
                        </span>
                    )}
                    {savedState === 'idle' && activeChapter && (
                        <>
                            <button
                                onClick={() => doSave(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Save className="w-3.5 h-3.5" /> Lưu ngay (Ctrl+S)
                            </button>

                        </>
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

                    {chapters.length > 0 && (
                        <div className="px-3 pb-2 shrink-0">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
                                <input
                                    type="text"
                                    value={chapterSearch}
                                    onChange={e => setChapterSearch(e.target.value)}
                                    placeholder="Tìm chương..."
                                    className="w-full h-8 pl-8 pr-8 rounded-lg text-xs text-[var(--text-primary)] bg-[var(--bg-app)] border border-[var(--border-color)] outline-none focus:border-[var(--accent)]/35"
                                />
                                {chapterSearch && (
                                    <button
                                        onClick={() => setChapterSearch('')}
                                        className="w-5 h-5 absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10"
                                        title="Xóa tìm kiếm"
                                    >
                                        <X className="w-3 h-3 mx-auto" />
                                    </button>
                                )}
                            </div>
                            {chapterSearchNormalized && (
                                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                    {filteredChapters.length}/{chapters.length} chương
                                </p>
                            )}
                        </div>
                    )}

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
                        ) : filteredChapters.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 opacity-70">
                                <Search className="w-6 h-6 text-[var(--text-secondary)]" />
                                <p className="text-center text-[var(--text-secondary)] text-xs font-medium">Không tìm thấy chương phù hợp</p>
                            </div>
                        ) : (
                            filteredChapters.map((ch) => {
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
                    <div className="flex-1 min-h-0 flex flex-col min-w-0 relative">
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
                                <div className="relative group inline-flex items-center">
                                    {wordCount >= 2000 && (
                                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-52 p-2 bg-slate-900 text-slate-100 text-[10px] font-medium leading-normal rounded-lg shadow-lg border border-slate-700/50 backdrop-blur-md z-[1600] text-center pointer-events-none">
                                            Một chương nên có khoảng 2000 chữ, bạn nên chia chương ra.
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-900" />
                                        </div>
                                    )}
                                    <span className={`text-xs mr-2 inline-flex items-center gap-1 transition-all ${
                                        wordCount >= 2000 
                                            ? 'text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:bg-amber-500/20 cursor-help font-semibold animate-pulse' 
                                            : 'text-[var(--text-secondary)]'
                                    }`}>
                                        {wordCount >= 2000 && <AlertCircle className="w-3 h-3 text-amber-400" />}
                                        {wordCount} từ
                                    </span>
                                </div>
                                {projectId && (
                                    <>
                                        <span className="hidden xl:inline text-[10px] text-[var(--text-secondary)]">
                                            {isImporting ? 'Đang import manuscript...' : 'Import .txt/.docx/.pdf'}
                                        </span>
                                        <button
                                            onClick={() => importFileRef.current?.click()}
                                            disabled={isImporting}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 disabled:opacity-50"
                                            title={isImporting ? 'Đang import manuscript...' : 'Nhập chapter từ file (.txt, .docx, .pdf), hệ thống tự tách theo heading nếu có'}
                                        >
                                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        </button>
                                        <input
                                            ref={importFileRef}
                                            type="file"
                                            accept=".txt,.docx,.pdf"
                                            className="hidden"
                                            onChange={handleImportFile}
                                        />
                                    </>
                                )}
                                {activeChapter && (
                                    <button
                                        onClick={() => setExportModal({ open: true, target: 'chapter' })}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5"
                                        title="Xuất chương"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setActiveTab('history');
                                        setRightPanelOpen(o => !o);
                                    }}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-1 ${rightPanelOpen && activeTab === 'history' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5'}`}
                                    title="Lịch sử phiên bản"
                                >
                                    <History className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Writing area */}
                            <div
                                ref={editorScrollRef}
                                className="flex-1 overflow-y-auto flex justify-center p-6 lg:p-12 scrollbar-thin"
                            >
                                <div className="w-full max-w-5xl relative">
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
                                                <div className="flex items-center gap-1 rounded-md bg-[var(--bg-app)] border border-[var(--border-color)] p-0.5">
                                                    <button
                                                        onClick={() => previousChapter && selectChapter(previousChapter)}
                                                        disabled={!previousChapter}
                                                        className="w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Chương trước (Alt+↑)"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5 mx-auto" />
                                                    </button>
                                                    <button
                                                        onClick={() => nextChapter && selectChapter(nextChapter)}
                                                        disabled={!nextChapter}
                                                        className="w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Chương sau (Alt+↓)"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5 mx-auto rotate-180" />
                                                    </button>
                                                </div>
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
                                                <div className="relative group inline-flex items-center">
                                                    {wordCount >= 2000 && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2 bg-slate-900 text-slate-100 text-[10px] font-medium leading-normal rounded-lg shadow-lg border border-slate-700/50 backdrop-blur-md z-[1600] text-center pointer-events-none">
                                                            Một chương nên có khoảng 2000 chữ, bạn nên chia chương ra.
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                                        </div>
                                                    )}
                                                    <span className={`text-[11px] font-medium inline-flex items-center gap-1 transition-all ${
                                                        wordCount >= 2000 
                                                            ? 'text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hover:bg-amber-500/20 cursor-help font-semibold animate-pulse' 
                                                            : 'text-[var(--text-secondary)]'
                                                    }`}>
                                                        {wordCount >= 2000 ? (
                                                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                                        ) : (
                                                            <AlignLeft className="w-3 h-3" />
                                                        )}
                                                        {wordCount} từ
                                                    </span>
                                                </div>

                                                <div className="flex-1" />

                                                <span className="hidden xl:inline text-[10px] text-[var(--text-secondary)] opacity-60">Alt+↑/↓ chuyển nhanh chương</span>
                                                                                            </div>
                                            {/* Editor */}
                                            <div
                                                ref={editorRef}
                                                contentEditable
                                                suppressContentEditableWarning
                                                onInput={markEditorDirty}
                                                onPaste={handleEditorPaste}
                                                className={`workspace-editor-content w-full min-h-[60vh] text-[var(--text-primary)] bg-transparent outline-none leading-[1.9] focus:outline-none ${!highlightsVisible ? 'hide-ai-highlights' : ''}`}
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
                                {(['genre', 'synopsis', 'aiInstructions'] as ActiveTab[]).includes(activeTab) ? (
                                    <>
                                        <button onClick={() => setActiveTab('history')} className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition-colors">
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                                        <span className="text-sm font-bold text-[var(--text-primary)]">
                                            {activeTab === 'genre' && 'Thể loại'}
                                            {activeTab === 'synopsis' && 'Tóm tắt'}
                                            {activeTab === 'aiInstructions' && 'Ghi chú AI'}
                                        </span>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                            Lịch sử phiên bản
                                        </span>
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
