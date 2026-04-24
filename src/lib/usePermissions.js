/**
 * Hook RBAC: lê permissões do perfil vinculado ao usuário (PermissionProfile).
 * Fallback para role de sistema (admin) se não houver perfil.
 */

import { useAuth } from "@/lib/AuthContext";
import { resolvePermissions } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();

  // O perfil pode ter sido carregado e salvo em user.profile_data (objeto JSON)
  // ou o usuário pode referenciar um perfil via user.permission_profile_id.
  // Para evitar fetch adicional aqui, o AuthContext injeta o perfil resolvido em user.
  const profile = user?._resolvedProfile || null;
  const perms = resolvePermissions(user, profile);

  // Helper: lê permissão com fallback false
  const can = (key) => !!perms[key];

  // Se role do sistema é admin sem perfil definido → acesso total
  const isSystemAdmin = !profile && user?.role === "admin";

  return {
    // Informações do perfil
    profileName: profile?.name || (isSystemAdmin ? "Admin" : "Viewer"),
    profileId: user?.permission_profile_id || null,

    // Navegação
    canAccessParametrizacoes: can("parametrizacoes_acessar") || isSystemAdmin,
    canAccessFluxo: can("projetos_ver") || isSystemAdmin,

    // Projetos
    canReadProject: can("projetos_ver") || isSystemAdmin,
    canCreateProject: can("projetos_criar") || isSystemAdmin,
    canEditProject: can("projetos_editar") || isSystemAdmin,
    canDeleteProject: can("projetos_excluir") || isSystemAdmin,

    // Dados Iniciais
    canReadDadosIniciais: can("dados_iniciais_ver") || isSystemAdmin,
    canEditDadosIniciais: can("dados_iniciais_editar") || isSystemAdmin,

    // Escopo
    canReadScope: can("escopo_ver") || isSystemAdmin,
    canEditScope: can("escopo_editar") || isSystemAdmin,

    // Cronograma
    canReadSchedule: can("cronograma_ver") || isSystemAdmin,
    canEditSchedule: can("cronograma_editar") || isSystemAdmin,

    // TAP
    canReadTAP: can("tap_ver") || isSystemAdmin,
    canEditTAP: can("tap_editar") || isSystemAdmin,

    // Status Report
    canReadStatusReport: can("status_report_ver") || isSystemAdmin,
    canEditStatusReport: can("status_report_editar") || isSystemAdmin,

    // Plano de ação (agrupa com status report por enquanto)
    canEditActionPlan: can("status_report_editar") || isSystemAdmin,

    // Termo de Encerramento
    canReadTermo: can("termo_ver") || isSystemAdmin,
    canEditTermo: can("termo_pdf") || isSystemAdmin,

    // Parametrizações
    canEditParametrizacoes: can("parametrizacoes_editar") || isSystemAdmin,
    canReadParametrizacoes: can("parametrizacoes_acessar") || isSystemAdmin,

    // Helpers genéricos
    readOnly: !isSystemAdmin && !can("projetos_editar") && !can("escopo_editar"),
    isSystemAdmin,

    // Expor permissões brutas para componentes que precisem
    perms,
  };
}