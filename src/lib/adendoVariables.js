/**
 * Definição centralizada de variáveis disponíveis para templates de adendos.
 * Cada variável tem:
 * - key: placeholder a ser usado no texto (ex: {{client_name}})
 * - label: nome amigável
 * - source: descrição de onde o dado é puxado
 * - category: agrupamento visual
 * - example: valor de exemplo para pré-visualização
 */

export const ADENDO_VARIABLES = [
  // ── Identificação do Projeto ──
  {
    key: "{{client_name}}",
    label: "Nome do cliente/Empresa",
    source: "Projeto → Nome do cliente",
    category: "projeto",
    example: "Empresa XYZ Ltda",
  },
  {
    key: "{{implantation_type}}",
    label: "Tipo de implantação",
    source: "Projeto → Tipo de implantação",
    category: "projeto",
    example: "Implantação Pontotel",
  },
  {
    key: "{{project_status}}",
    label: "Status do projeto",
    source: "Projeto → Status",
    category: "projeto",
    example: "Em andamento",
  },
  {
    key: "{{current_phase}}",
    label: "Fase atual",
    source: "Projeto → Fase atual",
    category: "projeto",
    example: "Parametrização",
  },
  {
    key: "{{origin}}",
    label: "Origem do cliente",
    source: "Projeto → Origem",
    category: "projeto",
    example: "Parceiro",
  },
  {
    key: "{{mrr}}",
    label: "MRR do contrato",
    source: "Projeto → MRR",
    category: "projeto",
    example: "R$ 5.000,00",
  },
  {
    key: "{{drive_folder}}",
    label: "Pasta do Google Drive",
    source: "Projeto → Pasta do drive",
    category: "projeto",
    example: "https://drive.google.com/...",
  },

  // ── Datas ──
  {
    key: "{{closure_date}}",
    label: "Data de encerramento",
    source: "Data atual no momento da geração do PDF",
    category: "datas",
    example: new Date().toLocaleDateString("pt-BR"),
  },
  {
    key: "{{start_date}}",
    label: "Data de início do projeto",
    source: "Projeto → Data de início",
    category: "datas",
    example: "15/01/2026",
  },
  {
    key: "{{planned_end_date}}",
    label: "Data planejada de fim",
    source: "Projeto → Data planejada de fim",
    category: "datas",
    example: "30/06/2026",
  },
  {
    key: "{{aligned_end_date}}",
    label: "Data alinhada de encerramento",
    source: "Projeto → Data alinhada de fim",
    category: "datas",
    example: "15/06/2026",
  },

  // ── Métricas / Status Report ──
  {
    key: "{{contracted_employees}}",
    label: "Funcionários contratados",
    source: "Projeto → Funcionários contratados",
    category: "metricas",
    example: "200",
  },
  {
    key: "{{registered_employees}}",
    label: "Empregados cadastrados",
    source: "Status Report → Empregados cadastrados no sistema",
    category: "metricas",
    example: "164",
  },
  {
    key: "{{recording_employees}}",
    label: "Empregados no ponto/mês",
    source: "Status Report → Empregados registrando ponto (últ. 15 dias)",
    category: "metricas",
    example: "140",
  },
  {
    key: "{{aderencia_percent}}",
    label: "% de aderência ao ponto",
    source: "Calculado: (batendo ponto ÷ contratados) × 100",
    category: "metricas",
    example: "85%",
  },
  {
    key: "{{progress_percent}}",
    label: "Progresso do projeto",
    source: "Status Report → Média das fases macro",
    category: "metricas",
    example: "72%",
  },
  {
    key: "{{general_status}}",
    label: "Status geral do report",
    source: "Status Report → Status geral (No prazo/Em risco/Atrasado)",
    category: "metricas",
    example: "No prazo",
  },

  // ── Time Pontotel ──
  {
    key: "{{pontotel_manager_name}}",
    label: "Gerente Pontotel",
    source: "Projeto → Gerente Pontotel",
    category: "time_pontotel",
    example: "Fulano de Tal",
  },
  {
    key: "{{pontotel_manager_email}}",
    label: "E-mail Gerente Pontotel",
    source: "Projeto → E-mail do gerente",
    category: "time_pontotel",
    example: "gerente@pontotel.com.br",
  },
  {
    key: "{{pontotel_manager_phone}}",
    label: "Telefone Gerente Pontotel",
    source: "Projeto → Telefone do gerente",
    category: "time_pontotel",
    example: "(11) 99999-9999",
  },
  {
    key: "{{pontotel_analyst_name}}",
    label: "Analista de implantação",
    source: "Projeto → Analista de implantação",
    category: "time_pontotel",
    example: "Ciclano da Silva",
  },
  {
    key: "{{pontotel_analyst_email}}",
    label: "E-mail Analista de implantação",
    source: "Projeto → E-mail do analista",
    category: "time_pontotel",
    example: "analista@pontotel.com.br",
  },
  {
    key: "{{pontotel_analyst_phone}}",
    label: "Telefone Analista de implantação",
    source: "Projeto → Telefone do analista",
    category: "time_pontotel",
    example: "(11) 98888-8888",
  },

  // ── Time Cliente ──
  {
    key: "{{sponsor_name}}",
    label: "Patrocinador (cliente)",
    source: "Projeto → Nome do patrocinador",
    category: "time_cliente",
    example: "Diretor ABC",
  },
  {
    key: "{{sponsor_email}}",
    label: "E-mail Patrocinador",
    source: "Projeto → E-mail do patrocinador",
    category: "time_cliente",
    example: "patrocinador@cliente.com.br",
  },
  {
    key: "{{sponsor_phone}}",
    label: "Telefone Patrocinador",
    source: "Projeto → Telefone do patrocinador",
    category: "time_cliente",
    example: "(11) 97777-7777",
  },
  {
    key: "{{project_leader_name}}",
    label: "Líder do projeto (cliente)",
    source: "Projeto → Líder do projeto",
    category: "time_cliente",
    example: "Beltrano Oliveira",
  },
  {
    key: "{{project_leader_email}}",
    label: "E-mail Líder do projeto",
    source: "Projeto → E-mail do líder",
    category: "time_cliente",
    example: "lider@cliente.com.br",
  },
  {
    key: "{{project_leader_phone}}",
    label: "Telefone Líder do projeto",
    source: "Projeto → Telefone do líder",
    category: "time_cliente",
    example: "(11) 96666-6666",
  },
  {
    key: "{{operation_name}}",
    label: "Operação (cliente)",
    source: "Projeto → Nome da operação",
    category: "time_cliente",
    example: "Maria Operações",
  },
  {
    key: "{{operation_email}}",
    label: "E-mail Operação",
    source: "Projeto → E-mail da operação",
    category: "time_cliente",
    example: "operacao@cliente.com.br",
  },
  {
    key: "{{operation_phone}}",
    label: "Telefone Operação",
    source: "Projeto → Telefone da operação",
    category: "time_cliente",
    example: "(11) 95555-5555",
  },
  {
    key: "{{ti_client_name}}",
    label: "TI cliente",
    source: "Projeto → Nome do TI cliente",
    category: "time_cliente",
    example: "João TI",
  },
  {
    key: "{{ti_client_email}}",
    label: "E-mail TI cliente",
    source: "Projeto → E-mail do TI",
    category: "time_cliente",
    example: "ti@cliente.com.br",
  },
  {
    key: "{{ti_client_phone}}",
    label: "Telefone TI cliente",
    source: "Projeto → Telefone do TI",
    category: "time_cliente",
    example: "(11) 94444-4444",
  },
];

