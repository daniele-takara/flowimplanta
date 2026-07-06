/**
 * buildProjectScheduleView
 * ========================
 * Fonte única e segura da visão real do cronograma de um projeto.
 *
 * Considera:
 * - Fases do template (SCHEDULE_TASKS) + visibilidade condicional
 * - Overrides locais de fases do template (SchedulePhaseOverride) — inclui inativação e nomes customizados
 * - Fases locais (LocalSchedulePhase) — fases criadas manualmente no projeto
 * - Atividades locais (ScheduleActivity sem correspondência no template)
 * - Datas planejadas calculadas pelo motor (com âncoras do banco)
 * - Datas executadas (actual_start / actual_end) das atividades salvas
 * - Status de cada fase
 * - Ordem correta (fases do template seguem PHASE_ORDER; locais aparecem ao final pela ordem definida)
 *
 * Retorna array de fases:
 * [
 *   {
 *     phase_name: string,           // Nome exibido (custom ou canônico)
 *     canonical_name: string,       // Nome canônico do template (null para locais)
 *     is_local: boolean,            // true = fase criada manualmente
 *     is_active: boolean,           // false = fase inativada
 *     planned_start: string|null,   // YYYY-MM-DD
 *     planned_end: string|null,     // YYYY-MM-DD
 *     actual_start: string|null,
 *     actual_end: string|null,
 *     status: string,               // Não iniciado / Em andamento / Concluído / Atrasado / Cancelado
 *     progress: number,             // 0-100
 *     order: number,                // para ordenação
 *   }
 * ]
 *
 * FALLBACK SEGURO:
 * Se qualquer dado extra (phaseOverrides, localPhases) estiver ausente/vazio,
 * o comportamento é idêntico ao anterior (projetos antigos não quebram).
 */

import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";

const TODAY = () => new Date().toISOString().split("T")[0];

/**
 * @param {Object} params
 * @param {Object} params.project           - Entidade Project
 * @param {Object} params.answersMap        - { qXXX: resposta }
 * @param {Array}  params.savedActivities   - ScheduleActivity[] do banco
 * @param {Object} params.phaseOverridesMap - { phaseName: SchedulePhaseOverride } — pode ser {}
 * @param {Array}  params.localPhases       - LocalSchedulePhase[] — pode ser []
 * @param {Object}  params.manualOverrides   - { taskId: { plannedStart, plannedEnd, _origin } } — overrides do localStorage (manuais + Pipedrive)
 * @param {boolean} params.includeInactive  - Se true, inclui fases inativas (padrão: false)
 * @returns {Array} fases consolidadas, ordenadas, com datas e status
 */
