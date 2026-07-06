/**
 * Motor de cálculo do cronograma macro para o Status Report.
 * Usa buildProjectScheduleView como fonte única do cronograma real do projeto.
 * Inclui fases do template (respeitando inativações) + fases locais ativas.
 */

import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule, evaluateCondition } from "@/lib/scheduleEngine.js";
import { buildProjectScheduleView } from "@/lib/buildProjectScheduleView.js";

// Mapeamento de fases detalhadas → fases macro do Status Report
export const MACRO_PHASE_MAP = {
  "Abertura de projeto": "Abertura de projeto",
  "Integração": "Integração",
  "Cadastros": "Cadastros",
  "Parametrização": "Parametrização",
  "Treinamento e Validações": "Treinamento e validações",
  "Operação Assistida": "Início de registro de ponto",
  "Fechamento de Folha": "Fechamento de folha de ponto",
  "Expansão": "Expansão",
  "Encerramento": "Encerramento de projeto",
};

export const MACRO_PHASE_ORDER = [
  "Abertura de projeto",
  "Integração",
  "Cadastros",
  "Parametrização",
  "Treinamento e validações",
  "Início de registro de ponto",
  "Fechamento de folha de ponto",
  "Expansão",
  "Encerramento de projeto",
];

/**
 * Computa o cronograma macro para o Status Report usando buildProjectScheduleView como fonte única.
 *
 * @param {Object} overrides        - overrides de datas âncora (não mais necessário, mantido por compatibilidade)
 * @param {Object} answersMap       - respostas do escopo técnico
 * @param {Object} project          - dados do projeto
 * @param {Array}  savedActivities  - atividades salvas no banco (com actual_start/actual_end)
 * @param {Object} phaseOverridesMap - mapa { phaseName: SchedulePhaseOverride }
 * @param {Array}  localPhases      - LocalSchedulePhase[] do projeto
 * @param {Object} manualOverrides  - { taskId: { plannedStart, plannedEnd } } — overrides do localStorage
 * @returns {{ macroPhases: Array, overallProgress: number }}
 */
export function computeMacroSchedule(
  overrides,
  answersMap,
  project,
  savedActivities = [],
  phaseOverridesMap = {},
  localPhases = [],
  manualOverrides = {},
) {
  try {
    // Usar buildProjectScheduleView como fonte única — inclui fases locais + overrides + inativações
    const scheduleView = buildProjectScheduleView({
      project,
      answersMap,
      savedActivities,
      phaseOverridesMap,
      localPhases,
      manualOverrides,
      includeInactive: false,
    });

    if (!scheduleView.length) {
      // Fallback: usar lógica anterior para projetos sem dados
      return _legacyComputeMacroSchedule(overrides, answersMap, project, savedActivities, phaseOverridesMap);
    }

    const today = new Date().toISOString().split("T")[0];

    // Mapear fases do template para macro-fases do Status Report
    // Fases locais aparecem com o próprio nome (não mapeadas para canônicos)
    const macroPhases = scheduleView.map(phase => {
      // Nome do macro: usar mapeamento canônico se existir, senão usar o nome da fase
      const macroName = phase.canonical_name
        ? (MACRO_PHASE_MAP[phase.canonical_name] || phase.phase_name)
        : phase.phase_name;

      return {
        phase: macroName,
        phaseName: phase.phase_name,        // nome exibido (customizado ou local)
        isLocal: phase.is_local,
        plannedStart: phase.planned_start,
        plannedEnd: phase.planned_end,
        actualStart: phase.actual_start,
        actualEnd: phase.actual_end,
        totalTasks: 0,    // mantido para compatibilidade
        completedTasks: 0,
        progress: phase.progress,
        status: phase.status,
      };
    });

    // % geral do projeto = média do progresso das fases macro (exclui Encerramento)
    const progressPhases = macroPhases.filter(p => p.phase !== "Encerramento de projeto");
    const overallProgress = progressPhases.length > 0
      ? Math.round(progressPhases.reduce((sum, p) => sum + p.progress, 0) / progressPhases.length)
      : 0;

    return { macroPhases, overallProgress };

  } catch (err) {
    console.warn("[computeMacroSchedule] Fallback ativado:", err?.message);
    return _legacyComputeMacroSchedule(overrides, answersMap, project, savedActivities, phaseOverridesMap);
  }
}

/**
 * Implementação legada — mantida como fallback para compatibilidade com projetos antigos.
 * Usada quando buildProjectScheduleView não retorna dados.
 */
function _legacyComputeMacroSchedule(overrides, answersMap, project, savedActivities, phaseOverridesMap) {
  const { dates, visible } = computeSchedule(SCHEDULE_TASKS, overrides || {}, answersMap, project);

  const activityByName = {};
  (savedActivities || []).forEach(a => { activityByName[a.activity_name] = a; });

  const groups = {};
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    if (!visible.has(task.id)) return;
    const macroPhase = MACRO_PHASE_MAP[task.phase];
    if (!macroPhase) return;
    const phaseOverride = phaseOverridesMap[task.phase];
    if (phaseOverride?.is_active === false) return;
    if (!groups[macroPhase]) groups[macroPhase] = [];
    const taskDates = dates[task.id] || {};
    const saved = activityByName[task.activity] || {};
    // Pular atividades inativadas neste projeto
    const isInactivated = saved.status === "Cancelado" && (saved.history_observations || "").includes("[INATIVADO]");
    if (isInactivated) return;
    groups[macroPhase].push({
      plannedStart: taskDates.plannedStart || null,
      plannedEnd: taskDates.plannedEnd || null,
      actualStart: saved.actual_start || null,
      actualEnd: saved.actual_end || null,
    });
  });

  const today = new Date().toISOString().split("T")[0];
  const macroPhases = MACRO_PHASE_ORDER
    .filter(phase => groups[phase]?.length > 0)
    .map(phase => {
      const tasks = groups[phase];
      const plannedStart = tasks.map(t => t.plannedStart).filter(Boolean).reduce((a,b) => a < b ? a : b, null);
      const plannedEnd   = tasks.map(t => t.plannedEnd).filter(Boolean).reduce((a,b) => a > b ? a : b, null);
      const actualStart  = tasks.map(t => t.actualStart).filter(Boolean).reduce((a,b) => a < b ? a : b, null);
      const actualEnd    = tasks.map(t => t.actualEnd).filter(Boolean).reduce((a,b) => a > b ? a : b, null);
      const total = tasks.length;
      // Concluído = status "Concluído" OU actual_end preenchido
      const completed = tasks.filter(t => t.status === "Concluído" || !!t.actualEnd).length;
      const started   = tasks.filter(t => !!t.actualStart || t.status === "Em andamento" || t.status === "Concluído").length;
      const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
      let status;
      if (completed === total && total > 0) status = "Concluído";
      else if (started > 0)   status = "Em andamento";
      else if (plannedEnd && today > plannedEnd) status = "Atrasado";
      else                    status = "Não iniciado";
      return { phase, plannedStart, plannedEnd, actualStart, actualEnd, totalTasks: total, completedTasks: completed, progress, status };
    });

  const progressPhases = macroPhases.filter(p => p.phase !== "Encerramento de projeto");
  const overallProgress = progressPhases.length > 0
    ? Math.round(progressPhases.reduce((sum, p) => sum + p.progress, 0) / progressPhases.length)
    : 0;
  return { macroPhases, overallProgress };
}