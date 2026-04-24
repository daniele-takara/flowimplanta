import { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Save, X, Anchor, Pencil, Lock, AlertCircle } from "lucide-react";
import { SCHEDULE_TASKS, PHASE_ORDER, ANCHOR_IDS } from "@/lib/scheduleTasks.js";
import { computeSchedule, evaluateCondition, workday } from "@/lib/scheduleEngine.js";

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  try {
    const [y, m, day] = d.substring(0, 10).split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      map[key] = item.answer || "";
    }
  });
  return map;
}

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];

const STATUS_COLORS = {
  "Não iniciado": "bg-slate-100 text-slate-500",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Concluído": "bg-green-100 text-green-700",
  "Atrasado": "bg-red-100 text-red-700",
  "Bloqueado": "bg-orange-100 text-orange-700",
  "Cancelado": "bg-slate-100 text-slate-400 line-through",
};

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS["Não iniciado"]}`}>
      {status || "Não iniciado"}
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────

function TaskRow({ task, computedDates, manualOverrides, onSaveOverride, onSaveActivity, existingActivity }) {
  const [editing, setEditing] = useState(false);

  // Datas executadas NUNCA são preenchidas automaticamente — apenas pelo usuário
  // Status calculado com base nas datas executadas
  const actualStart = existingActivity?.actual_start || "";
  const actualEnd = existingActivity?.actual_end || "";
  const derivedStatus = existingActivity?.status || (() => {
    if (actualEnd) return "Concluído";
    if (actualStart) return "Em andamento";
    return "Não iniciado";
  })();

  const [form, setForm] = useState({
    planned_start_manual: manualOverrides?.[task.id]?.plannedStart || "",
    planned_end_manual: manualOverrides?.[task.id]?.plannedEnd || "",
    actual_start: actualStart,
    actual_end: actualEnd,
    status: derivedStatus,
    history_observations: existingActivity?.history_observations || "",
    responsible_leader: existingActivity?.responsible_leader || task.responsibleLeader || "",
    responsible_general: existingActivity?.responsible_general || task.responsibleGeneral || "",
  });
  const [saving, setSaving] = useState(false);

  const dates = computedDates[task.id] || {};
  const isAnchor = task.plannedStart?.type === "anchor";
  const startIsManual = task.plannedStart?.type === "manual_override";
  const endIsManual = task.plannedEnd?.type === "manual_override";

  const inputClass = "px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white";

  // Recalcular status sugerido ao alterar datas executadas
  const handleActualChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value };
      // Sugerir status se não foi manualmente alterado para Bloqueado/Cancelado
      const manualOnly = ["Bloqueado", "Cancelado"];
      if (!manualOnly.includes(next.status)) {
        if (next.actual_end) next.status = "Concluído";
        else if (next.actual_start) next.status = "Em andamento";
        else next.status = "Não iniciado";
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Salvar override de datas âncora/manuais
    const overridePayload = {};
    if (isAnchor || startIsManual) overridePayload.plannedStart = form.planned_start_manual || dates.plannedStart;
    if (endIsManual) overridePayload.plannedEnd = form.planned_end_manual;
    if (Object.keys(overridePayload).length > 0) {
      await onSaveOverride(task.id, overridePayload);
    }
    // Salvar atividade — datas executadas só se o usuário preencheu
    await onSaveActivity(task, {
      actual_start: form.actual_start,
      actual_end: form.actual_end,
      status: form.status,
      history_observations: form.history_observations,
      responsible_leader: form.responsible_leader,
      responsible_general: form.responsible_general,
    });
    setSaving(false);
    setEditing(false);
  };

  const displayStart = (isAnchor || startIsManual)
    ? (form.planned_start_manual || dates.plannedStart)
    : dates.plannedStart;
  const displayEnd = endIsManual
    ? (form.planned_end_manual || dates.plannedEnd)
    : dates.plannedEnd;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
      {/* Atividade */}
      <td className="px-4 py-2.5 text-sm text-slate-700 max-w-[280px]">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <span className="leading-snug">{task.activity}</span>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {isAnchor && (
                <span className="flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                  <Anchor className="w-2.5 h-2.5" />Data âncora
                </span>
              )}
              {startIsManual && (
                <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                  <Pencil className="w-2.5 h-2.5" />Edição manual
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Data planejada início */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing && (isAnchor || startIsManual) ? (
          <input type="date" value={form.planned_start_manual} onChange={e => setForm(f => ({ ...f, planned_start_manual: e.target.value }))} className={inputClass} />
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-600">{fmtDate(displayStart)}</span>
            {!isAnchor && !startIsManual && <Lock className="w-2.5 h-2.5 text-slate-300" title="Data calculada automaticamente" />}
          </div>
        )}
      </td>

      {/* Data planejada fim */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing && endIsManual ? (
          <input type="date" value={form.planned_end_manual} onChange={e => setForm(f => ({ ...f, planned_end_manual: e.target.value }))} className={inputClass} />
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-600">{fmtDate(displayEnd)}</span>
            {!endIsManual && <Lock className="w-2.5 h-2.5 text-slate-300" title="Data calculada automaticamente" />}
          </div>
        )}
      </td>

      {/* Data executada início */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing ? (
          <input type="date" value={form.actual_start} onChange={e => handleActualChange("actual_start", e.target.value)} className={inputClass} />
        ) : (
          <span className="text-xs text-slate-500">{fmtDate(form.actual_start) !== "—" ? fmtDate(form.actual_start) : <span className="text-slate-300">—</span>}</span>
        )}
      </td>

      {/* Data executada fim */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing ? (
          <input type="date" value={form.actual_end} onChange={e => handleActualChange("actual_end", e.target.value)} className={inputClass} />
        ) : (
          <span className="text-xs text-slate-500">{fmtDate(form.actual_end) !== "—" ? fmtDate(form.actual_end) : <span className="text-slate-300">—</span>}</span>
        )}
      </td>

      {/* Responsável geral */}
      <td className="px-3 py-2.5 max-w-[100px]">
        {editing ? (
          <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} placeholder="Responsável" />
        ) : (
          <span className="text-xs text-slate-500 truncate block">{form.responsible_general || "—"}</span>
        )}
      </td>

      {/* Responsável líder */}
      <td className="px-3 py-2.5 max-w-[100px]">
        {editing ? (
          <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} placeholder="Líder" />
        ) : (
          <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        {editing ? (
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        ) : (
          <StatusBadge status={form.status} />
        )}
      </td>

      {/* Observações internas */}
      <td className="px-3 py-2.5 max-w-[140px]">
        {editing ? (
          <input value={form.history_observations} onChange={e => setForm(f => ({ ...f, history_observations: e.target.value }))} className={inputClass} placeholder="Obs..." />
        ) : (
          <span className="text-xs text-slate-400 truncate block">{form.history_observations || "—"}</span>
        )}
      </td>

      {/* Ações */}
      <td className="px-3 py-2.5">
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Salvar">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors" title="Cancelar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1 whitespace-nowrap">Editar</button>
        )}
      </td>
    </tr>
  );
}

// ── Group Row ─────────────────────────────────────────────────

function GroupRow({ task, computedDates }) {
  const dates = computedDates[task.id] || {};
  return (
    <tr className="bg-slate-100 border-b border-slate-200">
      <td className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide" colSpan={3}>
        {task.activity}
      </td>
      <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(dates.plannedStart)} → {fmtDate(dates.plannedEnd)}</td>
      <td colSpan={6} />
    </tr>
  );
}

// ── Phase Section ─────────────────────────────────────────────

function PhaseSection({ phaseName, tasks, computedDates, manualOverrides, activitiesByTask, onSaveOverride, onSaveActivity }) {
  const [open, setOpen] = useState(true);

  const visibleTasks = tasks.filter(t => t.type === "task");
  if (visibleTasks.length === 0) return null;

  return (
    <div className="mb-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 px-5 py-3.5 bg-blue-600 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white">{phaseName}</h3>
        <span className="text-xs text-blue-200 ml-auto">{visibleTasks.length} atividade(s)</span>
      </div>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 min-w-[250px]">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Início Planejado</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Fim Planejado</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Início Executado</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Fim Executado</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Resp. Geral</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Resp. Líder</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Obs. Internas</th>
                <th className="px-3 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                if (task.type === "group") {
                  return <GroupRow key={task.id} task={task} computedDates={computedDates} />;
                }
                if (task.type === "task") {
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      computedDates={computedDates}
                      manualOverrides={manualOverrides}
                      onSaveOverride={onSaveOverride}
                      onSaveActivity={onSaveActivity}
                      existingActivity={activitiesByTask[task.id]}
                    />
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────

export default function ScheduleTab({ scopeItems, project, projectId, onRefresh }) {
  // manualOverrides: { [taskId]: { plannedStart, plannedEnd } }
  const [manualOverrides, setManualOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
    } catch { return {}; }
  });

  // Atividades salvas no banco (actual dates, status, obs)
  const [savedActivities, setSavedActivities] = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);

  // Carregar atividades salvas
  useMemo(() => {
    if (!activitiesLoaded && projectId) {
      base44.entities.ScheduleActivity.filter({ project_id: projectId }).then(acts => {
        setSavedActivities(acts || []);
        setActivitiesLoaded(true);
      }).catch(() => setActivitiesLoaded(true));
    }
  }, [projectId, activitiesLoaded]);

  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);

  // Filtrar tarefas visíveis
  const { dates: computedDates, visible } = useMemo(() => {
    return computeSchedule(SCHEDULE_TASKS, manualOverrides, answersMap, project);
  }, [manualOverrides, answersMap, project]);

  // Agrupar por fase
  const tasksByPhase = useMemo(() => {
    const grouped = {};
    SCHEDULE_TASKS.forEach(task => {
      if (!visible.has(task.id)) return;
      const ph = task.phase || "Geral";
      if (!grouped[ph]) grouped[ph] = [];
      grouped[ph].push(task);
    });
    return grouped;
  }, [visible]);

  // Mapa de atividades por taskId
  const activitiesByTask = useMemo(() => {
    const map = {};
    savedActivities.forEach(a => {
      if (a.activity_name) {
        // Match por activity_name ou por phase_name+activity
        const found = SCHEDULE_TASKS.find(t => t.activity === a.activity_name);
        if (found) map[found.id] = a;
      }
    });
    return map;
  }, [savedActivities]);

  // Salvar override de datas âncora/manuais no localStorage + disparar recálculo
  const handleSaveOverride = useCallback((taskId, payload) => {
    const next = {
      ...manualOverrides,
      [taskId]: { ...(manualOverrides[taskId] || {}), ...payload }
    };
    localStorage.setItem(`schedule_overrides_${projectId}`, JSON.stringify(next));
    setManualOverrides(next);
  }, [manualOverrides, projectId]);

  // Salvar atividade (actual dates, status, obs) no banco
  // Datas executadas nunca são preenchidas automaticamente — apenas o que o usuário digitou
  const handleSaveActivity = useCallback(async (task, data) => {
    const existing = activitiesByTask[task.id];
    const payload = {
      actual_start: data.actual_start || null,
      actual_end: data.actual_end || null,
      status: data.status || "Não iniciado",
      history_observations: data.history_observations || "",
      responsible_leader: data.responsible_leader || "",
      responsible_general: data.responsible_general || "",
    };
    if (existing) {
      await base44.entities.ScheduleActivity.update(existing.id, payload);
      setSavedActivities(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a));
    } else {
      const created = await base44.entities.ScheduleActivity.create({
        project_id: projectId,
        phase_name: task.phase,
        activity_name: task.activity,
        order: task.row,
        ...payload,
      });
      setSavedActivities(prev => [...prev, created]);
    }
  }, [activitiesByTask, projectId]);

  const phases = PHASE_ORDER.filter(ph => tasksByPhase[ph] && tasksByPhase[ph].some(t => t.type === "task"));

  const anchors = SCHEDULE_TASKS.filter(t => t.plannedStart?.type === "anchor");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Cronograma Detalhado</h2>
          <p className="text-sm text-slate-400">Gerado automaticamente com base em Dados Iniciais e Escopo Técnico</p>
        </div>
      </div>

      {/* Âncoras — painel de datas âncora no topo */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Datas Âncora — editar para recalcular o cronograma</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {anchors.map(anchor => {
            const currentVal = manualOverrides[anchor.id]?.plannedStart || computedDates[anchor.id]?.plannedStart || "";
            return (
              <div key={anchor.id} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1 leading-tight">{anchor.activity}</p>
                <input
                  type="date"
                  value={currentVal}
                  onChange={e => {
                    handleSaveOverride(anchor.id, { plannedStart: e.target.value });
                  }}
                  className="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
            <Anchor className="w-2.5 h-2.5" />Data âncora
          </span>
          Editável e recalcula dependentes
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
            <Pencil className="w-2.5 h-2.5" />Edição manual
          </span>
          Editável, sem impacto em outras datas
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-300" />
          Data calculada automaticamente (somente leitura)
        </div>
      </div>

      {/* Sem âncoras definidas */}
      {!manualOverrides["alinhamento_inicial"]?.plannedStart && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Defina a data do <strong>Alinhamento inicial</strong> no painel acima para calcular o cronograma completo.
        </div>
      )}

      {/* Tabela por fase */}
      {phases.map(ph => (
        <PhaseSection
          key={ph}
          phaseName={ph}
          tasks={tasksByPhase[ph]}
          computedDates={computedDates}
          manualOverrides={manualOverrides}
          activitiesByTask={activitiesByTask}
          onSaveOverride={handleSaveOverride}
          onSaveActivity={handleSaveActivity}
        />
      ))}

      {phases.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma fase visível. Verifique os módulos contratados e o Escopo Técnico.
        </div>
      )}
    </div>
  );
}