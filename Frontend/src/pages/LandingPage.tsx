import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    ChevronRight,
    Database,
    FileText,
    Layers3,
    Moon,
    Search,
    Sparkles,
    Sun,
    Upload,
    Zap,
} from 'lucide-react';
import { applyThemeMode, resolveThemeMode } from '../utils/themeMode';

const features = [
    {
        icon: Search,
        title: 'Chat RAG theo ngữ cảnh',
        desc: 'Hỏi đáp dựa trên chunk đã embed từ chương, Story Bible và ghi chú lore — tránh câu trả lời chung chung.',
    },
    {
        icon: BarChart3,
        title: 'Rubric 20 tiêu chí',
        desc: 'Chấm theo thang 100 điểm với plot, pacing, nhân vật, cảm xúc và các cảnh báo đặc biệt.',
    },
    {
        icon: Upload,
        title: 'Soạn & nhúng vector',
        desc: 'Soạn trong workspace hoặc đưa chương từ file/dán nội dung, tách chunk và embed để RAG bám sát bản thảo của bạn.',
    },
    {
        icon: Layers3,
        title: 'Story Bible có vector',
        desc: 'Gom nhân vật, thế giới, plot notes, theme và timeline vào một chỗ để RAG và báo cáo nhất quán.',
    },
];

const workflow = [
    'Soạn trong workspace hoặc import chương (.docx/.txt / dán nội dung)',
    'Tạo phiên bản, chunk và embed',
    'Chat RAG hoặc gửi job phân tích (rubric)',
    'Xem báo cáo, biểu đồ và phản hồi từ Staff',
];

const plans = [
    {
        name: 'Free',
        price: '0đ',
        desc: 'Dành cho tác giả mới thử ý tưởng.',
        perks: ['3 lượt phân tích/tháng', '20,000 token AI', 'Workspace cá nhân'],
    },
    {
        name: 'Basic',
        price: '99,000đ',
        desc: 'Gói cân bằng khi bạn xử lý nhiều chương và chat RAG thường xuyên.',
        perks: ['20 lượt phân tích/tháng', '150,000 token AI', 'Thanh toán VNPay'],
        highlighted: true,
    },
    {
        name: 'Pro',
        price: '249,000đ',
        desc: 'Dành cho dự án dài kỳ cần nhiều phân tích và token AI.',
        perks: ['100 lượt phân tích/tháng', '500,000 token AI', 'Xuất báo cáo PDF'],
    },
];

