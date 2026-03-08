import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, BookOpen } from 'lucide-react';
import { authService, LoginData } from '../services/authService';

const ORBS = [
    { w: 360, h: 360, top: '-100px', left: '-100px', from: '#f59e0b', to: '#d97706', dur: 9 },
    { w: 260, h: 260, top: '58%', left: '52%', from: '#b45309', to: '#92400e', dur: 12 },
    { w: 180, h: 180, top: '38%', left: '8%', from: '#fbbf24', to: '#f59e0b', dur: 8 },
];

const FEATURES = [
    { icon: '✍️', text: 'Hỗ trợ sáng tác thông minh với AI' },
    { icon: '🔒', text: 'Mã hóa end-to-end toàn bộ nội dung' },
    { icon: '📊', text: 'Chấm điểm & phân tích bản thảo tự động' },
];

function LeftPanel() {
    const particles = Array.from({ length: 20 }, (_, i) => ({
        width: `${3 + Math.sin(i * 1.5) * 2}px`,
        height: `${3 + Math.sin(i * 1.5) * 2}px`,
        top: `${(i * 11 + 9) % 88 + 6}%`,
        left: `${(i * 17 + 13) % 80 + 10}%`,
        opacity: 0.1 + (i % 5) * 0.05,
        animation: `ln-float ${5 + (i % 4) * 1.5}s ease-in-out ${(i % 3) * 0.8}s infinite alternate`,
    }));

    return (
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0f0a00 0%, #1f1100 45%, #2d1800 100%)' }}>

            {ORBS.map((o, i) => (
                <div key={i} className="absolute rounded-full opacity-20 blur-3xl"
                    style={{
                        width: o.w, height: o.h, top: o.top, left: o.left,
                        background: `radial-gradient(circle, ${o.from}, ${o.to})`,
                        animation: `ln-pulse ${o.dur}s ease-in-out infinite alternate`,
                    }} />
            ))}

            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{ ...p, background: 'rgba(251,191,36,0.4)' }} />
            ))}

            <div className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage: `linear-gradient(rgba(251,191,36,0.8) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(251,191,36,0.8) 1px, transparent 1px)`,
                    backgroundSize: '48px 48px'
                }} />

            <div className="relative z-10 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="text-amber-100/70 text-sm font-semibold tracking-widest uppercase">StoryNest</span>
            </div>

            <div className="relative z-10 space-y-8">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-medium"
                        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        AI đang hoạt động
                    </div>
                    <h2 className="text-4xl font-bold text-white leading-tight mb-3">
                        Viết cốt truyện.
                        <br />
                        <span className="text-transparent bg-clip-text"
                            style={{ backgroundImage: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fb923c)' }}>
                            Được AI hiểu bạn.
                        </span>
                    </h2>
                    <p className="text-amber-100/50 text-sm leading-relaxed max-w-xs">
                        Nền tảng sáng tác thông minh — mã hóa toàn vẹn và AI cá nhân hóa theo từng tác giả.
                    </p>
                </div>

                <div className="space-y-3">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
                                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                {f.icon}
                            </div>
                            <span className="text-sm text-amber-100/70">{f.text}</span>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl p-4"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-amber-100/60 text-xs italic leading-relaxed">
                        &ldquo;Mỗi câu chuyện đều xứng đáng được kể. AI chỉ là người bạn đồng hành.&rdquo;
                    </p>
                    <p className="text-amber-400/60 text-xs mt-2 font-medium">— StoryNest</p>
                </div>
            </div>

            <div className="relative z-10">
                <p className="text-amber-100/20 text-xs">© 2026 StoryNest. All rights reserved.</p>
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
        emailRef.current?.focus();
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
        <>
            <style>{`
                @keyframes ln-float {
                    from { transform: translateY(0px); }
                    to   { transform: translateY(-14px); }
                }
                @keyframes ln-pulse {
                    from { transform: scale(1) translate(0,0); opacity: 0.18; }
                    to   { transform: scale(1.18) translate(12px,-12px); opacity: 0.32; }
                }
                @keyframes ln-slide-in {
                    from { opacity: 0; transform: translateX(28px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes ln-shake {
                    0%,100% { transform: translateX(0); }
                    20%,60% { transform: translateX(-6px); }
                    40%,80% { transform: translateX(6px); }
                }
                .ln-slide-in { animation: ln-slide-in 0.5s cubic-bezier(.22,.68,0,1.2) both; }
                .ln-shake    { animation: ln-shake 0.4s ease both; }
            `}</style>

            <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]">
                <LeftPanel />

                <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[var(--bg-app)]">
                    <div className="absolute top-1/3 right-0 w-72 h-72 rounded-full pointer-events-none blur-3xl"
                        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.07), transparent)' }} />
                    <div className="absolute bottom-1/4 left-0 w-64 h-64 rounded-full pointer-events-none blur-3xl"
                        style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.05), transparent)' }} />

                    <div className={`w-full max-w-sm ${mounted ? 'ln-slide-in' : 'opacity-0'}`}>
                        <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                <BookOpen className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-[var(--text-primary)] font-semibold tracking-wide">StoryNest</span>
                        </Link>

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1.5">Đăng nhập</h1>
                            <p className="text-[var(--text-secondary)] text-sm">Chào mừng trở lại, nhà văn ✨</p>
                        </div>

                        {errorMsg && (
                            <div className="mb-6 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2.5 ln-shake">
                                <span className="text-base shrink-0">⚠</span>
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                    <input
                                        ref={emailRef}
                                        type="email" required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                        placeholder="name@example.com"
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-amber-500/30 focus:border-amber-500/60 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 transition-all duration-200"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Mật khẩu</label>
                                    <button type="button"
                                        className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                                        Quên mật khẩu?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required minLength={6}
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                        placeholder="••••••••"
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-amber-500/30 focus:border-amber-500/60 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 transition-all duration-200"
                                    />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50 hover:opacity-80 transition-opacity">
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full py-3.5 mt-2 rounded-xl font-semibold text-sm text-white overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            >
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} />
                                <span className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                                    style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }} />
                                <span className="relative flex items-center justify-center gap-2">
                                    {loading
                                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <><span>Đăng nhập</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                    }
                                </span>
                            </button>
                        </form>

                        <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
                            Chưa có tài khoản?{' '}
                            <Link to="/register" className="text-amber-500 hover:text-amber-400 font-semibold transition-colors">
                                Đăng ký miễn phí →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}