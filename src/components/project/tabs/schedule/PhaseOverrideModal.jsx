import { useState } from "react";
import { X, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_OPTIONS = ["Não iniciado", "Em andamento", "Concluído", "Atrasado", "Bloqueado", "Cancelado"];
const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 mb-1";

function Field({ label, children }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Modal para criar/editar override local de fase do template.
 * Não altera o template global — apenas persiste em SchedulePhaseOverride.
 */
export default function PhaseOverrideModal({ projectId, phaseName, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    custom_name:            existing?.custom_name            || "",
    planned_start_override: existing?.planned_start_override || "",
    planned_end_override:   existing?.planned_end_override   || "",
    status_override:        existing?.status_override        || "Não iniciado",
    observations:           existing?.observations           || "",
    responsible_general:    existing?.responsible_general    || "",
    responsible_leader:     existing?.responsible_leader     || "",
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const user     = await base44.auth.me().catch(() => null);
      const payload  = {
        project_id:   projectId,
        phase_name:   phaseName,
        is_active:    existing?.is_active !== false ? true : existing.is_active,
        updated_by:   user?.full_name || user?.email || "",
        updated_at:   new Date().toISOString(),
        ...form,
      };
      let saved;
      if (existing?.id) {
        await base44.entities.SchedulePhaseOverride.update(existing.id, payload);
        saved = { ...existing, ...payload };
      } else {
        saved = await base44.entities.SchedulePhaseOverride.create(payload);
      }
      onSave(saved);
    } catch (e) {
      setError(e.message || "Erro ao salvar.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Editar fase neste projeto</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fase: <strong>{phaseName}</strong> · somente para este projeto</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <Field label="Nome customizado (deixe vazio para usar o nome original)">
            <input
              value={form.custom_name}
              onChange={set("custom_name")}
              className={inputClass}
              placeholder={phaseName}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Início planejado (override)">
              <input type="date" value={form.planned_start_override} onChange={set("planned_start_override")} className={inputClass} />
            </Field>
            <Field label="Fim planejado (override)">
              <input type="date" value={form.planned_end_override} onChange={set("planned_end_override")} className={inputClass} />
            </Field>
          </div>

          <Field label="Status">
            <select value={form.status_override} onChange={set("status_override")} className={inputClass}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável geral">
              <input value={form.responsible_general} onChange={set("responsible_general")} className={inputClass} placeholder="Nome ou equipe" />
            </Field>
            <Field label="Papel / Líder">
              <input value={form.responsible_leader} onChange={set("responsible_leader")} className={inputClass} placeholder="Ex: Analista" />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              value={form.observations}
              onChange={set("observations")}
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="Contexto ou notas sobre esta fase neste projeto..."
            />
          </Field>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar override"}
          </button>
        </div>
      </div>
    </div>
  );
}