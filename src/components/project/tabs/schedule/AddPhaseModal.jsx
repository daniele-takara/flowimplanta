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

export default function AddPhaseModal({ projectId, phase, onSave, onClose }) {
  const isEditing = !!phase?.id;

  const [form, setForm] = useState({
    phase_name: phase?.phase_name || "",
    order: phase?.order ?? 99,
    planned_start: phase?.planned_start || "",
    planned_end: phase?.planned_end || "",
    status: phase?.status || "Não iniciado",
    observations: phase?.observations || "",
    responsible_general: phase?.responsible_general || "",
    responsible_leader: phase?.responsible_leader || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.phase_name.trim()) { setError("Nome da fase é obrigatório."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        order: Number(form.order) || 99,
        project_id: projectId,
        is_local: true,
        is_active: true,
      };
      let saved;
      if (isEditing) {
        await base44.entities.LocalSchedulePhase.update(phase.id, payload);
        saved = { ...phase, ...payload };
      } else {
        saved = await base44.entities.LocalSchedulePhase.create(payload);
      }
      onSave(saved);
    } catch (e) {
      setError(e.message || "Erro ao salvar fase.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800">
            {isEditing ? "Editar marco/fase local" : "Adicionar marco/fase local"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <Field label="Nome do marco/fase *">
            <input
              value={form.phase_name}
              onChange={set("phase_name")}
              className={inputClass}
              placeholder="Ex: Expansão extra, Treinamento adicional..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ordem de exibição">
              <input
                type="number"
                value={form.order}
                onChange={set("order")}
                className={inputClass}
                placeholder="99"
              />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set("status")} className={inputClass}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Início planejado">
              <input type="date" value={form.planned_start} onChange={set("planned_start")} className={inputClass} />
            </Field>
            <Field label="Fim planejado">
              <input type="date" value={form.planned_end} onChange={set("planned_end")} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável geral">
              <input value={form.responsible_general} onChange={set("responsible_general")} className={inputClass} placeholder="Nome ou equipe" />
            </Field>
            <Field label="Papel / Líder">
              <input value={form.responsible_leader} onChange={set("responsible_leader")} className={inputClass} placeholder="Ex: Analista de Implantação" />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              value={form.observations}
              onChange={set("observations")}
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="Contexto ou objetivo desta fase..."
            />
          </Field>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
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
            {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar marco/fase"}
          </button>
        </div>
      </div>
    </div>
  );
}