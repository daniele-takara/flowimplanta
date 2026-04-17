import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import { Save, FileText, Download, Info } from "lucide-react";

function deriveDeliverables(project) {
  const deliverables = [];
  const modules = project.contracted_modules || [];
  const services = project.contracted_services || [];

  if (modules.includes("Ponto Eletrônico")) deliverables.push("Implantação e parametrização do módulo de Ponto Eletrônico");
  if (modules.includes("Banco de Horas")) deliverables.push("Configuração do módulo de Banco de Horas");
  if (modules.includes("Escala")) deliverables.push("Configuração do módulo de Gestão de Escalas");
  if (modules.includes("Controle de Custos")) deliverables.push("Parametrização do módulo de Controle de Custos");
  if (modules.includes("App Mobile")) deliverables.push("Habilitação do App Mobile para colaboradores");
  if (modules.includes("REP-C") || modules.includes("REP-A")) deliverables.push("Configuração de dispositivos REP");
  if (services.some(s => s.includes("Sankhya"))) deliverables.push("Integração com folha de pagamento Sankhya MGE");
  if (services.some(s => s.includes("Treinamento"))) deliverables.push("Treinamento de gestores e usuários finais");
  if (services.some(s => s.includes("Parametrização"))) deliverables.push("Parametrização de cálculos e regras trabalhistas");
  deliverables.push("Realização de homologação com validação pelo cliente");
  deliverables.push("Go-live e suporte no período inicial de operação");
  return deliverables;
}

