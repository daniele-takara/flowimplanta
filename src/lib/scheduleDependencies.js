// ============================================================
// DEPENDÊNCIAS DE ATIVIDADES DO CRONOGRAMA
// Lógica de referências unificadas, detecção de ciclos e
// recálculo em cascata — isolada do engine de cálculo existente.
// ============================================================

import { workday } from "@/lib/scheduleEngine.js";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";

// ── Ref helpers ──────────────────────────────────────────────
// Formato: "tmpl:task_id" (template) ou "local:entity_id" (local)
export function buildRef(type, id) {
  return `${type}:${id}`;
}

export function parseRef(ref) {
  if (!ref) return { type: null, id: null };
  const idx = ref.indexOf(":");
  if (idx === -1) return { type: null, id: ref };
  return { type: ref.substring(0, idx), id: ref.substring(idx + 1) };
}

// ── Date accessors ───────────────────────────────────────────
// Lê planned_end de qualquer atividade (template ou local) do estado atual
export function getActivityEnd(ref, computedDates, overrides, localActivities) {
  const { type, id } = parseRef(ref);
  if (type === "tmpl") {
    return overrides?.[id]?.plannedEnd || computedDates?.[id]?.plannedEnd || null;
  }
  if (type === "local") {
    const act = (localActivities || []).find(a => a.id === id);
    return act?.planned_end || null;
  }
  return null;
}

export function getActivityStart(ref, computedDates, overrides, localActivities) {
  const { type, id } = parseRef(ref);
  if (type === "tmpl") {
    return overrides?.[id]?.plannedStart || computedDates?.[id]?.plannedStart || null;
  }
  if (type === "local") {
    const act = (localActivities || []).find(a => a.id === id);
    return act?.planned_start || null;
  }
  return null;
}

// ── Cycle detection (DFS) ────────────────────────────────────
// Verifica se adicionar a aresta (successorRef → predecessorRef)
// criaria um ciclo no grafo de dependências existente.
export function wouldCreateCycle(dependencies, successorRef, predecessorRef) {
  if (successorRef === predecessorRef) return true; // auto-referência

  const graph = {}; // successor_ref → [predecessor_refs]
  (dependencies || []).forEach(d => {
    if (!graph[d.successor_ref]) graph[d.successor_ref] = [];
    graph[d.successor_ref].push(d.predecessor_ref);
  });

  const visited = new Set();
  function dfs(node) {
    if (node === successorRef) return true; // chegou de volta ao origem = ciclo
    if (visited.has(node)) return false;
    visited.add(node);
    for (const p of (graph[node] || [])) {
      if (dfs(p)) return true;
    }
    return false;
  }
  return dfs(predecessorRef);
}

// ── Topological sort of successors ───────────────────────────
// Retorna successor_refs em ordem: predecessoras antes de sucessoras
export function topoSortSuccessors(dependencies) {
  const successors = new Set((dependencies || []).map(d => d.successor_ref));
  const adj = {}; // predecessor_ref → [successor_refs]
  const inDegree = {};

  (dependencies || []).forEach(d => {
    if (!adj[d.predecessor_ref]) adj[d.predecessor_ref] = [];
    adj[d.predecessor_ref].push(d.successor_ref);
    if (successors.has(d.predecessor_ref)) {
      inDegree[d.successor_ref] = (inDegree[d.successor_ref] || 0) + 1;
    }
  });

  const queue = [];
  successors.forEach(s => {
    if (!inDegree[s]) queue.push(s);
  });

  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    (adj[node] || []).forEach(succ => {
      inDegree[succ] = (inDegree[succ] || 0) - 1;
      if (inDegree[succ] === 0) queue.push(succ);
    });
  }

  return order;
}

// ── Compute successor planned_start from its dependencies ──
// Para cada predecessora, calcula workday(predEnd, offset).
// Sucessora inicia na maior data candidata (garante que todas
// as predecessoras terminaram antes).
export function computeSuccessorStart(depsForSuccessor, getEnd) {
  const candidates = (depsForSuccessor || [])
    .map(d => {
      const predEnd = getEnd(d.predecessor_ref);
      if (!predEnd) return null;
      return workday(predEnd, d.start_offset_days || 0);
    })
    .filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a > b ? a : b));
}