export default function LandingPage() {
    const [darkMode, setDarkMode] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const isDark = resolveThemeMode() === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        setDarkMode(isDark);

        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const toggleTheme = () => {
        const nextMode = darkMode ? 'light' : 'dark';
        applyThemeMode(nextMode);
        setDarkMode(nextMode === 'dark');
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#050510] text-white antialiased selection:bg-indigo-500/35 selection:text-white">
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-25%,rgba(99,102,241,0.22),transparent_55%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_40%,rgba(217,70,239,0.08),transparent_45%)]" />
                <div className="absolute -top-48 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-indigo-500/[0.16] blur-[160px]" />
                <div className="absolute top-1/3 -left-36 h-[420px] w-[420px] rounded-full bg-fuchsia-500/[0.11] blur-[140px]" />
                <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-cyan-500/[0.07] blur-[150px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_top,black_50%,transparent_85%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050510]/90" />
            </div>

            <header className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter,box-shadow] duration-300 ${scrolled ? 'border-b border-white/[0.07] bg-[#050510]/78 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)]' : 'bg-transparent'}`}>
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
                    <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
                        <img src="/logo.png" alt="StoryNest" className="h-10 w-10 rounded-xl object-contain shadow-[0_4px_20px_-6px_rgba(99,102,241,0.45)] ring-1 ring-white/10" />
                        <span className="bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-xl font-black tracking-tight text-transparent">StoryNest</span>
                    </Link>

                    <div className="hidden items-center gap-1 text-sm font-semibold text-zinc-400 md:flex">
                        <a href="#features" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Tính năng</a>
                        <a href="#workflow" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Luồng xử lý</a>
                        <a href="#pricing" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Gói dịch vụ</a>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="rounded-full border border-white/[0.09] bg-white/[0.04] p-2.5 text-zinc-300 shadow-inner shadow-black/30 transition hover:border-white/15 hover:bg-white/10 hover:text-white"
                            aria-label="Đổi giao diện sáng/tối"
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>
                        <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-bold text-zinc-400 transition hover:bg-white/5 hover:text-white sm:inline-flex">
                            Đăng nhập
                        </Link>
                        <Link to="/register" className="rounded-full bg-gradient-to-r from-white via-zinc-50 to-zinc-100 px-5 py-2.5 text-sm font-black text-[#070711] shadow-[0_4px_24px_-6px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(255,255,255,0.4)] active:translate-y-0">
                            Bắt đầu
                        </Link>
                    </div>
                </nav>
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-5 pb-20 pt-32 lg:grid-cols-2 lg:pt-24">
                    <div>
                        {/* <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-gradient-to-r from-indigo-500/15 via-fuchsia-500/10 to-cyan-500/10 px-4 py-2 text-sm font-bold text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                            <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]" />
                            RAG workspace cho truyện dài
                        </div> */}

                        <h1 className="max-w-4xl text-balance text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.35rem] lg:leading-[1.03]">
                            <span className="bg-gradient-to-br from-white via-[#e8e8ff] to-[#a5b4fc] bg-clip-text text-transparent">
                                Hiểu bản thảo của bạn bằng
                            </span>{' '}
                            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                                RAG và rubric chuyên sâu.
                            </span>
                        </h1>

                        <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-zinc-400">
                            StoryNest gộp soạn thảo chương, Story Bible, nhúng vector, chat ngữ nghĩa và báo cáo 20 tiêu chí trong một workspace — có phân tích & RAG, không có AI viết thay bạn.
                        </p>

                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link to="/register" className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-7 py-4 text-base font-black text-white shadow-[0_12px_48px_-12px_rgba(99,102,241,0.65)] transition hover:-translate-y-1 hover:brightness-[1.06] hover:shadow-[0_16px_56px_-12px_rgba(167,139,250,0.55)] active:translate-y-0">
                                Tạo workspace miễn phí
                                <ArrowRight className="relative h-5 w-5 transition group-hover:translate-x-1" />
                            </Link>
                            <a href="#features" className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/[0.11] bg-white/[0.06] px-7 py-4 text-base font-black text-white shadow-inner shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.09]">
                                Xem hệ thống
                                <ChevronRight className="h-5 w-5 opacity-80" />
                            </a>
                        </div>

                        <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                            {[
                                ['20', 'tiêu chí rubric'],
                                ['768', 'chiều embedding'],
                                ['3', 'vai trò vận hành'],
                            ].map(([value, label]) => (
                                <div key={label} className="group rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.5)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-[0_12px_40px_-14px_rgba(99,102,241,0.28)]">
                                    <div className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-2xl font-black text-transparent">{value}</div>
                                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition group-hover:text-zinc-400">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative lg:translate-y-2">
                        <div className="absolute inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-500/35 via-violet-600/25 to-cyan-400/25 blur-3xl" />
                        <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-gradient-to-b from-[#14142a]/95 to-[#0b0b18]/95 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.06] backdrop-blur-2xl">
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                            <div className="flex items-center justify-between border-b border-white/[0.07] bg-black/20 px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                                </div>
                                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                                    Embeddings OK
                                </div>
                            </div>

                            <div className="grid gap-4 p-5 lg:grid-cols-[0.84fr_1.16fr]">
                                <aside className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                                    {['Chương 04 - Vết nứt', 'Nhân vật: An Vũ', 'World: Thành Phù Vân', 'Theme: Hy sinh'].map((item, idx) => (
                                        <div key={item} className={`rounded-2xl px-4 py-3 text-sm font-bold ${idx === 0 ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-300'}`}>
                                            {item}
                                        </div>
                                    ))}
                                </aside>

                                <section className="space-y-4">
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-200">
                                                <BrainCircuit className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black">Rubric report</p>
                                                <p className="text-xs text-zinc-400">Plot, pacing, emotion, consistency</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                ['Cốt truyện', '86%'],
                                                ['Nhịp độ', '74%'],
                                                ['Nhân vật', '91%'],
                                            ].map(([label, value]) => (
                                                <div key={label}>
                                                    <div className="mb-1 flex justify-between text-xs font-bold text-zinc-300">
                                                        <span>{label}</span>
                                                        <span>{value}</span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" style={{ width: value }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <MetricCard icon={Database} label="Vector chunks" value="248" />
                                        <MetricCard icon={FileText} label="Reports" value="12" />
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="mx-auto max-w-7xl px-5 py-24">
                    <SectionHeading eyebrow="Sản phẩm" title="Soạn thảo trong workspace, phân tích bằng RAG và rubric." />
                    <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div key={feature.title} className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_16px_48px_-28px_rgba(0,0,0,0.55)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-indigo-500/25 hover:shadow-[0_24px_56px_-24px_rgba(99,102,241,0.22)]">
                                    <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl transition group-hover:bg-indigo-500/25" />
                                    <div className="relative mb-5 inline-flex rounded-2xl bg-gradient-to-br from-indigo-500/35 to-fuchsia-600/25 p-3.5 text-white shadow-inner shadow-black/20 ring-1 ring-white/10 transition duration-300 group-hover:scale-[1.06] group-hover:shadow-[0_8px_28px_-10px_rgba(99,102,241,0.45)]">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="relative text-lg font-black tracking-tight text-white">{feature.title}</h3>
                                    <p className="relative mt-3 text-sm leading-6 text-zinc-400">{feature.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section id="workflow" className="mx-auto max-w-7xl px-5 py-24">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <SectionHeading align="left" eyebrow="Luồng xử lý" title="Từ bản thảo thô đến báo cáo có dẫn chứng." />
                            <p className="mt-5 text-zinc-400">
                                Luồng gọn trong một workspace: soạn hoặc import nội dung, nhúng vector, hỏi RAG hoặc chạy phân tích, rồi đọc báo cáo và phản hồi vận hành.
                            </p>
                        </div>
                        <div className="space-y-4">
                            {workflow.map((step, index) => (
                                <div key={step} className="flex items-center gap-4 rounded-3xl border border-white/[0.08] bg-gradient-to-r from-white/[0.05] to-transparent p-5 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.5)] backdrop-blur-sm transition hover:border-white/[0.12]">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-fuchsia-600 text-sm font-black text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.65)]">
                                        {index + 1}
                                    </div>
                                    <p className="font-bold text-zinc-100">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="pricing" className="mx-auto max-w-7xl px-5 py-24">
                    <SectionHeading eyebrow="Gói dịch vụ" title="Token và lượt phân tích theo nhu cầu chat & rubric." />
                    <div className="mt-12 grid gap-5 lg:grid-cols-3">
                        {plans.map((plan) => (
                            <div key={plan.name} className={`rounded-3xl border p-7 transition hover:-translate-y-0.5 ${plan.highlighted ? 'border-indigo-400/60 bg-gradient-to-b from-indigo-500/25 to-violet-950/40 shadow-[0_24px_60px_-20px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/30' : 'border-white/[0.09] bg-white/[0.035] hover:border-white/15'}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-2xl font-black">{plan.name}</h3>
                                        <p className="mt-2 text-sm text-zinc-400">{plan.desc}</p>
                                    </div>
                                    {plan.highlighted && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#070711]">Phổ biến</span>}
                                </div>
                                <div className="mt-8 text-4xl font-black">{plan.price}<span className="text-base font-bold text-zinc-400">/tháng</span></div>
                                <ul className="mt-8 space-y-3">
                                    {plan.perks.map((perk) => (
                                        <li key={perk} className="flex items-center gap-3 text-sm font-semibold text-zinc-300">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                                            {perk}
                                        </li>
                                    ))}
                                </ul>
                                <Link to="/register" className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 font-black transition hover:-translate-y-0.5 ${plan.highlighted ? 'bg-gradient-to-r from-white to-zinc-100 text-[#070711] shadow-[0_10px_36px_-12px_rgba(255,255,255,0.35)]' : 'border border-white/[0.11] bg-white/[0.06] text-white hover:border-white/20 hover:bg-white/[0.1]'}`}>
                                    Chọn gói
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-5 py-24">
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.12] bg-gradient-to-br from-indigo-600/[0.28] via-violet-900/30 to-fuchsia-900/25 p-8 text-center shadow-[0_28px_90px_-36px_rgba(79,70,229,0.5)] backdrop-blur-xl md:p-14">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
                        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-white to-zinc-200 text-[#070711] shadow-[0_12px_40px_-12px_rgba(255,255,255,0.35)] ring-2 ring-white/25">
                            <Search className="h-8 w-8" />
                        </div>
                        <h2 className="relative text-balance text-3xl font-black tracking-tight md:text-5xl">
                            <span className="bg-gradient-to-br from-white via-indigo-100 to-fuchsia-200 bg-clip-text text-transparent">Mở workspace và đặt câu hỏi đúng ngữ cảnh.</span>
                        </h2>
                        <p className="relative mx-auto mt-5 max-w-2xl text-pretty text-zinc-200/95">
                            Tạo project, soạn hoặc import chương, dựng Story Bible và chạy phân tích rubric — AI đọc đúng những gì bạn đã đưa vào workspace.
                        </p>
                        <Link to="/register" className="relative mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-white via-zinc-50 to-zinc-100 px-7 py-4 font-black text-[#070711] shadow-[0_12px_40px_-14px_rgba(255,255,255,0.35)] transition hover:-translate-y-1 hover:shadow-[0_16px_48px_-14px_rgba(255,255,255,0.45)]">
                            Dùng thử miễn phí
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="relative z-10 border-t border-white/[0.07] bg-[#050510]/80 px-5 py-8 text-sm text-zinc-500 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
                    <p>© 2026 StoryNest. Workspace RAG & rubric cho fiction dài.</p>
                    <div className="flex gap-5">
                        <Link to="/privacy" className="hover:text-white">Chính sách</Link>
                        <Link to="/login" className="hover:text-white">Đăng nhập</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
    return (
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-4 shadow-inner shadow-black/20 transition hover:border-fuchsia-500/25">
            <Icon className="mb-4 h-5 w-5 text-fuchsia-300 drop-shadow-[0_0_12px_rgba(232,121,249,0.35)]" />
            <div className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-2xl font-black text-transparent">{value}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</div>
        </div>
    );
}

function SectionHeading({ eyebrow, title, align = 'center' }: { eyebrow: string; title: string; align?: 'center' | 'left' }) {
    return (
        <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-gradient-to-r from-indigo-500/12 to-fuchsia-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-200 shadow-inner shadow-black/30">
                <Zap className="h-3.5 w-3.5 text-fuchsia-300/90" />
                {eyebrow}
            </div>
            <h2 className="text-balance text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
        </div>
    );
}
