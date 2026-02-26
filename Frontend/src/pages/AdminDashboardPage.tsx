import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, UserX, Shield, BookOpen, Briefcase,
    ArrowLeft, RefreshCw, Search, ChevronUp, ChevronDown
} from 'lucide-react';
import { adminService, UserSummary, UserStatsResponse } from '../services/adminService';

type SortKey = 'fullName' | 'email' | 'role' | 'createdAt';
type SortDir = 'asc' | 'desc';

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className={`flex items-center gap-4 p-5 rounded-2xl border ${color} backdrop-blur-sm`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--text-primary)]/5 shrink-0">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
                <p className="text-3xl font-bold">{value.toLocaleString()}</p>
            </div>
        </div>
    );
}

const roleStyle = (role: string) => {
    if (role === 'Admin') return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (role === 'Staff') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
};

const roleLabel = (role: string) => {
    const map: Record<string, string> = { Admin: 'Admin', Author: 'Tác giả', Staff: 'Nhân viên' };
    return map[role] ?? role;
};

export default function AdminDashboardPage() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const [stats, setStats] = useState<UserStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await adminService.getUserStats();
            setStats(data);
        } catch {
            setError('Không có quyền truy cập hoặc không kết nối được server.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const filtered = (stats?.users ?? [])
        .filter(u => {
            const q = search.toLowerCase();
            const matchSearch = u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
            const matchRole = roleFilter === 'all' || u.role === roleFilter;
            return matchSearch && matchRole;
        })
        .sort((a, b) => {
            let av: string = String(a[sortKey]);
            let bv: string = String(b[sortKey]);
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });

    const SortIcon = ({ col }: { col: SortKey }) => (
        sortKey === col
            ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />)
            : <ChevronDown className="w-3.5 h-3.5 inline ml-1 opacity-20" />
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--text-secondary)] text-sm">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
            {/* Ambient */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/15 blur-[140px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="border-b border-[var(--border-color)] bg-[var(--bg-topbar)] backdrop-blur-xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/home')}
                        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-none">Admin Dashboard</h1>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Quản lý người dùng</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={fetchStats}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Làm mới
                </button>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {error && (
                    <div className="px-5 py-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Stat Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard icon={Users} label="Tổng Users" value={stats.totalUsers} color="border-[var(--border-color)] text-[var(--text-primary)]" />
                        <StatCard icon={UserCheck} label="Đang hoạt động" value={stats.activeUsers} color="border-emerald-500/20 text-emerald-400" />
                        <StatCard icon={UserX} label="Tạm khoá" value={stats.inactiveUsers} color="border-rose-500/20 text-rose-400" />
                        <StatCard icon={BookOpen} label="Tác giả" value={stats.totalAuthors} color="border-indigo-500/20 text-indigo-400" />
                        <StatCard icon={Briefcase} label="Nhân viên" value={stats.totalStaff} color="border-amber-500/20 text-amber-400" />
                        <StatCard icon={Shield} label="Admin" value={stats.totalAdmins} color="border-rose-500/20 text-rose-400" />
                    </div>
                )}

                {/* User Table */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden">
                    {/* Table toolbar */}
                    <div className="px-6 py-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="font-semibold text-sm text-[var(--text-secondary)]">
                            Danh sách người dùng
                            <span className="ml-2 px-2 py-0.5 bg-[var(--text-primary)]/10 rounded-full text-xs text-[var(--text-secondary)]">
                                {filtered.length}
                            </span>
                        </h2>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {/* Role filter */}
                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                className="bg-[var(--input-bg)] border border-[var(--border-color)] text-sm rounded-xl px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                                <option value="all">Tất cả role</option>
                                <option value="Admin">Admin</option>
                                <option value="Author">Tác giả</option>
                                <option value="Staff">Nhân viên</option>
                            </select>
                            {/* Search */}
                            <div className="relative flex-1 sm:w-56">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                                <input
                                    type="text"
                                    placeholder="Tìm tên, email..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)]">
                                    <th
                                        className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                                        onClick={() => handleSort('fullName')}
                                    >
                                        Tên <SortIcon col="fullName" />
                                    </th>
                                    <th
                                        className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                                        onClick={() => handleSort('email')}
                                    >
                                        Email <SortIcon col="email" />
                                    </th>
                                    <th
                                        className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                                        onClick={() => handleSort('role')}
                                    >
                                        Role <SortIcon col="role" />
                                    </th>
                                    <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs">Trạng thái</th>
                                    <th
                                        className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                                        onClick={() => handleSort('createdAt')}
                                    >
                                        Ngày tạo <SortIcon col="createdAt" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Không tìm thấy người dùng nào.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((user: UserSummary) => (
                                        <tr key={user.id} className="hover:bg-[var(--text-primary)]/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0 text-white">
                                                        {user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-[var(--text-primary)]">{user.fullName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[var(--text-secondary)]">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${roleStyle(user.role)}`}>
                                                    {roleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.isActive ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Hoạt động
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                                        Tạm khoá
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-[var(--text-secondary)] text-xs">
                                                {new Date(user.createdAt).toLocaleDateString('vi-VN', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
