import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, FileText, ChevronRight, Book } from 'lucide-react';
import { reportService, type ProjectReportSnapshotItem } from '../../services/reportService';

interface SnapshotViewerPanelProps {
    projectId: string;
    reportId: string;
}

export default function SnapshotViewerPanel({ projectId, reportId }: SnapshotViewerPanelProps) {
    const [snapshots, setSnapshots] = useState<ProjectReportSnapshotItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        setSnapshots([]);

        reportService.getReportSnapshots(projectId, reportId)
            .then(data => {
                if (!mounted) return;
                setSnapshots(data);
                if (data.length > 0) {
                    setSelectedChapterNumber(data[0].chapterNumber);
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
            <div className="flex flex-col items-center justify-center p-16 text-[var(--text-secondary)] rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm font-medium">Đang tải nội dung bản thảo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl text-sm"
                style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}>
                <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
                <p className="font-bold text-lg mb-1">Lỗi tải dữ liệu</p>
                <p className="opacity-80">{error}</p>
            </div>
        );
    }

    if (snapshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-[var(--text-secondary)] rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <FileText className="w-12 h-12 mb-4 opacity-40 text-indigo-400" />
                <p className="font-bold text-lg text-[var(--text-primary)] mb-1">Không tìm thấy bản thảo</p>
                <p className="text-sm opacity-80">Báo cáo này không đính kèm bản lưu nội dung nào.</p>
            </div>
        );
    }

    const selectedSnapshot = snapshots.find(s => s.chapterNumber === selectedChapterNumber);

    return (
        <div className="flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 mt-5">
            {/* Sidebar: Danh sách chương */}
            <div className="md:w-72 shrink-0 flex flex-col gap-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400">
                        <Book className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-black text-[var(--text-primary)] uppercase tracking-wider">Mục lục bản thảo</h3>
                </div>
                
                <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {snapshots.map(s => {
                        const isActive = s.chapterNumber === selectedChapterNumber;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setSelectedChapterNumber(s.chapterNumber)}
                                className="text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 flex items-center gap-3 group relative overflow-hidden"
                                style={{
                                    background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.05) 100%)' : 'rgba(255,255,255,0.02)',
                                    border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                    color: isActive ? '#c4b5fd' : 'var(--text-secondary)',
                                }}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-l-xl"></div>
                                )}
                                {isActive ? <ChevronRight className="w-4 h-4 shrink-0 text-indigo-400" /> : <div className="w-4 h-4 shrink-0 opacity-50 group-hover:text-[var(--text-primary)] group-hover:opacity-100" />}
                                <span className="truncate flex-1 font-medium group-hover:text-[var(--text-primary)]">Chương {s.chapterNumber}: {s.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content: Nội dung bản thảo */}
            <div className="flex-1 min-w-0 rounded-3xl p-6 md:p-10 relative overflow-hidden"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.3)' }}>
                {selectedSnapshot ? (
                    <div className="relative z-10">
                        <div className="mb-8 pb-6 border-b border-white/5">
                            <span className="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 font-bold text-xs uppercase tracking-widest rounded-full border border-indigo-500/20 mb-4">
                                Chương {selectedSnapshot.chapterNumber}
                            </span>
                            <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 mb-4 leading-tight">
                                {selectedSnapshot.title}
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
                                <FileText className="w-4 h-4 opacity-50" />
                                {selectedSnapshot.wordCount} từ
                            </p>
                        </div>
                        <div className="whitespace-pre-wrap text-base md:text-lg leading-relaxed md:leading-loose font-serif" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {selectedSnapshot.content}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                        <Book className="w-16 h-16 mb-4 text-[var(--text-secondary)]" />
                        <p className="text-lg font-medium text-[var(--text-primary)]">Chọn một chương để đọc</p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Dữ liệu được lấy từ snapshot tại thời điểm đánh giá</p>
                    </div>
                )}
            </div>
        </div>
    );
}
