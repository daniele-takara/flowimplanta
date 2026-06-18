import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { CONTRACTED_MODULES_OPTIONS } from "@/lib/scopeTemplate";
import { logAudit } from "@/lib/auditLog";

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
  // Extrai email/phone do _contact legado (fallback para projetos que ainda não têm campos novos)
  const extractContact = (contact) => {
    if (!contact) return { email: "", phone: "" };
    const parts = contact.split("/").map(s => s.trim());
    const email = parts.find(p => p.includes("@")) || "";
    const phone = parts.find(p => !p.includes("@")) || "";
    return { email, phone };
  };
  const sponsorLegacy = extractContact(project?.sponsor_contact);
  const projectLeaderLegacy = extractContact(project?.project_leader_contact);
  const operationLegacy = extractContact(project?.operation_contact);
  const tiClientLegacy = extractContact(project?.ti_client_contact);
  const pontotelManagerLegacy = extractContact(project?.pontotel_manager_contact);
  const pontotelAnalystLegacy = extractContact(project?.pontotel_analyst_contact);

  const [form, setForm] = useState({
    name: project?.name || "",
    client_name: project?.client_name || "",
    origin: project?.origin || "",
    mrr: project?.mrr || "",
    start_date: project?.start_date || "",
    planned_end_date: project?.planned_end_date || "",
    aligned_end_date: project?.aligned_end_date || "",
    contracted_employees: project?.contracted_employees || "",
    sponsor_name: project?.sponsor_name || "",
    sponsor_email: project?.sponsor_email || sponsorLegacy.email,
    sponsor_phone: project?.sponsor_phone || sponsorLegacy.phone,
    project_leader_name: project?.project_leader_name || "",
    project_leader_email: project?.project_leader_email || projectLeaderLegacy.email,
    project_leader_phone: project?.project_leader_phone || projectLeaderLegacy.phone,
    operation_name: project?.operation_name || "",
    operation_email: project?.operation_email || operationLegacy.email,
    operation_phone: project?.operation_phone || operationLegacy.phone,
    ti_client_name: project?.ti_client_name || "",
    ti_client_email: project?.ti_client_email || tiClientLegacy.email,
    ti_client_phone: project?.ti_client_phone || tiClientLegacy.phone,
    pontotel_manager_name: project?.pontotel_manager_name || "",
    pontotel_manager_email: project?.pontotel_manager_email || pontotelManagerLegacy.email,
    pontotel_manager_phone: project?.pontotel_manager_phone || pontotelManagerLegacy.phone,
    pontotel_analyst_name: project?.pontotel_analyst_name || "",
    pontotel_analyst_email: project?.pontotel_analyst_email || pontotelAnalystLegacy.email,
    pontotel_analyst_phone: project?.pontotel_analyst_phone || pontotelAnalystLegacy.phone,
    contracted_modules: project?.contracted_modules || [],
    contracted_services: project?.contracted_services || [],
    observations: project?.observations || "",
    drive_folder: project?.drive_folder || "",
  });
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Carrega membros dinâmicos
  useEffect(() => {
    if (!project?.id || membersLoaded) return;
    base44.entities.ProjectTeamMember.filter({ project_id: project.id })
      .then(list => { setTeamMembers(list || []); setMembersLoaded(true); })
      .catch(() => setMembersLoaded(true));
  }, [project?.id, membersLoaded]);

  const addMember = (team) => {
    setTeamMembers(prev => [...prev, { team, name: "", role: "", email: "", phone: "", _new: true }]);
  };
  const updateMember = (idx, field, value) => {
    setTeamMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };
  const removeMember = (idx) => {
    setTeamMembers(prev => {
      const m = prev[idx];
      // Membros existentes (com id): marca como _deleted para deletar do banco no save
      if (m?.id && !m._new) return prev.map((x, i) => i === idx ? { ...x, _deleted: true } : x);
      // Membros novos (sem id): remove do estado
      return prev.filter((_, i) => i !== idx);
    });
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    // Registra alterações no log de auditoria
    const auditFields = [
      "name", "client_name", "origin", "start_date", "planned_end_date", "aligned_end_date",
      "contracted_employees", "mrr", "observations", "drive_folder",
      "sponsor_name", "sponsor_email", "sponsor_phone",
      "project_leader_name", "project_leader_email", "project_leader_phone",
      "operation_name", "operation_email", "operation_phone",
      "ti_client_name", "ti_client_email", "ti_client_phone",
      "pontotel_manager_name", "pontotel_manager_email", "pontotel_manager_phone",
      "pontotel_analyst_name", "pontotel_analyst_email", "pontotel_analyst_phone",
    ];
    for (const field of auditFields) {
      const oldVal = project?.[field];
      const newVal = form[field];
      const oldStr = oldVal === undefined || oldVal === null ? "" : String(oldVal);
      const newStr = newVal === undefined || newVal === null ? "" : String(newVal);
      if (oldStr !== newStr) {
        logAudit({ project_id: project.id, screen: "Dados Iniciais", field, old_value: oldStr, new_value: newStr });
      }
    }
    // Audita módulos e serviços (arrays)
    const oldModules = JSON.stringify((project?.contracted_modules || []).sort());
    const newModules = JSON.stringify((form.contracted_modules || []).sort());
    if (oldModules !== newModules) {
      logAudit({ project_id: project.id, screen: "Dados Iniciais", field: "contracted_modules", old_value: oldModules, new_value: newModules });
    }
    const oldServices = JSON.stringify((project?.contracted_services || []).sort());
    const newServices = JSON.stringify((form.contracted_services || []).sort());
    if (oldServices !== newServices) {
      logAudit({ project_id: project.id, screen: "Dados Iniciais", field: "contracted_services", old_value: oldServices, new_value: newServices });
    }

    // Popula _contact legado para manter compatibilidade com código existente
    const buildContact = (email, phone) => [email, phone].filter(Boolean).join(" / ") || "";
    const payload = {
      ...form,
      mrr: form.mrr ? Number(form.mrr) : null,
      contracted_employees: form.contracted_employees ? Number(form.contracted_employees) : null,
      sponsor_contact: buildContact(form.sponsor_email, form.sponsor_phone),
      project_leader_contact: buildContact(form.project_leader_email, form.project_leader_phone),
      operation_contact: buildContact(form.operation_email, form.operation_phone),
      ti_client_contact: buildContact(form.ti_client_email, form.ti_client_phone),
      pontotel_manager_contact: buildContact(form.pontotel_manager_email, form.pontotel_manager_phone),
      pontotel_analyst_contact: buildContact(form.pontotel_analyst_email, form.pontotel_analyst_phone),
    };
    await base44.entities.Project.update(project.id, payload);

    // Salvar membros dinâmicos — deleta existentes e recria
    if (membersLoaded && teamMembers.length > 0) {
      const existing = teamMembers.filter(m => m.id);
      const toDelete = teamMembers.filter(m => m._deleted && m.id);
      const toCreate = teamMembers.filter(m => m._new || !m.id).filter(m => m.name?.trim());

      // Deleta removidos
      for (const m of toDelete) {
        await base44.entities.ProjectTeamMember.delete(m.id).catch(() => {});
      }
      // Cria novos
      for (const m of toCreate) {
        await base44.entities.ProjectTeamMember.create({
          project_id: project.id, team: m.team, name: m.name.trim(),
          role: m.role || "", email: m.email || "", phone: m.phone || "",
        });
      }
      // Atualiza existentes
      for (const m of existing) {
        await base44.entities.ProjectTeamMember.update(m.id, {
          name: m.name, role: m.role, email: m.email, phone: m.phone,
        });
      }
    }

    setSaving(false);
    onClose();
    onSaved();
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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Equipe Pontotel</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Gerente — Nome">
                <input value={form.pontotel_manager_name} onChange={set("pontotel_manager_name")} className={inputClass} />
              </Field>
              <Field label="Gerente — E-mail">
                <input type="email" value={form.pontotel_manager_email} onChange={set("pontotel_manager_email")} className={inputClass} />
              </Field>
              <Field label="Gerente — Telefone">
                <input value={form.pontotel_manager_phone} onChange={set("pontotel_manager_phone")} className={inputClass} />
              </Field>
              <Field label="Analista de Implantação — Nome">
                <input value={form.pontotel_analyst_name} onChange={set("pontotel_analyst_name")} className={inputClass} />
              </Field>
              <Field label="Analista — E-mail">
                <input type="email" value={form.pontotel_analyst_email} onChange={set("pontotel_analyst_email")} className={inputClass} />
              </Field>
              <Field label="Analista — Telefone">
                <input value={form.pontotel_analyst_phone} onChange={set("pontotel_analyst_phone")} className={inputClass} />
              </Field>
            </div>
            {/* Membros adicionais Pontotel */}
            {teamMembers.filter(m => m.team === "pontotel" && !m._deleted).map((m, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                <Field label="Função">
                  <input value={m.role} onChange={e => updateMember(i, "role", e.target.value)} className={inputClass} placeholder="Ex: Consultor" />
                </Field>
                <Field label="Nome">
                  <input value={m.name} onChange={e => updateMember(i, "name", e.target.value)} className={inputClass} />
                </Field>
                <Field label="E-mail">
                  <input type="email" value={m.email} onChange={e => updateMember(i, "email", e.target.value)} className={inputClass} />
                </Field>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Field label="Telefone"><input value={m.phone} onChange={e => updateMember(i, "phone", e.target.value)} className={inputClass} /></Field></div>
                  <button onClick={() => removeMember(i)} className="p-2 text-slate-400 hover:text-red-500 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => addMember("pontotel")} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700">
              <Plus className="w-3.5 h-3.5" /> Adicionar membro Pontotel
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Equipe Cliente</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Patrocinador — Nome">
                <input value={form.sponsor_name} onChange={set("sponsor_name")} className={inputClass} />
              </Field>
              <Field label="Patrocinador — E-mail">
                <input type="email" value={form.sponsor_email} onChange={set("sponsor_email")} className={inputClass} />
              </Field>
              <Field label="Patrocinador — Telefone">
                <input value={form.sponsor_phone} onChange={set("sponsor_phone")} className={inputClass} />
              </Field>
              <Field label="Líder do Projeto — Nome">
                <input value={form.project_leader_name} onChange={set("project_leader_name")} className={inputClass} />
              </Field>
              <Field label="Líder — E-mail">
                <input type="email" value={form.project_leader_email} onChange={set("project_leader_email")} className={inputClass} />
              </Field>
              <Field label="Líder — Telefone">
                <input value={form.project_leader_phone} onChange={set("project_leader_phone")} className={inputClass} />
              </Field>
              <Field label="Operação — Nome">
                <input value={form.operation_name} onChange={set("operation_name")} className={inputClass} />
              </Field>
              <Field label="Operação — E-mail">
                <input type="email" value={form.operation_email} onChange={set("operation_email")} className={inputClass} />
              </Field>
              <Field label="Operação — Telefone">
                <input value={form.operation_phone} onChange={set("operation_phone")} className={inputClass} />
              </Field>
              <Field label="TI Cliente — Nome">
                <input value={form.ti_client_name} onChange={set("ti_client_name")} className={inputClass} />
              </Field>
              <Field label="TI — E-mail">
                <input type="email" value={form.ti_client_email} onChange={set("ti_client_email")} className={inputClass} />
              </Field>
              <Field label="TI — Telefone">
                <input value={form.ti_client_phone} onChange={set("ti_client_phone")} className={inputClass} />
              </Field>
            </div>
            {/* Membros adicionais Cliente */}
            {teamMembers.filter(m => m.team === "cliente" && !m._deleted).map((m, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <Field label="Função">
                  <input value={m.role} onChange={e => updateMember(i, "role", e.target.value)} className={inputClass} placeholder="Ex: RH" />
                </Field>
                <Field label="Nome">
                  <input value={m.name} onChange={e => updateMember(i, "name", e.target.value)} className={inputClass} />
                </Field>
                <Field label="E-mail">
                  <input type="email" value={m.email} onChange={e => updateMember(i, "email", e.target.value)} className={inputClass} />
                </Field>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Field label="Telefone"><input value={m.phone} onChange={e => updateMember(i, "phone", e.target.value)} className={inputClass} /></Field></div>
                  <button onClick={() => removeMember(i)} className="p-2 text-slate-400 hover:text-red-500 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => addMember("cliente")} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
              <Plus className="w-3.5 h-3.5" /> Adicionar membro Cliente
            </button>
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

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <Field label="Pasta do Drive">
              <input value={form.drive_folder} onChange={set("drive_folder")} className={inputClass} placeholder="https://drive.google.com/..." />
            </Field>
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