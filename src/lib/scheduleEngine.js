// ============================================================
// MOTOR DE CRONOGRAMA — baseado no JSON da especificação
// Implementa WORKDAY, regras condicionais e cálculo de datas
// ============================================================

// ── WORKDAY (dias úteis, sem fins de semana) ─────────────────
// Feriados podem ser adicionados futuramente via holidaySource
const BR_HOLIDAYS_2024_2026 = new Set([
  "2024-01-01","2024-04-21","2024-05-01","2024-09-07","2024-10-12",
  "2024-11-02","2024-11-15","2024-12-25",
  "2025-01-01","2025-04-18","2025-04-21","2025-05-01","2025-09-07",
  "2025-10-12","2025-11-02","2025-11-15","2025-12-25",
  "2026-01-01","2026-04-03","2026-04-21","2026-05-01","2026-09-07",
  "2026-10-12","2026-11-02","2026-11-15","2026-12-25",
]);

function toISODate(d) {
  if (!d) return null;
  if (typeof d === "string") return d.substring(0, 10);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
}

function isBusinessDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (BR_HOLIDAYS_2024_2026.has(dateStr)) return false;
  return true;
}

export function workday(dateStr, offset) {
  if (!dateStr) return null;
  let d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  let remaining = Math.abs(offset);
  const dir = offset >= 0 ? 1 : -1;

  if (offset === 0) return toISODate(d);

  while (remaining > 0) {
    d.setDate(d.getDate() + dir);
    if (isBusinessDay(toISODate(d))) {
      remaining--;
    }
  }
  return toISODate(d);
}

// ── HELPERS ────────────────────────────────────────────────────
export function maxDate(...dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

export function minDate(...dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a < b ? a : b));
}

// ── REGRAS CONDICIONAIS ───────────────────────────────────────
export function evaluateCondition(task, answersMap, project) {
  const mods = project?.contracted_modules || [];
  const svcs = project?.contracted_services || [];
  const a = answersMap || {};

  function getVal(source) {
    if (!source) return "";
    if (source.startsWith("escopo.")) {
      const qid = source.replace("escopo.", "");
      return a[qid] || "";
    }
    if (source === "dados_iniciais.modulos_contratados") return mods;
    if (source === "dados_iniciais.servicos_contratados") return svcs;
    if (source === "dados_iniciais.origem_cliente") return project?.origin || "";
    return "";
  }

  function checkSingle(cond) {
    const val = getVal(cond.source);
    if (cond.equals !== undefined) return val === cond.equals;
    if (cond.contains !== undefined) {
      if (Array.isArray(val)) return val.includes(cond.contains);
      return String(val).includes(cond.contains);
    }
    if (cond.notContains !== undefined) {
      if (Array.isArray(val)) return !val.includes(cond.notContains);
      return !String(val).includes(cond.notContains);
    }
    if (cond.containsAny !== undefined) {
      if (Array.isArray(val)) return cond.containsAny.some(x => val.includes(x));
      return cond.containsAny.some(x => String(val).includes(x));
    }
    return true;
  }

  const { visibleWhen, visibleWhenAny, visibleWhenAll } = task;

  if (visibleWhen === "always" || !visibleWhen && !visibleWhenAny && !visibleWhenAll) return true;

  if (typeof visibleWhen === "string" && visibleWhen !== "always") {
    // parse "escopo.q006 == 'Sim'"
    const match = visibleWhen.match(/(\S+)\s*==\s*'([^']+)'/);
    if (match) return checkSingle({ source: match[1], equals: match[2] });
    return true;
  }

  if (visibleWhen && typeof visibleWhen === "object") {
    return checkSingle(visibleWhen);
  }

  if (visibleWhenAny) {
    return visibleWhenAny.some(cond => checkSingle(cond));
  }

  if (visibleWhenAll) {
    return visibleWhenAll.every(cond => checkSingle(cond));
  }

  return true;
}

