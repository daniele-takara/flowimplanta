import { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

import {
  Plus, Download, X, ChevronDown, ChevronUp, Save,
  Search, FileText
} from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES = ["Erro", "Melhoria", "Dúvida", "Pendência", "Risco"];
const IMPACTS = ["Alto", "Médio", "Baixo"];
const STATUS_PONTOTEL = ["Aberto", "Em andamento", "Validação", "Concluído", "Cancelado"];
const STATUS_CLIENT = ["Aberto", "Em validação", "Validado", "Cancelado"];

const TYPE_COLORS = {
  "Erro":       "bg-red-100 text-red-700 border-red-200",
  "Melhoria":   "bg-blue-100 text-blue-700 border-blue-200",
  "Dúvida":     "bg-amber-100 text-amber-700 border-amber-200",
  "Pendência":  "bg-orange-100 text-orange-700 border-orange-200",
  "Risco":      "bg-purple-100 text-purple-700 border-purple-200",
};

const IMPACT_COLORS = {
  "Alto":   "bg-red-50 text-red-600",
  "Médio":  "bg-amber-50 text-amber-600",
  "Baixo":  "bg-slate-100 text-slate-500",
};

const STATUS_P_COLORS = {
  "Aberto":        "bg-red-100 text-red-700",
  "Em andamento":  "bg-blue-100 text-blue-700",
  "Validação":     "bg-purple-100 text-purple-700",
  "Concluído":     "bg-green-100 text-green-700",
  "Cancelado":     "bg-slate-100 text-slate-400",
};

const STATUS_C_COLORS = {
  "Aberto":       "bg-red-100 text-red-700",
  "Em validação": "bg-purple-100 text-purple-700",
  "Validado":     "bg-green-100 text-green-700",
  "Cancelado":    "bg-slate-100 text-slate-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Pill({ label, colorClass }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClass}`}>
      {label}
    </span>
  );
}

