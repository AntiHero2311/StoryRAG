import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
    BrainCircuit,
    Search,
    Zap,
    PenTool,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    Moon,
    Sun,
    BarChart3,
    Shield,
    Users,
    Clock,
    TrendingUp,
    FileText,
    Layers,
    Star,
    Quote,
} from 'lucide-react';
import { applyThemeMode, resolveThemeMode } from '../utils/themeMode';

const LandingPage = () => {
    const [scrolled, setScrolled] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);
    const [isYearly, setIsYearly] = useState(false);
    const { scrollY } = useScroll();
    
    // Parallax effects
    const y1 = useTransform(scrollY, [0, 1000], [0, 300]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -200]);
    const y3 = useTransform(scrollY, [0, 1000], [0, 100]);

    // Data arrays - must be defined before useEffect
    const features = [
        {
            icon: <BrainCircuit className="w-7 h-7" />,
            title: 'AI Phân Tích Thông Minh',
            desc: 'Hệ thống AI phân tích cốt truyện, nhân vật và phát hiện mâu thuẫn tự động',
            color: 'from-blue-500 to-cyan-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            icon: <Search className="w-7 h-7" />,
            title: 'RAG Vector Search',
            desc: 'Tra cứu ngữ cảnh từ hàng chục nghìn từ trong nháy mắt với công nghệ vector embedding',
            color: 'from-purple-500 to-pink-500',
            bgColor: 'bg-purple-500/10',
        },
        {
            icon: <BarChart3 className="w-7 h-7" />,
            title: 'Chấm Điểm Rubric 14',
            desc: 'Đánh giá chất lượng truyện theo 14 tiêu chí chuyên nghiệp với điểm số chi tiết',
            color: 'from-emerald-500 to-teal-500',
            bgColor: 'bg-emerald-500/10',
        },
        {
            icon: <PenTool className="w-7 h-7" />,
            title: 'Gợi Ý Sáng Tạo',
            desc: 'AI đề xuất hướng đi tiếp theo bám sát phong cách và cốt truyện của bạn',
            color: 'from-orange-500 to-red-500',
            bgColor: 'bg-orange-500/10',
        },
    ];

    const testimonials = [
        { name: "Nguyễn Minh A", role: "Tác giả Web Novel", text: "StoryNest giúp tôi vượt qua writer's block hoàn toàn. Gợi ý của AI rất chính xác!", rating: 5 },
        { name: "Trần Thu B", role: "Biên tập viên", text: "Tính năng chấm điểm giúp tôi duyệt bản thảo nhanh gấp 3 lần. Cực kỳ hữu ích!", rating: 5 },
        { name: "Lê Hoàng C", role: "Nhà văn trẻ", text: "Giao diện đẹp, tính năng đầy đủ. RAG search rất nhanh và chính xác.", rating: 5 },
        { name: "Phạm Thảo D", role: "Content Creator", text: "Công cụ tuyệt vời cho người viết chuyên nghiệp. Highly recommended!", rating: 5 },
    ];

    const stats = [
        { icon: <Users className="w-6 h-6" />, value: "10,000+", label: "Tác giả tin dùng" },
        { icon: <FileText className="w-6 h-6" />, value: "50,000+", label: "Truyện đã viết" },
        { icon: <Clock className="w-6 h-6" />, value: "1M+", label: "Giờ tiết kiệm" },
        { icon: <TrendingUp className="w-6 h-6" />, value: "95%", label: "Hài lòng" },
    ];

    const pricingPlans = [
        {
            name: "Miễn phí",
            monthlyPrice: "0đ",
            yearlyPrice: "0đ",
            desc: "Hoàn hảo để bắt đầu",
            features: [
                "1 dự án",
                "Tối đa 10 chương",
                "AI cơ bản",
                "Chấm điểm Rubric",
            ],
            cta: "Bắt đầu miễn phí",
            popular: false,
        },
        {
            name: "Pro",
            monthlyPrice: "99,000đ",
            yearlyPrice: "990,000đ",
            desc: "Cho tác giả chuyên nghiệp",
            features: [
                "Không giới hạn dự án",
                "Không giới hạn chương",
                "AI nâng cao với Genma 4 ",
                "RAG Vector Search",
                "Xuất file Word/PDF",
                "Hỗ trợ ưu tiên",
            ],
            cta: "Nâng cấp ngay",
            popular: true,
        },
        {
            name: "Enterprise",
            monthlyPrice: "Liên hệ",
            yearlyPrice: "Liên hệ",
            desc: "Cho đội nhóm và tổ chức",
            features: [
                "Tất cả tính năng Pro",
                "Quản lý nhóm",
                "API riêng",
                "Custom AI training",
                "SLA 99.9%",
                "Dedicated support",
            ],
            cta: "Liên hệ tư vấn",
            popular: false,
        },
    ];

    useEffect(() => {
        const isDark = resolveThemeMode() === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        setDarkMode(isDark);

        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature((prev) => (prev + 1) % features.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [features.length]);

    const toggleDarkMode = () => {
        const nextMode = darkMode ? 'light' : 'dark';
        applyThemeMode(nextMode);
        setDarkMode(nextMode === 'dark');
    };

    const testimonialColumns = [
        testimonials.filter((_, idx) => idx % 3 === 0),
        testimonials.filter((_, idx) => idx % 3 === 1),
        testimonials.filter((_, idx) => idx % 3 === 2),
    ];

    const handleFeatureMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.setProperty('--spot-x', `${x}px`);
        e.currentTarget.style.setProperty('--spot-y', `${y}px`);
    };

    const getPriceLabel = (plan: typeof pricingPlans[number]) => {
        if (plan.name === 'Enterprise') return { price: 'Liên hệ', period: '' };
        if (plan.name === 'Miễn phí') return { price: '0đ', period: '/tháng' };
        return isYearly
            ? { price: plan.yearlyPrice, period: '/năm' }
            : { price: plan.monthlyPrice, period: '/tháng' };
    };

    return (
        <div className="min-h-screen flex flex-col items-center w-full bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-300 relative overflow-x-hidden">
            {/* Enhanced Background with Parallax */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
                <motion.div
                    style={{ y: y1 }}
                    className="absolute top-[-15%] left-[-10%] w-[700px] h-[700px] bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-[150px]"
                />
                <motion.div
                    style={{ y: y2 }}
                    className="absolute top-[35%] right-[-12%] w-[800px] h-[800px] bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-[180px]"
                />
                <motion.div
                    style={{ y: y3 }}
                    className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/15 dark:bg-blue-500/10 rounded-full blur-[120px] animate-pulse"
                />
            </div>

            {/* Navbar with Glass Effect */}
            <nav className={`fixed top-0 w-full flex justify-center z-50 transition-all duration-300 ${
                scrolled 
                    ? 'bg-[var(--bg-app)]/80 dark:bg-[var(--bg-app)]/90 backdrop-blur-xl shadow-lg py-4 border-b border-[var(--border-color)]' 
                    : 'bg-transparent py-6'
            }`}>
                <div className="w-full max-w-7xl flex justify-between items-center px-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 group cursor-pointer"
                    >
                        <img
                            src="/logo.png"
                            alt="StoryNest Logo"
                            className="w-12 h-12 object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="text-2xl font-black tracking-tight text-white">
                            Story<span className="text-white">Nest</span>
                        </span>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 items-center"
                    >
                        <button
                            onClick={toggleDarkMode}
                            className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)] transition-all hover:scale-105"
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <Link 
                            to="/login" 
                            className="px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:block"
                        >
                            Đăng nhập
                        </Link>
                        <Link 
                            to="/register" 
                            className="group relative px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-full transition-all shadow-lg hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105 flex items-center gap-2 overflow-hidden"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative z-10">Bắt đầu miễn phí</span>
                            <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-7xl px-6 flex flex-col items-center text-center relative z-10 pt-32 lg:pt-40">
                {/* Hero Section with Visual Anchor */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full grid lg:grid-cols-2 gap-12 items-center mb-32"
                >
                    <div className="text-left">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-3 px-5 py-3 rounded-full glass-card text-[var(--text-primary)] font-medium text-sm mb-8 cursor-default group hover:scale-105 transition-transform"
                        >
                            <div className="flex items-center justify-center p-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full group-hover:rotate-180 transition-transform duration-500">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span>
                                <span className="text-[var(--text-secondary)]">Giới thiệu:</span>{' '}
                                <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                                    AI Writer Assistant
                                </span>
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                            className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-6 text-[var(--text-primary)] leading-[1.1]"
                        >
                            Khơi nguồn sáng tạo
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-pink-600 animate-gradient bg-[length:200%_auto]">
                                Tuyệt Tác Văn Học
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="text-base lg:text-lg text-[var(--text-secondary)] mb-10 leading-relaxed font-medium max-w-xl"
                        >
                            Nền tảng viết truyện thông minh với AI, RAG vector search và phân tích cốt truyện tự động.
                            Biến ý tưởng thành kiệt tác văn học chỉ trong vài giờ.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="flex flex-col sm:flex-row gap-5"
                        >
                            <Link
                                to="/register"
                                className="shimmer-cta group flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-full font-bold text-lg transition-all hover:scale-105 shadow-2xl hover:shadow-indigo-500/50 relative overflow-hidden"
                            >
                                <span className="relative z-10">Viết truyện ngay</span>
                                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-2 transition-transform" />
                            </Link>
                            <button
                                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center justify-center gap-2 px-10 py-5 glass-card border-2 border-[var(--border-color)] text-[var(--text-primary)] rounded-full font-bold text-lg transition-all hover:scale-105 hover:border-indigo-500/50 shadow-lg group"
                            >
                                <span>Khám phá tính năng</span>
                                <Layers className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                            </button>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="relative h-[420px] lg:h-[520px] flex items-center justify-center"
                    >
                        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-cyan-400/20 blur-2xl" />
                        <div className="relative w-full h-full rounded-[2.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl overflow-hidden">
                            <div className="absolute inset-0 network-grid opacity-30" />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                                className="absolute top-1/2 left-1/2 w-72 h-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400/40"
                            />
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
                                className="absolute top-1/2 left-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-400/40 border-dashed"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_60px_rgba(99,102,241,0.5)] flex items-center justify-center">
                                    <BrainCircuit className="w-14 h-14 text-white" />
                                </div>
                            </div>

                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-10 left-8 glass-card px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-primary)]"
                            >
                                RAG Context Active
                            </motion.div>
                            <motion.div
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute bottom-12 right-8 glass-card px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-primary)]"
                            >
                                AI Score: 4.6/5
                            </motion.div>
                            <motion.div
                                animate={{ x: [0, 8, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-1/2 right-10 -translate-y-1/2 glass-card px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-primary)]"
                            >
                                768-dim Vector
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Stats Section */}
                {false && (
                    <motion.div 
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.7 }}
                        className="w-full mb-32"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {stats.map((stat, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                                    className="glass-card p-6 rounded-2xl text-center group hover:scale-105 transition-transform"
                                >
                                    <div className="flex justify-center mb-3">
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-500 group-hover:rotate-12 transition-transform">
                                            {stat.icon}
                                        </div>
                                    </div>
                                    <p className="text-3xl font-extrabold text-[var(--text-primary)] mb-1">{stat.value}</p>
                                    <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Features Section with Interactive Cards */}
                <motion.div 
                    id="features"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7 }}
                    className="w-full mb-32"
                >
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-semibold text-indigo-500 mb-6"
                        >
                            <Zap className="w-4 h-4" />
                            Tính năng nổi bật
                        </motion.div>
                        <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 text-[var(--text-primary)]">
                            Công nghệ hiện đại nhất
                        </h2>
                        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
                            Được xây dựng với AI tiên tiến và công nghệ vector search để mang đến trải nghiệm viết lách tốt nhất
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {features.map((feature, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1, duration: 0.6 }}
                                onMouseEnter={() => setActiveFeature(idx)}
                                onMouseMove={handleFeatureMouseMove}
                                className={`spotlight-card glass-card p-8 rounded-3xl group hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden min-h-[260px] ${
                                    activeFeature === idx ? 'border-2 border-indigo-500/50 shadow-xl shadow-indigo-500/20' : 'border border-[var(--border-color)]'
                                }`}
                            >
                                {/* Background gradient */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                                
                                <div className="relative z-10">
                                    <div className={`w-16 h-16 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-6 text-indigo-500 group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)] transition-all">
                                        {feature.title}
                                    </h3>
                                    <p className="text-[var(--text-secondary)] leading-relaxed">
                                        {feature.desc}
                                    </p>
                                </div>

                                {/* Active indicator */}
                                <AnimatePresence>
                                    {activeFeature === idx && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            className="absolute top-4 right-4 w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                        />
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Testimonials with Enhanced Design */}
                {false && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.7 }}
                        className="w-full mb-32"
                    >
                        <div className="text-center mb-16">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-semibold text-amber-500 mb-6"
                            >
                                <Star className="w-4 h-4 fill-current" />
                                Đánh giá từ người dùng
                            </motion.div>
                            <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 text-[var(--text-primary)]">
                                Được tin dùng bởi hàng nghìn tác giả
                            </h2>
                        </div>

                        <div className="relative w-full overflow-hidden py-4 h-[620px]">
                            <div className="absolute left-0 top-0 right-0 h-24 bg-gradient-to-b from-[var(--bg-app)] to-transparent z-10" />
                            <div className="absolute left-0 bottom-0 right-0 h-24 bg-gradient-to-t from-[var(--bg-app)] to-transparent z-10" />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                                {testimonialColumns.map((column, colIdx) => (
                                    <div key={colIdx} className="overflow-hidden relative">
                                        <div className={`flex flex-col gap-6 ${colIdx === 1 ? 'vertical-marquee-down' : 'vertical-marquee-up'}`}>
                                            {[...column, ...column, ...column].map((t, i) => (
                                                <div
                                                    key={`${colIdx}-${i}`}
                                                    className="glass-card p-6 rounded-2xl flex flex-col hover:scale-[1.02] transition-transform group"
                                                >
                                                    <div className="flex items-center gap-1 mb-4">
                                                        {[...Array(t.rating)].map((_, idx) => (
                                                            <Star key={idx} className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                        ))}
                                                    </div>
                                                    <Quote className="w-8 h-8 text-indigo-500/20 mb-3" />
                                                    <p className="text-[var(--text-primary)] font-medium mb-6 italic leading-relaxed flex-1">
                                                        "{t.text}"
                                                    </p>
                                                    <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-color)]">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 group-hover:scale-110 transition-transform">
                                                            {t.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm text-[var(--text-primary)]">{t.name}</p>
                                                            <p className="text-xs text-[var(--text-secondary)]">{t.role}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Pricing Section */}
                <motion.div 
                    id="pricing"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.7 }}
                    className="w-full mb-32"
                >
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-semibold text-emerald-500 mb-6"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Bảng giá linh hoạt
                        </motion.div>
                        <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 text-[var(--text-primary)]">
                            Chọn gói phù hợp với bạn
                        </h2>
                        <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
                            Bắt đầu miễn phí và nâng cấp khi cần. Không ràng buộc, hủy bất cứ lúc nào.
                        </p>
                        <div className="inline-flex mt-8 p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)]">
                            <button
                                onClick={() => setIsYearly(false)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${!isYearly ? 'bg-indigo-600 text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                Hàng tháng
                            </button>
                            <button
                                onClick={() => setIsYearly(true)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${isYearly ? 'bg-indigo-600 text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                Hàng năm
                                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">-17%</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {pricingPlans.map((plan, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1, duration: 0.6 }}
                                className={`glass-card rounded-3xl p-8 flex flex-col relative overflow-hidden group hover:scale-105 transition-all ${
                                    plan.popular 
                                        ? 'border-2 border-indigo-500 shadow-2xl shadow-indigo-500/30 md:scale-105' 
                                        : 'border border-[var(--border-color)]'
                                }`}
                            >
                                {/* Popular badge */}
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-bl-2xl rounded-tr-2xl">
                                        PHỔ BIẾN NHẤT
                                    </div>
                                )}

                                {/* Background gradient */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${
                                    plan.popular ? 'from-indigo-500/10 to-purple-500/10' : 'from-transparent to-transparent'
                                } opacity-0 group-hover:opacity-100 transition-opacity`} />

                                <div className="relative z-10">
                                    {/* Plan name */}
                                    <h3 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">{plan.name}</h3>
                                    <p className="text-sm text-[var(--text-secondary)] mb-6">{plan.desc}</p>

                                    {/* Price */}
                                    <div className="mb-8">
                                        <span className="text-5xl font-extrabold text-[var(--text-primary)]">{getPriceLabel(plan).price}</span>
                                        {getPriceLabel(plan).period && <span className="text-[var(--text-secondary)] text-lg">{getPriceLabel(plan).period}</span>}
                                        {isYearly && plan.name === 'Pro' && (
                                            <p className="text-xs text-emerald-400 mt-2 font-semibold">Tiết kiệm 2 tháng khi thanh toán theo năm</p>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-4 mb-8 flex-1">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                                <span className="text-[var(--text-secondary)]">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA Button */}
                                    <Link
                                        to={plan.name === "Enterprise" ? "/contact" : "/register"}
                                        className={`block w-full py-4 rounded-full font-bold text-center transition-all hover:scale-105 ${
                                            plan.popular
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:shadow-indigo-500/30'
                                                : 'glass-card border-2 border-[var(--border-color)] text-[var(--text-primary)] hover:border-indigo-500/50'
                                        }`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Final CTA Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className="w-full max-w-5xl mx-auto glass-card rounded-[3rem] p-12 lg:p-16 text-center mb-32 relative overflow-hidden border-2 border-indigo-500/30"
                >
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />

                    <div className="relative z-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: "spring", duration: 0.8 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-8 shadow-xl"
                        >
                            <Sparkles className="w-10 h-10 text-white" />
                        </motion.div>

                        <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 text-[var(--text-primary)]">
                            Sẵn sàng viết truyện của bạn?
                        </h2>
                        <p className="text-lg text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto">
                            Tham gia cùng hàng nghìn tác giả đang sử dụng StoryNest để biến ý tưởng thành hiện thực
                        </p>

                        <div className="flex flex-col sm:flex-row gap-5 justify-center">
                            <Link 
                                to="/register" 
                                className="group flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-full font-bold text-lg transition-all hover:scale-105 shadow-2xl hover:shadow-indigo-500/50 relative overflow-hidden"
                            >
                                <span className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="relative z-10">Bắt đầu miễn phí</span>
                                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-2 transition-transform" />
                            </Link>
                            <Link 
                                to="/login" 
                                className="flex items-center justify-center gap-2 px-10 py-5 glass-card border-2 border-[var(--border-color)] text-[var(--text-primary)] rounded-full font-bold text-lg transition-all hover:scale-105 hover:border-indigo-500/50"
                            >
                                Đăng nhập
                            </Link>
                        </div>

                        <p className="mt-8 text-sm text-[var(--text-secondary)]">
                            <Shield className="w-4 h-4 inline mr-1" />
                            Bảo mật tuyệt đối · Không cần thẻ tín dụng
                        </p>
                    </div>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-[var(--border-color)] bg-[var(--bg-surface)]/50 backdrop-blur-sm py-12 relative z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        {/* Brand */}
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <img
                                    src="/logo.png"
                                    alt="StoryNest Logo"
                                    className="w-10 h-10 object-contain"
                                />
                                <span className="text-xl font-black text-white">
                                    Story<span className="text-white">Nest</span>
                                </span>
                            </div>
                            <p className="text-[var(--text-secondary)] mb-4 max-w-md">
                                Nền tảng viết truyện thông minh với công nghệ AI tiên tiến. 
                                Biến ý tưởng thành tuyệt tác văn học.
                            </p>
                            <div className="flex gap-3">
                                {/* Social links would go here */}
                            </div>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="font-bold text-[var(--text-primary)] mb-4">Sản phẩm</h4>
                            <ul className="space-y-2 text-[var(--text-secondary)]">
                                <li><a href="#features" className="hover:text-[var(--text-primary)] transition-colors">Tính năng</a></li>
                                <li><a href="#pricing" className="hover:text-[var(--text-primary)] transition-colors">Bảng giá</a></li>
                                <li><Link to="/login" className="hover:text-[var(--text-primary)] transition-colors">Đăng nhập</Link></li>
                                <li><Link to="/register" className="hover:text-[var(--text-primary)] transition-colors">Đăng ký</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-[var(--text-primary)] mb-4">Hỗ trợ</h4>
                            <ul className="space-y-2 text-[var(--text-secondary)]">
                                <li><a href="/docs" className="hover:text-[var(--text-primary)] transition-colors">Tài liệu</a></li>
                                <li><a href="/help" className="hover:text-[var(--text-primary)] transition-colors">Trợ giúp</a></li>
                                <li><a href="/contact" className="hover:text-[var(--text-primary)] transition-colors">Liên hệ</a></li>
                                <li><a href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Chính sách</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-[var(--border-color)] text-center text-sm text-[var(--text-secondary)]">
                        <p>© 2024 StoryNest. All rights reserved. Made with ❤️ for writers.</p>
                    </div>
                </div>
            </footer>

            <style>{`
                .shimmer-cta::after {
                    content: "";
                    position: absolute;
                    top: -120%;
                    left: -40%;
                    width: 28%;
                    height: 320%;
                    background: linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent);
                    transform: rotate(20deg);
                    animation: shimmerSweep 2.8s linear infinite;
                }

                .network-grid {
                    background-image:
                        radial-gradient(circle at 20% 20%, rgba(129,140,248,0.35) 1.5px, transparent 1.5px),
                        radial-gradient(circle at 80% 30%, rgba(192,132,252,0.35) 1.5px, transparent 1.5px),
                        linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px);
                    background-size: 120px 120px, 160px 160px, 32px 32px, 32px 32px;
                }

                .spotlight-card::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(
                        260px circle at var(--spot-x, 50%) var(--spot-y, 50%),
                        rgba(99, 102, 241, 0.2),
                        transparent 45%
                    );
                    opacity: 0;
                    transition: opacity 0.25s ease;
                    pointer-events: none;
                }

                .spotlight-card:hover::before {
                    opacity: 1;
                }

                .vertical-marquee-up {
                    animation: marqueeUp 28s linear infinite;
                }

                .vertical-marquee-down {
                    animation: marqueeDown 32s linear infinite;
                }

                @keyframes shimmerSweep {
                    0% { transform: translateX(-180%) rotate(20deg); }
                    100% { transform: translateX(520%) rotate(20deg); }
                }

                @keyframes marqueeUp {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }

                @keyframes marqueeDown {
                    0% { transform: translateY(-50%); }
                    100% { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
