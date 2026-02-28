import { BarChart2, BrainCircuit, Search, Sparkles, Zap, Clock } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { UserInfo } from '../utils/jwtHelper';

const FEATURES = [
    {
        icon: BrainCircuit,
        title: 'Phân tích toàn bộ bộ truyện',
        desc: 'AI đọc và hiểu toàn bộ nội dung các chương, xây dựng ngữ cảnh toàn diện.',
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.08)',
    },
    {
        icon: Search,
        title: 'Tìm kiếm ngữ nghĩa',
        desc: 'Tìm các đoạn văn liên quan bằng vector embedding — không chỉ tìm theo từ khóa.',
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.08)',
    },
    {
        icon: Sparkles,
        title: 'Hỏi đáp AI về truyện',
        desc: 'Đặt câu hỏi về nhân vật, cốt truyện, bối cảnh và nhận câu trả lời có nguồn dẫn.',
        color: '#f5a623',
        bg: 'rgba(245,166,35,0.08)',
    },
    {
        icon: Zap,
        title: 'Kiểm tra tính nhất quán',
        desc: 'Phát hiện mâu thuẫn giữa các chương: timeline, tên nhân vật, đặc điểm,...',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.08)',
    },
];

function AnalysisContent() {
    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold uppercase tracking-widest"
                        style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623' }}>
                        <Clock className="w-3.5 h-3.5" />
                        Phase 2 — Đang phát triển
                    </div>
                    <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-2xl"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                        <BarChart2 className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-[var(--text-primary)] font-black text-3xl mb-3">
                        Phân tích AI
                    </h1>
                    <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-lg mx-auto">
                        Tính năng phân tích bộ truyện bằng AI đang được xây dựng.
                        Bạn sẽ có thể hỏi đáp, tìm kiếm và kiểm tra tính nhất quán toàn bộ tác phẩm.
                    </p>
                </div>

                {/* Feature cards */}
                <div className="grid sm:grid-cols-2 gap-4 mb-10">
                    {FEATURES.map(f => (
                        <div key={f.title}
                            className="rounded-2xl p-5 flex gap-4 items-start"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: f.bg }}>
                                <f.icon className="w-5 h-5" style={{ color: f.color }} />
                            </div>
                            <div>
                                <p className="text-[var(--text-primary)] font-semibold text-sm mb-1">{f.title}</p>
                                <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Progress note */}
                <div className="rounded-2xl p-6 text-center"
                    style={{ background: 'var(--bg-surface)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                        Để chuẩn bị cho tính năng này, hãy viết chương và nhấn nút{' '}
                        <span className="text-[#f5a623] font-semibold">✂ Chunk</span>{' '}
                        trong Workspace để xử lý nội dung trước.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function AnalysisPage() {
    return (
        <MainLayout pageTitle="Phân tích AI">
            {(_userInfo: UserInfo) => <AnalysisContent />}
        </MainLayout>
    );
}
