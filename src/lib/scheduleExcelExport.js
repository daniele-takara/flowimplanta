/**
 * scheduleExcelExport.js
 * ========================
 * Geração de Excel (.xlsx) do cronograma usando SheetJS (xlsx).
 *
 * Reutiliza a mesma preparação de dados do schedulePdfExport.js:
 * - engineOverrides (manualOverrides > schedule_overrides > schedule_anchor_dates)
 * - computeSchedule para datas calculadas
 * - classifyScheduleActivities para separar template vs local
 * - getTaskPhase / sortTasksByOrder para ordem efetiva
 *
 * Garante consistência total com a visualização em tela e o PDF.
 */

import * as XLSX from "xlsx";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";
import { resolveRoleToName, resolveGeneralResponsible } from "@/lib/resolveResponsibleRole.js";
import { getTaskPhase, sortTasksByOrder } from "@/lib/scheduleOrderOverride.js";
import { classifyScheduleActivities } from "@/lib/scheduleActivityMatch.js";

function fmtDate(d) {
  if (!d) return "";
  try {
    const [y, m, day] = d.substring(0, 10).split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

/**
 * Gera e baixa um arquivo .xlsx do cronograma do projeto.
 *
 * @param {Object} params - mesmos parâmetros de generateSchedulePDF
 */
export async function generateScheduleExcel({
  project,
  scopeItems = [],
  savedActivities = [],
  localPhases = [],
  phaseOverrides = {},
  manualOverrides = {},
  templateConfig = {},
}) {
  const answersMap = {};
  (scopeItems || []).forEach(item => {
    if (item.question_id) answersMap[item.question_id] = item.answer || "";
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      if (!answersMap[key]) answersMap[key] = item.answer || "";
    }
  });

  // 1. Calcular datas do motor (mesma lógica do ScheduleTab / PDF)
  const engineOverrides = {};
  Object.entries(project?.schedule_anchor_dates || {}).forEach(([taskId, dateStr]) => {
    if (dateStr) engineOverrides[taskId] = { plannedStart: dateStr };
  });
  const dbOverrides = project?.schedule_overrides;
  if (dbOverrides && typeof dbOverrides === "object" && !Array.isArray(dbOverrides)) {
    Object.entries(dbOverrides).forEach(([taskId, override]) => {
      if (override && typeof override === "object") {
        engineOverrides[taskId] = { ...(engineOverrides[taskId] || {}), ...override };
      }
    });
  }
  Object.entries(manualOverrides || {}).forEach(([taskId, override]) => {
    if (override && typeof override === "object") {
      engineOverrides[taskId] = { ...(engineOverrides[taskId] || {}), ...override };
    }
  });

  const { dates: computedDates, visible } = computeSchedule(
    SCHEDULE_TASKS, engineOverrides, answersMap, project
  );

  // 2. Classificar atividades (mesma lógica da tela)
  const localPhaseNames = (localPhases || []).map(p => p.phase_name);
  const customNames = Object.values(phaseOverrides || {})
    .map(o => o.custom_name).filter(Boolean);
  const { activitiesByTask: activityByTaskId, localActivities: classifiedLocal } =
    classifyScheduleActivities(savedActivities, localPhaseNames, customNames);

  // 3. Agrupar tasks visíveis por fase
  const templatePhaseTasks = {};
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    if (!visible.has(task.id)) return;
    const ph = getTaskPhase(task, engineOverrides);
    if (!templatePhaseTasks[ph]) templatePhaseTasks[ph] = [];
    templatePhaseTasks[ph].push(task);
  });
  Object.keys(templatePhaseTasks).forEach(ph => {
    templatePhaseTasks[ph] = sortTasksByOrder(templatePhaseTasks[ph], engineOverrides);
  });

  // 4. Fases do template (ordem PHASE_ORDER, filtrando inativas)
  const templatePhases = [];
  PHASE_ORDER.forEach((phaseName, idx) => {
    const tasks = templatePhaseTasks[phaseName] || [];
    const hasLocalActs = classifiedLocal.some(a => a.phase_name === phaseName);
    if (tasks.length === 0 && !hasLocalActs) return;

    const override = phaseOverrides[phaseName] || null;
    if (override?.is_active === false) return;

    const displayName = override?.custom_name || phaseName;
    templatePhases.push({ phase_name: displayName, canonical: phaseName, is_local: false, order: idx, tasks });
  });

  // 5. Fases locais ativas
  const activeLocalPhases = (localPhases || [])
    .filter(p => p.is_active !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  // 6. Atividades locais por fase
  const localActivitiesByPhase = {};
  classifiedLocal.forEach(a => {
    const ph = a.phase_name;
    if (!localActivitiesByPhase[ph]) localActivitiesByPhase[ph] = [];
    localActivitiesByPhase[ph].push(a);
  });

  // 7. Combinar tudo na ordem correta
  const allPhases = [...templatePhases];
  activeLocalPhases.forEach((phase, idx) => {
    allPhases.push({ phase_name: phase.phase_name, canonical: null, is_local: true, order: 1000 + idx, phase });
  });

  // 8. Montar linhas (uma por atividade, na ordem das fases unificadas)
  const rows = [];
  const isInactive = (a) => a && a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]");

  allPhases.forEach(phaseItem => {
    const phaseTasks = phaseItem.is_local ? [] : phaseItem.tasks;
    const localActs = phaseItem.is_local
      ? (localActivitiesByPhase[phaseItem.phase.phase_name] || [])
      : (localActivitiesByPhase[phaseItem.canonical] || []);

    // Tasks do template
    phaseTasks.forEach(task => {
      const act = activityByTaskId[task.id];
      if (isInactive(act)) return;

      const override = manualOverrides[task.id] || {};
      const d = computedDates[task.id] || {};
      const pStart = override.plannedStart || d.plannedStart || "";
      const pEnd = override.plannedEnd || d.plannedEnd || "";

      const taskConfig = templateConfig?.[task.id];
      const resolvedGeneral = taskConfig?.responsible_general_type
        ? resolveGeneralResponsible(taskConfig.responsible_general_type, project)
        : "";
      const resolvedLeader = taskConfig?.responsible_role
        ? resolveRoleToName(taskConfig.responsible_role, project)
        : "";

      rows.push({
        "Fase": phaseItem.phase_name,
        "Atividade": task.activity,
        "Início Planejado": fmtDate(pStart),
        "Fim Planejado": fmtDate(pEnd),
        "Início Executado": fmtDate(act?.actual_start || ""),
        "Fim Executado": fmtDate(act?.actual_end || ""),
        "Resp. Geral": act?.responsible_general || resolvedGeneral || "",
        "Resp. Líder": act?.responsible_leader || resolvedLeader || "",
        "Status": act?.status || "Não iniciado",
        "Obs.": act?.history_observations || "",
      });
    });

    // Atividades locais
    localActs.forEach(act => {
      if (isInactive(act)) return;

      rows.push({
        "Fase": phaseItem.phase_name,
        "Atividade": act.activity_name,
        "Início Planejado": fmtDate(act.planned_start),
        "Fim Planejado": fmtDate(act.planned_end),
        "Início Executado": fmtDate(act.actual_start),
        "Fim Executado": fmtDate(act.actual_end),
        "Resp. Geral": act.responsible_general || "",
        "Resp. Líder": act.responsible_leader || "",
        "Status": act.status || "Não iniciado",
        "Obs.": act.history_observations || "",
      });
    });
  });

  // 9. Gerar arquivo .xlsx
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["Fase", "Atividade", "Início Planejado", "Fim Planejado", "Início Executado", "Fim Executado", "Resp. Geral", "Resp. Líder", "Status", "Obs."],
  });

  // Larguras de coluna (em caracteres)
  ws["!cols"] = [
    { wch: 22 }, // Fase
    { wch: 50 }, // Atividade
    { wch: 16 }, // Início Planejado
    { wch: 16 }, // Fim Planejado
    { wch: 16 }, // Início Executado
    { wch: 16 }, // Fim Executado
    { wch: 22 }, // Resp. Geral
    { wch: 22 }, // Resp. Líder
    { wch: 14 }, // Status
    { wch: 40 }, // Obs.
  ];

  // Congelar primeira linha
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cronograma");

  const fileName = `Cronograma_${(project?.client_name || project?.name || "projeto").replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}