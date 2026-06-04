import { useState, useEffect, useRef } from 'react';
import {
    Mail, Shield, Calendar, Edit3, Save, CheckCircle, Camera, User, X, KeyRound, RefreshCw
} from 'lucide-react';
import { userService, UserProfile } from '../services/userService';
import { authService } from '../services/authService';
import { getInitials, UserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';

function getRoleBadge(role: string) {
    if (role === 'Admin') return { label: 'Admin', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' };
    if (role === 'Staff') return { label: 'Staff', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { label: 'Author', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' };
}
function getRoleLabel(role: string) {
    return { Admin: 'Quản trị viên', Staff: 'Nhân viên', Author: 'Tác giả' }[role] ?? role;
}

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
        if (passData.oldPassword === passData.newPassword) {
            setMsg({ type: 'error', text: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' });
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

// ── Profile Content ───────────────────────────────────────────────────────────
function ProfileContent({ jwtRole }: { jwtRole: string }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [showPassModal, setShowPassModal] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getFullUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        const base = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7259/api';
        const cleanBase = base.endsWith('/api') ? base.slice(0, -4) : base;
        return `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setError('Dung lượng ảnh tối đa là 5MB.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const url = await userService.uploadAvatar(file);
            setAvatarUrl(url);
            setSuccess('Tải ảnh lên thành công! Nhấp Lưu để cập nhật hồ sơ.');
            setTimeout(() => setSuccess(''), 3000);
        } catch {
            setError('Tải ảnh đại diện thất bại. Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const data = await userService.getProfile();
                setProfile(data);
                setFullName(data.fullName);
                setAvatarUrl(data.avatarURL ?? '');
            } catch { setError('Không thể tải thông tin người dùng.'); }
            finally { setLoading(false); }
        })();
    }, []);

    const handleSave = async () => {
        if (!fullName.trim()) { setError('Họ và tên không được để trống.'); return; }
        try {
            setSaving(true); setError('');
            const updated = await userService.updateProfile({ fullName: fullName.trim(), avatarURL: avatarUrl || undefined });
            setProfile(updated);
            setEditing(false);
            window.dispatchEvent(new CustomEvent('profile-updated', {
                detail: {
                    fullName: updated.fullName,
                    avatarUrl: updated.avatarURL ?? avatarUrl,
                },
            }));
            setSuccess('Cập nhật thành công!');
            setTimeout(() => setSuccess(''), 3000);
        } catch { setError('Cập nhật thất bại. Vui lòng thử lại.'); }
        finally { setSaving(false); }
    };

    const badge = getRoleBadge(profile?.role ?? jwtRole);

    if (loading) return (
        <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#f5a623] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)] text-sm">Đang tải...</p>
            </div>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Alerts */}
                {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                        <X className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" /> {success}
                    </div>
                )}

                {/* Avatar card */}
                <div className="rounded-3xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    {/* Header bar - Increased height to prevent clipping */}
                    <div className="h-32 relative" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)' }}>
                        <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                    </div>

                    <div className="px-6 pb-6 pt-2">
                        {/* Avatar - Adjusted overlap and vertical space */}
                        <div className="flex items-end gap-5 -mt-12 mb-6">
                            <div className="relative">
                                {profile?.avatarURL || avatarUrl ? (
                                    <img src={getFullUrl(avatarUrl || profile?.avatarURL)} alt="Avatar"
                                        className="w-24 h-24 rounded-2xl object-cover"
                                        style={{ outline: '4px solid var(--bg-surface)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }} />
                                ) : (
                                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', outline: '4px solid var(--bg-surface)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}>
                                        {profile ? getInitials(profile.fullName) : '?'}
                                    </div>
                                )}
                                {editing && (
                                    <>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleAvatarChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-[#f5a623] flex items-center justify-center shadow-lg hover:bg-[#f97316] transition-colors border-2 border-[var(--bg-surface)]"
                                        >
                                            <Camera className="w-4 h-4 text-white" />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="relative">
                                <p className="text-[var(--text-primary)] font-bold text-xl leading-tight mb-1">{profile?.fullName}</p>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${badge.bg} ${badge.text} ${badge.border}`}>
                                        {getRoleLabel(profile?.role ?? jwtRole)}
                                    </span>
                                </div>
                            </div>
                            <div className="ml-auto mb-1">
                                {!editing ? (
                                    <button onClick={() => setEditing(true)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all">
                                        <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditing(false); setFullName(profile?.fullName ?? ''); setAvatarUrl(profile?.avatarURL ?? ''); setError(''); }}
                                            disabled={saving}
                                            className="px-4 py-2 rounded-xl text-sm text-[var(--text-secondary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all">
                                            Huỷ
                                        </button>
                                        <button onClick={handleSave} disabled={saving}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                                            style={{ background: 'linear-gradient(135deg,#f5a623,#f97316)' }}>
                                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            {saving ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info card */}
                <div className="rounded-3xl p-6 space-y-5 bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    <h3 className="text-[var(--text-primary)] font-semibold text-sm">Thông tin cá nhân</h3>

                    {/* Full Name */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <User className="w-3 h-3" /> Họ và Tên
                        </label>
                        {editing ? (
                            <input type="text" value={fullName} autoFocus
                                onChange={e => { setFullName(e.target.value); setError(''); }}
                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-[#f5a623]/50 focus:ring-2 focus:ring-[#f5a623]/20 rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none transition-all"
                                placeholder="Nhập họ và tên..." />
                        ) : (
                            <p className="text-[var(--text-primary)] font-medium">{profile?.fullName}</p>
                        )}
                    </div>

                    {/* Avatar URL */}
                    {editing && (
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                                <Camera className="w-3 h-3" /> URL Ảnh đại diện
                            </label>
                            <input type="url" value={avatarUrl}
                                onChange={e => setAvatarUrl(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] focus:border-[#f5a623]/50 focus:ring-2 focus:ring-[#f5a623]/20 rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm placeholder-[var(--text-secondary)]/50 outline-none transition-all"
                                placeholder="https://..." />
                        </div>
                    )}

                    {/* Divider */}
                    <div className="h-px bg-white/5" />

                    {/* Email */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Mail className="w-3 h-3" /> Email
                        </label>
                        <p className="text-[var(--text-secondary)] text-sm">{profile?.email}</p>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Shield className="w-3 h-3" /> Vai trò
                        </label>
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-lg border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                            {getRoleLabel(profile?.role ?? jwtRole)}
                        </span>
                    </div>

                    {/* Security */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <KeyRound className="w-3 h-3" /> Bảo mật
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPassModal(true)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] transition-all"
                        >
                            Đổi mật khẩu
                        </button>
                    </div>

                    {/* Joined */}
                    <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                            <Calendar className="w-3 h-3" /> Ngày tham gia
                        </label>
                        <p className="text-[var(--text-secondary)] text-sm">
                            {profile?.createdAt
                                ? new Date(profile.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>
            {showPassModal && <PasswordModal onClose={() => setShowPassModal(false)} />}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
    return (
        <MainLayout pageTitle="Hồ sơ cá nhân">
            {(userInfo: UserInfo) => (
                <ProfileContent jwtRole={userInfo.role} />
            )}
        </MainLayout>
    );
}
