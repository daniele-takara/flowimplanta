import { useState, useMemo, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown, ChevronRight, Save, X, Anchor, Pencil, Lock,
  AlertCircle, CheckCircle, CheckCircle2, Loader2, RefreshCw,
  Database, Plus, RotateCcw, Zap, Eye, MoreHorizontal, EyeOff, FileDown
} from "lucide-react";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS, resolveGeneralResponsible } from "@/lib/resolveResponsibleRole.js";
import AddActivityModal from "./schedule/AddActivityModal.jsx";
import LocalActivityRow from "./schedule/LocalActivityRow.jsx";
import AddPhaseModal from "./schedule/AddPhaseModal.jsx";
import LocalPhaseSection from "./schedule/LocalPhaseSection.jsx";
import PhaseOverrideModal from "./schedule/PhaseOverrideModal.jsx";
import { generateSchedulePDF } from "@/lib/schedulePdfExport.js";
import SchedulePDFColumnModal from "./schedule/SchedulePDFColumnModal.jsx";

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.question_id) map[item.question_id] = item.answer || "";
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      if (!map[key]) map[key] = item.answer || "";
    }
  });
  return map;
}

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];
const STATUS_COLORS = {
  "Não iniciado": "bg-slate-100 text-slate-500",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Concluído":    "bg-green-100 text-green-700",
  "Atrasado":     "bg-red-100 text-red-700",
  "Bloqueado":    "bg-orange-100 text-orange-700",
  "Cancelado":    "bg-slate-100 text-slate-400 line-through",
};

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS["Não iniciado"]}`}>
      {status || "Não iniciado"}
    </span>
  );
}

function getDateOrigin(taskId, field, manualOverrides) {
  const override = manualOverrides?.[taskId];
  if (!override) return "auto";
  const key = field === "plannedStart" ? "plannedStart" : "plannedEnd";
  if (!override[key]) return "auto";
  const origin = override._origin?.[key];
  if (origin === "pipedrive") return "pipedrive";
  return "manual";
}

function DateOriginBadge({ origin }) {
  if (origin === "pipedrive") return (
    <span className="flex items-center gap-0.5 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded font-medium">
      <Zap className="w-2.5 h-2.5" />Pipedrive
    </span>
  );
  if (origin === "manual") return (
    <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
      <Pencil className="w-2.5 h-2.5" />Manual
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
      <Lock className="w-2.5 h-2.5" />Auto
    </span>
  );
}

// ── TaskRow ────────────────────────────────────────────────────────────────────
function TaskRow({
  task, computedDates, manualOverrides, onSaveOverride, onRemoveOverride,
  onSaveActivity, onInactivateTask, existingActivity, project, templateConfig,
  readOnly, canEditPlanned, canEditExecuted,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmInactivate, setConfirmInactivate] = useState(false);

  const isInactive = existingActivity?.status === "Cancelado" &&
    (existingActivity?.history_observations || "").includes("[INATIVADO]");

  const override = manualOverrides?.[task.id] || {};
  const dates    = computedDates[task.id] || {};
  const isAnchor = task.plannedStart?.type === "anchor";

  const displayStart = override.plannedStart || dates.plannedStart || "";
  const displayEnd   = override.plannedEnd   || dates.plannedEnd   || "";

  const actualStart   = existingActivity?.actual_start || "";
  const actualEnd     = existingActivity?.actual_end   || "";
  const derivedStatus = existingActivity?.status || (actualEnd ? "Concluído" : actualStart ? "Em andamento" : "Não iniciado");

  const [form, setForm] = useState({
    planned_start:        displayStart,
    planned_end:          displayEnd,
    actual_start:         actualStart,
    actual_end:           actualEnd,
    status:               derivedStatus,
    history_observations: existingActivity?.history_observations || "",
    responsible_leader:   existingActivity?.responsible_leader   || task.responsibleLeader  || "",
    responsible_general:  existingActivity?.responsible_general  || task.responsibleGeneral || "",
  });

  useEffect(() => {
    const nStart = existingActivity?.actual_start || "";
    const nEnd   = existingActivity?.actual_end   || "";
    setForm(f => ({
      ...f,
      actual_start:         nStart,
      actual_end:           nEnd,
      status:               existingActivity?.status || (nEnd ? "Concluído" : nStart ? "Em andamento" : "Não iniciado"),
      history_observations: existingActivity?.history_observations || f.history_observations,
      responsible_leader:   existingActivity?.responsible_leader   || f.responsible_leader,
      responsible_general:  existingActivity?.responsible_general  || f.responsible_general,
    }));
  }, [existingActivity?.actual_start, existingActivity?.actual_end, existingActivity?.status]);

  useEffect(() => {
    const newStart = override.plannedStart || dates.plannedStart || "";
    const newEnd   = override.plannedEnd   || dates.plannedEnd   || "";
    setForm(f => ({ ...f, planned_start: newStart, planned_end: newEnd }));
  }, [override.plannedStart, override.plannedEnd, dates.plannedStart, dates.plannedEnd]);

  const taskConfig          = templateConfig?.[task.id];
  const resolvedRoleName    = taskConfig?.responsible_role ? resolveRoleToName(taskConfig.responsible_role, project) : null;
  const roleLabel           = taskConfig?.responsible_role ? RESPONSIBLE_ROLE_LABELS[taskConfig.responsible_role] || taskConfig.responsible_role : null;
  const resolvedGeneralName = taskConfig?.responsible_general_type ? resolveGeneralResponsible(taskConfig.responsible_general_type, project) : null;

  const startOrigin = getDateOrigin(task.id, "plannedStart", manualOverrides);
  const endOrigin   = getDateOrigin(task.id, "plannedEnd",   manualOverrides);

  const inputClass = "px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white";

  const handleActualChange = (field, value) => {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (!["Bloqueado", "Cancelado"].includes(next.status)) {
        if (next.actual_end)   next.status = "Concluído";
        else if (next.actual_start) next.status = "Em andamento";
        else                   next.status = "Não iniciado";
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const plannedStartChanged = form.planned_start && form.planned_start !== (dates.plannedStart || "");
      const plannedEndChanged   = form.planned_end   && form.planned_end   !== (dates.plannedEnd   || "");
      if ((plannedStartChanged || plannedEndChanged) && canEditPlanned) {
        const overridePayload = { ...(override || {}) };
        const newOrigin = { ...(override._origin || {}) };
        if (plannedStartChanged) { overridePayload.plannedStart = form.planned_start; newOrigin.plannedStart = "manual"; }
        if (plannedEndChanged)   { overridePayload.plannedEnd   = form.planned_end;   newOrigin.plannedEnd   = "manual"; }
        overridePayload._origin = newOrigin;
        await onSaveOverride(task.id, overridePayload);
      }

      // Só persiste dados executados se houve alteração REAL nos campos executados
      const executedChanged =
        form.actual_start !== (existingActivity?.actual_start || "") ||
        form.actual_end   !== (existingActivity?.actual_end   || "") ||
        form.status       !== (existingActivity?.status       || derivedStatus) ||
        form.history_observations !== (existingActivity?.history_observations || "") ||
        form.responsible_leader   !== (existingActivity?.responsible_leader   || task.responsibleLeader  || "") ||
        form.responsible_general  !== (existingActivity?.responsible_general  || task.responsibleGeneral || "");

      if (executedChanged) {
        await onSaveActivity(task, {
          actual_start:         form.actual_start,
          actual_end:           form.actual_end,
          status:               form.status,
          history_observations: form.history_observations,
          responsible_leader:   form.responsible_leader,
          responsible_general:  form.responsible_general,
        });
      }
      setEditing(false);
    } catch (err) {
      console.error("[TaskRow] Erro ao salvar:", task.id, err);
      alert("Erro ao salvar. Verifique suas permissões ou tente novamente.");
    }
    setSaving(false);
  };

  return (
    <>
      <tr className={`border-b border-slate-50 transition-colors ${isInactive ? "bg-slate-50/60 opacity-60" : "hover:bg-slate-50/80"}`}>
        <td className="px-2 py-2.5 text-sm text-slate-700 max-w-[280px]">
          <div>
            <span className={`leading-snug ${isInactive ? "line-through text-slate-400" : ""}`}>{task.activity}</span>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {isInactive && (
                <span className="flex items-center gap-0.5 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  <EyeOff className="w-2.5 h-2.5" />Inativa
                </span>
              )}
              {isAnchor && (
                <span className="flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                  <Anchor className="w-2.5 h-2.5" />Âncora
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="px-1 py-2.5">
          <div className="space-y-1">
            {editing && canEditPlanned
              ? <input type="date" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} className={inputClass} />
              : <span className="text-xs text-slate-600">{fmtDate(displayStart)}</span>
            }
            <div className="flex items-center gap-1">
              <DateOriginBadge origin={startOrigin} />
              {startOrigin === "manual" && !readOnly && (
                <button onClick={() => onRemoveOverride(task.id, "plannedStart")} title="Voltar ao calculado" className="text-slate-300 hover:text-red-400">
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        </td>

        <td className="px-1 py-2.5">
          <div className="space-y-1">
            {editing && canEditPlanned
              ? <input type="date" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} className={inputClass} />
              : <span className="text-xs text-slate-600">{fmtDate(displayEnd)}</span>
            }
            <div className="flex items-center gap-1">
              <DateOriginBadge origin={endOrigin} />
              {endOrigin === "manual" && !readOnly && (
                <button onClick={() => onRemoveOverride(task.id, "plannedEnd")} title="Voltar ao calculado" className="text-slate-300 hover:text-red-400">
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        </td>

        <td className="px-1 py-2.5">
          {editing && canEditExecuted
            ? <input type="date" value={form.actual_start} onChange={e => handleActualChange("actual_start", e.target.value)} className={inputClass} />
            : <span className="text-xs text-slate-500">{form.actual_start ? fmtDate(form.actual_start) : <span className="text-slate-300">—</span>}</span>
          }
        </td>

        <td className="px-1 py-2.5">
          {editing && canEditExecuted
            ? <input type="date" value={form.actual_end} onChange={e => handleActualChange("actual_end", e.target.value)} className={inputClass} />
            : <span className="text-xs text-slate-500">{form.actual_end ? fmtDate(form.actual_end) : <span className="text-slate-300">—</span>}</span>
          }
        </td>

        <td className="px-1 py-2.5 max-w-[120px]">
          {editing
            ? <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} placeholder="Responsável" />
            : <span className="text-xs text-slate-500 truncate block">{resolvedGeneralName || form.responsible_general || "—"}</span>
          }
        </td>

        <td className="px-1 py-2.5 max-w-[120px]">
          {editing
            ? <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} placeholder="Líder" />
            : resolvedRoleName
              ? <div>
                  <span className="text-xs font-medium text-slate-700 block truncate">{resolvedRoleName}</span>
                  <span className="text-xs text-slate-400 block truncate">{roleLabel}</span>
                </div>
              : <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>
          }
        </td>

        <td className="px-1 py-2.5">
          {editing
            ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            : <StatusBadge status={form.status} />
          }
        </td>

        <td className="px-1 py-2.5 max-w-[140px]">
          {editing
            ? <input value={form.history_observations} onChange={e => setForm(f => ({ ...f, history_observations: e.target.value }))} className={inputClass} placeholder="Obs..." />
            : <span className="text-xs text-slate-400 truncate block">{form.history_observations || "—"}</span>
          }
        </td>

        <td className="px-1 py-2.5">
          {editing ? (
            <div className="flex gap-1">
              <button onClick={handleSave} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {!readOnly && !isInactive && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1 whitespace-nowrap">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              )}
              {!readOnly && !isInactive && !form.actual_start && !form.actual_end && (
                <button
                  onClick={async () => {
                    setSaving(true);
                    await onSaveActivity(task, {
                      actual_start: displayStart, actual_end: displayEnd, status: "Concluído",
                      history_observations: form.history_observations,
                      responsible_leader:   form.responsible_leader,
                      responsible_general:  form.responsible_general,
                    });
                    setForm(f => ({ ...f, actual_start: displayStart || "", actual_end: displayEnd || "", status: "Concluído" }));
                    setSaving(false);
                  }}
                  disabled={saving}
                  className="text-xs text-green-600 hover:underline px-1 whitespace-nowrap"
                >
                  ✓ Conf. planejado
                </button>
              )}
              {!readOnly && !isInactive && onInactivateTask && (
                <button
                  onClick={() => setConfirmInactivate(true)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:underline px-1 whitespace-nowrap"
                  title="Inativar esta atividade neste projeto"
                >
                  <EyeOff className="w-3 h-3" /> Inativar
                </button>
              )}
              {isInactive && (
                <span className="text-xs text-slate-400 italic px-1">Inativa</span>
              )}
            </div>
          )}
        </td>
      </tr>
      {confirmInactivate && (
        <tr className="bg-red-50">
          <td colSpan={10} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-800 flex-1">
                Inativar "{task.activity}" apenas neste projeto? Os dados existentes serão preservados.
              </span>
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onInactivateTask(task);
                    setConfirmInactivate(false);
                  } catch (err) {
                    console.error("[TaskRow] Erro ao inativar:", err);
                    alert("Erro ao inativar atividade. Verifique suas permissões.");
                  }
                  setSaving(false);
                }}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                Confirmar inativação
              </button>
              <button onClick={() => setConfirmInactivate(false)} className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-100">
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
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

// ── PhaseSection (fases do template) ──────────────────────────────────────────
function PhaseSection({
  phaseName, tasks, computedDates, manualOverrides, activitiesByTask, localActivities,
  onSaveOverride, onRemoveOverride, onSaveActivity, onInactivateTask, onCompletePhase, onAddActivity,
  onActivityUpdated, onActivityRemoved,
  project, templateConfig, readOnly,
  canCompletePhase, canEditPlanned, canEditExecuted, canAddActivity, canEditActivity = true, canExcluirActivity = true, showInactive,
  phaseOverride, onEditOverride, onInactivate, onReactivate,
  canEditPhase, canExcluirPhase,
}) {
  const [open, setOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isInactive = phaseOverride?.is_active === false;
  const displayName = phaseOverride?.custom_name || phaseName;

  const visibleTasks = tasks.filter(t => {
    if (t.type !== "task") return false;
    // Oculta tarefas do template que foram inativadas (via ScheduleActivity com [INATIVADO])
    const act = activitiesByTask[t.id];
    if (act && act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]")) {
      return showInactive; // só mostra se toggle de inativos ativo
    }
    return true;
  });
  const phaseLocalActivities = localActivities.filter(a => a.phase_name === phaseName);
  const activeLocalActivities = phaseLocalActivities.filter(a =>
    !(a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]"))
  );
  const total = visibleTasks.length + (showInactive ? phaseLocalActivities.length : activeLocalActivities.length);

  if (visibleTasks.length === 0 && phaseLocalActivities.length === 0) return null;

  return (
    <div className={`mb-2 rounded-xl border overflow-hidden shadow-sm ${isInactive ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
      <div
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none flex-wrap ${isInactive ? "bg-slate-400" : "bg-blue-600"}`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white shrink-0" /> : <ChevronRight className="w-4 h-4 text-white shrink-0" />}
        <h3 className="text-sm font-bold text-white flex-1 min-w-0">{displayName}</h3>
        {isInactive && (
          <span className="text-xs bg-slate-500 text-white px-2 py-0.5 rounded-full font-medium shrink-0">Inativa neste projeto</span>
        )}
        {phaseOverride?.custom_name && (
          <span className="text-xs bg-blue-500/50 text-blue-100 px-2 py-0.5 rounded-full font-medium shrink-0">Personalizada</span>
        )}
        <span className={`text-xs shrink-0 ${isInactive ? "text-slate-300" : "text-blue-200"}`}>{total} atividade(s)</span>

        <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>
          {!readOnly && !isInactive && canCompletePhase && (
            <button
              onClick={async () => { setCompleting(true); await onCompletePhase(visibleTasks); setCompleting(false); }}
              disabled={completing}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Concluir fase
            </button>
          )}
          {!readOnly && !isInactive && canAddActivity && (
            <button
              onClick={() => onAddActivity(phaseName)}
              className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              <Plus className="w-3 h-3" /> Adicionar atividade
            </button>
          )}
          {/* Menu ⋯ de override */}
          {(canEditPhase || canExcluirPhase) && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen(m => !m)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
                title="Ações da fase neste projeto"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[200px]">
                    {canEditPhase && !isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onEditOverride(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar fase neste projeto
                      </button>
                    )}
                    {canExcluirPhase && !isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onInactivate(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Inativar fase neste projeto
                      </button>
                    )}
                    {isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onReactivate(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Reativar fase neste projeto
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {open && phaseOverride?.observations && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 italic">
          {phaseOverride.observations}
        </div>
      )}

      {open && (
        <div>
          <table className="w-full">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-2 py-2.5">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Início Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Fim Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Início Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Fim Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Resp. Geral</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Resp. Líder</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Obs.</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-1 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                if (task.type === "group") return <GroupRow key={task.id} task={task} computedDates={computedDates} />;
                if (task.type === "task") return (
                  <TaskRow
                    key={task.id} task={task} computedDates={computedDates} manualOverrides={manualOverrides}
                    onSaveOverride={onSaveOverride} onRemoveOverride={onRemoveOverride} onSaveActivity={onSaveActivity}
                    onInactivateTask={onInactivateTask}
                    existingActivity={activitiesByTask[task.id]} project={project} templateConfig={templateConfig}
                    readOnly={readOnly} canEditPlanned={canEditPlanned} canEditExecuted={canEditExecuted}
                  />
                );
                return null;
              })}
              {phaseLocalActivities.map(act => (
                <LocalActivityRow
                  key={act.id} activity={act}
                  onUpdated={onActivityUpdated}
                  onRemoved={onActivityRemoved}
                  readOnly={readOnly}
                  showInactive={showInactive}
                  canEdit={canEditActivity}
                  canExcluir={canExcluirActivity}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SyncPipedriveButton({ projectId, onSuccess, onReload }) {
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    setLoading(true); setResult(null); setError(null); setShowDetails(false);
    try {
      const res  = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId });
      const data = res.data;
      if (data.error) setError(data.detail || data.error);
      else { setResult(data); if (onReload) onReload(); if (onSuccess) onSuccess(); }
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
  const [done, setDone]       = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await onComplete(); setLoading(false); setDone(true); setTimeout(() => setDone(false), 3000); }}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-green-50 text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
      {done ? "Cronograma atualizado!" : "Concluir projeto conforme planejado"}
    </button>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function ScheduleTab({
  scopeItems, project, projectId, onRefresh, readOnly = false, onSyncSuccess,
  canEditPlanned = true, canCompletePhase = true, canRecalculate = true, canSyncPipedrive = true,
  canEditExecuted = true, canAddActivity = true,
  canCreatePhase = true, canEditPhase = true, canExcluirPhase = true,
  canExcluirActivity = true,
  canGeneratePDF = true,
}) {
  const [anchorsLoaded, setAnchorsLoaded]       = useState(false);
  const [manualOverrides, setManualOverrides]   = useState({});
  const [savedActivities, setSavedActivities]   = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [templateConfig, setTemplateConfig]     = useState({});
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addModalPhase, setAddModalPhase]       = useState(null);
  const [showInactive, setShowInactive]         = useState(false);

  // Fases locais
  const [localPhases, setLocalPhases]           = useState([]);
  const [localPhasesLoaded, setLocalPhasesLoaded] = useState(false);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase]         = useState(null);

  // Overrides de fases do template (por fase canônica)
  const [phaseOverrides, setPhaseOverrides]         = useState({}); // { phaseName: overrideRecord }
  const [phaseOverridesLoaded, setPhaseOverridesLoaded] = useState(false);
  const [showOverrideModal, setShowOverrideModal]   = useState(false);
  const [overrideModalPhase, setOverrideModalPhase] = useState(null);

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);

  // Carregar overrides: DB (schedule_overrides) como fonte primária, localStorage como fallback de migração
  useEffect(() => {
    if (!projectId || anchorsLoaded) return;
    
    // 1. Carrega schedule_overrides do banco (fonte de verdade compartilhada entre usuários)
    let dbOverrides = {};
    try {
      const raw = project?.schedule_overrides;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        dbOverrides = raw;
      }
    } catch {}
    
    // 2. Carrega localStorage (fallback para dados não migrados)
    let localOverrides = {};
    try {
      localOverrides = JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
    } catch {}
    
    // 3. Mescla: localStorage sobrepõe DB (localStorage tem prioridade para o usuário atual)
    const merged = { ...dbOverrides };
    Object.entries(localOverrides).forEach(([taskId, override]) => {
      if (override && typeof override === "object") {
        merged[taskId] = { ...(merged[taskId] || {}), ...override };
      }
    });
    
    // 4. Fallback legado: âncoras do schedule_anchor_dates se nenhum override encontrado
    if (Object.keys(merged).length === 0) {
      const dbAnchors = project?.schedule_anchor_dates || {};
      Object.entries(dbAnchors).forEach(([taskId, dateStr]) => {
        if (dateStr) merged[taskId] = { plannedStart: dateStr };
      });
    }
    
    setManualOverrides(merged);
    
    // 5. Migração: se localStorage tem dados mas DB não, persiste no banco agora
    if (Object.keys(localOverrides).length > 0 && Object.keys(dbOverrides).length === 0) {
      base44.entities.Project.update(projectId, { schedule_overrides: merged }).catch(() => {});
    }
    
    setAnchorsLoaded(true);
  }, [projectId, project, anchorsLoaded]);

  const reloadActivities = useCallback(() => {
    if (!projectId) return;
    base44.entities.ScheduleActivity.filter({ project_id: projectId })
      .then(acts => { setSavedActivities(acts || []); setActivitiesLoaded(true); })
      .catch(() => setActivitiesLoaded(true));
  }, [projectId]);

  useEffect(() => {
    if (!activitiesLoaded && projectId) reloadActivities();
  }, [projectId, activitiesLoaded, reloadActivities]);

  // Carregar fases locais — inclui inativas para toggle
  useEffect(() => {
    if (!projectId || localPhasesLoaded) return;
    base44.entities.LocalSchedulePhase.filter({ project_id: projectId })
      .then(list => { setLocalPhases(list || []); setLocalPhasesLoaded(true); })
      .catch(() => setLocalPhasesLoaded(true));
  }, [projectId, localPhasesLoaded]);

  // Carregar overrides de fases do template
  useEffect(() => {
    if (!projectId || phaseOverridesLoaded) return;
    base44.entities.SchedulePhaseOverride.filter({ project_id: projectId })
      .then(list => {
        const map = {};
        (list || []).forEach(o => { map[o.phase_name] = o; });
        setPhaseOverrides(map);
        setPhaseOverridesLoaded(true);
      })
      .catch(() => setPhaseOverridesLoaded(true));
  }, [projectId, phaseOverridesLoaded]);

  useEffect(() => {
    base44.entities.ScheduleTemplate.filter({ is_default: true }).then(list => {
      if (list.length > 0) try { setTemplateConfig(JSON.parse(list[0].tasks_config || "{}")); } catch {}
    }).catch(() => {});
  }, []);

  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);

  const { dates: computedDates, visible } = useMemo(() => {
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

  // Atividades do template (match por nome)
  const activitiesByTask = useMemo(() => {
    const norm = s => (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    const map = {};
    savedActivities.forEach(a => {
      if (!a.activity_name) return;
      const normA = norm(a.activity_name);
      let found = SCHEDULE_TASKS.find(t => norm(t.activity) === normA);
      if (!found) found = SCHEDULE_TASKS.find(t => norm(t.activity).includes(normA) || normA.includes(norm(t.activity)));
      if (found) map[found.id] = a;
    });
    return map;
  }, [savedActivities]);

  // Atividades locais — inclui inativas (o LocalActivityRow filtra por showInactive)
  const localActivities = useMemo(() => {
    const norm = s => (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    return savedActivities.filter(a => {
      if (!a.activity_name) return false;
      const normA = norm(a.activity_name);
      const foundInTemplate = SCHEDULE_TASKS.some(t => {
        const nt = norm(t.activity);
        return nt === normA || nt.includes(normA) || normA.includes(nt);
      });
      return !foundInTemplate;
    });
  }, [savedActivities]);

  // Fases visíveis (respeita toggle showInactive)
  const visibleLocalPhases = useMemo(() => {
    return localPhases
      .filter(p => showInactive || p.is_active !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [localPhases, showInactive]);

  // Fases do template: inclui ou exclui conforme override local + toggle inativos
  const phases = PHASE_ORDER.filter(ph => {
    const hasContent = tasksByPhase[ph]?.some(t => t.type === "task") || localActivities.some(a => a.phase_name === ph);
    if (!hasContent) return false;
    const override = phaseOverrides[ph];
    if (override?.is_active === false) return showInactive;
    return true;
  });

  // ── Lista unificada de fases (template + locais) ordenada por posição ──
  const unifiedPhases = useMemo(() => {
    const items = [];
    // Fases do template
    phases.forEach(ph => {
      items.push({
        key: `tmpl-${ph}`,
        type: 'template',
        phaseName: ph,
        order: PHASE_ORDER.indexOf(ph),
        tasks: tasksByPhase[ph] || [],
        phaseOverride: phaseOverrides[ph],
      });
    });
    // Fases locais (já ordenadas por visibleLocalPhases)
    visibleLocalPhases.forEach(phase => {
      items.push({
        key: `local-${phase.id}`,
        type: 'local',
        phase: phase,
        order: phase.order ?? 99,
      });
    });
    return items.sort((a, b) => a.order - b.order);
  }, [phases, visibleLocalPhases, tasksByPhase, phaseOverrides]);

  const handleSaveOverride = useCallback(async (taskId, payload) => {
    // 1. Atualiza estado imediatamente (UI responsiva)
    let nextOverrides = {};
    setManualOverrides(prev => {
      nextOverrides = { ...prev, [taskId]: { ...(prev[taskId] || {}), ...payload } };
      return nextOverrides;
    });

    // 2. Persiste no localStorage como cache local (síncrono, fallback)
    try {
      localStorage.setItem(`schedule_overrides_${projectId}`, JSON.stringify(nextOverrides));
    } catch {}

    // 3. Persiste TUDO no banco — fonte de verdade compartilhada entre usuários
    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: nextOverrides });
      // Notifica o ProjectDetail para recarregar o projeto (atualiza estado global)
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[ScheduleTab] Erro ao persistir schedule_overrides no banco:", err);
    }
  }, [projectId, onRefresh]);

  const handleRemoveOverride = useCallback(async (taskId, field) => {
    let nextOverrides = {};
    setManualOverrides(prev => {
      const current = { ...(prev[taskId] || {}) };
      delete current[field];
      if (current._origin) delete current._origin[field];
      // Remove entry se ficou vazio (sem campos restantes além de _origin)
      const keysLeft = Object.keys(current).filter(k => k !== "_origin");
      if (keysLeft.length === 0) {
        nextOverrides = { ...prev };
        delete nextOverrides[taskId];
      } else {
        nextOverrides = { ...prev, [taskId]: current };
      }
      return nextOverrides;
    });

    // Persiste no localStorage
    try {
      localStorage.setItem(`schedule_overrides_${projectId}`, JSON.stringify(nextOverrides));
    } catch {}

    // Persiste no banco — fonte de verdade compartilhada
    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: nextOverrides });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("[ScheduleTab] Erro ao persistir schedule_overrides no banco:", err);
    }
  }, [projectId, onRefresh]);

  const handleSaveActivity = useCallback(async (task, data) => {
    const existing = activitiesByTask[task.id];
    const payload = {
      actual_start:         data.actual_start || null,
      actual_end:           data.actual_end   || null,
      status:               data.status       || "Não iniciado",
      history_observations: data.history_observations || "",
      responsible_leader:   data.responsible_leader   || "",
      responsible_general:  data.responsible_general  || "",
    };
    if (existing) {
      await base44.entities.ScheduleActivity.update(existing.id, payload);
      setSavedActivities(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a));
    } else {
      const created = await base44.entities.ScheduleActivity.create({
        project_id: projectId, phase_name: task.phase, activity_name: task.activity, order: task.row, ...payload
      });
      setSavedActivities(prev => [...prev, created]);
    }
  }, [activitiesByTask, projectId]);

  const handleCompleteAsTasks = useCallback(async (tasks) => {
    await Promise.all(
      tasks
        .filter(task => !activitiesByTask[task.id]?.actual_start && !activitiesByTask[task.id]?.actual_end)
        .map(task => {
          const d        = computedDates[task.id] || {};
          const override = manualOverrides[task.id] || {};
          return handleSaveActivity(task, {
            actual_start: override.plannedStart || d.plannedStart || null,
            actual_end:   override.plannedEnd   || d.plannedEnd   || null,
            status:       "Concluído",
            history_observations: activitiesByTask[task.id]?.history_observations || "",
            responsible_leader:   activitiesByTask[task.id]?.responsible_leader   || task.responsibleLeader  || "",
            responsible_general:  activitiesByTask[task.id]?.responsible_general  || task.responsibleGeneral || "",
          });
        })
    );
  }, [activitiesByTask, computedDates, manualOverrides, handleSaveActivity]);

  const handleAddLocalActivity = async (data) => {
    try {
      const created = await base44.entities.ScheduleActivity.create(data);
      setSavedActivities(prev => [...prev, created]);
    } catch (err) {
      console.error("[ScheduleTab] Erro ao criar atividade local:", err);
      throw err; // Relança para o modal capturar e exibir
    }
  };

  // Handlers para overrides de fases do template
  const handleInactivateTemplatePhase = useCallback(async (phaseName) => {
    try {
      const existing = phaseOverrides[phaseName];
      const user = await base44.auth.me().catch(() => null);
      const payload = {
        project_id: projectId, phase_name: phaseName, is_active: false,
        updated_by: user?.full_name || user?.email || "", updated_at: new Date().toISOString(),
      };
      let saved;
      if (existing?.id) {
        await base44.entities.SchedulePhaseOverride.update(existing.id, payload);
        saved = { ...existing, ...payload };
      } else {
        saved = await base44.entities.SchedulePhaseOverride.create(payload);
      }
      setPhaseOverrides(prev => ({ ...prev, [phaseName]: saved }));
    } catch (err) {
      console.error("[ScheduleTab] Erro ao inativar fase:", phaseName, err);
      alert("Erro ao inativar fase. Verifique suas permissões ou tente novamente.");
    }
  }, [phaseOverrides, projectId]);

  const handleReactivateTemplatePhase = useCallback(async (phaseName) => {
    try {
      const existing = phaseOverrides[phaseName];
      if (!existing?.id) return;
      const user = await base44.auth.me().catch(() => null);
      const payload = { is_active: true, updated_by: user?.full_name || user?.email || "", updated_at: new Date().toISOString() };
      await base44.entities.SchedulePhaseOverride.update(existing.id, payload);
      setPhaseOverrides(prev => ({ ...prev, [phaseName]: { ...existing, ...payload } }));
    } catch (err) {
      console.error("[ScheduleTab] Erro ao reativar fase:", phaseName, err);
      alert("Erro ao reativar fase. Verifique suas permissões ou tente novamente.");
    }
  }, [phaseOverrides]);

  const handleSavePhaseOverride = useCallback((saved) => {
    setPhaseOverrides(prev => ({ ...prev, [saved.phase_name]: saved }));
    setShowOverrideModal(false);
    setOverrideModalPhase(null);
  }, []);

  const handleInactivateTemplateActivity = useCallback(async (task) => {
    const existing = activitiesByTask[task.id];
    const payload = {
      status: "Cancelado",
      history_observations: (existing?.history_observations || "").replace(" [INATIVADO]", "") + " [INATIVADO]",
    };
    if (existing) {
      await base44.entities.ScheduleActivity.update(existing.id, payload);
      setSavedActivities(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a));
    } else {
      const created = await base44.entities.ScheduleActivity.create({
        project_id: projectId, phase_name: task.phase, activity_name: task.activity,
        order: task.row, status: "Cancelado",
        history_observations: " [INATIVADO]",
      });
      setSavedActivities(prev => [...prev, created]);
    }
  }, [activitiesByTask, projectId]);

  // Lista de nomes de fase para o modal de atividade
  const allPhaseNames = useMemo(() => {
    const templatePhases = PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task"));
    const localPhaseNames = localPhases.filter(p => p.is_active !== false).map(p => p.phase_name);
    return [...new Set([...templatePhases, ...localPhaseNames])];
  }, [tasksByPhase, localPhases]);


  const anchors = SCHEDULE_TASKS.filter(t => t.plannedStart?.type === "anchor");
  const anchorsSavedInDB = project?.schedule_anchor_dates && Object.values(project.schedule_anchor_dates).some(Boolean);
  const inactiveLocalCount = localPhases.filter(p => p.is_active === false).length;
  const inactiveTemplatePhaseCount = Object.values(phaseOverrides).filter(o => o.is_active === false).length;
  const inactiveActivityCount = savedActivities.filter(a =>
    a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]")
  ).length;
  const totalInactiveCount = inactiveLocalCount + inactiveTemplatePhaseCount + inactiveActivityCount;
  const hasInactiveItems = totalInactiveCount > 0;

  const handleGeneratePDF = useCallback(async (selectedCols) => {
    setShowPDFModal(false);
    setGeneratingPDF(true);
    try {
      const doc = await generateSchedulePDF({
        project,
        scopeItems,
        savedActivities,
        localPhases,
        phaseOverrides,
        manualOverrides,
        templateConfig,
        selectedColumns: selectedCols,
      });
      doc.save(`Cronograma_${(project?.client_name || project?.name || "projeto").replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("[ScheduleTab] Erro ao gerar PDF:", err);
      alert("Erro ao gerar PDF do cronograma. Tente novamente.");
    }
    setGeneratingPDF(false);
  }, [project, scopeItems, savedActivities, localPhases, phaseOverrides, manualOverrides, templateConfig]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Cronograma Detalhado</h2>
          <p className="text-sm text-slate-400">Gerado automaticamente com base em Dados Iniciais e Escopo Técnico</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {/* Toggle inativos */}
          {hasInactiveItems && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-500 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:bg-slate-50">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 accent-slate-600"
              />
              <Eye className="w-3.5 h-3.5" />
              Mostrar itens inativos
              {totalInactiveCount > 0 && (
                <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {totalInactiveCount}
                </span>
              )}
            </label>
          )}

          {!readOnly && project?.pipedrive_deal_id && canSyncPipedrive && (
            <SyncPipedriveButton projectId={projectId} onReload={reloadActivities} onSuccess={() => { if (onSyncSuccess) onSyncSuccess(); }} />
          )}
          {!readOnly && canRecalculate && (
            <CompleteProjectButton onComplete={async () => {
              const all = SCHEDULE_TASKS.filter(t => t.type === "task" && visible.has(t.id));
              await handleCompleteAsTasks(all);
            }} />
          )}
          {canGeneratePDF && (
            <button
              onClick={() => setShowPDFModal(true)}
              disabled={generatingPDF}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 disabled:opacity-60"
            >
              {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Gerar PDF do Cronograma
            </button>
          )}
          {canCreatePhase && (
            <button
              onClick={() => { setEditingPhase(null); setShowAddPhaseModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
            >
              <Plus className="w-4 h-4" /> Adicionar marco/fase
            </button>
          )}
        </div>
      </div>

      {/* Modal de Seleção de Colunas do PDF */}
      {showPDFModal && (
        <SchedulePDFColumnModal
          onClose={() => setShowPDFModal(false)}
          onGenerate={handleGeneratePDF}
        />
      )}

      {/* Painel de âncoras */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Datas Âncora — editável e recalcula dependentes</p>
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
                <input
                  type="date"
                  value={currentVal}
                  onChange={e => { if (!readOnly && canEditPlanned) handleSaveOverride(anchor.id, { plannedStart: e.target.value, _origin: { plannedStart: "manual" } }); }}
                  readOnly={readOnly || !canEditPlanned}
                  disabled={readOnly || !canEditPlanned}
                  className={`w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 ${(readOnly || !canEditPlanned) ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white"}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium"><Anchor className="w-2.5 h-2.5" />Âncora</span>
          Recalcula dependentes
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded font-medium"><Lock className="w-2.5 h-2.5" />Auto</span>
          Calculada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium"><Pencil className="w-2.5 h-2.5" />Manual</span>
          Override manual
          <RotateCcw className="w-3 h-3 text-slate-400" /> = remover
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded font-medium"><Zap className="w-2.5 h-2.5" />Pipedrive</span>
          Sincronizada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium">Local</span>
          Adicionada neste projeto
        </div>
      </div>

      {!manualOverrides["alinhamento_inicial"]?.plannedStart && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Defina a data do <strong>Alinhamento inicial</strong> no painel acima para calcular o cronograma completo.
        </div>
      )}

      {/* Fases unificadas (template + locais) ordenadas por posição */}
      {unifiedPhases.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma fase visível. Verifique os módulos contratados e o Escopo Técnico.
        </div>
      ) : (
        unifiedPhases.map(item => {
          if (item.type === 'template') {
            return (
              <PhaseSection
                key={item.key} phaseName={item.phaseName} tasks={item.tasks}
                computedDates={computedDates} manualOverrides={manualOverrides}
                activitiesByTask={activitiesByTask} localActivities={localActivities}
                onSaveOverride={readOnly ? () => {} : handleSaveOverride}
                onRemoveOverride={readOnly ? () => {} : handleRemoveOverride}
                onSaveActivity={readOnly ? () => {} : handleSaveActivity}
                onInactivateTask={readOnly ? null : handleInactivateTemplateActivity}
                onCompletePhase={(readOnly || !canCompletePhase) ? () => {} : handleCompleteAsTasks}
                onAddActivity={(phase) => { setAddModalPhase(phase); setShowAddModal(true); }}
                onActivityUpdated={(act) => setSavedActivities(prev => prev.map(a => a.id === act.id ? act : a))}
                onActivityRemoved={(id) => setSavedActivities(prev => prev.filter(a => a.id !== id))}
                project={project} templateConfig={templateConfig}
                readOnly={readOnly} canCompletePhase={canCompletePhase}
                canEditPlanned={canEditPlanned} canEditExecuted={canEditExecuted}
                canAddActivity={canAddActivity && !readOnly}
                canEditActivity={!readOnly}
                canExcluirActivity={!readOnly && canExcluirActivity}
                showInactive={showInactive}
                phaseOverride={item.phaseOverride}
                onEditOverride={(phaseName) => { setOverrideModalPhase(phaseName); setShowOverrideModal(true); }}
                onInactivate={handleInactivateTemplatePhase}
                onReactivate={handleReactivateTemplatePhase}
                canEditPhase={canEditPhase && !readOnly}
                canExcluirPhase={canExcluirPhase && !readOnly}
              />
            );
          }
          return (
            <LocalPhaseSection
              key={item.key}
              phase={item.phase}
              localActivities={localActivities}
              onEditPhase={(ph) => { setEditingPhase(ph); setShowAddPhaseModal(true); }}
              onPhaseInactivated={(id) => setLocalPhases(prev => prev.map(p => p.id === id ? { ...p, is_active: false } : p))}
              onPhaseRemoved={(id) => setLocalPhases(prev => prev.filter(p => p.id !== id))}
              onAddActivity={(phaseName) => { setAddModalPhase(phaseName); setShowAddModal(true); }}
              onActivityUpdated={(act) => setSavedActivities(prev => prev.map(a => a.id === act.id ? act : a))}
              onActivityRemoved={(id) => setSavedActivities(prev => prev.filter(a => a.id !== id))}
              readOnly={readOnly}
              canEditPhase={canEditPhase}
              canExcluirPhase={canExcluirPhase}
              canAddActivity={canAddActivity && !readOnly}
              canEditActivity={!readOnly && canEditExecuted}
              canExcluirActivity={!readOnly && canExcluirActivity}
              showInactive={showInactive}
            />
          );
        })
      )}

      {/* Modal adicionar atividade */}
      {showAddModal && (
        <AddActivityModal
          projectId={projectId}
          project={project}
          defaultPhase={addModalPhase}
          allPhaseNames={allPhaseNames}
          onSave={handleAddLocalActivity}
          onClose={() => { setShowAddModal(false); setAddModalPhase(null); }}
        />
      )}

      {/* Modal adicionar/editar fase */}
      {showAddPhaseModal && (
        <AddPhaseModal
          projectId={projectId}
          phase={editingPhase}
          existingPhases={[...new Set([
            ...PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task")).map(name => ({ phase_name: name, order: PHASE_ORDER.indexOf(name) })),
            ...localPhases.filter(p => p.is_active !== false).map(p => ({ phase_name: p.phase_name, order: p.order ?? 99 })),
          ])].sort((a, b) => a.order - b.order)}
          onSave={(saved) => {
            setLocalPhases(prev => {
              const exists = prev.find(p => p.id === saved.id);
              return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
            });
            setShowAddPhaseModal(false);
            setEditingPhase(null);
          }}
          onClose={() => { setShowAddPhaseModal(false); setEditingPhase(null); }}
        />
      )}

      {/* Modal override de fase do template */}
      {showOverrideModal && overrideModalPhase && (
        <PhaseOverrideModal
          projectId={projectId}
          phaseName={overrideModalPhase}
          existing={phaseOverrides[overrideModalPhase] || null}
          onSave={handleSavePhaseOverride}
          onClose={() => { setShowOverrideModal(false); setOverrideModalPhase(null); }}
        />
      )}
    </div>
  );
}