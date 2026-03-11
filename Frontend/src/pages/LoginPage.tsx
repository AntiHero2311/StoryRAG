import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, BarChart3 } from 'lucide-react';
import { authService, LoginData } from '../services/authService';

const FEATURES = [
    { icon: <Sparkles className="w-4 h-4 text-amber-400" />, title: 'Sáng tạo vô hạn', desc: 'AI hiểu phong cách của riêng bạn' },
    { icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, title: 'Bảo mật tuyệt đối', desc: 'Mã hóa end-to-end an toàn' },
    { icon: <BarChart3 className="w-4 h-4 text-blue-400" />, title: 'Phân tích sâu', desc: 'Cải thiện cốt truyện với dữ liệu' },
];

function LeftPanel() {
    return (
        <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden bg-[var(--bg-panel)] text-white isolate">
            {/* Ambient orbs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[140px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-purple-600/25 rounded-full blur-[120px]" style={{ animation: 'pulseSlow 10s infinite alternate-reverse' }} />
                <div className="absolute top-[35%] left-[30%] w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[100px] animate-pulse-slow" />
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.045]" style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '28px 28px'
                }} />
            </div>

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/8 backdrop-blur-md border border-white/10 shadow-lg shadow-indigo-500/20">
                    <img src="/logo.png" alt="StoryNest" className="w-6 h-6 object-contain mix-blend-screen" />
                </div>
                <span className="text-lg font-bold tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-200 to-white">StoryNest</span>
            </div>

            {/* Main content */}
            <div className="relative z-10 max-w-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 bg-indigo-500/10 border border-indigo-400/20">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-widest">AI Engine v2.0 Active</span>
                </div>

                <h2 className="text-[2.6rem] font-extrabold leading-[1.1] mb-5 tracking-tight">
                    Hãy để chữ<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
                        tự do tuôn chảy.
                    </span>
                </h2>
                <p className="text-white/45 text-[15px] leading-relaxed mb-10 font-light">
                    Môi trường sáng tác thế hệ mới, nơi AI hòa quyện cùng trí tưởng tượng trong không gian bảo mật tuyệt đối.
                </p>

                <div className="space-y-3">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors duration-200">
                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center shrink-0">
                                {f.icon}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white/90">{f.title}</p>
                                <p className="text-xs text-white/40 mt-0.5">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 flex justify-between items-center border-t border-white/[0.08] pt-5">
                <p className="text-white/25 text-xs">© 2026 StoryNest.</p>
                <div className="flex gap-4">
                    <Link to="/privacy" className="text-xs text-white/25 hover:text-white/60 transition-colors">Privacy</Link>
                    <Link to="/terms" className="text-xs text-white/25 hover:text-white/60 transition-colors">Terms</Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [mounted, setMounted] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
        setTimeout(() => emailRef.current?.focus(), 500);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        try {
            const loginData: LoginData = { email, password };
            const response = await authService.login(loginData);
            localStorage.setItem('token', response.accessToken);
            navigate('/home');
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
        }
    };

    return (
        <div className="h-screen overflow-hidden grid lg:grid-cols-2 bg-[var(--bg-app)] selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100">
            <LeftPanel />

            {/* Right panel */}
            <div className="relative flex items-center justify-center p-6 sm:p-10 h-full overflow-hidden">
                {/* Subtle ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />

                <div className={`relative w-full max-w-[400px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

                    {/* Glass card */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 shadow-xl shadow-black/5 dark:shadow-black/40">

                        {/* Card header */}
                        <div className="flex items-center justify-between mb-8">
                            <Link to="/" className="flex items-center gap-2.5 group">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--input-bg)] border border-[var(--border-color)] group-hover:scale-105 transition-transform duration-200">
                                    <img src="/logo.png" alt="StoryNest" className="w-5 h-5 object-contain" />
                                </div>
                                <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide">StoryNest</span>
                            </Link>
                            <span className="text-[11px] font-semibold text-[var(--text-secondary)] px-2.5 py-1 rounded-full bg-[var(--input-bg)] border border-[var(--border-color)] tracking-wide">
                                Đăng nhập
                            </span>
                        </div>

                        <div className="mb-7">
                            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Mừng trở lại! 👋</h1>
                            <p className="text-sm text-[var(--text-secondary)] mt-1.5">Tiếp tục hành trình sáng tác của bạn.</p>
                        </div>

                        {errorMsg && (
                            <div className="mb-5 px-4 py-3 rounded-xl bg-rose-500/8 border border-rose-500/15 flex items-center gap-3 animate-shake">
                                <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
                                    <span className="text-rose-500 text-[10px] font-bold">!</span>
                                </div>
                                <span className="text-sm text-rose-500 dark:text-rose-400 font-medium">{errorMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="group space-y-1.5">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                                    Địa chỉ Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                    <input
                                        ref={emailRef}
                                        type="email" required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                        placeholder="name@example.com"
                                        className="w-full h-11 bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none transition-all duration-200"
                                    />
                                </div>
                            </div>

                            <div className="group space-y-1.5">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                                        Mật khẩu
                                    </label>
                                    <button type="button" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors hover:underline underline-offset-4">
                                        Quên mật khẩu?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required minLength={6}
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                        placeholder="••••••••"
                                        className="w-full h-11 bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none transition-all duration-200"
                                    />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 mt-1 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Đang xác thực...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Đăng Nhập</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-[var(--border-color)]">
                            <p className="text-xs text-[var(--text-secondary)] text-center mb-3">Chưa có tài khoản?</p>
                            <Link to="/register"
                                className="flex items-center justify-center w-full h-10 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--input-bg)] hover:border-indigo-400/30 transition-all duration-200 group gap-1.5">
                                Tạo tài khoản miễn phí
                                <span className="text-indigo-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
}
