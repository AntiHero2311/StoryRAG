import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { getUserInfo, UserInfo } from '../utils/jwtHelper';

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
        userId: ''
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        setUserInfo(getUserInfo(token));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)]">
            <Sidebar role={userInfo.role} onNavigate={navigate} />
            <div className="flex flex-col flex-1 min-w-0">
                <Topbar
                    fullName={userInfo.fullName}
                    role={userInfo.role}
                    pageTitle={pageTitle}
                    onLogout={handleLogout}
                    onSettings={onSettings}
                />
                <main className="flex-1 overflow-y-auto pt-6">
                    {typeof children === 'function' ? children(userInfo) : children}
                </main>
            </div>
        </div>
    );
}
