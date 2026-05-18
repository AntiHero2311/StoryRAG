import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import api from '../../services/api';

type RagConfig = {
    chunk_size: number;
    chunk_overlap: number;
    top_k_chat: number;
    top_k_report: number;
    splitter: string;
};

export default function RagConfigPanel() {
    const [config, setConfig] = useState<RagConfig>({
        chunk_size: 800, chunk_overlap: 100, top_k_chat: 5, top_k_report: 8, splitter: 'paragraph',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<RagConfig>('/admin/rag-config')
            .then(r => setConfig(r.data))
            .catch(() => setError('Không tải được cấu hình RAG.'))
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
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải cấu hình...
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {error && (
                <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>
            )}
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
            <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 bg-indigo-600">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu RAG
                </button>
                {saved && <span className="flex items-center gap-1.5 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Đã lưu</span>}
            </div>
        </div>
    );
}
