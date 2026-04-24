/**
 * Hook de permissões baseado em app_role do usuário.
 *
 * Roles:
 *  - Admin           → acesso total
 *  - Gestor de Projetos → criar/editar projetos, TAP, cronograma, report, termo — sem Parametrizações
 *  - Implantação     → editar execução (cronograma, escopo, report) — sem Parametrizações, sem estrutura
 *  - Viewer          → somente leitura
 */

import { useAuth } from "@/lib/AuthContext";

export function usePermissions() {
  const { user } = useAuth();
  const appRole = user?.app_role || "Viewer";

  const is = (role) => appRole === role;
  const isAdmin = is("Admin");
  const isGestor = is("Gestor de Projetos");
  const isImplantacao = is("Implantação");
  const isViewer = is("Viewer");

  return {
    appRole,
    isAdmin,
    isGestor,
    isImplantacao,
    isViewer,

    // Navegação
    canAccessParametrizacoes: isAdmin,
    canAccessFluxo: isAdmin || isGestor || isImplantacao,

    // Projetos
    canCreateProject: isAdmin || isGestor,
    canEditProject: isAdmin || isGestor,          // dados iniciais
    canReadProject: true,

    // Escopo
    canEditScope: isAdmin || isGestor || isImplantacao,

    // Cronograma
    canEditSchedule: isAdmin || isGestor || isImplantacao,

    // TAP
    canEditTAP: isAdmin || isGestor,

    // Status Report
    canEditStatusReport: isAdmin || isGestor || isImplantacao,

    // Plano de Ação
    canEditActionPlan: isAdmin || isGestor || isImplantacao,

    // Termo de Encerramento
    canEditTermo: isAdmin || isGestor,

    // Parametrizações (Adendos, Assinaturas, Templates)
    canEditParametrizacoes: isAdmin,
    canReadParametrizacoes: isAdmin,

    // Helpers genéricos
    canWrite: !isViewer,
    readOnly: isViewer,
  };
}