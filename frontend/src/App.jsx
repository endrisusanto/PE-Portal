import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AppShell } from './components/layout/AppShell';
import { LoadingState } from './components/common/LoadingState';
import { ThemeAnimatedBackground } from './components/common/ThemeAnimatedBackground';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InnovationsPage } from './pages/InnovationsPage';
import { GbaTasksPage } from './pages/GbaTasksPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SampleManagementPage } from './pages/SampleManagementPage';
import { DhlTrackerPage } from './pages/DhlTrackerPage';
import { SoftwareMRPage } from './pages/SoftwareMRPage';
import { ModelsPage } from './pages/ModelsPage';
import { ImeiArticlesPage } from './pages/ImeiArticlesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { TeamPage } from './pages/TeamPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { ReportEditorPage } from './pages/ReportEditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { UtilityPage } from './pages/UtilityPage';

// Protected Route Guard
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState message="Verifying session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ThemeAnimatedBackground />
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Application Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="innovations" element={<InnovationsPage />} />
                <Route path="gba-tasks" element={<GbaTasksPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="samples" element={<SampleManagementPage />} />
                <Route path="samples/dhl-tracker" element={<DhlTrackerPage />} />
                <Route path="software-mr" element={<SoftwareMRPage />} />
                <Route path="models" element={<ModelsPage />} />
                <Route path="imei" element={<ImeiArticlesPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="tools" element={<UtilityPage />} />
                <Route path="tools/:tab" element={<UtilityPage />} />
                <Route path="utility" element={<Navigate to="/tools/images" replace />} />
                <Route path="utility/:tab" element={<UtilityPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reports/new" element={<ReportEditorPage />} />
                <Route path="reports/editor/:id" element={<ReportEditorPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
