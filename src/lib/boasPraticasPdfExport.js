// ============================================================
// Geração de PDFs de "Boas Práticas" — Template de referência
// Um PDF por aba do projeto, com todos os campos e opções.
// ============================================================

import jsPDF from "jspdf";
import { SCOPE_MODULES, CONTRACTED_MODULES_OPTIONS } from "@/lib/scopeTemplate";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks";
import { STEPS, FATORES_OPTIONS } from "@/lib/calcRulesShared";
import { FASES_MACRO, ENTREGAS_CONDICIONAIS } from "@/lib/tapTemplate";

const LOGO_URL = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/09fa0a8a2_LogoPontotel_AmarelaePreta.png";
const PURPLE = [121, 57, 125];
const YELLOW = [244, 196, 48];
const TEXT_DARK = [30, 30, 40];
const TEXT_MUTED = [110, 110, 120];
const TEXT_WHITE = [255, 255, 255];
const BG_LIGHT = [248, 246, 248];
const BORDER = [220, 220, 230];

const M = 15;
const PW = 180;
const PAGE_H = 297;
const BOTTOM_LIMIT = 280;

// ── Helpers ──────────────────────────────────────────────────

function ensureSpace(ctx, needed) {
  if (ctx.y + needed > BOTTOM_LIMIT) {
    addPage(ctx);
  }
}

function addPage(ctx) {
  ctx.doc.addPage();
  ctx.pageNum++;
  ctx.totalPages++;
  drawHeader(ctx);
  ctx.y = 30;
}

