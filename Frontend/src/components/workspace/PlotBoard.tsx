import { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    Connection,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { plotNoteService, PlotNoteEntry, CreatePlotNoteRequest, getPlotNoteTypeColor, getPlotNoteTypeLabel, PLOT_NOTE_TYPES } from '../../services/plotNoteService';
import { Plus, Save, Loader2 } from 'lucide-react';
import { useToast } from '../Toast';

interface PlotBoardProps {
    projectId: string;
}

// Custom Node for Plot Notes
function PlotNode({ data }: { data: any }) {
    return (
        <div className="px-4 py-3 rounded-2xl shadow-xl border w-[260px] cursor-grab active:cursor-grabbing transition-transform" 
             style={{ background: 'var(--bg-app)', borderColor: data.color + '66' }}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-white border-2" style={{ borderColor: data.color }} />
            <div className="flex flex-col gap-1.5 pointer-events-none">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" 
                          style={{ background: data.color + '15', color: data.color }}>
                        {data.typeLabel}
                    </span>
                </div>
                <div className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{data.label}</div>
                <div className="text-[11px] leading-relaxed max-h-[80px] overflow-hidden truncate whitespace-normal" 
                     style={{ color: 'var(--text-secondary)' }}>
                    {data.content}
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-white border-2" style={{ borderColor: data.color }} />
        </div>
    );
}

const nodeTypes = { plotNode: PlotNode };

const FLOW_META_REGEX = /\n\n<!-- xyflow: (.*?) -->$/;

export default function PlotBoard({ projectId }: PlotBoardProps) {
    const toast = useToast();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<PlotNoteEntry[]>([]);
    
    // Add form state
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState<CreatePlotNoteRequest>({ type: 'Arc', title: '', content: '' });

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            const data = await plotNoteService.getAll(projectId);
            setEntries(data);
            
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            
            data.forEach((entry, idx) => {
                const match = entry.content.match(FLOW_META_REGEX);
                let meta = { x: 100 + (idx % 4) * 300, y: 100 + Math.floor(idx / 4) * 200, edges: [] as Edge[] };
                let pureContent = entry.content;
                
                if (match) {
                    try {
                        meta = JSON.parse(match[1]);
                        pureContent = entry.content.replace(match[0], '');
                        if (meta.edges) newEdges.push(...meta.edges);
                    } catch(e) {}
                }
                
                newNodes.push({
                    id: entry.id,
                    type: 'plotNode',
                    position: { x: meta.x, y: meta.y },
                    data: { 
                        label: entry.title, 
                        content: pureContent, 
                        typeLabel: getPlotNoteTypeLabel(entry.type),
                        color: getPlotNoteTypeColor(entry.type)
                    }
                });
            });
            
            setNodes(newNodes);
            // Deduplicate edges just in case
            const uniqueEdges = newEdges.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            setEdges(uniqueEdges);
        } catch (e) {
            toast.error('Lỗi khi tải dữ liệu cốt truyện.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLayout = async () => {
        setSaving(true);
        try {
            // Group edges by their source node
            const edgesBySource: Record<string, Edge[]> = {};
            edges.forEach(e => {
                if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
                edgesBySource[e.source].push(e);
            });

            // Update all nodes in DB
            const promises = nodes.map(node => {
                const entry = entries.find(e => e.id === node.id);
                if (!entry) return Promise.resolve();
                
                let pureContent = entry.content.replace(FLOW_META_REGEX, '');
                const meta = {
                    x: Math.round(node.position.x),
                    y: Math.round(node.position.y),
                    edges: edgesBySource[node.id] || []
                };
                
                const newContent = pureContent + `\n\n<!-- xyflow: ${JSON.stringify(meta)} -->`;
                if (newContent !== entry.content) {
                    return plotNoteService.update(projectId, node.id, { content: newContent });
                }
                return Promise.resolve();
            });
            
            await Promise.all(promises);
            toast.success('Đã lưu sơ đồ cốt truyện!');
            loadData();
        } catch (e) {
            toast.error('Lỗi khi lưu sơ đồ.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddNode = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            const meta = { x: 150, y: 150, edges: [] };
            const req = {
                ...form,
                content: form.content + `\n\n<!-- xyflow: ${JSON.stringify(meta)} -->`
            };
            await plotNoteService.create(projectId, req);
            toast.success('Đã thêm thẻ mới trên sơ đồ');
            setShowAdd(false);
            setForm({ type: 'Arc', title: '', content: '' });
            loadData();
        } catch (e) {
            toast.error('Lỗi tạo thẻ.');
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteNode = async (nodesToDelete: Node[]) => {
        try {
            await Promise.all(nodesToDelete.map(n => plotNoteService.delete(projectId, n.id)));
            toast.success('Đã xóa thẻ khỏi sơ đồ.');
            setEntries(prev => prev.filter(e => !nodesToDelete.some(n => n.id === e.id)));
        } catch (e) {
            toast.error('Có lỗi khi xóa thẻ.');
        }
    };

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: 'var(--accent)', strokeWidth: 2 } }, eds)), []);

    if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin opacity-50" /></div>;

    return (
        <div className="flex-1 flex flex-col w-full h-full relative">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button onClick={() => setShowAdd(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-xs"
                        style={{ color: 'var(--text-primary)' }}>
                    <Plus className="w-4 h-4 text-emerald-500" /> Thêm thẻ
                </button>
                <button onClick={handleSaveLayout} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all font-bold text-xs text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                    Lưu Bảng
                </button>
            </div>

            {showAdd && (
                <div className="absolute top-16 left-4 z-20 w-[300px] bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-2xl flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] mb-1">Thêm thẻ cốt truyện</h3>
                    <input autoFocus placeholder="Tên sự kiện / Thẻ" maxLength={100} 
                        value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                        className="px-3 py-2 bg-[var(--bg-app)] text-xs rounded-xl border border-[var(--border-color)] outline-none focus:border-violet-500" />
                    
                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                         className="px-3 py-2 bg-[var(--bg-app)] text-xs rounded-xl border border-[var(--border-color)] outline-none text-[var(--text-secondary)]">
                        {PLOT_NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>

                    <textarea placeholder="Nội dung, diễn biến..." rows={4} maxLength={2000}
                        value={form.content} onChange={e => setForm({...form, content: e.target.value})}
                        className="px-3 py-2 bg-[var(--bg-app)] text-xs rounded-xl border border-[var(--border-color)] outline-none resize-none focus:border-violet-500" />

                    <div className="flex gap-2 mt-1">
                        <button onClick={handleAddNode} disabled={!form.title.trim() || saving}
                                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">Thêm vào Bảng</button>
                        <button onClick={() => setShowAdd(false)}
                                className="px-4 py-2 bg-[var(--bg-app)] text-[var(--text-secondary)] rounded-xl text-xs font-bold border border-[var(--border-color)]">Hủy</button>
                    </div>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodesDelete={handleDeleteNode}
                nodeTypes={nodeTypes}
                fitView
                className="bg-[#0f1115]"
                colorMode="dark"
            >
                <Background color="rgba(255,255,255,0.05)" gap={16} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
