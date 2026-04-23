import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// TAPTab — Termo de Abertura do Projeto (TAP)
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import { Download, FileText, Pencil, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  buildParticipants, buildDatas, buildModulosStatus,
  buildEntregas, FASES_MACRO, getAnswer
} from "@/lib/tapTemplate";

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      map[key] = item.answer || "";
    }
  });
  return map;
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-slate-200" />
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{children}</h2>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="col-span-2 text-xs font-medium text-slate-400">{label}</span>
      <span className="col-span-3 text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

function EditableText({ value, onChange, rows = 3, editing }) {
  if (!editing) return <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value || "—"}</p>;
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
    />
  );
}

function SaveStatus({ status }) {
  if (!status) return null;
  if (status === "saving") return <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 animate-spin" />Salvando...</span>;
  if (status === "saved") return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Salvo</span>;
  if (status === "error") return <span className="text-xs text-red-500 flex items-center gap-1"><XCircle className="w-3 h-3" />Erro ao salvar</span>;
  return null;
}

// ── PDF ─────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function generatePDF(project, form, answersMap, participants, datas, modulos, entregas) {
  const nome = project?.name || "Projeto";
  const grouped = {};
  entregas.forEach(e => {
    if (!grouped[e.grupo]) grouped[e.grupo] = [];
    grouped[e.grupo].push(e.label);
  });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>TAP – ${esc(nome)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1e293b; padding: 40px; line-height: 1.6; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #1e40af; }
  .header .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 11px; }
  td.lbl { color: #64748b; width: 38%; font-weight: 600; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
  .card h3 { font-size: 11px; font-weight: bold; margin-bottom: 6px; color: #334155; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-right: 4px; }
  .tag-ok { background: #dcfce7; color: #166534; }
  .tag-no { background: #f1f5f9; color: #94a3b8; }
  .entrega-grupo { font-size: 11px; font-weight: bold; color: #1e40af; margin: 10px 0 4px; }
  ul.items { padding-left: 16px; }
  ul.items li { margin-bottom: 3px; font-size: 11px; }
  .fase-row { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .fase-badge { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; }
  .conclusao { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px; font-size: 11px; color: #1e3a5f; border-radius: 0 6px 6px 0; }
  .sig { display: flex; gap: 40px; margin-top: 20px; }
  .sig-box { flex: 1; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; padding: 20px 12px; }
  .sig-box .line { border-top: 1px solid #334155; margin: 24px auto 6px; width: 80%; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="header">
  <h1>Termo de Abertura do Projeto (TAP)</h1>
  <div class="meta">${esc(project?.client_name)} · ${esc(project?.implantation_type)} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
</div>

<div class="section">
  <div class="section-title">1. Identificação do Projeto</div>
  <table>
    <tr><td class="lbl">Projeto</td><td>${esc(project?.name)}</td></tr>
    <tr><td class="lbl">Cliente</td><td>${esc(project?.client_name)}</td></tr>
    <tr><td class="lbl">Tipo de Implantação</td><td>${esc(project?.implantation_type)}</td></tr>
    <tr><td class="lbl">Data de Início</td><td>${esc(formatDate(project?.start_date))}</td></tr>
    <tr><td class="lbl">Prazo Previsto</td><td>${esc(formatDate(project?.planned_end_date))}</td></tr>
    <tr><td class="lbl">MRR</td><td>${project?.mrr ? `R$ ${Number(project.mrr).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">2. Objetivo</div>
  <p>${esc(form.objetivo)}</p>
</div>

<div class="section">
  <div class="section-title">3. Participantes</div>
  <table>
    ${participants.map(p => `<tr><td class="lbl">${esc(p.role)}</td><td>${esc(p.name)}${p.contact ? ` · ${esc(p.contact)}` : ""}</td></tr>`).join("")}
  </table>
</div>

<div class="section">
  <div class="section-title">4. Condições Gerais</div>
  <div class="card"><h3>Dimensão do Projeto</h3>
    <table>
      <tr><td class="lbl">Nº Funcionários Contratados</td><td>${esc(project?.contracted_employees || getAnswer(answersMap, "q001"))}</td></tr>
      <tr><td class="lbl">Operações / Filiais</td><td>${esc(getAnswer(answersMap, "q002") || "—")}</td></tr>
      <tr><td class="lbl">Tipo de Implantação</td><td>${esc(project?.implantation_type)}</td></tr>
    </table>
  </div>
  <div class="card"><h3>Datas Importantes</h3>
    <table>
      <tr><td class="lbl">Início do Projeto</td><td>${esc(formatDate(datas.inicio))}</td></tr>
      <tr><td class="lbl">Prazo Previsto</td><td>${esc(formatDate(datas.prazo))}</td></tr>
      <tr><td class="lbl">Período de Apuração</td><td>${esc(datas.periodo_apuracao) || "—"}</td></tr>
      <tr><td class="lbl">Período de Folha de Pagamento</td><td>${esc(datas.periodo_folha) || "—"}</td></tr>
      <tr><td class="lbl">Período de Fechamento</td><td>${esc(datas.periodo_fechamento) || "—"}</td></tr>
      <tr><td class="lbl">Prazo Envio Contabilidade</td><td>${datas.prazo_contabilidade ? `Dia ${esc(datas.prazo_contabilidade)}` : "—"}</td></tr>
      <tr><td class="lbl">Data de Pagamento</td><td>${datas.data_pagamento ? `Dia ${esc(datas.data_pagamento)}` : "—"}</td></tr>
      <tr><td class="lbl">Sistema de Folha</td><td>${esc(datas.sistema_folha) || "—"}</td></tr>
    </table>
  </div>
  <div class="card"><h3>Módulos e Serviços</h3>
    ${modulos.map(m => `<span class="tag ${m.contratado ? "tag-ok" : "tag-no"}">${esc(m.nome)}</span>`).join(" ")}
  </div>
</div>

<div class="section">
  <div class="section-title">5. Entregas Previstas</div>
  ${Object.entries(grouped).map(([grupo, items]) => `
    <div class="entrega-grupo">${esc(grupo)}</div>
    <ul class="items">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
  `).join("")}
</div>

<div class="section">
  <div class="section-title">6. Cronograma Macro</div>
  ${FASES_MACRO.map(f => `
    <div class="fase-row">
      <span class="fase-badge">${esc(f.fase)}</span>
      <span>${esc(f.descricao)}</span>
    </div>
  `).join("")}
</div>

<div class="section">
  <div class="section-title">7. Premissas e Restrições</div>
  <div class="card"><h3>Premissas</h3><p>${esc(form.premissas)}</p></div>
  <div class="card"><h3>Restrições</h3><p>${esc(form.restricoes)}</p></div>
</div>

<div class="section">
  <div class="section-title">8. Conclusão</div>
  <div class="conclusao">${esc(form.conclusao)}</div>
</div>

<div class="section">
  <div class="section-title">9. Assinaturas</div>
  <p>Data de Assinatura: ${esc(formatDate(form.data_assinatura)) || "___/___/______"}</p>
  <div class="sig">
    <div class="sig-box"><div class="line"></div><strong>${esc(form.assinatura_cliente) || "Responsável Cliente"}</strong><br><small>Patrocinador / Responsável</small></div>
    <div class="sig-box"><div class="line"></div><strong>${esc(form.assinatura_pontotel) || "Responsável Pontotel"}</strong><br><small>Gerente de Projeto Pontotel</small></div>
  </div>
</div>
</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const DEBOUNCE_MS = 1500;

export default function TAPTab({ project, scopeItems, documents, projectId, onRefresh }) {
  const tap = documents?.find(d => d.doc_type === "TAP") || null;
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);

  // Constrói mapa de respostas do escopo
  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);

  // Dados computados automaticamente
  const participants = useMemo(() => buildParticipants(project || {}), [project]);
  const datas = useMemo(() => buildDatas(project || {}, answersMap), [project, answersMap]);
  const modulos = useMemo(() => buildModulosStatus(project || {}), [project]);
  const entregas = useMemo(() => buildEntregas(answersMap, project || {}), [answersMap, project]);

  // Textos editáveis (com auto-geração inicial baseada no projeto + escopo)
  const defaultForm = useMemo(() => ({
    objetivo: `Implantar o sistema Pontotel de controle de ponto e jornada de trabalho na empresa ${project?.client_name || ""}, garantindo aderência às normas trabalhistas vigentes e proporcionando maior controle, eficiência e transparência nos processos de registro e tratamento de ponto.`,
    premissas: `• O cliente disponibilizará equipe dedicada durante toda a implantação.\n• Acesso aos ambientes e sistemas necessários será fornecido nos prazos acordados.\n• Dados de cadastro de colaboradores serão fornecidos conforme template Pontotel.\n• Infraestrutura de rede estará disponível nos locais de registro de ponto.\n• Decisões de escopo não previstas em contrato serão tratadas como adendum.`,
    restricoes: `• Prazo máximo de implantação definido: ${formatDate(project?.planned_end_date) || "a definir"}.\n• Escopo limitado aos módulos e serviços contratados.\n• Customizações não previstas em contrato estão fora do escopo deste projeto.\n• Integrações com sistemas além dos especificados não fazem parte da entrega.`,
    conclusao: `O presente Termo de Abertura do Projeto formaliza o início da implantação do sistema Pontotel na empresa ${project?.client_name || ""}, estabelecendo os objetivos, participantes, entregas e condições acordadas entre as partes. A execução está condicionada ao cumprimento das premissas e responsabilidades definidas, visando garantir o sucesso da implantação dentro do prazo e escopo contratados.`,
    data_assinatura: project?.start_date || "",
    assinatura_cliente: project?.sponsor_name || "",
    assinatura_pontotel: project?.pontotel_manager_name || "",
  }), [project]);

  const [form, setForm] = useState(() => ({
    objetivo: tap?.objective || defaultForm.objetivo,
    premissas: tap?.assumptions || defaultForm.premissas,
    restricoes: tap?.restrictions || defaultForm.restricoes,
    conclusao: tap?.closure_summary || defaultForm.conclusao,
    data_assinatura: tap?.sign_date || defaultForm.data_assinatura,
    assinatura_cliente: tap?.signed_by_client || defaultForm.assinatura_cliente,
    assinatura_pontotel: tap?.signed_by_pontotel || defaultForm.assinatura_pontotel,
  }));

  // Atualiza form quando documentos carregam
  useEffect(() => {
    if (tap) {
      setForm({
        objetivo: tap.objective || defaultForm.objetivo,
        premissas: tap.assumptions || defaultForm.premissas,
        restricoes: tap.restrictions || defaultForm.restricoes,
        conclusao: tap.closure_summary || defaultForm.conclusao,
        data_assinatura: tap.sign_date || defaultForm.data_assinatura,
        assinatura_cliente: tap.signed_by_client || defaultForm.assinatura_cliente,
        assinatura_pontotel: tap.signed_by_pontotel || defaultForm.assinatura_pontotel,
      });
    }
  }, [tap?.id]);

  const triggerSave = useCallback(async (currentForm) => {
    setSaveStatus("saving");
    const payload = {
      project_id: projectId,
      doc_type: "TAP",
      objective: currentForm.objetivo,
      assumptions: currentForm.premissas,
      restrictions: currentForm.restricoes,
      closure_summary: currentForm.conclusao,
      sign_date: currentForm.data_assinatura,
      signed_by_client: currentForm.assinatura_cliente,
      signed_by_pontotel: currentForm.assinatura_pontotel,
      deliverables: entregas.map(e => e.label),
    };
    try {
      if (tap?.id) {
        await base44.entities.ProjectDocument.update(tap.id, payload);
      } else {
        await base44.entities.ProjectDocument.create(payload);
        onRefresh();
      }
      setSaveStatus("saved");
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
    }
  }, [tap?.id, projectId, entregas, onRefresh]);

  const setField = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSave(next), DEBOUNCE_MS);
  };

  const handleBlurSave = () => {
    clearTimeout(debounceRef.current);
    triggerSave(form);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none";

  // Agrupa entregas por grupo para exibição
  const entregasGrouped = useMemo(() => {
    const g = {};
    entregas.forEach(e => {
      if (!g[e.grupo]) g[e.grupo] = [];
      g[e.grupo].push(e.label);
    });
    return Object.entries(g);
  }, [entregas]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Termo de Abertura do Projeto (TAP)</h2>
          <p className="text-sm text-slate-400">Gerado automaticamente com base nos dados e escopo do projeto</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} />
          <button
            onClick={() => setEditing(e => !e)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${editing ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Pencil className="w-4 h-4" />{editing ? "Editar ativo" : "Editar"}
          </button>
          <button
            onClick={() => generatePDF(project, form, answersMap, participants, datas, modulos, entregas)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Download className="w-4 h-4" />Gerar TAP em PDF
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Cabeçalho do documento */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-8 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">Pontotel · Implantação</p>
          <h1 className="text-xl font-bold">Termo de Abertura do Projeto</h1>
          <p className="text-sm text-blue-200 mt-1">{project?.client_name} · {project?.implantation_type}</p>
        </div>

        <div className="p-8 space-y-8">

          {/* 1. Identificação */}
          <section>
            <SectionTitle>1. Identificação do Projeto</SectionTitle>
            <div className="bg-slate-50 rounded-lg p-4">
              <Row label="Projeto" value={project?.name} />
              <Row label="Cliente" value={project?.client_name} />
              <Row label="Origem" value={project?.origin} />
              <Row label="Tipo de Implantação" value={project?.implantation_type} />
              <Row label="Data de Início" value={formatDate(project?.start_date)} />
              <Row label="Prazo Previsto" value={formatDate(project?.planned_end_date)} />
              {project?.mrr && <Row label="MRR" value={`R$ ${Number(project.mrr).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />}
            </div>
          </section>

          {/* 2. Objetivo */}
          <section>
            <SectionTitle>2. Objetivo</SectionTitle>
            <div className={editing ? "" : "bg-slate-50 rounded-lg p-4"}>
              {editing ? (
                <textarea
                  value={form.objetivo}
                  onChange={e => setField("objetivo", e.target.value)}
                  onBlur={handleBlurSave}
                  rows={4}
                  className={inputClass}
                />
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed">{form.objetivo}</p>
              )}
            </div>
          </section>

          {/* 3. Participantes */}
          <section>
            <SectionTitle>3. Participantes</SectionTitle>
            {participants.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum participante cadastrado nos Dados Iniciais do projeto.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map((p, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">{p.role}</p>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    {p.contact && <p className="text-xs text-slate-400 mt-0.5">{p.contact}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Condições Gerais */}
          <section>
            <SectionTitle>4. Condições Gerais</SectionTitle>

            {/* Dimensão */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Dimensão do Projeto</p>
              <div className="bg-slate-50 rounded-lg p-4">
                <Row label="Nº de Funcionários Contratados" value={project?.contracted_employees || getAnswer(answersMap, "q001")} />
                <Row label="Operações / Municípios / Estados" value={getAnswer(answersMap, "q002")} />
                <Row label="Tipo de Implantação" value={project?.implantation_type} />
              </div>
            </div>

            {/* Datas */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Datas Importantes</p>
              <div className="bg-slate-50 rounded-lg p-4">
                <Row label="Início do Projeto" value={formatDate(datas.inicio)} />
                <Row label="Prazo Previsto" value={formatDate(datas.prazo)} />
                <Row label="Período de Apuração do Ponto" value={datas.periodo_apuracao} />
                <Row label="Período de Folha de Pagamento" value={datas.periodo_folha} />
                <Row label="Período de Fechamento" value={datas.periodo_fechamento} />
                <Row label="Prazo Envio Contabilidade" value={datas.prazo_contabilidade ? `Dia ${datas.prazo_contabilidade}` : null} />
                <Row label="Data de Pagamento" value={datas.data_pagamento ? `Dia ${datas.data_pagamento}` : null} />
                <Row label="Sistema de Folha de Pagamento" value={datas.sistema_folha} />
              </div>
            </div>

            {/* Módulos e Serviços */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Módulos e Serviços</p>
              <div className="flex flex-wrap gap-2">
                {modulos.map((m, i) => (
                  <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${m.contratado ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                    {m.contratado ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {m.nome}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5. Entregas Previstas */}
          <section>
            <SectionTitle>5. Entregas Previstas</SectionTitle>
            <div className="border border-blue-100 rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700">
                  {entregas.length} entrega{entregas.length !== 1 ? "s" : ""} gerada{entregas.length !== 1 ? "s" : ""} automaticamente com base no escopo
                </p>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="p-4 space-y-4">
                {entregasGrouped.map(([grupo, items]) => (
                  <div key={grupo}>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 border-b border-blue-50 pb-1">{grupo}</p>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Cronograma Macro */}
          <section>
            <SectionTitle>6. Cronograma Macro</SectionTitle>
            <div className="space-y-2">
              {FASES_MACRO.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full whitespace-nowrap shrink-0">{f.fase}</span>
                  <p className="text-sm text-slate-600">{f.descricao}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Premissas e Restrições */}
          <section>
            <SectionTitle>7. Premissas e Restrições</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Premissas</p>
                {editing ? (
                  <textarea value={form.premissas} onChange={e => setField("premissas", e.target.value)} onBlur={handleBlurSave} rows={6} className={inputClass} />
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{form.premissas}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Restrições</p>
                {editing ? (
                  <textarea value={form.restricoes} onChange={e => setField("restricoes", e.target.value)} onBlur={handleBlurSave} rows={6} className={inputClass} />
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{form.restricoes}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 8. Conclusão */}
          <section>
            <SectionTitle>8. Conclusão</SectionTitle>
            <div className={editing ? "" : "border-l-4 border-blue-400 bg-blue-50 rounded-r-lg p-4"}>
              {editing ? (
                <textarea value={form.conclusao} onChange={e => setField("conclusao", e.target.value)} onBlur={handleBlurSave} rows={3} className={inputClass} />
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed">{form.conclusao}</p>
              )}
            </div>
          </section>

          {/* 9. Assinaturas */}
          <section>
            <SectionTitle>9. Assinaturas</SectionTitle>
            {editing && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data de Assinatura</label>
                  <input type="date" value={form.data_assinatura} onChange={e => setField("data_assinatura", e.target.value)} onBlur={handleBlurSave}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Responsável Cliente</label>
                  <input value={form.assinatura_cliente} onChange={e => setField("assinatura_cliente", e.target.value)} onBlur={handleBlurSave}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Responsável Pontotel</label>
                  <input value={form.assinatura_pontotel} onChange={e => setField("assinatura_pontotel", e.target.value)} onBlur={handleBlurSave}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
            {form.data_assinatura && (
              <p className="text-sm text-slate-500 mb-4">Data de assinatura: <strong>{formatDate(form.data_assinatura)}</strong></p>
            )}
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center border border-slate-200 rounded-lg p-6">
                <div className="h-12 border-b border-dashed border-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{form.assinatura_cliente || "Responsável Cliente"}</p>
                <p className="text-xs text-slate-400">Patrocinador / Responsável pelo Projeto</p>
              </div>
              <div className="text-center border border-slate-200 rounded-lg p-6">
                <div className="h-12 border-b border-dashed border-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{form.assinatura_pontotel || "Responsável Pontotel"}</p>
                <p className="text-xs text-slate-400">Gerente de Projeto — Pontotel</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}