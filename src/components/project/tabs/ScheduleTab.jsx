import { useState } from "react";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatDate, phaseColor } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, Save, X } from "lucide-react";

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado"];

function ActivityRow({ activity, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...activity });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(activity.id, form);
    setSaving(false);
    setEditing(false);
  };

  const inputClass = "px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{activity.activity_name}</td>
      <td className="px-3 py-3">
        {editing
          ? <input type="date" value={form.planned_start || ""} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} className={inputClass} />
          : <span className="text-xs text-slate-500">{formatDate(activity.planned_start)}</span>
        }
      </td>
      <td className="px-3 py-3">
        {editing
          ? <input type="date" value={form.planned_end || ""} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} className={inputClass} />
          : <span className="text-xs text-slate-500">{formatDate(activity.planned_end)}</span>
        }
      </td>
      <td className="px-3 py-3">
        {editing
          ? <input type="date" value={form.actual_end || ""} onChange={e => setForm(f => ({ ...f, actual_end: e.target.value }))} className={inputClass} />
          : <span className="text-xs text-slate-500">{formatDate(activity.actual_end) || "—"}</span>
        }
      </td>
      <td className="px-3 py-3 text-xs text-slate-500 max-w-[140px] truncate">{activity.responsible_leader}</td>
      <td className="px-3 py-3">
        {editing
          ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          : <StatusBadge status={activity.status} />
        }
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline px-1">Editar</button>
        )}
      </td>
    </tr>
  );
}

export default function ScheduleTab({ phases, activities, projectId, onRefresh }) {
  const [openPhases, setOpenPhases] = useState({});

  const byPhase = activities.reduce((acc, a) => {
    if (!acc[a.phase_name]) acc[a.phase_name] = [];
    acc[a.phase_name].push(a);
    return acc;
  }, {});

  const togglePhase = (name) => setOpenPhases(prev => ({ ...prev, [name]: !prev[name] }));

  const handleSaveActivity = async (id, data) => {
    if (id && !id.startsWith("a")) {
      await base44.entities.ScheduleActivity.update(id, data);
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {phases.map(phase => {
        const phaseActivities = byPhase[phase.phase_name] || [];
        const open = openPhases[phase.phase_name] !== false;

        return (
          <div key={phase.id || phase.phase_name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => togglePhase(phase.phase_name)}
            >
              {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">{phase.phase_name}</h3>
                  <StatusBadge status={phase.status} />
                  {phase.planned_start && (
                    <span className="text-xs text-slate-400">
                      {formatDate(phase.planned_start)} → {formatDate(phase.planned_end)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={phase.progress_percent} showLabel={false} size="sm" className="flex-1" />
                  <span className="text-sm font-semibold text-slate-600 shrink-0">{phase.progress_percent}%</span>
                </div>
              </div>
            </div>

            {open && phaseActivities.length > 0 && (
              <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Atividade</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-2.5">Início Plan.</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-2.5">Fim Plan.</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-2.5">Realizado</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-2.5">Responsável</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseActivities.sort((a, b) => (a.order || 0) - (b.order || 0)).map(act => (
                      <ActivityRow key={act.id || act.activity_name} activity={act} onSave={handleSaveActivity} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {open && phaseActivities.length === 0 && (
              <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-400">
                Nenhuma atividade cadastrada para esta fase.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}