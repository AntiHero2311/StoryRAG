import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, Quote, Sparkles, ShieldCheck, BarChart3 } from 'lucide-react';
import { authService, LoginData, RegisterData } from '../services/authService';

const FEATURES = [
    { icon: <Sparkles className="w-5 h-5 text-amber-500" />, title: 'Sáng tạo vô hạn', desc: 'AI hiểu phong cách của riêng bạn' },
    { icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />, title: 'Bảo mật tuyệt đối', desc: 'Mã hóa end-to-end an toàn' },
    { icon: <BarChart3 className="w-5 h-5 text-blue-500" />, title: 'Phân tích sâu', desc: 'Cải thiện cốt truyện với dữ liệu' },
];

const TESTIMONIALS = [
    { text: 'Tôi viết được hơn 30 chương nhờ AI đề xuất hướng đi cho cốt truyện.', name: 'Minh Trí', role: 'Tác giả Tự do' },
    { text: 'Bảo mật tốt và giao diện rất thân thiện — cảm giác như viết trong riêng tư hoàn toàn.', name: 'Thu Hà', role: 'Biên kịch' },
];

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

function LeftPanel({ mode }: { mode: 'login' | 'register' }) {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        if (mode === 'register') {
            const t = setInterval(() => setIdx(i => (i + 1) % TESTIMONIALS.length), 5000);
            return () => clearInterval(t);
        }
    }, [mode]);

    return (
        <div className="relative hidden lg:flex flex-col p-10 overflow-hidden bg-[var(--bg-panel)] text-white isolate transition-all duration-700">
            {/* Dynamic Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen animate-pulse-slow transition-colors duration-1000 ${mode === 'login' ? 'bg-indigo-600/20' : 'bg-indigo-600/20'}`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] mix-blend-screen transition-colors duration-1000 ${mode === 'login' ? 'bg-purple-600/25' : 'bg-emerald-600/20'}`} style={{ animation: 'pulseSlow 12s infinite alternate-reverse' }} />
                <div className={`absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full blur-[100px] mix-blend-screen animate-pulse-slow delay-1000 transition-colors duration-1000 ${mode === 'login' ? 'bg-blue-600/15' : 'bg-purple-600/15'}`} />
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-md flex-1 flex flex-col justify-center">

                {/* LOGIN CONTENT */}
                <div className={`absolute inset-0 transition-all duration-700 transform ${mode === 'login' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-12 pointer-events-none'}`}>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 bg-white/5 border border-white/10 backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                        </span>
                        <span className="text-xs font-medium text-indigo-300 uppercase tracking-widest">AI Engine v2.0 Live</span>
                    </div>

                    <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] mb-4 tracking-tight">
                        Hãy để chữ<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
                            tự do tuôn chảy.
                        </span>
                    </h2>
                    <p className="text-base text-white/50 leading-relaxed mb-6 font-light">
                        Môi trường sáng tác thế hệ mới, nơi trí tuệ nhân tạo hòa quyện cùng trí tưởng tượng của bạn trong một không gian bảo mật tuyệt đối.
                    </p>

                    <div className="space-y-4">
                        {FEATURES.map((feature, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors duration-300">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="text-white font-medium mb-0.5">{feature.title}</h3>
                                    <p className="text-sm text-white/40">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* REGISTER CONTENT */}
                <div className={`absolute inset-0 transition-all duration-700 transform ${mode === 'register' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-12 pointer-events-none'}`}>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-300 tracking-wide">Miễn phí trải nghiệm</span>
                    </div>

                    <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] mb-4 tracking-tight">
                        Khởi đầu<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
                            hành trình của bạn.
                        </span>
                    </h2>
                    <p className="text-base text-white/50 leading-relaxed mb-6 font-light">
                        Mở ra cánh cửa đến với thế giới sáng tạo vô tận, nơi mỗi ý tưởng đều được nâng niu và bảo vệ.
                    </p>

                    <div className="relative rounded-2xl p-6 bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm overflow-hidden">
                        <Quote className="absolute top-4 right-4 w-12 h-12 text-white/[0.04] rotate-180" />
                        <div className="relative z-10 min-h-[100px] flex flex-col justify-between">
                            <p className="text-white/80 text-base leading-relaxed italic mb-4 font-medium tracking-wide">
                                &ldquo;{TESTIMONIALS[idx].text}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white border border-white/20">
                                    {TESTIMONIALS[idx].name[0]}
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold text-sm">{TESTIMONIALS[idx].name}</h4>
                                    <p className="text-white/40 text-xs">{TESTIMONIALS[idx].role}</p>
                                </div>
                                <div className="ml-auto flex gap-1.5">
                                    {TESTIMONIALS.map((_, i) => (
                                        <div key={i} className="h-1.5 rounded-full transition-all duration-500 ease-out"
                                            style={{
                                                width: i === idx ? '20px' : '5px',
                                                background: i === idx ? '#818cf8' : 'rgba(255,255,255,0.15)'
                                            }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AuthPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login');

    const switchMode = (newMode: 'login' | 'register') => {
        setMode(newMode);
        window.history.pushState(null, '', `/${newMode}`);
        setErrorMsg('');
        if (newMode === 'login') {
            setTimeout(() => emailLoginRef.current?.focus(), 500);
        } else {
            setTimeout(() => nameRegRef.current?.focus(), 500);
        }
    };

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPass, setShowLoginPass] = useState(false);
    const emailLoginRef = useRef<HTMLInputElement>(null);

    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showRegPass, setShowRegPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const nameRegRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
        if (mode === 'login') {
            setTimeout(() => emailLoginRef.current?.focus(), 500);
        } else {
            setTimeout(() => nameRegRef.current?.focus(), 500);
        }
    }, []);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        try {
            const data: LoginData = { email: loginEmail, password: loginPassword };
            const response = await authService.login(data);
            localStorage.setItem('token', response.accessToken);
            navigate('/home');
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) { setErrorMsg('Vui lòng đồng ý với Điều khoản & Chính sách.'); return; }
        if (regPassword !== confirmPassword) { setErrorMsg('Mật khẩu xác nhận không khớp.'); return; }
        setLoading(true);
        setErrorMsg('');
        try {
            const data: RegisterData = { fullName: regName, email: regEmail, password: regPassword };
            const res = await authService.register(data);
            if (res.accessToken) localStorage.setItem('token', res.accessToken);
            setSuccess(true);
            setTimeout(() => navigate('/plans'), 1800);
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        }
    };

    const strength = getStrength(regPassword);

    // ---------- INPUT CLASS HELPERS ----------
    const inputBase = "w-full border-2 rounded-xl pl-10 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none transition-all duration-200 bg-[var(--bg-app)] border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10";
    const inputH12 = inputBase + " h-12 pr-4";
    const inputH11 = inputBase + " h-11 pr-4";
    const inputH11pr10 = inputBase + " h-11 pr-10";
    const iconCls = "absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/50 pointer-events-none";
    const labelCls = "block text-sm font-semibold text-[var(--text-primary)] mb-1.5";

    return (
        <div className="h-screen overflow-hidden grid lg:grid-cols-2 lg:grid-rows-[1fr_auto] bg-[var(--bg-app)]">
            <LeftPanel mode={mode} />

            {/* ============ RIGHT PANEL ============ */}
            <div className="flex flex-col overflow-hidden bg-[var(--bg-surface)]">

                {/* Logo Bar */}
                <div className="flex items-center justify-start px-4 py-4 shrink-0 border-b border-[var(--border-color)]">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2.5 group"
                    >
                        <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm border border-[var(--border-color)] group-hover:border-indigo-400/60 transition-all duration-200">
                            <img src="/logo.png" alt="StoryNest" className="w-6 h-6 object-contain" />
                        </div>
                        <span className="text-[var(--text-primary)] font-bold text-lg tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">StoryNest</span>
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-4 overflow-y-auto">
                    {/* Ambient glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-indigo-500/5 dark:bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />
                    <div className={`relative w-full max-w-[420px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                        {/* Glass card */}
                        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 shadow-xl shadow-black/5 dark:shadow-black/40">

                        {/* Sliding container */}
                        <div className="relative overflow-hidden min-h-[380px]">

                            {/* ===== LOGIN FORM ===== */}
                            <div className={`transition-all duration-500 ease-in-out ${mode === 'login' ? 'opacity-100 translate-x-0 pointer-events-auto static' : 'opacity-0 -translate-x-8 pointer-events-none absolute inset-0'}`}>
                                <div className="mb-6">
                                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Chào mừng trở lại</p>
                                    <h1 className="text-[2.2rem] font-extrabold text-[var(--text-primary)] leading-tight tracking-tight">Đăng nhập</h1>
                                    <p className="text-[var(--text-secondary)] text-sm mt-1.5">Mài giũa những câu chuyện của bạn.</p>
                                </div>

                                {mode === 'login' && errorMsg && (
                                    <div className="mb-5 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2.5 animate-shake">
                                        <span className="font-black">!</span>
                                        <span className="font-medium">{errorMsg}</span>
                                    </div>
                                )}

                                <form onSubmit={handleLoginSubmit} className="space-y-4">
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <div className="relative">
                                            <Mail className={iconCls} style={{ width: '17px', height: '17px' }} />
                                            <input
                                                ref={emailLoginRef}
                                                type="email" required
                                                value={loginEmail}
                                                onChange={e => { setLoginEmail(e.target.value); setErrorMsg(''); }}
                                                placeholder="name@example.com"
                                                className={inputH12}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-sm font-semibold text-[var(--text-primary)]">Mật khẩu</label>
                                            <button type="button" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 transition-colors">
                                                Quên mật khẩu?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock className={iconCls} style={{ width: '17px', height: '17px' }} />
                                            <input
                                                type={showLoginPass ? 'text' : 'password'}
                                                required minLength={6}
                                                value={loginPassword}
                                                onChange={e => { setLoginPassword(e.target.value); setErrorMsg(''); }}
                                                placeholder="••••••••"
                                                className={inputBase + " h-12 pr-10"}
                                            />
                                            <button type="button" onClick={() => setShowLoginPass(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors rounded-lg">
                                                {showLoginPass ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-2"
                                    >
                                        {loading ? (
                                            <><div className="w-[17px] h-[17px] border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang xác thực...</span></>
                                        ) : (
                                            <><span>Đăng Nhập</span><ArrowRight style={{ width: '17px', height: '17px' }} /></>
                                        )}
                                    </button>
                                </form>

                                <div className="py-4 sm:hidden text-center">
                                    Chưa có tài khoản?{' '}
                                    <button onClick={() => switchMode('register')} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4">
                                        Đăng ký
                                    </button>
                                </div>
                            </div>

                            {/* ===== REGISTER FORM ===== */}
                            <div className={`transition-all duration-500 ease-in-out ${mode === 'register' ? 'opacity-100 translate-x-0 pointer-events-auto static' : 'opacity-0 translate-x-8 pointer-events-none absolute inset-0'}`}>
                                {success ? (
                                    <div className="flex flex-col items-center text-center gap-5 py-16">
                                        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 relative">
                                            <div className="absolute inset-0 rounded-full bg-emerald-400 blur-xl opacity-20 animate-pulse" />
                                            <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1.5">Đăng ký thành công!</h2>
                                            <p className="text-[var(--text-secondary)] text-sm">Đang chuyển bạn đến bước tiếp theo...</p>
                                        </div>
                                        <div className="w-48 h-1.5 rounded-full overflow-hidden bg-[var(--border-color)]">
                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 animate-[progress_1.8s_ease-in-out_forwards]" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-6">
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Miễn phí · Không cần thẻ</p>
                                            <h1 className="text-[2.2rem] font-extrabold text-[var(--text-primary)] leading-tight tracking-tight">Tạo tài khoản</h1>
                                            <p className="text-[var(--text-secondary)] text-sm mt-1.5">Bắt đầu hành trình sáng tạo của bạn.</p>
                                        </div>

                                        {mode === 'register' && errorMsg && (
                                            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2.5 animate-shake">
                                                <span className="font-black">!</span>
                                                <span className="font-medium">{errorMsg}</span>
                                            </div>
                                        )}

                                        <form onSubmit={handleRegisterSubmit} className="space-y-3">
                                            <div>
                                                <label className={labelCls}>Họ và tên</label>
                                                <div className="relative">
                                                    <User className={iconCls} style={{ width: '17px', height: '17px' }} />
                                                    <input
                                                        ref={nameRegRef}
                                                        type="text" required
                                                        value={regName}
                                                        onChange={e => { setRegName(e.target.value); setErrorMsg(''); }}
                                                        placeholder="Nguyễn Văn A"
                                                        className={inputH11}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Email</label>
                                                <div className="relative">
                                                    <Mail className={iconCls} style={{ width: '17px', height: '17px' }} />
                                                    <input
                                                        type="email" required
                                                        value={regEmail}
                                                        onChange={e => { setRegEmail(e.target.value); setErrorMsg(''); }}
                                                        placeholder="name@example.com"
                                                        className={inputH11}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Mật khẩu</label>
                                                <div className="relative">
                                                    <Lock className={iconCls} style={{ width: '17px', height: '17px' }} />
                                                    <input
                                                        type={showRegPass ? 'text' : 'password'}
                                                        required minLength={6}
                                                        value={regPassword}
                                                        onChange={e => { setRegPassword(e.target.value); setErrorMsg(''); }}
                                                        placeholder="Tối thiểu 6 ký tự"
                                                        className={inputH11pr10}
                                                        style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                                    />
                                                    <button type="button" onClick={() => setShowRegPass(p => !p)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors rounded-lg">
                                                        {showRegPass ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                                                    </button>
                                                </div>
                                                {regPassword.length > 0 && (
                                                    <div className="mt-1.5">
                                                        <div className="flex gap-1 h-[3px] mb-1">
                                                            {[1, 2, 3, 4].map(n => (
                                                                <div key={n} className="flex-1 rounded-full bg-[var(--border-color)] overflow-hidden">
                                                                    <div className="h-full w-full transition-all duration-500"
                                                                        style={{
                                                                            backgroundColor: strength.color,
                                                                            transform: `translateX(${n <= (strength.score > 0 ? strength.score : 0) ? '0' : '-100%'})`
                                                                        }} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] font-semibold" style={{ color: strength.color }}>{strength.label}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className={labelCls}>Xác nhận mật khẩu</label>
                                                <div className="relative">
                                                    <Lock className={iconCls} style={{ width: '17px', height: '17px' }} />
                                                    <input
                                                        type={showConfirmPass ? 'text' : 'password'}
                                                        required
                                                        value={confirmPassword}
                                                        onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                                                        placeholder="Nhập lại mật khẩu"
                                                        className={`w-full h-11 border-2 rounded-xl pl-10 pr-10 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 text-sm focus:outline-none transition-all duration-200 ${confirmPassword.length > 0 && confirmPassword !== regPassword
                                                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-400 dark:border-rose-500/50'
                                                            : confirmPassword.length > 0 && confirmPassword === regPassword
                                                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/50'
                                                                : 'bg-[var(--bg-app)] border-[var(--border-color)] hover:border-indigo-400/60 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10'
                                                            }`}
                                                        style={{ WebkitAppearance: 'none' } as React.CSSProperties}
                                                    />
                                                    <button type="button" onClick={() => setShowConfirmPass(p => !p)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors rounded-lg">
                                                        {showConfirmPass ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                                                    </button>
                                                </div>
                                                {confirmPassword.length > 0 && confirmPassword !== regPassword && (
                                                    <p className="text-[10px] font-semibold text-rose-500 mt-1">Mật khẩu chưa khớp.</p>
                                                )}
                                            </div>

                                            <div className="flex items-start gap-2.5 pt-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => { setAgreed(!agreed); setErrorMsg(''); }}
                                                    className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all duration-200 ${agreed
                                                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-transparent shadow shadow-indigo-500/30'
                                                        : 'bg-[var(--bg-app)] border-[var(--border-color)] hover:border-indigo-400'
                                                        }`}
                                                >
                                                    <CheckCircle2 className={`text-white transition-all duration-200 ${agreed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} style={{ width: '12px', height: '12px' }} />
                                                </button>
                                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed cursor-pointer select-none" onClick={() => setAgreed(!agreed)}>
                                                    Tôi đồng ý với{' '}
                                                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-semibold text-[var(--text-primary)] hover:text-indigo-500 underline underline-offset-2 transition-colors">Chính sách bảo mật</Link>.
                                                </p>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full h-11 rounded-xl font-bold text-white text-sm tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-1"
                                            >
                                                {loading ? (
                                                    <><div className="w-[17px] h-[17px] border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang tạo...</span></>
                                                ) : (
                                                    <><span>Tạo Tài Khoản</span><ArrowRight style={{ width: '17px', height: '17px' }} /></>
                                                )}
                                            </button>
                                        </form>

                                        <p className="mt-4 text-center text-sm text-[var(--text-secondary)] sm:hidden">
                                            Đã có tài khoản?{' '}
                                            <button onClick={() => switchMode('login')} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4">
                                                Đăng nhập
                                            </button>
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>{/* end sliding container */}
                        </div>{/* end glass card */}

                        {/* Mode switch */}
                        <div className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] mt-5">
                            {mode === 'login' ? (
                                <>
                                    <span>Chưa có tài khoản?</span>
                                    <button onClick={() => switchMode('register')} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 transition-colors ml-1">
                                        Đăng ký miễn phí →
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span>Đã có tài khoản?</span>
                                    <button onClick={() => switchMode('login')} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 transition-colors ml-1">
                                        Đăng nhập →
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - removed, now full-width below */}
            </div>

            {/* Full-width footer spanning both columns */}
            <div className="lg:col-span-2 flex items-center justify-between px-8 py-3 border-t border-[var(--border-color)] bg-[var(--bg-app)]">
                <p className="text-xs text-[var(--text-secondary)]/50">© 2026 StoryNest. All rights reserved.</p>
                <Link to="/privacy" className="text-xs text-[var(--text-secondary)]/50 hover:text-[var(--text-secondary)] transition-colors">Chính sách bảo mật</Link>
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