export function buildProjectScheduleView({
  project,
  answersMap = {},
  savedActivities = [],
  phaseOverridesMap = {},
  localPhases = [],
  manualOverrides = {},
  includeInactive = false,
}) {
  try {
    // 1. Calcular datas do motor para o cronograma do template
    // Prioridade: manualOverrides > schedule_overrides (DB) > schedule_anchor_dates (legado)
    const bankAnchors = project?.schedule_anchor_dates || {};
    const overrides = {};
    // 1a. Banco âncoras legado como base
    Object.entries(bankAnchors).forEach(([taskId, dateStr]) => {
      if (dateStr) overrides[taskId] = { plannedStart: dateStr };
    });
    // 1b. schedule_overrides do banco (fonte de verdade compartilhada entre usuários)
    const dbOverrides = project?.schedule_overrides;
    if (dbOverrides && typeof dbOverrides === "object" && !Array.isArray(dbOverrides)) {
      Object.entries(dbOverrides).forEach(([taskId, override]) => {
        if (override && typeof override === "object") {
          overrides[taskId] = { ...(overrides[taskId] || {}), ...override };
        }
      });
    }
    // 1c. manualOverrides (parâmetro) sobrepõe tudo — última camada
    Object.entries(manualOverrides || {}).forEach(([taskId, override]) => {
      if (override && typeof override === "object") {
        overrides[taskId] = { ...(overrides[taskId] || {}), ...override };
      }
    });

    const { dates: computedDates, visible } = computeSchedule(
      SCHEDULE_TASKS, overrides, answersMap, project
    );

    // 2. Indexar atividades salvas por nome (normalizado) para busca de datas executadas
    const norm = s => (s || "").toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

    const activityByTaskId = {};
    const activityByName = {};
    savedActivities.forEach(a => {
      if (a.activity_name) activityByName[norm(a.activity_name)] = a;
    });

    // Mapear template tasks → activity salva
    SCHEDULE_TASKS.forEach(task => {
      if (task.type !== "task") return;
      const normTask = norm(task.activity);
      if (activityByName[normTask]) {
        activityByTaskId[task.id] = activityByName[normTask];
      } else {
        // fallback includes
        const found = Object.entries(activityByName).find(([k]) =>
          k.includes(normTask) || normTask.includes(k)
        );
        if (found) activityByTaskId[task.id] = found[1];
      }
    });

    // 3. Agrupar tasks visíveis por fase do template
    const templatePhaseData = {}; // { phaseName: { tasks: [], dates: { start, end, actualStart, actualEnd } } }

    SCHEDULE_TASKS.forEach(task => {
      if (task.type !== "task") return;
      if (!visible.has(task.id)) return;

      const act = activityByTaskId[task.id] || {};
      // Pular atividades inativadas neste projeto — não contam para progresso
      const isInactivated = act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]");
      if (isInactivated) return;

      const phaseName = task.phase;
      if (!templatePhaseData[phaseName]) {
        templatePhaseData[phaseName] = { tasks: [] };
      }

      const d = computedDates[task.id] || {};

      templatePhaseData[phaseName].tasks.push({
        taskId: task.id,
        activity: task.activity,
        plannedStart: d.plannedStart || null,
        plannedEnd: d.plannedEnd || null,
        actualStart: act.actual_start || null,
        actualEnd: act.actual_end || null,
        status: act.status || null,
      });
    });

    const today = TODAY();

    // 4. Consolidar fases do template na ordem PHASE_ORDER
    const templatePhases = PHASE_ORDER
      .filter(phaseName => {
        const hasTemplateTasks = !!templatePhaseData[phaseName]?.tasks?.length;
        // Verificar também se há atividades locais nessa fase
        const hasLocalActivities = savedActivities.some(a => {
          if (!a.activity_name) return false;
          const normA = norm(a.activity_name);
          const inTemplate = SCHEDULE_TASKS.some(t => {
            const nt = norm(t.activity);
            return nt === normA || nt.includes(normA) || normA.includes(nt);
          });
          return !inTemplate && a.phase_name === phaseName;
        });
        return hasTemplateTasks || hasLocalActivities;
      })
      .map((phaseName, idx) => {
        const override = phaseOverridesMap[phaseName] || null;
        const isActive = override?.is_active !== false; // default true se sem override
        const displayName = override?.custom_name || phaseName;

        const tasks = templatePhaseData[phaseName]?.tasks || [];

        const plannedStarts = tasks.map(t => t.plannedStart).filter(Boolean);
        const plannedEnds = tasks.map(t => t.plannedEnd).filter(Boolean);
        const actualStarts = tasks.map(t => t.actualStart).filter(Boolean);
        const actualEnds = tasks.map(t => t.actualEnd).filter(Boolean);

        const plannedStart = plannedStarts.length
          ? plannedStarts.reduce((a, b) => a < b ? a : b) : null;
        const plannedEnd = plannedEnds.length
          ? plannedEnds.reduce((a, b) => a > b ? a : b) : null;
        const actualStart = actualStarts.length
          ? actualStarts.reduce((a, b) => a < b ? a : b) : null;
        const actualEnd = actualEnds.length
          ? actualEnds.reduce((a, b) => a > b ? a : b) : null;

        const total = tasks.length;
        // Concluído = status "Concluído" OU actual_end preenchido (status é a fonte de verdade do usuário)
        const completed = tasks.filter(t => t.status === "Concluído" || !!t.actualEnd).length;
        const started = tasks.filter(t => !!t.actualStart || t.status === "Em andamento" || t.status === "Concluído").length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        let status;
        if (!isActive) {
          status = "Cancelado";
        } else if (completed === total && total > 0) {
          status = "Concluído";
        } else if (started > 0) {
          status = "Em andamento";
        } else if (plannedEnd && today > plannedEnd) {
          status = "Atrasado";
        } else {
          status = "Não iniciado";
        }

        return {
          phase_name: displayName,
          canonical_name: phaseName,
          is_local: false,
          is_active: isActive,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          actual_start: actualStart,
          actual_end: actualEnd,
          status,
          progress,
          order: idx,
        };
      });

    // 5. Fases locais (LocalSchedulePhase)
    const sortedLocalPhases = [...localPhases]
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    const localPhaseViews = sortedLocalPhases.map((phase, idx) => {
      const isActive = phase.is_active !== false;

      // Atividades locais desta fase (sem correspondência no template, excluindo inativadas)
      const phaseActivities = savedActivities.filter(a => {
        if (a.phase_name !== phase.phase_name) return false;
        // Pular atividades inativadas
        if (a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]")) return false;
        const normA = norm(a.activity_name || "");
        const inTemplate = SCHEDULE_TASKS.some(t => {
          const nt = norm(t.activity);
          return nt === normA || nt.includes(normA) || normA.includes(nt);
        });
        return !inTemplate;
      });

      const actualStarts = phaseActivities.map(a => a.actual_start).filter(Boolean);
      const actualEnds = phaseActivities.map(a => a.actual_end).filter(Boolean);
      const actualStart = actualStarts.length
        ? actualStarts.reduce((a, b) => a < b ? a : b) : phase.planned_start || null;
      const actualEnd = actualEnds.length
        ? actualEnds.reduce((a, b) => a > b ? a : b) : null;

      const total = phaseActivities.length;
      // Concluído = status "Concluído" OU actual_end preenchido (atividades inativadas já foram excluídas acima)
      const completed = phaseActivities.filter(a => a.status === "Concluído" || !!a.actual_end).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      let status = phase.status || "Não iniciado";
      if (!isActive) status = "Cancelado";

      return {
        phase_name: phase.phase_name,
        canonical_name: null,
        is_local: true,
        is_active: isActive,
        planned_start: phase.planned_start || null,
        planned_end: phase.planned_end || null,
        actual_start: actualStart,
        actual_end: actualEnd,
        status,
        progress,
        order: 1000 + idx, // fases locais após as do template
      };
    });

    // 6. Combinar e filtrar conforme includeInactive
    const allPhases = [...templatePhases, ...localPhaseViews];

    return includeInactive
      ? allPhases
      : allPhases.filter(p => p.is_active !== false);

  } catch (err) {
    // FALLBACK SEGURO: qualquer falha retorna array vazio com warning
    console.warn("[buildProjectScheduleView] Falha ao calcular cronograma:", err?.message || err);
    return [];
  }
}