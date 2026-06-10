import { useState } from "react";
import { Save, X, Trash2, Loader2, EyeOff, AlertTriangle, Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";

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

export default function LocalActivityRow({ activity, onUpdated, onRemoved, readOnly, showInactive }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
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

  // Ocultar inativas se não solicitado
  if (isInactive && !showInactive) return null;

  const hasData = activity.actual_start || activity.actual_end ||
    (activity.history_observations && !activity.history_observations.includes("[INATIVADO]"));
  
  const inputClass = "px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white";

  const handleSave = async () => {
    setSaving(true);
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
    setSaving(false);
    setEditing(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
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
    setRemoving(false);
    setConfirm(false);
  };

  const rowClass = isInactive
    ? "border-b border-slate-50 bg-slate-50/60 opacity-60"
    : "border-b border-slate-50 hover:bg-purple-50/30 transition-colors";

  return (
    <>
      <tr className={rowClass}>
        <td className="px-4 py-2.5 text-sm text-slate-700 max-w-[280px]">
          <div className="flex flex-col gap-0.5">
            {editing
              ? <input value={form.activity_name} onChange={e => setForm(f => ({ ...f, activity_name: e.target.value }))} className={inputClass} />
              : <span className={isInactive ? "line-through text-slate-400" : ""}>{form.activity_name}</span>
            }
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium">Local</span>
              {isInactive && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">Inativo</span>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {editing ? <input type="date" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-600">{fmtDate(form.planned_start)}</span>}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {editing ? <input type="date" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-600">{fmtDate(form.planned_end)}</span>}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {editing ? <input type="date" value={form.actual_start} onChange={e => setForm(f => ({ ...f, actual_start: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500">{fmtDate(form.actual_start)}</span>}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {editing ? <input type="date" value={form.actual_end} onChange={e => setForm(f => ({ ...f, actual_end: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500">{fmtDate(form.actual_end)}</span>}
        </td>
        <td className="px-3 py-2.5 max-w-[120px]">
          {editing ? <input value={form.responsible_general} onChange={e => setForm(f => ({ ...f, responsible_general: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_general || "—"}</span>}
        </td>
        <td className="px-3 py-2.5 max-w-[120px]">
          {editing ? <input value={form.responsible_leader} onChange={e => setForm(f => ({ ...f, responsible_leader: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-500 truncate block">{form.responsible_leader || "—"}</span>}
        </td>
        <td className="px-3 py-2.5">
          {editing
            ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            : <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[form.status] || STATUS_COLORS["Não iniciado"]}`}>{form.status}</span>
          }
        </td>
        <td className="px-3 py-2.5 max-w-[140px]">
          {editing ? <input value={form.history_observations} onChange={e => setForm(f => ({ ...f, history_observations: e.target.value }))} className={inputClass} />
            : <span className="text-xs text-slate-400 truncate block">{form.history_observations || "—"}</span>}
        </td>
        <td className="px-3 py-2.5">
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
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-1">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button
                  onClick={() => setConfirm(true)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:underline px-1"
                  title={hasData ? "Inativar (possui dados executados)" : "Excluir"}
                >
                  {hasData ? <EyeOff className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  {hasData ? "Inativar" : "Excluir"}
                </button>
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
    </>
  );
}