// ── MOTOR DE DATAS ─────────────────────────────────────────────
// Calcula todas as datas do cronograma a partir das âncoras e fórmulas
export function computeSchedule(tasks, anchors, answersMap, project) {
  // anchors: { [taskId]: { plannedStart, plannedEnd } } — overrides manuais salvos
  const dates = {}; // { [taskId]: { plannedStart, plannedEnd } }

  // Filtrar tarefas visíveis
  const visible = new Set(
    tasks.filter(t => evaluateCondition(t, answersMap, project)).map(t => t.id)
  );

  function getD(taskId, field) {
    return dates[taskId]?.[field] || null;
  }

  // Resolve fórmula de data
  function resolve(formula, selfId, field, fallbackFormula) {
    if (!formula) return null;

    // workday(ref.field, offset)
    const wdMatch = formula.match(/^workday\(([^,]+),\s*([-\d]+)\)$/);
    if (wdMatch) {
      const refExpr = wdMatch[1].trim();
      const offset = parseInt(wdMatch[2]);
      const base = resolveRef(refExpr, selfId, field);
      if (base) return workday(base, offset);
      // fallback se predecessor não resolveu
      if (fallbackFormula) return resolve(fallbackFormula, selfId, field);
      return null;
    }

    // sameDay(ref)
    const sdMatch = formula.match(/^sameDay\(([^)]+)\)$/);
    if (sdMatch) {
      const refExpr = sdMatch[1].trim();
      const val = resolveRef(refExpr, selfId, field);
      if (val) return val;
      if (fallbackFormula) return resolve(fallbackFormula, selfId, field);
      return null;
    }

    // Direct ref: taskId.field
    if (/^[\w]+\.[\w]+$/.test(formula)) {
      const val = resolveRef(formula, selfId, field);
      if (val) return val;
      if (fallbackFormula) return resolve(fallbackFormula, selfId, field);
      return null;
    }

    return null;
  }

  function resolveRef(expr, selfId, selfField) {
    if (expr === "plannedStart") {
      return getD(selfId, "plannedStart");
    }
    const parts = expr.split(".");
    if (parts.length === 2) {
      return getD(parts[0], parts[1]);
    }
    return null;
  }

  // Processa tarefas em múltiplos passes para resolver dependências em qualquer ordem.
  // 8 passes cobrem cadeias de dependência longas (ex: A→B→C→D→E→F→G→H).
  // Em cada passe, tentamos resolver APENAS datas ainda não calculadas (evita sobrescrever).
  // Âncoras e manual_override são aplicados sempre (pass 0 incluído) — não dependem de outras tarefas.
  const MAX_PASSES = 8;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    for (const task of tasks) {
      if (!visible.has(task.id)) continue;

      const anchorOverride = anchors?.[task.id];
      const d = dates[task.id] || {};

      // plannedStart
      const startSpec = task.plannedStart;
      if (startSpec) {
        if (startSpec.type === "anchor") {
          const val = anchorOverride?.plannedStart || null;
          if (val) d.plannedStart = val;
        } else if (startSpec.type === "manual_override") {
          const val = anchorOverride?.plannedStart || null;
          if (val) d.plannedStart = val;
        } else if (startSpec.type === "calculated" && startSpec.formula) {
          // Calculado: resolve fórmula, depois aplica override manual se existir
          if (!d.plannedStart) {
            const computed = resolve(startSpec.formula, task.id, "plannedStart", startSpec.fallback);
            if (computed) d.plannedStart = computed;
          }
          // Override manual/Pipedrive sempre prevalece sobre o calculado
          const val = anchorOverride?.plannedStart || null;
          if (val) d.plannedStart = val;
        }
      }

      // plannedEnd
      const endSpec = task.plannedEnd;
      if (endSpec) {
        if (endSpec.type === "anchor") {
          const val = anchorOverride?.plannedEnd || null;
          if (val) d.plannedEnd = val;
        } else if (endSpec.type === "manual_override") {
          const val = anchorOverride?.plannedEnd || null;
          if (val) d.plannedEnd = val;
        } else if (endSpec.type === "calculated" && endSpec.formula) {
          // Re-calcula sempre em cada passe para pegar dependências que acabaram de resolver
          const computed = resolve(endSpec.formula, task.id, "plannedEnd");
          if (computed) d.plannedEnd = computed;
          // Override manual/Pipedrive sempre prevalece sobre o calculado
          const val = anchorOverride?.plannedEnd || null;
          if (val) d.plannedEnd = val;
        }
      }

      dates[task.id] = d;
    }
  }

  // Calcular datas de phases/groups a partir de filhos visíveis
  for (const task of tasks) {
    if (task.type !== "phase" && task.type !== "group") continue;
    if (!visible.has(task.id)) continue;

    const children = tasks.filter(t =>
      t.id !== task.id &&
      t.phase === task.phase &&
      t.type === "task" &&
      visible.has(t.id)
    );

    if (children.length > 0) {
      const starts = children.map(c => dates[c.id]?.plannedStart).filter(Boolean);
      const ends = children.map(c => dates[c.id]?.plannedEnd).filter(Boolean);
      if (starts.length) dates[task.id] = { ...dates[task.id], plannedStart: minDate(...starts) };
      if (ends.length) dates[task.id] = { ...dates[task.id], plannedEnd: maxDate(...ends) };
    }
  }

  return { dates, visible };
}