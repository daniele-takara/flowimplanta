import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Page imports
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import NewProject from './pages/NewProject';
import Parametrizacoes from './pages/Parametrizacoes';
import FluxoProjeto from './pages/FluxoProjeto';
import UsersPermissions from './pages/UsersPermissions';
import RBACReport from './pages/RBACReport';
import DiagnosticoPipedrive from './pages/DiagnosticoPipedrive';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { usePermissions } from './lib/usePermissions';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const perms = usePermissions();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/new" element={
          <ProtectedRoute allowed={perms.canCreateProject}>
            <NewProject />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/parametrizacoes" element={
          <ProtectedRoute allowed={perms.canAccessParametrizacoes}>
            <Parametrizacoes />
          </ProtectedRoute>
        } />
        <Route path="/users-permissions" element={
          <ProtectedRoute allowed={perms.canAccessParametrizacoes}>
            <UsersPermissions />
          </ProtectedRoute>
        } />
        <Route path="/diagnostico-pipedrive" element={<DiagnosticoPipedrive />} />
        <Route path="/rbac-report" element={
          <ProtectedRoute allowed={perms.canAccessParametrizacoes}>
            <RBACReport />
          </ProtectedRoute>
        } />
        <Route path="/fluxo" element={
          <ProtectedRoute allowed={perms.canAccessFluxo}>
            <FluxoProjeto />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;