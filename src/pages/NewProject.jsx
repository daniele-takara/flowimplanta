import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SCHEDULE_TEMPLATE, SCOPE_TEMPLATE } from "@/lib/mockData";
import { ArrowLeft, Save, ChevronRight, CheckCircle2 } from "lucide-react";

const STEPS = [
  { id: "general", label: "Dados Gerais" },
  { id: "participants", label: "Participantes" },
  { id: "scope", label: "Módulos e Serviços" },
  { id: "schedule", label: "Cronograma" }
];

const MODULES = [
  "Ponto Eletrônico", "Banco de Horas", "Escala", "Controle de Custos",
  "App Mobile", "REP-C", "Integração Sankhya", "Controle de Acesso"
];
const SERVICES = [
  "Integração Sankhya MGE", "Parametrização Cálculos", "Treinamento Gestores",
  "Treinamento Usuários", "Suporte Estendido", "Migração de Dados"
];

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${i === current ? "bg-blue-600 text-white" : i < current ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-5 h-5 flex items-center justify-center rounded-full border-2 text-xs">{i + 1}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
        </div>
      ))}
    </div>
  );
}

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    client_name: "",
    origin: "Pontotel",
    mrr: "",
    implantation_type: "Implantação Pontotel",
    contracted_employees: "",
    start_date: "",
    planned_end_date: "",
    sponsor_name: "", sponsor_contact: "",
    project_leader_name: "", project_leader_contact: "",
    operation_name: "", operation_contact: "",
    ti_client_name: "", ti_client_contact: "",
    pontotel_manager_name: "", pontotel_manager_contact: "",
    pontotel_analyst_name: "", pontotel_analyst_contact: "",
    contracted_modules: [],
    contracted_services: [],
    observations: ""
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleArray = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const project = await base44.entities.Project.create({
        ...form,
        mrr: form.mrr ? Number(form.mrr) : undefined,
        contracted_employees: form.contracted_employees ? Number(form.contracted_employees) : undefined,
        status: "Planejamento",
        current_phase: "Abertura de projeto",
        progress_percent: 0
      });

      // Create scope items from template
      const scopeItems = SCOPE_TEMPLATE.flatMap(section =>
        section.items.map(item => ({
          project_id: project.id,
          section: section.section,
          question: item.question,
          best_practice: item.best_practice,
          order_number: item.order_number,
          answer: "",
          field_type: "text"
        }))
      );
      await base44.entities.ScopeItem.bulkCreate(scopeItems);

      // Create schedule phases from template
      const phases = SCHEDULE_TEMPLATE.map((p, i) => ({
        project_id: project.id,
        phase_name: p.phase_name,
        progress_percent: 0,
        status: "Não iniciado",
        order: i + 1
      }));
      await base44.entities.SchedulePhase.bulkCreate(phases);

      navigate(`/projects/${project.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const labelClass = "block text-sm font-medium text-slate-600 mb-1";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/projects" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Novo Projeto</h1>
          <p className="text-slate-400 text-sm">Criação a partir do template de implantação Pontotel</p>
        </div>
      </div>

      <div className="mb-8">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* STEP 0: Dados Gerais */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Dados Gerais do Projeto</h2>
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className={labelClass}>Nome do Projeto *</label>
                <input className={inputClass} placeholder="Ex: Implantação Pontotel – Empresa XYZ" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Cliente / Empresa *</label>
                <input className={inputClass} placeholder="Nome da empresa" value={form.client_name} onChange={e => set("client_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Origem do Cliente</label>
                <select className={inputClass} value={form.origin} onChange={e => set("origin", e.target.value)}>
                  {["Pontotel", "Parceiro", "Indicação", "Inbound", "Outbound"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>MRR (R$)</label>
                <input className={inputClass} type="number" placeholder="0,00" value={form.mrr} onChange={e => set("mrr", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Funcionários Contratados</label>
                <input className={inputClass} type="number" placeholder="0" value={form.contracted_employees} onChange={e => set("contracted_employees", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipo de Implantação</label>
                <select className={inputClass} value={form.implantation_type} onChange={e => set("implantation_type", e.target.value)}>
                  {["Implantação Pontotel", "Implantação com integração Sankhya", "Implantação com integração Sankhya adiada", "Implantação Pontotel com parametrizações não finalizadas", "Implantação com integração Sankhya adiada e parametrizações não finalizadas"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div />
              <div>
                <label className={labelClass}>Data de Início</label>
                <input className={inputClass} type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Data Máxima de Conclusão</label>
                <input className={inputClass} type="date" value={form.planned_end_date} onChange={e => set("planned_end_date", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Observações</label>
                <textarea className={inputClass} rows={3} placeholder="Observações relevantes do projeto" value={form.observations} onChange={e => set("observations", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Participantes */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Participantes do Projeto</h2>
            <p className="text-sm text-slate-400 mb-6">O sucesso do projeto depende da participação ativa de todos os envolvidos.</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 pb-2 border-b">Cliente — {form.client_name || "Empresa"}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Patrocinador do Projeto", nameField: "sponsor_name", contactField: "sponsor_contact" },
                    { label: "Líder do Projeto (RH)", nameField: "project_leader_name", contactField: "project_leader_contact" },
                    { label: "Operação", nameField: "operation_name", contactField: "operation_contact" },
                    { label: "TI", nameField: "ti_client_name", contactField: "ti_client_contact" }
                  ].map(p => (
                    <div key={p.nameField} className="space-y-2">
                      <label className={labelClass}>{p.label}</label>
                      <input className={inputClass} placeholder="Nome completo" value={form[p.nameField]} onChange={e => set(p.nameField, e.target.value)} />
                      <input className={inputClass} placeholder="Email | Telefone" value={form[p.contactField]} onChange={e => set(p.contactField, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 pb-2 border-b">Pontotel</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Gerente de Projeto", nameField: "pontotel_manager_name", contactField: "pontotel_manager_contact" },
                    { label: "Analista de Implantação", nameField: "pontotel_analyst_name", contactField: "pontotel_analyst_contact" }
                  ].map(p => (
                    <div key={p.nameField} className="space-y-2">
                      <label className={labelClass}>{p.label}</label>
                      <input className={inputClass} placeholder="Nome completo" value={form[p.nameField]} onChange={e => set(p.nameField, e.target.value)} />
                      <input className={inputClass} placeholder="Email | Telefone" value={form[p.contactField]} onChange={e => set(p.contactField, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Módulos e Serviços */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Módulos e Serviços Contratados</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Módulos</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODULES.map(m => (
                    <label key={m} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.contracted_modules.includes(m)}
                        onChange={() => toggleArray("contracted_modules", m)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Serviços</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.map(s => (
                    <label key={s} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.contracted_services.includes(s)}
                        onChange={() => toggleArray("contracted_services", s)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Cronograma Preview */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Cronograma do Projeto</h2>
            <p className="text-sm text-slate-400 mb-6">O cronograma será criado automaticamente com base no template padrão Pontotel. Você poderá editar datas e atividades após a criação.</p>
            <div className="space-y-3">
              {SCHEDULE_TEMPLATE.map((phase, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-blue-600 font-bold text-sm">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{phase.phase_name}</p>
                    <p className="text-xs text-slate-400 mt-1">{phase.activities.join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tudo pronto!</strong> Clique em "Criar Projeto" para gerar o projeto com escopo e cronograma baseados no template padrão de implantação Pontotel.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate("/projects")}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {step === 0 ? "Cancelar" : "← Voltar"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!form.name || !form.client_name)}
              className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.client_name}
              className="flex items-center gap-2 px-6 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              {saving ? "Criando..." : "Criar Projeto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}