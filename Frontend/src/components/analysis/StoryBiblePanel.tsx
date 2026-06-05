import { useState } from 'react';
import { ContentAnalysisResult } from '../../services/reportService';
import { BookOpen, Globe, Users, Clock, Sparkles, Tag, ChevronRight } from 'lucide-react';

interface Props {
    data: ContentAnalysisResult | null;
}

export default function StoryBiblePanel({ data }: Props) {
    const [showAllWorld, setShowAllWorld] = useState(false);
    const [showAllChars, setShowAllChars] = useState(false);
    const [showAllTimeline, setShowAllTimeline] = useState(false);

    const [worldFilter, setWorldFilter] = useState<string>("Tất cả");
    const [charFilter, setCharFilter] = useState<string>("Tất cả");
    const [timelineFilter, setTimelineFilter] = useState<string>("Tất cả");

    if (!data) return null;

    const getWorldCategoryStyle = (category?: string) => {
        const cat = (category ?? "").toLowerCase();
        if (cat.includes("địa lý") || cat.includes("địa hình") || cat.includes("geography") || cat.includes("vùng") || cat.includes("lãnh thổ")) {
            return { bg: "rgba(16,185,129,0.08)", text: "#34d399", border: "rgba(16,185,129,0.2)" };
        }
        if (cat.includes("phép thuật") || cat.includes("vũ khí") || cat.includes("magic") || cat.includes("weapon") || cat.includes("dị năng") || cat.includes("chiêu thức") || cat.includes("bí kíp") || cat.includes("võ công")) {
            return { bg: "rgba(168,85,247,0.08)", text: "#c084fc", border: "rgba(168,85,247,0.2)" };
        }
        if (cat.includes("xã hội") || cat.includes("tổ chức") || cat.includes("society") || cat.includes("organization") || cat.includes("quốc gia") || cat.includes("gia tộc") || cat.includes("bang phái") || cat.includes("thế lực")) {
            return { bg: "rgba(59,130,246,0.08)", text: "#60a5fa", border: "rgba(59,130,246,0.2)" };
        }
        if (cat.includes("lịch sử") || cat.includes("history") || cat.includes("truyền thuyết") || cat.includes("sự tích")) {
            return { bg: "rgba(245,158,11,0.08)", text: "#fbbf24", border: "rgba(245,158,11,0.2)" };
        }
        if (cat.includes("tôn giáo") || cat.includes("tín ngưỡng") || cat.includes("thần thoại") || cat.includes("thần thánh") || cat.includes("religion") || cat.includes("myth") || cat.includes("belief")) {
            return { bg: "rgba(234,179,8,0.08)", text: "#facc15", border: "rgba(234,179,8,0.2)" };
        }
        if (cat.includes("sinh vật") || cat.includes("động vật") || cat.includes("thực vật") || cat.includes("quái vật") || cat.includes("creature") || cat.includes("beast") || cat.includes("monster")) {
            return { bg: "rgba(34,197,94,0.08)", text: "#4ade80", border: "rgba(34,197,94,0.2)" };
        }
        if (cat.includes("công nghệ") || cat.includes("khoa học") || cat.includes("thiết bị") || cat.includes("science") || cat.includes("technology") || cat.includes("cyber") || cat.includes("kỹ thuật")) {
            return { bg: "rgba(6,182,212,0.08)", text: "#22d3ee", border: "rgba(6,182,212,0.2)" };
        }
        if (cat.includes("vật phẩm") || cat.includes("cổ vật") || cat.includes("bảo vật") || cat.includes("artifact") || cat.includes("item") || cat.includes("trang bị")) {
            return { bg: "rgba(244,63,94,0.08)", text: "#fb7185", border: "rgba(244,63,94,0.2)" };
        }
        if (cat.includes("sức mạnh") || cat.includes("cảnh giới") || cat.includes("power") || cat.includes("level") || cat.includes("hệ thống")) {
            return { bg: "rgba(236,72,153,0.08)", text: "#f472b6", border: "rgba(236,72,153,0.2)" };
        }
        return { bg: "rgba(99,102,241,0.08)", text: "#a5b4fc", border: "rgba(99,102,241,0.2)" };
    };

    const getCharRoleStyle = (role?: string) => {
        const r = (role ?? "").toLowerCase();
        if (r.includes("chính") || r.includes("protagonist") || r.includes("main")) {
            return { bg: "rgba(139,92,246,0.12)", text: "#c4b5fd", border: "rgba(139,92,246,0.25)" };
        }
        if (r.includes("phản diện") || r.includes("antagonist") || r.includes("kẻ thù") || r.includes("địch")) {
            return { bg: "rgba(239,68,68,0.12)", text: "#fca5a5", border: "rgba(239,68,68,0.25)" };
        }
        if (r.includes("đồng hành") || r.includes("supporting") || r.includes("phụ") || r.includes("trợ")) {
            return { bg: "rgba(100,116,139,0.15)", text: "#cbd5e1", border: "rgba(100,116,139,0.25)" };
        }
        return { bg: "rgba(59,130,246,0.12)", text: "#93c5fd", border: "rgba(59,130,246,0.25)" };
    };

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

            <div className="grid grid-cols-1 gap-10">
                
                {/* Worldbuilding */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-emerald-400" /> Bối cảnh (Worldbuilding)
                        </h3>
                        
                        {/* Interactive Category Filter Pills */}
                        {data.worldSettings.length > 0 && (() => {
                            const allWorldCategories = Array.from(new Set(data.worldSettings.map(w => w.category).filter(Boolean)));
                            if (allWorldCategories.length <= 1) return null;
                            return (
                                <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto pb-1 no-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => { setWorldFilter("Tất cả"); setShowAllWorld(false); }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 ${
                                            worldFilter === "Tất cả" 
                                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse-subtle" 
                                                : "bg-white/5 text-[var(--text-secondary)] border border-white/5 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        Tất cả ({data.worldSettings.length})
                                    </button>
                                    {allWorldCategories.map((cat, ci) => {
                                        const count = data.worldSettings.filter(w => w.category === cat).length;
                                        const style = getWorldCategoryStyle(cat);
                                        const isActive = worldFilter === cat;
                                        return (
                                            <button
                                                key={ci}
                                                type="button"
                                                onClick={() => { setWorldFilter(cat); setShowAllWorld(true); }}
                                                className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 border"
                                                style={{
                                                    background: isActive ? style.bg.replace("0.08", "0.2") : "rgba(255,255,255,0.03)",
                                                    color: isActive ? style.text : "var(--text-secondary)",
                                                    borderColor: isActive ? style.border.replace("0.2", "0.45") : "rgba(255,255,255,0.05)",
                                                    boxShadow: isActive ? `0 0 12px ${style.bg.replace("0.08", "0.15")}` : "none"
                                                }}
                                            >
                                                {cat} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {data.worldSettings.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có dữ liệu bối cảnh.</p>
                    ) : (() => {
                        const filtered = worldFilter === "Tất cả" 
                            ? data.worldSettings 
                            : data.worldSettings.filter(w => w.category === worldFilter);
                        
                        const displayed = (worldFilter === "Tất cả" && !showAllWorld)
                            ? filtered.slice(0, 4)
                            : filtered;

                        return (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {displayed.map((item, idx) => {
                                        const style = getWorldCategoryStyle(item.category);
                                        return (
                                            <div key={idx} className="p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between" 
                                                 style={{ 
                                                     background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)', 
                                                     border: '1px solid rgba(255,255,255,0.05)',
                                                     boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                                     borderLeft: `3px solid ${style.text}aa`
                                                 }}>
                                                <div>
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <p className="font-bold text-base text-[var(--text-bright)] tracking-wide">{item.title || item.description?.slice(0, 40)}</p>
                                                        {item.category && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 border"
                                                                  style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                                                                {item.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.75)' }}>
                                                        {item.description}
                                                    </p>
                                                </div>
                                                
                                                <div className="space-y-2.5 pt-3 border-t border-white/5">
                                                    {item.importance && (
                                                        <div>
                                                            <p className="text-[9px] text-emerald-500/80 uppercase tracking-widest font-bold mb-0.5">TẦM QUAN TRỌNG</p>
                                                            <p className="text-xs italic text-[var(--text-secondary)]" style={{ color: 'rgba(228, 228, 231, 0.65)' }}>{item.importance}</p>
                                                        </div>
                                                    )}
                                                    {item.sourceChapters && item.sourceChapters.length > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/60 font-medium">
                                                            <Tag className="w-3.5 h-3.5" />
                                                            <span>Xuất hiện ở: Chương {item.sourceChapters.slice(0, 5).join(', ')}{item.sourceChapters.length > 5 && `...`}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {worldFilter === "Tất cả" && data.worldSettings.length > 4 && (
                                    <div className="flex justify-center mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllWorld(!showAllWorld)}
                                            className="px-5 py-2 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/35 active:scale-95 flex items-center gap-1.5"
                                        >
                                            <span>{showAllWorld ? "Thu gọn bối cảnh" : `Xem thêm (+${data.worldSettings.length - 4} bối cảnh khác)`}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Characters */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-400" /> Nhân vật chính
                        </h3>

                        {/* Interactive Role Filter Pills */}
                        {data.characters.length > 0 && (() => {
                            const allCharRoles = Array.from(new Set(data.characters.map(c => c.role).filter(Boolean)));
                            if (allCharRoles.length <= 1) return null;
                            return (
                                <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto pb-1 no-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => { setCharFilter("Tất cả"); setShowAllChars(false); }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 ${
                                            charFilter === "Tất cả" 
                                                ? "bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] animate-pulse-subtle" 
                                                : "bg-white/5 text-[var(--text-secondary)] border border-white/5 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        Tất cả ({data.characters.length})
                                    </button>
                                    {allCharRoles.map((role, ri) => {
                                        const count = data.characters.filter(c => c.role === role).length;
                                        const style = getCharRoleStyle(role);
                                        const isActive = charFilter === role;
                                        return (
                                            <button
                                                key={ri}
                                                type="button"
                                                onClick={() => { setCharFilter(role); setShowAllChars(true); }}
                                                className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 border"
                                                style={{
                                                    background: isActive ? style.bg.replace("0.12", "0.22") : "rgba(255,255,255,0.03)",
                                                    color: isActive ? style.text : "var(--text-secondary)",
                                                    borderColor: isActive ? style.border.replace("0.25", "0.5") : "rgba(255,255,255,0.05)",
                                                    boxShadow: isActive ? `0 0 12px ${style.bg.replace("0.12", "0.15")}` : "none"
                                                }}
                                            >
                                                {role} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {data.characters.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có dữ liệu nhân vật.</p>
                    ) : (() => {
                        const filtered = charFilter === "Tất cả" 
                            ? data.characters 
                            : data.characters.filter(c => c.role === charFilter);
                        
                        const displayed = (charFilter === "Tất cả" && !showAllChars)
                            ? filtered.slice(0, 4)
                            : filtered;

                        return (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {displayed.map((item, idx) => {
                                        const style = getCharRoleStyle(item.role);
                                        return (
                                            <div key={idx} className="p-5 rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl justify-between" 
                                                 style={{ 
                                                     background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)', 
                                                     border: '1px solid rgba(255,255,255,0.05)',
                                                     boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                                     borderLeft: `3px solid ${style.text}aa`
                                                 }}>
                                                <div>
                                                    <div className="flex justify-between items-start gap-3 mb-3">
                                                        <p className="font-extrabold text-base text-[var(--text-bright)] tracking-wide">{item.name}</p>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 border"
                                                              style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                                                            {item.role}
                                                        </span>
                                                    </div>
                                                    
                                                    <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.75)' }}>
                                                        {item.description}
                                                    </p>
                                                    
                                                    {/* Traits */}
                                                    {item.traits && item.traits.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                                            {item.traits.map((trait, ti) => (
                                                                <span key={ti} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/5 text-blue-300/80 border border-blue-500/10">
                                                                    {trait}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="space-y-3 pt-3 border-t border-white/5">
                                                    {/* Background */}
                                                    {item.background && (
                                                        <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                                                            <p className="text-[9px] font-bold text-indigo-400 mb-1 uppercase tracking-wider">Tiểu sử / Thân thế</p>
                                                            <p className="text-xs leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.65)' }}>{item.background}</p>
                                                        </div>
                                                    )}

                                                    {/* Motivation fallback */}
                                                    {!item.background && item.motivation && (
                                                        <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                                                            <p className="text-[9px] font-bold text-indigo-400 mb-1 uppercase tracking-wider">Động lực phát triển</p>
                                                            <p className="text-xs leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.65)' }}>{item.motivation}</p>
                                                        </div>
                                                    )}

                                                    {/* Relationships */}
                                                    {item.relationships && item.relationships.length > 0 && (
                                                        <div>
                                                            <p className="text-[9px] font-bold text-blue-400/60 uppercase tracking-widest mb-1.5">Quan hệ xã hội</p>
                                                            <div className="flex flex-col gap-1.5">
                                                                {item.relationships.slice(0, 3).map((rel, ri) => (
                                                                    <div key={ri} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                                        <ChevronRight className="w-3 h-3 text-blue-400/40 shrink-0" />
                                                                        <span className="font-semibold text-blue-200">{rel.targetName}</span>
                                                                        <span className="text-blue-400/70">— {rel.type}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {item.firstAppearance > 0 && (
                                                        <p className="text-[9px] text-[var(--text-secondary)]/50 tracking-wider">
                                                            Xuất hiện lần đầu: Chương {item.firstAppearance}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {charFilter === "Tất cả" && data.characters.length > 4 && (
                                    <div className="flex justify-center mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllChars(!showAllChars)}
                                            className="px-5 py-2 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 hover:border-blue-500/35 active:scale-95 flex items-center gap-1.5"
                                        >
                                            <span>{showAllChars ? "Thu gọn nhân vật" : `Xem thêm (+${data.characters.length - 4} nhân vật khác)`}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Timeline */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-400" /> Tuyến thời gian (Timeline)
                        </h3>

                        {/* Interactive Timeline Filter Pills */}
                        {data.timelineEvents.length > 0 && (() => {
                            const allTimelineCategories = Array.from(new Set(data.timelineEvents.map(t => t.category).filter(Boolean)));
                            if (allTimelineCategories.length <= 1) return null;
                            return (
                                <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto pb-1 no-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => { setTimelineFilter("Tất cả"); setShowAllTimeline(false); }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 ${
                                            timelineFilter === "Tất cả" 
                                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-pulse-subtle" 
                                                : "bg-white/5 text-[var(--text-secondary)] border border-white/5 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        Tất cả ({data.timelineEvents.length})
                                    </button>
                                    {allTimelineCategories.map((cat, ti) => {
                                        const count = data.timelineEvents.filter(t => t.category === cat).length;
                                        const isActive = timelineFilter === cat;
                                        return (
                                            <button
                                                key={ti}
                                                type="button"
                                                onClick={() => { setTimelineFilter(cat); setShowAllTimeline(true); }}
                                                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 border ${
                                                    isActive 
                                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]" 
                                                        : "bg-white/5 text-[var(--text-secondary)] border-white/5 hover:bg-white/10 hover:text-white"
                                                }`}
                                            >
                                                {cat} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {data.timelineEvents.length === 0 ? (
                        <p className="text-[var(--text-secondary)] text-sm italic opacity-70">Không có sự kiện.</p>
                    ) : (() => {
                        const filtered = timelineFilter === "Tất cả" 
                            ? data.timelineEvents 
                            : data.timelineEvents.filter(t => t.category === timelineFilter);

                        const sorted = [...filtered].sort((a, b) => a.sortOrder - b.sortOrder);
                        const displayed = (timelineFilter === "Tất cả" && !showAllTimeline)
                            ? sorted.slice(0, 5)
                            : sorted;

                        return (
                            <div className="flex flex-col gap-4">
                                <div className="relative border-l-2 border-white/10 ml-3 pl-6 flex flex-col gap-6 py-2">
                                    {displayed.map((item, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] border-2 border-[var(--bg-surface)]"></div>
                                            <div className="p-5 rounded-2xl transition-all duration-300 hover:bg-white/5" 
                                                 style={{ 
                                                     background: 'rgba(255,255,255,0.015)', 
                                                     border: '1px solid rgba(255,255,255,0.05)',
                                                     boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                                                 }}>
                                                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-base text-[var(--text-primary)] tracking-wide">{item.title}</p>
                                                        {item.category && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400/80 px-2 py-0.5 rounded-md border border-amber-500/15">
                                                                {item.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md tracking-wider">
                                                        {item.timeLabel}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.75)' }}>{item.description}</p>
                                                {item.importance && (
                                                    <p className="text-[10px] text-amber-400/60 mt-2.5 italic border-t border-white/5 pt-2">Ý nghĩa: {item.importance}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {timelineFilter === "Tất cả" && data.timelineEvents.length > 5 && (
                                    <div className="flex justify-center mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllTimeline(!showAllTimeline)}
                                            className="px-5 py-2 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-500/35 active:scale-95 flex items-center gap-1.5"
                                        >
                                            <span>{showAllTimeline ? "Thu gọn sự kiện" : `Xem thêm (+${data.timelineEvents.length - 5} sự kiện khác)`}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
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
                                     style={{ 
                                         background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)', 
                                         border: '1px solid rgba(255,255,255,0.05)',
                                         boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                                     }}>
                                    <div className="md:w-1/3 shrink-0">
                                        <p className="font-extrabold text-base text-fuchsia-400 mb-1 tracking-wide">{item.title}</p>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed" style={{ color: 'rgba(228, 228, 231, 0.75)' }}>{item.description}</p>
                                    </div>
                                    <div className="md:w-2/3 md:border-l border-white/10 md:pl-4 flex flex-col justify-center">
                                        <p className="text-[9px] uppercase tracking-widest font-bold text-fuchsia-500/70 mb-1.5">BẰNG CHỨNG & DẤU ẤN VĂN HỌC</p>
                                        <p className="text-xs italic text-[var(--text-secondary)] opacity-95 leading-relaxed pl-0.5 text-fuchsia-100 font-sans antialiased">"{item.evidence}"</p>
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
