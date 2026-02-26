import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BrainCircuit,
    Search,
    Zap,
    Database,
    Code2,
    Cpu,
    Github,
    PenTool,
    Sparkles,
    ArrowRight
} from 'lucide-react';

const LandingPage = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center w-full bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none animate-[pulseSlow_8s_ease-in-out_infinite]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[150px] pointer-events-none animate-[pulseSlow_10s_ease-in-out_infinite_1s]"></div>
            <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none animate-[pulseSlow_9s_ease-in-out_infinite_0.5s]"></div>

            {/* Navbar Minimal */}
            <nav className={`fixed top-0 w-full flex justify-center z-50 transition-all duration-300 ${scrolled ? 'bg-[var(--bg-app)]/80 backdrop-blur-md shadow-sm py-4 border-b border-[var(--border-color)]' : 'bg-transparent py-6'}`}>
                <div className="w-full max-w-7xl flex justify-between items-center px-6 animate-fade-in">
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative flex items-center justify-center bg-indigo-500/10 p-2 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                            <img src="/logo.png" alt="StoryRAG Logo" className="h-8 w-auto relative z-10" />
                        </div>
                        <span className="text-2xl font-black tracking-tight">Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Nest</span></span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Link to="/login" className="px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block">
                            Đăng nhập
                        </Link>
                        <Link to="/register" className="group relative px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:scale-105 flex items-center gap-2 overflow-hidden">
                            <span className="relative z-10">Bắt đầu miễn phí</span>
                            <div className="absolute inset-0 h-full w-full opacity-0 group-hover:opacity-20 bg-white transition-opacity"></div>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 w-full max-w-7xl px-6 flex flex-col mt-32 lg:mt-40 items-center text-center relative z-10">

                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium text-sm mb-10 animate-slide-up shadow-sm hover:shadow-md transition-shadow cursor-default group">
                    <div className="flex items-center justify-center p-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                        <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span>Cập nhật mới: <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">Gợi ý viết lách AI</span></span>
                </div>

                <h1 className="text-5xl lg:text-[5rem] font-extrabold tracking-tight mb-8 max-w-5xl text-[var(--text-primary)] animate-slide-up delay-100 leading-[1.1]">
                    Khơi nguồn sáng tạo <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">Tuyệt Tác Văn Học</span>
                </h1>

                <p className="text-lg lg:text-xl text-[var(--text-secondary)] max-w-3xl mb-12 animate-slide-up delay-200 leading-relaxed font-medium">
                    StoryNest cung cấp hệ sinh thái toàn diện cho tác giả: Từ chấm điểm, phát hiện điểm nghẽn trong cốt truyện, đến gợi ý phát triển ý tưởng bằng trí tuệ nhân tạo RAG thế hệ mới.
                </p>

                <div className="flex flex-col sm:flex-row gap-5 mb-32 animate-slide-up delay-300 w-full sm:w-auto">
                    <Link to="/register" className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-[var(--text-primary)] text-[var(--bg-app)] rounded-full font-bold text-lg transition-all hover:scale-105 shadow-xl sm:w-auto w-full overflow-hidden">
                        <span className="relative z-10">Viết truyện ngay</span>
                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 h-full w-full opacity-0 group-hover:opacity-10 bg-white transition-opacity"></div>
                    </Link>
                    <button onClick={() => window.scrollTo({ top: document.getElementById('features')?.offsetTop, behavior: 'smooth' })} className="flex items-center justify-center gap-2 px-8 py-4 bg-[var(--bg-surface)] hover:bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full font-bold text-lg transition-all hover:scale-105 shadow-sm sm:w-auto w-full">
                        Khám phá tính năng
                    </button>
                </div>

                {/* Features Section */}
                <div id="features" className="w-full mb-40 animate-slide-up delay-300">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Trợ lý đắc lực cho mọi tác giả</h2>
                        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">Kết hợp giữa phân tích đa chiều và sáng tạo không giới hạn, đồng hành cùng bạn trên từng trang viết.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeatureCard
                            icon={<Search className="w-7 h-7 text-purple-500" />}
                            iconBg="bg-purple-500/10"
                            title="Phân tích chuyên sâu"
                            description="Tự động tìm và chỉ ra các 'điểm nghẽn' của cốt truyện, mâu thuẫn thời gian hay sự phi lý của nhân vật."
                            hoverBorder="hover:border-purple-500/50"
                        />
                        <FeatureCard
                            icon={<BrainCircuit className="w-7 h-7 text-indigo-500" />}
                            iconBg="bg-indigo-500/10"
                            title="Đánh giá khách quan"
                            description="Ứng dụng AI/LLMs để chấm điểm chi tiết câu chuyện, và diễn biến một cách toàn diện."
                            hoverBorder="hover:border-indigo-500/50"
                        />
                        <FeatureCard
                            icon={<PenTool className="w-7 h-7 text-emerald-500" />}
                            iconBg="bg-emerald-500/10"
                            title="Gợi ý viết sáng tạo"
                            description="Vượt qua 'writer's block'. AI đồng hành gợi ý hướng phát triển cốt truyện, lời thoại và xây dựng thế giới."
                            hoverBorder="hover:border-emerald-500/50"
                        />
                        <FeatureCard
                            icon={<Zap className="w-7 h-7 text-blue-500" />}
                            iconBg="bg-blue-500/10"
                            title="Xử lý chớp nhoáng"
                            description="Truy xuất và tham chiếu ngữ cảnh từ hàng ngàn chương truyện trong tích tắc nhờ RAG & Vector Database."
                            hoverBorder="hover:border-blue-500/50"
                        />
                    </div>
                </div>

                {/* Tech Stack Section */}
                <div className="w-full mb-32 flex flex-col items-center animate-fade-in">
                    <h2 className="text-sm uppercase tracking-widest text-[var(--text-secondary)] font-bold mb-10">Được xây dựng bằng các công nghệ hiện đại nhất</h2>
                    <div className="flex flex-wrap justify-center gap-4 lg:gap-8">
                        <TechBadge icon={<Code2 className="w-6 h-6 text-[#61DAFB]" />} name="React & Tailwind" />
                        <TechBadge icon={<Database className="w-6 h-6 text-[#336791]" />} name="Supabase" />
                        <TechBadge icon={<Cpu className="w-6 h-6 text-[#512BD4]" />} name=".NET 8" />
                        <TechBadge icon={<BrainCircuit className="w-6 h-6 text-indigo-500" />} name="RAG Engine" />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-[var(--border-color)] py-10 mt-auto bg-[var(--bg-surface)] backdrop-blur-md relative z-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="StoryRAG Logo" className="h-8 w-auto opacity-80" />
                        <span className="font-semibold text-[var(--text-secondary)]">StoryNest © 2026.</span>
                    </div>
                    <div className="flex gap-8">
                        <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors">Giới thiệu</a>
                        <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors">Tính năng</a>
                        <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors flex items-center gap-2">
                            <Github className="w-5 h-5" /> Mã nguồn
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

interface FeatureCardProps {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    description: string;
    hoverBorder: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, iconBg, title, description, hoverBorder }) => (
    <div className={`bg-[var(--bg-surface)] p-8 rounded-[2rem] text-left border border-[var(--border-color)] ${hoverBorder} transition-all duration-300 group shadow-sm hover:shadow-xl hover:-translate-y-2 relative overflow-hidden flex flex-col`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none"></div>
        <div className={`w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner`}>
            {icon}
        </div>
        <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">{title}</h3>
        <p className="text-[var(--text-secondary)] leading-relaxed font-medium flex-1">
            {description}
        </p>
    </div>
);

interface TechBadgeProps {
    icon: React.ReactNode;
    name: string;
}

const TechBadge: React.FC<TechBadgeProps> = ({ icon, name }) => (
    <div className="flex items-center gap-3 text-[var(--text-primary)] bg-[var(--bg-surface)] px-6 py-3.5 rounded-2xl border border-[var(--border-color)] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all shadow-sm cursor-default hover:-translate-y-1 transform group">
        <div className="group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <span className="font-bold text-lg">{name}</span>
    </div>
);

export default LandingPage;
