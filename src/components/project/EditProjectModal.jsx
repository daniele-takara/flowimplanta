import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save } from "lucide-react";
import { CONTRACTED_MODULES_OPTIONS } from "@/lib/scopeTemplate";

const ALL_SERVICES = [
  "Parametrização e cálculo (1 vez na implantação)",
  "Treinamentos das pessoas chave (Implantação)",
  "Arquivo txt de exportação para FOPAG",
  "Integração Sankhya",
  "Integrações (disponibilização de API)",
  "Importação de arquivo AFD em nuvem",
  "Compliance e Cibersegurança",
  "Parametrizações e Cálculos Mensal",
  "Atendimento e Suporte dedicado"
];

const ORIGINS = ["Pontotel", "Parceiro", "Indicação", "Inbound", "Outbound"];

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

function CheckGroup({ label, options, selected, onChange }) {
  const toggle = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt];
    onChange(next);
  };
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              selected.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EditProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name || "",
    client_name: project?.client_name || "",
    empresa_id: project?.empresa_id || "",
    origin: project?.origin || "",
    mrr: project?.mrr || "",
    start_date: project?.start_date || "",
    planned_end_date: project?.planned_end_date || "",
    aligned_end_date: project?.aligned_end_date || "",
    contracted_employees: project?.contracted_employees || "",
    sponsor_name: project?.sponsor_name || "",
    sponsor_contact: project?.sponsor_contact || "",
    project_leader_name: project?.project_leader_name || "",
    project_leader_contact: project?.project_leader_contact || "",
    operation_name: project?.operation_name || "",
    operation_contact: project?.operation_contact || "",
    ti_client_name: project?.ti_client_name || "",
    ti_client_contact: project?.ti_client_contact || "",
    pontotel_manager_name: project?.pontotel_manager_name || "",
    pontotel_manager_contact: project?.pontotel_manager_contact || "",
    pontotel_analyst_name: project?.pontotel_analyst_name || "",
    pontotel_analyst_contact: project?.pontotel_analyst_contact || "",
    contracted_modules: project?.contracted_modules || [],
    contracted_services: project?.contracted_services || [],
    observations: project?.observations || "",
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Project.update(project.id, {
      ...form,
      mrr: form.mrr ? Number(form.mrr) : null,
      contracted_employees: form.contracted_employees ? Number(form.contracted_employees) : null,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">Editar Dados Iniciais</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do projeto">
              <input value={form.name} onChange={set("name")} className={inputClass} placeholder="Nome do projeto" />
            </Field>
            <Field label="Cliente / Empresa">
              <input value={form.client_name} onChange={set("client_name")} className={inputClass} placeholder="Nome do cliente" />
            </Field>
            <Field label="ID da Empresa (empresa_id)">
              <input value={form.empresa_id} onChange={set("empresa_id")} className={inputClass} placeholder="Ex: 12345 — chave de vínculo com planilha de usabilidade" />
            </Field>
            <Field label="Origem do cliente">
              <select value={form.origin} onChange={set("origin")} className={inputClass}>
                <option value="">Selecione...</option>
                {ORIGINS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="MRR (R$)">
              <input type="number" value={form.mrr} onChange={set("mrr")} className={inputClass} placeholder="0,00" />
            </Field>
            <Field label="Data de início">
              <input type="date" value={form.start_date} onChange={set("start_date")} className={inputClass} />
            </Field>
            <Field label="Data máxima de conclusão">
              <input type="date" value={form.planned_end_date} onChange={set("planned_end_date")} className={inputClass} />
            </Field>
            <Field label="Data alinhada de conclusão">
              <input type="date" value={form.aligned_end_date} onChange={set("aligned_end_date")} className={inputClass} />
            </Field>
            <Field label="Nº funcionários contratados">
              <input type="number" value={form.contracted_employees} onChange={set("contracted_employees")} className={inputClass} placeholder="0" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Participantes do Projeto</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Patrocinador — Nome">
                <input value={form.sponsor_name} onChange={set("sponsor_name")} className={inputClass} />
              </Field>
              <Field label="Patrocinador — Contato">
                <input value={form.sponsor_contact} onChange={set("sponsor_contact")} className={inputClass} />
              </Field>
              <Field label="Líder do projeto (cliente) — Nome">
                <input value={form.project_leader_name} onChange={set("project_leader_name")} className={inputClass} />
              </Field>
              <Field label="Líder do projeto — Contato">
                <input value={form.project_leader_contact} onChange={set("project_leader_contact")} className={inputClass} />
              </Field>
              <Field label="Operação — Nome">
                <input value={form.operation_name} onChange={set("operation_name")} className={inputClass} />
              </Field>
              <Field label="Operação — Contato">
                <input value={form.operation_contact} onChange={set("operation_contact")} className={inputClass} />
              </Field>
              <Field label="TI Cliente — Nome">
                <input value={form.ti_client_name} onChange={set("ti_client_name")} className={inputClass} />
              </Field>
              <Field label="TI Cliente — Contato">
                <input value={form.ti_client_contact} onChange={set("ti_client_contact")} className={inputClass} />
              </Field>
              <Field label="Gerente Pontotel — Nome">
                <input value={form.pontotel_manager_name} onChange={set("pontotel_manager_name")} className={inputClass} />
              </Field>
              <Field label="Gerente Pontotel — Contato">
                <input value={form.pontotel_manager_contact} onChange={set("pontotel_manager_contact")} className={inputClass} />
              </Field>
              <Field label="Analista de Implantação — Nome">
                <input value={form.pontotel_analyst_name} onChange={set("pontotel_analyst_name")} className={inputClass} />
              </Field>
              <Field label="Analista de Implantação — Contato">
                <input value={form.pontotel_analyst_contact} onChange={set("pontotel_analyst_contact")} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Módulos e Serviços</p>
            <CheckGroup
              label="Módulos contratados"
              options={CONTRACTED_MODULES_OPTIONS}
              selected={form.contracted_modules}
              onChange={v => setForm(f => ({ ...f, contracted_modules: v }))}
            />
            <CheckGroup
              label="Serviços contratados"
              options={ALL_SERVICES}
              selected={form.contracted_services}
              onChange={v => setForm(f => ({ ...f, contracted_services: v }))}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Field label="Observações">
              <textarea value={form.observations} onChange={set("observations")} className={`${inputClass} resize-none`} rows={3} />
            </Field>
          </div>
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}