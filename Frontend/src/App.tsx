import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import RouteGuard from './components/RouteGuard';
import RoleGuard from './components/RoleGuard';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ProjectsPage from './pages/ProjectsPage';
import SettingsPage from './pages/SettingsPage';
import WorkspacePage from './pages/WorkspacePage';
import SubscriptionPage from './pages/SubscriptionPage';
import PlansPage from './pages/PlansPage';
import AdminSubscriptionPage from './pages/AdminSubscriptionPage';
import AnalysisPage from './pages/AnalysisPage';
import StaffDashboardPage from './pages/StaffDashboardPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/plans" element={<PlansPage />} />

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
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
