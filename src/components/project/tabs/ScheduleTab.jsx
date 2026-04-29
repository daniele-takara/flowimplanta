import { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Save, X, Anchor, Pencil, Lock, AlertCircle, CheckCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { SCHEDULE_TASKS, PHASE_ORDER, ANCHOR_IDS } from "@/lib/scheduleTasks.js";
import { computeSchedule, evaluateCondition, workday } from "@/lib/scheduleEngine.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS, resolveGeneralResponsible } from "@/lib/resolveResponsibleRole.js";

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

function TaskRow({ task, computedDates, manualOverrides, onSaveOverride, onSaveActivity, existingActivity, project, templateConfig }) {
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

  // Resolver papel responsável e responsável geral via template + dados iniciais
  const taskConfig = templateConfig?.[task.id];
  const resolvedRoleName = taskConfig?.responsible_role
    ? resolveRoleToName(taskConfig.responsible_role, project)
    : null;
  const roleLabel = taskConfig?.responsible_role
    ? RESPONSIBLE_ROLE_LABELS[taskConfig.responsible_role] || taskConfig.responsible_role
    : null;
  const resolvedGeneralName = taskConfig?.responsible_general_type
    ? resolveGeneralResponsible(taskConfig.responsible_general_type, project)
    : null;
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
      <td className="px-3 py-2.5 max-w-[120px]">
        {editing ? (
          <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} placeholder="Responsável" />
        ) : (
          <div>
            {resolvedGeneralName ? (
              <span className="text-xs font-medium text-slate-700 truncate block">{resolvedGeneralName}</span>
            ) : (
              <span className="text-xs text-slate-500 truncate block">{form.responsible_general || "—"}</span>
            )}
          </div>
        )}
      </td>

      {/* Responsável líder */}
      <td className="px-3 py-2.5 max-w-[120px]">
        {editing ? (
          <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} placeholder="Líder" />
        ) : (
          <div>
            {resolvedRoleName ? (
              <div>
                <span className="text-xs font-medium text-slate-700 block truncate">{resolvedRoleName}</span>
                <span className="text-xs text-slate-400 block truncate" title={roleLabel}>{roleLabel}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>
            )}
          </div>
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
          <div className="flex flex-col gap-1">
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1 whitespace-nowrap">Editar</button>
            {!form.actual_start && !form.actual_end && (
              <button
                onClick={async () => {
                  const d = computedDates[task.id] || {};
                  const plannedStart = manualOverrides?.[task.id]?.plannedStart || d.plannedStart || null;
                  const plannedEnd = manualOverrides?.[task.id]?.plannedEnd || d.plannedEnd || null;
                  setSaving(true);
                  await onSaveActivity(task, {
                    actual_start: plannedStart,
                    actual_end: plannedEnd,
                    status: "Concluído",
                    history_observations: form.history_observations,
                    responsible_leader: form.responsible_leader,
                    responsible_general: form.responsible_general,
                  });
                  setForm(f => ({ ...f, actual_start: plannedStart || "", actual_end: plannedEnd || "", status: "Concluído" }));
                  setSaving(false);
                }}
                disabled={saving}
                className="text-xs text-green-600 hover:underline px-1 whitespace-nowrap"
                title="Preencher datas executadas = planejadas e marcar como Concluído"
              >
                ✓ Conf. planejado
              </button>
            )}
          </div>
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

function PhaseSection({ phaseName, tasks, computedDates, manualOverrides, activitiesByTask, onSaveOverride, onSaveActivity, onCompletePhase, project, templateConfig, readOnly }) {
  const [open, setOpen] = useState(true);
  const [completing, setCompleting] = useState(false);

  const visibleTasks = tasks.filter(t => t.type === "task");
  if (visibleTasks.length === 0) return null;

  const handleCompletePhase = async (e) => {
    e.stopPropagation();
    setCompleting(true);
    await onCompletePhase(visibleTasks);
    setCompleting(false);
  };

  return (
    <div className="mb-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 px-5 py-3.5 bg-blue-600 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white">{phaseName}</h3>
        <span className="text-xs text-blue-200">{visibleTasks.length} atividade(s)</span>
        {!readOnly && (
          <button
            onClick={handleCompletePhase}
            disabled={completing}
            className="ml-auto flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 transition-colors font-medium"
          >
            {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Concluir fase conforme planejado
          </button>
        )}
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
                      project={project}
                      templateConfig={templateConfig}
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

// ── Sync Pipedrive Button ─────────────────────────────────────

function SyncPipedriveButton({ projectId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setShowDetails(false);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId });
      const data = res.data;
      if (data.error) {
        setError(data.detail || data.error);
      } else {
        setResult(data);
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.error || e.message;
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-colors bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100 disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Atualizar Cronograma (Pipedrive)
      </button>

      {result && (
        <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-sm text-right w-full">
          <div className="flex items-center justify-between gap-2 text-green-800">
            <span>✓ Deal #{result.deal_id} · Stage {result.deal_stage_id}</span>
            <button onClick={() => setShowDetails(v => !v)} className="text-green-600 underline shrink-0">
              {showDetails ? "ocultar" : "detalhes"}
            </button>
          </div>
          <div className="text-green-700 mt-0.5">
            {result.updated} atualizada(s) · {result.created > 0 ? `${result.created} criada(s) · ` : ""}{result.rules_applied} regra(s) · {result.activities_found} activities Pipedrive
          </div>
          {showDetails && (
            <div className="mt-2 text-left bg-white border border-green-100 rounded p-2 space-y-0.5 text-green-900">
              <p>Activities concluídas: <strong>{result.activities_done}</strong></p>
              <p>Regras na planilha: <strong>{result.rules_total}</strong></p>
              {result.activities?.length > 0 && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs">
                  {result.activities.map((a, i) => (
                    <li key={i}><span className="font-semibold">{a.name}</span> ({a.phase}) — {JSON.stringify(a.patch)}</li>
                  ))}
                </ul>
              )}
              {result.activities_created?.length > 0 && (
                <div className="mt-1">
                  <p className="font-bold text-blue-700">Atividades criadas automaticamente:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-blue-800">
                    {result.activities_created.map((a, i) => (
                      <li key={i}><span className="font-semibold">{a.name}</span> ({a.phase})</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.available_phases?.length > 0 && (
                  <div className="mt-1">
                    <p className="font-semibold text-green-800">Fases carregadas do projeto ({result.schedule_activities_count} atividades):</p>
                    <ul className="list-disc pl-4 text-green-700 font-mono space-y-0.5">
                      {result.available_phases.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {result.match_errors?.length > 0 && (
                  <div className="mt-1 text-amber-700">
                    <p className="font-bold">Inconsistências:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {result.match_errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 max-w-sm text-right w-full">
          Erro: {error}
        </div>
      )}
    </div>
  );
}

// ── Complete Project Button ───────────────────────────────────

function CompleteProjectButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await onComplete();
    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-colors bg-green-50 text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
      {done ? "Cronograma atualizado!" : "Concluir projeto conforme planejado"}
    </button>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────

export default function ScheduleTab({ scopeItems, project, projectId, onRefresh, readOnly = false, onSyncSuccess }) {
  // manualOverrides: { [taskId]: { plannedStart, plannedEnd } }
  const [manualOverrides, setManualOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
    } catch { return {}; }
  });

  // Atividades salvas no banco (actual dates, status, obs)
  const [savedActivities, setSavedActivities] = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);

  // Template padrão (para responsible_role)
  const [templateConfig, setTemplateConfig] = useState({});

  // Carregar atividades salvas + template padrão
  useEffect(() => {
    if (!activitiesLoaded && projectId) {
      base44.entities.ScheduleActivity.filter({ project_id: projectId }).then(acts => {
        setSavedActivities(acts || []);
        setActivitiesLoaded(true);
      }).catch(() => setActivitiesLoaded(true));
    }
  }, [projectId, activitiesLoaded]);

  useEffect(() => {
    base44.entities.ScheduleTemplate.filter({ is_default: true }).then(list => {
      if (list.length > 0) {
        try {
          setTemplateConfig(JSON.parse(list[0].tasks_config || "{}"));
        } catch { setTemplateConfig({}); }
      }
    }).catch(() => {});
  }, []);

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

  // Concluir atividades conforme planejado (sem sobrescrever datas já preenchidas)
  const handleCompleteAsTasks = useCallback(async (tasks) => {
    const toUpdate = tasks.filter(task => {
      const existing = activitiesByTask[task.id];
      // Só atualizar se NÃO tiver datas reais já preenchidas
      return !existing?.actual_start && !existing?.actual_end;
    });

    await Promise.all(toUpdate.map(task => {
      const dates = computedDates[task.id] || {};
      const plannedStart = manualOverrides[task.id]?.plannedStart || dates.plannedStart || null;
      const plannedEnd = manualOverrides[task.id]?.plannedEnd || dates.plannedEnd || null;
      return handleSaveActivity(task, {
        actual_start: plannedStart,
        actual_end: plannedEnd,
        status: "Concluído",
        history_observations: activitiesByTask[task.id]?.history_observations || "",
        responsible_leader: activitiesByTask[task.id]?.responsible_leader || task.responsibleLeader || "",
        responsible_general: activitiesByTask[task.id]?.responsible_general || task.responsibleGeneral || "",
      });
    }));
  }, [activitiesByTask, computedDates, manualOverrides, handleSaveActivity]);

  const handleCompletePhase = useCallback(async (tasks) => {
    await handleCompleteAsTasks(tasks);
  }, [handleCompleteAsTasks]);

  const handleCompleteProject = useCallback(async () => {
    const allTasks = SCHEDULE_TASKS.filter(t => t.type === "task" && visible.has(t.id));
    await handleCompleteAsTasks(allTasks);
  }, [handleCompleteAsTasks, visible]);

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
        {!readOnly && (
          <div className="flex items-start gap-3">
            {project?.pipedrive_deal_id && (
              <SyncPipedriveButton
                projectId={projectId}
                onSuccess={() => {
                  setActivitiesLoaded(false);
                  if (onSyncSuccess) onSyncSuccess();
                }}
              />
            )}
            <CompleteProjectButton onComplete={handleCompleteProject} />
          </div>
        )}
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
                    if (!readOnly) handleSaveOverride(anchor.id, { plannedStart: e.target.value });
                  }}
                  readOnly={readOnly}
                  disabled={readOnly}
                  className={`w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 ${readOnly ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white"}`}
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
          onSaveOverride={readOnly ? () => {} : handleSaveOverride}
          onSaveActivity={readOnly ? () => {} : handleSaveActivity}
          onCompletePhase={readOnly ? () => {} : handleCompletePhase}
          readOnly={readOnly}
          project={project}
          templateConfig={templateConfig}
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