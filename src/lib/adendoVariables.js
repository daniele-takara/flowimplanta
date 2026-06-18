/**
 * Definição centralizada de variáveis disponíveis para templates de adendos.
 * Cada variável tem:
 * - key: placeholder a ser usado no texto (ex: {{client_name}})
 * - label: nome amigável
 * - source: descrição de onde o dado é puxado
 * - category: agrupamento visual (projeto, métricas, datas, time)
 * - example: valor de exemplo para pré-visualização
 */

export const ADENDO_VARIABLES = [
  {
    key: "{{client_name}}",
    label: "Nome do cliente",
    source: "Projeto → Nome do cliente/Empresa",
    category: "projeto",
    example: "Empresa XYZ Ltda",
  },
  {
    key: "{{closure_date}}",
    label: "Data de encerramento",
    source: "Data atual no momento da geração do PDF",
    category: "datas",
    example: new Date().toLocaleDateString("pt-BR"),
  },
  {
    key: "{{aderencia_percent}}",
    label: "% de aderência ao ponto",
    source: "Calculado: (batendo ponto / contratados) × 100",
    category: "metricas",
    example: "85%",
  },
  {
    key: "{{registered_employees}}",
    label: "Funcionários cadastrados",
    source: "Usabilidade → número de funcionários",
    category: "metricas",
    example: "164",
  },
  {
    key: "{{contracted_employees}}",
    label: "Funcionários contratados",
    source: "Projeto → Funcionários contratados",
    category: "metricas",
    example: "200",
  },
  {
    key: "{{implantation_type}}",
    label: "Tipo de implantação",
    source: "Projeto → Tipo de implantação",
    category: "projeto",
    example: "Implantação Pontotel",
  },
  {
    key: "{{pontotel_manager_name}}",
    label: "Gerente Pontotel",
    source: "Projeto → Gerente Pontotel",
    category: "time",
    example: "Fulano de Tal",
  },
  {
    key: "{{pontotel_analyst_name}}",
    label: "Analista de implantação",
    source: "Projeto → Analista de implantação",
    category: "time",
    example: "Ciclano da Silva",
  },
  {
    key: "{{project_leader_name}}",
    label: "Líder do projeto (cliente)",
    source: "Projeto → Líder do projeto",
    category: "time",
    example: "Beltrano Oliveira",
  },
  {
    key: "{{sponsor_name}}",
    label: "Patrocinador",
    source: "Projeto → Patrocinador",
    category: "time",
    example: "Diretor ABC",
  },
];

export const CATEGORY_LABELS = {
  projeto: "Dados do Projeto",
  metricas: "Métricas Calculadas",
  datas: "Datas",
  time: "Time do Projeto",
};

export const CATEGORY_COLORS = {
  projeto: "bg-blue-50 text-blue-700 border-blue-200",
  metricas: "bg-green-50 text-green-700 border-green-200",
  datas: "bg-amber-50 text-amber-700 border-amber-200",
  time: "bg-purple-50 text-purple-700 border-purple-200",
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
  const batendo = usabilitySnap?.empregados_batendo_ponto_ultimos_15_dias || 0;
  const cadastrados = usabilitySnap?.numero_funcionarios || 0;
  const aderencia = contracted > 0 ? Math.round((batendo / contracted) * 100) : 0;

  const fmtDate = (d) => {
    if (!d) return new Date().toLocaleDateString("pt-BR");
    try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
  };

  const resolvers = {
    "{{client_name}}":          project?.client_name || "",
    "{{closure_date}}":         new Date().toLocaleDateString("pt-BR"),
    "{{aderencia_percent}}":    `${aderencia}%`,
    "{{registered_employees}}": String(cadastrados),
    "{{contracted_employees}}": String(contracted),
    "{{implantation_type}}":    project?.implantation_type || "",
    "{{pontotel_manager_name}}": project?.pontotel_manager_name || "",
    "{{pontotel_analyst_name}}": project?.pontotel_analyst_name || "",
    "{{project_leader_name}}":  project?.project_leader_name || "",
    "{{sponsor_name}}":         project?.sponsor_name || "",
  };

  let result = content || "";
  for (const [key, value] of Object.entries(resolvers)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
  }
  return result;
}