import { useState, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { computeMacroSchedule } from "@/lib/scheduleReportEngine.js";
import { generateStatusReportEmail } from "@/lib/statusReportEmailTemplate.js";
import EmailPreviewModal from "@/components/project/EmailPreviewModal.jsx";
import { logAudit } from "@/lib/auditLog";
import {
  RefreshCw, Mail, Clock, CheckCircle2, AlertTriangle,
  AlertCircle, Users, Activity, Calendar,
  Plus, Trash2, Maximize2, Minimize2
} from "lucide-react";

// Cache de campos salvos — sobrevive a unmount/remount do componente
const savedFieldsCache = new Map(); // projectId -> { lastSaved, fields: {...} }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function getStatusColors(status) {
  switch (status) {
    case "Concluído":    return { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-500"  };
    case "Em andamento": return { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" };
    case "Atrasado":     return { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500"    };
    default:             return { bg: "bg-slate-100",  text: "text-slate-500",  border: "border-slate-200",  dot: "bg-slate-400"  };
  }
}

function StatusPill({ status }) {
  const c = getStatusColors(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: KpiIcon, colorClass = "text-purple-600", bgClass = "bg-purple-50" }) {
  return (
    <div className={`${bgClass} rounded-2xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {KpiIcon && <KpiIcon className={`w-4 h-4 ${colorClass} opacity-70`} />}
      </div>
      <p className={`text-3xl font-bold ${colorClass}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Seção de itens editáveis ─────────────────────────────────────────────────

function ManualSection({ title, icon: SectionIcon, items, onAdd, onRemove, onEdit, fields, color = "purple", onSaveSection, readOnly }) {
  const colorMap = {
    purple: "text-purple-600 border-purple-200 bg-purple-50",
    orange: "text-orange-600 border-orange-200 bg-orange-50",
    red:    "text-red-600    border-red-200    bg-red-50",
    blue:   "text-blue-600   border-blue-200   bg-blue-50",
  };
  const cls = colorMap[color] || colorMap.purple;
  const inputBase = "flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {SectionIcon && <SectionIcon className={`w-4 h-4 ${cls.split(" ")[0]}`} />}
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        </div>
        {!readOnly && (
          <button
            onClick={onAdd}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border ${cls} transition-colors hover:opacity-80`}
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        )}
      </div>
      {items.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum item adicionado.</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            {fields.map(f => (
              <input
                key={f.key}
                className={`${inputBase} ${f.flex ? `flex-${f.flex}` : ""}`}
                value={item[f.key] || ""}
                onChange={e => onEdit(i, f.key, e.target.value)}
                onBlur={() => !readOnly && onSaveSection && onSaveSection()}
                placeholder={f.label}
                type={f.type || "text"}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && (
              <button onMouseDown={() => onRemove(i)} className="text-slate-300 hover:text-red-400 mt-1.5 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tabela de cronograma macro ───────────────────────────────────────────────

function MacroScheduleTable({ macroPhases }) {
  if (!macroPhases || macroPhases.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic p-4">
        Cronograma ainda não calculado. Clique em "Atualizar Status Report".
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Etapa</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Início Plan.</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Fim Plan.</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Progresso</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {macroPhases.map((ph, i) => {
            const c = getStatusColors(ph.status);
            return (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-700">{ph.phase}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(ph.plannedStart)}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(ph.plannedEnd)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ph.status === "Concluído" ? "bg-green-500" :
                          ph.status === "Atrasado" ? "bg-red-500" :
                          ph.status === "Em andamento" ? "bg-green-500" : "bg-slate-300"
                        }`}
                        style={{ width: `${ph.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{ph.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusPill status={ph.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function StatusReportDashboard({ report, project, macroPhases, overallProgress, kpiData, form, setForm, readOnly, onSaveField, onSaveSection }) {
  const today = new Date().toLocaleDateString("pt-BR");
  const periodStart = project?.start_date;
  const periodEnd = project?.aligned_end_date || project?.planned_end_date;

  // Source único de KPIs: kpiData (calculado no momento da última atualização)
  const contracted   = kpiData.contracted;
  const cadastrados  = kpiData.cadastrados;
  const batendoPonto = kpiData.batendoPonto;
  const aderencia    = kpiData.aderencia;

  const inputClass = "w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none";

  const editItem   = (field, i, key, val) => { if (readOnly) return; setForm(f => ({ ...f, [field]: f[field].map((x, idx) => idx === i ? { ...x, [key]: val } : x) })); };
  const addItem    = (field, empty)        => { if (readOnly) return; setForm(f => ({ ...f, [field]: [...(f[field] || []), empty] })); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl px-8 py-7 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-widest mb-1"><img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1ea94c9b2_LogoPontotel_AmarelaeBranca.png" style={{height:18,verticalAlign:'middle'}} alt="Pontotel" /> · Implantação</p>
            <h1 className="text-2xl font-bold">Status do Projeto</h1>
            <p className="text-purple-200 mt-1 text-sm">{project?.client_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-300">Data do relatório</p>
            <p className="text-sm font-semibold text-white">{today}</p>
            {(periodStart || periodEnd) && (
              <p className="text-xs text-purple-300 mt-1">{fmtDate(periodStart)} → {fmtDate(periodEnd)}</p>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Empregados Cadastrados"
          value={cadastrados.toLocaleString("pt-BR")}
          sub={`de ${contracted.toLocaleString("pt-BR")} contratados`}
          icon={Users}
          colorClass="text-purple-700"
          bgClass="bg-purple-50"
        />
        <KpiCard
          label="Empregados no Ponto/mês"
          value={batendoPonto.toLocaleString("pt-BR")}
          sub="últimos 15 dias"
          icon={Activity}
          colorClass="text-blue-700"
          bgClass="bg-blue-50"
        />
        <KpiCard
          label="Aderência ao Ponto"
          value={`${aderencia}%`}
          sub="do total contratado"
          icon={CheckCircle2}
          colorClass={aderencia >= 80 ? "text-green-700" : aderencia >= 50 ? "text-orange-700" : "text-red-700"}
          bgClass={aderencia >= 80 ? "bg-green-50" : aderencia >= 50 ? "bg-orange-50" : "bg-red-50"}
        />
        <KpiCard
          label="Progresso do Projeto"
          value={`${overallProgress || 0}%`}
          sub="média das fases macro"
          icon={CheckCircle2}
          colorClass="text-purple-700"
          bgClass="bg-purple-50"
        />
      </div>

      {/* Cronograma Macro */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Cronograma do Projeto</h3>
        <MacroScheduleTable macroPhases={macroPhases} />
      </div>

      {/* Status Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-700">Próxima Agenda</h3>
          </div>
          <div className="space-y-2">
            <input
              className="w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.next_agenda || ""}
              onChange={e => !readOnly && setForm(f => ({ ...f, next_agenda: e.target.value }))}
              onBlur={e => onSaveField && onSaveField("next_agenda", e.target.value)}
              placeholder="Assunto da próxima agenda..."
              readOnly={readOnly}
            />
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={form.next_agenda_date || ""}
              onChange={e => !readOnly && setForm(f => ({ ...f, next_agenda_date: e.target.value }))}
              onBlur={e => onSaveField && onSaveField("next_agenda_date", e.target.value)}
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-700">Observações Executivas</h3>
          </div>
          <textarea
            className={inputClass}
            rows={3}
            value={form.executive_summary || ""}
            onChange={e => !readOnly && setForm(f => ({ ...f, executive_summary: e.target.value }))}
            onBlur={e => onSaveField && onSaveField("executive_summary", e.target.value)}
            placeholder="Situação executiva atual do projeto..."
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Pendências e Riscos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManualSection
          title="Pendências do Cliente" icon={Clock} color="orange"
          items={form.client_pending || []}
          fields={[{ key: "item", label: "Item pendente", flex: 2 }, { key: "deadline", label: "Prazo", type: "date" }, { key: "responsible", label: "Responsável" }]}
          onAdd={() => addItem("client_pending", { item: "", deadline: "", responsible: "" })}
          onRemove={i => { const filtered = (form.client_pending || []).filter((_, idx) => idx !== i); setForm(f => ({ ...f, client_pending: filtered })); onSaveSection && onSaveSection("client_pending", filtered); }}
          onEdit={(i, k, v) => editItem("client_pending", i, k, v)}
          onSaveSection={() => onSaveSection && onSaveSection("client_pending")}
          readOnly={readOnly}
        />
        <ManualSection
          title="Pendências Pontotel" icon={CheckCircle2} color="blue"
          items={form.internal_pending || []}
          fields={[{ key: "item", label: "Item pendente", flex: 2 }, { key: "deadline", label: "Prazo", type: "date" }, { key: "responsible", label: "Responsável" }]}
          onAdd={() => addItem("internal_pending", { item: "", deadline: "", responsible: "" })}
          onRemove={i => { const filtered = (form.internal_pending || []).filter((_, idx) => idx !== i); setForm(f => ({ ...f, internal_pending: filtered })); onSaveSection && onSaveSection("internal_pending", filtered); }}
          onEdit={(i, k, v) => editItem("internal_pending", i, k, v)}
          onSaveSection={() => onSaveSection && onSaveSection("internal_pending")}
          readOnly={readOnly}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManualSection
          title="Integração" icon={Activity} color="purple"
          items={form.integration_items || []}
          fields={[{ key: "item", label: "Item de integração", flex: 2 }, { key: "status", label: "Status" }]}
          onAdd={() => addItem("integration_items", { item: "", status: "" })}
          onRemove={i => { const filtered = (form.integration_items || []).filter((_, idx) => idx !== i); setForm(f => ({ ...f, integration_items: filtered })); onSaveSection && onSaveSection("integration_items", filtered); }}
          onEdit={(i, k, v) => editItem("integration_items", i, k, v)}
          onSaveSection={() => onSaveSection && onSaveSection("integration_items")}
          readOnly={readOnly}
        />
        <ManualSection
          title="Riscos" icon={AlertTriangle} color="red"
          items={form.risks || []}
          fields={[{ key: "description", label: "Descrição do risco", flex: 2 }, { key: "impact", label: "Impacto" }, { key: "mitigation", label: "Mitigação" }]}
          onAdd={() => addItem("risks", { description: "", impact: "Médio", mitigation: "" })}
          onRemove={i => { const filtered = (form.risks || []).filter((_, idx) => idx !== i); setForm(f => ({ ...f, risks: filtered })); onSaveSection && onSaveSection("risks", filtered); }}
          onEdit={(i, k, v) => editItem("risks", i, k, v)}
          onSaveSection={() => onSaveSection && onSaveSection("risks")}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const DEFAULT_FORM = {
  next_agenda: "", next_agenda_date: "", executive_summary: "",
  client_pending: [], internal_pending: [], risks: [], integration_items: [],
};

/**
 * Calcula KPIs a partir do report persistido e do contracted_employees do projeto.
 * Source único: report.registered_employees / recording_employees / contracted_employees.
 */
function computeKpiFromReport(report, project) {
  const contracted   = project?.contracted_employees || 0;
  const cadastrados  = report?.registered_employees  || 0;
  const batendoPonto = report?.recording_employees   || 0;
  const aderencia    = contracted > 0
    ? Math.round((batendoPonto / contracted) * 100)
    : (report?.adherence_percent ?? 0);
  return { contracted, cadastrados, batendoPonto, aderencia };
}

export default function StatusReportTab({ reports, projectId, projectClientName, project, scopeItems, savedActivities, onRefresh, readOnly = false, canUpdate = true, canGenerateEmail = true, canSyncPipedrive = true }) {
  // refs estáveis para evitar race conditions e closures stale
  const reportRef = useRef(reports?.[0] || null);
  const formRef = useRef(null);
  const [report, setReport] = useState(reports?.[0] || null);
  const [form, setForm] = useState(() => {
    const r = reports?.[0];
    const cached = savedFieldsCache.get(projectId);
    const baseForm = r ? {
      next_agenda:      r.next_agenda      || "",
      next_agenda_date: r.next_agenda_date || "",
      executive_summary: r.executive_summary || "",
      client_pending:   r.client_pending   || [],
      internal_pending: r.internal_pending || [],
      risks:            r.risks            || [],
      integration_items: r.integration_items || [],
    } : { ...DEFAULT_FORM };
    // Mescla campos salvos no cache (mais recentes que o DB) para sobreviver a troca de abas
    if (cached?.fields) {
      return { ...baseForm, ...cached.fields };
    }
    return baseForm;
  });

  // Sincroniza report quando reports prop muda (ex: após onRefresh do parent)
  // IMPORTANTE: NÃO sincroniza form para evitar sobrescrever edições do usuário
  useEffect(() => {
    const currFirstId = reports?.[0]?.id;
    const prevFirstId = reportRef.current?.id;
    if (currFirstId && currFirstId !== prevFirstId) {
      setReport(reports[0]);
    }
    reportRef.current = reports?.[0] || null;
  }, [reports]);

  // Cronograma macro: inicializa do snapshot persistido; atualizado via botão
  const [macroPhases, setMacroPhases]       = useState(() => {
    const r = reports?.[0];
    if (r?.macro_schedule) { try { return JSON.parse(r.macro_schedule); } catch {} }
    return [];
  });
  const [overallProgress, setOverallProgress] = useState(reports?.[0]?.overall_progress || 0);

  // KPIs: source único = report persistido (atualizado via botão "Atualizar Status Report")
  const [kpiData, setKpiData] = useState(() => computeKpiFromReport(reports?.[0], project));

  const [lastUpdate, setLastUpdate]       = useState(reports?.[0]?.last_auto_update || null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState(reports?.[0]?.updated_by_name || null);

  const [updating, setUpdating]           = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailHtml, setEmailHtml]         = useState("");
  const [showConfirm, setShowConfirm]     = useState(false);
  const [updateResult, setUpdateResult]   = useState(null);

  // Mantém formRef sempre atualizado com o form mais recente (evita closure stale)
  formRef.current = form;

  // answersMap para o motor de cronograma
  const answersMap = {};
  (scopeItems || []).forEach(item => {
    if (item.order_number) answersMap[`q${String(item.order_number).padStart(3, "0")}`] = item.answer || "";
  });

  /**
   * BOTÃO ÚNICO — executa em sequência:
   * 1. Planilha "Mais recente" → registered_employees, recording_employees
   * 2. Calcula aderência com contracted_employees do projeto
   * 3. Calcula cronograma macro com savedActivities reais
   * 4. Sincroniza campos Pipedrive (pendências, next_agenda) se tiver deal_id
   * 5. Persiste tudo no StatusReport
   * 6. Atualiza progress_percent no Project
   */
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setShowConfirm(false);
    setUpdateResult(null);

    try {
      // 1. Buscar dados de usabilidade — BigQuery primeiro, Planilha como fallback
      let registeredEmployees = report?.registered_employees || 0;
      let recordingEmployees  = report?.recording_employees  || 0;
      let bqFound = false;
      let sheetFound = false;
      let dataSource = "planilha";

      // 1a. BigQuery (source primário) — usa empresa_id do projeto
      if (project?.empresa_id) {
        try {
          const bqRes = await base44.functions.invoke("queryBigQueryUsage", {
            code: project.empresa_id,
            limite: 1,
          });
          const d = bqRes.data;
          if (d?.success && d.usageData?.rows?.length > 0) {
            const row = d.usageData.rows[0];
            registeredEmployees = parseInt(row.empregados_cadastrados) || registeredEmployees;
            recordingEmployees  = parseInt(row.empregados_batendo_30d) || recordingEmployees;
            bqFound = true;
            dataSource = "BigQuery";
            console.log("[StatusReportTab] BigQuery:", { registeredEmployees, recordingEmployees });
          }
        } catch (e) {
          console.warn("[StatusReportTab] BigQuery falhou, tentando planilha:", e.message);
        }
      }

      // 1b. Planilha Google Sheets (fallback)
      if (!bqFound && project?.lar21) {
        try {
          const sheetRes = await base44.functions.invoke("updateReportFromSheet", {
            project_id: projectId,
            lar21: project.lar21,
          });
          const d = sheetRes.data;
          if (d?.success) {
            registeredEmployees = d.registered_employees;
            recordingEmployees  = d.recording_employees;
            sheetFound = true;
            dataSource = "planilha";
            if (d.report) { const merged = { ...(reportRef.current || {}), ...d.report }; reportRef.current = merged; setReport(merged); }
          } else if (d?.lar21_not_found) {
            setUpdateResult({ error: `Lar21 não encontrado na aba "Mais recente" da planilha. (Lar21: ${project.lar21})` });
          } else if (d?.lar21_duplicate) {
            setUpdateResult({ error: `Lar21 duplicado na planilha. Revise a base. (Lar21: ${project.lar21})` });
          }
        } catch (e) {
          console.warn("[StatusReportTab] Erro ao buscar planilha (não crítico):", e.message);
        }
      } else if (!bqFound) {
        console.warn("[StatusReportTab] Sem empresa_id (BigQuery) e sem Lar21 (planilha) — dados de usabilidade não atualizados.");
      }

      // 2. Calcular aderência — source único
      const contracted = project?.contracted_employees || 0;
      const aderencia  = contracted > 0
        ? Math.round((recordingEmployees / contracted) * 100)
        : 0;

      // 3. Recarregar projeto do banco para ter schedule_overrides mais recentes
      const freshProjectList = await base44.entities.Project.filter({ id: projectId });
      const freshProject = freshProjectList[0] || project;

      // Calcular cronograma macro usando atividades reais do banco
      const bankAnchors = freshProject?.schedule_anchor_dates || {};
      const overrides = {};
      Object.entries(bankAnchors).forEach(([taskId, dateStr]) => {
        if (dateStr) overrides[taskId] = { plannedStart: dateStr };
      });

      // Carregar overrides manuais do banco (fonte de verdade compartilhada entre usuários)
      let dbOverrides = {};
      try {
        const raw = freshProject?.schedule_overrides;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          dbOverrides = raw;
        }
      } catch {}
      
      // Merge: banco como base
      Object.entries(dbOverrides).forEach(([taskId, ov]) => {
        if (ov && typeof ov === "object") {
          overrides[taskId] = { ...(overrides[taskId] || {}), ...ov };
        }
      });
      
      // Fallback: localStorage sobrepõe (para dados ainda não migrados)
      try {
        const ls = JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
        Object.entries(ls).forEach(([taskId, ov]) => {
          if (ov && typeof ov === "object") {
            overrides[taskId] = { ...(overrides[taskId] || {}), ...ov };
          }
        });
      } catch {}

      // Carregar overrides de fases e fases locais para sincronizar com o cronograma real
      let phaseOverridesMap = {};
      let localPhases = [];
      try {
        const [phaseOverrideList, localPhaseList] = await Promise.all([
          base44.entities.SchedulePhaseOverride.filter({ project_id: projectId }),
          base44.entities.LocalSchedulePhase.filter({ project_id: projectId }),
        ]);
        (phaseOverrideList || []).forEach(o => { phaseOverridesMap[o.phase_name] = o; });
        localPhases = (localPhaseList || []).filter(p => p.is_active !== false);
      } catch {}

      const { macroPhases: phases, overallProgress: progress } = computeMacroSchedule(
        overrides, answersMap, freshProject, savedActivities || [], phaseOverridesMap, localPhases
      );
      setMacroPhases(phases);
      setOverallProgress(progress);

      // 4. Sincronizar campos Pipedrive
      let pipedriveFormPatch = {};
      if (project?.pipedrive_deal_id) {
        try {
          const pipeRes = await base44.functions.invoke("applyStatusReportFromPipedrive", {
            project_id: projectId,
            deal_id: project.pipedrive_deal_id,
          });
          const pipeData = pipeRes.data;
          if (pipeData?.ok && pipeData.fields_updated > 0) {
            const patch = pipeData.patch || {};
            pipedriveFormPatch = {
              ...(patch.next_agenda    !== undefined ? { next_agenda:    patch.next_agenda    } : {}),
              ...(patch.client_pending !== undefined ? { client_pending: patch.client_pending } : {}),
              ...(patch.internal_pending !== undefined ? { internal_pending: patch.internal_pending } : {}),
            };
          }
        } catch (e) {
          console.warn("[StatusReportTab] Erro Pipedrive (não crítico):", e.message);
        }
      }

      // Aplicar patch do Pipedrive no form atual (usa formRef para evitar stale closure)
      const latestForm = formRef.current || form;
      const currentForm = Object.keys(pipedriveFormPatch).length > 0
        ? { ...latestForm, ...pipedriveFormPatch }
        : latestForm;
      if (Object.keys(pipedriveFormPatch).length > 0) setForm(currentForm);

      // 5. Persistir tudo
      const user     = await base44.auth.me().catch(() => null);
      const userName = user?.full_name || user?.email || "Sistema";
      const now      = new Date().toISOString();

      const payload = {
        project_id: projectId,
        report_date: now.split("T")[0],
        overall_progress: progress,
        macro_schedule:   JSON.stringify(phases),
        last_auto_update: now,
        updated_by_name:  userName,
        registered_employees: registeredEmployees,
        recording_employees:  recordingEmployees,
        adherence_percent:    aderencia,
        usability_snapshot: JSON.stringify({ registered_employees: registeredEmployees, recording_employees: recordingEmployees }),
        // campos manuais preservados
        next_agenda:       currentForm.next_agenda,
        next_agenda_date:  currentForm.next_agenda_date,
        executive_summary: currentForm.executive_summary,
        client_pending:    currentForm.client_pending,
        internal_pending:  currentForm.internal_pending,
        risks:             currentForm.risks,
        integration_items: currentForm.integration_items,
      };

      // Garante que usamos o report mais atualizado
      const currentReport = reportRef.current;
      let savedReport;
      if (currentReport?.id) {
        await base44.entities.StatusReport.update(currentReport.id, payload);
        savedReport = { ...currentReport, ...payload };
      } else {
        savedReport = await base44.entities.StatusReport.create(payload);
      }
      reportRef.current = savedReport;
      setReport(savedReport);
      setLastUpdate(now);
      setLastUpdatedBy(userName);

      // Atualizar KPIs — source único vem do report recém salvo
      setKpiData(computeKpiFromReport(savedReport, project));

      // 6. Atualizar progresso no projeto
      await base44.entities.Project.update(projectId, { progress_percent: progress }).catch(() => {});

      setUpdateResult({
        success: true,
        msg: `${registeredEmployees} cadastrados · ${recordingEmployees} no ponto · ${aderencia}% aderência · cronograma atualizado${bqFound ? " · BigQuery" : sheetFound ? " · planilha" : ""}`,
      });
    } catch (e) {
      setUpdateResult({ error: e.message });
    } finally {
      setUpdating(false);
    }
  }, [project, projectId, form, report, savedActivities, answersMap]);

  // Salvar um campo individual — autosave onBlur (silencioso, sem refresh)
  // Usa cache de módulo para sobreviver a unmount/remount (troca de abas)
  const handleSaveField = useCallback(async (field, value) => {
    const currentReport = reportRef.current;
    try {
      if (currentReport?.id) {
        const payload = { [field]: value };
        await base44.entities.StatusReport.update(currentReport.id, payload);
        reportRef.current = { ...currentReport, ...payload };
        setReport(prev => prev ? { ...prev, ...payload } : prev);
      } else {
        const saved = await base44.entities.StatusReport.create({
          project_id: projectId,
          report_date: new Date().toISOString().split("T")[0],
          [field]: value,
        });
        reportRef.current = saved;
        setReport(saved);
      }
      // Auditoria
      logAudit({ project_id: projectId, screen: "Status Report", field, old_value: String(currentReport?.[field] || ""), new_value: String(value || "") });
      // Atualiza cache silencioso para sobreviver a troca de abas
      const entry = savedFieldsCache.get(projectId) || { fields: {} };
      entry.fields[field] = value;
      entry.lastSaved = Date.now();
      savedFieldsCache.set(projectId, entry);
    } catch (e) {
      console.warn("[StatusReportTab] Erro ao salvar campo:", field, e);
    }
  }, [projectId]);

  // Salvar seção de array (pendências, riscos, integração) — autosave onBlur
  // valueOverride: usado pelo removeItem para passar o array já filtrado,
  // evitando race condition entre setForm (assíncrono) e leitura do formRef (síncrona)
  const handleSaveSectionArray = useCallback(async (field, valueOverride) => {
    const currentReport = reportRef.current;
    const f = formRef.current || form;
    const value = valueOverride !== undefined ? valueOverride : (f[field] || []);
    try {
      const payload = { [field]: value };
      if (currentReport?.id) {
        await base44.entities.StatusReport.update(currentReport.id, payload);
        reportRef.current = { ...currentReport, ...payload };
        setReport(prev => prev ? { ...prev, ...payload } : prev);
      } else {
        const saved = await base44.entities.StatusReport.create({
          project_id: projectId,
          report_date: new Date().toISOString().split("T")[0],
          ...payload,
        });
        reportRef.current = saved;
        setReport(saved);
      }
      // Auditoria (seção de array)
      logAudit({ project_id: projectId, screen: "Status Report", field, old_value: JSON.stringify(currentReport?.[field] || []), new_value: JSON.stringify(value || []) });
      const entry = savedFieldsCache.get(projectId) || { fields: {} };
      entry.fields[field] = value;
      entry.lastSaved = Date.now();
      savedFieldsCache.set(projectId, entry);
    } catch (e) {
      console.warn("[StatusReportTab] Erro ao salvar seção:", field, e);
    }
  }, [projectId]);

  // Gerar e-mail — usa exatamente os mesmos dados exibidos na UI
  const handleGenerateEmail = () => {
    // Constrói usabilityData a partir do kpiData (source único)
    const usabilityForEmail = {
      numero_funcionarios: kpiData.cadastrados,
      empregados_batendo_ponto_ultimos_15_dias: kpiData.batendoPonto,
    };
    const html = generateStatusReportEmail({
      project, form, macroPhases, overallProgress,
      usabilityData: usabilityForEmail,
      report,
    });
    setEmailHtml(html);
    setShowEmailPreview(true);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Status Report</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              {lastUpdate
                ? <>Última atualização: <strong className="text-slate-600">{new Date(lastUpdate).toLocaleString("pt-BR")}</strong>{lastUpdatedBy && <> · por {lastUpdatedBy}</>}</>
                : "Nenhuma atualização realizada"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && canUpdate && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={updating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${updating ? "animate-spin" : ""}`} />
                {updating ? "Atualizando..." : "Atualizar Status Report"}
              </button>
            )}
            {canGenerateEmail && (
              <button
                onClick={handleGenerateEmail}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Gerar e-mail
              </button>
            )}
            <button
              onClick={() => {
                if (window.location.hash === "#presentation") {
                  window.location.hash = "";
                } else {
                  window.location.hash = "presentation";
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              title={window.location.hash === "#presentation" ? "Sair da tela cheia" : "Expandir tela para apresentação"}
            >
              {window.location.hash === "#presentation" ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {window.location.hash === "#presentation" ? "Recolher" : "Expandir"}
            </button>
          </div>
        </div>

        {/* Feedback da atualização */}
        {updateResult && (
          <div className={`mt-3 p-3 rounded-xl flex items-start gap-2 text-xs ${
            updateResult.success
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {updateResult.success
              ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {updateResult.msg}</>
              : <><AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {updateResult.error}</>
            }
          </div>
        )}

        {/* Confirmação */}
        {showConfirm && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-purple-800 font-medium mb-1">Confirmar atualização</p>
                <p className="text-xs text-purple-600">
                  Atualiza indicadores da planilha "Mais recente", recalcula cronograma com atividades reais, sincroniza Pipedrive e persiste tudo. Campos manuais são preservados.
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleUpdate} className="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    Confirmar e atualizar
                  </button>
                  <button onClick={() => setShowConfirm(false)} className="px-4 py-1.5 text-xs font-medium border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-100">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEmailPreview && <EmailPreviewModal html={emailHtml} onClose={() => setShowEmailPreview(false)} />}

      {/* Alerta de Lar21 ausente */}
      {!project?.lar21 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            <strong>Lar21 não preenchido.</strong> Não será possível buscar dados da planilha de usabilidade até que o campo Lar21 seja preenchido nos Dados Iniciais (via Pipedrive).
          </span>
        </div>
      )}

      <StatusReportDashboard
        report={report}
        project={project}
        macroPhases={macroPhases}
        overallProgress={overallProgress}
        kpiData={kpiData}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
        onSaveField={handleSaveField}
        onSaveSection={handleSaveSectionArray}
      />
    </div>
  );
}