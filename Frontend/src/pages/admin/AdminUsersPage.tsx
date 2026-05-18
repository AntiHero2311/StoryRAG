import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { adminService, type UserSummary, type UserStatsResponse } from '../../services/adminService';
import { AdminPageShell, roleStyle, roleLabel } from '../../components/admin/AdminShared';
import UserFormModal, { type UserFormState } from '../../components/admin/UserFormModal';

type SortKey = 'fullName' | 'email' | 'role' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function AdminUsersPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<UserStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [userModal, setUserModal] = useState<'create' | 'edit' | null>(null);
    const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
    const [userSaving, setUserSaving] = useState(false);
    const [userFormError, setUserFormError] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            setStats(await adminService.getUserStats());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        void load();
    }, [navigate]);

    const apiMessage = (err: unknown) => {
        const e = err as { response?: { data?: { message?: string; Message?: string } } };
        return e?.response?.data?.message ?? e?.response?.data?.Message ?? 'Lỗi.';
    };

    const filtered = (stats?.users ?? [])
        .filter(u => {
            const q = search.toLowerCase();
            return (u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                && (roleFilter === 'all' || u.role === roleFilter);
        })
        .sort((a, b) => {
            const av = String(a[sortKey]), bv = String(b[sortKey]);
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const handleSaveUser = async (form: UserFormState) => {
        setUserSaving(true);
        setUserFormError('');
        try {
            if (userModal === 'create') {
                if (form.password.length < 6) { setUserFormError('Mật khẩu tối thiểu 6 ký tự.'); return; }
                await adminService.createUser({
                    fullName: form.fullName.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    role: form.role,
                });
            } else if (editingUser) {
                await adminService.updateUser(editingUser.id, {
                    fullName: form.fullName.trim(),
                    email: form.email.trim(),
                    role: form.role,
                    isActive: form.isActive,
                    newPassword: form.newPassword.trim() || undefined,
                });
            }
            setUserModal(null);
            setEditingUser(null);
            await load();
        } catch (err: unknown) {
            setUserFormError(apiMessage(err));
        } finally {
            setUserSaving(false);
        }
    };

    const toggleActive = async (user: UserSummary) => {
        setTogglingId(user.id);
        try {
            await adminService.setUserActive(user.id, !user.isActive);
            await load();
        } catch (err: unknown) {
            alert(apiMessage(err));
        } finally {
            setTogglingId(null);
        }
    };

    const SortIcon = ({ col }: { col: SortKey }) =>
        sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />)
            : null;

    return (
        <MainLayout pageTitle="Người dùng">
            {() => (
                <AdminPageShell
                    title="Quản lý người dùng"
                    subtitle={`${stats?.totalUsers ?? 0} tài khoản · ${stats?.activeUsers ?? 0} đang hoạt động`}
                    action={
                        <div className="flex gap-2">
                            <button type="button" onClick={() => void load()} className="p-2 rounded-xl border border-[var(--border-color)]"><RefreshCw className="w-4 h-4" /></button>
                            <button type="button" onClick={() => { setEditingUser(null); setUserFormError(''); setUserModal('create'); }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
                                <Plus className="w-4 h-4" /> Thêm user
                            </button>
                        </div>
                    }
                >
                    {userModal && (
                        <UserFormModal
                            mode={userModal}
                            user={editingUser}
                            saving={userSaving}
                            error={userFormError}
                            onClose={() => { setUserModal(null); setEditingUser(null); }}
                            onSave={form => void handleSaveUser(form)}
                        />
                    )}

                    <div className="flex flex-wrap gap-2">
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                            className="rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm">
                            <option value="all">Tất cả role</option>
                            <option value="Author">Tác giả</option>
                            <option value="Staff">Staff</option>
                            <option value="Admin">Admin</option>
                        </select>
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, email…"
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] text-sm" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-surface)]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)] text-xs uppercase">
                                        {(['fullName', 'email', 'role', 'createdAt'] as SortKey[]).map(col => (
                                            <th key={col} className="text-left px-4 py-3 cursor-pointer" onClick={() => handleSort(col)}>
                                                {{ fullName: 'Tên', email: 'Email', role: 'Role', createdAt: 'Ngày tạo' }[col]}
                                                <SortIcon col={col} />
                                            </th>
                                        ))}
                                        <th className="text-left px-4 py-3">Trạng thái</th>
                                        <th className="text-right px-4 py-3">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {filtered.map(user => (
                                        <tr key={user.id} className="hover:bg-[var(--text-primary)]/5">
                                            <td className="px-4 py-3 font-medium">{user.fullName}</td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)]">{user.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs border ${roleStyle(user.role)}`}>{roleLabel(user.role)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                                                {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button type="button" disabled={togglingId === user.id}
                                                    onClick={() => void toggleActive(user)}
                                                    className={`text-xs font-semibold px-2 py-1 rounded-lg ${user.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                                                    {togglingId === user.id ? '…' : user.isActive ? 'Hoạt động' : 'Đã khoá'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <button type="button" onClick={() => { setEditingUser(user); setUserModal('edit'); }} className="p-2 rounded-lg hover:bg-indigo-500/20 text-indigo-400"><Pencil className="w-4 h-4" /></button>
                                                    <button type="button" onClick={async () => {
                                                        if (!window.confirm(`Xoá/khoá ${user.fullName}?`)) return;
                                                        try { await adminService.deleteUser(user.id); await load(); } catch (e) { alert(apiMessage(e)); }
                                                    }} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AdminPageShell>
            )}
        </MainLayout>
    );
}
