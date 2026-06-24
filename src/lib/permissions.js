/**
 * Definição central de módulos e permissões do sistema RBAC.
 * Única fonte de verdade para nomes de permissões.
 */

export const PERMISSION_MODULES = [
  {
    key: "projetos",
    label: "Projetos",
    permissions: [
      { key: "projetos_ver", label: "Visualizar" },
      { key: "projetos_criar", label: "Criar" },
      { key: "projetos_editar", label: "Editar" },
      { key: "projetos_excluir", label: "Excluir" },
    ],
  },
  {
    key: "dados_iniciais",
    label: "Dados Iniciais",
    permissions: [
      { key: "dados_iniciais_ver", label: "Visualizar" },
      { key: "dados_iniciais_editar", label: "Editar" },
    ],
  },
  {
    key: "escopo",
    label: "Escopo Técnico",
    permissions: [
      { key: "escopo_ver", label: "Visualizar" },
      { key: "escopo_editar", label: "Editar respostas" },
      { key: "escopo_atualizar_template", label: "Atualizar template" },
    ],
  },
  {
    key: "cronograma",
    label: "Cronograma",
    permissions: [
      { key: "cronograma_ver", label: "Visualizar" },
      { key: "cronograma_editar", label: "Editar datas executadas" },
      { key: "cronograma_editar_planejado", label: "Editar datas planejadas e âncoras" },
      { key: "cronograma_concluir_fase", label: "Concluir fase conforme planejado" },
      { key: "cronograma_recalcular", label: "Recalcular / Concluir projeto" },
      { key: "cronograma_criar_atividade", label: "Adicionar atividade local" },
      { key: "cronograma_criar_fase", label: "Adicionar marco/fase local" },
      { key: "cronograma_editar_fase", label: "Editar marco/fase local" },
      { key: "cronograma_excluir_fase", label: "Excluir/inativar marco/fase local" },
      { key: "cronograma_editar_atividade", label: "Editar atividade local" },
      { key: "cronograma_excluir_atividade", label: "Excluir/inativar atividade local" },
      { key: "cronograma_gerar_pdf", label: "Gerar PDF do cronograma" },
    ],
  },
  {
    key: "tap",
    label: "TAP",
    permissions: [
      { key: "tap_ver", label: "Visualizar" },
      { key: "tap_editar", label: "Editar" },
      { key: "tap_gerar_pdf", label: "Gerar PDF" },
    ],
  },
  {
    key: "status_report",
    label: "Status Report",
    permissions: [
      { key: "status_report_ver", label: "Visualizar" },
      { key: "status_report_editar", label: "Editar campos manuais" },
      { key: "status_report_atualizar", label: "Atualizar Status Report (sincronizar)" },
      { key: "status_report_email", label: "Gerar versão para e-mail" },
    ],
  },
  {
    key: "termo",
    label: "Termo de Encerramento",
    permissions: [
      { key: "termo_ver", label: "Visualizar" },
      { key: "termo_editar", label: "Editar campos manuais" },
      { key: "termo_editar_campos_auto", label: "Editar campos automáticos" },
      { key: "termo_pdf", label: "Gerar PDF" },
    ],
  },
  {
    key: "plano_acao",
    label: "Plano de Ação",
    permissions: [
      { key: "plano_acao_ver", label: "Visualizar" },
      { key: "plano_acao_editar", label: "Editar itens" },
      { key: "plano_acao_excluir", label: "Excluir itens" },
    ],
  },
  {
    key: "integracoes",
    label: "Ações e Integrações",
    permissions: [
      { key: "integracao_sync_pipedrive_dados", label: "Atualizar dados do Pipedrive" },
      { key: "integracao_sync_pipedrive_cronograma", label: "Atualizar cronograma (Pipedrive)" },
      { key: "integracao_sync_pipedrive_status", label: "Sincronizar Status Report com Pipedrive" },
    ],
  },
  {
    key: "regras_calculo",
    label: "Regras de Cálculo",
    permissions: [
      { key: "regras_calculo_ver", label: "Visualizar" },
      { key: "regras_calculo_editar", label: "Editar" },
      { key: "regras_calculo_criar", label: "Criar" },
      { key: "regras_calculo_excluir", label: "Excluir" },
      { key: "regras_calculo_finalizar", label: "Finalizar" },
    ],
  },
  {
    key: "kanban",
    label: "Kanban Regras Morfeu",
    permissions: [
      { key: "kanban_ver", label: "Visualizar" },
      { key: "kanban_editar", label: "Editar (tudo)" },
      { key: "kanban_excluir", label: "Excluir cards" },
    ],
  },
  {
    key: "parametrizacoes",
    label: "Parametrizações",
    permissions: [
      { key: "parametrizacoes_acessar", label: "Acessar" },
      { key: "parametrizacoes_editar", label: "Editar" },
    ],
  },
];

