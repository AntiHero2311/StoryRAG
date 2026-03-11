import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
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
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <ToastProvider>
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/workspace/:projectId" element={<WorkspacePage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/admin/subscription" element={<AdminSubscriptionPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;
