import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, FileText, ChevronRight, Book, Type, AlignJustify, AlignLeft, Sliders, Heading, Columns } from 'lucide-react';
import { reportService, type ProjectReportSnapshotItem } from '../../services/reportService';

interface SnapshotViewerPanelProps {
    projectId: string;
    reportId: string;
}

const isVersionTitle = (title: string): boolean => {
    if (!title) return false;
    const normalized = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();
    
    return normalized.includes('phien ban') || normalized.includes('version') || normalized.includes('ban nhap');
};

export default function SnapshotViewerPanel({ projectId, reportId }: SnapshotViewerPanelProps) {
    const [snapshots, setSnapshots] = useState<ProjectReportSnapshotItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);

    // E-reader reading preference states
    const [fontSize, setFontSize] = useState<number>(18); // default 18px
    const [useSerif, setUseSerif] = useState<boolean>(true); // default serif
    const [justifyText, setJustifyText] = useState<boolean>(true); // default justify
    const [indentation, setIndentation] = useState<boolean>(true); // default paragraph indentation
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [isTocCollapsed, setIsTocCollapsed] = useState<boolean>(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        setSnapshots([]);

        reportService.getReportSnapshots(projectId, reportId)
            .then(data => {
                if (!mounted) return;
                // Sort snapshots by chapter number
                const sortedData = [...data].sort((a, b) => a.chapterNumber - b.chapterNumber);
                setSnapshots(sortedData);
                if (sortedData.length > 0) {
                    setSelectedChapterNumber(sortedData[0].chapterNumber);
                }
            })
            .catch(err => {
                if (!mounted) return;
                const message = err?.response?.data?.message || err?.message || 'Không thể tải bản thảo.';
                setError(message);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => { mounted = false; };
    }, [projectId, reportId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-[var(--text-secondary)] rounded-2xl animate-pulse" 
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm font-bold tracking-wide">Đang tải nội dung bản thảo phân tích...</p>
                <p className="text-xs opacity-60 mt-1">Quá trình này có thể mất vài giây</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl text-sm"
                style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}>
                <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
                <p className="font-bold text-xl mb-1">Lỗi tải dữ liệu bản thảo</p>
                <p className="opacity-80 max-w-md text-center leading-relaxed">{error}</p>
            </div>
        );
    }

    if (snapshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-[var(--text-secondary)] rounded-2xl" 
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <FileText className="w-16 h-16 mb-4 opacity-30 text-indigo-400" />
                <p className="font-bold text-xl text-[var(--text-primary)] mb-1">Không tìm thấy bản thảo phân tích</p>
                <p className="text-sm opacity-70 max-w-sm text-center leading-relaxed">Báo cáo phân tích này hiện không đính kèm bản lưu kịch bản/bản thảo tại thời điểm quét.</p>
            </div>
        );
    }

    const selectedSnapshot = snapshots.find(s => s.chapterNumber === selectedChapterNumber);

    // Estimate reading time (average 200 words per minute for Vietnamese reading)
    const getReadingTime = (words: number) => {
        const minutes = Math.ceil(words / 200);
        return `Khoảng ${minutes} phút đọc`;
    };

    // Format HTML/Plain text content for premium publication reading
    const formatStoryContent = (content: string) => {
        if (!content) return "";
        
        let cleaned = content.trim();
        
        // Remove duplicate spaces or carriage returns
        cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        
        // Detect if content has HTML tags
        const hasHtml = /<p\b[^>]*>|<br\s*\/?>/i.test(cleaned);
        
        if (hasHtml) {
            // Strip any existing inline style attributes to prevent conflicts
            cleaned = cleaned.replace(/<p\b[^>]*>/gi, '<p class="story-paragraph">');
            return cleaned;
        }
        
        // If it's plain text, split by double newlines and wrap into HTML paragraphs
        return cleaned
            .split(/\n\s*\n/)
            .map(para => {
                const trimmed = para.trim();
                if (!trimmed) return "";
                // Replace single newlines with br (good for lines/poetry)
                const lineBreakFormatted = trimmed.replace(/\n/g, "<br />");
                return `<p class="story-paragraph">${lineBreakFormatted}</p>`;
            })
            .filter(Boolean)
            .join("");
    };

    const formattedContent = selectedSnapshot ? formatStoryContent(selectedSnapshot.content) : "";

    return (
        <div className="flex flex-col lg:flex-row gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500 mt-5">
            {/* Dynamic CSS Stylesheet Injector */}
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" />
            <style>{`
                .custom-reader-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-reader-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-reader-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 99px;
                }
                .custom-reader-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                .story-paragraph {
                    text-indent: ${indentation ? '2.4rem' : '0'} !important;
                    margin-bottom: ${fontSize >= 20 ? '1.8rem' : '1.4rem'} !important;
                    text-align: ${justifyText ? 'justify' : 'left'} !important;
                    text-justify: inter-word;
                    line-height: ${fontSize >= 22 ? '2.05' : '1.9'} !important;
                    font-family: ${useSerif ? 'Lora, Georgia, Cambria, "Times New Roman", Times, serif' : 'var(--font-sans), Inter, sans-serif'} !important;
                    color: rgba(228, 228, 231, 0.88) !important;
                }
                
                /* Luxury Drop Cap for the very first paragraph */
                .story-reader-content .story-paragraph:first-of-type::first-letter {
                    font-family: Lora, Georgia, serif !important;
                    float: left !important;
                    font-size: 3.5rem !important;
                    line-height: 0.85 !important;
                    margin-right: 0.6rem !important;
                    margin-top: 0.15rem !important;
                    font-weight: 900 !important;
                    color: #a78bfa !important;
                    text-shadow: 0 0 15px rgba(167, 139, 250, 0.3) !important;
                }
                
                /* Custom styled range slider */
                .custom-range-slider {
                    -webkit-appearance: none;
                    width: 100%;
                    background: rgba(255, 255, 255, 0.08);
                    height: 4px;
                    border-radius: 99px;
                    outline: none;
                }
                .custom-range-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #8b5cf6;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
                    transition: all 0.2s;
                }
                .custom-range-slider::-webkit-slider-thumb:hover {
                    background: #a78bfa;
                    transform: scale(1.2);
                }
            `}</style>

            {/* Sidebar: Danh sách chương (Roadmap Menu) */}
            {!isTocCollapsed && (
                <div className="lg:w-52 shrink-0 flex flex-col gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]">
                                <Book className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-[var(--text-bright)] uppercase tracking-widest">Mục lục bản thảo</h3>
                                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{snapshots.length} chương đã lưu trữ</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Clean Timeline-style Roadmap Chapter Index */}
                    <div className="flex flex-col gap-1 relative pl-4 border-l border-white/5 pr-2 max-h-[75vh] overflow-y-auto custom-reader-scrollbar">
                        {snapshots.map(s => {
                            const isActive = s.chapterNumber === selectedChapterNumber;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedChapterNumber(s.chapterNumber)}
                                    className="text-left py-2 rounded-r-xl text-xs transition-all duration-300 flex items-center justify-between gap-3 group relative overflow-hidden active:scale-98 pl-4"
                                    style={{
                                        background: isActive ? 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, transparent 100%)' : 'transparent',
                                        color: isActive ? '#c4b5fd' : 'var(--text-secondary)',
                                    }}
                                >
                                    {/* Connection dot on the vertical roadmap line */}
                                    <div className={`absolute -left-[21.5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                                        isActive 
                                            ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-[0_0_8px_rgba(99,102,241,0.6)]' 
                                            : 'bg-zinc-950 border-white/10 group-hover:border-zinc-500'
                                    }`} />

                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className={`text-[10px] font-mono tracking-wider ${
                                            isActive ? 'text-indigo-400 font-bold' : 'text-zinc-600 group-hover:text-zinc-400'
                                        }`}>
                                            CH {s.chapterNumber.toString().padStart(2, '0')}
                                        </span>
                                        {isVersionTitle(s.title) ? (
                                             <span className={`truncate text-[10px] opacity-65 tracking-wide transition-colors ${
                                                 isActive ? 'text-indigo-300 font-medium' : 'text-zinc-500 group-hover:text-zinc-400'
                                             }`}>
                                                 {s.title}
                                             </span>
                                         ) : (
                                             <span className={`truncate font-semibold tracking-wide transition-colors ${
                                                 isActive ? 'text-indigo-200 font-bold' : 'text-[var(--text-secondary)] group-hover:text-zinc-200'
                                             }`}>
                                                 {s.title}
                                             </span>
                                         )}
                                    </div>
                                    
                                    <span className={`text-[9px] font-semibold transition-all px-2 py-0.5 rounded ${
                                        isActive ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'text-zinc-600 group-hover:text-zinc-400'
                                    }`}>
                                        {s.wordCount} từ
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Content: Nội dung bản thảo (E-Reader layout) */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">
                
                {/* Reading Preferences Control Bar (Clean Unified Glassmorphic Pill) */}
                {selectedSnapshot && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border border-white/5"
                             style={{ backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px -6px rgba(0,0,0,0.15)' }}>
                            
                            {/* Left Side: Stats */}
                            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1.5 font-semibold bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 text-[var(--text-primary)]">
                                    <FileText className="w-3.5 h-3.5 text-indigo-400 animate-pulse-subtle" />
                                    {selectedSnapshot.wordCount.toLocaleString()} từ
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0"></span>
                                <span className="text-[var(--text-secondary)] font-medium">
                                    {getReadingTime(selectedSnapshot.wordCount)}
                                </span>
                            </div>

                            {/* Right Side: Quick Action Pills */}
                            <div className="flex items-center gap-2">
                                {/* Toggle TOC Sidebar (Focus Mode Toggle) */}
                                <button
                                    type="button"
                                    onClick={() => setIsTocCollapsed(!isTocCollapsed)}
                                    className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                                        !isTocCollapsed 
                                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                                            : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-white'
                                    }`}
                                    title={isTocCollapsed ? "Hiện mục lục bản thảo" : "Ẩn mục lục bản thảo"}
                                >
                                    <Columns className="w-3.5 h-3.5" />
                                </button>

                                {/* Serif Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setUseSerif(!useSerif)}
                                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 ${
                                        useSerif 
                                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                                            : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-white'
                                    }`}
                                    title="Đổi kiểu chữ: Serif (Sách in) vs Sans-serif"
                                >
                                    <Type className="w-3.5 h-3.5" />
                                    <span>{useSerif ? "Có chân (Serif)" : "Không chân"}</span>
                                </button>

                                {/* Justify Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setJustifyText(!justifyText)}
                                    className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                                        justifyText 
                                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                                            : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-white'
                                    }`}
                                    title={justifyText ? "Căn đều hai bên" : "Căn lề trái"}
                                >
                                    {justifyText ? <AlignJustify className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                                </button>

                                {/* Indent Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setIndentation(!indentation)}
                                    className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                                        indentation 
                                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]' 
                                            : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-white'
                                    }`}
                                    title={indentation ? "Đang lùi đầu dòng" : "Không lùi đầu dòng"}
                                >
                                    <Heading className="w-3.5 h-3.5 rotate-90" />
                                </button>

                                {/* Settings sliders toggle */}
                                <button
                                    type="button"
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                                        showSettings 
                                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                                            : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:text-white'
                                    }`}
                                    title="Tùy chỉnh cỡ chữ đọc"
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Extra Settings Panel (Clean, Non-overlapping Dropdown) */}
                        {showSettings && (
                            <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300"
                                 style={{ backdropFilter: 'blur(12px)' }}>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">Cỡ chữ hiển thị: {fontSize}px</span>
                                    <div className="flex items-center gap-3 w-64">
                                        <span className="text-xs text-[var(--text-secondary)] font-bold">A-</span>
                                        <input 
                                            type="range" 
                                            min="14" 
                                            max="26" 
                                            step="2"
                                            value={fontSize} 
                                            onChange={(e) => setFontSize(parseInt(e.target.value))}
                                            className="custom-range-slider flex-1"
                                        />
                                        <span className="text-xs text-[var(--text-secondary)] font-bold">A+</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main E-Reader Screen */}
                <div className="flex-1 min-w-0 rounded-3xl relative overflow-hidden"
                     style={{ 
                         background: 'linear-gradient(135deg, #181829 0%, #11111d 100%)', 
                         border: '1px solid rgba(139, 92, 246, 0.05)', 
                         boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.7)',
                         backgroundImage: 'radial-gradient(at top left, rgba(99, 102, 241, 0.02), transparent 45%)'
                     }}>
                    
                    {/* Glowing background mesh */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-10 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl pointer-events-none"></div>

                    {selectedSnapshot ? (
                        <div className="p-8 md:p-14 relative z-10 flex flex-col items-center">
                            {/* Centered reading wrapper for maximum readability (optimal reading width: ~720px) */}
                            <div className="w-full max-w-[720px]">
                                
                                {/* Header */}
                                <div className="text-center">
                                    <span className="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-full border border-indigo-500/20 mb-4 animate-pulse-subtle">
                                        CHƯƠNG {selectedSnapshot.chapterNumber}
                                    </span>
                                    <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-400 leading-tight mb-2 tracking-tight"
                                        style={{ fontFamily: useSerif ? 'Lora, Georgia, serif' : 'inherit' }}>
                                        {isVersionTitle(selectedSnapshot.title) 
                                            ? `Chương ${selectedSnapshot.chapterNumber}` 
                                            : selectedSnapshot.title}
                                    </h2>
                                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-3 opacity-60">
                                        Bản lưu trữ phân tích tác phẩm
                                    </p>
                                </div>

                                {/* Elegant Book Ornament Divider */}
                                <div className="flex items-center justify-center gap-4 my-8 opacity-40">
                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent flex-1"></div>
                                    <div className="w-1.5 h-1.5 rotate-45 border border-zinc-400 bg-zinc-800"></div>
                                    <div className="w-2.5 h-2.5 rotate-45 border border-indigo-400 bg-indigo-950 flex items-center justify-center shadow-[0_0_8px_rgba(139,92,246,0.3)]">
                                        <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                                    </div>
                                    <div className="w-1.5 h-1.5 rotate-45 border border-zinc-400 bg-zinc-800"></div>
                                    <div className="h-[1px] bg-gradient-to-l from-transparent via-zinc-500 to-transparent flex-1"></div>
                                </div>

                                {/* Reading body with customizable typography */}
                                <div 
                                    className="story-reader-content select-text font-sans antialiased"
                                    dangerouslySetInnerHTML={{ __html: formattedContent }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-24 text-center">
                            <Book className="w-16 h-16 mb-4 text-indigo-400 opacity-40 animate-bounce-slow" />
                            <p className="text-xl font-extrabold text-[var(--text-primary)]">Chọn một chương ở mục lục</p>
                            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xs leading-relaxed">
                                Vui lòng chọn một chương sách bên cột trái để mở giao diện đọc bản lưu trữ phân tích kịch bản.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
