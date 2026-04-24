import { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import { computeMacroSchedule, MACRO_PHASE_ORDER } from "@/lib/scheduleReportEngine.js";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { computeSchedule } from "@/lib/scheduleEngine.js";
import {
  RefreshCw, Image, Clock, CheckCircle2, AlertTriangle,
  AlertCircle, Users, Activity, TrendingUp, Calendar,
  ChevronDown, ChevronUp, Save, Plus, Trash2
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function getStatusColors(status) {
  switch (status) {
    case "Concluído": return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" };
    case "Em andamento": return { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" };
    case "Atrasado": return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
    default: return { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" };
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

function KpiCard({ label, value, sub, icon: IconComponent, colorClass = "text-purple-600", bgClass = "bg-purple-50" }) {
  const Icon = IconComponent;
  return (
    <div className={`${bgClass} rounded-2xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${colorClass} opacity-70`} />}
      </div>
      <p className={`text-3xl font-bold ${colorClass}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Campos manuais editáveis ─────────────────────────────────────────────────

function ManualSection({ title, icon: Icon, items, onAdd, onRemove, onEdit, emptyObj, fields, color = "purple" }) {
  const colorMap = {
    purple: "text-purple-600 border-purple-200 bg-purple-50",
    orange: "text-orange-600 border-orange-200 bg-orange-50",
    red: "text-red-600 border-red-200 bg-red-50",
    blue: "text-blue-600 border-blue-200 bg-blue-50",
  };
  const cls = colorMap[color] || colorMap.purple;
  const inputClass = "flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${cls.split(" ")[0]}`} />}
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        </div>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border ${cls} transition-colors hover:opacity-80`}
        >
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-slate-400 italic">Nenhum item adicionado.</p>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            {fields.map(f => (
              <input
                key={f.key}
                className={`${inputClass} ${f.flex ? `flex-${f.flex}` : ""}`}
                value={item[f.key] || ""}
                onChange={e => onEdit(i, f.key, e.target.value)}
                placeholder={f.label}
                type={f.type || "text"}
              />
            ))}
            <button onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-400 mt-1.5 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cronograma Macro Table ───────────────────────────────────────────────────

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
                        className={`h-full rounded-full ${ph.status === "Concluído" ? "bg-green-500" : ph.status === "Em andamento" ? "bg-purple-500" : ph.status === "Atrasado" ? "bg-red-500" : "bg-slate-300"}`}
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

// ─── Dashboard principal (ref para captura de imagem) ─────────────────────────

const StatusReportDashboard = ({ report, project, macroPhases, overallProgress, usabilityData, form, setForm, locked }) => {
  const today = new Date().toLocaleDateString("pt-BR");
  const contracted = project?.contracted_employees || 0;
  const cadastrados = usabilityData?.numero_funcionarios || report?.registered_employees || 0;
  const batendoPonto = usabilityData?.empregados_batendo_ponto_ultimos_15_dias || report?.recording_employees || 0;
  const aderencia = contracted > 0 ? Math.round((batendoPonto / contracted) * 100) : 0;
  const periodStart = project?.start_date;
  const periodEnd = project?.aligned_end_date || project?.planned_end_date;

  const inputClass = "w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none";
  const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  const editItem = (field, i, key, val) => {
    if (locked) return;
    setForm(f => ({ ...f, [field]: f[field].map((x, idx) => idx === i ? { ...x, [key]: val } : x) }));
  };
  const addItem = (field, empty) => {
    if (locked) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), empty] }));
  };
  const removeItem = (field, i) => {
    if (locked) return;
    setForm(f => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl px-8 py-7 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-widest mb-1">Pontotel · Implantação</p>
            <h1 className="text-2xl font-bold">Status do Projeto</h1>
            <p className="text-purple-200 mt-1 text-sm">{project?.client_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-300">Data do relatório</p>
            <p className="text-sm font-semibold text-white">{today}</p>
            {(periodStart || periodEnd) && (
              <p className="text-xs text-purple-300 mt-1">
                {fmtDate(periodStart)} → {fmtDate(periodEnd)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
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
          sub="do contratado"
          icon={TrendingUp}
          colorClass={aderencia >= 80 ? "text-green-700" : aderencia >= 50 ? "text-orange-600" : "text-red-600"}
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

      {/* ── Bloco de Aderência ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Aderência ao Registro de Ponto</h3>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${aderencia >= 80 ? "bg-green-500" : aderencia >= 50 ? "bg-orange-400" : "bg-red-500"}`}
              style={{ width: `${Math.min(aderencia, 100)}%` }}
            />
          </div>
          <span className="text-2xl font-bold text-purple-700 shrink-0">{aderencia}%</span>
        </div>
        <p className="text-sm text-slate-600">
          Aderência ao registro de ponto: <strong>{aderencia}% do contratado</strong>
          {contracted > 0 && (
            <> — {batendoPonto.toLocaleString("pt-BR")} de {contracted.toLocaleString("pt-BR")} funcionários</>
          )}
        </p>
        {usabilityData && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {usabilityData.numero_funcionarios_ativos > 0 && (
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{usabilityData.numero_funcionarios_ativos.toLocaleString("pt-BR")}</span>
                <br />Funcionários ativos
              </div>
            )}
            {usabilityData.numero_regras_de_calculo > 0 && (
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{usabilityData.numero_regras_de_calculo}</span>
                <br />Regras de cálculo
              </div>
            )}
            {usabilityData.data_ultimo_acesso && (
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{usabilityData.data_ultimo_acesso}</span>
                <br />Último acesso
              </div>
            )}
            {usabilityData.email_ultimo_acesso && (
              <div className="text-xs text-slate-500 truncate">
                <span className="font-semibold text-slate-700 truncate block">{usabilityData.email_ultimo_acesso}</span>
                E-mail último acesso
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cronograma Macro ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Cronograma do Projeto</h3>
        <MacroScheduleTable macroPhases={macroPhases} />
      </div>

      {/* ── Status Operacional ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Próxima agenda */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-700">Próxima Agenda</h3>
          </div>
          {locked ? (
            <div>
              <p className="text-sm text-slate-700 font-medium">{form.next_agenda || "—"}</p>
              {form.next_agenda_date && <p className="text-xs text-slate-400 mt-1">{fmtDate(form.next_agenda_date)}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={form.next_agenda || ""}
                onChange={e => setForm(f => ({ ...f, next_agenda: e.target.value }))}
                placeholder="Assunto da próxima agenda..."
              />
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={form.next_agenda_date || ""}
                onChange={e => setForm(f => ({ ...f, next_agenda_date: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* Observações executivas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-700">Observações Executivas</h3>
          </div>
          {locked ? (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{form.executive_summary || "—"}</p>
          ) : (
            <textarea
              className={inputClass}
              rows={3}
              value={form.executive_summary || ""}
              onChange={e => setForm(f => ({ ...f, executive_summary: e.target.value }))}
              placeholder="Situação executiva atual do projeto..."
            />
          )}
        </div>
      </div>

      {/* ── Pendências e Riscos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManualSection
          title="Pendências do Cliente"
          icon={Clock}
          color="orange"
          items={form.client_pending || []}
          emptyObj={{ item: "", deadline: "", responsible: "" }}
          fields={[
            { key: "item", label: "Item pendente", flex: 2 },
            { key: "deadline", label: "Prazo", type: "date" },
            { key: "responsible", label: "Responsável" },
          ]}
          onAdd={() => addItem("client_pending", { item: "", deadline: "", responsible: "" })}
          onRemove={i => removeItem("client_pending", i)}
          onEdit={(i, k, v) => editItem("client_pending", i, k, v)}
        />
        <ManualSection
          title="Pendências Pontotel"
          icon={CheckCircle2}
          color="blue"
          items={form.internal_pending || []}
          emptyObj={{ item: "", deadline: "", responsible: "" }}
          fields={[
            { key: "item", label: "Item pendente", flex: 2 },
            { key: "deadline", label: "Prazo", type: "date" },
            { key: "responsible", label: "Responsável" },
          ]}
          onAdd={() => addItem("internal_pending", { item: "", deadline: "", responsible: "" })}
          onRemove={i => removeItem("internal_pending", i)}
          onEdit={(i, k, v) => editItem("internal_pending", i, k, v)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManualSection
          title="Integração"
          icon={Activity}
          color="purple"
          items={form.integration_items || []}
          emptyObj={{ item: "", status: "" }}
          fields={[
            { key: "item", label: "Item de integração", flex: 2 },
            { key: "status", label: "Status" },
          ]}
          onAdd={() => addItem("integration_items", { item: "", status: "" })}
          onRemove={i => removeItem("integration_items", i)}
          onEdit={(i, k, v) => editItem("integration_items", i, k, v)}
        />
        <ManualSection
          title="Riscos"
          icon={AlertTriangle}
          color="red"
          items={form.risks || []}
          emptyObj={{ description: "", impact: "Médio", mitigation: "" }}
          fields={[
            { key: "description", label: "Descrição do risco", flex: 2 },
            { key: "impact", label: "Impacto" },
            { key: "mitigation", label: "Mitigação" },
          ]}
          onAdd={() => addItem("risks", { description: "", impact: "Médio", mitigation: "" })}
          onRemove={i => removeItem("risks", i)}
          onEdit={(i, k, v) => editItem("risks", i, k, v)}
        />
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const DEFAULT_FORM = {
  next_agenda: "",
  next_agenda_date: "",
  executive_summary: "",
  client_pending: [],
  internal_pending: [],
  risks: [],
  integration_items: [],
};

export default function StatusReportTab({ reports, projectId, projectClientName, project, scopeItems, savedActivities, onRefresh }) {
  const [report, setReport] = useState(reports?.[0] || null);
  const [form, setForm] = useState(() => {
    const r = reports?.[0];
    if (!r) return { ...DEFAULT_FORM };
    return {
      next_agenda: r.next_agenda || "",
      next_agenda_date: r.next_agenda_date || "",
      executive_summary: r.executive_summary || "",
      client_pending: r.client_pending || [],
      internal_pending: r.internal_pending || [],
      risks: r.risks || [],
      integration_items: r.integration_items || [],
    };
  });

  const [macroPhases, setMacroPhases] = useState(() => {
    const r = reports?.[0];
    if (r?.macro_schedule) {
      try { return JSON.parse(r.macro_schedule); } catch {}
    }
    return [];
  });
  const [overallProgress, setOverallProgress] = useState(reports?.[0]?.overall_progress || 0);
  const [usabilityData, setUsabilityData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(reports?.[0]?.last_auto_update || null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState(reports?.[0]?.updated_by_name || null);

  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const dashboardRef = useRef(null);

  // Construir answersMap a partir do scopeItems
  const answersMap = {};
  (scopeItems || []).forEach(item => {
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      answersMap[key] = item.answer || "";
    }
  });

  // Executar atualização automática
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setShowConfirm(false);

    try {
      // 1. Buscar dados de usabilidade
      let usability = null;
      try {
        const res = await base44.functions.invoke("getUsabilityData", {
          empresa_id: project?.empresa_id || "",
          client_name: project?.client_name || "",
        });
        if (res.data?.found) {
          usability = res.data;
          setUsabilityData(res.data);
        }
      } catch (e) {
        console.warn("Erro ao buscar usabilidade:", e);
      }

      // 2. Calcular cronograma macro
      const overrides = (() => {
        try { return JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}"); }
        catch { return {}; }
      })();

      const { macroPhases: phases, overallProgress: progress } = computeMacroSchedule(
        overrides, answersMap, project, savedActivities || []
      );
      setMacroPhases(phases);
      setOverallProgress(progress);

      // 3. Obter usuário atual
      const user = await base44.auth.me().catch(() => null);
      const userName = user?.full_name || user?.email || "Sistema";
      const now = new Date().toISOString();

      // 4. Salvar/atualizar report
      const payload = {
        project_id: projectId,
        report_date: new Date().toISOString().split("T")[0],
        overall_progress: progress,
        macro_schedule: JSON.stringify(phases),
        last_auto_update: now,
        updated_by_name: userName,
        // usabilidade
        registered_employees: usability?.numero_funcionarios || report?.registered_employees || 0,
        recording_employees: usability?.empregados_batendo_ponto_ultimos_15_dias || report?.recording_employees || 0,
        adherence_percent: project?.contracted_employees
          ? Math.round(((usability?.empregados_batendo_ponto_ultimos_15_dias || 0) / project.contracted_employees) * 100)
          : 0,
        usability_snapshot: JSON.stringify(usability || {}),
        // campos manuais — preservados
        next_agenda: form.next_agenda,
        next_agenda_date: form.next_agenda_date,
        executive_summary: form.executive_summary,
        client_pending: form.client_pending,
        internal_pending: form.internal_pending,
        risks: form.risks,
        integration_items: form.integration_items,
      };

      let savedReport;
      if (report?.id) {
        savedReport = await base44.entities.StatusReport.update(report.id, payload);
        savedReport = { ...report, ...payload };
      } else {
        savedReport = await base44.entities.StatusReport.create(payload);
      }
      setReport(savedReport);
      setLastUpdate(now);
      setLastUpdatedBy(userName);

      // Atualizar progresso no projeto principal
      await base44.entities.Project.update(projectId, { progress_percent: progress }).catch(() => {});

    } finally {
      setUpdating(false);
    }
  }, [project, projectId, form, report, savedActivities, answersMap]);

  // Salvar campos manuais manualmente
  const handleSaveManual = async () => {
    setSaving(true);
    const payload = {
      next_agenda: form.next_agenda,
      next_agenda_date: form.next_agenda_date,
      executive_summary: form.executive_summary,
      client_pending: form.client_pending,
      internal_pending: form.internal_pending,
      risks: form.risks,
      integration_items: form.integration_items || [],
    };
    if (report?.id) {
      await base44.entities.StatusReport.update(report.id, payload);
      setReport(r => ({ ...r, ...payload }));
    } else {
      const created = await base44.entities.StatusReport.create({
        project_id: projectId,
        report_date: new Date().toISOString().split("T")[0],
        overall_progress: overallProgress,
        ...payload,
      });
      setReport(created);
    }
    setSaving(false);
  };

  // Gerar imagem PNG do dashboard
  const handleGenerateImage = async () => {
    setSavingImage(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const element = dashboardRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f8fafc",
        windowWidth: 1200,
      });
      const link = document.createElement("a");
      const clientSlug = (project?.client_name || "cliente").replace(/\s+/g, "_");
      const dateSlug = new Date().toISOString().split("T")[0].replace(/-/g, "");
      link.download = `Status_Report_${clientSlug}_${dateSlug}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      alert("Erro ao gerar imagem: " + e.message);
    }
    setSavingImage(false);
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Status Report</h2>
            <div className="text-xs text-slate-400 mt-0.5">
              {lastUpdate ? (
                <>
                  Última atualização: <strong className="text-slate-600">{new Date(lastUpdate).toLocaleString("pt-BR")}</strong>
                  {lastUpdatedBy && <> · por {lastUpdatedBy}</>}
                </>
              ) : "Nenhuma atualização automática realizada"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Atualizando..." : "Atualizar Status Report"}
            </button>

            <button
              onClick={handleSaveManual}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-purple-200 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar campos manuais"}
            </button>

            <button
              onClick={handleGenerateImage}
              disabled={savingImage}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Image className="w-4 h-4" />
              {savingImage ? "Gerando..." : "Gerar imagem"}
            </button>
          </div>
        </div>

        {/* Confirmação */}
        {showConfirm && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-purple-800 font-medium mb-1">Confirmar atualização automática</p>
                <p className="text-xs text-purple-600">
                  Isso irá atualizar os dados automáticos do Status Report com base em Dados Iniciais, Cronograma Detalhado e planilha de usabilidade. Campos manuais serão preservados.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Confirmar e atualizar
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-1.5 text-xs font-medium border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dashboard capturável ── */}
      <div ref={dashboardRef}>
        <StatusReportDashboard
          report={report}
          project={project}
          macroPhases={macroPhases}
          overallProgress={overallProgress}
          usabilityData={usabilityData}
          form={form}
          setForm={setForm}
          locked={false}
        />
      </div>
    </div>
  );
}