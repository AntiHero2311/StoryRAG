import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, Sun, Moon, CheckCircle, RefreshCw, Save, ChevronRight, KeyRound, ShieldCheck
} from 'lucide-react';
import { authService } from '../services/authService';
import { getInitials, UserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';

// ── Password strength ────────────────────────────────────────────────────────
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

// ── Modals ───────────────────────────────────────────────────────────────────
function PasswordModal({ onClose }: { onClose: () => void }) {
    const [passData, setPassData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passData.newPassword.length < 6) {
            setMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            return;
        }
        if (passData.newPassword !== passData.confirmPassword) {
            setMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }
        try {
            setSaving(true);
            setMsg({ type: '', text: '' });
            await authService.changePassword({ oldPassword: passData.oldPassword, newPassword: passData.newPassword });
            setMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
            setTimeout(onClose, 2000);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.Message || 'Đổi mật khẩu thất bại.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between">
                    <h3 className="text-[var(--text-primary)] font-bold text-lg">Đổi mật khẩu</h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--text-primary)]/5 text-[var(--text-secondary)]">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {msg.text && (
                        <div className={`p-4 rounded-2xl text-sm flex items-center gap-3 border ${msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {msg.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
                            {msg.text}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                        <input type="password" required value={passData.oldPassword} onChange={e => setPassData({ ...passData, oldPassword: e.target.value })}
                            className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[#f5a623]/50 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Mật khẩu mới</label>
                        <input type="password" required minLength={6} value={passData.newPassword} onChange={e => { setPassData({ ...passData, newPassword: e.target.value }); setMsg({ type: '', text: '' }); }}
                            className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[#f5a623]/50 transition-all" />
                        {passData.newPassword.length > 0 && (() => {
                            const st = getStrength(passData.newPassword);
                            return (
                                <div className="mt-1.5 space-y-1">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                                                style={{ backgroundColor: n <= st.score ? st.color : 'rgba(255,255,255,0.08)' }} />
                                        ))}
                                    </div>
                                    <p className="text-xs" style={{ color: st.color }}>{st.label}</p>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                        <input type="password" required minLength={6} value={passData.confirmPassword} onChange={e => { setPassData({ ...passData, confirmPassword: e.target.value }); setMsg({ type: '', text: '' }); }}
                            className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[#f5a623]/50 transition-all" />
                        {passData.confirmPassword.length > 0 && passData.confirmPassword !== passData.newPassword && (
                            <p className="text-xs text-rose-400 mt-1 ml-1">Mật khẩu không khớp.</p>
                        )}
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--text-primary)]/5 transition-all">
                            Hủy
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#f5a623] hover:bg-[#d98c1d] text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50">
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Đang lưu...' : 'Thay đổi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Settings Page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
    return (
        <MainLayout pageTitle="Cài đặt hệ thống">
            {(userInfo: UserInfo) => (
                <SettingsContent userInfo={userInfo} />
            )}
        </MainLayout>
    );
}

function SettingsContent({ userInfo }: { userInfo: UserInfo }) {
    const navigate = useNavigate();
    // Read current theme from the actual <html> class, not localStorage
    // This avoids forcing a theme change just by visiting Settings
    const [theme, setTheme] = useState<string>(() =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    const [showPassModal, setShowPassModal] = useState(false);

    const toggleTheme = (newTheme: string) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="mb-10 text-center md:text-left">
                    <h2 className="text-[var(--text-primary)] font-bold text-3xl mb-2">Cấu hình tài khoản</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Quản lý các thiết lập cá nhân và bảo mật của bạn.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Theme Section */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                <Sun size={20} className={theme === 'light' ? 'block' : 'hidden'} />
                                <Moon size={20} className={theme === 'dark' ? 'block' : 'hidden'} />
                            </div>
                            <div>
                                <h3 className="text-[var(--text-primary)] font-bold text-base">Giao diện</h3>
                                <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider font-bold">Chế độ hiển thị</p>
                            </div>
                        </div>
                        <div className="flex p-1.5 bg-[var(--input-bg)] rounded-2xl border border-[var(--border-color)]">
                            <button onClick={() => toggleTheme('dark')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${theme === 'dark' ? 'bg-[var(--bg-surface)] shadow-md text-[#f5a623]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                <Moon size={16} />
                                <span className="font-bold text-xs">Tối</span>
                            </button>
                            <button onClick={() => toggleTheme('light')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${theme === 'light' ? 'bg-[var(--bg-surface)] shadow-md text-indigo-500' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                <Sun size={16} />
                                <span className="font-bold text-xs">Sáng</span>
                            </button>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-[#f5a623]">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h3 className="text-[var(--text-primary)] font-bold text-base">Bảo mật</h3>
                                <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider font-bold">Mật khẩu & Quyền</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button onClick={() => setShowPassModal(true)}
                                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[#f5a623]/30 transition-all group">
                                <div className="flex items-center gap-3">
                                    <KeyRound size={18} className="text-[#f5a623]" />
                                    <span className="text-[var(--text-primary)] text-sm font-medium">Thay đổi mật khẩu</span>
                                </div>
                                <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="md:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                                {getInitials(userInfo.fullName)}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-[var(--text-primary)] font-bold text-xl mb-1">{userInfo.fullName}</h3>
                                <p className="text-[var(--text-secondary)] text-sm mb-4">Bạn đang đăng nhập với tư cách là <span className="text-[#f5a623] font-bold uppercase">{userInfo.role}</span></p>
                                <button onClick={() => navigate('/profile')} className="px-5 py-2 rounded-xl bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 text-[var(--text-primary)] text-xs font-bold transition-all border border-[var(--border-color)]">
                                    Chỉnh sửa hồ sơ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showPassModal && <PasswordModal onClose={() => setShowPassModal(false)} />}
        </div>
    );
}
