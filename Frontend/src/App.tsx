import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import RouteGuard from './components/RouteGuard';
import RoleGuard from './components/RoleGuard';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'));
const AdminSubscriptionPage = lazy(() => import('./pages/AdminSubscriptionPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const StaffDashboardPage = lazy(() => import('./pages/StaffDashboardPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// A simple fallback for Suspense
const PageLoader = () => (
    <div className="flex items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/payment/success" element={<RouteGuard><PaymentSuccessPage /></RouteGuard>} />
            <Route path="/payment/cancel" element={<RouteGuard><PaymentCancelPage /></RouteGuard>} />

            {/* Protected routes (requires authentication) */}
            <Route path="/home" element={<RouteGuard><HomePage /></RouteGuard>} />
            <Route path="/profile" element={<RouteGuard><ProfilePage /></RouteGuard>} />
            <Route path="/projects" element={<RouteGuard><ProjectsPage /></RouteGuard>} />
            <Route path="/settings" element={<RouteGuard><SettingsPage /></RouteGuard>} />
            <Route path="/workspace/:projectId" element={<RouteGuard><WorkspacePage /></RouteGuard>} />
            <Route path="/subscription" element={<RouteGuard><SubscriptionPage /></RouteGuard>} />
            <Route path="/analysis" element={<RouteGuard><AnalysisPage /></RouteGuard>} />

            {/* Admin routes */}
            <Route 
              path="/admin" 
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Admin']}>
                    <AdminDashboardPage />
                  </RoleGuard>
                </RouteGuard>
              } 
            />
            <Route 
              path="/admin/subscription" 
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Admin']}>
                    <AdminSubscriptionPage />
                  </RoleGuard>
                </RouteGuard>
              } 
            />

            {/* Staff routes */}
            <Route 
              path="/staff" 
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffDashboardPage />
                  </RoleGuard>
                </RouteGuard>
              } 
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
