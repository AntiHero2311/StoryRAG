import { useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle, User } from 'lucide-react';
import { getInitials, UserInfo } from '../utils/jwtHelper';
import MainLayout from '../layouts/MainLayout';

function getRoleLabel(role: string) {
    return { Admin: 'Quản trị viên', Staff: 'Nhân viên', Author: 'Tác giả' }[role] ?? role;
}

// ── Settings Page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
    return (
        <MainLayout pageTitle="Cài đặt">
            {(userInfo: UserInfo) => (
                <SettingsContent userInfo={userInfo} />
            )}
        </MainLayout>
    );
}

function SettingsContent({ userInfo }: { userInfo: UserInfo }) {
    const navigate = useNavigate();

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="mb-10 text-center md:text-left">
                    <h2 className="text-[var(--text-primary)] font-bold text-3xl mb-2">Cài đặt</h2>
                    <p className="text-[var(--text-secondary)] text-sm">Điều hướng nhanh đến các mục quan trọng.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <User size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[var(--text-primary)] font-bold text-base">Hồ sơ & Bảo mật</h3>
                                <p className="text-[var(--text-secondary)] text-xs">Cập nhật thông tin cá nhân, ảnh đại diện và đổi mật khẩu.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/profile')}
                            className="mt-5 w-full flex items-center justify-between p-4 rounded-2xl bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[#f5a623]/30 transition-all group"
                        >
                            <span className="text-[var(--text-primary)] text-sm font-medium">Đi tới hồ sơ</span>
                            <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                <HelpCircle size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[var(--text-primary)] font-bold text-base">Trợ giúp</h3>
                                <p className="text-[var(--text-secondary)] text-xs">Xem hướng dẫn, câu hỏi thường gặp và cách liên hệ.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/help')}
                            className="mt-5 w-full flex items-center justify-between p-4 rounded-2xl bg-[var(--input-bg)] border border-[var(--border-color)] hover:border-[#f5a623]/30 transition-all group"
                        >
                            <span className="text-[var(--text-primary)] text-sm font-medium">Đi tới trợ giúp</span>
                            <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="md:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                                {getInitials(userInfo.fullName)}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-[var(--text-primary)] font-bold text-xl mb-1">{userInfo.fullName}</h3>
                                <p className="text-[var(--text-secondary)] text-sm">Bạn đang đăng nhập với tư cách là <span className="text-[#f5a623] font-bold">{getRoleLabel(userInfo.role)}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
