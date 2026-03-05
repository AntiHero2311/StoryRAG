import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
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
    ArrowRight,
    CheckCircle2,
    MessageSquare,
    BookOpen
} from 'lucide-react';

const LandingPage = () => {
    const [scrolled, setScrolled] = useState(false);
    const { scrollY } = useScroll();
    
    // Parallax effect cho background elements
    const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -150]);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5, ease: "easeOut" }
        }
    };

    // MOCK DATA: Testimonials
    const testimonials = [
        { name: "Nguyễn Văn A", role: "Tác giả Tự do", text: "StoryNest giúp tôi vượt qua writer's block hoàn toàn. Tính năng chấm điểm rất khách quan." },
        { name: "Trần Thị B", role: "Biên tập viên", text: "Từ ngày dùng StoryNest, tôi duyệt bản thảo nhanh gấp 3 lần nhờ AI chỉ ra ngay các điểm mâu thuẫn." },
        { name: "Lê Hoàng C", role: "Nhà văn trẻ", text: "Giao diện viết tuyệt vời. Gợi ý từ RAG rất bám sát cốt truyện cốt lõi của tác phẩm." },
        { name: "Phạm D", role: "Tác giả Webnovel", text: "Tốc độ xử lý của RAG rất đỉnh. Tôi có thể tra cứu tình tiết ở chương 1 ngay khi đang viết chương 100." },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center w-full bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300 relative overflow-hidden">
            {/* Background Decorative Elements with Parallax */}
            <motion.div style={{ y: y1 }} className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></motion.div>
            <motion.div style={{ y: y2 }} className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[150px] pointer-events-none"></motion.div>
            <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none animate-[pulseSlow_9s_ease-in-out_infinite_0.5s]"></div>

            {/* Navbar */}
            <nav className={`fixed top-0 w-full flex justify-center z-50 transition-all duration-300 ${scrolled ? 'bg-[var(--bg-app)]/80 backdrop-blur-md shadow-sm py-4 border-b border-[var(--border-color)]' : 'bg-transparent py-6'}`}>
                <div className="w-full max-w-7xl flex justify-between items-center px-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 group cursor-pointer"
                    >
                        <div className="relative flex items-center justify-center bg-indigo-500/10 p-2 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                            <img src="/logo.png" alt="StoryNest Logo" className="h-8 w-auto relative z-10" />
                        </div>
                        <span className="text-2xl font-black tracking-tight">Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Nest</span></span>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 items-center"
                    >
                        <Link to="/login" className="px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block">
                            Đăng nhập
                        </Link>
                        <Link to="/register" className="group relative px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all shadow-lg hover:shadow-indigo-500/30 hover:scale-105 flex items-center gap-2">
                            <span className="relative z-10">Bắt đầu miễn phí</span>
                        </Link>
                    </motion.div>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-7xl px-6 flex flex-col items-center text-center relative z-10 pt-32 lg:pt-40">
                {/* Hero section */}
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center relative"
                >
                    {/* Floating elements */}
                    <motion.div 
                        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className="hidden lg:flex absolute -left-20 top-10 glass-card p-4 rounded-2xl items-center gap-3 text-sm font-semibold shadow-lg text-[var(--text-secondary)]"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><BookOpen className="w-4 h-4 text-blue-500" /></div>
                        15,000+ từ phân tích
                    </motion.div>

                    <motion.div 
                        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="hidden lg:flex absolute -right-20 top-20 glass-card p-4 rounded-2xl items-center gap-3 text-sm font-semibold shadow-lg text-[var(--text-secondary)]"
                    >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
                        Chấm điểm Rubric 100
                    </motion.div>

                    <motion.div variants={itemVariants} className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass-card text-[var(--text-primary)] font-medium text-sm mb-10 cursor-default">
                        <div className="flex items-center justify-center p-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                            <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <span>Giới thiệu tính năng: <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">Gợi ý viết lách AI</span></span>
                    </motion.div>

                    <motion.h1 variants={itemVariants} className="text-5xl lg:text-[5.5rem] font-extrabold tracking-tight mb-8 max-w-5xl text-[var(--text-primary)] leading-[1.1]">
                        Khơi nguồn sáng tạo <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">Tuyệt Tác Văn Học</span>
                    </motion.h1>

                    <motion.p variants={itemVariants} className="text-lg lg:text-xl text-[var(--text-secondary)] max-w-3xl mb-12 leading-relaxed font-medium">
                        StoryNest cung cấp hệ sinh thái khép kín cho tác giả: Từ chấm điểm bản thảo, phát hiện mâu thuẫn cốt truyện bằng AI, đến gợi ý phát triển ý tưởng dựa trên siêu nhớ RAG.
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-5 mb-32 w-full sm:w-auto">
                        <Link to="/register" className="group flex items-center justify-center gap-3 px-8 py-4 bg-[var(--text-primary)] text-[var(--bg-app)] rounded-full font-bold text-lg transition-all hover:scale-105 shadow-xl sm:w-auto w-full">
                            <span>Viết truyện ngay</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button onClick={() => window.scrollTo({ top: document.getElementById('bento')?.offsetTop, behavior: 'smooth' })} className="flex items-center justify-center gap-2 px-8 py-4 glass-card border-[var(--border-color)] text-[var(--text-primary)] rounded-full font-bold text-lg transition-all hover:scale-105 shadow-sm sm:w-auto w-full">
                            Khám phá tính năng
                        </button>
                    </motion.div>
                </motion.div>

                {/* How it Works */}
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7 }}
                    className="w-full mb-40"
                >
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Hoạt động như thế nào?</h2>
                        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">Quy trình tối ưu hóa trải nghiệm sáng tác.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent -translate-y-1/2 z-0"></div>

                        {[
                            { step: "1", title: "Viết lách tập trung", desc: "Không gian soạn thảo không xao nhãng. Tự động lưu và tổ chức theo chương." },
                            { step: "2", title: "AI Phân tích", desc: "AI đọc tự động, phát hiện các điểm nghẽn, lỗi logic trong cấu trúc truyện." },
                            { step: "3", title: "Hoàn thiện", desc: "Nhận điểm số theo Rubric 14 tiêu chí và xuất bản kiệt tác của bạn." }
                        ].map((item, idx) => (
                            <div key={idx} className="relative z-10 glass-card p-8 rounded-3xl flex flex-col items-center text-center group hover:-translate-y-2 transition-transform">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-[var(--text-secondary)] font-medium">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Bento Grid Features */}
                <motion.div 
                    id="bento"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7 }}
                    className="w-full mb-40"
                >
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Trợ lý đắc lực cho mọi tác giả</h2>
                        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">Tất cả công cụ bạn cần để xây dựng một bộ tiểu thuyết thành công.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
                        {/* Large Card */}
                        <div className="md:col-span-2 glass-card rounded-3xl p-8 flex flex-col justify-between overflow-hidden relative group hover:border-indigo-500/50 transition-colors">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/20 transition-colors"></div>
                            <div className="relative z-10">
                                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 text-indigo-500 group-hover:scale-110 transition-transform">
                                    <BrainCircuit className="w-7 h-7" />
                                </div>
                                <h3 className="text-3xl font-bold mb-3">Chấm điểm đa chiều (AI Scoring)</h3>
                                <p className="text-[var(--text-secondary)] text-lg max-w-md">
                                    LLMs phân tích toàn diện câu chuyện dựa trên Rubric 100 điểm với 14 tiêu chí chuẩn văn học.
                                </p>
                            </div>
                        </div>

                        {/* Standard Card 1 */}
                        <div className="glass-card rounded-3xl p-8 flex flex-col justify-between group hover:border-purple-500/50 transition-colors">
                            <div>
                                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-500 group-hover:scale-110 transition-transform">
                                    <Search className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Truy tìm mâu thuẫn</h3>
                                <p className="text-[var(--text-secondary)]">Tự động phát hiện lỗi logic về thời gian và hành vi nhân vật.</p>
                            </div>
                        </div>

                        {/* Standard Card 2 */}
                        <div className="glass-card rounded-3xl p-8 flex flex-col justify-between group hover:border-emerald-500/50 transition-colors">
                            <div>
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-500 group-hover:scale-110 transition-transform">
                                    <PenTool className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Vượt qua Writer's Block</h3>
                                <p className="text-[var(--text-secondary)]">AI gợi ý hướng đi tiếp theo cực kỳ bám sát thiết lập truyện.</p>
                            </div>
                        </div>

                        {/* Medium Card */}
                        <div className="md:col-span-2 glass-card rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                            <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl -mb-10 -mr-10 group-hover:bg-blue-500/20 transition-colors"></div>
                            <div className="relative z-10 flex flex-col h-full justify-center">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:rotate-12 transition-transform">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-bold">Vector Search Chớp nhoáng</h3>
                                </div>
                                <p className="text-[var(--text-secondary)] text-lg h-full max-w-lg">
                                    Công nghệ Retrieval-Augmented Generation (RAG) tham chiếu ngữ cảnh từ hàng chục ngàn từ trong nháy mắt.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Testimonials (Marquee) */}
                <div className="w-full mb-40 overflow-hidden py-10">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">Được tin dùng bởi các tác giả</h2>
                    </div>
                    
                    <div className="relative w-full flex overflow-hidden">
                        {/* Gradient Masks for smooth hiding at the edges */}
                        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[var(--bg-app)] to-transparent z-10"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[var(--bg-app)] to-transparent z-10"></div>
                        
                        <div className="flex gap-6 animate-marquee whitespace-nowrap min-w-max px-4">
                            {[...testimonials, ...testimonials].map((t, i) => (
                                <div key={i} className="glass-card p-6 rounded-2xl w-[400px] flex flex-col whitespace-normal shrink-0">
                                    <div className="flex items-center gap-2 mb-4">
                                        {[...Array(5)].map((_, idx) => (
                                            <svg key={idx} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        ))}
                                    </div>
                                    <p className="text-[var(--text-primary)] font-medium mb-6 italic">"{t.text}"</p>
                                    <div className="mt-auto flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-[var(--text-primary)]">{t.name}</p>
                                            <p className="text-xs text-[var(--text-secondary)]">{t.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tech Stack CTA */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="w-full max-w-5xl mx-auto glass-card rounded-[3rem] p-12 text-center mb-32 relative overflow-hidden flex flex-col items-center border-indigo-500/20"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-blue-500/5"></div>
                    <h2 className="text-4xl font-extrabold mb-6 relative z-10 w-full text-center">Sẵn sàng để đưa câu chuyện của bạn lên một tầm cao mới?</h2>
                    <p className="text-xl text-[var(--text-secondary)] mb-10 max-w-2xl relative z-10 font-medium">Khởi đầu hoàn toàn miễn phí, không yêu cầu thẻ tín dụng.</p>
                    <Link to="/register" className="relative z-10 px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold text-xl transition-all hover:scale-105 shadow-xl shadow-indigo-500/20 flex items-center gap-2">
                        Bắt đầu viết kỷ nguyên mới
                    </Link>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-[var(--border-color)] py-12 mt-auto bg-[var(--bg-app)] relative z-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="StoryNest Logo" className="h-8 w-auto opacity-80" />
                        <span className="font-bold text-[var(--text-primary)] tracking-tight">StoryNest <span className="text-[var(--text-secondary)] font-medium">© 2026</span></span>
                    </div>
                    <div className="flex gap-8">
                        <a href="#" className="text-[var(--text-secondary)] hover:text-indigo-500 font-medium transition-colors">Giới thiệu</a>
                        <a href="#" className="text-[var(--text-secondary)] hover:text-indigo-500 font-medium transition-colors">Tính năng</a>
                        <a href="#" className="text-[var(--text-secondary)] hover:text-indigo-500 font-medium transition-colors">Bảng giá</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
