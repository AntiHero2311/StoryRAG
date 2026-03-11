import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, Quote } from 'lucide-react';
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

const TESTIMONIALS = [
    { text: 'Tôi viết được hơn 30 chương nhờ AI đề xuất hướng đi cho cốt truyện.', name: 'Minh Trí', role: 'Tác giả Tự do' },
    { text: 'Bảo mật tốt và giao diện rất thân thiện — cảm giác như viết trong riêng tư hoàn toàn.', name: 'Thu Hà', role: 'Biên kịch' },
];

function LeftPanel() {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % TESTIMONIALS.length), 5000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden bg-[var(--bg-panel)] text-white isolate">
            {/* Ambient orbs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[140px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[130px]" style={{ animation: 'pulseSlow 10s infinite alternate-reverse' }} />
                <div className="absolute top-[35%] left-[30%] w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[100px] animate-pulse-slow" />
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.045]" style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '28px 28px'
                }} />
            </div>

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/8 backdrop-blur-md border border-white/10 shadow-lg shadow-indigo-500/20">
                    <img src="/logo.png" alt="StoryNest Logo" className="w-6 h-6 object-contain mix-blend-screen" />
                </div>
                <span className="text-lg font-bold tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-200 to-white">StoryNest</span>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 bg-emerald-500/10 border border-emerald-400/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-300 tracking-widest uppercase">Miễn phí trải nghiệm</span>
                </div>

                <h2 className="text-[2.6rem] font-extrabold leading-[1.1] mb-5 tracking-tight">
                    Khởi đầu<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
                        hành trình của bạn.
                    </span>
                </h2>
                <p className="text-white/45 text-[15px] leading-relaxed mb-10 font-light">
                    Mở ra cánh cửa đến với thế giới sáng tạo vô tận, nơi mỗi ý tưởng đều được nâng niu và bảo vệ.
                </p>

                {/* Testimonial Carousel */}
                <div className="relative rounded-2xl p-5 bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                    <Quote className="absolute top-3 right-3 w-10 h-10 text-white/[0.05] rotate-180" />
                    <div className="relative z-10 min-h-[90px] flex flex-col justify-between">
                        <p className="text-white/75 text-[15px] leading-relaxed italic mb-4 font-medium">
                            &ldquo;{TESTIMONIALS[idx].text}&rdquo;
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white border border-white/20 shrink-0">
                                {TESTIMONIALS[idx].name[0]}
                            </div>
                            <div>
                                <h4 className="text-white/90 font-semibold text-sm">{TESTIMONIALS[idx].name}</h4>
                                <p className="text-white/35 text-xs">{TESTIMONIALS[idx].role}</p>
                            </div>
                            <div className="ml-auto flex gap-1.5">
                                {TESTIMONIALS.map((_, i) => (
                                    <div key={i} className="h-1.5 rounded-full transition-all duration-500 ease-out"
                                        style={{
                                            width: i === idx ? '20px' : '6px',
                                            background: i === idx ? '#818cf8' : 'rgba(255,255,255,0.15)'
                                        }} />
                                ))}
                            </div>
                        </div>
                    </div>
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
        if (!agreed) { setErrorMsg('Vui lòng đồng ý với Điều khoản & Chính sách.'); return; }
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
        <div className="h-screen overflow-hidden grid lg:grid-cols-2 bg-[var(--bg-app)] selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100">
            <LeftPanel />

            <div className="flex items-center justify-center p-6 sm:p-8 relative overflow-y-auto scrollbar-thin overflow-x-hidden">
                {/* Subtle Ambient Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />

                <div className={`relative w-full max-w-[440px] pb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

                    {/* Glass card */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 shadow-xl shadow-black/5 dark:shadow-black/40">

                    {/* Card header */}
                    <div className="flex items-center justify-between mb-7">
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--input-bg)] border border-[var(--border-color)] group-hover:scale-105 transition-transform duration-200">
                                <img src="/logo.png" alt="StoryNest Logo" className="w-5 h-5 object-contain" />
                            </div>
                            <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide">StoryNest</span>
                        </Link>
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] px-2.5 py-1 rounded-full bg-[var(--input-bg)] border border-[var(--border-color)] tracking-wide">
                            Đăng ký
                        </span>
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center text-center gap-5 py-12 animate-fade-in-up">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 relative">
                                <div className="absolute inset-0 rounded-full bg-emerald-400 blur-xl opacity-20 animate-pulse" />
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Đăng ký thành công!</h2>
                                <p className="text-[var(--text-secondary)]">Đang chuyển bạn đến bước tiếp theo...</p>
                            </div>
                            <div className="w-48 h-1.5 rounded-full overflow-hidden mt-4 bg-[var(--border-color)]">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 animate-[progress_1.8s_ease-in-out_forwards]" />
                            </div>
                        </div>
                    ) : (
                        <>
                        <div className="mb-7 mt-1">
                            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Tạo tài khoản 🎉</h1>
                            <p className="text-sm text-[var(--text-secondary)] mt-1.5">Bắt đầu miễn phí. Không cần thẻ tín dụng.</p>
                        </div>

                            {errorMsg && (
                                <div className="mb-4 px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-sm flex items-center gap-3 animate-shake shadow-sm">
                                    <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-rose-600 dark:text-rose-400 text-xs font-bold">!</span>
                                    </div>
                                    <span className="font-medium">{errorMsg}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-3">
                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-focus-within:text-indigo-500">
                                        Họ và tên
                                    </label>
                                    <div className="relative flex items-center">
                                        <User className="absolute left-4 w-5 h-5 text-[var(--text-secondary)]/50 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                                        <input
                                            type="text" required
                                            value={fullName}
                                            onChange={e => { setFullName(e.target.value); setErrorMsg(''); }}
                                            placeholder="Nguyễn Văn A"
                                            className="w-full bg-[var(--input-bg)] border-2 border-transparent hover:border-indigo-400/40 focus:bg-[var(--bg-surface)] rounded-2xl py-2.5 pl-12 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-focus-within:text-indigo-500">
                                        Email
                                    </label>
                                    <div className="relative flex items-center">
                                        <Mail className="absolute left-4 w-5 h-5 text-[var(--text-secondary)]/50 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                                        <input
                                            type="email" required
                                            value={email}
                                            onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
                                            placeholder="name@example.com"
                                            className="w-full bg-[var(--input-bg)] border-2 border-transparent hover:border-indigo-400/40 focus:bg-[var(--bg-surface)] rounded-2xl py-2.5 pl-12 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-focus-within:text-indigo-500">
                                        Mật khẩu
                                    </label>
                                    <div className="relative flex items-center">
                                        <Lock className="absolute left-4 w-5 h-5 text-[var(--text-secondary)]/50 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            required minLength={6}
                                            value={password}
                                            onChange={e => { setPassword(e.target.value); setErrorMsg(''); }}
                                            placeholder="Tối thiểu 6 ký tự"
                                            className="w-full bg-[var(--input-bg)] border-2 border-transparent hover:border-indigo-400/40 focus:bg-[var(--bg-surface)] rounded-2xl py-2.5 pl-12 pr-12 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
                                            style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                        />
                                        <button type="button" onClick={() => setShowPass(p => !p)}
                                            className="absolute right-4 p-1 rounded-md text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Password Strength */}
                                    {password.length > 0 && (
                                        <div className="pt-1 select-none animate-fade-in-up">
                                            <div className="flex gap-1.5 h-1.5 mb-2">
                                                {[1, 2, 3, 4].map(n => (
                                                    <div key={n} className="flex-1 rounded-full bg-[var(--border-color)] overflow-hidden">
                                                        <div className="h-full w-full transition-all duration-500"
                                                            style={{
                                                                backgroundColor: strength.color,
                                                                transform: `translateX(${n <= (strength.score > 0 ? strength.score : 0) ? '0' : '-100%'})`
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[11px] font-medium" style={{ color: strength.color }}>{strength.label}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-focus-within:text-indigo-500">
                                        Xác nhận mật khẩu
                                    </label>
                                    <div className="relative flex items-center">
                                        <Lock className="absolute left-4 w-5 h-5 text-[var(--text-secondary)]/50 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                                        <input
                                            type={showConfirmPass ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                                            placeholder="Nhập lại mật khẩu"
                                            className={`w-full bg-[var(--input-bg)] border-2 rounded-2xl py-2.5 pl-12 pr-12 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-base focus:outline-none focus:ring-4 transition-all duration-300 ${confirmPassword.length > 0 && confirmPassword !== password
                                                ? 'border-rose-500/50 bg-rose-500/5 focus:border-rose-500 focus:ring-rose-500/20'
                                                : confirmPassword.length > 0 && confirmPassword === password
                                                    ? 'border-emerald-500/50 bg-emerald-500/5 focus:border-emerald-500 focus:ring-emerald-500/20'
                                                    : 'border-transparent hover:border-indigo-400/40 focus:bg-[var(--bg-surface)] focus:ring-indigo-500/10'
                                                }`}
                                            style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                        />
                                        <button type="button" onClick={() => setShowConfirmPass(p => !p)}
                                            className="absolute right-4 p-1 rounded-md text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {showConfirmPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {confirmPassword.length > 0 && confirmPassword !== password && (
                                        <p className="text-[11px] font-medium text-rose-500 animate-fade-in-up pt-1">Mật khẩu xác nhận chưa khớp.</p>
                                    )}
                                </div>

                                <div className="flex items-start gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setAgreed(!agreed); setErrorMsg(''); }}
                                        className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all duration-300 ${agreed
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent shadow shadow-indigo-500/30'
                                            : 'bg-[var(--input-bg)] border-[var(--border-color)] hover:border-indigo-400'
                                            }`}
                                    >
                                        <CheckCircle2 className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${agreed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                    </button>
                                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed flex-1 select-none" onClick={() => setAgreed(!agreed)}>
                                        Tôi đồng ý với{' '}
                                        <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="font-medium text-[var(--text-primary)] hover:text-indigo-500 transition-colors underline decoration-[var(--border-color)] underline-offset-4 hover:decoration-indigo-500">
                                            Điều khoản dịch vụ
                                        </Link>
                                        {' '}và{' '}
                                        <Link to="/legal/terms" target="_blank" rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="font-medium text-[var(--text-primary)] hover:text-indigo-500 transition-colors underline decoration-[var(--border-color)] underline-offset-4 hover:decoration-indigo-500">
                                            Chính sách bảo mật
                                        </Link>
                                        .
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 mt-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Đang tạo tài khoản...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-base tracking-wide">Tạo Tài Khoản</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-5 pt-5 border-t border-[var(--border-color)]">
                                <p className="text-xs text-[var(--text-secondary)] text-center mb-3">Đã có tài khoản?</p>
                                <Link to="/login" className="flex items-center justify-center w-full h-10 rounded-xl border border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--input-bg)] hover:border-indigo-400/30 transition-all duration-200 group gap-1.5">
                                    Đăng nhập ngay
                                    <span className="text-indigo-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">→</span>
                                </Link>
                            </div>
                        </>
                    )}
                    </div>{/* end glass card */}
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
                @keyframes progress {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
                input[type='password']::-ms-reveal,
                input[type='password']::-ms-clear { display: none; }
            `}</style>
        </div>
    );
}