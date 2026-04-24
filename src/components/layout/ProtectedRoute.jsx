import { Navigate } from "react-router-dom";
import { usePermissions } from "@/lib/usePermissions";

/**
 * Protege uma rota verificando uma permissão específica.
 * Ex: <ProtectedRoute allowed={canAccessParametrizacoes}> ... </ProtectedRoute>
 */
export default function ProtectedRoute({ allowed, children, redirectTo = "/" }) {
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
}