/**
 * Motor de cálculo do cronograma macro para o Status Report.
 * Agrupa tasks visíveis do Cronograma Detalhado em fases macro,
 * calcula datas planejadas/realizadas e progresso.
 */

import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule, evaluateCondition } from "@/lib/scheduleEngine.js";

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
 * Computa o cronograma macro para o Status Report.
 *
 * @param {Object} overrides - overrides do localStorage (datas âncora e manuais)
 * @param {Object} answersMap - respostas do escopo técnico
 * @param {Object} project - dados do projeto
 * @param {Array} savedActivities - atividades salvas no banco (com actual_start/actual_end)
 * @returns {Array} fases macro com datas e progresso
 */
export function computeMacroSchedule(overrides, answersMap, project, savedActivities = []) {
  const { dates, visible } = computeSchedule(SCHEDULE_TASKS, overrides, answersMap, project);

  // Indexar atividades salvas por activity_name para buscar datas realizadas
  const activityByName = {};
  (savedActivities || []).forEach(a => {
    activityByName[a.activity_name] = a;
  });

  // Agrupar tasks visíveis por fase macro
  const groups = {};

  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    if (!visible.has(task.id)) return;

    const macroPhase = MACRO_PHASE_MAP[task.phase];
    if (!macroPhase) return;

    if (!groups[macroPhase]) groups[macroPhase] = [];

    const taskDates = dates[task.id] || {};
    const saved = activityByName[task.activity] || {};

    groups[macroPhase].push({
      taskId: task.id,
      activity: task.activity,
      plannedStart: taskDates.plannedStart || null,
      plannedEnd: taskDates.plannedEnd || null,
      actualStart: saved.actual_start || null,
      actualEnd: saved.actual_end || null,
    });
  });

  const today = new Date().toISOString().split("T")[0];

  // Calcular dados por fase macro
  const macroPhases = MACRO_PHASE_ORDER
    .filter(phase => groups[phase] && groups[phase].length > 0)
    .map(phase => {
      const tasks = groups[phase];

      const plannedStarts = tasks.map(t => t.plannedStart).filter(Boolean);
      const plannedEnds = tasks.map(t => t.plannedEnd).filter(Boolean);
      const actualStarts = tasks.map(t => t.actualStart).filter(Boolean);
      const actualEnds = tasks.map(t => t.actualEnd).filter(Boolean);

      const plannedStart = plannedStarts.length ? plannedStarts.reduce((a, b) => a < b ? a : b) : null;
      const plannedEnd = plannedEnds.length ? plannedEnds.reduce((a, b) => a > b ? a : b) : null;
      const actualStart = actualStarts.length ? actualStarts.reduce((a, b) => a < b ? a : b) : null;
      const actualEnd = actualEnds.length ? actualEnds.reduce((a, b) => a > b ? a : b) : null;

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => !!t.actualEnd).length;
      const startedTasks = tasks.filter(t => !!t.actualStart).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Status da fase
      let status;
      if (completedTasks === totalTasks) {
        status = "Concluído";
      } else if (startedTasks > 0) {
        status = "Em andamento";
      } else if (plannedEnd && today > plannedEnd) {
        status = "Atrasado";
      } else {
        status = "Não iniciado";
      }

      return {
        phase,
        plannedStart,
        plannedEnd,
        actualStart,
        actualEnd,
        totalTasks,
        completedTasks,
        progress,
        status,
      };
    });

  // % geral do projeto = média do progresso das fases macro
  const overallProgress = macroPhases.length > 0
    ? Math.round(macroPhases.reduce((sum, p) => sum + p.progress, 0) / macroPhases.length)
    : 0;

  return { macroPhases, overallProgress };
}