import { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Save, X, Anchor, Pencil, Lock, AlertCircle, CheckCircle, CheckCircle2, Loader2, RefreshCw, Database } from "lucide-react";
import { SCHEDULE_TASKS, PHASE_ORDER, ANCHOR_IDS } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS, resolveGeneralResponsible } from "@/lib/resolveResponsibleRole.js";

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
    // Prioridade 1: question_id canônico (ex: "q006", "q251")
    if (item.question_id) {
      map[item.question_id] = item.answer || "";
    }
    // Prioridade 2: derivar do order_number como fallback para itens legados
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      // Só grava via order_number se ainda não foi preenchido via question_id
      if (!map[key]) map[key] = item.answer || "";
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

function TaskRow({ task, computedDates, manualOverrides, onSaveOverride, onSaveActivity, existingActivity, project, templateConfig }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const actualStart = existingActivity?.actual_start || "";
  const actualEnd = existingActivity?.actual_end || "";
  const derivedStatus = existingActivity?.status || (actualEnd ? "Concluído" : actualStart ? "Em andamento" : "Não iniciado");

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

  // Re-sincroniza form quando existingActivity é atualizado externamente (ex: sync Pipedrive)
  useEffect(() => {
    const newActualStart = existingActivity?.actual_start || "";
    const newActualEnd = existingActivity?.actual_end || "";
    const newStatus = existingActivity?.status || (newActualEnd ? "Concluído" : newActualStart ? "Em andamento" : "Não iniciado");
    setForm(f => ({
      ...f,
      actual_start: newActualStart,
      actual_end: newActualEnd,
      status: newStatus,
      history_observations: existingActivity?.history_observations || f.history_observations,
      responsible_leader: existingActivity?.responsible_leader || f.responsible_leader,
      responsible_general: existingActivity?.responsible_general || f.responsible_general,
    }));
  }, [existingActivity?.actual_start, existingActivity?.actual_end, existingActivity?.status]);

  const taskConfig = templateConfig?.[task.id];
  const resolvedRoleName = taskConfig?.responsible_role ? resolveRoleToName(taskConfig.responsible_role, project) : null;
  const roleLabel = taskConfig?.responsible_role ? RESPONSIBLE_ROLE_LABELS[taskConfig.responsible_role] || taskConfig.responsible_role : null;
  const resolvedGeneralName = taskConfig?.responsible_general_type ? resolveGeneralResponsible(taskConfig.responsible_general_type, project) : null;

  const dates = computedDates[task.id] || {};
  const isAnchor = task.plannedStart?.type === "anchor";
  const startIsManual = task.plannedStart?.type === "manual_override";
  const endIsManual = task.plannedEnd?.type === "manual_override";
  const inputClass = "px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white";

  const handleActualChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (!["Bloqueado", "Cancelado"].includes(next.status)) {
        if (next.actual_end) next.status = "Concluído";
        else if (next.actual_start) next.status = "Em andamento";
        else next.status = "Não iniciado";
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const overridePayload = {};
    if (isAnchor || startIsManual) overridePayload.plannedStart = form.planned_start_manual || dates.plannedStart;
    if (endIsManual) overridePayload.plannedEnd = form.planned_end_manual;
    if (Object.keys(overridePayload).length > 0) await onSaveOverride(task.id, overridePayload);
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

  const displayStart = (isAnchor || startIsManual) ? (form.planned_start_manual || dates.plannedStart) : dates.plannedStart;
  const displayEnd = endIsManual ? (form.planned_end_manual || dates.plannedEnd) : dates.plannedEnd;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
      <td className="px-4 py-2.5 text-sm text-slate-700 max-w-[280px]">
        <div>
          <span className="leading-snug">{task.activity}</span>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {isAnchor && <span className="flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium"><Anchor className="w-2.5 h-2.5" />Data âncora</span>}
            {startIsManual && <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium"><Pencil className="w-2.5 h-2.5" />Edição manual</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing && (isAnchor || startIsManual)
          ? <input type="date" value={form.planned_start_manual} onChange={e => setForm(f => ({ ...f, planned_start_manual: e.target.value }))} className={inputClass} />
          : <div className="flex items-center gap-1"><span className="text-xs text-slate-600">{fmtDate(displayStart)}</span>{!isAnchor && !startIsManual && <Lock className="w-2.5 h-2.5 text-slate-300" />}</div>
        }
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing && endIsManual
          ? <input type="date" value={form.planned_end_manual} onChange={e => setForm(f => ({ ...f, planned_end_manual: e.target.value }))} className={inputClass} />
          : <div className="flex items-center gap-1"><span className="text-xs text-slate-600">{fmtDate(displayEnd)}</span>{!endIsManual && <Lock className="w-2.5 h-2.5 text-slate-300" />}</div>
        }
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing
          ? <input type="date" value={form.actual_start} onChange={e => handleActualChange("actual_start", e.target.value)} className={inputClass} />
          : <span className="text-xs text-slate-500">{form.actual_start ? fmtDate(form.actual_start) : <span className="text-slate-300">—</span>}</span>
        }
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {editing
          ? <input type="date" value={form.actual_end} onChange={e => handleActualChange("actual_end", e.target.value)} className={inputClass} />
          : <span className="text-xs text-slate-500">{form.actual_end ? fmtDate(form.actual_end) : <span className="text-slate-300">—</span>}</span>
        }
      </td>
      <td className="px-3 py-2.5 max-w-[120px]">
        {editing
          ? <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} placeholder="Responsável" />
          : <span className="text-xs text-slate-500 truncate block">{resolvedGeneralName || form.responsible_general || "—"}</span>
        }
      </td>
      <td className="px-3 py-2.5 max-w-[120px]">
        {editing
          ? <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} placeholder="Líder" />
          : resolvedRoleName
            ? <div><span className="text-xs font-medium text-slate-700 block truncate">{resolvedRoleName}</span><span className="text-xs text-slate-400 block truncate">{roleLabel}</span></div>
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>
        }
      </td>
      <td className="px-3 py-2.5">
        {editing
          ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select>
          : <StatusBadge status={form.status} />
        }
      </td>
      <td className="px-3 py-2.5 max-w-[140px]">
        {editing
          ? <input value={form.history_observations} onChange={e => setForm(f => ({ ...f, history_observations: e.target.value }))} className={inputClass} placeholder="Obs..." />
          : <span className="text-xs text-slate-400 truncate block">{form.history_observations || "—"}</span>
        }
      </td>
      <td className="px-3 py-2.5">
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1 whitespace-nowrap">Editar</button>
            {!form.actual_start && !form.actual_end && (
              <button
                onClick={async () => {
                  const d = computedDates[task.id] || {};
                  const ps = manualOverrides?.[task.id]?.plannedStart || d.plannedStart || null;
                  const pe = manualOverrides?.[task.id]?.plannedEnd || d.plannedEnd || null;
                  setSaving(true);
                  await onSaveActivity(task, { actual_start: ps, actual_end: pe, status: "Concluído", history_observations: form.history_observations, responsible_leader: form.responsible_leader, responsible_general: form.responsible_general });
                  setForm(f => ({ ...f, actual_start: ps || "", actual_end: pe || "", status: "Concluído" }));
                  setSaving(false);
                }}
                disabled={saving}
                className="text-xs text-green-600 hover:underline px-1 whitespace-nowrap"
              >✓ Conf. planejado</button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function GroupRow({ task, computedDates }) {
  const dates = computedDates[task.id] || {};
  return (
    <tr className="bg-slate-100 border-b border-slate-200">
      <td className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide" colSpan={3}>{task.activity}</td>
      <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(dates.plannedStart)} → {fmtDate(dates.plannedEnd)}</td>
      <td colSpan={6} />
    </tr>
  );
}

function PhaseSection({ phaseName, tasks, computedDates, manualOverrides, activitiesByTask, onSaveOverride, onSaveActivity, onCompletePhase, project, templateConfig, readOnly }) {
  const [open, setOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
  const visibleTasks = tasks.filter(t => t.type === "task");
  if (visibleTasks.length === 0) return null;

  return (
    <div className="mb-2 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-600 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white">{phaseName}</h3>
        <span className="text-xs text-blue-200">{visibleTasks.length} atividade(s)</span>
        {!readOnly && (
          <button
            onClick={async e => { e.stopPropagation(); setCompleting(true); await onCompletePhase(visibleTasks); setCompleting(false); }}
            disabled={completing}
            className="ml-auto flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
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
                if (task.type === "group") return <GroupRow key={task.id} task={task} computedDates={computedDates} />;
                if (task.type === "task") return (
                  <TaskRow key={task.id} task={task} computedDates={computedDates} manualOverrides={manualOverrides}
                    onSaveOverride={onSaveOverride} onSaveActivity={onSaveActivity}
                    existingActivity={activitiesByTask[task.id]} project={project} templateConfig={templateConfig} />
                );
                return null;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SyncPipedriveButton({ projectId, onSuccess, onReload }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    setLoading(true); setResult(null); setError(null); setShowDetails(false);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId });
      const data = res.data;
      if (data.error) setError(data.detail || data.error);
      else {
        setResult(data);
        if (onReload) onReload();       // refetch imediato das atividades
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={handleSync} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100 disabled:opacity-60">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Atualizar Cronograma (Pipedrive)
      </button>
      {result && (
        <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-sm text-right w-full">
          <div className="flex items-center justify-between gap-2 text-green-800">
            <span>✓ Deal #{result.deal_id} · Stage {result.deal_stage_id}</span>
            <button onClick={() => setShowDetails(v => !v)} className="text-green-600 underline shrink-0">{showDetails ? "ocultar" : "detalhes"}</button>
          </div>
          <div className="text-green-700 mt-0.5">{result.updated} atualizada(s) · {result.created > 0 ? `${result.created} criada(s) · ` : ""}{result.rules_applied} regra(s)</div>
          {showDetails && result.match_errors?.length > 0 && (
            <div className="mt-1 text-amber-700 text-left">
              <p className="font-bold">Inconsistências:</p>
              <ul className="list-disc pl-4">{result.match_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 max-w-sm text-right w-full">Erro: {error}</div>}
    </div>
  );
}

function CompleteProjectButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <button onClick={async () => { setLoading(true); await onComplete(); setLoading(false); setDone(true); setTimeout(() => setDone(false), 3000); }} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-green-50 text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-60">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
      {done ? "Cronograma atualizado!" : "Concluir projeto conforme planejado"}
    </button>
  );
}

export default function ScheduleTab({ scopeItems, project, projectId, onRefresh, readOnly = false, onSyncSuccess }) {
  const [anchorsLoaded, setAnchorsLoaded] = useState(false);
  const [manualOverrides, setManualOverrides] = useState({});

  // Carregar datas âncora: banco > localStorage (migração única)
  useEffect(() => {
    if (!projectId || anchorsLoaded) return;
    const bankAnchors = project?.schedule_anchor_dates || {};
    const hasBankData = Object.values(bankAnchors).some(Boolean);
    if (hasBankData) {
      const overrides = {};
      Object.entries(bankAnchors).forEach(([taskId, dateStr]) => {
        if (dateStr) overrides[taskId] = { plannedStart: dateStr };
      });
      setManualOverrides(overrides);
      setAnchorsLoaded(true);
      return;
    }
    // Migração localStorage → banco
    try {
      const local = JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
      if (Object.keys(local).length > 0) {
        setManualOverrides(local);
        const anchorDates = {};
        ANCHOR_IDS.forEach(id => { if (local[id]?.plannedStart) anchorDates[id] = local[id].plannedStart; });
        if (Object.keys(anchorDates).length > 0) {
          base44.entities.Project.update(projectId, { schedule_anchor_dates: anchorDates })
            .then(() => localStorage.removeItem(`schedule_overrides_${projectId}`))
            .catch(() => {});
        }
      }
    } catch {}
    setAnchorsLoaded(true);
  }, [projectId, project, anchorsLoaded]);

  const [savedActivities, setSavedActivities] = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [templateConfig, setTemplateConfig] = useState({});

  const reloadActivities = useCallback(() => {
    if (!projectId) return;
    base44.entities.ScheduleActivity.filter({ project_id: projectId })
      .then(acts => {
        console.log("[ScheduleTab] atividades recarregadas:", acts?.length, acts);
        setSavedActivities(acts || []);
        setActivitiesLoaded(true);
      })
      .catch(() => setActivitiesLoaded(true));
  }, [projectId]);

  useEffect(() => {
    if (!activitiesLoaded && projectId) reloadActivities();
  }, [projectId, activitiesLoaded, reloadActivities]);

  useEffect(() => {
    base44.entities.ScheduleTemplate.filter({ is_default: true }).then(list => {
      if (list.length > 0) try { setTemplateConfig(JSON.parse(list[0].tasks_config || "{}")); } catch {}
    }).catch(() => {});
  }, []);

  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);

  // Log diagnóstico: rastrear módulos usados no cálculo do cronograma
  const { dates: computedDates, visible } = useMemo(() => {
    const mods = project?.contracted_modules || [];
    const svcs = project?.contracted_services || [];
    console.log("[ScheduleTab] computeSchedule → contracted_modules:", mods, "| contracted_services:", svcs, "| answersMap keys:", Object.keys(answersMap).length);
    if (mods.length === 0) {
      console.warn("[ScheduleTab] AVISO: contracted_modules vazio — fases condicionais serão ocultadas. project.id:", project?.id);
    }
    return computeSchedule(SCHEDULE_TASKS, manualOverrides, answersMap, project);
  }, [manualOverrides, answersMap, project]);

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

  const activitiesByTask = useMemo(() => {
    const norm = s => (s || "").toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

    const map = {};
    savedActivities.forEach(a => {
      if (!a.activity_name) return;
      const normA = norm(a.activity_name);
      // 1) match exato normalizado
      let found = SCHEDULE_TASKS.find(t => norm(t.activity) === normA);
      // 2) fallback: includes (um contém o outro)
      if (!found) found = SCHEDULE_TASKS.find(t => norm(t.activity).includes(normA) || normA.includes(norm(t.activity)));
      if (found) {
        console.log(`[ScheduleTab] match: "${a.activity_name}" → task.id="${found.id}" actual_start="${a.actual_start}" actual_end="${a.actual_end}"`);
        map[found.id] = a;
      } else {
        console.warn(`[ScheduleTab] SEM MATCH: "${a.activity_name}" (normalizado: "${normA}")`);
      }
    });
    return map;
  }, [savedActivities]);

  // Salva override localmente e persiste âncoras no banco
  // Sem race condition: sempre usa o estado mais recente via função de setState
  const handleSaveOverride = useCallback(async (taskId, payload) => {
    setManualOverrides(prev => {
      const next = { ...prev, [taskId]: { ...(prev[taskId] || {}), ...payload } };
      // Persistir âncoras no banco de forma assíncrona com o estado mais recente
      const anchorDates = {};
      ANCHOR_IDS.forEach(aid => { const val = next[aid]?.plannedStart; if (val) anchorDates[aid] = val; });
      if (Object.keys(anchorDates).length > 0) {
        base44.entities.Project.update(projectId, { schedule_anchor_dates: anchorDates }).catch(() => {});
      }
      return next;
    });
  }, [projectId]);

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
      const created = await base44.entities.ScheduleActivity.create({ project_id: projectId, phase_name: task.phase, activity_name: task.activity, order: task.row, ...payload });
      setSavedActivities(prev => [...prev, created]);
    }
  }, [activitiesByTask, projectId]);

  const handleCompleteAsTasks = useCallback(async (tasks) => {
    await Promise.all(tasks.filter(task => !activitiesByTask[task.id]?.actual_start && !activitiesByTask[task.id]?.actual_end).map(task => {
      const d = computedDates[task.id] || {};
      return handleSaveActivity(task, {
        actual_start: manualOverrides[task.id]?.plannedStart || d.plannedStart || null,
        actual_end: manualOverrides[task.id]?.plannedEnd || d.plannedEnd || null,
        status: "Concluído",
        history_observations: activitiesByTask[task.id]?.history_observations || "",
        responsible_leader: activitiesByTask[task.id]?.responsible_leader || task.responsibleLeader || "",
        responsible_general: activitiesByTask[task.id]?.responsible_general || task.responsibleGeneral || "",
      });
    }));
  }, [activitiesByTask, computedDates, manualOverrides, handleSaveActivity]);

  const phases = PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task"));
  const anchors = SCHEDULE_TASKS.filter(t => t.plannedStart?.type === "anchor");
  const anchorsSavedInDB = project?.schedule_anchor_dates && Object.values(project.schedule_anchor_dates).some(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Cronograma Detalhado</h2>
          <p className="text-sm text-slate-400">Gerado automaticamente com base em Dados Iniciais e Escopo Técnico</p>
        </div>
        {!readOnly && (
          <div className="flex items-start gap-3">
            {project?.pipedrive_deal_id && (
              <SyncPipedriveButton projectId={projectId} onReload={reloadActivities} onSuccess={() => { if (onSyncSuccess) onSyncSuccess(); }} />
            )}
            <CompleteProjectButton onComplete={async () => { const all = SCHEDULE_TASKS.filter(t => t.type === "task" && visible.has(t.id)); await handleCompleteAsTasks(all); }} />
          </div>
        )}
      </div>

      {/* Painel de âncoras */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Datas Âncora — editar para recalcular o cronograma</p>
          {anchorsSavedInDB && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Database className="w-3 h-3" /> Salvo no banco
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {anchors.map(anchor => {
            const currentVal = manualOverrides[anchor.id]?.plannedStart || computedDates[anchor.id]?.plannedStart || "";
            return (
              <div key={anchor.id} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1 leading-tight">{anchor.activity}</p>
                <input type="date" value={currentVal}
                  onChange={e => { if (!readOnly) handleSaveOverride(anchor.id, { plannedStart: e.target.value }); }}
                  readOnly={readOnly} disabled={readOnly}
                  className={`w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 ${readOnly ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white"}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><span className="flex items-center gap-0.5 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium"><Anchor className="w-2.5 h-2.5" />Data âncora</span> Editável e recalcula dependentes</div>
        <div className="flex items-center gap-1.5"><span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium"><Pencil className="w-2.5 h-2.5" />Edição manual</span> Editável, sem impacto em outras datas</div>
        <div className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-300" /> Data calculada automaticamente</div>
      </div>

      {!manualOverrides["alinhamento_inicial"]?.plannedStart && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Defina a data do <strong>Alinhamento inicial</strong> no painel acima para calcular o cronograma completo.
        </div>
      )}

      {phases.map(ph => (
        <PhaseSection key={ph} phaseName={ph} tasks={tasksByPhase[ph]} computedDates={computedDates}
          manualOverrides={manualOverrides} activitiesByTask={activitiesByTask}
          onSaveOverride={readOnly ? () => {} : handleSaveOverride}
          onSaveActivity={readOnly ? () => {} : handleSaveActivity}
          onCompletePhase={readOnly ? () => {} : handleCompleteAsTasks}
          readOnly={readOnly} project={project} templateConfig={templateConfig} />
      ))}

      {phases.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma fase visível. Verifique os módulos contratados e o Escopo Técnico.
        </div>
      )}
    </div>
  );
}