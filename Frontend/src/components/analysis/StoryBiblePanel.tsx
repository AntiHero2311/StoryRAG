import { ContentAnalysisResult } from '../../services/reportService';
import { BookOpen, Globe, Users, Clock, Sparkles } from 'lucide-react';

interface Props {
    data: ContentAnalysisResult | null;
}

export default function StoryBiblePanel({ data }: Props) {
    if (!data) return null;

    return (
        <div className="rounded-2xl p-6 md:p-8 mt-5 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500" 
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', boxShadow: '0 4px 24px -8px rgba(0,0,0,0.2)' }}>
            
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" 
                     style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)' }}>
                    <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                        Cẩm nang truyện (Story Bible)
                    </h2>
                    <p className="text-[var(--text-secondary)] text-sm mt-1.5 opacity-80 leading-relaxed max-w-2xl">
                        Bộ tài liệu thiết kế cốt truyện, nhân vật và bối cảnh được AI trích xuất và tổng hợp tự động từ tác phẩm của bạn.
                    </p>
                </div>
            </div>

            {/* Analysis Note */}
            {data.analysisNote && (
                <div className="rounded-2xl p-5 relative overflow-hidden" 
                     style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <p className="text-[var(--text-primary)] text-sm font-bold mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Ghi chú phân tích
                    </p>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed relative z-10">{data.analysisNote}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                
                {/* Worldbuilding */}
                <div>
                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-emerald-400" /> Bối cảnh (Worldbuilding)
                    </h3>
                    {data.worldSettings.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có dữ liệu bối cảnh.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.worldSettings.map((item, idx) => (
                                <div key={idx} className="p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" 
                                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p className="font-bold text-base text-[var(--text-primary)] mb-2 text-emerald-400">{item.name}</p>
                                    <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">{item.description}</p>
                                    {item.rules && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <p className="text-xs text-emerald-500/80 uppercase tracking-wider font-bold mb-1">Quy tắc thế giới</p>
                                            <p className="text-sm italic text-[var(--text-secondary)]">{item.rules}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Characters */}
                <div>
                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" /> Nhân vật chính
                    </h3>
                    {data.characters.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có dữ liệu nhân vật.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.characters.map((item, idx) => (
                                <div key={idx} className="p-5 rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" 
                                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="font-black text-lg text-[var(--text-primary)]">{item.name}</p>
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
                                            {item.role}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed flex-1">{item.description}</p>
                                    {item.motivation && (
                                        <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10 mt-auto">
                                            <p className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider">Động lực</p>
                                            <p className="text-sm text-[var(--text-secondary)]">{item.motivation}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div>
                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-400" /> Tuyến thời gian (Timeline)
                    </h3>
                    {data.timelineEvents.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có sự kiện.</p>
                    ) : (
                        <div className="relative border-l-2 border-white/10 ml-3 pl-6 flex flex-col gap-6 py-2">
                            {data.timelineEvents.sort((a, b) => a.sortOrder - b.sortOrder).map((item, idx) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] border-2 border-[var(--bg-surface)]"></div>
                                    <div className="p-5 rounded-2xl transition-all duration-300 hover:bg-white/5" 
                                         style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                            <p className="font-bold text-base text-[var(--text-primary)]">{item.title}</p>
                                            <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md tracking-wide">
                                                {item.time}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Themes */}
                <div>
                    <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-pink-500 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-fuchsia-400" /> Chủ đề lõi (Themes)
                    </h3>
                    {data.themes.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có dữ liệu chủ đề.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {data.themes.map((item, idx) => (
                                <div key={idx} className="p-5 rounded-2xl flex flex-col md:flex-row gap-4 transition-all duration-300 hover:bg-white/5" 
                                     style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div className="md:w-1/3 shrink-0">
                                        <p className="font-bold text-lg text-fuchsia-400 mb-1">{item.title}</p>
                                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.description}</p>
                                    </div>
                                    <div className="md:w-2/3 md:border-l border-white/10 md:pl-4 flex flex-col justify-center">
                                        <p className="text-[11px] uppercase tracking-wider font-bold text-fuchsia-500/70 mb-1">Dấu ấn / Bằng chứng</p>
                                        <p className="text-sm italic text-[var(--text-secondary)] opacity-90 leading-relaxed">"{item.evidence}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
