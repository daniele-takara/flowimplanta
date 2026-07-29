import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

/**
 * Classifica atividades salvas em "do template" (activitiesByTask) ou "locais"
 * (localActivities), com casamento por nome + fase e fallback para órfãs.
 *
 * Regras:
 *  - Nome não casa com nenhuma atividade (task) do template → LOCAL.
 *  - Nome casa E a fase salva == fase canônica do template task → TEMPLATE.
 *  - Nome casa, mas a fase salva é uma fase LOCAL (LocalSchedulePhase) ou um
 *    custom_name de override → LOCAL (respeita a fase em que foi salva).
 *  - Nome casa, mas a fase salva é "órfã" (não é template, nem local, nem
 *    custom_name) → fallback só-por-nome → TEMPLATE (mantém visibilidade,
 *    evita que a atividade desapareça por estar numa fase sem seção).
 *
 * Único ponto de casamento usado por ScheduleTab e buildProjectScheduleView,
 * garantindo consistência entre a UI do cronograma e o motor de progresso.
 *
 * @param {Array} savedActivities         - ScheduleActivity[]
 * @param {Array<string>} localPhaseNames - nomes de LocalSchedulePhase (qualquer is_active)
 * @param {Array<string>} customNames     - custom_name de SchedulePhaseOverride
 * @returns {{ activitiesByTask: Object, localActivities: Array }}
 */
export function classifyScheduleActivities(
  savedActivities = [],
  localPhaseNames = [],
  customNames = [],
) {
  const localSet = new Set((localPhaseNames || []).map(norm));
  const customSet = new Set((customNames || []).map(norm));

  const activitiesByTask = {};
  const localActivities = [];

  (savedActivities || []).forEach((a) => {
    if (!a || !a.activity_name) return;
    const normActivity = norm(a.activity_name);
    const found = SCHEDULE_TASKS.find(
      (t) => t.type === "task" && norm(t.activity) === normActivity,
    );
    if (!found) {
      localActivities.push(a);
      return;
    }
    const normPhase = norm(a.phase_name);
    if (normPhase === norm(found.phase)) {
      // nome + fase canônica → template
      activitiesByTask[found.id] = a;
      return;
    }
    // Fase salva difere da canônica: se for fase local/custom real → local
    if (localSet.has(normPhase) || customSet.has(normPhase)) {
      localActivities.push(a);
      return;
    }
    // Fase órfã → fallback só-por-nome (mantém visibilidade no template)
    activitiesByTask[found.id] = a;
  });

  return { activitiesByTask, localActivities };
}