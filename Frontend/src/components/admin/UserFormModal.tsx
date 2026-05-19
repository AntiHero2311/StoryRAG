import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { UserSummary } from '../../services/adminService';

export type UserFormState = {
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    password: string;
    newPassword: string;
};

const emptyForm = (): UserFormState => ({
    fullName: '', email: '', role: 'Author', isActive: true, password: '', newPassword: '',
});

export default function UserFormModal({
    mode, user, saving, error, onClose, onSave,
}: {
    mode: 'create' | 'edit';
    user: UserSummary | null;
    saving: boolean;
    error: string;
    onClose: () => void;
    onSave: (form: UserFormState) => void;
}) {
    const [form, setForm] = useState<UserFormState>(() =>
        user
            ? { fullName: user.fullName, email: user.email, role: user.role, isActive: user.isActive, password: '', newPassword: '' }
            : emptyForm(),
    );

    const set = (key: keyof UserFormState, value: string | boolean) =>
        setForm(f => ({ ...f, [key]: value }));

    const inputCls = 'w-full rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{mode === 'create' ? 'Thêm người dùng' : 'Sửa người dùng'}</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--text-primary)]/10"><X className="w-5 h-5" /></button>
                </div>
                {error && <p className="text-sm text-rose-400">{error}</p>}
                <div className="space-y-3">
                    <input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Họ tên" className={inputCls} />
                    <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" type="email" className={inputCls} />
                    <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
                        <option value="Author">Tác giả</option>
                        <option value="Staff">Nhân viên</option>
                        <option value="Admin">Admin</option>
                    </select>
                    {mode === 'create' ? (
                        <input value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mật khẩu (tối thiểu 6 ký tự)" type="password" className={inputCls} />
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                                <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="rounded" />
                                Tài khoản đang hoạt động
                            </label>
                            <input value={form.newPassword} onChange={e => set('newPassword', e.target.value)} placeholder="Mật khẩu mới (để trống nếu không đổi)" type="password" className={inputCls} />
                        </>
                    )}
                </div>
                <div className="flex gap-2 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-semibold">Huỷ</button>
                    <button type="button" disabled={saving} onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {mode === 'create' ? 'Tạo' : 'Lưu'}
                    </button>
                </div>
            </div>
        </div>
    );
}
