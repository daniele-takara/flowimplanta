// ============================================================
// LÓGICA DE GERAÇÃO DA TAP — baseada no escopo técnico
// ============================================================

import { CONTRACTED_MODULES_OPTIONS } from "@/lib/scopeTemplate";
import { PHASE_ORDER } from "@/lib/scheduleTasks";

// Extrai resposta de uma questão pelo ID a partir dos scopeItems ou answersMap
export function getAnswer(answersMap, questionId) {
  return answersMap?.[questionId] || "";
}

// Formata contato (email/phone) — prefere campos novos, fallback para _contact legado
function fmtContact(project, prefix) {
  const email = project[`${prefix}_email`] || "";
  const phone = project[`${prefix}_phone`] || "";
  if (email || phone) return [email, phone].filter(Boolean).join(" / ");
  return project[`${prefix}_contact`] || "";
}

// Gera lista de participantes estruturada
export function buildParticipants(project) {
  const parts = [];
  if (project.sponsor_name) parts.push({ role: "Patrocinador (Cliente)", name: project.sponsor_name, contact: fmtContact(project, "sponsor") });
  if (project.project_leader_name) parts.push({ role: "Líder do Projeto (Cliente)", name: project.project_leader_name, contact: fmtContact(project, "project_leader") });
  if (project.operation_name) parts.push({ role: "Operação (Cliente)", name: project.operation_name, contact: fmtContact(project, "operation") });
  if (project.ti_client_name) parts.push({ role: "TI (Cliente)", name: project.ti_client_name, contact: fmtContact(project, "ti_client") });
  if (project.pontotel_manager_name) parts.push({ role: "Gerente de Projeto (Pontotel)", name: project.pontotel_manager_name, contact: fmtContact(project, "pontotel_manager") });
  if (project.pontotel_analyst_name) parts.push({ role: "Analista de Implantação (Pontotel)", name: project.pontotel_analyst_name, contact: fmtContact(project, "pontotel_analyst") });
  return parts;
}

// Gera os blocos de CONDIÇÕES GERAIS — Dimensão
export function buildDimensao(project, answersMap) {
  return {
    funcionarios_contratados: project.contracted_employees || getAnswer(answersMap, "q001"),
    operacoes: getAnswer(answersMap, "q002"),
    implantation_type: project.implantation_type,
  };
}

// Gera datas importantes vindas do escopo técnico
export function buildDatas(project, answersMap) {
  return {
    inicio: project.start_date,
    prazo: project.planned_end_date,
    periodo_apuracao: getAnswer(answersMap, "q030"),
    periodo_folha: getAnswer(answersMap, "q031"),
    periodo_fechamento: getAnswer(answersMap, "q032"),
    prazo_contabilidade: getAnswer(answersMap, "q033"),
    data_pagamento: getAnswer(answersMap, "q034"),
    sistema_folha: getAnswer(answersMap, "q028"),
  };
}

// Lista de módulos com status contratado/não contratado
export function buildModulosStatus(project) {
  const contracted = project.contracted_modules || [];
  const services = project.contracted_services || [];
  return CONTRACTED_MODULES_OPTIONS.map(m => ({
    nome: m,
    contratado: contracted.includes(m),
  })).concat(
    (services || []).map(s => ({ nome: s, contratado: true, isService: true }))
  );
}

