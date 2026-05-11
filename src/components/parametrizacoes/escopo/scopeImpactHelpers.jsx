import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate.js";

// ── Mapa de impactos no cronograma ──────────────────────────────────────────
export function buildImpactMap() {
  const map = {};
  const extractConditions = (task) => {
    const conds = [];
    const v = task.visibleWhen;
    const vAll = task.visibleWhenAll;
    const vAny = task.visibleWhenAny;
    if (v && v !== "always") conds.push(v);
    if (vAll) conds.push(...vAll);
    if (vAny) conds.push(...vAny);
    return conds;
  };
  SCHEDULE_TASKS.forEach(task => {
    if (task.type === "group") return;
    extractConditions(task).forEach(cond => {
      const src = cond.source || "";
      if (!src.startsWith("escopo.")) return;
      const qId = src.replace("escopo.", "");
      if (!map[qId]) map[qId] = { tasks: [], phases: new Set() };
      map[qId].tasks.push(task);
      map[qId].phases.add(task.phase);
    });
  });
  Object.keys(map).forEach(k => { map[k].phases = Array.from(map[k].phases); });
  return map;
}

// ── Impactos na TAP ──────────────────────────────────────────────────────────
export const TAP_IMPACT = {
  q006: ["Seção 4 — Entregas Previstas (Integração Sankhya)"],
  q037: ["Seção 4 — Entregas Previstas (Banco de Horas)"],
  q038: ["Seção 4 — Entregas Previstas (Sobreaviso)"],
  q039: ["Seção 4 — Entregas Previstas (NR17)"],
  q019: ["Seção 4 — Entregas Previstas (Notificações)"],
  q020: ["Seção 4 — Entregas Previstas (Geolocalização)"],
  q062: ["Seção 4 — Entregas Previstas (Notificações HE)"],
};

// ── Impactos em integrações ──────────────────────────────────────────────────
export const INTEGRATION_IMPACT = {
  q004: ["Integração Sankhya — validação de viabilidade"],
  q005: ["Integração Sankhya — tipo de sistema (Pessoal+/MGE)"],
  q006: ["Integração Sankhya — ativação do fluxo de integração", "Cronograma fase Integração — geração de atividades"],
};

// ── Risco calculado ───────────────────────────────────────────────────────────
export function getRiskLevel(qId, impactMap) {
  const t = (impactMap[qId]?.tasks?.length || 0) + (TAP_IMPACT[qId]?.length || 0) + (INTEGRATION_IMPACT[qId]?.length || 0);
  return t >= 4 ? "high" : t >= 1 ? "medium" : "low";
}

export const RISK_CONFIG = {
  high:   { label: "Crítico", color: "text-red-700 bg-red-50 border-red-200",     dot: "bg-red-500" },
  medium: { label: "Atenção", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  low:    { label: "Seguro",  color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
};

// ── Labels de tipo ────────────────────────────────────────────────────────────
export const TYPE_LABELS = {
  number: "Número", text: "Texto curto", short_text: "Texto curto",
  long_text: "Texto livre", single_select: "Seleção única",
  multi_select: "Múltipla escolha", boolean: "Sim/Não",
  date: "Data", date_range_text: "Período (texto)", informativo: "Informativo",
};

export const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

export const TYPE_COLORS = {
  number: "bg-blue-50 text-blue-700 border-blue-200",
  text: "bg-slate-50 text-slate-600 border-slate-200",
  short_text: "bg-slate-50 text-slate-600 border-slate-200",
  long_text: "bg-slate-50 text-slate-600 border-slate-200",
  single_select: "bg-purple-50 text-purple-700 border-purple-200",
  multi_select: "bg-indigo-50 text-indigo-700 border-indigo-200",
  boolean: "bg-green-50 text-green-700 border-green-200",
  date: "bg-amber-50 text-amber-700 border-amber-200",
  date_range_text: "bg-amber-50 text-amber-700 border-amber-200",
  informativo: "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Auditoria de impacto ─────────────────────────────────────────────────────
export function runImpactAudit(originalQ, editedQ, impactMap, allQuestions) {
  const issues = [];
  const warnings = [];
  const infos = [];
  const qId = originalQ.id;

  if (originalQ.type !== editedQ.type) {
    const schedTasks = impactMap[qId]?.tasks || [];
    if (schedTasks.length > 0) {
      issues.push({
        level: "critical",
        msg: `Tipo alterado de "${TYPE_LABELS[originalQ.type]}" → "${TYPE_LABELS[editedQ.type]}". Esta pergunta controla ${schedTasks.length} atividade(s) do cronograma via condição de visibilidade. A mudança de tipo pode quebrar essas condições.`,
        affected: schedTasks.map(t => t.activity),
      });
    }
    const tapArr = TAP_IMPACT[qId] || [];
    if (tapArr.length > 0) {
      warnings.push({ level: "warning", msg: `Mudança de tipo impacta seções da TAP: ${tapArr.join(", ")}` });
    }
  }

  const origOpts = JSON.stringify(originalQ.options || []);
  const newOpts = JSON.stringify(editedQ.options || []);
  if (origOpts !== newOpts && impactMap[qId]?.tasks?.length > 0) {
    const removedOpts = (originalQ.options || []).filter(o => !(editedQ.options || []).includes(o));
    if (removedOpts.length > 0) {
      issues.push({
        level: "critical",
        msg: `Opções removidas: ${removedOpts.map(o => `"${o}"`).join(", ")}. O cronograma pode depender dessas respostas para mostrar/ocultar atividades.`,
        affected: impactMap[qId].tasks.map(t => t.activity),
      });
    } else {
      warnings.push({ level: "warning", msg: `Opções alteradas. Verifique se regras condicionais existentes continuam válidas.` });
    }
  }

  if (originalQ.prompt !== editedQ.prompt) {
    infos.push({ level: "info", msg: `Texto da pergunta alterado. Respostas já preenchidas em projetos existentes NÃO serão afetadas.` });
  }

  if (editedQ.active === false && originalQ.active !== false) {
    const dependents = allQuestions.filter(aq =>
      (aq.rules || []).some(r => r.type === "conditional_visibility" && r.dependsOn === qId)
    );
    if (dependents.length > 0) {
      issues.push({
        level: "critical",
        msg: `Desativar esta pergunta quebra ${dependents.length} pergunta(s) que dependem dela como condição de visibilidade.`,
        affected: dependents.map(d => `${d.id.toUpperCase()}: ${d.prompt.substring(0, 50)}...`),
      });
    }
    if ((impactMap[qId]?.tasks || []).length > 0) {
      issues.push({
        level: "critical",
        msg: `Esta pergunta controla visibilidade de ${impactMap[qId].tasks.length} atividade(s) no cronograma. Desativá-la pode ocultar atividades permanentemente.`,
        affected: impactMap[qId].tasks.map(t => t.activity),
      });
    }
  }

  const origRules = JSON.stringify(originalQ.rules || []);
  const newRules = JSON.stringify(editedQ.rules || []);
  if (origRules !== newRules) {
    warnings.push({ level: "warning", msg: `Regras condicionais alteradas. Perguntas dependentes desta podem mudar de visibilidade em projetos existentes.` });
  }

  const allIssues = [...issues, ...warnings, ...infos];
  const maxLevel = issues.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "safe";
  return { issues: allIssues, maxLevel, canSaveDirectly: maxLevel !== "critical" };
}

// ── Flat list de todas as perguntas ──────────────────────────────────────────
export function getAllQuestions() {
  return SCOPE_MODULES.flatMap(m => getModuleQuestions(m));
}