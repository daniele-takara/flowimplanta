import { useState } from "react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate, impactColor } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { Plus, Save, AlertTriangle, Clock, CheckCircle2, Calendar } from "lucide-react";

function NewReportForm({ projectId, onSave, onCancel }) {
  const [form, setForm] = useState({
    report_date: new Date().toISOString().split("T")[0],
    overall_progress: 0,
    executive_summary: "",
    registered_employees: "",
    recording_employees: "",
    general_status: "No prazo",
    next_agenda: "",
    next_agenda_date: "",
    risks: [{ description: "", impact: "Médio", mitigation: "" }],
    client_pending: [{ item: "", deadline: "", responsible: "" }],
    internal_pending: [{ item: "", deadline: "", responsible: "" }]
  });
  const [saving, setSaving] = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const updateArray = (field, index, key, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? { ...item, [key]: value } : item)
    }));
  };

  const addRow = (field, empty) => setForm(prev => ({ ...prev, [field]: [...prev[field], empty] }));
  const removeRow = (field, index) => setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const handleSave = async () => {
    setSaving(true);
    const adherence_percent = form.registered_employees && form.recording_employees
      ? Math.round((Number(form.recording_employees) / Number(form.registered_employees)) * 100)
      : 0;
    await base44.entities.StatusReport.create({
      ...form,
      project_id: projectId,
      overall_progress: Number(form.overall_progress),
      registered_employees: Number(form.registered_employees),
      recording_employees: Number(form.recording_employees),
      adherence_percent,
      risks: form.risks.filter(r => r.description),
      client_pending: form.client_pending.filter(p => p.item),
      internal_pending: form.internal_pending.filter(p => p.item)
    });
    setSaving(false);
    onSave();
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-6">Novo Status Report</h3>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className={labelClass}>Data do Report</label>
          <input type="date" className={inputClass} value={form.report_date} onChange={e => set("report_date", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Status Geral</label>
          <select className={inputClass} value={form.general_status} onChange={e => set("general_status", e.target.value)}>
            {["No prazo", "Em risco", "Atrasado", "Concluído"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Progresso Geral (%)</label>
          <input type="number" min="0" max="100" className={inputClass} value={form.overall_progress} onChange={e => set("overall_progress", e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Resumo Executivo</label>
        <textarea className={inputClass} rows={3} value={form.executive_summary} onChange={e => set("executive_summary", e.target.value)} placeholder="Situação atual do projeto..." />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className={labelClass}>Funcionários Cadastrados</label>
          <input type="number" className={inputClass} value={form.registered_employees} onChange={e => set("registered_employees", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Registrando Ponto</label>
          <input type="number" className={inputClass} value={form.recording_employees} onChange={e => set("recording_employees", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Próxima Agenda</label>
          <input type="date" className={inputClass} value={form.next_agenda_date} onChange={e => set("next_agenda_date", e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Próxima Agenda – Assunto</label>
        <input className={inputClass} value={form.next_agenda} onChange={e => set("next_agenda", e.target.value)} placeholder="Ex: Status Report #5 – Revisão de parametrização" />
      </div>

      {/* Risks */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Riscos</label>
          <button onClick={() => addRow("risks", { description: "", impact: "Médio", mitigation: "" })} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Adicionar</button>
        </div>
        {form.risks.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={`${inputClass} col-span-2`} value={r.description} onChange={e => updateArray("risks", i, "description", e.target.value)} placeholder="Descrição do risco" />
            <select className={inputClass} value={r.impact} onChange={e => updateArray("risks", i, "impact", e.target.value)}>
              {["Alto", "Médio", "Baixo"].map(s => <option key={s}>{s}</option>)}
            </select>
            <input className={inputClass} value={r.mitigation} onChange={e => updateArray("risks", i, "mitigation", e.target.value)} placeholder="Mitigação" />
            <button onClick={() => removeRow("risks", i)} className="text-slate-400 hover:text-red-500 text-xs">Remover</button>
          </div>
        ))}
      </div>

      {/* Client pending */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pendências do Cliente</label>
          <button onClick={() => addRow("client_pending", { item: "", deadline: "", responsible: "" })} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Adicionar</button>
        </div>
        {form.client_pending.map((p, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={`${inputClass} col-span-2`} value={p.item} onChange={e => updateArray("client_pending", i, "item", e.target.value)} placeholder="Item pendente" />
            <input type="date" className={inputClass} value={p.deadline} onChange={e => updateArray("client_pending", i, "deadline", e.target.value)} />
            <input className={inputClass} value={p.responsible} onChange={e => updateArray("client_pending", i, "responsible", e.target.value)} placeholder="Responsável" />
            <button onClick={() => removeRow("client_pending", i)} className="text-slate-400 hover:text-red-500 text-xs">Remover</button>
          </div>
        ))}
      </div>

      {/* Internal pending */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pendências Internas</label>
          <button onClick={() => addRow("internal_pending", { item: "", deadline: "", responsible: "" })} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Adicionar</button>
        </div>
        {form.internal_pending.map((p, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={`${inputClass} col-span-2`} value={p.item} onChange={e => updateArray("internal_pending", i, "item", e.target.value)} placeholder="Item pendente" />
            <input type="date" className={inputClass} value={p.deadline} onChange={e => updateArray("internal_pending", i, "deadline", e.target.value)} />
            <input className={inputClass} value={p.responsible} onChange={e => updateArray("internal_pending", i, "responsible", e.target.value)} placeholder="Responsável" />
            <button onClick={() => removeRow("internal_pending", i)} className="text-slate-400 hover:text-red-500 text-xs">Remover</button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Report"}
        </button>
      </div>
    </div>
  );
}

function ReportCard({ report }) {
  const adherence = report.registered_employees
    ? Math.round((report.recording_employees / report.registered_employees) * 100)
    : report.adherence_percent;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-base font-bold text-slate-800">Status Report — {formatDate(report.report_date)}</p>
            <StatusBadge status={report.general_status} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-800">{report.overall_progress}%</p>
          <p className="text-xs text-slate-400">progresso</p>
        </div>
      </div>

      {report.executive_summary && (
        <div className="p-4 bg-slate-50 rounded-lg mb-5 text-sm text-slate-700">{report.executive_summary}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-500 font-medium">Cadastrados</p>
          <p className="text-xl font-bold text-blue-700">{report.registered_employees?.toLocaleString() || "—"}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-500 font-medium">Registrando Ponto</p>
          <p className="text-xl font-bold text-green-700">{report.recording_employees?.toLocaleString() || "—"}</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-500 font-medium">Aderência</p>
          <p className="text-xl font-bold text-purple-700">{adherence ? `${adherence}%` : "—"}</p>
        </div>
      </div>

      {report.risks?.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold text-slate-700">Riscos</p>
          </div>
          <div className="space-y-2">
            {report.risks.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg">
                <span className={`text-xs font-bold shrink-0 mt-0.5 ${impactColor(r.impact)}`}>{r.impact}</span>
                <div>
                  <p className="text-sm text-slate-700">{r.description}</p>
                  {r.mitigation && <p className="text-xs text-slate-400 mt-0.5">→ {r.mitigation}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {report.client_pending?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-semibold text-slate-700">Pendências Cliente</p>
            </div>
            {report.client_pending.map((p, i) => (
              <div key={i} className="text-xs text-slate-600 py-1.5 border-b border-slate-50 last:border-0">
                <p className="font-medium">{p.item}</p>
                <p className="text-slate-400">{p.responsible} · prazo {formatDate(p.deadline)}</p>
              </div>
            ))}
          </div>
        )}
        {report.internal_pending?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold text-slate-700">Pendências Internas</p>
            </div>
            {report.internal_pending.map((p, i) => (
              <div key={i} className="text-xs text-slate-600 py-1.5 border-b border-slate-50 last:border-0">
                <p className="font-medium">{p.item}</p>
                <p className="text-slate-400">{p.responsible} · prazo {formatDate(p.deadline)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {report.next_agenda && (
        <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-3">
          <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">Próxima agenda — {formatDate(report.next_agenda_date)}</p>
            <p className="text-sm text-slate-700">{report.next_agenda}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleSummary({ activities }) {
  if (!activities || activities.length === 0) return null;
  const total = activities.length;
  const done = activities.filter(a => a.status === "Concluído").length;
  const inProgress = activities.filter(a => a.status === "Em andamento").length;
  const delayed = activities.filter(a => a.status === "Atrasado").length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Progresso do Cronograma</h3>
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-sm text-slate-600">Conclusão geral das atividades</span>
          <span className="text-sm font-bold text-slate-700">{pct}%</span>
        </div>
        <ProgressBar value={pct} showLabel={false} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <p className="text-lg font-bold text-green-700">{done}</p>
          <p className="text-xs text-green-500">Concluídas</p>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <p className="text-lg font-bold text-blue-700">{inProgress}</p>
          <p className="text-xs text-blue-500">Em andamento</p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <p className="text-lg font-bold text-red-700">{delayed}</p>
          <p className="text-xs text-red-500">Atrasadas</p>
        </div>
      </div>
    </div>
  );
}

export default function StatusReportTab({ reports, projectId, projectClientName, activities, onRefresh }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <ScheduleSummary activities={activities} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Status Reports</h2>
          <p className="text-sm text-slate-400">{reports.length} report{reports.length !== 1 ? "s" : ""} registrado{reports.length !== 1 ? "s" : ""}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Report
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <NewReportForm projectId={projectId} onSave={() => { setShowForm(false); onRefresh(); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="space-y-4">
        {reports.sort((a, b) => new Date(b.report_date) - new Date(a.report_date)).map(r => (
          <ReportCard key={r.id || r.report_date} report={r} />
        ))}
        {reports.length === 0 && !showForm && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Nenhum status report registrado.</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-blue-600 hover:underline">Criar o primeiro report</button>
          </div>
        )}
      </div>

    </div>
  );
}