// REGRAS CONDICIONAIS DE ENTREGAS
// Cada entrega tem: label, condition(answersMap, project) → boolean
export const ENTREGAS_CONDICIONAIS = [
  // ── MÓDULO REGISTRO DE PONTO ────────────────────────────
  {
    grupo: "Registro de Ponto",
    label: "Implantação e parametrização do módulo de Registro de Ponto",
    condition: (a, p) => (p.contracted_modules || []).includes("Registro de Ponto"),
  },
  {
    grupo: "Registro de Ponto",
    label: "Configuração de App Bateponto para colaboradores",
    condition: (a) => {
      const q15 = getAnswer(a, "q015");
      return q15.includes("App Bateponto");
    },
  },
  {
    grupo: "Registro de Ponto",
    label: "Configuração de App Gestão para colaboradores",
    condition: (a) => {
      const q14 = getAnswer(a, "q014");
      const q15 = getAnswer(a, "q015");
      return q14 === "Pontotel Gestão" || q15.includes("App Gestão");
    },
  },
  {
    grupo: "Registro de Ponto",
    label: "Configuração de Bate Ponto Web para colaboradores",
    condition: (a) => getAnswer(a, "q015").includes("Bate ponto web"),
  },
  {
    grupo: "Registro de Ponto",
    label: "Importação de arquivo AFD para validação de cálculos",
    condition: (a) => {
      const q15 = getAnswer(a, "q015");
      const q23 = getAnswer(a, "q023");
      return q15.includes("AFD importação") || q23 === "Arquivo AFD";
    },
  },
  {
    grupo: "Registro de Ponto",
    label: "Configuração de Ponto por Exceção",
    condition: (a) => getAnswer(a, "q015").includes("Ponto por exceção"),
  },
  {
    grupo: "Registro de Ponto",
    label: "Ativação de notificações de aviso para registro de ponto",
    condition: (a) => getAnswer(a, "q019") === "Sim",
  },

  // ── REDUÇÃO DE RISCO ────────────────────────────────────
  {
    grupo: "Redução de Riscos no Registro",
    label: "Configuração de cerca virtual (geolocalização) para controle de registro",
    condition: (a, p) => (p.contracted_modules || []).includes("Redução de Riscos no Registro") && getAnswer(a, "q020") === "Sim",
  },
  {
    grupo: "Redução de Riscos no Registro",
    label: "Configuração de reconhecimento facial para registro de ponto",
    condition: (a, p) => (p.contracted_modules || []).includes("Redução de Riscos no Registro") && getAnswer(a, "q021") === "Reconhecimento facial",
  },

  // ── CÁLCULOS E TRATAMENTO ───────────────────────────────
  {
    grupo: "Cálculos e Tratamento",
    label: "Parametrização de regras de cálculo e tratamento da folha de ponto",
    condition: (a, p) => (p.contracted_modules || []).includes("Cálculos e Tratamento"),
  },
  {
    grupo: "Cálculos e Tratamento",
    label: "Parametrização de arquivo de exportação de verbas para folha de pagamento",
    condition: (a, p) => {
      const q3 = getAnswer(a, "q003");
      return (p.contracted_modules || []).includes("Cálculos e Tratamento") && q3 && q3.toLowerCase() !== "não" && q3.toLowerCase() !== "nao";
    },
  },

  // ── INTEGRAÇÃO SANKHYA ──────────────────────────────────
  {
    grupo: "Integração Sankhya",
    label: "Integração com folha de pagamento Sankhya (Pessoal+ / MGE)",
    condition: (a, p) => p.origin === "Sankhya" || (p.contracted_services || []).some(s => s.includes("Sankhya")),
  },
  {
    grupo: "Integração Sankhya",
    label: "Ativação de integração Sankhya após conclusão da implantação",
    condition: (a, p) => (p.origin === "Sankhya" || (p.contracted_services || []).some(s => s.includes("Sankhya"))) && getAnswer(a, "q004") === "Não",
  },

  // ── GESTÃO DE PONTO PARTICIPATIVA ───────────────────────
  {
    grupo: "Gestão de Ponto Participativa",
    label: "Configuração de fluxo de solicitação e aprovação de correção de ponto",
    condition: (a, p) => (p.contracted_modules || []).includes("Gestão de Ponto Participativa"),
  },
  {
    grupo: "Gestão de Ponto Participativa",
    label: "Configuração de fluxo de atestados médicos",
    condition: (a, p) => (p.contracted_modules || []).includes("Gestão de Ponto Participativa"),
  },
  {
    grupo: "Gestão de Ponto Participativa",
    label: "Ativação de assinatura digital do espelho de ponto",
    condition: (a, p) => (p.contracted_modules || []).includes("Gestão de Ponto Participativa") && getAnswer(a, "q049") === "Sim",
  },

  // ── CONTROLE DE CUSTOS ──────────────────────────────────
  {
    grupo: "Controle de Custos",
    label: "Configuração do módulo de controle e aprovação de horas extras",
    condition: (a, p) => (p.contracted_modules || []).includes("Controle de Custos"),
  },
  {
    grupo: "Controle de Custos",
    label: "Ativação de notificações relacionadas a horas extras",
    condition: (a, p) => (p.contracted_modules || []).includes("Controle de Custos") && getAnswer(a, "q062") === "Sim",
  },
  {
    grupo: "Controle de Custos",
    label: "Configuração de justificativa por áudio para horas extras",
    condition: (a, p) => (p.contracted_modules || []).includes("Controle de Custos") && getAnswer(a, "q061") === "Sim",
  },

  // ── GESTÃO DE FÉRIAS ────────────────────────────────────
  {
    grupo: "Gestão de Férias e Ausências",
    label: "Configuração do módulo de Gestão de Férias e Ausências",
    condition: (a, p) => (p.contracted_modules || []).includes("Gestão de Férias e Ausências"),
  },
  {
    grupo: "Gestão de Férias e Ausências",
    label: "Configuração de fluxo de solicitação e aprovação de férias por colaborador",
    condition: (a, p) => (p.contracted_modules || []).includes("Gestão de Férias e Ausências") && getAnswer(a, "q063") === "Sim",
  },

  // ── TIMESHEET ───────────────────────────────────────────
  {
    grupo: "Timesheet",
    label: "Parametrização do módulo de Timesheet (controle de atividades)",
    condition: (a, p) => (p.contracted_modules || []).includes("Timesheet") && getAnswer(a, "q068") === "Sim",
  },

  // ── SEMPRE PRESENTES ────────────────────────────────────
  {
    grupo: "Geral",
    label: "Cadastro e importação de colaboradores e jornadas",
    condition: () => true,
  },
  {
    grupo: "Geral",
    label: "Realização de homologação com validação pelo cliente",
    condition: () => true,
  },
  {
    grupo: "Geral",
    label: "Go-live e suporte no período inicial de operação",
    condition: () => true,
  },
  {
    grupo: "Geral",
    label: "Treinamento de gestores e usuários-chave",
    condition: (a, p) => (p.contracted_services || []).some(s => s.toLowerCase().includes("treinamento")) || true,
  },
];

