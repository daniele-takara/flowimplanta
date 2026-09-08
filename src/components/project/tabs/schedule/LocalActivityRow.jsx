import { useState, useRef, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { Save, X, Trash2, Loader2, EyeOff, AlertTriangle, Pencil, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DependencyBadge from "./DependencyBadge.jsx";
import { buildRef, parseRef } from "@/lib/scheduleDependencies.js";

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];
const STATUS_COLORS = {
  "Não iniciado": "bg-slate-100 text-slate-500",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Concluído":    "bg-green-100 text-green-700",
  "Atrasado":     "bg-red-100 text-red-700",
  "Bloqueado":    "bg-orange-100 text-orange-700",
  "Cancelado":    "bg-slate-100 text-slate-400 line-through",
};

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

export default function LocalActivityRow({
  activity, onUpdated, onRemoved, readOnly, showInactive,
  canEdit = true, canExcluir = true,
  // Drag & drop props (opcionais)
  draggable = false, onDragStart, onDragOver, onDrop, onDragEnd, isDragged, isDragOver,
  // Dependências
  dependencies = [], activitiesMap = {}, onOpenDependencyModal,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
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
  const [form, setForm] = useState({
    activity_name:        activity.activity_name || "",
    planned_start:        activity.planned_start || "",
    planned_end:          activity.planned_end || "",
    actual_start:         activity.actual_start || "",
    actual_end:           activity.actual_end || "",
    responsible_general:  activity.responsible_general || "",
    responsible_leader:   activity.responsible_leader || "",
    status:               activity.status || "Não iniciado",
    history_observations: activity.history_observations || "",
  });

  const isInactive = activity.status === "Cancelado" &&
    (activity.history_observations || "").includes("[INATIVADO]");

  // Dependências
  const actRef = buildRef("local", activity.id);
  const myDeps = (dependencies || []).filter(d => d.successor_ref === actRef);
  const depNames = myDeps.map(d => activitiesMap?.[d.predecessor_ref]?.name || parseRef(d.predecessor_ref).id);

  // Ocultar inativas se não solicitado
  if (isInactive && !showInactive) return null;

  const hasData = activity.actual_start || activity.actual_end ||
    (activity.history_observations && !activity.history_observations.includes("[INATIVADO]"));

  const inputClass = "px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white";

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        activity_name:        form.activity_name,
        planned_start:        form.planned_start || null,
        planned_end:          form.planned_end || null,
        actual_start:         form.actual_start || null,
        actual_end:           form.actual_end || null,
        responsible_general:  form.responsible_general,
        responsible_leader:   form.responsible_leader,
        status:               form.status,
        history_observations: form.history_observations,
      };
      await base44.entities.ScheduleActivity.update(activity.id, payload);
      onUpdated({ ...activity, ...payload });
      setEditing(false);
    } catch (err) {
      console.error("[LocalActivityRow] Erro ao salvar:", err);
      toast({ title: "Erro ao salvar atividade. Verifique suas permissões.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      if (hasData) {
        const obs = (activity.history_observations || "").replace(" [INATIVADO]", "");
        await base44.entities.ScheduleActivity.update(activity.id, {
          status: "Cancelado",
          history_observations: obs + " [INATIVADO]",
        });
      } else {
        await base44.entities.ScheduleActivity.delete(activity.id);
      }
      onRemoved(activity.id);
      setConfirm(false);
    } catch (err) {
      console.error("[LocalActivityRow] Erro ao remover/inativar:", err);
      toast({ title: "Erro ao remover atividade. Verifique suas permissões.", variant: "destructive" });
    }
    setRemoving(false);
  };

  const handleSaveObs = async () => {
    setObsSaving(true);
    try {
      await base44.entities.ScheduleActivity.update(activity.id, { history_observations: obsText });
      onUpdated({ ...activity, history_observations: obsText });
      setForm(f => ({ ...f, history_observations: obsText }));
      setObsEditing(false);
    } catch (err) {
      console.error("[LocalActivityRow] Erro ao salvar observação:", err);
      toast({ title: "Erro ao salvar observação. Verifique suas permissões.", variant: "destructive" });
    }
    setObsSaving(false);
  };

  const rowClass = isInactive
    ? "border-b border-slate-50 bg-slate-50/60 opacity-60"
    : isDragged
      ? "border-b border-slate-50 bg-purple-100/50 opacity-40"
      : isDragOver
        ? "border-b border-slate-50 bg-purple-50/50 border-t-2 border-t-purple-400"
        : "border-b border-slate-50 hover:bg-purple-50/30 transition-colors";

  return (
    <>
      <tr
        className={rowClass}
        draggable={draggable && !isInactive}
        onDragStart={draggable ? () => onDragStart?.(activity.id) : undefined}
        onDragOver={draggable ? (e) => onDragOver?.(e, activity.id) : undefined}
        onDrop={draggable ? (e) => onDrop?.(e, activity.id) : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <td className="px-2 py-2.5 text-sm text-slate-700 max-w-[280px]">
          <div className="flex items-start gap-1.5">
            {draggable && !readOnly && !isInactive && (
              <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 mt-0.5 shrink-0" title="Arraste para reordenar">
                <GripVertical className="w-3.5 h-3.5" />
              </span>
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              {editing
                ? <input value={form.activity_name} onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))} className={inputClass} />
                : <span className={isInactive ? "line-through text-slate-400" : ""}>{form.activity_name}</span>
              }
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium">Local</span>
                {isInactive && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">Inativo</span>}
                <DependencyBadge
                  count={myDeps.length}
                  predecessorNames={depNames}
                  onClick={() => onOpenDependencyModal(actRef, activity.activity_name)}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </div>
        </td>
        <td className="px-1 py-2.5">
          {editing ? <input type="date" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-600">{fmtDate(form.planned_start)}</span>}
        </td>
        <td className="px-1 py-2.5">
          {editing ? <input type="date" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-600">{fmtDate(form.planned_end)}</span>}
        </td>
        <td className="px-1 py-2.5">
          {editing ? <input type="date" value={form.actual_start} onChange={e => setForm(f => ({ ...f, actual_start: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500">{fmtDate(form.actual_start)}</span>}
        </td>
        <td className="px-1 py-2.5">
          {editing ? <input type="date" value={form.actual_end} onChange={e => setForm(f => ({ ...f, actual_end: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500">{fmtDate(form.actual_end)}</span>}
        </td>
        <td className="px-1 py-2.5 max-w-[120px]">
          {editing ? <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_general || "—"}</span>}
        </td>
        <td className="px-1 py-2.5 max-w-[120px]">
          {editing ? <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>}
        </td>
        <td className="px-1 py-2.5">
          {editing
            ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            : <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[form.status] || STATUS_COLORS["Não iniciado"]}`}>{form.status}</span>
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
          {!readOnly && !isInactive && (
            editing ? (
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
                {canEdit && (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
                {canExcluir && (
                  <button
                    onClick={() => setConfirm(true)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:underline px-1"
                    title={hasData ? "Inativar (possui dados executados)" : "Excluir"}
                  >
                    {hasData ? <EyeOff className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                    {hasData ? "Inativar" : "Excluir"}
                  </button>
                )}
              </div>
            )
          )}
        </td>
      </tr>

      {/* Linha de confirmação inline */}
      {confirm && (
        <tr className="bg-red-50">
          <td colSpan={10} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-800 flex-1">
                {hasData
                  ? "Esta atividade possui dados executados e será apenas inativada (histórico preservado)."
                  : "Tem certeza que deseja excluir esta atividade definitivamente?"}
              </span>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : (hasData ? <EyeOff className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />)}
                {hasData ? "Inativar" : "Excluir"}
              </button>
              <button onClick={() => setConfirm(false)} className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-100">
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
                <p className="text-sm font-semibold text-slate-700">{activity.activity_name}</p>
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