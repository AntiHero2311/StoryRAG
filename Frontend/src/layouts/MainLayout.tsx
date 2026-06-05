import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { getUserInfo, UserInfo } from '../utils/jwtHelper';
import { userService } from '../services/userService';

interface MainLayoutProps {
    children: React.ReactNode | ((userInfo: UserInfo) => React.ReactNode);
    pageTitle?: string;
    onSettings?: () => void;
}

export default function MainLayout({ children, pageTitle, onSettings }: MainLayoutProps) {
    const navigate = useNavigate();
    const [userInfo, setUserInfo] = useState<UserInfo>({
        fullName: 'Người dùng',
        role: 'Author',
        email: '',
        userId: '',
        avatarUrl: ''
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        const baseInfo = getUserInfo(token);
        setUserInfo(baseInfo);

        let disposed = false;
        userService.getProfile()
            .then(profile => {
                if (disposed) return;
                setUserInfo(prev => ({
                    ...prev,
                    fullName: profile.fullName || prev.fullName,
                    role: profile.role || prev.role,
                    email: profile.email || prev.email,
                    avatarUrl: profile.avatarURL ?? prev.avatarUrl,
                }));
            })
            .catch(() => {
                // Profile fetch failure should not block layout.
            });

        const handleProfileUpdated = (event: Event) => {
            const detail = (event as CustomEvent<{ fullName?: string; avatarUrl?: string }>).detail;
            if (!detail) return;
            setUserInfo(prev => ({
                ...prev,
                fullName: detail.fullName ?? prev.fullName,
                avatarUrl: detail.avatarUrl ?? prev.avatarUrl,
            }));
        };

        window.addEventListener('profile-updated', handleProfileUpdated as EventListener);
        return () => {
            disposed = true;
            window.removeEventListener('profile-updated', handleProfileUpdated as EventListener);
        };
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        navigate('/login');
    };

    return (
        <div
            className="flex h-screen w-screen overflow-hidden"
            style={{ background: 'var(--bg-app)' }}
        >
            {/* Ambient background glow */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div
                    className="absolute -top-64 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)', filter: 'blur(80px)' }}
                />
                <div
                    className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)', filter: 'blur(60px)' }}
                />
            </div>

            <Sidebar role={userInfo.role} onNavigate={navigate} userId={userInfo.userId} />

            <div className="relative flex flex-col flex-1 min-w-0 z-10">
                <Topbar
                    fullName={userInfo.fullName}
                    role={userInfo.role}
                    userId={userInfo.userId}
                    avatarUrl={userInfo.avatarUrl}
                    pageTitle={pageTitle}
                    onLogout={handleLogout}
                    onSettings={onSettings}
                />
                <main className="relative z-0 flex-1 overflow-y-auto scrollbar-thin select-text">
                    {typeof children === 'function' ? children(userInfo) : children}
                </main>
            </div>
        </div>
    );
}