export function buildEntregas(answersMap, project) {
  return ENTREGAS_CONDICIONAIS.filter(e => e.condition(answersMap, project));
}

// Cronograma macro — sincronizado com PHASE_ORDER (scheduleTasks) para consistência total
const FASE_DESCRICAO = {
  "Abertura de projeto": "Kick-off, alinhamento de escopo e apresentação da equipe",
  "Integração": "Integração com sistemas do cliente (ex: Sankhya) quando aplicável",
  "Cadastros": "Importação de cadastros e configuração de locais de trabalho",
  "Parametrização": "Configuração do sistema conforme escopo técnico definido",
  "Treinamento e Validações": "Treinamentos e validações das parametrizações com o cliente",
  "Operação Assistida": "Início de registro de ponto e operação assistida (Go-live)",
  "Fechamento de Folha": "Fechamento de folha de ponto com o cliente",
  "Expansão": "Expansão do sistema para 100% da base de funcionários",
  "Encerramento": "Assinatura do termo de encerramento e passagem para Sucesso do Cliente",
};

export const FASES_MACRO = PHASE_ORDER.map(fase => ({
  fase,
  descricao: FASE_DESCRICAO[fase] || fase,
}));

// Texto de conclusão padrão
export function buildConclusao(project) {
  return `O presente Termo de Abertura do Projeto formaliza o início da implantação do sistema Pontotel na empresa ${project?.client_name || ""}, estabelecendo os objetivos, participantes, entregas e condições acordadas entre as partes. A execução deste projeto está condicionada ao cumprimento das premissas e responsabilidades definidas, visando garantir o sucesso da implantação dentro do prazo e escopo contratados.`;
}