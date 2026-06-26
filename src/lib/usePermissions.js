/**
 * Hook RBAC: lê permissões do perfil vinculado ao usuário (PermissionProfile).
 * Fallback para role de sistema (admin) se não houver perfil.
 */

import { useAuth } from "@/lib/AuthContext";
import { resolvePermissions } from "@/lib/permissions";

export function usePermissions() {
  const { user } = useAuth();

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
    canUpdateScopeTemplate: can("escopo_atualizar_template") || isSystemAdmin,

    // Cronograma
    canReadSchedule: can("cronograma_ver") || isSystemAdmin,
    canEditSchedule: can("cronograma_editar") || isSystemAdmin,
    canEditSchedulePlanned: can("cronograma_editar_planejado") || isSystemAdmin,
    canCompletePhase: can("cronograma_concluir_fase") || isSystemAdmin,
    canRecalculateSchedule: can("cronograma_recalcular") || isSystemAdmin,
    canAddScheduleActivity: can("cronograma_criar_atividade") || isSystemAdmin,
    canCreateSchedulePhase: can("cronograma_criar_fase") || isSystemAdmin,
    canEditSchedulePhase: can("cronograma_editar_fase") || isSystemAdmin,
    canExcluirSchedulePhase: can("cronograma_excluir_fase") || isSystemAdmin,
    canEditScheduleActivity: can("cronograma_editar_atividade") || isSystemAdmin,
    canExcluirScheduleActivity: can("cronograma_excluir_atividade") || isSystemAdmin,
    canGenerateSchedulePDF: can("cronograma_gerar_pdf") || isSystemAdmin,

    // TAP
    canReadTAP: can("tap_ver") || isSystemAdmin,
    canEditTAP: can("tap_editar") || isSystemAdmin,
    canGenerateTAPPDF: can("tap_gerar_pdf") || isSystemAdmin,

    // Status Report
    canReadStatusReport: can("status_report_ver") || isSystemAdmin,
    canEditStatusReport: can("status_report_editar") || isSystemAdmin,
    canUpdateStatusReport: can("status_report_atualizar") || isSystemAdmin,
    canGenerateStatusReportEmail: can("status_report_email") || isSystemAdmin,

    // Plano de Ação
    canReadActionPlan: can("plano_acao_ver") || isSystemAdmin,
    canEditActionPlan: can("plano_acao_editar") || isSystemAdmin,
    canDeleteActionPlan: can("plano_acao_excluir") || isSystemAdmin,

    // Termo de Encerramento
    canReadTermo: can("termo_ver") || isSystemAdmin,
    canEditTermo: can("termo_editar") || isSystemAdmin,
    canEditTermoAutoFields: can("termo_editar_campos_auto") || isSystemAdmin,
    canGenerateTermoPDF: can("termo_pdf") || isSystemAdmin,

    // Parametrizações
    canEditParametrizacoes: can("parametrizacoes_editar") || isSystemAdmin,
    canReadParametrizacoes: can("parametrizacoes_acessar") || isSystemAdmin,

    // Regras de Cálculo
    canReadCalcRules: can("regras_calculo_ver") || isSystemAdmin,
    canEditCalcRules: can("regras_calculo_editar") || isSystemAdmin,
    canCreateCalcRules: can("regras_calculo_criar") || isSystemAdmin,
    canDeleteCalcRules: can("regras_calculo_excluir") || isSystemAdmin,
    canFinalizeCalcRules: can("regras_calculo_finalizar") || isSystemAdmin,

    // Kanban Regras Morfeu
    canViewKanban: can("kanban_ver") || isSystemAdmin,
    canEditKanban: can("kanban_editar") || isSystemAdmin,
    canDeleteKanbanCards: can("kanban_excluir") || isSystemAdmin,

    // Alocação de Recursos
    canViewAlocacao: can("alocacao_ver") || isSystemAdmin,

    // Integrações / Ações
    canSyncPipedriveDados: can("integracao_sync_pipedrive_dados") || isSystemAdmin,
    canSyncPipedriveCronograma: can("integracao_sync_pipedrive_cronograma") || isSystemAdmin,
    canSyncPipedriveStatus: can("integracao_sync_pipedrive_status") || isSystemAdmin,

    // Helpers genéricos
    readOnly: !isSystemAdmin && !can("projetos_editar") && !can("escopo_editar"),
    isSystemAdmin,

    // Expor permissões brutas para componentes que precisem
    perms,
  };
}