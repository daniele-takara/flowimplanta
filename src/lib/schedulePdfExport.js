/**
 * schedulePdfExport.js
 * ====================
 * Geração de PDF do cronograma usando jspdf.
 *
 * Usa a mesma fonte do Cronograma/TAP/Status Report:
 * - buildProjectScheduleView para dados consolidados
 * - computeSchedule para datas calculadas
 * - SCHEDULE_TASKS para tasks do template
*
 * Garante consistência total com a visualização em tela.
*/

import { jsPDF } from "jspdf";
import { SCHEDULE_TASKS, PHASE_ORDER, ANCHOR_IDS } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";

function fmtDate(d) {
  if (!d) return "—";
  try {
    const [y, m, day] = d.substring(0, 10).split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

function fmtDateShort(d) {
  if (!d) return "";
  try {
    const [y, m, day] = d.substring(0, 10).split("-");
    return `${day}/${m}`;
  } catch { return d; }
}

const norm = (s) => (s || "").toLowerCase().trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

/**
 * Gera PDF do cronograma do projeto.
 *
 * @param {Object} params
 * @param {Object} params.project        - Entidade Project
 * @param {Array}  params.scopeItems     - ScopeItem[] do banco
 * @param {Array}  params.savedActivities - ScheduleActivity[] do banco
 * @param {Array}  params.localPhases    - LocalSchedulePhase[] do banco
 * @param {Object} params.phaseOverrides - { phaseName: SchedulePhaseOverride }
 * @param {Object} params.manualOverrides - { taskId: { plannedStart, plannedEnd } }
 * @param {Object} params.templateConfig - Config do ScheduleTemplate (tasks_config)
 */
export async function generateSchedulePDF({
  project,
  scopeItems = [],
  savedActivities = [],
  localPhases = [],
  phaseOverrides = {},
  manualOverrides = {},
  templateConfig = {},
  includeObservations = true,
}) {
  const answersMap = {};
  (scopeItems || []).forEach(item => {
    if (item.question_id) answersMap[item.question_id] = item.answer || "";
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      if (!answersMap[key]) answersMap[key] = item.answer || "";
    }
  });

  // 1. Calcular datas do motor (mesma lógica do ScheduleTab)
  // Prioridade: manualOverrides > schedule_overrides (DB) > schedule_anchor_dates (legado)
  const engineOverrides = {};
  // 1a. Banco âncoras legado como base
  Object.entries(project?.schedule_anchor_dates || {}).forEach(([taskId, dateStr]) => {
    if (dateStr) engineOverrides[taskId] = { plannedStart: dateStr };
  });
  // 1b. schedule_overrides do banco (fonte compartilhada)
  const dbOverrides = project?.schedule_overrides;
  if (dbOverrides && typeof dbOverrides === "object" && !Array.isArray(dbOverrides)) {
    Object.entries(dbOverrides).forEach(([taskId, override]) => {
      if (override && typeof override === "object") {
        engineOverrides[taskId] = { ...(engineOverrides[taskId] || {}), ...override };
      }
    });
  }
  // 1c. manualOverrides (parâmetro) — camada final
  Object.entries(manualOverrides || {}).forEach(([taskId, override]) => {
    if (override && typeof override === "object") {
      engineOverrides[taskId] = { ...(engineOverrides[taskId] || {}), ...override };
    }
  });

  const { dates: computedDates, visible } = computeSchedule(
    SCHEDULE_TASKS, engineOverrides, answersMap, project
  );

  // 2. Indexar atividades salvas
  const activityByTaskId = {};
  savedActivities.forEach(a => {
    if (!a.activity_name) return;
    const normA = norm(a.activity_name);
    let found = SCHEDULE_TASKS.find(t => norm(t.activity) === normA);
    if (!found) found = SCHEDULE_TASKS.find(t =>
      norm(t.activity).includes(normA) || normA.includes(norm(t.activity))
    );
    if (found) activityByTaskId[found.id] = a;
  });

  // 3. Agrupar tasks visíveis por fase
  const templatePhaseTasks = {};
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    if (!visible.has(task.id)) return;
    const ph = task.phase;
    if (!templatePhaseTasks[ph]) templatePhaseTasks[ph] = [];
    templatePhaseTasks[ph].push(task);
  });

  // 4. Fases do template (ordem PHASE_ORDER, filtrando inativas)
  const templatePhases = [];
  PHASE_ORDER.forEach((phaseName, idx) => {
    const tasks = templatePhaseTasks[phaseName] || [];
    const hasLocalActs = savedActivities.some(a => {
      if (!a.activity_name) return false;
      const normA = norm(a.activity_name);
      const inTemplate = SCHEDULE_TASKS.some(t => norm(t.activity) === normA
        || norm(t.activity).includes(normA) || normA.includes(norm(t.activity)));
      return !inTemplate && a.phase_name === phaseName;
    });
    if (tasks.length === 0 && !hasLocalActs) return;

    const override = phaseOverrides[phaseName] || null;
    if (override?.is_active === false) return; // fase inativa → não aparece

    const displayName = override?.custom_name || phaseName;
    templatePhases.push({ phase_name: displayName, canonical: phaseName, is_local: false, order: idx, tasks });
  });

  // 5. Fases locais ativas
  const activeLocalPhases = (localPhases || [])
    .filter(p => p.is_active !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  // 6. Atividades locais (sem match no template)
  const localActivitiesByPhase = {};
  savedActivities.forEach(a => {
    if (!a.activity_name) return;
    const normA = norm(a.activity_name);
    const inTemplate = SCHEDULE_TASKS.some(t => norm(t.activity) === normA
      || norm(t.activity).includes(normA) || normA.includes(norm(t.activity)));
    if (inTemplate) return;
    const ph = a.phase_name;
    if (!localActivitiesByPhase[ph]) localActivitiesByPhase[ph] = [];
    localActivitiesByPhase[ph].push(a);
  });

  // 7. Combinar tudo na ordem correta
  const allPhases = [...templatePhases];
  activeLocalPhases.forEach((phase, idx) => {
    allPhases.push({ phase_name: phase.phase_name, canonical: null, is_local: true, order: 1000 + idx, phase });
  });

  // ======================
  // GERAR PDF
  // ======================
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // ---- CABEÇALHO ----
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(project?.client_name || project?.name || "Projeto", margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, margin, y);
  y += 4;

  if (project?.pontotel_manager_name) {
    doc.text(`Gerente de Projeto: ${project.pontotel_manager_name}`, margin, y);
    y += 4;
  }
  if (project?.pontotel_analyst_name) {
    doc.text(`Analista de Implantacao: ${project.pontotel_analyst_name}`, margin, y);
    y += 4;
  }
  y += 3;

  // ---- Colunas ----
  const colActivity = margin;
  const colPS = 100;
  const colPE = 128;
  const colAS = 156;
  const colAE = 184;
  const colStatus = 212;
  const colResp = 240;
  const colObs = 265;
  const tableW = pageW - margin * 2;

  // ---- LINHA SEPARADORA ----
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 2;

  allPhases.forEach((phaseItem) => {
    // Verificar espaço restante na página
    if (y > pageH - 30) {
      doc.addPage();
      y = margin;
    }

    const phaseTasks = phaseItem.is_local ? [] : phaseItem.tasks;
    const localActs = phaseItem.is_local
      ? (localActivitiesByPhase[phaseItem.phase.phase_name] || [])
      : (localActivitiesByPhase[phaseItem.canonical] || []);

    const totalActivities =
      phaseTasks.filter(t => {
        const act = activityByTaskId[t.id];
        if (act && act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]")) return false;
        return true;
      }).length +
      localActs.filter(a =>
        !(a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]"))
      ).length;

    if (totalActivities === 0) return;

    // Cabeçalho da fase
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(37, 99, 235); // blue-600
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, tableW, 5, "F");
    doc.text(phaseItem.phase_name, margin + 2, y + 3.5);

    if (phaseItem.is_local) {
      doc.setFontSize(6);
      doc.setTextColor(200, 200, 255);
      doc.text("(Marco local)", margin + tableW - 25, y + 3.5);
    }
    y += 7;

    // Cabeçalho da tabela
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("Atividade", colActivity, y);
    doc.text("Inicio Plan.", colPS, y);
    doc.text("Fim Plan.", colPE, y);
    doc.text("Inicio Exec.", colAS, y);
    doc.text("Fim Exec.", colAE, y);
    doc.text("Status", colStatus, y);
    doc.text("Resp. Geral", colResp, y);
    if (includeObservations) doc.text("Obs.", colObs, y);
    y += 4;

    // Linha separadora
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 2;

    // ---- TASKS DO TEMPLATE ----
    phaseTasks.forEach(task => {
      const act = activityByTaskId[task.id];
      if (act && act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]")) return;

      if (y > pageH - 15) { doc.addPage(); y = margin; }

      const override = manualOverrides[task.id] || {};
      const d = computedDates[task.id] || {};
      const pStart = override.plannedStart || d.plannedStart || "";
      const pEnd = override.plannedEnd || d.plannedEnd || "";
      const aStart = act?.actual_start || "";
      const aEnd = act?.actual_end || "";
      const status = act?.status || "Nao iniciado";
      const obs = act?.history_observations || "";
      const respGeneral = act?.responsible_general || task.responsibleGeneral || "";
      const respLeader = act?.responsible_leader || task.responsibleLeader || "";

      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);

      doc.text(task.activity.substring(0, 55), colActivity, y);
      doc.text(fmtDate(pStart), colPS, y);
      doc.text(fmtDate(pEnd), colPE, y);
      doc.text(fmtDate(aStart), colAS, y);
      doc.text(fmtDate(aEnd), colAE, y);
      doc.text(status, colStatus, y);
      doc.text(respGeneral.substring(0, 18), colResp, y);
      if (includeObservations) doc.text(obs ? obs.substring(0, 28) : "—", colObs, y);
      y += 3.5;
    });

    // ---- ATIVIDADES LOCAIS ----
    localActs.forEach(act => {
      if (act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]")) return;

      if (y > pageH - 15) { doc.addPage(); y = margin; }

      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40);

      doc.text(act.activity_name.substring(0, 55), colActivity, y);
      doc.text(fmtDate(act.planned_start), colPS, y);
      doc.text(fmtDate(act.planned_end), colPE, y);
      doc.text(fmtDate(act.actual_start), colAS, y);
      doc.text(fmtDate(act.actual_end), colAE, y);
      doc.text(act.status || "Nao iniciado", colStatus, y);
      doc.text((act.responsible_general || "").substring(0, 18), colResp, y);
      if (includeObservations) doc.text((act.history_observations || "").substring(0, 28) || "—", colObs, y);
      y += 3.5;
    });

    y += 3; // espaço entre fases
  });

  // ---- RODAPÉ ----
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Gerado por Flowimplanta — ${new Date().toLocaleDateString("pt-BR")}`, margin, pageH - 5);

  return doc;
}