function drawHeader(ctx) {
  const { doc } = ctx;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, 210, 18, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(0, 18, 210, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_WHITE);
  doc.text(ctx.title, M, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Template de Boas Práticas — Pontotel", M + PW - 70, 12);
}

function drawFooter(ctx) {
  const { doc, pageNum, totalPages } = ctx;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, 285, M + PW, 285);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Página ${pageNum} de ${totalPages}`, M + PW - 30, 291);
  doc.text("Documento de referência — preencher conforme realidade do projeto", M, 291);
}

function sectionTitle(ctx, label) {
  ensureSpace(ctx, 14);
  const { doc } = ctx;
  doc.setFillColor(...PURPLE);
  doc.roundedRect(M, ctx.y, PW, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_WHITE);
  doc.text(label, M + 3, ctx.y + 5.5);
  ctx.y += 12;
}

function subSection(ctx, label) {
  ensureSpace(ctx, 10);
  const { doc } = ctx;
  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(M, ctx.y, PW, 6.5, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PURPLE);
  doc.text(label, M + 2.5, ctx.y + 4.5);
  ctx.y += 9;
}

function fieldRow(ctx, label, options, required = false) {
  const labelLines = doc_splitText(ctx.doc, `${label}${required ? " *" : ""}:`, PW * 0.42, 8.5);
  const optText = Array.isArray(options) ? options.join("  |  ") : (options || "—");
  const optLines = doc_splitText(ctx.doc, optText, PW * 0.54, 8);
  const lines = Math.max(labelLines.length, optLines.length);
  const rowH = lines * 4.2 + 2.5;
  ensureSpace(ctx, rowH + 1);
  const { doc } = ctx;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(M, ctx.y, M + PW, ctx.y);
  ctx.y += 1.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text(labelLines, M + 1, ctx.y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(optLines, M + PW * 0.44, ctx.y + 3);
  ctx.y += rowH;
}

function doc_splitText(doc, text, maxWidth, fontSize) {
  doc.setFontSize(fontSize || 8);
  return doc.splitTextToSize(text, maxWidth);
}

function paragraph(ctx, text, opts = {}) {
  const fontSize = opts.fontSize || 8.5;
  const fontStyle = opts.fontStyle || "normal";
  const color = opts.color || TEXT_MUTED;
  const indent = opts.indent || 0;
  const { doc } = ctx;
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, PW - indent);
  for (const line of lines) {
    ensureSpace(ctx, 4.5);
    doc.text(line, M + indent, ctx.y + 3);
    ctx.y += 4.2;
  }
  ctx.y += 1.5;
}

function questionBlock(ctx, q) {
  ensureSpace(ctx, 12);
  const { doc } = ctx;
  // Question label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  const qLabel = `Q${String(q.order).padStart(3, "0")} — ${q.prompt}`;
  const qLines = doc.splitTextToSize(qLabel, PW - 4);
  doc.text(qLines, M + 2, ctx.y + 3);
  ctx.y += qLines.length * 4 + 1;

  // Type + options
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  const typeLabel = `Tipo: ${q.type}${q.options?.length ? `  |  Opções: ${q.options.join(", ")}` : ""}`;
  const tLines = doc.splitTextToSize(typeLabel, PW - 8);
  doc.text(tLines, M + 4, ctx.y + 3);
  ctx.y += tLines.length * 3.5 + 1;

  // Description (boas práticas)
  if (q.description) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...[90, 90, 100]);
    const dLines = doc.splitTextToSize(`Boa prática: ${q.description}`, PW - 8);
    doc.text(dLines, M + 4, ctx.y + 3);
    ctx.y += dLines.length * 3.5 + 1;
  }

  // Rules (conditional visibility)
  if (q.rules?.length) {
    const visRule = q.rules.find(r => r.type === "conditional_visibility");
    if (visRule) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...[150, 80, 150]);
      const rText = `Visibilidade condicional: depende de ${visRule.dependsOn} = ${visRule.condition?.value}`;
      doc.text(rText, M + 4, ctx.y + 3);
      ctx.y += 3.5;
    }
  }

  // Answer line (blank for template)
  ctx.y += 1;
  doc.setDrawColor(...[200, 200, 210]);
  doc.setLineWidth(0.3);
  doc.line(M + 4, ctx.y + 4, M + PW - 4, ctx.y + 4);
  ctx.y += 7;
}

function taskRow(ctx, task, idx) {
  ensureSpace(ctx, 8);
  const { doc } = ctx;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  const isGroup = task.type === "group" || task.type === "subgroup";
  const prefix = isGroup ? "▸ " : "• ";
  const label = `${prefix}${task.activity}`;
  const lLines = doc.splitTextToSize(label, PW * 0.62);
  doc.text(lLines, M + (isGroup ? 2 : 6), ctx.y + 3);

  // Visibility condition
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  let visText = "Sempre visível";
  if (task.visibleWhen && typeof task.visibleWhen === "object") {
    visText = `Visível quando: ${task.visibleWhen.source} ${task.visibleWhen.equals ? `= ${task.visibleWhen.equals}` : task.visibleWhen.contains ? `contém ${task.visibleWhen.contains}` : ""}`;
  } else if (task.visibleWhenAny) {
    visText = `Visível quando (qualquer): ${task.visibleWhenAny.map(v => `${v.source} ${v.equals ? `= ${v.equals}` : v.contains ? `contém ${v.contains}` : ""}`).join(" OU ")}`;
  } else if (task.visibleWhenAll) {
    visText = `Visível quando (todas): ${task.visibleWhenAll.map(v => `${v.source} ${v.notContains ? `não contém ${v.notContains}` : v.contains ? `contém ${v.contains}` : ""}`).join(" E ")}`;
  }
  const vLines = doc.splitTextToSize(visText, PW * 0.34);
  doc.text(vLines, M + PW * 0.64, ctx.y + 3);

  // Responsible
  const resp = task.responsibleGeneral || "—";
  doc.setFontSize(7);
  doc.setTextColor(...[100, 100, 110]);
  doc.text(`Resp: ${resp}`, M + PW * 0.64, ctx.y + 3 + vLines.length * 3);

  ctx.y += Math.max(lLines.length * 3.5, vLines.length * 3 + 3.5) + 1.5;
}

// ── Logo loader ──────────────────────────────────────────────
let _logoCache = null;
async function loadLogo() {
  if (_logoCache !== null) return _logoCache;
  try {
    const r = await fetch(LOGO_URL);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let b = "";
      for (let i = 0; i < bytes.length; i += 8192) b += String.fromCharCode(...bytes.slice(i, i + 8192));
      _logoCache = `data:image/png;base64,${btoa(b)}`;
      return _logoCache;
    }
  } catch (_) {}
  _logoCache = false;
  return false;
}

// ============================================================
// CONTEÚDO DE CADA ABA
// ============================================================

const TABS_META = [
  { key: "overview", label: "Dados Iniciais" },
  { key: "scope", label: "Escopo Técnico" },
  { key: "tap", label: "TAP" },
  { key: "calc", label: "Regras de Cálculo" },
  { key: "schedule", label: "Cronograma" },
  { key: "status", label: "Status Report" },
  { key: "actions", label: "Plano de Ação" },
  { key: "termo", label: "Termo de Encerramento" },
  { key: "audit", label: "Histórico" },
];

// ── 1. Dados Iniciais ────────────────────────────────────────
function buildOverview(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Dados Iniciais — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "Este documento lista todos os campos e opções da aba Dados Iniciais. Utilize como guia de preenchimento para cada projeto de implantação.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Dados do Projeto");
  fieldRow(ctx, "Nome do projeto", "Texto livre", true);
  fieldRow(ctx, "Cliente / Empresa", "Texto livre", true);
  fieldRow(ctx, "ID da Empresa", "Texto alfanumérico (extraído do e-mail lar21@<id>.com.br)");
  fieldRow(ctx, "Origem do cliente", ["Pontotel", "Parceiro", "Indicação", "Inbound", "Outbound"]);
  fieldRow(ctx, "Tipo de Implantação", ["Implantação Pontotel", "Implantação com integração Sankhya", "Implantação com integração Sankhya adiada", "Implantação Pontotel com parametrizações não finalizadas", "Implantação com integração Sankhya adiada e parametrizações não finalizadas"]);
  fieldRow(ctx, "Status", ["Em aberto", "Em andamento", "Concluído", "Perdido", "Pausado"]);
  fieldRow(ctx, "Fase Atual", ["Abertura de projeto", "Parametrização", "Homologação", "Rollout", "Go-live", "Concluído"]);
  fieldRow(ctx, "Data de Início", "Data (dd/mm/aaaa)");
  fieldRow(ctx, "Previsão de Conclusão", "Data (dd/mm/aaaa)");
  fieldRow(ctx, "Data Alinhada", "Data (dd/mm/aaaa)");
  fieldRow(ctx, "Funcionários Contratados", "Número");
  fieldRow(ctx, "Funcionários Cadastrados", "Número");
  fieldRow(ctx, "Funcionários Registrando Ponto", "Número");
  fieldRow(ctx, "Progresso Geral (%)", "0–100");
  fieldRow(ctx, "MRR", "Valor (R$)");
  fieldRow(ctx, "ID Deal Pipedrive", "Número");
  fieldRow(ctx, "Pipeline Pipedrive", "Texto");
  fieldRow(ctx, "Lar21", "Texto (vínculo Pipedrive)");
  fieldRow(ctx, "Pasta do Drive", "URL");
  fieldRow(ctx, "Observações", "Texto livre");

  sectionTitle(ctx, "Módulos Contratados");
  paragraph(ctx, "Selecione um ou mais módulos contratados pelo cliente:", { fontSize: 8 });
  CONTRACTED_MODULES_OPTIONS.forEach(m => fieldRow(ctx, m, ["Sim", "Não"]));

  sectionTitle(ctx, "Serviços Contratados");
  paragraph(ctx, "Lista livre de serviços contratados (ex: Arquivo txt de exportação para FOPAG, Integração Sankhya, Integrações (disponibilização de API), Importação de arquivo AFD em nuvem, Treinamento).", { fontSize: 8 });

  sectionTitle(ctx, "Equipe Pontotel");
  subSection(ctx, "Gerente de Projeto");
  fieldRow(ctx, "Nome", "Texto");
  fieldRow(ctx, "E-mail", "E-mail");
  fieldRow(ctx, "Telefone", "Texto");
  subSection(ctx, "Analista de Implantação");
  fieldRow(ctx, "Nome", "Texto");
  fieldRow(ctx, "E-mail", "E-mail");
  fieldRow(ctx, "Telefone", "Texto");

  sectionTitle(ctx, "Equipe Cliente");
  subSection(ctx, "Patrocinador");
  fieldRow(ctx, "Nome / E-mail / Telefone", "Texto / E-mail / Texto");
  subSection(ctx, "Líder do Projeto");
  fieldRow(ctx, "Nome / E-mail / Telefone", "Texto / E-mail / Texto");
  subSection(ctx, "Operação");
  fieldRow(ctx, "Nome / E-mail / Telefone", "Texto / E-mail / Texto");
  subSection(ctx, "TI");
  fieldRow(ctx, "Nome / E-mail / Telefone", "Texto / E-mail / Texto");

  sectionTitle(ctx, "Membros Adicionais da Equipe");
  paragraph(ctx, "Membros extras podem ser cadastrados com: Equipe (Pontotel/Cliente), Nome, Função/Cargo, E-mail e Telefone.", { fontSize: 8 });

  return ctx;
}

// ── 2. Escopo Técnico ────────────────────────────────────────
function buildScope(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Escopo Técnico — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O Escopo Técnico é composto por módulos de perguntas. Cada módulo possui campos com tipo, opções e boas práticas orientativas. O preenchimento correto garante uma parametrização adequada do sistema.", { fontSize: 8, color: TEXT_MUTED });

  for (const mod of SCOPE_MODULES) {
    sectionTitle(ctx, `${mod.moduleOrder}. ${mod.moduleLabel}`);
    let visText = "Sempre visível";
    if (mod.alwaysVisible) visText = "Sempre visível";
    else if (mod.autoShowWhen) visText = `Automático quando Origem = ${mod.autoShowWhen.value} (ou inclusão manual)`;
    else if (mod.showWhenContractedModule) visText = `Visível quando módulo contratado = ${mod.showWhenContractedModule}`;
    paragraph(ctx, `Visibilidade: ${visText}`, { fontSize: 7.5, color: [100, 100, 110] });

    if (mod.subsections) {
      for (const sub of mod.subsections) {
        subSection(ctx, sub.label);
        for (const q of sub.questions) questionBlock(ctx, q);
      }
    } else if (mod.questions) {
      for (const q of mod.questions) questionBlock(ctx, q);
    }
  }

  return ctx;
}

// ── 3. TAP ──────────────────────────────────────────────────
function buildTAP(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "TAP — Termo de Abertura do Projeto — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O TAP formaliza o início da implantação. Os campos abaixo devem ser preenchidos e validados com o cliente.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Dados do Documento (TAP)");
  fieldRow(ctx, "Objetivo do projeto", "Texto livre");
  fieldRow(ctx, "Descrição do escopo", "Texto livre");
  fieldRow(ctx, "Fora do escopo", "Texto livre");
  fieldRow(ctx, "Entregáveis", "Lista de itens");
  fieldRow(ctx, "Premissas", "Texto livre");
  fieldRow(ctx, "Restrições", "Texto livre");
  fieldRow(ctx, "Resumo de riscos", "Texto livre");
  fieldRow(ctx, "Critérios de sucesso", "Texto livre");
  fieldRow(ctx, "Data de assinatura", "Data");
  fieldRow(ctx, "Assinado por (Cliente)", "Texto");
  fieldRow(ctx, "Assinado por (Pontotel)", "Texto");
  fieldRow(ctx, "Observações adicionais", "Texto livre");

  sectionTitle(ctx, "Versões da TAP");
  fieldRow(ctx, "Número da versão", "Número (1, 2, 3...)");
  fieldRow(ctx, "Status", ["Rascunho", "Finalizada", "Enviada ao cliente"]);
  fieldRow(ctx, "Criado por", "Texto (nome do usuário)");
  fieldRow(ctx, "Objetivo (versão)", "Texto livre");
  fieldRow(ctx, "Formato de expansão", "Texto livre");
  fieldRow(ctx, "Expectativa de início da expansão", "Texto");
  fieldRow(ctx, "Conclusão", "Texto livre");
  fieldRow(ctx, "Versão atual (is_current)", ["Sim", "Não"]);

  sectionTitle(ctx, "Fases Macro do Cronograma");
  for (const f of FASES_MACRO) {
    subSection(ctx, f.fase);
    paragraph(ctx, f.descricao, { fontSize: 8, color: TEXT_MUTED });
  }

  sectionTitle(ctx, "Entregas Condicionais (todas as possíveis)");
  const grupos = {};
  ENTREGAS_CONDICIONAIS.forEach(e => { (grupos[e.grupo] = grupos[e.grupo] || []).push(e.label); });
  for (const [grupo, items] of Object.entries(grupos)) {
    subSection(ctx, grupo);
    items.forEach(label => paragraph(ctx, `• ${label}`, { fontSize: 8, indent: 2 }));
  }

  sectionTitle(ctx, "Participantes");
  ["Patrocinador (Cliente)", "Líder do Projeto (Cliente)", "Operação (Cliente)", "TI (Cliente)", "Gerente de Projeto (Pontotel)", "Analista de Implantação (Pontotel)"].forEach(role => {
    paragraph(ctx, `• ${role} — Nome e contato (e-mail/telefone)`, { fontSize: 8, indent: 2 });
  });

  return ctx;
}

// ── 4. Regras de Cálculo ─────────────────────────────────────
const CALC_STEP_FIELDS = {
  company_data: [
    { label: "Responsável pelo preenchimento", type: "Texto" },
    { label: "Período de apuração da folha de ponto", type: "Dia inicial (1–31) e dia final (1–31)" },
    { label: "Modo de registro de ponto", type: ["Registro individual", "Registro coletivo"], required: true },
    { label: "Aparelho utilizado para registro", type: ["Celular pessoal do colaborador", "Celular coletivo", "Tablet coletivo", "Computador"], required: true },
    { label: "Regras de cálculo (nomes)", type: "Lista livre (ex: Matriz, Filial SP, Filial RJ...)" },
    { label: "Possui Adicional Noturno", type: ["Sim", "Não"] },
    { label: "Possui Jornada 12x36", type: ["Sim", "Não"] },
    { label: "Possui Banco de Horas", type: ["Sim", "Não"] },
    { label: "Incluir observações", type: ["Sim", "Não"] },
    { label: "Observações", type: "Texto livre" },
  ],
  rule_configurations: [
    { label: "Modelo de cálculo", type: ["Fixo (entrada/saída)", "Flexível (períodos com compensação automática)", "Híbrido (duração com tolerância)"] },
    { label: "Configurações gerais das regras", type: "Conforme modelo escolhido" },
  ],
  overtime_rules: [
    { label: "Fatores de apontamento", type: FATORES_OPTIONS.map(f => f.label) },
    { label: "Percentual de hora extra", type: "Número (%)" },
    { label: "Aplicação do percentual", type: ["Sobre valor da hora", "Sobre salário base"] },
    { label: "Categorização de HE (diária)", type: "Configurável por faixas" },
    { label: "Categorização de HE (mensal)", type: "Configurável por faixas" },
    { label: "FOPAG (verbas para folha de pagamento)", type: "Configurável" },
  ],
  break_time_rules: [
    { label: "Tolerância de intervalo", type: "Configurável (minutos)" },
    { label: "Pausa e excesso de pausa", type: "Configurável" },
    { label: "Tratamento de intervalo não realizado", type: ["Considerar como hora extra", "Não considerar como hora extra"] },
  ],
  night_shift_rules: [
    { label: "Redução da hora noturna", type: "Configurável (ex: 52min30s)" },
    { label: "Prorrogação do adicional noturno", type: ["Prorrogar", "Não prorrogar"] },
    { label: "Percentual do adicional noturno", type: "Número (%)" },
    { label: "Adicional inclui pausa", type: ["Sim", "Não"] },
  ],
  shift_12x36_rules: [
    { label: "Tratamento de feriado na jornada 12x36", type: "Configurável" },
    { label: "Configurações específicas 12x36", type: "Conforme regras da empresa" },
  ],
  sobreaviso_rules: [
    { label: "Configuração de sobreaviso", type: "Conforme regras da empresa (aplicável quando possuir sobreaviso)" },
  ],
  dsr_rules: [
    { label: "DSR sobre horas extras em feriados", type: "Configurável" },
    { label: "Mês de desconto do DSR", type: "Configurável" },
  ],
  bank_hours_rules: [
    { label: "Modelo de banco de horas", type: ["Compensação Geral", "Por Janela"] },
    { label: "Acúmulo e transformação", type: "Configurável (fatores de transformação)" },
  ],
  other_verbs_rules: [
    { label: "Outras verbas", type: "Lista livre de verbas adicionais" },
  ],
};

function buildCalc(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Regras de Cálculo — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "As Regras de Cálculo definem como a folha de ponto será calculada. O wizard é composto por passos sequenciais. Os campos e opções de cada passo estão listados abaixo.", { fontSize: 8, color: TEXT_MUTED });

  for (const step of STEPS) {
    if (!step.key) {
      sectionTitle(ctx, `${step.id}. ${step.title}`);
      paragraph(ctx, "Revisão final de todas as regras configuradas antes do envio ao time de implantação.", { fontSize: 8, color: TEXT_MUTED });
      continue;
    }
    sectionTitle(ctx, `${step.id}. ${step.title}`);
    const fields = CALC_STEP_FIELDS[step.key] || [];
    for (const f of fields) {
      fieldRow(ctx, f.label, f.type, f.required);
    }
    paragraph(ctx, " ", { fontSize: 6 });
  }

  return ctx;
}

// ── 5. Cronograma ────────────────────────────────────────────
function buildSchedule(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Cronograma — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O cronograma é estruturado em fases e atividades. Cada atividade possui responsável, tipo de data (âncora/calculada/manual) e condição de visibilidade. Abaixo estão todas as fases e atividades do template oficial.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Fases do Cronograma");
  PHASE_ORDER.forEach((phase, i) => {
    paragraph(ctx, `${i + 1}. ${phase}`, { fontSize: 9, fontStyle: "bold", color: TEXT_DARK, indent: 2 });
  });

  sectionTitle(ctx, "Atividades do Template");
  for (const phase of PHASE_ORDER) {
    subSection(ctx, phase);
    const tasks = SCHEDULE_TASKS.filter(t => t.phase === phase);
    tasks.forEach((t, i) => taskRow(ctx, t, i));
  }

  sectionTitle(ctx, "Campos de Cada Atividade");
  fieldRow(ctx, "Fase", PHASE_ORDER);
  fieldRow(ctx, "Nome da atividade", "Texto");
  fieldRow(ctx, "Responsável geral", ["Pontotel", "Cliente", "Pontotel + Cliente", "Compartilhado"]);
  fieldRow(ctx, "Responsável líder (papel)", ["gerente_projeto", "analista_implantacao", "patrocinador", "lider_projeto", "ti", "operacao"]);
  fieldRow(ctx, "Duração (dias úteis)", "Número");
  fieldRow(ctx, "Início planejado", "Data (âncora, calculada ou manual)");
  fieldRow(ctx, "Fim planejado", "Data (calculada ou manual)");
  fieldRow(ctx, "Início real", "Data");
  fieldRow(ctx, "Fim real", "Data");
  fieldRow(ctx, "Status", ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"]);
  fieldRow(ctx, "Observações / histórico", "Texto livre");

  sectionTitle(ctx, "Datas Âncora (editáveis)");
  ["Alinhamento inicial", "Go-live registro de ponto", "Agenda fechamento de folha", "Expansão de registro de ponto real", "Agenda encerramento de projeto"].forEach(a => {
    paragraph(ctx, `• ${a}`, { fontSize: 8, indent: 2 });
  });

  return ctx;
}

// ── 6. Status Report ─────────────────────────────────────────
function buildStatus(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Status Report — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O Status Report consolida o acompanhamento do projeto para reporte executivo.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Dados do Status Report");
  fieldRow(ctx, "Data do report", "Data (dd/mm/aaaa)", true);
  fieldRow(ctx, "Progresso geral (%)", "0–100 (calculado pelas fases macro)");
  fieldRow(ctx, "Resumo executivo", "Texto livre");
  fieldRow(ctx, "Funcionários cadastrados", "Número");
  fieldRow(ctx, "Funcionários registrando ponto", "Número");
  fieldRow(ctx, "Aderência (%)", "0–100");
  fieldRow(ctx, "Status geral", ["No prazo", "Em risco", "Atrasado", "Concluído"]);
  fieldRow(ctx, "Próxima agenda", "Texto");
  fieldRow(ctx, "Data da próxima agenda", "Data");

  sectionTitle(ctx, "Riscos");
  paragraph(ctx, "Lista de riscos identificados:", { fontSize: 8 });
  fieldRow(ctx, "Descrição do risco", "Texto livre");
  fieldRow(ctx, "Impacto", ["Alto", "Médio", "Baixo"]);
  fieldRow(ctx, "Mitigação", "Texto livre");

  sectionTitle(ctx, "Pendências do Cliente");
  fieldRow(ctx, "Item", "Texto livre");
  fieldRow(ctx, "Prazo", "Data");
  fieldRow(ctx, "Responsável", "Texto");

  sectionTitle(ctx, "Pendências Internas");
  fieldRow(ctx, "Item", "Texto livre");
  fieldRow(ctx, "Prazo", "Data");
  fieldRow(ctx, "Responsável", "Texto");

  sectionTitle(ctx, "Itens de Integração");
  fieldRow(ctx, "Item", "Texto livre");
  fieldRow(ctx, "Status", "Texto");

  return ctx;
}

// ── 7. Plano de Ação ────────────────────────────────────────
function buildActions(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Plano de Ação — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O Plano de Ação registra pendências, dúvidas, erros, melhorias e riscos do projeto.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Identificação");
  fieldRow(ctx, "Código do ticket", "Texto");
  fieldRow(ctx, "Código da chamada técnica", "Texto");
  fieldRow(ctx, "Tema", "Texto", true);
  fieldRow(ctx, "Issue (problema)", "Texto", true);
  fieldRow(ctx, "Descrição do issue", "Texto livre");

  sectionTitle(ctx, "Classificação");
  fieldRow(ctx, "Tipo", ["Erro", "Melhoria", "Dúvida", "Pendência", "Risco"]);
  fieldRow(ctx, "Impacto", ["Alto", "Médio", "Baixo"]);

  sectionTitle(ctx, "Responsáveis e Status");
  fieldRow(ctx, "Responsável Pontotel", "Texto");
  fieldRow(ctx, "Status Pontotel", ["Aberto", "Em andamento", "Validação", "Concluído", "Cancelado"]);
  fieldRow(ctx, "Responsável Cliente", "Texto");
  fieldRow(ctx, "Status Cliente", ["Aberto", "Em validação", "Validado", "Cancelado"]);

  sectionTitle(ctx, "Datas");
  fieldRow(ctx, "Data da solicitação", "Data");
  fieldRow(ctx, "Prazo (deadline)", "Data");
  fieldRow(ctx, "Início do rollout", "Data");
  fieldRow(ctx, "Fim do rollout", "Data");
  fieldRow(ctx, "Data da solução", "Data");
  fieldRow(ctx, "Nova data da solução", "Data");
  fieldRow(ctx, "Histórico", "Texto livre (registro de movimentações)");

  return ctx;
}

// ── 8. Termo de Encerramento ─────────────────────────────────
function buildTermo(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Termo de Encerramento — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O Termo de Encerramento formaliza a conclusão do projeto de implantação.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Dados do Documento");
  fieldRow(ctx, "Número da versão", "Número", true);
  fieldRow(ctx, "Status", ["Rascunho", "Enviado", "Assinado"]);
  fieldRow(ctx, "Versão atual (is_current)", ["Sim", "Não"]);
  fieldRow(ctx, "Criado por", "Texto (nome do usuário)");

  sectionTitle(ctx, "Conteúdo do Encerramento");
  fieldRow(ctx, "Resumo de encerramento", "Texto livre");
  fieldRow(ctx, "Lições aprendidas", "Texto livre");
  fieldRow(ctx, "Status final", ["Concluído com sucesso", "Concluído parcialmente", "Cancelado"]);
  fieldRow(ctx, "Considerações finais", "Texto livre");

  sectionTitle(ctx, "Itens Pendentes (entrega pós-encerramento)");
  fieldRow(ctx, "Item", "Texto livre");
  fieldRow(ctx, "Responsável", "Texto");
  fieldRow(ctx, "Plano de ação", "Texto");
  fieldRow(ctx, "Prazo", "Data");

  sectionTitle(ctx, "Assinaturas");
  fieldRow(ctx, "Adendo selecionado", "ID do adendo (seleção única)");
  fieldRow(ctx, "Coordenadora de implantação (assinatura)", "ID do usuário");
  fieldRow(ctx, "Líder de implantação (assinatura)", "ID do usuário");
  fieldRow(ctx, "Gerente de Operações (assinatura)", "ID do usuário");
  fieldRow(ctx, "Signatário do cliente — Nome", "Texto");
  fieldRow(ctx, "Signatário do cliente — E-mail", "E-mail");

  sectionTitle(ctx, "Assinatura Digital (D4Sign)");
  fieldRow(ctx, "Status da assinatura", ["rascunho", "enviado", "assinado"]);
  fieldRow(ctx, "Data de envio para assinatura", "Data/hora");
  fieldRow(ctx, "Data da assinatura", "Data/hora");
  fieldRow(ctx, "Link de assinatura", "URL");

  return ctx;
}

// ── 9. Histórico ─────────────────────────────────────────────
function buildAudit(doc) {
  const ctx = { doc, y: 0, pageNum: 1, totalPages: 1, title: "Histórico — Template de Boas Práticas" };
  drawHeader(ctx);
  ctx.y = 28;

  paragraph(ctx, "O Histórico (Audit Log) registra todas as alterações feitas no projeto, rastreando quem alterou, o quê, quando, e os valores anterior e novo.", { fontSize: 8, color: TEXT_MUTED });

  sectionTitle(ctx, "Campos do Registro de Auditoria");
  fieldRow(ctx, "Tela / aba", "Texto (ex: Dados Iniciais, Escopo Técnico, Cronograma, etc.)", true);
  fieldRow(ctx, "Campo editado", "Texto (ex: client_name, status, answer, etc.)", true);
  fieldRow(ctx, "E-mail do usuário", "E-mail de quem realizou a alteração", true);
  fieldRow(ctx, "Valor anterior", "Texto (truncado se muito longo)");
  fieldRow(ctx, "Valor novo", "Texto (truncado se muito longo)");
  fieldRow(ctx, "Data/hora", "Automático (created_date)");

  sectionTitle(ctx, "Telas Rastreadas");
  ["Dados Iniciais", "Escopo Técnico", "Cronograma", "Status Report", "TAP", "Termo de Encerramento", "Plano de Ação"].forEach(s => {
    paragraph(ctx, `• ${s}`, { fontSize: 8, indent: 2 });
  });

  paragraph(ctx, " ", { fontSize: 6 });
  paragraph(ctx, "Nota: O histórico é gerado automaticamente pelo sistema a cada edição e não pode ser editado manualmente. Serve para auditoria, conformidade e rastreabilidade de mudanças.", { fontSize: 8, color: TEXT_MUTED, fontStyle: "italic" });

  return ctx;
}

// ============================================================
// Geração e download
// ============================================================

const BUILDERS = {
  overview: buildOverview,
  scope: buildScope,
  tap: buildTAP,
  calc: buildCalc,
  schedule: buildSchedule,
  status: buildStatus,
  actions: buildActions,
  termo: buildTermo,
  audit: buildAudit,
};

export async function generateBoasPraticasPDF(tabKey) {
  const builder = BUILDERS[tabKey];
  if (!builder) throw new Error(`Aba desconhecida: ${tabKey}`);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const ctx = builder(doc);
  // Stamp logo on all pages
  const totalPages = ctx.totalPages;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (logo) {
      try { doc.addImage(logo, "PNG", M + PW - 28, 3.5, 28, 10); } catch (_) {}
    }
    // Footer
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, 285, M + PW, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Página ${i} de ${totalPages}`, M + PW - 30, 291);
    doc.text("Documento de referência — preencher conforme realidade do projeto", M, 291);
  }
  return { doc, fileName: `Boas_Praticas_${TABS_META.find(t => t.key === tabKey)?.label || tabKey}.pdf` };
}

export async function downloadBoasPraticasPDF(tabKey) {
  const { doc, fileName } = await generateBoasPraticasPDF(tabKey);
  doc.save(fileName);
}

export async function downloadAllBoasPraticasPDFs() {
  for (const tab of TABS_META) {
    await downloadBoasPraticasPDF(tab.key);
    await new Promise(r => setTimeout(r, 350));
  }
}

export { TABS_META };