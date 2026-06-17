import { useState, useMemo } from "react";
import { X, Save } from "lucide-react";
import { RESPONSIBLE_ROLE_LABELS, resolveRoleToName } from "@/lib/resolveResponsibleRole.js";

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];
const inputClass = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 mb-1";

const RESP_GERAL_OPTIONS = [
  { value: "Pontotel", label: "Pontotel" },
  { value: "Cliente", label: "Cliente" },
  { value: "Pontotel e Cliente", label: "Pontotel e Cliente" },
];

function buildRoleOptions(project) {
  return Object.entries(RESPONSIBLE_ROLE_LABELS).map(([role, label]) => {
    const name = resolveRoleToName(role, project);
    return { value: role, label: name ? `${label}: ${name}` : label };
  });
}

export default function AddActivityModal({ projectId, defaultPhase, allPhaseNames = [], onSave, onClose, project }) {
  const roleOptions = useMemo(() => buildRoleOptions(project), [project]);

  const [form, setForm] = useState({
    phase_name:           defaultPhase || (allPhaseNames[0] || ""),
    activity_name:        "",
    planned_start:        "",
    planned_end:          "",
    actual_start:         "",
    actual_end:           "",
    responsible_general:  "",
    responsible_leader:   "",
    status:               "Não iniciado",
    history_observations: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.activity_name.trim()) { setError("Nome da atividade é obrigatório."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        project_id:           projectId,
        phase_name:           form.phase_name,
        activity_name:        form.activity_name.trim(),
        planned_start:        form.planned_start || null,
        planned_end:          form.planned_end   || null,
        actual_start:         form.actual_start  || null,
        actual_end:           form.actual_end    || null,
        responsible_general:  form.responsible_general,
        responsible_leader:   form.responsible_leader,
        status:               form.status,
        history_observations: form.history_observations,
        template_id:          null,
      });
      setSaving(false);
      onClose();
    } catch (err) {
      console.error("[AddActivityModal] Erro ao salvar:", err);
      setError(err?.message || err?.response?.data?.message || "Erro ao salvar atividade. Verifique suas permissões.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">➕ Adicionar Atividade Local</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Fase */}
          <div>
            <label className={labelClass}>Fase *</label>
            {allPhaseNames.length > 0 ? (
              <select value={form.phase_name} onChange={set("phase_name")} className={inputClass}>
                {allPhaseNames.map(p => <option key={p}>{p}</option>)}
              </select>
            ) : (
              <input value={form.phase_name} onChange={set("phase_name")} className={inputClass} placeholder="Nome da fase" />
            )}
          </div>

          {/* Nome */}
          <div>
            <label className={labelClass}>Nome da atividade *</label>
            <input value={form.activity_name} onChange={set("activity_name")} className={inputClass} placeholder="Descreva a atividade..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Início Planejado</label>
              <input type="date" value={form.planned_start} onChange={set("planned_start")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fim Planejado</label>
              <input type="date" value={form.planned_end} onChange={set("planned_end")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Início Executado</label>
              <input type="date" value={form.actual_start} onChange={set("actual_start")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fim Executado</label>
              <input type="date" value={form.actual_end} onChange={set("actual_end")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Resp. Geral</label>
              <select value={form.responsible_general} onChange={set("responsible_general")} className={inputClass}>
                <option value="">Selecione...</option>
                {RESP_GERAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Papel Líder</label>
              <select value={form.responsible_leader} onChange={set("responsible_leader")} className={inputClass}>
                <option value="">Selecione...</option>
                {roleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={set("status")} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Obs. Internas</label>
              <input value={form.history_observations} onChange={set("history_observations")} className={inputClass} placeholder="Observações..." />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <p className="text-xs text-slate-400">Esta atividade será salva somente neste projeto e não afeta o template global.</p>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.activity_name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Adicionar atividade"}
          </button>
        </div>
      </div>
    </div>
  );
}