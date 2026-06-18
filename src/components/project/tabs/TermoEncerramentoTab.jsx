import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import { computeMacroSchedule } from "@/lib/scheduleReportEngine.js";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";
import {
  RefreshCw, Download, Plus, Trash2, Save, Clock, CheckCircle2,
  XCircle, Lock, Send, History, ChevronDown, ChevronUp, AlertCircle,
  FileSignature, Zap, Pencil
} from "lucide-react";
import { logAudit } from "@/lib/auditLog";
import { resolveAdendoVariables } from "@/lib/adendoVariables";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.order_number) {
      map[`q${String(item.order_number).padStart(3, "0")}`] = item.answer || "";
    }
  });
  return map;
}

const STATUS_VERSION_COLORS = {
  Rascunho: "bg-slate-100 text-slate-600 border-slate-200",
  Enviado: "bg-blue-50 text-blue-700 border-blue-200",
  Assinado: "bg-green-50 text-green-700 border-green-200",
};

function SaveStatus({ status }) {
  if (!status) return null;
  if (status === "saving") return <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 animate-spin" />Salvando...</span>;
  if (status === "saved") return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Salvo</span>;
  return null;
}

// ─── Gerador de PDF ───────────────────────────────────────────────────────────

function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"); }

// resolveAdendoContent agora usa a lib compartilhada adendoVariables.js
function resolveAdendoContent(content, project, usabilitySnap) {
  return resolveAdendoVariables(content, project, usabilitySnap);
}

function getPdfValue(key, autoRaw, overrides) {
  if (overrides?.[key] !== undefined) return overrides[key];
  return autoRaw != null ? String(autoRaw) : "";
}