function fmt(d) {
  if (!d) return "—";
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

// ─── Geração de PDF ──────────────────────────────────────────────────────────

function generateActionPlanPDF(project, items) {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Plano de Ação – ${esc(project?.name || "Projeto")}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 8px; color: #1e293b; padding: 16px 12px; line-height: 1.3; }
  .header { border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { font-size: 14px; color: #1e40af; }
  .header .meta { font-size: 8px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: #fff; font-size: 7px; padding: 4px 3px; text-align: left; font-weight: 700; white-space: nowrap; }
  td { padding: 3px; border-bottom: 1px solid #e2e8f0; font-size: 7px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .pill { display: inline-block; padding: 1px 5px; border-radius: 8px; font-size: 6.5px; font-weight: 700; }
  .pill-red { background: #fee2e2; color: #991b1b; }
  .pill-blue { background: #dbeafe; color: #1e40af; }
  .pill-amber { background: #fef3c7; color: #92400e; }
  .pill-orange { background: #ffedd5; color: #9a3412; }
  .pill-purple { background: #ede9fe; color: #6b21a8; }
  .pill-green { background: #dcfce7; color: #166534; }
  .pill-slate { background: #f1f5f9; color: #64748b; }
  .impact-high { color: #dc2626; font-weight: 700; }
  .impact-med { color: #d97706; font-weight: 700; }
  .impact-low { color: #94a3b8; }
  .history-cell { max-width: 160px; word-break: break-word; }
  @media print { body { padding: 8px 6px; } }
</style></head><body>
<div class="header">
  <div>
    <h1>Plano de Ação</h1>
    <div class="meta">${esc(project?.client_name)} · ${esc(project?.implantation_type)} · ${new Date().toLocaleDateString("pt-BR")}</div>
  </div>
  <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/8e48c145a_LogoPontotel_AmarelaePreta.png" style="height:30px" alt="Pontotel" />
</div>
<table>
  <thead>
    <tr>
      <th>Cod. Ticket</th><th>Chamado Técnico</th><th>Tema</th><th>Ocorrência</th>
      <th>Tipo</th><th>Impacto</th><th>Resp. Pontotel</th><th>Status Pontotel</th>
      <th>Status Cliente</th><th>Resp. Cliente</th><th>Data Solicitação</th><th>Prazo</th>
      <th>Rollout Início</th><th>Rollout Fim</th><th>Data Solução</th><th>Nova Data Solução</th>
      <th>Histórico</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(it => {
      const typeMap = { "Erro":"pill-red", "Melhoria":"pill-blue", "Dúvida":"pill-amber", "Pendência":"pill-orange", "Risco":"pill-purple" };
      const sPMap = { "Aberto":"pill-red", "Em andamento":"pill-blue", "Validação":"pill-purple", "Concluído":"pill-green", "Cancelado":"pill-slate" };
      const sCMap = { "Aberto":"pill-red", "Em validação":"pill-purple", "Validado":"pill-green", "Cancelado":"pill-slate" };
      const impMap = { "Alto":"impact-high", "Médio":"impact-med", "Baixo":"impact-low" };
      return `<tr>
        <td>${esc(it.ticket_code)}</td>
        <td>${esc(it.technical_call_code)}</td>
        <td>${esc(it.theme)}</td>
        <td>${esc(it.issue)}</td>
        <td><span class="pill ${typeMap[it.type]||"pill-slate"}">${esc(it.type)}</span></td>
        <td class="${impMap[it.impact]||""}">${esc(it.impact)}</td>
        <td>${esc(it.responsible_pontotel)}</td>
        <td><span class="pill ${sPMap[it.status_pontotel]||"pill-slate"}">${esc(it.status_pontotel)}</span></td>
        <td><span class="pill ${sCMap[it.status_client]||"pill-slate"}">${esc(it.status_client)}</span></td>
        <td>${esc(it.responsible_client)}</td>
        <td>${fmt(it.request_date)}</td>
        <td>${fmt(it.deadline_date)}</td>
        <td>${fmt(it.rollout_start)}</td>
        <td>${fmt(it.rollout_end)}</td>
        <td>${fmt(it.solution_date)}</td>
        <td>${fmt(it.new_solution_date)}</td>
        <td class="history-cell">${esc(it.history)}</td>
      </tr>`;
    }).join("")}
  </tbody>
</table>
</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

// ─── Modal de Edição ─────────────────────────────────────────────────────────

const EMPTY_ITEM = {
  ticket_code: "", technical_call_code: "", theme: "", issue: "", issue_description: "",
  type: "Pendência", impact: "Médio", responsible_pontotel: "", status_pontotel: "Aberto",
  status_client: "Aberto", responsible_client: "", request_date: new Date().toISOString().split("T")[0],
  deadline_date: "", rollout_start: "", rollout_end: "", solution_date: "", new_solution_date: "", history: ""
};

function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item ? { ...item } : { ...EMPTY_ITEM });
  const [saving, setSaving] = useState(false);

  const isNew = !item;

  const handleSave = async () => {
    setSaving(true);
    if (isNew) {
      await base44.entities.ActionPlan.create({ ...form, project_id: form.project_id });
    } else {
      await base44.entities.ActionPlan.update(item.id, form);
    }
    setSaving(false);
    onSave();
  };

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400";
  const labelCls = "text-xs font-medium text-slate-500 mb-0.5 block";
  const selectCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto mx-4">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-bold text-slate-800">
            {isNew ? "Novo Item" : "Editar Item"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Cód. Ticket</label>
            <input className={inputCls} value={form.ticket_code} onChange={e => setForm(f => ({ ...f, ticket_code: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Chamado Técnico</label>
            <input className={inputCls} value={form.technical_call_code} onChange={e => setForm(f => ({ ...f, technical_call_code: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Tema *</label>
            <input className={inputCls} value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} placeholder="Ex: Integração" />
          </div>

          <div className="col-span-3">
            <label className={labelCls}>Ocorrência *</label>
            <input className={inputCls} value={form.issue} onChange={e => setForm(f => ({ ...f, issue: e.target.value }))} placeholder="Título da ocorrência" />
          </div>

          <div className="col-span-3">
            <label className={labelCls}>Descrição da Ocorrência</label>
            <textarea className={`${inputCls} resize-none h-20`} value={form.issue_description} onChange={e => setForm(f => ({ ...f, issue_description: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Tipo</label>
            <select className={selectCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Impacto</label>
            <select className={selectCls} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}>
              {IMPACTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Resp. Pontotel</label>
            <input className={inputCls} value={form.responsible_pontotel} onChange={e => setForm(f => ({ ...f, responsible_pontotel: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Status Pontotel</label>
            <select className={selectCls} value={form.status_pontotel} onChange={e => setForm(f => ({ ...f, status_pontotel: e.target.value }))}>
              {STATUS_PONTOTEL.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status Cliente</label>
            <select className={selectCls} value={form.status_client} onChange={e => setForm(f => ({ ...f, status_client: e.target.value }))}>
              {STATUS_CLIENT.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Resp. Cliente</label>
            <input className={inputCls} value={form.responsible_client} onChange={e => setForm(f => ({ ...f, responsible_client: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Data Solicitação</label>
            <input type="date" className={inputCls} value={form.request_date || ""} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Prazo</label>
            <input type="date" className={inputCls} value={form.deadline_date || ""} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Data Solução</label>
            <input type="date" className={inputCls} value={form.solution_date || ""} onChange={e => setForm(f => ({ ...f, solution_date: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Rollout Início</label>
            <input type="date" className={inputCls} value={form.rollout_start || ""} onChange={e => setForm(f => ({ ...f, rollout_start: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Rollout Fim</label>
            <input type="date" className={inputCls} value={form.rollout_end || ""} onChange={e => setForm(f => ({ ...f, rollout_end: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Nova Data Solução</label>
            <input type="date" className={inputCls} value={form.new_solution_date || ""} onChange={e => setForm(f => ({ ...f, new_solution_date: e.target.value }))} />
          </div>

          <div className="col-span-3">
            <label className={labelCls}>Histórico</label>
            <textarea className={`${inputCls} resize-none h-24`} value={form.history} onChange={e => setForm(f => ({ ...f, history: e.target.value }))} placeholder="Registro de ações / atualizações..." />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.theme || !form.issue}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-40"
          >
            <Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Linha da Tabela ─────────────────────────────────────────────────────────

function TableRow({ item, onEdit, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);

  const handleQuickStatus = async (newStatus) => {
    await base44.entities.ActionPlan.update(item.id, { status_pontotel: newStatus });
    onStatusChange();
  };

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 group">
        <td className="px-2 py-2.5 text-xs font-mono text-slate-400 whitespace-nowrap">{item.ticket_code || "—"}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{item.technical_call_code || "—"}</td>
        <td className="px-2 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{item.theme}</td>
        <td className="px-2 py-2.5 text-xs text-slate-700 max-w-[180px] truncate" title={item.issue}>
          <button onClick={() => onEdit(item)} className="text-left hover:text-blue-600 transition-colors">
            {item.issue}
          </button>
        </td>
        <td className="px-2 py-2.5"><Pill label={item.type} colorClass={TYPE_COLORS[item.type] || "bg-slate-100 text-slate-500 border-slate-200"} /></td>
        <td className="px-2 py-2.5 text-xs font-bold whitespace-nowrap">
          <span className={IMPACT_COLORS[item.impact] || "text-slate-500"}>{item.impact}</span>
        </td>
        <td className="px-2 py-2.5 text-xs text-slate-600 whitespace-nowrap">{item.responsible_pontotel || "—"}</td>
        <td className="px-2 py-2.5">
          <select
            value={item.status_pontotel}
            onChange={e => handleQuickStatus(e.target.value)}
            className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${STATUS_P_COLORS[item.status_pontotel] || "bg-slate-100 text-slate-500"}`}
          >
            {STATUS_PONTOTEL.map(s => <option key={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-2 py-2.5"><Pill label={item.status_client} colorClass={STATUS_C_COLORS[item.status_client] || "bg-slate-100 text-slate-500"} /></td>
        <td className="px-2 py-2.5 text-xs text-slate-600 whitespace-nowrap">{item.responsible_client || "—"}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.request_date)}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.deadline_date)}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.rollout_start)}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.rollout_end)}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.solution_date)}</td>
        <td className="px-2 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmt(item.new_solution_date)}</td>
        <td className="px-2 py-2.5">
          {item.history ? (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
            >
              <FileText className="w-3 h-3" />
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
      </tr>
      {expanded && item.history && (
        <tr className="bg-slate-50">
          <td colSpan={17} className="px-4 py-3">
            <div className="flex gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Histórico:</span>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{item.history}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function ActionPlanTab({ actions = [], projectId, project, onRefresh, readOnly = false }) {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = actions.filter(a => {
    if (filterStatus !== "all" && a.status_pontotel !== filterStatus) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      const fields = [a.ticket_code, a.technical_call_code, a.theme, a.issue, a.issue_description, a.responsible_pontotel, a.responsible_client];
      if (!fields.some(f => f?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const handleSave = useCallback(() => {
    setShowModal(false);
    setEditingItem(null);
    onRefresh();
  }, [onRefresh]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openCount = actions.filter(a => !["Concluído", "Cancelado"].includes(a.status_pontotel)).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Plano de Ação</h2>
            <p className="text-xs text-slate-400 mt-0.5">{actions.length} itens · {openCount} em aberto</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Busca */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filtro Status */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">Todos os Status</option>
              {STATUS_PONTOTEL.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Filtro Tipo */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">Todos os Tipos</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>

            {/* PDF */}
            <button
              onClick={() => generateActionPlanPDF(project, filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />PDF
            </button>

            {/* Novo */}
            {!readOnly && (
              <button
                onClick={handleNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Novo Item
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">Nenhum item encontrado.</p>
            {!readOnly && (
              <button onClick={handleNew} className="mt-2 text-blue-600 hover:underline text-sm">Criar primeiro item</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Cod. Ticket</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Chamado Técnico</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Tema</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Ocorrência</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Tipo</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Impacto</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Resp. Pontotel</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Status Pontotel</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Status Cliente</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Resp. Cliente</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Data Solicitação</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Prazo</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Rollout Início</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Rollout Fim</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Data Solução</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Nova Data Solução</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-3">Histórico</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <TableRow
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onStatusChange={onRefresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ItemModal
          item={editingItem ? { ...editingItem, project_id: projectId } : { ...EMPTY_ITEM, project_id: projectId }}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}