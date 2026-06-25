import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Page imports
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import NewProject from './pages/NewProject';
import Parametrizacoes from './pages/Parametrizacoes';
import FluxoProjeto from './pages/FluxoProjeto';
import UsersPermissions from './pages/UsersPermissions';
import RBACReport from './pages/RBACReport';
import DiagnosticoPipedrive from './pages/DiagnosticoPipedrive';
import BigQueryConsultas from './pages/BigQueryConsultas';
import Documentacao from './pages/Documentacao';
import ClientCalcWizard from './pages/ClientCalcWizard';
import StandaloneCalcWizard from './pages/StandaloneCalcWizard';
import CalcRulesKanban from './pages/CalcRulesKanban';
import AlocacaoRecursos from './pages/AlocacaoRecursos';
import WebhookConfig from './pages/WebhookConfig';
import MonitorIntegracoes from './pages/MonitorIntegracoes';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import NoPermissionScreen from './components/NoPermissionScreen';
import { usePermissions } from './lib/usePermissions';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, authChecked, user } = useAuth();
  const perms = usePermissions();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authChecked && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Usuário sem perfil de permissão vinculado → sem acesso
  if (!user?.permission_profile_id) {
    return <NoPermissionScreen />;
  }

  // Usuário com perfil mas sem nenhuma permissão efetiva
  const rawPerms = perms.perms || {};
  const hasAnyPermission = Object.values(rawPerms).some(v => v === true);
  if (!hasAnyPermission) {
    return <NoPermissionScreen />;
  }

  // Cliente role: acesso restrito apenas ao wizard de regras (link público)
  if (user?.role === 'cliente') {
    return (
      <Routes>
        <Route path="*" element={<NoPermissionScreen />} />
      </Routes>
    );
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
        <Route path="/documentacao" element={<Documentacao />} />
        <Route path="/webhook-config" element={<WebhookConfig />} />
        <Route path="/monitor-integracoes" element={<MonitorIntegracoes />} />
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
        <Route path="/bigquery" element={<BigQueryConsultas />} />
        <Route path="/calculo-kanban" element={<CalcRulesKanban />} />
        <Route path="/alocacao" element={<AlocacaoRecursos />} />
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
          <Routes>
            {/* Auth pages — accessible without login */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public client route — no auth needed */}
            <Route path="/cliente/:token" element={<ClientCalcWizard />} />
            <Route path="/calculo" element={<StandaloneCalcWizard />} />

            {/* All other routes: gated by login */}
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;