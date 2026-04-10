import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, User, BrainCircuit } from 'lucide-react';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { authService, LoginData, RegisterData } from '../services/authService';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

export default function AuthPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login');

    const switchMode = (newMode: 'login' | 'register') => {
        setMode(newMode);
        window.history.pushState(null, '', `/${newMode}`);
        setErrorMsg('');
        if (newMode === 'login') {
            setTimeout(() => emailLoginRef.current?.focus(), 100);
        } else {
            setTimeout(() => nameRegRef.current?.focus(), 100);
        }
    };

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);

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
        if (mode === 'login') {
            setTimeout(() => emailLoginRef.current?.focus(), 500);
        } else {
            setTimeout(() => nameRegRef.current?.focus(), 500);
        }
    }, [mode]);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        try {
            const data: LoginData = { email: loginEmail, password: loginPassword };
            const response = await authService.login(data);
            localStorage.setItem('token', response.accessToken);
            navigate('/subscription');
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
            setTimeout(() => navigate('/subscription'), 1800);
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        }
    };

    const handleGoogleLoginSuccess = async (credentialResponse: CredentialResponse) => {
        const idToken = credentialResponse.credential;
        if (!idToken) {
            setErrorMsg('Không lấy được thông tin đăng nhập Google.');
            return;
        }

        setLoading(true);
        setErrorMsg('');
        try {
            const response = await authService.googleLogin({ idToken });
            localStorage.setItem('token', response.accessToken);
            if (response.refreshToken) {
                localStorage.setItem('refreshToken', response.refreshToken);
            }
            navigate('/subscription');
        } catch (error: any) {
            setLoading(false);
            setErrorMsg(error.response?.data?.message || 'Đăng nhập Google thất bại.');
        }
    };

    const handleGoogleLoginError = () => {
        setErrorMsg('Đăng nhập Google thất bại.');
    };

    // Premium styling variants for Inputs
    const inputCls = "w-full h-[52px] bg-white/5 border border-white/10 rounded-xl px-4 pl-12 text-white text-[15px] placeholder-zinc-500 focus:bg-white/10 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 shadow-inner";
    const labelCls = "block text-[13px] font-bold text-zinc-300 mb-2 tracking-wide uppercase";
    const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-[20px] h-[20px] pointer-events-none transition-colors duration-300 peer-focus:text-indigo-400";

    return (
        <div className="flex min-h-screen bg-[#101010] font-sans">
            
            {/* LEFT PANEL - BRANDING (50vw) */}
            <div className="hidden lg:flex w-1/2 bg-[#090514] relative overflow-hidden flex-col justify-between p-12 lg:p-16">
                
                {/* Beautiful deep space gradients */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#581c87] blur-[140px] rounded-full mix-blend-screen opacity-50" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-[#1e1b4b] blur-[150px] rounded-full mix-blend-screen" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-indigo-600/30 blur-[120px] rounded-full mix-blend-screen" />

                {/* Top: Logo with image */}
                <div className="relative z-10 flex items-center gap-3">
                    <img 
                        src="/logo.png" 
                        alt="StoryNest Logo" 
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                            // Fallback if logo.png not found
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg"><span class="text-white font-black text-xl">S</span></div> <span class="font-black text-3xl tracking-tight text-white ml-3">StoryNest</span>';
                        }}
                    />
                    <span className="font-black text-3xl tracking-tight text-white drop-shadow-md">
                        StoryNest
                    </span>
                </div>

                {/* Middle: Premium CSS Art / Glowing SVG */}
                <div className="relative z-10 flex-1 flex items-center justify-center -my-8 pointer-events-none select-none">
                    <div className="relative">
                        <BrainCircuit size={320} strokeWidth={0.5} className="text-indigo-500/40 animate-pulse-slow drop-shadow-[0_0_50px_rgba(99,102,241,0.6)]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090514] via-transparent to-transparent" />
                    </div>
                </div>

                {/* Bottom: Typography & Badge */}
                <div className="relative z-10">
                    <h1 className="text-4xl xl:text-5xl 2xl:text-[3.5rem] font-black leading-[1.1] mb-6 text-white tracking-tight">
                        Nơi mọi ý tưởng <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-purple-400">trở thành kiệt tác.</span>
                    </h1>
                    
                    <p className="text-zinc-400/90 text-lg leading-relaxed max-w-[500px] mb-10 font-medium">
                        Hệ sinh thái sáng tác thế hệ mới. Khai phóng sức mạnh AI để xây dựng nhân vật, thế giới và dệt nên những cốt truyện hoàn hảo.
                    </p>

                    <div className="inline-flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 py-3 px-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                        <div className="flex -space-x-3">
                            <img src="https://i.pravatar.cc/100?img=9" alt="Author" className="w-10 h-10 rounded-full border-[3px] border-[#100b1a] object-cover" />
                            <img src="https://i.pravatar.cc/100?img=12" alt="Author" className="w-10 h-10 rounded-full border-[3px] border-[#100b1a] object-cover" />
                            <img src="https://i.pravatar.cc/100?img=5" alt="Author" className="w-10 h-10 rounded-full border-[3px] border-[#100b1a] object-cover" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider leading-tight">Cộng đồng tác giả</span>
                            <span className="text-[15px] font-semibold text-white leading-tight">
                                <strong className="text-indigo-400 font-black">10,000+</strong> chữ mỗi ngày
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL - FORM (50vw) */}
            <div className="w-full lg:w-1/2 bg-[#121212] flex flex-col items-center justify-center relative p-6">
                
                {/* Mobile Header (Hidden on LG) */}
                <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2 z-20">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    <span className="font-extrabold text-xl text-white">StoryNest</span>
                </div>

                {/* Right Top Toggle */}
                <div className="absolute top-6 right-6 lg:top-10 lg:right-10 flex items-center bg-[#1a1a1a] border border-white/5 rounded-xl p-1.5 shadow-lg z-20">
                    <button 
                        onClick={() => switchMode('login')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${mode === 'login' ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                        Đăng nhập
                    </button>
                    <button 
                        onClick={() => switchMode('register')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${mode === 'register' ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
                    >
                        Đăng ký
                    </button>
                </div>

                {/* Glassmorphic Form Container */}
                <div className="w-full max-w-[460px] bg-white/[0.02] border border-white/5 backdrop-blur-2xl rounded-[2rem] shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] relative z-10 mt-16 lg:mt-0 overflow-hidden grid">
                    
                    {/* LOGIN FORM */}
                    <div className={`col-start-1 row-start-1 p-8 sm:p-10 transition-all duration-500 transform ${mode === 'login' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-12 pointer-events-none z-0'}`}>
                        <div className="mb-10 text-center sm:text-left">
                            <h2 className="text-[2rem] font-black text-white mb-2 tracking-tight">Mừng bạn trở lại</h2>
                            <p className="text-zinc-400 text-[15px] font-medium">Tiếp tục hành trình sáng tác cùng StoryNest.</p>
                        </div>

                        {mode === 'login' && errorMsg && (
                            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">!</div>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleLoginSubmit} className="space-y-5">
                            <div>
                                <label className={labelCls}>Trạm thư (Email)</label>
                                <div className="relative group/input">
                                    <input
                                        ref={emailLoginRef}
                                        type="email" required
                                        value={loginEmail}
                                        onChange={e => { setLoginEmail(e.target.value); setErrorMsg(''); }}
                                        placeholder="thanh.tuyen@dainguyen.com"
                                        className={`peer ${inputCls}`}
                                    />
                                    <Mail className={iconCls} />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className={labelCls} style={{ marginBottom: 0 }}>Mật mã</label>
                                    <Link to="/forgot-password" className="text-[13px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-400/10 px-2 py-0.5 rounded">
                                        Quên mật mã?
                                    </Link>
                                </div>
                                <div className="relative group/input">
                                    <input
                                        type={showLoginPass ? 'text' : 'password'}
                                        required minLength={6}
                                        value={loginPassword}
                                        onChange={e => { setLoginPassword(e.target.value); setErrorMsg(''); }}
                                        placeholder="••••••••"
                                        className={`peer ${inputCls} pr-12`}
                                    />
                                    <Lock className={iconCls} />
                                    <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                                        {showLoginPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit" disabled={loading}
                                className="w-full h-[56px] rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-[16px] shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_10px_40px_-5px_rgba(79,70,229,0.6)] transform hover:-translate-y-0.5 transition-all duration-300 mt-6 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> Xử lý...</>
                                ) : (
                                    <>Đăng Nhập <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>

                        <div className="my-8 flex items-center justify-center relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                            <span className="relative bg-[#121212] px-4 text-zinc-500 font-bold text-[11px] tracking-widest uppercase rounded-lg">HOẶC</span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {googleClientId ? (
                                <div className="h-12 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                                    <GoogleLogin
                                        onSuccess={handleGoogleLoginSuccess}
                                        onError={handleGoogleLoginError}
                                        text="signin_with"
                                        shape="pill"
                                        size="large"
                                        width="360"
                                        locale="vi"
                                    />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setErrorMsg('Thiếu cấu hình VITE_GOOGLE_CLIENT_ID cho đăng nhập Google.')}
                                    className="h-12 rounded-xl flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-bold transition-all shadow-sm"
                                >
                                    <GoogleIcon /> Google
                                </button>
                            )}
                        </div>
                    </div>

                    {/* REGISTER FORM */}
                    <div className={`col-start-1 row-start-1 p-8 sm:p-10 transition-all duration-500 transform ${mode === 'register' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-12 pointer-events-none z-0'}`}>
                        {success ? (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Đăng ký siêu tốc!</h2>
                                <p className="text-zinc-400 text-[15px]">Đang mở cánh cửa bước vào thế giới StoryNest...</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-8 text-center sm:text-left">
                                    <h2 className="text-[2rem] font-black text-white mb-2 tracking-tight">Khởi tạo</h2>
                                    <p className="text-zinc-400 text-[15px] font-medium">Bắt đầu hành trình sáng tác ngay hôm nay.</p>
                                </div>

                                {mode === 'register' && errorMsg && (
                                    <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">!</div>
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                    <div>
                                        <label className={labelCls}>Bút danh</label>
                                        <div className="relative group/input">
                                            <input
                                                ref={nameRegRef}
                                                type="text" required
                                                value={regName}
                                                onChange={e => { setRegName(e.target.value); setErrorMsg(''); }}
                                                placeholder="VD: Nguyễn Du"
                                                className={`peer ${inputCls}`}
                                            />
                                            <User className={iconCls} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelCls}>Trạm thư (Email)</label>
                                        <div className="relative group/input">
                                            <input
                                                type="email" required
                                                value={regEmail}
                                                onChange={e => { setRegEmail(e.target.value); setErrorMsg(''); }}
                                                placeholder="email@example.com"
                                                className={`peer ${inputCls}`}
                                            />
                                            <Mail className={iconCls} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Mật mã</label>
                                            <div className="relative group/input">
                                                <input
                                                    type={showRegPass ? 'text' : 'password'}
                                                    required minLength={6}
                                                    value={regPassword}
                                                    onChange={e => { setRegPassword(e.target.value); setErrorMsg(''); }}
                                                    placeholder="Tối thiểu 6 ký tự"
                                                    className={`peer ${inputCls} pr-10`}
                                                />
                                                <Lock className={iconCls} />
                                                <button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                                                    {showRegPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Xác nhận</label>
                                            <div className="relative group/input">
                                                <input
                                                    type={showConfirmPass ? 'text' : 'password'}
                                                    required
                                                    value={confirmPassword}
                                                    onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                                                    placeholder="Nhập lại..."
                                                    className={`peer ${inputCls} pr-10`}
                                                />
                                                <Lock className={iconCls} />
                                                <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                                                    {showConfirmPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 pt-3">
                                        <div className="pt-0.5">
                                            <input 
                                                type="checkbox" 
                                                id="terms" 
                                                checked={agreed} 
                                                onChange={() => setAgreed(!agreed)}
                                                className="w-5 h-5 bg-black/50 border-white/20 rounded text-indigo-500 checked:bg-indigo-500 focus:ring-0 cursor-pointer transition-all"
                                            />
                                        </div>
                                        <label htmlFor="terms" className="text-[13px] text-zinc-400 font-medium leading-relaxed cursor-pointer select-none">
                                            Tôi chịu trách nhiệm với thế giới tôi tạo ra và tuân thủ <Link to="/privacy" className="text-white hover:text-indigo-400 font-bold underline decoration-white/30 decoration-2 underline-offset-2">Thiên Ý (Điều khoản)</Link>.
                                        </label>
                                    </div>

                                    <button
                                        type="submit" disabled={loading}
                                        className="w-full h-[56px] rounded-xl bg-white hover:bg-zinc-200 text-[#121212] font-black text-[16px] shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_10px_40px_-5px_rgba(255,255,255,0.4)] transform hover:-translate-y-0.5 transition-all duration-300 mt-6"
                                    >
                                        {loading ? 'Đang tạo...' : 'Bắt Đầu Khởi Tạo'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                input[type='password']::-ms-reveal,
                input[type='password']::-ms-clear { display: none; }
            `}</style>
        </div>
    );
}
