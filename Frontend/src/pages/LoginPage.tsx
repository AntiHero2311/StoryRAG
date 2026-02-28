import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authService, LoginData } from '../services/authService';

// Floating orb data
const ORBS = [
    { w: 320, h: 320, top: '-80px', left: '-80px', from: '#6366f1', to: '#8b5cf6', dur: 8 },
    { w: 240, h: 240, top: '60%', left: '55%', from: '#ec4899', to: '#f43f5e', dur: 11 },
    { w: 180, h: 180, top: '40%', left: '10%', from: '#06b6d4', to: '#3b82f6', dur: 9 },
];

// Floating particle
function Particle({ style }: { style: React.CSSProperties }) {
    return <div className="absolute rounded-full bg-white/20" style={style} />;
}

// Animated background panel (left side)
function LeftPanel() {
    const particles = Array.from({ length: 18 }, (_, i) => ({
        width: `${4 + Math.sin(i * 1.7) * 3}px`,
        height: `${4 + Math.sin(i * 1.7) * 3}px`,
        top: `${(i * 13 + 7) % 90 + 5}%`,
        left: `${(i * 17 + 11) % 80 + 10}%`,
        opacity: 0.15 + (i % 5) * 0.07,
        animation: `float-y ${5 + (i % 4) * 1.5}s ease-in-out ${(i % 3) * 0.8}s infinite alternate`,
    }));

    return (
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)' }}>

            {/* Animated blobs */}
            {ORBS.map((o, i) => (
                <div key={i} className="absolute rounded-full opacity-30 blur-3xl"
                    style={{
                        width: o.w, height: o.h, top: o.top, left: o.left,
                        background: `linear-gradient(135deg, ${o.from}, ${o.to})`,
                        animation: `pulse-slow ${o.dur}s ease-in-out infinite alternate`,
                    }} />
            ))}

            {/* Particles */}
            {particles.map((p, i) => <Particle key={i} style={p} />)}

            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }} />

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <img src="/logo.png" alt="StoryNest" className="h-8 w-auto drop-shadow-lg" />
                    <span className="text-white/60 text-sm font-medium tracking-widest uppercase">StoryNest</span>
                </div>
            </div>

            <div className="relative z-10 space-y-6">
                <div>
                    <h2 className="text-4xl font-bold text-white leading-tight mb-3">
                        Viết cốt truyện.<br />
                        <span className="text-transparent bg-clip-text"
                            style={{ backgroundImage: 'linear-gradient(90deg, #a78bfa, #f9a8d4)' }}>
                            Được AI hiểu bạn.
                        </span>
                    </h2>
                    <p className="text-purple-200/70 text-sm leading-relaxed max-w-xs">
                        Nền tảng sáng tác thông minh, mã hóa toàn vẹn và cá nhân hóa theo từng tác giả.
                    </p>
                </div>

                {/* Feature pills */}
                <div className="flex flex-col gap-2">
                    {['🔒 Mã hóa end-to-end', '🤖 AI đánh giá cá nhân hóa', '✍️ Hỗ trợ sáng tác thông minh'].map(f => (
                        <div key={f} className="flex items-center gap-2 text-sm text-purple-100/80">
                            <div className="w-4 h-0.5 bg-purple-400/60 rounded" />
                            {f}
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative z-10">
                <p className="text-white/30 text-xs">© 2026 StoryNest. All rights reserved.</p>
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
    const [forgotHint, setForgotHint] = useState(false);
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
                @keyframes float-y {
                    from { transform: translateY(0px); }
                    to   { transform: translateY(-14px); }
                }
                @keyframes pulse-slow {
                    from { transform: scale(1) translate(0,0); opacity: 0.25; }
                    to   { transform: scale(1.15) translate(10px,-10px); opacity: 0.4; }
                }
                @keyframes slide-in {
                    from { opacity: 0; transform: translateX(24px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes shake {
                    0%,100% { transform: translateX(0); }
                    20%,60% { transform: translateX(-6px); }
                    40%,80% { transform: translateX(6px); }
                }
                .slide-in { animation: slide-in 0.5s cubic-bezier(.22,.68,0,1.2) both; }
                .shake    { animation: shake 0.4s ease both; }
            `}</style>

            <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]">
                <LeftPanel />

                {/* Right: Form */}
                <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[var(--bg-app)]">
                    {/* Subtle bg glow */}
                    <div className="absolute top-1/3 right-0 w-64 h-64 bg-indigo-600/8 blur-3xl rounded-full pointer-events-none" />
                    <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-purple-600/6 blur-3xl rounded-full pointer-events-none" />

                    <div className={`w-full max-w-sm ${mounted ? 'slide-in' : 'opacity-0'}`}>
                        {/* Mobile logo */}
                        <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
                            <img src="/logo.png" alt="StoryNest" className="h-7 w-auto" />
                            <span className="text-[var(--text-primary)] font-semibold tracking-wide">StoryNest</span>
                        </Link>

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1.5">Đăng nhập</h1>
                            <p className="text-[var(--text-secondary)] text-sm">Chào mừng trở lại, nhà văn ✨</p>
                        </div>

                        {/* Error */}
                        {errorMsg && (
                            <div className={`mb-6 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2.5 ${errorMsg ? 'shake' : ''}`}>
                                <span className="text-rose-400 text-base">⚠</span>
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        ref={emailRef}
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                        placeholder="name@example.com"
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[var(--text-primary)]/20 focus:border-indigo-500/60 focus:bg-indigo-950/20 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Mật khẩu</label>
                                    <button type="button" onClick={() => setForgotHint(true)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                        Quên mật khẩu?
                                    </button>
                                    {forgotHint && (
                                        <span className="text-xs text-amber-400 ml-1">Tính năng đang phát triển</span>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required minLength={6}
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                        placeholder="••••••••"
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[var(--text-primary)]/20 focus:border-indigo-500/60 focus:bg-indigo-950/20 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                                    />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full py-3.5 mt-2 rounded-xl font-semibold text-sm text-white overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                            >
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ background: 'linear-gradient(135deg, #4338ca, #6d28d9)' }} />
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl"
                                    style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)' }} />
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
                            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                Đăng ký miễn phí →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