function InfoBlock({ label, value }) {
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0 grid grid-cols-3 gap-2">
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <span className="col-span-2 text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

export default function TAPTab({ project, scopeItems, documents, projectId, onRefresh }) {
  const tap = documents?.find(d => d.doc_type === "TAP") || null;
  const [editing, setEditing] = useState(!tap);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    objective: tap?.objective || `Implantar o sistema Pontotel de controle de ponto e jornada de trabalho na empresa ${project?.client_name || ""}, garantindo aderência às normas trabalhistas vigentes.`,
    scope_description: tap?.scope_description || (project?.contracted_modules || []).join(", "),
    out_of_scope: tap?.out_of_scope || "Desenvolvimento de funcionalidades customizadas não previstas em contrato. Integração com sistemas além dos especificados.",
    assumptions: tap?.assumptions || "Cliente disponibilizará equipe dedicada. Acesso aos ambientes necessários será fornecido no prazo. Dados de cadastro serão fornecidos conforme template.",
    restrictions: tap?.restrictions || `Prazo máximo definido: ${formatDate(project?.planned_end_date)}. Escopo limitado aos módulos contratados.`,
    risks_summary: tap?.risks_summary || "Atraso no fornecimento de dados pelo cliente. Indisponibilidade de acesso a ambientes. Mudanças de escopo durante a implantação.",
    success_criteria: tap?.success_criteria || "100% dos funcionários cadastrados. Sistema operando em produção. Integração validada. Equipe treinada.",
    sign_date: tap?.sign_date || project?.start_date || "",
    signed_by_client: tap?.signed_by_client || project?.sponsor_name || "",
    signed_by_pontotel: tap?.signed_by_pontotel || project?.pontotel_manager_name || "",
    additional_notes: tap?.additional_notes || project?.observations || ""
  });

  const deliverables = deriveDeliverables(project || {});
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, project_id: projectId, doc_type: "TAP", deliverables };
    if (tap?.id) {
      await base44.entities.ProjectDocument.update(tap.id, payload);
    } else {
      await base44.entities.ProjectDocument.create(payload);
    }
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const handleExportPDF = () => {
    const content = buildPDFContent(project, form, deliverables);
    const w = window.open('', '_blank');
    w.document.write(content);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Termo de Abertura do Projeto (TAP)</h2>
          <p className="text-sm text-slate-400">Preenchido automaticamente com base nos Dados Iniciais e Escopo Técnico</p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              <Download className="w-4 h-4" />Exportar PDF
            </button>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <FileText className="w-4 h-4" />Editar TAP
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar TAP"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-5 text-sm text-blue-700">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Campos pré-preenchidos com base nos Dados Iniciais e Escopo Técnico. Revise e ajuste conforme necessário.</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Identificação do Projeto</h3>
        <InfoBlock label="Projeto" value={project?.name} />
        <InfoBlock label="Cliente" value={project?.client_name} />
        <InfoBlock label="Tipo de Implantação" value={project?.implantation_type} />
        <InfoBlock label="Data de Início" value={formatDate(project?.start_date)} />
        <InfoBlock label="Prazo Previsto" value={formatDate(project?.planned_end_date)} />
        <InfoBlock label="MRR" value={project?.mrr ? `R$ ${Number(project.mrr).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
        <InfoBlock label="Gerente Pontotel" value={`${project?.pontotel_manager_name || ""}${project?.pontotel_manager_contact ? ` · ${project.pontotel_manager_contact}` : ""}`} />
        <InfoBlock label="Patrocinador Cliente" value={`${project?.sponsor_name || ""}${project?.sponsor_contact ? ` · ${project.sponsor_contact}` : ""}`} />
        <InfoBlock label="Líder do Projeto" value={`${project?.project_leader_name || ""}${project?.project_leader_contact ? ` · ${project.project_leader_contact}` : ""}`} />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Objetivo</h3>
          {editing ? <textarea className={inputClass} rows={3} value={form.objective} onChange={e => set("objective", e.target.value)} /> : <p className="text-sm text-slate-700">{form.objective || "—"}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Escopo</h3>
            {editing ? <textarea className={inputClass} rows={4} value={form.scope_description} onChange={e => set("scope_description", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.scope_description || "—"}</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Fora do Escopo</h3>
            {editing ? <textarea className={inputClass} rows={4} value={form.out_of_scope} onChange={e => set("out_of_scope", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.out_of_scope || "—"}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Entregáveis
            <span className="ml-2 text-blue-500 normal-case font-normal text-xs">auto-gerado com base nos módulos contratados</span>
          </h3>
          <ul className="space-y-2">
            {deliverables.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Premissas</h3>
            {editing ? <textarea className={inputClass} rows={4} value={form.assumptions} onChange={e => set("assumptions", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.assumptions || "—"}</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Restrições</h3>
            {editing ? <textarea className={inputClass} rows={4} value={form.restrictions} onChange={e => set("restrictions", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.restrictions || "—"}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumo de Riscos</h3>
            {editing ? <textarea className={inputClass} rows={3} value={form.risks_summary} onChange={e => set("risks_summary", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.risks_summary || "—"}</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Critérios de Sucesso</h3>
            {editing ? <textarea className={inputClass} rows={3} value={form.success_criteria} onChange={e => set("success_criteria", e.target.value)} /> : <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.success_criteria || "—"}</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Assinaturas</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Data de Assinatura</label>
              {editing ? <input type="date" className={inputClass} value={form.sign_date} onChange={e => set("sign_date", e.target.value)} /> : <p className="text-sm text-slate-700">{formatDate(form.sign_date)}</p>}
            </div>
            <div>
              <label className={labelClass}>Responsável Cliente</label>
              {editing ? <input className={inputClass} value={form.signed_by_client} onChange={e => set("signed_by_client", e.target.value)} /> : <p className="text-sm text-slate-700">{form.signed_by_client || "—"}</p>}
            </div>
            <div>
              <label className={labelClass}>Responsável Pontotel</label>
              {editing ? <input className={inputClass} value={form.signed_by_pontotel} onChange={e => set("signed_by_pontotel", e.target.value)} /> : <p className="text-sm text-slate-700">{form.signed_by_pontotel || "—"}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildPDFContent(project, form, deliverables) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>TAP – ${project?.name}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:40px;line-height:1.6}
  h1{font-size:20px;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
  h2{font-size:14px;color:#334155;background:#f1f5f9;padding:6px 10px;margin-top:20px;border-left:3px solid #1e40af}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  td:first-child{color:#64748b;width:35%;font-weight:600}
  ul{padding-left:20px}li{margin-bottom:4px}
  .footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px}
  .sig-box{border:1px solid #cbd5e1;padding:20px;border-radius:4px;text-align:center}
  @media print{body{margin:20px}}
</style></head>
<body>
<h1>Termo de Abertura do Projeto (TAP)</h1>
<h2>Identificação do Projeto</h2>
<table>
  <tr><td>Projeto</td><td>${project?.name||'—'}</td></tr>
  <tr><td>Cliente</td><td>${project?.client_name||'—'}</td></tr>
  <tr><td>Tipo de Implantação</td><td>${project?.implantation_type||'—'}</td></tr>
  <tr><td>Data de Início</td><td>${project?.start_date||'—'}</td></tr>
  <tr><td>Prazo Previsto</td><td>${project?.planned_end_date||'—'}</td></tr>
  <tr><td>Gerente Pontotel</td><td>${project?.pontotel_manager_name||'—'}</td></tr>
  <tr><td>Patrocinador Cliente</td><td>${project?.sponsor_name||'—'}</td></tr>
  <tr><td>Líder do Projeto</td><td>${project?.project_leader_name||'—'}</td></tr>
</table>
<h2>Objetivo</h2><p>${form.objective||'—'}</p>
<h2>Escopo</h2><p>${form.scope_description||'—'}</p>
<h2>Fora do Escopo</h2><p>${form.out_of_scope||'—'}</p>
<h2>Entregáveis</h2><ul>${deliverables.map(d=>`<li>${d}</li>`).join('')}</ul>
<h2>Premissas</h2><p>${form.assumptions||'—'}</p>
<h2>Restrições</h2><p>${form.restrictions||'—'}</p>
<h2>Resumo de Riscos</h2><p>${form.risks_summary||'—'}</p>
<h2>Critérios de Sucesso</h2><p>${form.success_criteria||'—'}</p>
<div class="footer">
  <h2>Assinaturas</h2>
  <p>Data: ${form.sign_date||'___/___/______'}</p>
  <div style="display:flex;gap:40px;margin-top:20px">
    <div class="sig-box" style="flex:1"><p>_______________________________</p><p>${form.signed_by_client||'Responsável Cliente'}</p></div>
    <div class="sig-box" style="flex:1"><p>_______________________________</p><p>${form.signed_by_pontotel||'Responsável Pontotel'}</p></div>
  </div>
</div>
</body></html>`;
}