// ── Compute template task end from new start ────────────────
// Para fórmulas simples (workday(plannedStart, N) ou sameDay),
// calcula o novo planned_end. Para fórmulas complexas, mantém o atual.
export function computeTemplateEnd(task, newStart, currentEnd) {
  if (!task?.plannedEnd?.formula) return currentEnd || null;
  const formula = task.plannedEnd.formula;
  const wdMatch = formula.match(/^workday\(plannedStart,\s*([-\d]+)\)$/);
  if (wdMatch) return workday(newStart, parseInt(wdMatch[1]));
  if (formula === "sameDay(plannedStart)") return newStart;
  return currentEnd || null;
}

// ── Compute business-day duration between two dates ─────────
export function computeDurationDays(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  let count = 0;
  let current = startStr;
  while (current < endStr) {
    current = workday(current, 1);
    count++;
    if (count > 365) break; // safety
  }
  return count;
}

// ── Full cascade recalculation ───────────────────────────────
// Recalcula planned_start de todas as sucessoras com dependências,
// em ordem topológica, e retorna as atualizações a persistir.
//
// SEGURANÇA:
// - Só altera atividades que TÊM dependências definidas.
// - Para template: só sobrescreve overrides com origin "dependency"
//   (respeita overrides manuais e Pipedrive).
// - É idempotente: se a data já está correta, não gera update.
export function cascadeRecalculate({
  dependencies,
  computedDates,
  overrides,
  localActivities,
}) {
  const overrideUpdates = {};
  const localUpdates = {};

  if (!dependencies || dependencies.length === 0) {
    return { overrideUpdates, localUpdates };
  }

  // Build successor graph
  const succDeps = {};
  dependencies.forEach(d => {
    if (!succDeps[d.successor_ref]) succDeps[d.successor_ref] = [];
    succDeps[d.successor_ref].push(d);
  });

  // Topological sort
  const order = topoSortSuccessors(dependencies);

  // Date snapshot (updated as we process each successor)
  const dateSnapshot = {};
  function getEnd(ref) {
    if (dateSnapshot[ref]) return dateSnapshot[ref];
    return getActivityEnd(ref, computedDates, overrides, localActivities);
  }

  for (const successorRef of order) {
    const depsForThis = succDeps[successorRef];
    if (!depsForThis || depsForThis.length === 0) continue;

    const newStart = computeSuccessorStart(depsForThis, getEnd);
    if (!newStart) continue;

    const { type, id } = parseRef(successorRef);

    if (type === "tmpl") {
      // Só atualiza se origin é "dependency" ou não há override existente
      const existingOrigin = overrides?.[id]?._origin?.plannedStart;
      if (existingOrigin && existingOrigin !== "dependency") continue;

      // Idempotência
      const currentStart = overrides?.[id]?.plannedStart || computedDates?.[id]?.plannedStart;
      const task = SCHEDULE_TASKS.find(t => t.id === id);
      const currentEnd = getActivityEnd(successorRef, computedDates, overrides, localActivities);
      const newEnd = computeTemplateEnd(task, newStart, currentEnd);

      if (newStart === currentStart && (newEnd || null) === (currentEnd || null)) continue;

      overrideUpdates[id] = { plannedStart: newStart, plannedEnd: newEnd };
      dateSnapshot[successorRef] = newEnd || newStart;
    } else if (type === "local") {
      const act = (localActivities || []).find(a => a.id === id);
      const oldStart = act?.planned_start;
      const oldEnd = act?.planned_end;
      const durationDays = computeDurationDays(oldStart, oldEnd);
      const newEnd = durationDays > 0 ? workday(newStart, durationDays) : (oldEnd || null);

      // Idempotência
      if (oldStart === newStart && (oldEnd || null) === (newEnd || null)) continue;

      localUpdates[id] = { planned_start: newStart, planned_end: newEnd };
      dateSnapshot[successorRef] = newEnd || newStart;
    }
  }

  return { overrideUpdates, localUpdates };
}