/** Perfis padrão pré-definidos (usados na criação inicial) */
export const DEFAULT_PROFILES = [
  {
    name: "Admin",
    description: "Acesso total ao sistema",
    permissions: {
      projetos_ver: true, projetos_criar: true, projetos_editar: true, projetos_excluir: true,
      dados_iniciais_ver: true, dados_iniciais_editar: true,
      escopo_ver: true, escopo_editar: true, escopo_atualizar_template: true,
      cronograma_ver: true, cronograma_editar: true, cronograma_editar_planejado: true,
      cronograma_concluir_fase: true, cronograma_recalcular: true, cronograma_criar_atividade: true,
      cronograma_criar_fase: true, cronograma_editar_fase: true, cronograma_excluir_fase: true,
      cronograma_editar_atividade: true, cronograma_excluir_atividade: true,
      cronograma_gerar_pdf: true,
      tap_ver: true, tap_editar: true, tap_gerar_pdf: true,
      status_report_ver: true, status_report_editar: true,
      status_report_atualizar: true, status_report_email: true,
      termo_ver: true, termo_editar: true, termo_editar_campos_auto: true, termo_pdf: true,
      plano_acao_ver: true, plano_acao_editar: true, plano_acao_excluir: true,
      integracao_sync_pipedrive_dados: true,
      integracao_sync_pipedrive_cronograma: true,
      integracao_sync_pipedrive_status: true,
      parametrizacoes_acessar: true, parametrizacoes_editar: true,
      regras_calculo_ver: true, regras_calculo_editar: true,
      regras_calculo_criar: true, regras_calculo_excluir: true, regras_calculo_finalizar: true,
      kanban_ver: true, kanban_editar: true, kanban_excluir: true,
    },
  },
  {
    name: "Gestor de Projetos",
    description: "Cria e gerencia projetos, documentos e relatórios. Sem acesso a Parametrizações.",
    permissions: {
      projetos_ver: true, projetos_criar: true, projetos_editar: true, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: true,
      escopo_ver: true, escopo_editar: true, escopo_atualizar_template: true,
      cronograma_ver: true, cronograma_editar: true, cronograma_editar_planejado: true,
      cronograma_concluir_fase: true, cronograma_recalcular: true, cronograma_criar_atividade: true,
      cronograma_criar_fase: true, cronograma_editar_fase: true, cronograma_excluir_fase: true,
      cronograma_editar_atividade: true, cronograma_excluir_atividade: true,
      cronograma_gerar_pdf: true,
      tap_ver: true, tap_editar: true, tap_gerar_pdf: true,
      status_report_ver: true, status_report_editar: true,
      status_report_atualizar: true, status_report_email: true,
      termo_ver: true, termo_editar: true, termo_editar_campos_auto: true, termo_pdf: true,
      plano_acao_ver: true, plano_acao_editar: true, plano_acao_excluir: true,
      integracao_sync_pipedrive_dados: true,
      integracao_sync_pipedrive_cronograma: true,
      integracao_sync_pipedrive_status: true,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
      regras_calculo_ver: true, regras_calculo_editar: true,
      regras_calculo_criar: true, regras_calculo_excluir: false, regras_calculo_finalizar: true,
      kanban_ver: true, kanban_editar: true, kanban_excluir: false,
    },
  },
  {
    name: "Implantação",
    description: "Edita execução (escopo, cronograma, status report). Sem criação de projetos ou documentos.",
    permissions: {
      projetos_ver: true, projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: false,
      escopo_ver: true, escopo_editar: true, escopo_atualizar_template: false,
      cronograma_ver: true, cronograma_editar: true, cronograma_editar_planejado: false,
      cronograma_concluir_fase: true, cronograma_recalcular: false, cronograma_criar_atividade: true,
      cronograma_criar_fase: true, cronograma_editar_fase: true, cronograma_excluir_fase: true,
      cronograma_editar_atividade: true, cronograma_excluir_atividade: true,
      cronograma_gerar_pdf: true,
      tap_ver: true, tap_editar: false, tap_gerar_pdf: false,
      status_report_ver: true, status_report_editar: true,
      status_report_atualizar: true, status_report_email: true,
      termo_ver: true, termo_editar: false, termo_editar_campos_auto: false, termo_pdf: false,
      plano_acao_ver: true, plano_acao_editar: true, plano_acao_excluir: true,
      integracao_sync_pipedrive_dados: false,
      integracao_sync_pipedrive_cronograma: false,
      integracao_sync_pipedrive_status: false,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
      regras_calculo_ver: true, regras_calculo_editar: true,
      regras_calculo_criar: true, regras_calculo_excluir: false, regras_calculo_finalizar: true,
      kanban_ver: true, kanban_editar: true, kanban_excluir: false,
    },
  },
  {
    name: "Viewer",
    description: "Somente leitura em todos os módulos.",
    permissions: {
      projetos_ver: true, projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: false,
      escopo_ver: true, escopo_editar: false, escopo_atualizar_template: false,
      cronograma_ver: true, cronograma_editar: false, cronograma_editar_planejado: false,
      cronograma_concluir_fase: false, cronograma_recalcular: false,
      cronograma_criar_fase: false, cronograma_editar_fase: false, cronograma_excluir_fase: false,
      cronograma_editar_atividade: false, cronograma_excluir_atividade: false,
      cronograma_gerar_pdf: true,
      tap_ver: true, tap_editar: false, tap_gerar_pdf: false,
      status_report_ver: true, status_report_editar: false,
      status_report_atualizar: false, status_report_email: false,
      termo_ver: true, termo_editar: false, termo_editar_campos_auto: false, termo_pdf: false,
      plano_acao_ver: true, plano_acao_editar: false, plano_acao_excluir: false,
      integracao_sync_pipedrive_dados: false,
      integracao_sync_pipedrive_cronograma: false,
      integracao_sync_pipedrive_status: false,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
      regras_calculo_ver: true, regras_calculo_editar: false,
      regras_calculo_criar: false, regras_calculo_excluir: false, regras_calculo_finalizar: false,
      kanban_ver: true, kanban_editar: false, kanban_excluir: false,
    },
  },
];

/**
 * Resolve as permissões efetivas de um usuário.
 * Prioridade: perfil vinculado > fallback por role do sistema.
 */
export function resolvePermissions(user, profile) {
  // Se tem perfil vinculado com permissões, usa esse
  if (profile?.permissions) {
    return profile.permissions;
  }

  // Fallback: role de sistema (admin) → tudo liberado
  if (user?.role === "admin") {
    return Object.fromEntries(
      PERMISSION_MODULES.flatMap(m => m.permissions.map(p => [p.key, true]))
    );
  }

  // Fallback final: nada liberado (Viewer)
  return {};
}