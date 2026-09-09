/**
 * scheduleOrderOverride.js
 * ========================
 * Helpers para overrides de ordem e fase de atividades do template por projeto.
 * Os overrides são armazenados em project.schedule_overrides[taskId] junto com
 * as datas manuais — { plannedStart, plannedEnd, _origin, order, phase_name }.
 *
 * order:   número que define a posição da atividade dentro da fase (sobrescreve task.row)
 * phase_name: nome da fase canônica (PHASE_ORDER) para onde a atividade foi movida
 */

import { PHASE_ORDER } from "@/lib/scheduleTasks.js";

/**
 * Retorna a fase efetiva de uma task do template (override ou canônica).
 * Só aplica o override se for uma fase canônica válida (PHASE_ORDER).
 */
export function getTaskPhase(task, overrides) {
  const ov = overrides?.[task.id];
  if (ov && ov.phase_name && PHASE_ORDER.includes(ov.phase_name)) {
    return ov.phase_name;
  }
  return task.phase;
}

/**
 * Retorna a ordem efetiva de uma task do template (override ou row natural).
 */
export function getTaskOrder(task, overrides) {
  const ov = overrides?.[task.id];
  return ov?.order ?? task.row;
}

/**
 * Ordena um array de tasks do template pela ordem efetiva (override ou row).
 */
export function sortTasksByOrder(tasks, overrides) {
  return [...tasks].sort(
    (a, b) => getTaskOrder(a, overrides) - getTaskOrder(b, overrides),
  );
}