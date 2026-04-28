/**
 * Resolve um responsible_role para o nome real do projeto (Dados Iniciais).
 * Retorna string vazia se não encontrado.
 *
 * Papéis suportados:
 *   Pontotel: gerente_projeto, analista_implantacao
 *   Cliente:  patrocinador, lider_projeto, ti, operacao
 */
export const RESPONSIBLE_ROLE_LABELS = {
  gerente_projeto:      "Gerente de Projeto (Pontotel)",
  analista_implantacao: "Analista de Implantação (Pontotel)",
  patrocinador:         "Patrocinador (Cliente)",
  lider_projeto:        "Líder do Projeto (Cliente)",
  ti:                   "TI (Cliente)",
  operacao:             "Operação (Cliente)",
};

export const RESPONSIBLE_ROLE_OPTIONS = Object.entries(RESPONSIBLE_ROLE_LABELS).map(
  ([value, label]) => ({ value, label })
);

/**
 * @param {string} role  - e.g. "gerente_projeto"
 * @param {object} project - objeto do projeto com os campos de Dados Iniciais
 * @returns {string} nome real ou ""
 */
export function resolveRoleToName(role, project) {
  if (!role || !project) return "";
  switch (role) {
    case "gerente_projeto":      return project.pontotel_manager_name || "";
    case "analista_implantacao": return project.pontotel_analyst_name || "";
    case "patrocinador":         return project.sponsor_name || "";
    case "lider_projeto":        return project.project_leader_name || "";
    case "ti":                   return project.ti_client_name || "";
    case "operacao":             return project.operation_name || "";
    default:                     return "";
  }
}