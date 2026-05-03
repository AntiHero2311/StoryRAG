import { forwardRef, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import {
    ArrowRight,
    BarChart3,
    BrainCircuit,
    CheckCircle2,
    Eye,
    EyeOff,
    Layers3,
    Lock,
    Mail,
    ShieldCheck,
    Sparkles,
    User,
} from 'lucide-react';
import { authService, LoginData, RegisterData } from '../services/authService';
import { subscriptionService } from '../services/subscriptionService';

function GoogleLoginSized({
    mode,
    onSuccess,
    onError,
}: {
    mode: 'login' | 'register';
    onSuccess: (credentialResponse: CredentialResponse) => void;
    onError: () => void;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [btnWidth, setBtnWidth] = useState(320);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => {
            const w = Math.floor(el.getBoundingClientRect().width);
            setBtnWidth(Math.max(220, Math.min(w, 400)));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={wrapRef}
            className="flex min-h-12 w-full max-w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.12] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
        >
            <GoogleLogin
                onSuccess={onSuccess}
                onError={onError}
                text={mode === 'login' ? 'signin_with' : 'signup_with'}
                shape="pill"
                size="large"
                width={btnWidth}
            />
        </div>
    );
}

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export default function AuthPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPass, setShowLoginPass] = useState(false);

    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showRegPass, setShowRegPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const emailLoginRef = useRef<HTMLInputElement>(null);
    const nameRegRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (mode === 'login') emailLoginRef.current?.focus();
            else nameRegRef.current?.focus();
        }, 150);
        return () => window.clearTimeout(timer);
    }, [mode]);

    const switchMode = (newMode: 'login' | 'register') => {
        setMode(newMode);
        setErrorMsg('');
        setSuccess(false);
        window.history.pushState(null, '', `/${newMode}`);
    };

    const getPostLoginPath = async (role: string) => {
        if (role === 'Admin') return '/admin';
        if (role === 'Staff') return '/staff';

        const activeSubscription = await subscriptionService.getMySubscription();
        return activeSubscription ? '/home' : '/subscription';
    };

    const persistAuth = (response: { accessToken: string; refreshToken?: string }) => {
        localStorage.setItem('token', response.accessToken);
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
    };

    const handleLoginSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const data: LoginData = { email: loginEmail, password: loginPassword };
            const response = await authService.login(data);
            persistAuth(response);
            navigate(await getPostLoginPath(response.role));
        } catch (error: any) {
            setErrorMsg(error.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!agreed) {
            setErrorMsg('Vui lòng đồng ý với Điều khoản & Chính sách.');
            return;
        }
        if (regPassword !== confirmPassword) {
            setErrorMsg('Mật khẩu xác nhận không khớp.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            const data: RegisterData = { fullName: regName, email: regEmail, password: regPassword };
            const response = await authService.register(data);
            persistAuth(response);
            setSuccess(true);
            window.setTimeout(() => navigate('/home'), 1000);
        } catch (error: any) {
            setErrorMsg(error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
            setLoading(false);
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
            persistAuth(response);
            navigate(await getPostLoginPath(response.role));
        } catch (error: any) {
            setErrorMsg(error.response?.data?.message || 'Đăng nhập Google thất bại.');
            setLoading(false);
        }
    };

    const handleGoogleLoginError = () => {
        setErrorMsg('Đăng nhập Google thất bại.');
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#050510] text-white antialiased selection:bg-indigo-500/35 selection:text-white">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_70%_-15%,rgba(99,102,241,0.18),transparent_55%)]" />
                <div className="absolute -top-40 left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/[0.14] blur-[150px]" />
                <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-fuchsia-500/[0.1] blur-[160px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:68px_68px] [mask-image:radial-gradient(circle_at_top_left,black_45%,transparent_80%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050510]/85" />
            </div>

            <main className="relative z-10 min-h-screen lg:grid lg:grid-cols-2 lg:items-start">
                {/* Cột trái: cùng nhịp dọc với form — không dùng justify-between (tránh headline bị kéo xuống giữa màn hình) */}
                <section className="relative hidden flex-col border-r border-white/[0.06] px-10 pb-12 pt-10 xl:px-14 xl:pb-14 xl:pt-12 before:pointer-events-none before:absolute before:right-0 before:top-[18%] before:z-0 before:h-[52%] before:w-px before:bg-gradient-to-b before:from-transparent before:via-indigo-400/35 before:to-transparent lg:flex">
                    <header className="relative z-10 flex min-h-[52px] shrink-0 items-center">
                        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
                            <img src="/logo.png" alt="StoryNest" className="h-11 w-11 rounded-xl object-contain shadow-[0_4px_22px_-8px_rgba(99,102,241,0.45)] ring-1 ring-white/10" />
                            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-black tracking-tight text-transparent">StoryNest</span>
                        </Link>
                    </header>

                    <div className="relative z-10 mt-6 flex max-w-xl flex-1 flex-col">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-gradient-to-r from-indigo-500/14 via-fuchsia-500/10 to-transparent px-4 py-2 text-sm font-bold text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
                            <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.45)]" />
                            Workspace RAG cho truyện dài
                        </div>
                        <h1 className="mt-8 text-balance text-5xl font-black leading-[1.05] tracking-tight xl:text-[3.35rem] xl:leading-[1.08]">
                            <span className="bg-gradient-to-br from-white via-[#ecebff] to-[#a5b4fc] bg-clip-text text-transparent">Đăng nhập vào </span>
                            <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">workspace của bạn.</span>
                        </h1>
                        <p className="mt-8 text-pretty text-lg leading-8 text-zinc-400">
                            Soạn thảo chương trong workspace, quản lý Story Bible, đồng bộ chunk/embed và xem báo cáo rubric — có chat RAG và phân tích, không có chế độ AI viết thay bạn.
                        </p>

                        <div className="mt-12 grid w-full max-w-xl grid-cols-3 gap-4">
                            <AuthMetric icon={Layers3} label="Context" value="Vector + Bible" />
                            <AuthMetric icon={BarChart3} label="Rubric" value="100 điểm" />
                            <AuthMetric icon={ShieldCheck} label="Mã hóa" value="AES-256" />
                        </div>

                        <div className="relative mt-auto max-w-xl overflow-hidden rounded-[2rem] border border-white/[0.1] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 pt-10 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.05] backdrop-blur-md">
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                            <div className="mb-4 flex items-center gap-3">
                                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/25 to-fuchsia-600/15 p-3 text-white shadow-[0_6px_24px_-10px_rgba(99,102,241,0.45)] ring-1 ring-white/10">
                                    <BrainCircuit className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-black">Ngữ cảnh đã đồng bộ</p>
                                    <p className="text-sm text-zinc-400">Chunk đã embed · lore · nhân vật</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                {['Soạn thảo', 'Chat RAG', 'Phân tích'].map((item) => (
                                <div key={item} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-3 text-xs font-black text-zinc-300 shadow-inner shadow-black/20 transition hover:border-indigo-500/25 hover:bg-white/[0.07]">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cột phải: căn giữa khối form trong nửa màn hình để không thừa khoảng trống một bên */}
                <section className="flex flex-col px-5 pb-14 pt-10 lg:px-8 xl:px-12 xl:pb-14 xl:pt-12 lg:items-center">
                    <div className="w-full max-w-lg xl:max-w-xl">
                        <div className="mb-8 flex min-h-[52px] items-center lg:mb-6 lg:hidden">
                            <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
                                <img src="/logo.png" alt="StoryNest" className="h-10 w-10 rounded-lg object-contain ring-1 ring-white/10 shadow-[0_4px_18px_-8px_rgba(99,102,241,0.35)]" />
                                <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-xl font-black text-transparent">StoryNest</span>
                            </Link>
                        </div>

                        <div
                            className="mb-6 flex min-h-[52px] w-full items-center rounded-2xl border border-white/[0.09] bg-black/25 p-1 shadow-inner shadow-black/40 ring-1 ring-white/[0.05]"
                            role="tablist"
                            aria-label="Chế độ đăng nhập"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'login'}
                                onClick={() => switchMode('login')}
                                className={`min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-black transition-all duration-200 ${mode === 'login' ? 'bg-white text-[#070711] shadow-[0_6px_28px_-8px_rgba(255,255,255,0.35)]' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}
                            >
                                Đăng nhập
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'register'}
                                onClick={() => switchMode('register')}
                                className={`min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-black transition-all duration-200 ${mode === 'register' ? 'bg-white text-[#070711] shadow-[0_6px_28px_-8px_rgba(255,255,255,0.35)]' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}
                            >
                                Đăng ký
                            </button>
                        </div>

                        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/[0.1] bg-gradient-to-b from-[#16162c]/95 to-[#0c0c18]/98 p-6 shadow-[0_28px_80px_-32px_rgba(0,0,0,0.72)] ring-1 ring-white/[0.06] backdrop-blur-2xl sm:p-8">
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
                            <div className="relative z-10">
                            {success ? (
                                <SuccessState />
                            ) : (
                                <>
                                    <div className="mb-8">
                                        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/15 bg-indigo-500/12 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {mode === 'login' ? 'Welcome back' : 'Create account'}
                                        </p>
                                        <h2 className="text-balance bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                                            {mode === 'login' ? 'Chào mừng trở lại.' : 'Tạo workspace mới.'}
                                        </h2>
                                        <p className="mt-3 text-pretty text-sm leading-6 text-zinc-400">
                                            {mode === 'login'
                                                ? 'Tiếp tục soạn thảo, chat RAG, xem phân tích rubric và Story Bible trong dự án của bạn.'
                                                : 'Tạo tài khoản để soạn chương, nhúng vector và chạy báo cáo — không có AI viết hộ nội dung.'}
                                        </p>
                                    </div>

                                    {errorMsg && (
                                        <div className="mb-5 rounded-2xl border border-rose-400/25 bg-gradient-to-r from-rose-500/15 to-transparent px-4 py-3 text-sm font-semibold text-rose-100 shadow-inner shadow-black/20">
                                            {errorMsg}
                                        </div>
                                    )}

                                    {mode === 'login' ? (
                                        <LoginForm
                                            emailRef={emailLoginRef}
                                            email={loginEmail}
                                            password={loginPassword}
                                            showPassword={showLoginPass}
                                            loading={loading}
                                            onEmailChange={(value) => { setLoginEmail(value); setErrorMsg(''); }}
                                            onPasswordChange={(value) => { setLoginPassword(value); setErrorMsg(''); }}
                                            onTogglePassword={() => setShowLoginPass((value) => !value)}
                                            onSubmit={handleLoginSubmit}
                                        />
                                    ) : (
                                        <RegisterForm
                                            nameRef={nameRegRef}
                                            name={regName}
                                            email={regEmail}
                                            password={regPassword}
                                            confirmPassword={confirmPassword}
                                            showPassword={showRegPass}
                                            showConfirmPassword={showConfirmPass}
                                            agreed={agreed}
                                            loading={loading}
                                            onNameChange={(value) => { setRegName(value); setErrorMsg(''); }}
                                            onEmailChange={(value) => { setRegEmail(value); setErrorMsg(''); }}
                                            onPasswordChange={(value) => { setRegPassword(value); setErrorMsg(''); }}
                                            onConfirmPasswordChange={(value) => { setConfirmPassword(value); setErrorMsg(''); }}
                                            onTogglePassword={() => setShowRegPass((value) => !value)}
                                            onToggleConfirmPassword={() => setShowConfirmPass((value) => !value)}
                                            onAgreedChange={() => setAgreed((value) => !value)}
                                            onSubmit={handleRegisterSubmit}
                                        />
                                    )}

                                    <div className="my-7 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-white/10" />
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">hoặc</span>
                                        <div className="h-px flex-1 bg-white/10" />
                                    </div>

                                    <div className="flex justify-center">
                                        {googleClientId ? (
                                            <GoogleLoginSized
                                                mode={mode}
                                                onSuccess={handleGoogleLoginSuccess}
                                                onError={handleGoogleLoginError}
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setErrorMsg('Thiếu cấu hình VITE_GOOGLE_CLIENT_ID cho đăng nhập Google.')}
                                                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                                            >
                                                <GoogleIcon />
                                                Tiếp tục với Google
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                            </div>
                        </div>

                        <p className="mt-6 text-center text-sm text-zinc-500">
                            {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
                            <button
                                type="button"
                                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                className="font-black text-white hover:text-indigo-200"
                            >
                                {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
                            </button>
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}

function LoginForm(props: {
    emailRef: React.RefObject<HTMLInputElement | null>;
    email: string;
    password: string;
    showPassword: boolean;
    loading: boolean;
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onTogglePassword: () => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    return (
        <form onSubmit={props.onSubmit} className="space-y-4">
            <Field
                ref={props.emailRef}
                icon={Mail}
                label="Email"
                type="email"
                value={props.email}
                placeholder="you@example.com"
                onChange={props.onEmailChange}
                autoComplete="email"
                required
            />
            <PasswordField
                icon={Lock}
                label="Mật khẩu"
                value={props.password}
                placeholder="Nhập mật khẩu"
                show={props.showPassword}
                onChange={props.onPasswordChange}
                onToggle={props.onTogglePassword}
                autoComplete="current-password"
            />
            <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-bold text-indigo-200 hover:text-white">
                    Quên mật khẩu?
                </Link>
            </div>
            <SubmitButton loading={props.loading} label="Đăng nhập" loadingLabel="Đang đăng nhập..." />
        </form>
    );
}

function RegisterForm(props: {
    nameRef: React.RefObject<HTMLInputElement | null>;
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    showPassword: boolean;
    showConfirmPassword: boolean;
    agreed: boolean;
    loading: boolean;
    onNameChange: (value: string) => void;
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onTogglePassword: () => void;
    onToggleConfirmPassword: () => void;
    onAgreedChange: () => void;
    onSubmit: (event: React.FormEvent) => void;
}) {
    return (
        <form onSubmit={props.onSubmit} className="space-y-4">
            <Field
                ref={props.nameRef}
                icon={User}
                label="Tên hiển thị"
                type="text"
                value={props.name}
                placeholder="Nguyễn An"
                onChange={props.onNameChange}
                autoComplete="name"
                required
            />
            <Field
                icon={Mail}
                label="Email"
                type="email"
                value={props.email}
                placeholder="you@example.com"
                onChange={props.onEmailChange}
                autoComplete="email"
                required
            />
            <PasswordField
                icon={Lock}
                label="Mật khẩu"
                value={props.password}
                placeholder="Tối thiểu 6 ký tự"
                show={props.showPassword}
                onChange={props.onPasswordChange}
                onToggle={props.onTogglePassword}
                autoComplete="new-password"
            />
            <PasswordField
                icon={Lock}
                label="Xác nhận mật khẩu"
                value={props.confirmPassword}
                placeholder="Nhập lại mật khẩu"
                show={props.showConfirmPassword}
                onChange={props.onConfirmPasswordChange}
                onToggle={props.onToggleConfirmPassword}
                autoComplete="new-password"
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-4 text-sm leading-6 text-zinc-400 shadow-inner shadow-black/20 transition hover:border-white/15">
                <input
                    type="checkbox"
                    checked={props.agreed}
                    onChange={props.onAgreedChange}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-indigo-500 focus:ring-indigo-500"
                />
                <span>
                    Tôi đồng ý với{' '}
                    <Link to="/privacy" className="font-bold text-white hover:text-indigo-200">
                        Điều khoản và Chính sách bảo mật
                    </Link>
                    .
                </span>
            </label>
            <SubmitButton loading={props.loading} label="Tạo tài khoản" loadingLabel="Đang tạo tài khoản..." />
        </form>
    );
}

const Field = forwardRef(function Field(
    {
        icon: Icon,
        label,
        value,
        onChange,
        ...props
    }: {
        icon: typeof Mail;
        label: string;
        value: string;
        onChange: (value: string) => void;
    } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>,
    ref: React.Ref<HTMLInputElement>,
) {
    return (
        <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</label>
            <div className="relative">
                <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                    {...props}
                    ref={ref}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-h-[52px] w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-12 py-4 font-semibold text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/45 focus:bg-white/[0.08] focus:ring-[3px] focus:ring-fuchsia-500/15"
                />
            </div>
        </div>
    );
});

function PasswordField(props: {
    icon: typeof Lock;
    label: string;
    value: string;
    placeholder: string;
    show: boolean;
    onChange: (value: string) => void;
    onToggle: () => void;
    autoComplete: string;
}) {
    return (
        <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{props.label}</label>
            <div className="relative">
                <props.icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                    type={props.show ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={props.value}
                    placeholder={props.placeholder}
                    autoComplete={props.autoComplete}
                    onChange={(event) => props.onChange(event.target.value)}
                    className="min-h-[52px] w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-12 py-4 pr-14 font-semibold text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/45 focus:bg-white/[0.08] focus:ring-[3px] focus:ring-fuchsia-500/15"
                />
                <button
                    type="button"
                    onClick={props.onToggle}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-white"
                    aria-label={props.show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                    {props.show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
        </div>
    );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 font-black text-white shadow-[0_14px_44px_-14px_rgba(139,92,246,0.65)] transition hover:-translate-y-0.5 hover:brightness-[1.05] hover:shadow-[0_18px_52px_-14px_rgba(217,70,239,0.45)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:brightness-100"
        >
            {loading ? (
                <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {loadingLabel}
                </>
            ) : (
                <>
                    {label}
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </>
            )}
        </button>
    );
}

function SuccessState() {
    return (
        <div className="py-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-emerald-400/25 to-cyan-600/15 text-emerald-200 shadow-[0_12px_36px_-14px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/25">
                <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black">Tài khoản đã sẵn sàng.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Đang chuyển bạn tới workspace...</p>
        </div>
    );
}

function AuthMetric({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: string }) {
    return (
        <div className="rounded-3xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 shadow-[0_12px_36px_-22px_rgba(0,0,0,0.45)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-[0_16px_40px_-20px_rgba(99,102,241,0.25)]">
            <Icon className="mb-4 h-5 w-5 text-indigo-200 drop-shadow-[0_0_10px_rgba(165,180,252,0.35)]" />
            <div className="bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-xl font-black text-transparent">{value}</div>
            <div className="mt-1 text-xs font-black uppercase tracking-wide text-zinc-500">{label}</div>
        </div>
    );
}
