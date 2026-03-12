import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { authService } from '../services/authService';

export default function ResetPasswordPage() {
    const [searchParams]              = useSearchParams();
    const navigate                    = useNavigate();
    const token                       = searchParams.get('token') ?? '';

    const [password, setPassword]     = useState('');
    const [confirm, setConfirm]       = useState('');
    const [showPass, setShowPass]     = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading]       = useState(false);
    const [success, setSuccess]       = useState(false);
    const [error, setError]           = useState('');

    useEffect(() => {
        if (!token) navigate('/forgot-password');
    }, [token, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
        setLoading(true);
        setError('');
        try {
            await authService.resetPassword({ token, newPassword: password });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(msg ?? 'Token không hợp lệ hoặc đã hết hạn.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
            <div className="w-full max-w-md">
                <Link to="/login"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại đăng nhập
                </Link>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <div className="p-8">
                        {success ? (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Đặt lại thành công!</h2>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                    Mật khẩu mới đã được lưu. Đang chuyển đến trang đăng nhập…
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-7">
                                    <div className="w-12 h-12 mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Đặt lại mật khẩu</h1>
                                    <p className="text-sm text-[var(--text-secondary)]">Nhập mật khẩu mới cho tài khoản của bạn.</p>
                                </div>

                                {!token && (
                                    <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2.5 mb-5">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        Token không hợp lệ. Vui lòng yêu cầu lại.
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* New password */}
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                                            Mật khẩu mới
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50 pointer-events-none" />
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                required minLength={6}
                                                autoFocus
                                                value={password}
                                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                                placeholder="Tối thiểu 6 ký tự"
                                                className="w-full h-11 bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none transition-all"
                                            />
                                            <button type="button" onClick={() => setShowPass(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors">
                                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm password */}
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                                            Xác nhận mật khẩu
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50 pointer-events-none" />
                                            <input
                                                type={showConfirm ? 'text' : 'password'}
                                                required minLength={6}
                                                value={confirm}
                                                onChange={e => { setConfirm(e.target.value); setError(''); }}
                                                placeholder="Nhập lại mật khẩu"
                                                className="w-full h-11 bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none transition-all"
                                            />
                                            <button type="button" onClick={() => setShowConfirm(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors">
                                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !token}
                                        className="w-full h-11 mt-1 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        {loading
                                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : 'Đặt lại mật khẩu'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