function generateTermoPDF({ project, macroPhases, usabilitySnap, pendingItems, finalConsiderations, selectedAdendosData, scopeItems, version, coordenadora, liderImpl, gerente, sectionOverrides = {} }) {
  const answersMap = buildAnswersMap(scopeItems);
  const contracted = getPdfValue("contracted_employees", project?.contracted_employees, sectionOverrides) || "0";
  const cadastrados = getPdfValue("registered_employees", usabilitySnap?.numero_funcionarios, sectionOverrides) || "0";
  const aderenciaOverride = getPdfValue("adherence", null, sectionOverrides);
  const aderencia = aderenciaOverride || (parseInt(contracted) > 0 ? Math.round((parseInt(getPdfValue("recording_employees", usabilitySnap?.empregados_batendo_ponto_ultimos_15_dias, sectionOverrides) || "0") / parseInt(contracted)) * 100) : 0);
  const versionLabel = version ? `v${version.version_number} · ${version.status}` : "";
  const today = new Date().toLocaleDateString("pt-BR");
  const clientName = getPdfValue("client_name", project?.client_name, sectionOverrides);
  const implType = getPdfValue("implantation_type", project?.implantation_type, sectionOverrides);
  const progress = getPdfValue("progress_percent", project?.progress_percent, sectionOverrides);

  const scheduleRows = (macroPhases || []).map(ph => {
    const fmt = d => { if (!d) return "—"; const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; };
    const statusColor = ph.status === "Concluído" ? "#166534" : ph.status === "Em andamento" ? "#6d28d9" : ph.status === "Atrasado" ? "#991b1b" : "#64748b";
    return `<tr>
      <td>${esc(ph.phase)}</td>
      <td>${fmt(ph.plannedStart)}</td>
      <td>${fmt(ph.plannedEnd)}</td>
      <td>${fmt(ph.actualStart)}</td>
      <td>${fmt(ph.actualEnd)}</td>
      <td><span style="color:${statusColor};font-weight:600">${esc(ph.status)}</span></td>
      <td>${ph.progress}%</td>
    </tr>`;
  }).join("");

  const pendingRows = pendingItems && pendingItems.length > 0
    ? pendingItems.map(p => `<tr><td>${esc(p.item)}</td><td>${esc(p.responsible)}</td><td>${esc(p.deadline)}</td><td>${esc(p.action_plan)}</td></tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#64748b;font-style:italic">Não há pendências registradas</td></tr>`;

  const adendosHTML = selectedAdendosData && selectedAdendosData.length > 0
    ? selectedAdendosData.map((a, i) => {
        const resolvedContent = resolveAdendoContent(a.content, project, usabilitySnap);
        return `
      <div style="margin-bottom:18px;page-break-inside:avoid">
        <div style="background:#f8fafc;border-left:4px solid #1e40af;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:6px">
          <strong>${esc(a.title)}</strong>
          <span style="margin-left:8px;font-size:10px;color:#64748b">[${esc(a.type)}]</span>
        </div>
        <p style="font-size:11px;color:#334155;line-height:1.7;padding-left:18px">${esc(resolvedContent)}</p>
      </div>`;
      }).join("")
    : `<p style="color:#64748b;font-style:italic">Nenhum adendo selecionado.</p>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Termo de Encerramento – ${esc(clientName)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#1e293b; padding:40px; line-height:1.6; }
  .header { border-bottom:3px solid #7c3aed; padding-bottom:16px; margin-bottom:24px; display:flex; justify-content:space-between; }
  .header h1 { font-size:20px; color:#7c3aed; font-weight:bold; }
  .header .meta { font-size:10px; color:#64748b; margin-top:4px; }
  .version-badge { background:#f5f3ff; color:#7c3aed; border:1px solid #c4b5fd; padding:4px 10px; border-radius:12px; font-size:10px; font-weight:bold; }
  .section { margin-bottom:22px; page-break-inside:avoid; }
  .section-title { display:flex; align-items:center; gap:8px; font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:2px; color:#64748b; border-bottom:2px solid #e2e8f0; padding-bottom:5px; margin-bottom:10px; }
  .section-num { width:20px; height:20px; background:#7c3aed; color:white; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:9px; font-weight:bold; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  td, th { padding:5px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; font-size:10px; }
  th { background:#f8fafc; font-weight:700; color:#64748b; text-align:left; }
  td.lbl { color:#64748b; width:40%; font-weight:600; }
  .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; margin-bottom:8px; }
  .tag-ok { display:inline-block; padding:2px 8px; border-radius:12px; font-size:9px; font-weight:bold; background:#dcfce7; color:#166534; margin:2px; }
  .text-block { background:#f5f3ff; border-left:3px solid #7c3aed; padding:12px 14px; border-radius:0 6px 6px 0; font-size:11px; line-height:1.7; color:#334155; }
  .sig { display:flex; gap:40px; margin-top:30px; }
  .sig-box { flex:1; text-align:center; border:1px solid #cbd5e1; border-radius:6px; padding:30px 12px 12px; }
  .sig-box .line { border-top:1px solid #334155; margin:0 auto 8px; width:80%; }
  @media print { body { padding:20px; } }
</style></head><body>

<div class="header">
  <div>
    <h1>Termo de Encerramento do Projeto</h1>
    <div class="meta">${esc(clientName)} · ${esc(implType)} · Emitido em ${today}</div>
  </div>
  <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png" style="height:40px" alt="Pontotel" />
</div>

<div class="section">
  <div class="section-title">IDENTIFICAÇÃO DO PROJETO</div>
  <table>
    ${[
      [["Cliente", getPdfValue("client_name", project?.client_name, sectionOverrides)], ["Tipo de Implantação", getPdfValue("implantation_type", project?.implantation_type, sectionOverrides)]],
      [["Gerente Pontotel", getPdfValue("pontotel_manager_name", project?.pontotel_manager_name, sectionOverrides)], ["Analista", getPdfValue("pontotel_analyst_name", project?.pontotel_analyst_name, sectionOverrides)]],
      [["Líder do Projeto (Cliente)", getPdfValue("project_leader_name", project?.project_leader_name, sectionOverrides)], ["Patrocinador", getPdfValue("sponsor_name", project?.sponsor_name, sectionOverrides)]],
      [["Data de Início", getPdfValue("start_date", project?.start_date, sectionOverrides) ? fmtDate(getPdfValue("start_date", project?.start_date, sectionOverrides)) : null], ["Data de Encerramento", getPdfValue("end_date", project?.aligned_end_date || project?.planned_end_date, sectionOverrides) ? fmtDate(getPdfValue("end_date", project?.aligned_end_date || project?.planned_end_date, sectionOverrides)) : null]],
    ].filter(row => row[0][1] || row[1][1]).map(row => {
      const left = row[0][1] ? `<td class="lbl">${esc(row[0][0])}</td><td>${esc(row[0][1])}</td>` : "<td></td><td></td>";
      const right = row[1][1] ? `<td class="lbl">${esc(row[1][0])}</td><td>${esc(row[1][1])}</td>` : "<td></td><td></td>";
      return `<tr>${left}${right}</tr>`;
    }).join("")}
  </table>
</div>

<div class="section">
  <div class="section-title">RESUMO DO PROJETO</div>
  <div class="card">
    <table>
      ${[
        ["Funcionários Contratados", contracted ? parseInt(contracted).toLocaleString("pt-BR") : null],
        ["Funcionários Cadastrados", cadastrados ? parseInt(cadastrados).toLocaleString("pt-BR") : null],
        ["Aderência ao Registro de Ponto", contracted > 0 ? `<strong>${aderencia}%</strong>` : null],
        ["Progresso Geral do Projeto", progress ? `${progress}%` : null],
      ].filter(r => r[1]).map(r => `<tr><td class="lbl">${esc(r[0])}</td><td>${r[1]}</td></tr>`).join("")}
    </table>
  </div>
</div>

${(() => {
  const modulesOverride = getPdfValue("contracted_modules", (project?.contracted_modules || []).join(", "), sectionOverrides);
  const servicesOverride = getPdfValue("contracted_services", (project?.contracted_services || []).join(", "), sectionOverrides);
  const modulesList = modulesOverride ? modulesOverride.split(",").map(s => s.trim()).filter(Boolean) : [];
  const servicesList = servicesOverride ? servicesOverride.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (modulesList.length === 0 && servicesList.length === 0) return "";
  return `
<div class="section">
  <div class="section-title">ESCOPO CONTRATADO</div>
  ${modulesList.length > 0 ? `<div class="card"><strong style="font-size:10px">Módulos:</strong><br>${modulesList.map(m => `<span class="tag-ok">${esc(m)}</span>`).join("")}</div>` : ""}
  ${servicesList.length > 0 ? `<div class="card" style="margin-top:6px"><strong style="font-size:10px">Serviços:</strong><br>${servicesList.map(s => `<span class="tag-ok">${esc(s)}</span>`).join("")}</div>` : ""}
</div>`;
})()}

<div class="section">
  <div class="section-title">CRONOGRAMA PLANEJADO VS REALIZADO</div>
  <table>
    <tr><th>Etapa</th><th>Início Plan.</th><th>Fim Plan.</th><th>Início Real.</th><th>Fim Real.</th><th>Status</th><th>%</th></tr>
    ${scheduleRows || `<tr><td colspan="7" style="color:#94a3b8;text-align:center">Nenhuma fase calculada</td></tr>`}
  </table>
</div>

${pendingItems && pendingItems.length > 0 ? `
<div class="section">
  <div class="section-title">PENDÊNCIAS</div>
  <table>
    <tr><th>Pendência</th><th>Responsável</th><th>Prazo</th><th>Plano de Ação</th></tr>
    ${pendingRows}
  </table>
</div>` : ""}

${selectedAdendosData && selectedAdendosData.length > 0 ? `
<div class="section">
  <div class="section-title">ADENDOS</div>
  ${adendosHTML}
</div>` : ""}

${finalConsiderations ? `
<div class="section">
  <div class="section-title">CONSIDERAÇÕES FINAIS</div>
  <div class="text-block">${esc(finalConsiderations)}</div>
</div>` : ""}

<div class="section">
  <div class="section-title">ACEITE FORMAL</div>
  <p style="margin-bottom:16px;font-size:11px;color:#334155">
    Ao assinar este documento, as partes declaram estar de acordo com os termos e condições do encerramento do projeto de implantação da Pontotel para ${esc(clientName)}, confirmando que todas as atividades previstas foram concluídas conforme acordado.
  </p>
  <div class="sig">
    <div class="sig-box">
      <div class="line"></div>
      <strong>${esc(coordenadora?.name) || "Coordenadora de Implantação"}</strong><br>
      <span style="font-size:10px;color:#64748b">Pontotel · Coordenadora de implantação</span>
      ${coordenadora?.email ? `<br><span style="font-size:9px;color:#94a3b8">${esc(coordenadora.email)}</span>` : ""}
    </div>
    <div class="sig-box">
      <div class="line"></div>
      <strong>${esc(liderImpl?.name) || "Líder de Implantação"}</strong><br>
      <span style="font-size:10px;color:#64748b">Pontotel · Líder de implantação (testemunha)</span>
      ${liderImpl?.email ? `<br><span style="font-size:9px;color:#94a3b8">${esc(liderImpl.email)}</span>` : ""}
    </div>
    ${gerente ? `
    <div class="sig-box">
      <div class="line"></div>
      <strong>${esc(gerente.name) || "Gerente de Operações"}</strong><br>
      <span style="font-size:10px;color:#64748b">Pontotel · Gerente de Operações</span>
      ${gerente.email ? `<br><span style="font-size:9px;color:#94a3b8">${esc(gerente.email)}</span>` : ""}
    </div>` : ""}
    <div class="sig-box">
      <div class="line"></div>
      <strong>${esc(project?.project_leader_name) || "Líder do Projeto"}</strong><br>
      <span style="font-size:10px;color:#64748b">${esc(project?.client_name)} · Líder do Projeto</span>
      ${project?.project_leader_contact ? `<br><span style="font-size:9px;color:#94a3b8">${esc(project.project_leader_contact)}</span>` : ""}
    </div>
  </div>
</div>

</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TermoEncerramentoTab({ project, scopeItems, reports, savedActivities, projectId, readOnly = false, canEditAutoFields = false, canGeneratePDF = true }) {
  const [termos, setTermos] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loadingTermos, setLoadingTermos] = useState(true);
  const [adendosAll, setAdendosAll] = useState([]);
  const [assinaturasAll, setAssinaturasAll] = useState([]);
  const [macroPhases, setMacroPhases] = useState([]);
  const [usabilitySnap, setUsabilitySnap] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const savedTimer = useRef(null);
  const formRef = useRef(null);

  const [sectionOverrides, setSectionOverrides] = useState({});
  const [form, setForm] = useState({
    pending_items: [],
    final_considerations: "",
    selected_adendo_id: "",
    selected_coordenadora_id: "",
    selected_lider_id: "",
    selected_gerente_id: "",
  });

  const answersMap = buildAnswersMap(scopeItems);

  // Carregar termos e adendos
  const load = useCallback(async () => {
    setLoadingTermos(true);
    const [ts, adendos, assinaturas] = await Promise.all([
      base44.entities.TermoEncerramento.filter({ project_id: projectId }, "-version_number"),
      base44.entities.Adendo.filter({ active: true }, "title"),
      base44.entities.Assinatura.filter({ active: true }, "name"),
    ]);
    setTermos(ts);
    setAdendosAll(adendos);
    setAssinaturasAll(assinaturas);
    const curr = ts.find(t => t.is_current) || ts[0] || null;
    if (curr) {
      setCurrent(curr);
      try { setSectionOverrides(curr.section_overrides ? JSON.parse(curr.section_overrides) : {}); } catch {}
      setForm({
        pending_items: curr.pending_items || [],
        final_considerations: curr.final_considerations || "",
        // Compatibilidade: usa selected_adendo_id novo ou migra do array antigo
        selected_adendo_id: curr.selected_adendo_id || (curr.selected_adendos?.[0] || ""),
        selected_coordenadora_id: curr.selected_coordenadora_id || "",
        selected_lider_id: curr.selected_lider_id || "",
        selected_gerente_id: curr.selected_gerente_id || "",
      });
      if (curr.macro_schedule_snapshot) {
        try { setMacroPhases(JSON.parse(curr.macro_schedule_snapshot)); } catch {}
      }
      if (curr.auto_data_snapshot) {
        try { setUsabilitySnap(JSON.parse(curr.auto_data_snapshot)?.usability); } catch {}
      }
    }
    setLoadingTermos(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const isLocked = current?.status === "Enviado" || current?.status === "Assinado";

  // Salvar (debounced)
  const save = useCallback(async (formData, extra = {}) => {
    setSaveStatus("saving");
    const payload = {
      project_id: projectId,
      pending_items: formData.pending_items,
      final_considerations: formData.final_considerations,
      selected_adendo_id: formData.selected_adendo_id,
      selected_coordenadora_id: formData.selected_coordenadora_id,
      selected_lider_id: formData.selected_lider_id,
      selected_gerente_id: formData.selected_gerente_id,
      ...extra,
    };
    let saved;
    if (current && !isLocked) {
      saved = await base44.entities.TermoEncerramento.update(current.id, payload);
      setCurrent(c => ({ ...c, ...payload }));
      // Auditoria de campos alterados
      ["final_considerations", "pending_items", "selected_adendo_id"].forEach(field => {
        const oldVal = current?.[field] ? (typeof current[field] === "string" ? current[field] : JSON.stringify(current[field])) : "";
        const newVal = payload[field] ? (typeof payload[field] === "string" ? payload[field] : JSON.stringify(payload[field])) : "";
        if (oldVal !== newVal) {
          logAudit({ project_id: projectId, screen: "Termo de Encerramento", field, old_value: oldVal.substring(0, 200), new_value: newVal.substring(0, 200) });
        }
      });
    } else if (!current) {
      const user = await base44.auth.me().catch(() => null);
      saved = await base44.entities.TermoEncerramento.create({
        ...payload,
        version_number: 1,
        status: "Rascunho",
        is_current: true,
        created_by_name: user?.full_name || user?.email || "",
        last_auto_update: new Date().toISOString(),
      });
      setCurrent(saved);
      setTermos([saved]);
    }
    setSaveStatus("saved");
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveStatus(null), 2500);
  }, [current, isLocked, projectId]);

  // Mantém formRef sempre atualizado para evitar stale closures em onBlur
  formRef.current = form;

  const setField = (key, val) => {
    const next = { ...form, [key]: val };
    setForm(next);
    save(next);
  };

  // ─── Helpers para campos automáticos editáveis ───────────────────────────────
  const getAutoValue = (key, autoRaw) => sectionOverrides[key] !== undefined ? sectionOverrides[key] : (autoRaw != null ? String(autoRaw) : "");
  const isFieldManual = (key) => sectionOverrides[key] !== undefined;

  const handleOverrideBlur = (key, autoRaw, e) => {
    if (isLocked || readOnly) return;
    const newVal = e.target.value;
    const autoStr = autoRaw != null ? String(autoRaw) : "";
    if (newVal === autoStr) {
      // Voltou ao valor automático → remove override
      const next = { ...sectionOverrides };
      delete next[key];
      setSectionOverrides(next);
      saveSectionOverrides(next);
    } else {
      const next = { ...sectionOverrides, [key]: newVal };
      setSectionOverrides(next);
      saveSectionOverrides(next);
    }
  };

  const saveSectionOverrides = useCallback(async (overrides) => {
    if (!current?.id || isLocked) return;
    try {
      const payload = { section_overrides: JSON.stringify(overrides) };
      await base44.entities.TermoEncerramento.update(current.id, payload);
      setCurrent(c => c ? { ...c, ...payload } : c);
    } catch (e) { console.warn("[TermoEncerramentoTab] Erro ao salvar section_overrides:", e); }
  }, [current, isLocked]);

  const handleBlurSave = useCallback(() => {
    save(formRef.current);
  }, [save]);

  // Atualizar dados automáticos
  const handleRefresh = async () => {
    setRefreshing(true);
    const overrides = (() => { try { return JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}"); } catch { return {}; } })();
    const { macroPhases: phases } = computeMacroSchedule(overrides, answersMap, project, savedActivities || []);
    setMacroPhases(phases);

    // Buscar usabilidade do último report
    const latestReport = reports?.[0];
    let usability = null;
    if (latestReport?.usability_snapshot) {
      try { usability = JSON.parse(latestReport.usability_snapshot); } catch {}
    }
    setUsabilitySnap(usability);

    const autoSnapshot = JSON.stringify({ usability });
    await save(form, {
      macro_schedule_snapshot: JSON.stringify(phases),
      auto_data_snapshot: autoSnapshot,
      last_auto_update: new Date().toISOString(),
    });
    setRefreshing(false);
  };

  // Criar nova versão
  const handleNewVersion = async () => {
    const user = await base44.auth.me().catch(() => null);
    const nextNum = (termos[0]?.version_number || 0) + 1;
    if (current) await base44.entities.TermoEncerramento.update(current.id, { is_current: false });
    const created = await base44.entities.TermoEncerramento.create({
      project_id: projectId,
      version_number: nextNum,
      status: "Rascunho",
      is_current: true,
      created_by_name: user?.full_name || user?.email || "",
      last_auto_update: new Date().toISOString(),
      pending_items: form.pending_items,
      final_considerations: form.final_considerations,
      selected_adendo_id: form.selected_adendo_id,
      selected_coordenadora_id: form.selected_coordenadora_id,
      selected_lider_id: form.selected_lider_id,
      selected_gerente_id: form.selected_gerente_id,
      macro_schedule_snapshot: JSON.stringify(macroPhases),
      section_overrides: JSON.stringify(sectionOverrides),
    });
    setCurrent(created);
    setTermos(ts => [created, ...ts.map(t => ({ ...t, is_current: false }))]);
  };

  const handleMarkStatus = async (status) => {
    if (!current) return;
    await base44.entities.TermoEncerramento.update(current.id, { status });
    setCurrent(c => ({ ...c, status }));
    setTermos(ts => ts.map(t => t.id === current.id ? { ...t, status } : t));
  };

  const selectedAdendo = form.selected_adendo_id ? adendosAll.find(a => a.id === form.selected_adendo_id) || null : null;
  // Mantém compatibilidade com PDF que espera array
  const selectedAdendosData = selectedAdendo ? [selectedAdendo] : [];

  const coordenadora = assinaturasAll.find(a => a.id === form.selected_coordenadora_id) || null;
  const liderImpl = assinaturasAll.find(a => a.id === form.selected_lider_id) || null;
  const gerente = assinaturasAll.find(a => a.id === form.selected_gerente_id) || null;
  const coordenadorasList = assinaturasAll.filter(a => a.role === "Coordenadora de implantação");
  const liderList = assinaturasAll.filter(a => a.role === "Líder de implantação");
  const gerenteList = assinaturasAll.filter(a => a.role === "Gerente de Operações");

  const selectAdendo = (id) => {
    setField("selected_adendo_id", form.selected_adendo_id === id ? "" : id);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

  if (loadingTermos) {
    return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Termo de Encerramento</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {current ? (
                <>
                  <span className="text-xs text-slate-400">v{current.version_number}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_VERSION_COLORS[current.status]}`}>{current.status}</span>
                  {current.last_auto_update && <span className="text-xs text-slate-400">· dados em {new Date(current.last_auto_update).toLocaleString("pt-BR")}</span>}
                </>
              ) : <span className="text-xs text-slate-400">Nenhuma versão salva</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SaveStatus status={saveStatus} />

            {!readOnly && <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar dados automáticos
            </button>}

            {!readOnly && current?.status === "Rascunho" && (
              <button onClick={() => handleMarkStatus("Enviado")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                <Send className="w-3.5 h-3.5" /> Marcar como Enviado
              </button>
            )}
            {!readOnly && current?.status === "Enviado" && (
              <button onClick={() => handleMarkStatus("Assinado")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Assinado
              </button>
            )}

            {!readOnly && isLocked && (
              <button onClick={handleNewVersion}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nova versão
              </button>
            )}

            {termos.length > 1 && (
              <button onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                <History className="w-3.5 h-3.5" /> Histórico ({termos.length})
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {canGeneratePDF && (
              <button
                onClick={() => generateTermoPDF({ project, macroPhases, usabilitySnap, pendingItems: form.pending_items, finalConsiderations: form.final_considerations, selectedAdendosData, scopeItems, version: current, coordenadora, liderImpl, gerente, sectionOverrides })}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                <Download className="w-3.5 h-3.5" /> Gerar PDF
              </button>
            )}

            {/* Botão D4Sign - inativo */}
            <button
              onClick={() => alert("Funcionalidade será ativada com integração D4Sign")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed transition-colors"
              title="Será ativado com integração D4Sign">
              <Zap className="w-3.5 h-3.5" /> Enviar para assinatura
            </button>
          </div>
        </div>

        {isLocked && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Versão {current?.status?.toLowerCase()}. Clique em "Nova versão" para criar uma versão editável.
          </div>
        )}

        {/* Status D4Sign */}
        {current?.status_assinatura && current.status_assinatura !== "rascunho" && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            <FileSignature className="w-3.5 h-3.5 shrink-0" />
            D4Sign: {current.status_assinatura}
            {current.data_assinatura && ` · Assinado em ${new Date(current.data_assinatura).toLocaleDateString("pt-BR")}`}
          </div>
        )}
      </div>

      {/* Histórico */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Histórico de Versões</p>
          <div className="space-y-2">
            {termos.map(t => (
              <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg border ${t.is_current ? "border-green-200 bg-green-50" : "border-slate-100 bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">v{t.version_number}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_VERSION_COLORS[t.status]}`}>{t.status}</span>
                  <span className="text-xs text-slate-400">{t.created_by_name && `por ${t.created_by_name} · `}{t.created_date ? new Date(t.created_date).toLocaleDateString("pt-BR") : ""}</span>
                  {t.is_current && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">atual</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documento */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-700 to-purple-900 px-8 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-300 mb-1"><img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1a9549a83_LogoPontotel_AmarelaePreta.png" style={{height:18,verticalAlign:'middle'}} alt="Pontotel" /> · Implantação</p>
          <h1 className="text-xl font-bold">Termo de Encerramento do Projeto</h1>
          <p className="text-sm text-purple-200 mt-1">{project?.client_name} · {project?.implantation_type}</p>
        </div>

        <div className="p-8 space-y-10">

          {/* 1. Identificação */}
          <Section title="IDENTIFICAÇÃO DO PROJETO">
            <div className="bg-slate-50 rounded-lg p-4 mt-2">
              <EditableAutoField label="Cliente" fieldKey="client_name" autoValue={project?.client_name} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Tipo de Implantação" fieldKey="implantation_type" autoValue={project?.implantation_type} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Gerente Pontotel" fieldKey="pontotel_manager_name" autoValue={project?.pontotel_manager_name} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Analista" fieldKey="pontotel_analyst_name" autoValue={project?.pontotel_analyst_name} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Líder do Projeto (Cliente)" fieldKey="project_leader_name" autoValue={project?.project_leader_name} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Patrocinador" fieldKey="sponsor_name" autoValue={project?.sponsor_name} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Data de Início" fieldKey="start_date" autoValue={project?.start_date} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Data de Encerramento" fieldKey="end_date" autoValue={project?.aligned_end_date || project?.planned_end_date} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
            </div>
          </Section>

          {/* 2. Resumo */}
          <Section title="RESUMO DO PROJETO">
            <div className="bg-slate-50 rounded-lg p-4 mt-2">
              <EditableAutoField label="Funcionários Contratados" fieldKey="contracted_employees" autoValue={project?.contracted_employees} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Funcionários Cadastrados" fieldKey="registered_employees" autoValue={usabilitySnap?.numero_funcionarios} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Aderência ao Registro de Ponto" fieldKey="adherence" autoValue={
                project?.contracted_employees && usabilitySnap
                  ? `${Math.round((usabilitySnap.empregados_batendo_ponto_ultimos_15_dias / project.contracted_employees) * 100)}%`
                  : "—"
              } sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Progresso Geral do Projeto" fieldKey="progress_percent" autoValue={project?.progress_percent} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
            </div>
          </Section>

          {/* 3. Escopo */}
          <Section title="ESCOPO CONTRATADO">
            <div className="mt-2 space-y-3 bg-slate-50 rounded-lg p-4">
              <EditableAutoField label="Módulos" fieldKey="contracted_modules" autoValue={(project?.contracted_modules || []).join(", ")} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
              <EditableAutoField label="Serviços" fieldKey="contracted_services" autoValue={(project?.contracted_services || []).join(", ")} sectionOverrides={sectionOverrides} isLocked={isLocked} readOnly={readOnly} canEditAutoFields={canEditAutoFields} onBlur={handleOverrideBlur} />
            </div>
          </Section>

          {/* 4. Cronograma */}
          <Section title="CRONOGRAMA PLANEJADO VS REALIZADO">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">
                {macroPhases.length > 0 ? `${macroPhases.length} fases calculadas` : 'Clique em "Atualizar dados automáticos" para carregar'}
              </span>
            </div>
            {macroPhases.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Clique em "Atualizar dados automáticos" para calcular o cronograma macro.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Etapa</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Início Plan.</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Fim Plan.</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Início Real.</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Fim Real.</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {macroPhases.map((ph, i) => {
                      const statusColor = ph.status === "Concluído" ? "text-green-700 bg-green-50" : ph.status === "Em andamento" ? "text-purple-700 bg-purple-50" : ph.status === "Atrasado" ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-100";
                      return (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">{ph.phase}</td>
                          <td className="px-3 py-2.5 text-slate-500">{fmtDate(ph.plannedStart)}</td>
                          <td className="px-3 py-2.5 text-slate-500">{fmtDate(ph.plannedEnd)}</td>
                          <td className="px-3 py-2.5 text-slate-500">{fmtDate(ph.actualStart)}</td>
                          <td className="px-3 py-2.5 text-slate-500">{fmtDate(ph.actualEnd)}</td>
                          <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{ph.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Pendências */}
          <Section title="PENDÊNCIAS">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Editável</span>
            </div>
            {(form.pending_items || []).length === 0 && !isLocked && (
              <div className="text-xs text-slate-400 italic mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Sem pendências registradas — o documento exibirá "Não há pendências".
              </div>
            )}
            {!isLocked && !readOnly && (
              <div className="space-y-2 mb-3">
                {(form.pending_items || []).map((item, i) => {
                  const updateItem = (field, val) => {
                    const arr = [...form.pending_items];
                    arr[i] = { ...arr[i], [field]: val };
                    setForm(f => ({ ...f, pending_items: arr }));
                  };
                  const removeItem = () => {
                    const arr = form.pending_items.filter((_, idx) => idx !== i);
                    setForm(f => ({ ...f, pending_items: arr }));
                    save({ ...form, pending_items: arr });
                  };
                  return (
                  <div key={i} className="flex gap-2 items-start bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input className={inputClass} value={item.item || ""} onChange={e => updateItem("item", e.target.value)} onBlur={handleBlurSave} placeholder="Pendência" />
                      <input className={inputClass} value={item.responsible || ""} onChange={e => updateItem("responsible", e.target.value)} onBlur={handleBlurSave} placeholder="Responsável" />
                      <input type="date" className={inputClass} value={item.deadline || ""} onChange={e => updateItem("deadline", e.target.value)} onBlur={handleBlurSave} />
                      <input className={inputClass} value={item.action_plan || ""} onChange={e => updateItem("action_plan", e.target.value)} onBlur={handleBlurSave} placeholder="Plano de ação" />
                    </div>
                    <button onClick={removeItem} className="text-slate-300 hover:text-red-400 mt-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  );
                })}
                <button onClick={() => { const arr = [...(form.pending_items || []), { item: "", responsible: "", deadline: "", action_plan: "" }]; setForm(f => ({ ...f, pending_items: arr })); save({ ...form, pending_items: arr }); }}
                  className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar pendência
                </button>
              </div>
            )}
            {isLocked && (form.pending_items || []).length === 0 && (
              <p className="text-sm text-slate-600 italic">Não há pendências registradas.</p>
            )}
            {isLocked && (form.pending_items || []).length > 0 && (
              <ul className="space-y-1.5">
                {form.pending_items.map((p, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>{p.item} {p.responsible && `— ${p.responsible}`} {p.deadline && `(prazo: ${fmtDate(p.deadline)})`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 7. Adendos */}
          <Section title="ADENDOS">
            {!isLocked && !readOnly && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Selecione <strong>1 adendo</strong> para incluir no documento:</p>
                {adendosAll.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">Nenhum adendo ativo disponível. Crie adendos na seção "Adendos" do menu lateral.</div>
                ) : (
                  <div className="space-y-2">
                    {/* Opção "nenhum" */}
                    <div
                      onClick={() => selectAdendo("")}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${!form.selected_adendo_id ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${!form.selected_adendo_id ? "border-slate-500 bg-slate-500" : "border-slate-300"}`}>
                        {!form.selected_adendo_id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm text-slate-500 italic">Sem adendo</span>
                    </div>
                    {adendosAll.map(a => {
                      const selected = form.selected_adendo_id === a.id;
                      return (
                        <div key={a.id} onClick={() => selectAdendo(a.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected ? "border-green-300 bg-green-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? "border-green-500 bg-green-500" : "border-slate-300"}`}>
                            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700">{a.title}</p>
                            <p className="text-xs text-slate-400">{a.type}{a.description ? ` · ${a.description}` : ""}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {selectedAdendo ? (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-slate-700">{selectedAdendo.title}</span>
                  <span className="text-xs text-slate-400">[{selectedAdendo.type}]</span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {resolveAdendoContent(selectedAdendo.content, project, usabilitySnap)}
                </p>
              </div>
            ) : <p className="text-sm text-slate-400 italic">Nenhum adendo selecionado.</p>}
          </Section>

          {/* 8. Considerações finais */}
          <Section title="CONSIDERAÇÕES FINAIS">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Editável</span>
            </div>
            {isLocked || readOnly ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-100">{form.final_considerations || "—"}</p>
            ) : (
              <textarea
                className={`${inputClass} resize-none`}
                rows={5}
                value={form.final_considerations}
                onChange={e => setForm(f => ({ ...f, final_considerations: e.target.value }))}
                onBlur={handleBlurSave}
                placeholder="Considerações finais sobre o projeto, lições aprendidas, próximos passos..."
              />
            )}
          </Section>

          {/* 9. Assinaturas */}
          <Section title="ACEITE E ASSINATURAS">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Editável</span>
              <span className="text-xs text-slate-400">Selecione os signatários Pontotel</span>
            </div>

            {!isLocked && !readOnly && (
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Coordenadora de implantação *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={form.selected_coordenadora_id}
                    onChange={e => setField("selected_coordenadora_id", e.target.value)}
                  >
                    <option value="">— Selecionar —</option>
                    {coordenadorasList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {coordenadorasList.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhuma coordenadora cadastrada em Parametrizações.</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Líder de implantação (testemunha) *</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={form.selected_lider_id}
                    onChange={e => setField("selected_lider_id", e.target.value)}
                  >
                    <option value="">— Selecionar —</option>
                    {liderList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {liderList.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum líder cadastrado em Parametrizações.</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Gerente de Operações</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={form.selected_gerente_id}
                    onChange={e => setField("selected_gerente_id", e.target.value)}
                  >
                    <option value="">— Selecionar —</option>
                    {gerenteList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {gerenteList.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum gerente cadastrado em Parametrizações.</p>}
                </div>
              </div>
            )}

            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Ao assinar este documento, as partes declaram estar de acordo com os termos e condições do encerramento do projeto de implantação da Pontotel para <strong>{project?.client_name}</strong>, confirmando que todas as atividades previstas foram concluídas conforme acordado.
            </p>

            <div className="grid grid-cols-4 gap-4">
              {/* Coordenadora Pontotel */}
              <div className="border border-slate-200 rounded-lg p-4 text-center">
                <div className="h-10 border-b border-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{coordenadora?.name || <span className="text-amber-500 italic">Não selecionada</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pontotel · Coordenadora de implantação</p>
                {coordenadora?.email && <p className="text-xs text-slate-300 mt-0.5">{coordenadora.email}</p>}
              </div>
              {/* Líder de implantação (testemunha) */}
              <div className="border border-slate-200 rounded-lg p-4 text-center">
                <div className="h-10 border-b border-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{liderImpl?.name || <span className="text-amber-500 italic">Não selecionado</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pontotel · Líder de implantação (testemunha)</p>
                {liderImpl?.email && <p className="text-xs text-slate-300 mt-0.5">{liderImpl.email}</p>}
              </div>
              {/* Gerente de Operações */}
              <div className="border border-slate-200 rounded-lg p-4 text-center">
                <div className="h-10 border-b border-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{gerente?.name || <span className="text-slate-400 italic">Não selecionado</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pontotel · Gerente de Operações</p>
                {gerente?.email && <p className="text-xs text-slate-300 mt-0.5">{gerente.email}</p>}
              </div>
              {/* Líder do Projeto - Cliente */}
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <div className="h-10 border-b border-green-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">{project?.project_leader_name || <span className="text-slate-400 italic">Não cadastrado</span>}</p>
                <p className="text-xs text-slate-400 mt-0.5">{project?.client_name} · Líder do Projeto</p>
                {project?.project_leader_contact && <p className="text-xs text-slate-300 mt-0.5">{project.project_leader_contact}</p>}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {children}
    </section>
  );
}

function FieldOriginBadge({ manual }) {
  if (manual) return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
      <Pencil className="w-2.5 h-2.5" /> Manual
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-slate-100 text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
      <Lock className="w-2.5 h-2.5" /> Auto
    </span>
  );
}

function AutoRow({ label, value }) {
  return (
    <div className="flex items-start py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-48 shrink-0">{label}</span>
      <span className="text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

function EditableAutoField({ label, fieldKey, autoValue, sectionOverrides, isLocked, readOnly, canEditAutoFields, onBlur }) {
  const inputValue = sectionOverrides[fieldKey] !== undefined ? sectionOverrides[fieldKey] : (autoValue != null ? String(autoValue) : "");
  const manual = sectionOverrides[fieldKey] !== undefined;
  const disabled = isLocked || readOnly || !canEditAutoFields;
  const inputClass = "flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";
  const isDate = fieldKey.includes("date");

  return (
    <div className="flex items-start py-1.5 border-b border-slate-100 last:border-0 gap-3">
      <span className="text-xs font-medium text-slate-400 w-48 shrink-0 pt-1.5">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        {isDate
          ? <input type="date" className={`${inputClass} max-w-[200px]`} value={inputValue} onChange={() => {}} onBlur={e => onBlur(fieldKey, autoValue, e)} readOnly={disabled} />
          : <input type="text" className={inputClass} value={inputValue} onChange={() => {}} onBlur={e => onBlur(fieldKey, autoValue, e)} readOnly={disabled} />
        }
        <FieldOriginBadge manual={manual} />
      </div>
    </div>
  );
}