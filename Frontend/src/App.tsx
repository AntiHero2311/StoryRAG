import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import RouteGuard from './components/RouteGuard';
import RoleGuard from './components/RoleGuard';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminSystemPage = lazy(() => import('./pages/admin/AdminSystemPage'));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'));
const AdminRevenueDashboardPage = lazy(() => import('./pages/AdminRevenueDashboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'));
const AdminSubscriptionPage = lazy(() => import('./pages/AdminSubscriptionPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const StaffOverviewPage = lazy(() => import('./pages/staff/StaffOverviewPage'));
const StaffContentPage = lazy(() => import('./pages/staff/StaffContentPage'));
const StaffDashboardPage = lazy(() => import('./pages/StaffDashboardPage'));
const StaffFlaggedPage = lazy(() => import('./pages/StaffFlaggedPage'));
const StaffAnalysisJobsPage = lazy(() => import('./pages/StaffAnalysisJobsPage'));
const StaffFeedbacksPage = lazy(() => import('./pages/StaffFeedbacksPage'));
const StaffPerformancePage = lazy(() => import('./pages/StaffPerformancePage'));
const StaffReportReviewPage = lazy(() => import('./pages/StaffReportReviewPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const FeedbackDetailPage = lazy(() => import('./pages/FeedbackDetailPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));

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
            <Route path="/projects" element={<RouteGuard><Navigate to="/home" replace /></RouteGuard>} />
            <Route path="/settings" element={<RouteGuard><SettingsPage /></RouteGuard>} />
            <Route path="/workspace/:projectId" element={<RouteGuard><WorkspacePage /></RouteGuard>} />
            <Route path="/subscription" element={<RouteGuard><SubscriptionPage /></RouteGuard>} />
            <Route path="/analysis" element={<RouteGuard><AnalysisPage /></RouteGuard>} />
            <Route path="/feedback" element={<RouteGuard><FeedbackPage /></RouteGuard>} />
            <Route path="/feedback/:id" element={<RouteGuard><FeedbackDetailPage /></RouteGuard>} />
            <Route path="/support" element={<Navigate to="/help" replace />} />

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
            <Route
              path="/admin/revenue"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Admin']}>
                    <AdminRevenueDashboardPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route path="/admin/users" element={<RouteGuard><RoleGuard allowedRoles={['Admin']}><AdminUsersPage /></RoleGuard></RouteGuard>} />
            <Route path="/admin/system" element={<RouteGuard><RoleGuard allowedRoles={['Admin']}><AdminSystemPage /></RoleGuard></RouteGuard>} />
            <Route path="/admin/logs" element={<RouteGuard><RoleGuard allowedRoles={['Admin']}><AdminLogsPage /></RoleGuard></RouteGuard>} />

            {/* Staff routes — cụ thể trước /staff để khớp đúng */}
            <Route
              path="/staff/flagged"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffFlaggedPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route path="/staff/faqs" element={<Navigate to="/staff/content?tab=faq" replace />} />
            <Route path="/staff/writing-tips" element={<Navigate to="/staff/content?tab=tips" replace />} />
            <Route
              path="/staff/content"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffContentPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route
              path="/staff/bugs"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffDashboardPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route path="/staff/feedbacks" element={<RouteGuard><RoleGuard allowedRoles={['Staff', 'Admin']}><StaffFeedbacksPage /></RoleGuard></RouteGuard>} />
            <Route path="/staff/performance" element={<RouteGuard><RoleGuard allowedRoles={['Staff', 'Admin']}><StaffPerformancePage /></RoleGuard></RouteGuard>} />
            <Route
              path="/staff/analysis-jobs"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffAnalysisJobsPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route
              path="/staff/analysis-reports/:reportId"
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffReportReviewPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route 
              path="/staff" 
              element={
                <RouteGuard>
                  <RoleGuard allowedRoles={['Staff', 'Admin']}>
                    <StaffOverviewPage />
                  </RoleGuard>
                </RouteGuard>
              }
            />
            <Route path="/help" element={<RouteGuard><HelpPage /></RouteGuard>} />

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
