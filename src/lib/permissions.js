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
      { key: "escopo_editar", label: "Editar" },
    ],
  },
  {
    key: "cronograma",
    label: "Cronograma",
    permissions: [
      { key: "cronograma_ver", label: "Visualizar" },
      { key: "cronograma_editar", label: "Editar" },
    ],
  },
  {
    key: "tap",
    label: "TAP",
    permissions: [
      { key: "tap_ver", label: "Visualizar" },
      { key: "tap_editar", label: "Editar" },
    ],
  },
  {
    key: "status_report",
    label: "Status Report",
    permissions: [
      { key: "status_report_ver", label: "Visualizar" },
      { key: "status_report_editar", label: "Editar" },
    ],
  },
  {
    key: "termo",
    label: "Termo de Encerramento",
    permissions: [
      { key: "termo_ver", label: "Visualizar" },
      { key: "termo_pdf", label: "Gerar PDF" },
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
      escopo_ver: true, escopo_editar: true,
      cronograma_ver: true, cronograma_editar: true,
      tap_ver: true, tap_editar: true,
      status_report_ver: true, status_report_editar: true,
      termo_ver: true, termo_pdf: true,
      parametrizacoes_acessar: true, parametrizacoes_editar: true,
    },
  },
  {
    name: "Gestor de Projetos",
    description: "Cria e gerencia projetos, documentos e relatórios. Sem acesso a Parametrizações.",
    permissions: {
      projetos_ver: true, projetos_criar: true, projetos_editar: true, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: true,
      escopo_ver: true, escopo_editar: true,
      cronograma_ver: true, cronograma_editar: true,
      tap_ver: true, tap_editar: true,
      status_report_ver: true, status_report_editar: true,
      termo_ver: true, termo_pdf: true,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
    },
  },
  {
    name: "Implantação",
    description: "Edita execução (escopo, cronograma, status report). Sem criação de projetos ou documentos.",
    permissions: {
      projetos_ver: true, projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: false,
      escopo_ver: true, escopo_editar: true,
      cronograma_ver: true, cronograma_editar: true,
      tap_ver: true, tap_editar: false,
      status_report_ver: true, status_report_editar: true,
      termo_ver: true, termo_pdf: false,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
    },
  },
  {
    name: "Viewer",
    description: "Somente leitura em todos os módulos.",
    permissions: {
      projetos_ver: true, projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      dados_iniciais_ver: true, dados_iniciais_editar: false,
      escopo_ver: true, escopo_editar: false,
      cronograma_ver: true, cronograma_editar: false,
      tap_ver: true, tap_editar: false,
      status_report_ver: true, status_report_editar: false,
      termo_ver: true, termo_pdf: false,
      parametrizacoes_acessar: false, parametrizacoes_editar: false,
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