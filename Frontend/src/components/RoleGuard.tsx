import React from 'react';
import { Navigate } from 'react-router-dom';
import { getUserInfo } from '../utils/jwtHelper';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const userInfo = getUserInfo(token);
    const userRole = userInfo.role;

    if (!allowedRoles.includes(userRole)) {
      // Show 403 Forbidden page
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-app)] px-4">
          <div className="text-center max-w-md">
            <h1 className="text-6xl font-bold text-[var(--accent)] mb-4">403</h1>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
              Không có quyền truy cập
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là lỗi.
            </p>
            <a
              href="/home"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              ← Quay về trang chủ
            </a>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Role check error:', error);
    return <Navigate to="/login" replace />;
  }
};

export default RoleGuard;
