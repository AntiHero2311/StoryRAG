import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, RefreshCcw, Sparkles, Users } from 'lucide-react';
import EvidenceChunksPanel from './EvidenceChunksPanel';
import { characterService, type CharacterEntry, getRoleInfo } from '../../services/characterService';
import { characterRelationshipService, type CharacterRelationshipDto } from '../../services/characterRelationshipService';
import { useToast } from '../Toast';

type RelEdge = Edge<{ rel: CharacterRelationshipDto }>;

const RELATION_COLORS: Record<string, string> = {
    family: '#a78bfa',
    romance: '#fb7185',
    friend: '#34d399',
    ally: '#22c55e',
    rival: '#f59e0b',
    enemy: '#ef4444',
    mentor: '#60a5fa',
};

function normalizeType(t: string) {
    return (t ?? '').trim().toLowerCase();
}

function colorForRelationType(t: string) {
    const key = normalizeType(t);
    if (RELATION_COLORS[key]) return RELATION_COLORS[key];
    // deterministic fallback
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const palette = ['#22c55e', '#60a5fa', '#a78bfa', '#f59e0b', '#fb7185', '#34d399', '#f97316', '#e879f9'];
    return palette[h % palette.length];
}

function circularLayout(chars: CharacterEntry[]): Record<string, { x: number; y: number }> {
    const n = Math.max(chars.length, 1);
    const radius = Math.min(320, 110 + n * 10);
    const step = (Math.PI * 2) / n;
    const pos: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < chars.length; i++) {
        const a = i * step - Math.PI / 2;
        pos[chars[i].id] = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
    }
    return pos;
}

