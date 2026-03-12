import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
    const [email, setEmail]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [sent, setSent]         = useState(false);
    const [error, setError]       = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await authService.forgotPassword({ email });
            setSent(true);
        } catch {
            setError('Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
            <div className="w-full max-w-md">
                {/* Back link */}
                <Link to="/login"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại đăng nhập
                </Link>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl">
                    {/* Top gradient bar */}
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <div className="p-8">
                        {sent ? (
                            /* Success state */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Email đã được gửi!</h2>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                                    Nếu email <strong className="text-[var(--text-primary)]">{email}</strong> tồn tại trong hệ thống,
                                    bạn sẽ nhận được link đặt lại mật khẩu trong vài phút.
                                </p>
                                <p className="text-xs text-[var(--text-secondary)]/60">
                                    Không thấy email? Kiểm tra thư mục Spam.
                                </p>
                            </div>
                        ) : (
                            /* Form state */
                            <>
                                <div className="mb-7">
                                    <div className="w-12 h-12 mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                        <Mail className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Quên mật khẩu?</h1>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                        Nhập email của bạn và chúng tôi sẽ gửi link để đặt lại mật khẩu.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                                            Địa chỉ email
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/50 pointer-events-none" />
                                            <input
                                                type="email"
                                                required
                                                autoFocus
                                                value={email}
                                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                                placeholder="name@example.com"
                                                className="w-full h-11 bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-indigo-400/40 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-11 rounded-xl font-semibold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        {loading
                                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <><Send className="w-4 h-4" /> Gửi link đặt lại</>}
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
