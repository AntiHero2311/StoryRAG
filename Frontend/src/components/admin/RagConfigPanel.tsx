import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save, Settings, Sparkles } from 'lucide-react';
import api from '../../services/api';

type RagConfig = {
    chunk_size: number;
    chunk_overlap: number;
    top_k_chat: number;
    top_k_report: number;
    splitter: string;
    stage1_batch_chunks: number;
    stage1_max_chunk_chars: number;
    facts_json_max_chars: number;
    bible_max_chars: number;
    estimated_tokens_per_query_embed: number;
    rubric_batch_size: number;
    analyze_rpm_limit: number;
};

export default function RagConfigPanel() {
    const [config, setConfig] = useState<RagConfig>({
        chunk_size: 800,
        chunk_overlap: 100,
        top_k_chat: 5,
        top_k_report: 8,
        splitter: 'paragraph',
        stage1_batch_chunks: 8,
        stage1_max_chunk_chars: 900,
        facts_json_max_chars: 12000,
        bible_max_chars: 4000,
        estimated_tokens_per_query_embed: 200,
        rubric_batch_size: 5,
        analyze_rpm_limit: 120,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<RagConfig>('/admin/rag-config')
            .then(r => setConfig(r.data))
            .catch(() => setError('Không tải được cấu hình RAG nâng cao.'))
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (field: keyof RagConfig, value: string | number) =>
        setConfig(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true); setError(null); setSaved(false);
        try {
            await api.put('/admin/rag-config', config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { errors?: string[]; message?: string } } };
            const errs = err?.response?.data?.errors ?? [];
            setError(errs.length ? errs.join(' ') : (err?.response?.data?.message ?? 'Lưu thất bại.'));
        } finally {
            setSaving(false);
        }
    };

    const inputBase = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[var(--bg-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-indigo-500/60';

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải cấu hình nâng cao...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>
            )}

            {/* Group 1: Basic RAG */}
            <div className="space-y-4">
                <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
                    <Settings className="w-4 h-4 text-indigo-400" /> Cấu hình RAG Cơ bản
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Chunk size</label>
                        <input type="number" min={100} max={4000} className={inputBase} value={config.chunk_size} onChange={e => handleChange('chunk_size', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Chunk overlap</label>
                        <input type="number" min={0} max={500} className={inputBase} value={config.chunk_overlap} onChange={e => handleChange('chunk_overlap', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Splitter</label>
                        <select className={inputBase} value={config.splitter} onChange={e => handleChange('splitter', e.target.value)}>
                            <option value="paragraph">paragraph</option>
                            <option value="sentence">sentence</option>
                            <option value="fixed">fixed</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Top-K Chat</label>
                        <input type="number" min={1} max={20} className={inputBase} value={config.top_k_chat} onChange={e => handleChange('top_k_chat', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Top-K Report</label>
                        <input type="number" min={1} max={20} className={inputBase} value={config.top_k_report} onChange={e => handleChange('top_k_report', Number(e.target.value))} />
                    </div>
                </div>
            </div>

            {/* Group 2: Advanced Performance & AI limits */}
            <div className="space-y-4 pt-2">
                <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Cấu hình Tối ưu hóa Hiệu năng & AI RPM
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Stage 1 Batch Chunks</label>
                        <input type="number" min={1} max={20} className={inputBase} value={config.stage1_batch_chunks} onChange={e => handleChange('stage1_batch_chunks', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Số lượng chunk quét song song Stage 1.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Stage 1 Max Chars</label>
                        <input type="number" min={200} max={4000} className={inputBase} value={config.stage1_max_chunk_chars} onChange={e => handleChange('stage1_max_chunk_chars', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Giới hạn ký tự tối đa của mỗi chunk ở Stage 1.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Facts JSON Max Chars</label>
                        <input type="number" min={2000} max={50000} className={inputBase} value={config.facts_json_max_chars} onChange={e => handleChange('facts_json_max_chars', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Dung lượng tối đa của JSON chứa facts lưu DB.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Bible Max Chars</label>
                        <input type="number" min={500} max={20000} className={inputBase} value={config.bible_max_chars} onChange={e => handleChange('bible_max_chars', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Độ dài tối đa của cẩm nang truyện nạp vào AI.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Est. Tokens Query Embed</label>
                        <input type="number" min={0} max={2000} className={inputBase} value={config.estimated_tokens_per_query_embed} onChange={e => handleChange('estimated_tokens_per_query_embed', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Ước tính token cho mỗi truy vấn embedding.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Rubric Batch Size</label>
                        <input type="number" min={1} max={20} className={inputBase} value={config.rubric_batch_size} onChange={e => handleChange('rubric_batch_size', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Số tiêu chí rubric đánh giá song song.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Gemini RPM Limit</label>
                        <input type="number" min={1} max={1200} className={inputBase} value={config.analyze_rpm_limit} onChange={e => handleChange('analyze_rpm_limit', Number(e.target.value))} />
                        <p className="text-[10px] text-[var(--text-secondary)] opacity-70">Số lượt gọi tối đa mỗi phút gửi tới Gemini.</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 bg-indigo-600">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu cấu hình hệ thống
                </button>
                {saved && <span className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình nâng cao</span>}
            </div>
        </div>
    );
}
