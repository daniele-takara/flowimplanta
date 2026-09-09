/**
 * TemplateTaskRow — linha de atividade do template no cronograma.
 * Extraída de ScheduleTab para permitir reuso e suportar drag & drop.
 */
import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  Save, X, Anchor, Pencil, Lock, AlertCircle, Loader2, RotateCcw,
  Zap, EyeOff, GripVertical,
} from "lucide-react";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS, RESPONSIBLE_ROLE_OPTIONS, resolveGeneralResponsible } from "@/lib/resolveResponsibleRole.js";
import { logAudit } from "@/lib/auditLog";
import { buildRef, parseRef } from "@/lib/scheduleDependencies.js";
import DependencyBadge from "./DependencyBadge.jsx";

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];

const RESP_GERAL_OPTIONS = [
  { value: "Pontotel", label: "Pontotel" },
  { value: "Cliente", label: "Cliente" },
  { value: "Pontotel e Cliente", label: "Pontotel e Cliente" },
];

function buildRoleOptions(project) {
  return RESPONSIBLE_ROLE_OPTIONS.map(({ value: role, label }) => {
    const name = resolveRoleToName(role, project);
    return { value: role, label: name ? `${label}: ${name}` : label };
  });
}

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

export default function TemplateTaskRow({
  task, computedDates, manualOverrides, onSaveOverride, onRemoveOverride,
  onSaveActivity, onInactivateTask, existingActivity, project, templateConfig,
  readOnly, canEditPlanned, canEditExecuted, indented = false,
  dependencies, activitiesMap, onOpenDependencyModal,
  // Drag & drop props
  draggable = false, onDragStart, onDragOver, onDrop, onDragEnd, isDragged, isDragOver,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmInactivate, setConfirmInactivate] = useState(false);
  const [obsEditing, setObsEditing] = useState(false);
  const [obsText, setObsText] = useState("");
  const [obsSaving, setObsSaving] = useState(false);
  const obsTextareaRef = useRef(null);

  useEffect(() => {
    if (obsEditing && obsTextareaRef.current) {
      obsTextareaRef.current.focus();
      const len = obsTextareaRef.current.value.length;
      obsTextareaRef.current.setSelectionRange(len, len);
    }
  }, [obsEditing]);

  const isInactive = existingActivity?.status === "Cancelado" &&
    (existingActivity?.history_observations || "").includes("[INATIVADO]");

  // Dependências
  const taskRef = buildRef("tmpl", task.id);
  const myDeps = (dependencies || []).filter(d => d.successor_ref === taskRef);
  const depNames = myDeps.map(d => activitiesMap?.[d.predecessor_ref]?.name || parseRef(d.predecessor_ref).id);

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
      console.error("[TemplateTaskRow] Erro ao salvar:", task.id, err);
      toast({ title: "Erro ao salvar. Verifique suas permissões ou tente novamente.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleSaveObs = async () => {
    setObsSaving(true);
    try {
      await onSaveActivity(task, {
        actual_start: form.actual_start,
        actual_end: form.actual_end,
        status: form.status,
        history_observations: obsText,
        responsible_leader: form.responsible_leader,
        responsible_general: form.responsible_general,
      });
      setForm(f => ({ ...f, history_observations: obsText }));
      setObsEditing(false);
    } catch (err) {
      console.error("[TemplateTaskRow] Erro ao salvar observação:", err);
      toast({ title: "Erro ao salvar observação.", variant: "destructive" });
    }
    setObsSaving(false);
  };

  const rowClass = isInactive
    ? "border-b border-slate-50 bg-slate-50/60 opacity-60"
    : isDragged
      ? "border-b border-slate-50 bg-blue-100/50 opacity-40"
      : isDragOver
        ? "border-b border-slate-50 bg-blue-50/50 border-t-2 border-t-blue-400"
        : "border-b border-slate-50 transition-colors hover:bg-slate-50/80";

  return (
    <>
      <tr
        className={rowClass}
        draggable={draggable && !isInactive}
        onDragStart={draggable ? () => onDragStart?.(`tmpl:${task.id}`) : undefined}
        onDragOver={draggable ? (e) => onDragOver?.(e, `tmpl:${task.id}`) : undefined}
        onDrop={draggable ? (e) => onDrop?.(e, `tmpl:${task.id}`) : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <td className={`py-2.5 text-sm text-slate-700 max-w-[280px] ${indented ? "pl-8 pr-2" : "px-2"}`}>
          <div className="flex items-start gap-1.5">
            {draggable && !readOnly && !isInactive && (
              <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mt-0.5 shrink-0" title="Arraste para reordenar ou mover entre fases">
                <GripVertical className="w-3.5 h-3.5" />
              </span>
            )}
            <div>
              {indented && <span className="inline-block w-1 h-3 rounded-full bg-purple-300 mr-1.5 align-middle" />}
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
                <DependencyBadge
                  count={myDeps.length}
                  predecessorNames={depNames}
                  onClick={() => onOpenDependencyModal(taskRef, task.activity)}
                  readOnly={readOnly}
                />
              </div>
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

        <td className="px-1 py-2.5 max-w-[140px]">
          {editing
            ? (
              <select value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {RESP_GERAL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            )
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_general || resolvedGeneralName || "—"}</span>
          }
        </td>

        <td className="px-1 py-2.5 max-w-[140px]">
          {editing
            ? (
              <select value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {buildRoleOptions(project).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            )
            : form.responsible_leader
              ? <span className="text-xs font-medium text-slate-700 block truncate">{resolveRoleToName(form.responsible_leader, project) || form.responsible_leader}</span>
              : resolvedRoleName
                ? <div>
                    <span className="text-xs font-medium text-slate-700 block truncate">{resolvedRoleName}</span>
                    <span className="text-xs text-slate-400 block truncate">{roleLabel}</span>
                  </div>
                : <span className="text-xs text-slate-500 truncate block">—</span>
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
          <button
            onClick={() => { if (!readOnly && !isInactive) { setObsText(form.history_observations); setObsEditing(true); } }}
            disabled={readOnly || isInactive}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-0.5 group"
            title={form.history_observations ? "Clique para expandir/editar" : "Adicionar observação"}
          >
            {form.history_observations
              ? <span className="truncate block max-w-[110px]">{form.history_observations}</span>
              : <span className="text-slate-300 group-hover:text-slate-400">—</span>}
            {form.history_observations && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
          </button>
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
                    console.error("[TemplateTaskRow] Erro ao inativar:", err);
                    toast({ title: "Erro ao inativar atividade. Verifique suas permissões.", variant: "destructive" });
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

      {/* Editor de observações inline expansível */}
      {obsEditing && (
        <tr className="bg-slate-50">
          <td colSpan={10} className="px-4 py-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-2xl">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Observações</span>
                <button onClick={() => setObsEditing(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pt-3 pb-1">
                <p className="text-sm font-semibold text-slate-700">{task.activity}</p>
              </div>
              <div className="px-4 pb-3">
                <textarea
                  ref={obsTextareaRef}
                  value={obsText}
                  onChange={e => setObsText(e.target.value)}
                  rows={4}
                  placeholder="Adicione observações, comentários ou histórico..."
                  className="w-full px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                />
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100">
                <button
                  onClick={() => setObsEditing(false)}
                  className="px-4 py-1.5 text-sm font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveObs}
                  disabled={obsSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60"
                >
                  {obsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}