import { useState } from "react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import { Save, FileCheck, Download } from "lucide-react";

const STATUS_OPTIONS = ["Concluído com sucesso", "Concluído parcialmente", "Cancelado"];

function InfoBlock({ label, value }) {
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0 grid grid-cols-3 gap-2">
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <span className="col-span-2 text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

export default function ClosureTab({ project, documents, activities, projectId, onRefresh }) {
  const closure = documents?.find(d => d.doc_type === "Termo de Encerramento") || null;

  // Derive summary stats from activities
  const totalActivities = activities?.length || 0;
  const doneActivities = activities?.filter(a => a.status === "Concluído").length || 0;
  const completionRate = totalActivities > 0 ? Math.round((doneActivities / totalActivities) * 100) : 0;

  const [editing, setEditing] = useState(!closure);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    final_status: closure?.final_status || "Concluído com sucesso",
    closure_summary: closure?.closure_summary || `O projeto de implantação do sistema Pontotel na empresa ${project?.client_name || ""} foi concluído. O sistema está operacional e os usuários foram treinados.`,
    success_criteria: closure?.success_criteria || "100% dos funcionários cadastrados. Sistema operando em produção. Equipe treinada.",
    lessons_learned: closure?.lessons_learned || "",
    sign_date: closure?.sign_date || new Date().toISOString().split("T")[0],
    signed_by_client: closure?.signed_by_client || project?.sponsor_name || "",
    signed_by_pontotel: closure?.signed_by_pontotel || project?.pontotel_manager_name || "",
    additional_notes: closure?.additional_notes || ""
  });

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, project_id: projectId, doc_type: "Termo de Encerramento" };
    if (closure?.id) {
      await base44.entities.ProjectDocument.update(closure.id, payload);
    } else {
      await base44.entities.ProjectDocument.create(payload);
    }
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const handleExportPDF = () => {
    const content = buildPDFContent(project, form, completionRate, doneActivities, totalActivities);
    const w = window.open('', '_blank');
    w.document.write(content);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

  const statusColor = { "Concluído com sucesso": "bg-green-100 text-green-700", "Concluído parcialmente": "bg-yellow-100 text-yellow-700", "Cancelado": "bg-red-100 text-red-700" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Termo de Encerramento</h2>
          <p className="text-sm text-slate-400">Documento formal de encerramento do projeto</p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              <Download className="w-4 h-4" />Exportar PDF
            </button>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <FileCheck className="w-4 h-4" />Editar Termo
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar Termo"}
            </button>
          )}
        </div>
      </div>

      {/* Summary stats from schedule */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{completionRate}%</p>
          <p className="text-xs text-slate-400 mt-1">Conclusão do Cronograma</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{doneActivities}</p>
          <p className="text-xs text-slate-400 mt-1">Atividades Concluídas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{totalActivities}</p>
          <p className="text-xs text-slate-400 mt-1">Total de Atividades</p>
        </div>
      </div>

      {/* Identification */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Identificação do Projeto</h3>
        <InfoBlock label="Projeto" value={project?.name} />
        <InfoBlock label="Cliente" value={project?.client_name} />
        <InfoBlock label="Data de Início" value={formatDate(project?.start_date)} />
        <InfoBlock label="Data de Conclusão" value={formatDate(project?.aligned_end_date || project?.planned_end_date)} />
        <InfoBlock label="Gerente Pontotel" value={project?.pontotel_manager_name} />
        <div className="pt-2">
          <span className="text-sm text-slate-400 font-medium">Status Final</span>
          {editing ? (
            <select className={`${inputClass} mt-1`} value={form.final_status} onChange={e => set("final_status", e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <div className="mt-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[form.final_status] || "bg-slate-100 text-slate-600"}`}>{form.final_status}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumo de Encerramento</h3>
          {editing
            ? <textarea className={inputClass} rows={4} value={form.closure_summary} onChange={e => set("closure_summary", e.target.value)} placeholder="Descreva como o projeto foi concluído..." />
            : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.closure_summary || "—"}</p>
          }
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Critérios de Sucesso Atingidos</h3>
            {editing
              ? <textarea className={inputClass} rows={4} value={form.success_criteria} onChange={e => set("success_criteria", e.target.value)} />
              : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.success_criteria || "—"}</p>
            }
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lições Aprendidas</h3>
            {editing
              ? <textarea className={inputClass} rows={4} value={form.lessons_learned} onChange={e => set("lessons_learned", e.target.value)} placeholder="O que funcionou bem? O que pode ser melhorado?" />
              : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.lessons_learned || "—"}</p>
            }
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Assinaturas de Encerramento</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Data de Encerramento</label>
              {editing
                ? <input type="date" className={inputClass} value={form.sign_date} onChange={e => set("sign_date", e.target.value)} />
                : <p className="text-sm text-slate-700">{formatDate(form.sign_date)}</p>
              }
            </div>
            <div>
              <label className={labelClass}>Aceite Cliente</label>
              {editing
                ? <input className={inputClass} value={form.signed_by_client} onChange={e => set("signed_by_client", e.target.value)} />
                : <p className="text-sm text-slate-700">{form.signed_by_client || "—"}</p>
              }
            </div>
            <div>
              <label className={labelClass}>Entrega Pontotel</label>
              {editing
                ? <input className={inputClass} value={form.signed_by_pontotel} onChange={e => set("signed_by_pontotel", e.target.value)} />
                : <p className="text-sm text-slate-700">{form.signed_by_pontotel || "—"}</p>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPDFContent(project, form, completionRate, done, total) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Termo de Encerramento – ${project?.name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 40px; line-height: 1.6; }
  h1 { font-size: 20px; color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 8px; }
  h2 { font-size: 14px; color: #334155; background: #f0fdf4; padding: 6px 10px; margin-top: 20px; border-left: 3px solid #16a34a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td:first-child { color: #64748b; width: 35%; font-weight: 600; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  .sig-box { border: 1px solid #cbd5e1; padding: 20px; border-radius: 4px; text-align: center; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Termo de Encerramento do Projeto</h1>

<h2>Identificação</h2>
<table>
  <tr><td>Projeto</td><td>${project?.name || '—'}</td></tr>
  <tr><td>Cliente</td><td>${project?.client_name || '—'}</td></tr>
  <tr><td>Status Final</td><td>${form.final_status}</td></tr>
  <tr><td>Data de Início</td><td>${project?.start_date || '—'}</td></tr>
  <tr><td>Data de Encerramento</td><td>${form.sign_date || '—'}</td></tr>
  <tr><td>Conclusão do Cronograma</td><td>${completionRate}% (${done} de ${total} atividades)</td></tr>
</table>

<h2>Resumo de Encerramento</h2>
<p>${form.closure_summary || '—'}</p>

<h2>Critérios de Sucesso Atingidos</h2>
<p>${form.success_criteria || '—'}</p>

<h2>Lições Aprendidas</h2>
<p>${form.lessons_learned || '—'}</p>

<div class="footer">
  <h2>Assinaturas</h2>
  <div style="display:flex; gap:40px; margin-top:20px;">
    <div class="sig-box" style="flex:1;"><p>_______________________________</p><p>${form.signed_by_client || 'Responsável Cliente'}</p><p>Aceite de Encerramento</p></div>
    <div class="sig-box" style="flex:1;"><p>_______________________________</p><p>${form.signed_by_pontotel || 'Responsável Pontotel'}</p><p>Entrega do Projeto</p></div>
  </div>
</div>
</body></html>`;
}