export default function CharacterRelationshipsGraphPanel({ projectId }: { projectId: string }) {
    const toast = useToast();
    const [characters, setCharacters] = useState<CharacterEntry[]>([]);
    const [rels, setRels] = useState<CharacterRelationshipDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEdgeEvidence, setSelectedEdgeEvidence] = useState<{
        ordinals: number[];
        label: string;
    } | null>(null);

    const load = async () => {
        if (!projectId) return;
        setLoading(true);
        setError(null);
        try {
            const [chs, rs] = await Promise.all([
                characterService.getAll(projectId),
                characterRelationshipService.getAll(projectId),
            ]);
            setCharacters(chs);
            setRels(rs);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Không thể tải quan hệ nhân vật.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const idToChar = useMemo(() => {
        const m = new Map<string, CharacterEntry>();
        characters.forEach(c => m.set(c.id, c));
        return m;
    }, [characters]);

    const degree = useMemo(() => {
        const d = new Map<string, number>();
        for (const r of rels) {
            d.set(r.charAId, (d.get(r.charAId) ?? 0) + 1);
            d.set(r.charBId, (d.get(r.charBId) ?? 0) + 1);
        }
        return d;
    }, [rels]);

    const { nodes, edges, relationTypes } = useMemo(() => {
        const sortedChars = [...characters].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        const positions = circularLayout(sortedChars);

        const nodes: Node[] = sortedChars.map(c => {
            const deg = degree.get(c.id) ?? 0;
            const size = Math.min(84, 44 + deg * 10);
            const role = getRoleInfo(c.role || '');
            return {
                id: c.id,
                position: positions[c.id] ?? { x: 0, y: 0 },
                data: { label: c.name },
                style: {
                    width: size,
                    height: size,
                    borderRadius: 999,
                    padding: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${role.color}55`,
                    color: 'var(--text-primary)',
                    boxShadow: deg > 0 ? '0 10px 30px rgba(0,0,0,0.25)' : 'none',
                    fontSize: size >= 70 ? 12 : 11,
                    fontWeight: 700,
                },
            };
        });

        const relationTypes = new Map<string, number>();
        const edges: RelEdge[] = rels
            .filter(r => idToChar.has(r.charAId) && idToChar.has(r.charBId))
            .map(r => {
                relationTypes.set(r.relationType, (relationTypes.get(r.relationType) ?? 0) + 1);
                const color = colorForRelationType(r.relationType);
                const w = Math.max(1.2, Math.min(6, 1.2 + (r.strengthScore ?? 0) * 3));
                return {
                    id: r.id,
                    source: r.charAId,
                    target: r.charBId,
                    label: r.relationType || 'unknown',
                    style: { stroke: color, strokeWidth: w },
                    labelStyle: { fill: 'var(--text-secondary)', fontWeight: 700 },
                    data: { rel: r },
                };
            });

        return { nodes, edges, relationTypes };
    }, [characters, degree, idToChar, rels]);

    const legendItems = useMemo(() => {
        return Array.from(relationTypes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([t, count]) => ({
                type: t || 'unknown',
                count,
                color: colorForRelationType(t || 'unknown'),
            }));
    }, [relationTypes]);

    const handleExtract = async () => {
        if (!projectId || extracting) return;
        setExtracting(true);
        setError(null);
        try {
            const res = await characterRelationshipService.extract(projectId);
            toast.success(`Đã trích xuất quan hệ: +${res.upserted} quan hệ (AI xử lý ${res.pairsSentToAi} cặp).`);
            await load();
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Không thể trích xuất quan hệ.';
            setError(msg);
            toast.error(msg);
        } finally {
            setExtracting(false);
        }
    };

    return (
        <section
            className="rounded-2xl p-4 md:p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
        >
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <Users className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                    </div>
                    <div>
                        <p className="text-[var(--text-primary)] font-bold text-sm">Mạng quan hệ nhân vật</p>
                        <p className="text-[var(--text-secondary)] text-xs">
                            Node = nhân vật (size theo số quan hệ). Edge = quan hệ (màu theo loại, độ dày theo strength).
                        </p>
                    </div>
                </div>
                <div className="md:ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading || !projectId}
                        className="h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-50"
                        style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.28)' }}
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                        Làm mới
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleExtract()}
                        disabled={extracting || !projectId}
                        className="h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-50"
                        style={{ background: 'rgba(245,166,35,0.12)', color: '#fbbf24', border: '1px solid rgba(245,166,35,0.28)' }}
                        title="Gọi AI để trích xuất quan hệ từ chunk RAG"
                    >
                        {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Trích xuất quan hệ
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 text-sm rounded-xl p-3"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.22)' }}>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
                <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.18)', height: 520 }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        fitView
                        minZoom={0.2}
                        onEdgeClick={(_, edge) => {
                            const r = (edge as RelEdge)?.data?.rel;
                            const a = r?.charAId ? idToChar.get(r.charAId) : null;
                            const b = r?.charBId ? idToChar.get(r.charBId) : null;
                            const label = `${a?.name ?? 'A'} — ${r?.relationType ?? 'unknown'} — ${b?.name ?? 'B'}`;
                            const ordinals = (r?.evidenceChunkIds ?? []).filter((n): n is number => Number.isFinite(n));
                            setSelectedEdgeEvidence({ ordinals, label });
                        }}
                    >
                        <Background color="rgba(255,255,255,0.06)" />
                        <Controls />
                    </ReactFlow>
                </div>

                <aside className="rounded-2xl p-4"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                    <p className="text-[var(--text-primary)] font-bold text-sm mb-2">Legend</p>
                    {legendItems.length === 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Chưa có quan hệ. Nhấn <strong>Trích xuất quan hệ</strong> để chạy AI.
                        </p>
                    )}
                    <div className="space-y-2">
                        {legendItems.map(it => (
                            <div key={it.type} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ background: it.color }} />
                                <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {it.type}
                                </span>
                                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{it.count}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Tip</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Click vào edge để xem evidence chunks (đoạn gốc) ở panel bên phải.
                        </p>
                    </div>
                </aside>
            </div>

            <EvidenceChunksPanel
                open={selectedEdgeEvidence !== null}
                onClose={() => setSelectedEdgeEvidence(null)}
                projectId={projectId}
                ordinals={selectedEdgeEvidence?.ordinals ?? []}
                evidenceHighlight=""
                criterionLabel={selectedEdgeEvidence?.label ?? 'Bằng chứng quan hệ'}
            />
        </section>
    );
}