export const CATEGORY_LABELS = {
  projeto: "Identificação do Projeto",
  datas: "Datas",
  metricas: "Métricas do Status Report",
  time_pontotel: "Time Pontotel",
  time_cliente: "Time Cliente",
};

export const CATEGORY_COLORS = {
  projeto: "bg-blue-50 text-blue-700 border-blue-200",
  datas: "bg-amber-50 text-amber-700 border-amber-200",
  metricas: "bg-green-50 text-green-700 border-green-200",
  time_pontotel: "bg-purple-50 text-purple-700 border-purple-200",
  time_cliente: "bg-orange-50 text-orange-700 border-orange-200",
};

/**
 * Resolve todos os placeholders de um texto de adendo com dados reais.
 * @param {string} content - Texto do adendo com {{placeholders}}
 * @param {object} project - Objeto do projeto (campos planos)
 * @param {object} usabilitySnap - Snapshot de usabilidade
 * @returns {string} Texto com variáveis substituídas
 */
export function resolveAdendoVariables(content, project, usabilitySnap) {
  const contracted = project?.contracted_employees || 0;
  const batendo = usabilitySnap?.empregados_batendo_ponto_ultimos_15_dias || usabilitySnap?.recording_employees || 0;
  const cadastrados = usabilitySnap?.numero_funcionarios || usabilitySnap?.registered_employees || 0;
  const aderencia = contracted > 0 ? Math.round((batendo / contracted) * 100) : 0;

  const fmtDate = (d) => {
    if (!d) return "";
    try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
  };

  const fmtCurrency = (val) => {
    if (!val && val !== 0) return "";
    return `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const resolvers = {
    // Projeto
    "{{client_name}}":          project?.client_name || "",
    "{{implantation_type}}":    project?.implantation_type || "",
    "{{project_status}}":       project?.status || "",
    "{{current_phase}}":        project?.current_phase || "",
    "{{origin}}":               project?.origin || "",
    "{{mrr}}":                  fmtCurrency(project?.mrr),
    "{{drive_folder}}":         project?.drive_folder || "",
    // Datas
    "{{closure_date}}":         new Date().toLocaleDateString("pt-BR"),
    "{{start_date}}":           fmtDate(project?.start_date),
    "{{planned_end_date}}":     fmtDate(project?.planned_end_date),
    "{{aligned_end_date}}":     fmtDate(project?.aligned_end_date),
    // Métricas
    "{{contracted_employees}}": String(contracted),
    "{{registered_employees}}": String(cadastrados),
    "{{recording_employees}}":  String(batendo),
    "{{aderencia_percent}}":    `${aderencia}%`,
    "{{progress_percent}}":     `${project?.progress_percent || 0}%`,
    "{{general_status}}":       project?.status || "",
    // Time Pontotel
    "{{pontotel_manager_name}}":  project?.pontotel_manager_name || "",
    "{{pontotel_manager_email}}": project?.pontotel_manager_email || "",
    "{{pontotel_manager_phone}}": project?.pontotel_manager_phone || "",
    "{{pontotel_analyst_name}}":  project?.pontotel_analyst_name || "",
    "{{pontotel_analyst_email}}": project?.pontotel_analyst_email || "",
    "{{pontotel_analyst_phone}}": project?.pontotel_analyst_phone || "",
    // Time Cliente
    "{{sponsor_name}}":           project?.sponsor_name || "",
    "{{sponsor_email}}":          project?.sponsor_email || "",
    "{{sponsor_phone}}":          project?.sponsor_phone || "",
    "{{project_leader_name}}":    project?.project_leader_name || "",
    "{{project_leader_email}}":   project?.project_leader_email || "",
    "{{project_leader_phone}}":   project?.project_leader_phone || "",
    "{{operation_name}}":         project?.operation_name || "",
    "{{operation_email}}":        project?.operation_email || "",
    "{{operation_phone}}":        project?.operation_phone || "",
    "{{ti_client_name}}":         project?.ti_client_name || "",
    "{{ti_client_email}}":        project?.ti_client_email || "",
    "{{ti_client_phone}}":        project?.ti_client_phone || "",
  };

  let result = content || "";
  for (const [key, value] of Object.entries(resolvers)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
  }
  return result;
}