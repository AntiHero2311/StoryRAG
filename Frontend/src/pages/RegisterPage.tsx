import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authService, RegisterData } from '../services/authService';

// Password strength
function getStrength(pw: string): { score: number; label: string; color: string } {
    if (pw.length === 0) return { score: 0, label: '', color: '' };
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (s <= 1) return { score: s, label: 'Yếu', color: '#f43f5e' };
    if (s <= 2) return { score: s, label: 'Trung bình', color: '#f59e0b' };
    if (s <= 3) return { score: s, label: 'Khá', color: '#3b82f6' };
    return { score: s, label: 'Mạnh', color: '#22c55e' };
}

// Orbs reused
const ORBS = [
    { w: 280, h: 280, top: '-60px', left: '-60px', from: '#7c3aed', to: '#4f46e5', dur: 9 },
    { w: 200, h: 200, top: '65%', left: '60%', from: '#db2777', to: '#f43f5e', dur: 12 },
    { w: 160, h: 160, top: '35%', left: '5%', from: '#0891b2', to: '#6366f1', dur: 7 },
];

function LeftPanel() {
    const testimonials = [
        { text: 'Tôi viết được hơn 30 chương nhờ AI đề xuất hướng đi cho cốt truyện.', name: 'Minh Trí', role: 'Tác giả' },
        { text: 'Bảo mật tốt và giao diện rất thân thiện, dễ dùng.', name: 'Thu Hà', role: 'Biên kịch' },
    ];
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % testimonials.length), 4000);
        return () => clearInterval(t);
    }, []);

    const particles = Array.from({ length: 16 }, (_, i) => ({
        width: `${3 + (i % 4)}px`,
        height: `${3 + (i % 4)}px`,
        top: `${(i * 15 + 8) % 88 + 6}%`,
        left: `${(i * 19 + 13) % 78 + 11}%`,
        opacity: 0.12 + (i % 5) * 0.06,
        animation: `float-y2 ${5 + (i % 4) * 1.5}s ease-in-out ${(i % 3) * 0.9}s infinite alternate`,
    }));

    return (
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>

            {ORBS.map((o, i) => (
                <div key={i} className="absolute rounded-full opacity-30 blur-3xl"
                    style={{
                        width: o.w, height: o.h, top: o.top, left: o.left,
                        background: `linear-gradient(135deg, ${o.from}, ${o.to})`,
                        animation: `pulse-slow2 ${o.dur}s ease-in-out infinite alternate`,
                    }} />
            ))}

            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full bg-white/20" style={p} />
            ))}

            {/* Dot grid */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                }} />

            {/* Top */}
            <div className="relative z-10 flex items-center gap-2">
                <img src="/logo.png" alt="StoryNest" className="h-8 w-auto drop-shadow-lg" />
                <span className="text-white/60 text-sm font-medium tracking-widest uppercase">StoryNest</span>
            </div>

            {/* Center */}
            <div className="relative z-10 space-y-8">
                <div>
                    <h2 className="text-4xl font-bold text-white leading-tight mb-3">
                        Bắt đầu<br />
                        <span className="text-transparent bg-clip-text"
                            style={{ backgroundImage: 'linear-gradient(90deg, #c084fc, #67e8f9)' }}>
                            hành trình của bạn.
                        </span>
                    </h2>
                    <p className="text-violet-200/60 text-sm leading-relaxed max-w-xs">
                        Tài khoản miễn phí, mã hóa riêng tư, AI cá nhân hóa ngay từ ngày đầu tiên.
                    </p>
                </div>

                {/* Testimonial carousel */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all duration-500">
                    <p className="text-white/70 text-sm leading-relaxed mb-4 italic">
                        &ldquo;{testimonials[idx].text}&rdquo;
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                            {testimonials[idx].name[0]}
                        </div>
                        <div>
                            <p className="text-white/80 text-xs font-semibold">{testimonials[idx].name}</p>
                            <p className="text-white/40 text-xs">{testimonials[idx].role}</p>
                        </div>
                        {/* Dots */}
                        <div className="ml-auto flex gap-1">
                            {testimonials.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'bg-violet-400 w-3' : 'bg-white/20'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <p className="text-white/30 text-xs">© 2026 StoryNest. All rights reserved.</p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const strength = getStrength(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) { setErrorMsg('Vui lòng đồng ý với Chính sách bảo mật.'); return; }
        if (password !== confirmPassword) { setErrorMsg('Mật khẩu xác nhận không khớp.'); return; }
        setLoading(true);
        setErrorMsg('');
        try {
            const data: RegisterData = { fullName, email, password };
            await authService.register(data);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 1800);
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.');
        }
    };

    return (
        <>
            <style>{`
                @keyframes float-y2 {
                    from { transform: translateY(0); }
                    to   { transform: translateY(-12px); }
                }
                @keyframes pulse-slow2 {
                    from { transform: scale(1); opacity: 0.25; }
                    to   { transform: scale(1.12) translate(8px,-8px); opacity: 0.38; }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes check-pop {
                    0%   { transform: scale(0); opacity: 0; }
                    70%  { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes shake2 {
                    0%,100% { transform: translateX(0); }
                    20%,60% { transform: translateX(-5px); }
                    40%,80% { transform: translateX(5px); }
                }
                .slide-up   { animation: slide-up 0.55s cubic-bezier(.22,.68,0,1.2) both; }
                .check-pop  { animation: check-pop 0.4s cubic-bezier(.22,.68,0,1.4) both; }
                .shake2     { animation: shake2 0.4s ease both; }
            `}</style>

            <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]">
                <LeftPanel />

                {/* Right: Form */}
                <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[var(--bg-app)]">
                    <div className="absolute top-1/4 right-0 w-72 h-72 bg-violet-600/7 blur-3xl rounded-full pointer-events-none" />
                    <div className="absolute bottom-1/3 left-0 w-60 h-60 bg-cyan-600/5 blur-3xl rounded-full pointer-events-none" />

                    <div className={`w-full max-w-sm ${mounted ? 'slide-up' : 'opacity-0'}`}>
                        {/* Mobile logo */}
                        <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
                            <img src="/logo.png" alt="StoryNest" className="h-7 w-auto" />
                            <span className="text-[var(--text-primary)] font-semibold tracking-wide">StoryNest</span>
                        </Link>

                        {/* Success state */}
                        {success ? (
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center check-pop">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Đăng ký thành công!</h2>
                                <p className="text-[var(--text-secondary)] text-sm">Đang chuyển đến trang đăng nhập...</p>
                                <div className="w-32 h-1 rounded-full overflow-hidden bg-white/10 mt-2">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ animation: 'slide-up 1.8s linear forwards', width: '100%' }} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-7">
                                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1.5">Tạo tài khoản</h1>
                                    <p className="text-[var(--text-secondary)] text-sm">Miễn phí mãi mãi. Không cần thẻ tín dụng 🎉</p>
                                </div>

                                {errorMsg && (
                                    <div className={`mb-5 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2.5 ${errorMsg ? 'shake2' : ''}`}>
                                        <span className="text-rose-400">⚠</span>
                                        {errorMsg}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Full Name */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Họ và tên</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text" required
                                                value={fullName}
                                                onChange={e => { setFullName(e.target.value); setErrorMsg(''); }}
                                                placeholder="Nguyễn Văn A"
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[var(--text-primary)]/20 focus:border-violet-500/60 focus:bg-violet-950/20 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all duration-200"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                            <input
                                                type="email" required
                                                value={email}
                                                onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                                placeholder="name@example.com"
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[var(--text-primary)]/20 focus:border-violet-500/60 focus:bg-violet-950/20 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all duration-200"
                                            />
                                        </div>
                                    </div>

                                    {/* Password + strength */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Mật khẩu</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                required minLength={6}
                                                value={password}
                                                onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                                placeholder="••••••••"
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[var(--text-primary)]/20 focus:border-violet-500/60 focus:bg-violet-950/20 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all duration-200"
                                            />
                                            <button type="button" onClick={() => setShowPass(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Strength bar */}
                                        {password.length > 0 && (
                                            <div className="mt-1.5 space-y-1">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                                                            style={{
                                                                backgroundColor: n <= strength.score ? strength.color : 'rgba(255,255,255,0.08)'
                                                            }} />
                                                    ))}
                                                </div>
                                                <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Xác nhận mật khẩu</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                            <input
                                                type={showConfirmPass ? 'text' : 'password'}
                                                required
                                                value={confirmPassword}
                                                onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                                                placeholder="••••••••"
                                                className={`w-full bg-[var(--input-bg)] border hover:border-[var(--text-primary)]/20 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${confirmPassword.length > 0 && confirmPassword !== password
                                                    ? 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/20 bg-rose-950/10'
                                                    : 'border-[var(--border-color)] focus:border-violet-500/60 focus:bg-violet-950/20 focus:ring-violet-500/20'
                                                    }`}
                                            />
                                            <button type="button" onClick={() => setShowConfirmPass(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {confirmPassword.length > 0 && confirmPassword !== password && (
                                            <p className="text-xs text-rose-400 mt-1">Mật khẩu không khớp.</p>
                                        )}
                                        {confirmPassword.length > 0 && confirmPassword === password && (
                                            <p className="text-xs text-emerald-400 mt-1">✓ Mật khẩu khớp.</p>
                                        )}
                                    </div>

                                    {/* Agreement */}
                                    <div className="flex items-start gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setAgreed(a => !a); setErrorMsg(''); }}
                                            className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-200 ${agreed
                                                ? 'bg-violet-600 border-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                                                : 'bg-white/5 border-white/15 hover:border-violet-400/50'
                                                }`}
                                        >
                                            {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-white check-pop" />}
                                        </button>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed cursor-pointer select-none" onClick={() => setAgreed(a => !a)}>
                                            Tôi đồng ý với{' '}
                                            <Link to="/privacy" target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
                                                Chính sách bảo mật
                                            </Link>.
                                            Nội dung sẽ được mã hóa và chỉ dùng cho{' '}
                                            <span className="text-[var(--text-primary)] font-medium">AI cá nhân hóa</span> của tôi.
                                        </p>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="relative w-full py-3.5 mt-1 rounded-xl font-semibold text-sm text-white overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
                                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                                    >
                                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ background: 'linear-gradient(135deg, #6d28d9, #4338ca)' }} />
                                        <span className="relative flex items-center justify-center gap-2">
                                            {loading
                                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                : <><span>Tạo tài khoản</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                            }
                                        </span>
                                    </button>
                                </form>

                                <p className="mt-7 text-center text-sm text-[var(--text-secondary)]">
                                    Đã có tài khoản?{' '}
                                    <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                                        Đăng nhập →
                                    </Link>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
