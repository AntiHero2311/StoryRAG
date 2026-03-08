import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, BookOpen } from 'lucide-react';
import { authService, RegisterData } from '../services/authService';

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

const ORBS = [
    { w: 320, h: 320, top: '-80px', left: '-80px', from: '#f59e0b', to: '#d97706', dur: 10 },
    { w: 220, h: 220, top: '62%', left: '55%', from: '#b45309', to: '#78350f', dur: 13 },
    { w: 160, h: 160, top: '32%', left: '6%', from: '#fbbf24', to: '#f59e0b', dur: 8 },
];

const TESTIMONIALS = [
    { text: 'Tôi viết được hơn 30 chương nhờ AI đề xuất hướng đi cho cốt truyện.', name: 'Minh Trí', role: 'Tác giả' },
    { text: 'Bảo mật tốt và giao diện rất thân thiện — cảm giác như viết trong riêng tư hoàn toàn.', name: 'Thu Hà', role: 'Biên kịch' },
];

function LeftPanel() {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % TESTIMONIALS.length), 4500);
        return () => clearInterval(t);
    }, []);

    const particles = Array.from({ length: 18 }, (_, i) => ({
        width: `${3 + (i % 3)}px`,
        height: `${3 + (i % 3)}px`,
        top: `${(i * 13 + 10) % 86 + 7}%`,
        left: `${(i * 19 + 14) % 78 + 11}%`,
        opacity: 0.08 + (i % 5) * 0.05,
        animation: `rg-float ${5.5 + (i % 4) * 1.5}s ease-in-out ${(i % 3) * 0.9}s infinite alternate`,
    }));

    return (
        <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0a0600 0%, #1a0d00 50%, #261400 100%)' }}>

            {ORBS.map((o, i) => (
                <div key={i} className="absolute rounded-full opacity-20 blur-3xl"
                    style={{
                        width: o.w, height: o.h, top: o.top, left: o.left,
                        background: `radial-gradient(circle, ${o.from}, ${o.to})`,
                        animation: `rg-pulse ${o.dur}s ease-in-out infinite alternate`,
                    }} />
            ))}

            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{ ...p, background: 'rgba(251,191,36,0.45)' }} />
            ))}

            <div className="absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)`,
                    backgroundSize: '32px 32px',
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
                        Miễn phí mãi mãi
                    </div>
                    <h2 className="text-4xl font-bold text-white leading-tight mb-3">
                        Bắt đầu
                        <br />
                        <span className="text-transparent bg-clip-text"
                            style={{ backgroundImage: 'linear-gradient(90deg, #fbbf24, #fb923c, #f59e0b)' }}>
                            hành trình của bạn.
                        </span>
                    </h2>
                    <p className="text-amber-100/50 text-sm leading-relaxed max-w-xs">
                        Tài khoản miễn phí, mã hóa riêng tư, AI cá nhân hóa ngay từ ngày đầu tiên.
                    </p>
                </div>

                <div className="rounded-2xl p-5 transition-all duration-500"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-amber-100/65 text-sm leading-relaxed mb-4 italic">
                        &ldquo;{TESTIMONIALS[idx].text}&rdquo;
                    </p>
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                            {TESTIMONIALS[idx].name[0]}
                        </div>
                        <div>
                            <p className="text-amber-100/80 text-xs font-semibold">{TESTIMONIALS[idx].name}</p>
                            <p className="text-amber-100/40 text-xs">{TESTIMONIALS[idx].role}</p>
                        </div>
                        <div className="ml-auto flex gap-1">
                            {TESTIMONIALS.map((_, i) => (
                                <div key={i} className="h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        width: i === idx ? '20px' : '6px',
                                        background: i === idx ? '#f59e0b' : 'rgba(245,158,11,0.2)'
                                    }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <p className="text-amber-100/20 text-xs">© 2026 StoryNest. All rights reserved.</p>
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
            const res = await authService.register(data);
            if (res.accessToken) {
                localStorage.setItem('token', res.accessToken);
            }
            setSuccess(true);
            setTimeout(() => navigate('/plans'), 1800);
        } catch (error: unknown) {
            setLoading(false);
            const err = error as { response?: { data?: { message?: string } } };
            setErrorMsg(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.');
        }
    };

    return (
        <>
            <style>{`
                @keyframes rg-float {
                    from { transform: translateY(0); }
                    to   { transform: translateY(-12px); }
                }
                @keyframes rg-pulse {
                    from { transform: scale(1); opacity: 0.18; }
                    to   { transform: scale(1.15) translate(10px,-10px); opacity: 0.3; }
                }
                @keyframes rg-slide-up {
                    from { opacity: 0; transform: translateY(22px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes rg-check-pop {
                    0%   { transform: scale(0); opacity: 0; }
                    70%  { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes rg-shake {
                    0%,100% { transform: translateX(0); }
                    20%,60% { transform: translateX(-5px); }
                    40%,80% { transform: translateX(5px); }
                }
                @keyframes rg-progress {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
                .rg-slide-up   { animation: rg-slide-up 0.55s cubic-bezier(.22,.68,0,1.2) both; }
                .rg-check-pop  { animation: rg-check-pop 0.4s cubic-bezier(.22,.68,0,1.4) both; }
                .rg-shake      { animation: rg-shake 0.4s ease both; }
                input[type='password']::-ms-reveal,
                input[type='password']::-ms-clear,
                input::-webkit-credentials-auto-fill-button { display: none !important; }
            `}</style>

            <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg-app)]">
                <LeftPanel />

                <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[var(--bg-app)]">
                    <div className="absolute top-1/4 right-0 w-72 h-72 rounded-full pointer-events-none blur-3xl"
                        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.06), transparent)' }} />
                    <div className="absolute bottom-1/3 left-0 w-60 h-60 rounded-full pointer-events-none blur-3xl"
                        style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.05), transparent)' }} />

                    <div className={`w-full max-w-sm ${mounted ? 'rg-slide-up' : 'opacity-0'}`}>
                        <Link to="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                <BookOpen className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-[var(--text-primary)] font-semibold tracking-wide">StoryNest</span>
                        </Link>

                        {success ? (
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center rg-check-pop"
                                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    <CheckCircle2 className="w-8 h-8 text-amber-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Đăng ký thành công!</h2>
                                <p className="text-[var(--text-secondary)] text-sm">Đang chuyển đến trang chọn gói dịch vụ...</p>
                                <div className="w-32 h-1 rounded-full overflow-hidden mt-2"
                                    style={{ background: 'var(--border-color)' }}>
                                    <div className="h-full rounded-full"
                                        style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)', animation: 'rg-progress 1.8s linear forwards' }} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-7">
                                    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1.5">Tạo tài khoản</h1>
                                    <p className="text-[var(--text-secondary)] text-sm">Miễn phí mãi mãi. Không cần thẻ tín dụng 🎉</p>
                                </div>

                                {errorMsg && (
                                    <div className="mb-5 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2.5 rg-shake">
                                        <span className="shrink-0">⚠</span>
                                        {errorMsg}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Họ và tên</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                            <input
                                                type="text" required
                                                value={fullName}
                                                onChange={e => { setFullName(e.target.value); setErrorMsg(''); }}
                                                placeholder="Nguyễn Văn A"
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-amber-500/30 focus:border-amber-500/60 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 transition-all duration-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                            <input
                                                type="email" required
                                                value={email}
                                                onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                                placeholder="name@example.com"
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-amber-500/30 focus:border-amber-500/60 rounded-xl py-3 pl-11 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 transition-all duration-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Mật khẩu</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                required minLength={6}
                                                value={password}
                                                onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                                placeholder="••••••••"
                                                style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-amber-500/30 focus:border-amber-500/60 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 transition-all duration-200"
                                            />
                                            <button type="button" onClick={() => setShowPass(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50 hover:opacity-80 transition-opacity">
                                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {password.length > 0 && (
                                            <div className="mt-1.5 space-y-1">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                                                            style={{ backgroundColor: n <= strength.score ? strength.color : 'rgba(120,113,108,0.15)' }} />
                                                    ))}
                                                </div>
                                                <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Xác nhận mật khẩu</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-50 pointer-events-none" />
                                            <input
                                                type={showConfirmPass ? 'text' : 'password'}
                                                required
                                                value={confirmPassword}
                                                onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                                                placeholder="••••••••"
                                                style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                                className={`w-full bg-[var(--input-bg)] border hover:border-amber-500/30 rounded-xl py-3 pl-11 pr-11 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${confirmPassword.length > 0 && confirmPassword !== password
                                                    ? 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/20'
                                                    : 'border-[var(--border-color)] focus:border-amber-500/60 focus:ring-amber-500/15'
                                                    }`}
                                            />
                                            <button type="button" onClick={() => setShowConfirmPass(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50 hover:opacity-80 transition-opacity">
                                                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {confirmPassword.length > 0 && confirmPassword !== password && (
                                            <p className="text-xs text-rose-400 mt-1">Mật khẩu không khớp.</p>
                                        )}
                                        {confirmPassword.length > 0 && confirmPassword === password && (
                                            <p className="text-xs text-emerald-500 mt-1">✓ Mật khẩu khớp.</p>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setAgreed(a => !a); setErrorMsg(''); }}
                                            className="mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-200"
                                            style={agreed
                                                ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '1px solid #f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.4)' }
                                                : { background: 'var(--input-bg)', border: '1px solid var(--border-color)' }
                                            }
                                        >
                                            {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-white rg-check-pop" />}
                                        </button>
                                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed cursor-pointer select-none" onClick={() => setAgreed(a => !a)}>
                                            Tôi đồng ý với{' '}
                                            <Link to="/privacy" target="_blank" rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors">
                                                Chính sách bảo mật
                                            </Link>.
                                            Nội dung sẽ được mã hóa và chỉ dùng cho{' '}
                                            <span className="text-[var(--text-primary)] font-medium">AI cá nhân hóa</span> của tôi.
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="relative w-full py-3.5 mt-1 rounded-xl font-semibold text-sm text-white overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
                                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                    >
                                        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} />
                                        <span className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                                            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }} />
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
                                    <Link to="/login" className="text-amber-500 hover:text-amber-400 font-semibold transition-colors">
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