import { useState, useCallback, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Download, X, ChevronDown, ChevronUp, Search } from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPES = ["Erro", "Melhoria", "Dúvida", "Pendência", "Risco"];
const IMPACTS = ["Alto", "Médio", "Baixo"];
const STATUS_PONTOTEL = ["Aberto", "Em andamento", "Validação", "Concluído", "Cancelado"];
const STATUS_CLIENT = ["Aberto", "Em validação", "Validado", "Cancelado"];

const TYPE_COLORS = {
  "Erro": "bg-red-100 text-red-700 border-red-200",
  "Melhoria": "bg-blue-100 text-blue-700 border-blue-200",
  "Dúvida": "bg-amber-100 text-amber-700 border-amber-200",
  "Pendência": "bg-orange-100 text-orange-700 border-orange-200",
  "Risco": "bg-purple-100 text-purple-700 border-purple-200",
};

const IMPACT_COLORS = {
  "Alto": "bg-red-50 text-red-600",
  "Médio": "bg-amber-50 text-amber-600",
  "Baixo": "bg-slate-100 text-slate-500",
};

const STATUS_P_COLORS = {
  "Aberto": "bg-red-100 text-red-700",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Validação": "bg-purple-100 text-purple-700",
  "Concluído": "bg-green-100 text-green-700",
  "Cancelado": "bg-slate-100 text-slate-400",
};

const STATUS_C_COLORS = {
  "Aberto": "bg-red-100 text-red-700",
  "Em validação": "bg-purple-100 text-purple-700",
  "Validado": "bg-green-100 text-green-700",
  "Cancelado": "bg-slate-100 text-slate-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Inputs Inline ────────────────────────────────────────────────────────────

const cellBase = "w-full bg-transparent text-[11px] outline-none px-1 py-1 rounded focus:bg-blue-50 focus:ring-1 focus:ring-blue-300";

function TextCell({ value, onChange, placeholder, readOnly }) {
  return readOnly
    ? <span className="text-[11px] text-slate-600 block px-1 py-1 truncate">{value || "—"}</span>
    : <input className={cellBase} value={value || ""} onChange={e => onChange(e.target.value)} onBlur={onChange ? undefined : undefined} placeholder={placeholder} />;
}

function SelectCell({ value, onChange, options, colorMap, readOnly }) {
  if (readOnly) {
    const cls = colorMap?.[value] || "";
    return <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{value || "—"}</span>;
  }
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className={`${cellBase} text-[10px] font-semibold cursor-pointer`}
      style={{ color: "inherit" }}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

function DateCell({ value, onChange, readOnly }) {
  return readOnly
    ? <span className="text-[11px] text-slate-500 block px-1 py-1 whitespace-nowrap">{fmt(value)}</span>
    : <input type="date" className={`${cellBase} text-[10px] min-w-[90px]`} value={value || ""} onChange={e => onChange(e.target.value)} />;
}

function ResponsibleCell({ value, onChange, suggestions, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (readOnly) {
    return <span className="text-[11px] text-slate-600 block px-1 py-1 truncate">{value || "—"}</span>;
  }

  const filtered = suggestions.filter(s => s && s !== value && s.toLowerCase().includes((value || "").toLowerCase()));

  return (
    <div ref={ref} className="relative flex items-center">
      <input
        className={cellBase + " pr-5"}
        value={value || ""}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Digite ou selecione..."
      />
      <button
        type="button"
        className="absolute right-0.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] max-h-[140px] overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              className="block w-full text-left text-[11px] px-2.5 py-1.5 hover:bg-blue-50 text-slate-600"
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Linha da Tabela ─────────────────────────────────────────────────────────

function TableRow({ item, onFieldSave, readOnly, project }) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState({ ...item });
  const saveTimer = useRef(null);

  const pontotelSuggestions = [project?.pontotel_manager_name, project?.pontotel_analyst_name].filter(Boolean);
  const clientSuggestions = [project?.project_leader_name, project?.sponsor_name, project?.operation_name, project?.ti_client_name].filter(Boolean);

  useEffect(() => { setLocal({ ...item }); }, [item]);

  const save = useCallback((field, value) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onFieldSave(item.id, field, value), 400);
  }, [item.id, local, onFieldSave]);

  const saveNow = useCallback((field, value) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    clearTimeout(saveTimer.current);
    onFieldSave(item.id, field, value);
  }, [item.id, local, onFieldSave]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const hasDetail = local.ticket_code || local.technical_call_code || local.status_client !== "Aberto" || local.responsible_client || local.request_date || local.rollout_start || local.rollout_end || local.solution_date || local.new_solution_date || local.history || local.issue_description;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/30 group">
        <td className="p-0.5"><TextCell value={local.theme} onChange={v => save("theme", v)} readOnly={readOnly} placeholder="Tema" /></td>
        <td className="p-0.5"><TextCell value={local.issue} onChange={v => save("issue", v)} readOnly={readOnly} placeholder="Ocorrência" /></td>
        <td className="p-0.5">
          <SelectCell value={local.type} onChange={v => saveNow("type", v)} options={TYPES} colorMap={TYPE_COLORS} readOnly={readOnly} />
        </td>
        <td className="p-0.5">
          <SelectCell value={local.impact} onChange={v => saveNow("impact", v)} options={IMPACTS} colorMap={IMPACT_COLORS} readOnly={readOnly} />
        </td>
        <td className="p-0.5"><ResponsibleCell value={local.responsible_pontotel} onChange={v => save("responsible_pontotel", v)} suggestions={pontotelSuggestions} readOnly={readOnly} /></td>
        <td className="p-0.5">
          <SelectCell value={local.status_pontotel} onChange={v => saveNow("status_pontotel", v)} options={STATUS_PONTOTEL} colorMap={STATUS_P_COLORS} readOnly={readOnly} />
        </td>
        <td className="p-0.5"><DateCell value={local.deadline_date} onChange={v => saveNow("deadline_date", v)} readOnly={readOnly} /></td>
        <td className="p-0.5 text-center">
          <button
            onClick={() => setExpanded(e => !e)}
            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${hasDetail ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 hover:text-blue-500"}`}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="hidden sm:inline">{expanded ? "Recolher" : "Detalhes"}</span>
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/80">
          <td colSpan={8} className="px-3 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              {/* Col 1: Códigos */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cod. Ticket</span>
                  {readOnly ? <span className="text-slate-600">{local.ticket_code || "—"}</span> : <input className={cellBase} value={local.ticket_code || ""} onChange={e => save("ticket_code", e.target.value)} />}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Chamado Técnico</span>
                  {readOnly ? <span className="text-slate-600">{local.technical_call_code || "—"}</span> : <input className={cellBase} value={local.technical_call_code || ""} onChange={e => save("technical_call_code", e.target.value)} />}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Data Solicitação</span>
                  {readOnly ? <span className="text-slate-500">{fmt(local.request_date)}</span> : <input type="date" className={cellBase} value={local.request_date || ""} onChange={e => saveNow("request_date", e.target.value)} />}
                </div>
              </div>
              {/* Col 2: Status e Resp. Cliente */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Cliente</span>
                  <SelectCell value={local.status_client} onChange={v => saveNow("status_client", v)} options={STATUS_CLIENT} colorMap={STATUS_C_COLORS} readOnly={readOnly} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Resp. Cliente</span>
                  <ResponsibleCell value={local.responsible_client} onChange={v => save("responsible_client", v)} suggestions={clientSuggestions} readOnly={readOnly} />
                </div>
              </div>
              {/* Col 3: Rollout */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rollout Início</span>
                  {readOnly ? <span className="text-slate-500">{fmt(local.rollout_start)}</span> : <input type="date" className={cellBase} value={local.rollout_start || ""} onChange={e => saveNow("rollout_start", e.target.value)} />}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rollout Fim</span>
                  {readOnly ? <span className="text-slate-500">{fmt(local.rollout_end)}</span> : <input type="date" className={cellBase} value={local.rollout_end || ""} onChange={e => saveNow("rollout_end", e.target.value)} />}
                </div>
              </div>
              {/* Col 4: Solução */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Data Solução</span>
                  {readOnly ? <span className="text-slate-500">{fmt(local.solution_date)}</span> : <input type="date" className={cellBase} value={local.solution_date || ""} onChange={e => saveNow("solution_date", e.target.value)} />}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Nova Data Solução</span>
                  {readOnly ? <span className="text-slate-500">{fmt(local.new_solution_date)}</span> : <input type="date" className={cellBase} value={local.new_solution_date || ""} onChange={e => saveNow("new_solution_date", e.target.value)} />}
                </div>
              </div>
            </div>
            {/* Descrição + Histórico */}
            {(local.issue_description || !readOnly) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Descrição da Ocorrência</span>
                {readOnly ? (
                  <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{local.issue_description || "—"}</p>
                ) : (
                  <textarea className="w-full text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={2} value={local.issue_description || ""} onChange={e => setLocal(l => ({ ...l, issue_description: e.target.value }))} onBlur={() => { if (local.issue_description !== item.issue_description) onFieldSave(item.id, "issue_description", local.issue_description); }} />
                )}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Histórico</span>
              {readOnly ? (
                <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">{local.history || "—"}</p>
              ) : (
                <textarea className="w-full text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={3} value={local.history || ""} onChange={e => setLocal(l => ({ ...l, history: e.target.value }))} onBlur={() => { if (local.history !== item.history) onFieldSave(item.id, "history", local.history); }} placeholder="Registro de ações / atualizações..." />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Modal (apenas para novos itens) ─────────────────────────────────────────

const EMPTY_ITEM = {
  ticket_code: "", technical_call_code: "", theme: "", issue: "", issue_description: "",
  type: "Pendência", impact: "Médio", responsible_pontotel: "", status_pontotel: "Aberto",
  status_client: "Aberto", responsible_client: "", request_date: new Date().toISOString().split("T")[0],
  deadline_date: "", rollout_start: "", rollout_end: "", solution_date: "", new_solution_date: "", history: ""
};

function NewItemModal({ projectId, project, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_ITEM });
  const [saving, setSaving] = useState(false);

  const pontotelSuggestions = [project?.pontotel_manager_name, project?.pontotel_analyst_name].filter(Boolean);
  const clientSuggestions = [project?.project_leader_name, project?.sponsor_name, project?.operation_name, project?.ti_client_name].filter(Boolean);

  const handleSave = async () => {
    if (!form.theme || !form.issue) return;
    setSaving(true);
    await base44.entities.ActionPlan.create({ ...form, project_id: projectId });
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
          <h3 className="text-base font-bold text-slate-800">Novo Item</h3>
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
            <select className={selectCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Impacto</label>
            <select className={selectCls} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}>{IMPACTS.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Resp. Pontotel</label>
            <input className={inputCls} value={form.responsible_pontotel} onChange={e => setForm(f => ({ ...f, responsible_pontotel: e.target.value }))}
              list="pontotel-suggestions" placeholder="Digite ou selecione..." />
            <datalist id="pontotel-suggestions">
              {pontotelSuggestions.map((s, i) => <option key={i} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Status Pontotel</label>
            <select className={selectCls} value={form.status_pontotel} onChange={e => setForm(f => ({ ...f, status_pontotel: e.target.value }))}>{STATUS_PONTOTEL.map(s => <option key={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Status Cliente</label>
            <select className={selectCls} value={form.status_client} onChange={e => setForm(f => ({ ...f, status_client: e.target.value }))}>{STATUS_CLIENT.map(s => <option key={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className={labelCls}>Resp. Cliente</label>
            <input className={inputCls} value={form.responsible_client} onChange={e => setForm(f => ({ ...f, responsible_client: e.target.value }))}
              list="client-suggestions" placeholder="Digite ou selecione..." />
            <datalist id="client-suggestions">
              {clientSuggestions.map((s, i) => <option key={i} value={s} />)}
            </datalist>
          </div>
          <div><label className={labelCls}>Data Solicitação</label><input type="date" className={inputCls} value={form.request_date || ""} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} /></div>
          <div><label className={labelCls}>Prazo</label><input type="date" className={inputCls} value={form.deadline_date || ""} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))} /></div>
          <div><label className={labelCls}>Data Solução</label><input type="date" className={inputCls} value={form.solution_date || ""} onChange={e => setForm(f => ({ ...f, solution_date: e.target.value }))} /></div>
          <div><label className={labelCls}>Rollout Início</label><input type="date" className={inputCls} value={form.rollout_start || ""} onChange={e => setForm(f => ({ ...f, rollout_start: e.target.value }))} /></div>
          <div><label className={labelCls}>Rollout Fim</label><input type="date" className={inputCls} value={form.rollout_end || ""} onChange={e => setForm(f => ({ ...f, rollout_end: e.target.value }))} /></div>
          <div><label className={labelCls}>Nova Data Solução</label><input type="date" className={inputCls} value={form.new_solution_date || ""} onChange={e => setForm(f => ({ ...f, new_solution_date: e.target.value }))} /></div>
          <div className="col-span-3">
            <label className={labelCls}>Histórico</label>
            <textarea className={`${inputCls} resize-none h-24`} value={form.history} onChange={e => setForm(f => ({ ...f, history: e.target.value }))} placeholder="Registro de ações / atualizações..." />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.theme || !form.issue}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-40">
            {saving ? "Salvando..." : "Criar Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────

// colgroup widths (%): 8 colunas visíveis — sem scroll horizontal
const COL_W = ["13%","22%","8%","7%","13%","11%","9%","8%"];

export default function ActionPlanTab({ actions = [], projectId, project, onRefresh, readOnly = false }) {
  const [showNewModal, setShowNewModal] = useState(false);
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

  const handleFieldSave = useCallback(async (id, field, value) => {
    await base44.entities.ActionPlan.update(id, { [field]: value });
  }, []);

  const handleNewSaved = useCallback(() => {
    setShowNewModal(false);
    onRefresh();
  }, [onRefresh]);

  const openCount = actions.filter(a => !["Concluído", "Cancelado"].includes(a.status_pontotel)).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Plano de Ação</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{actions.length} itens · {openCount} em aberto</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input className="pl-7 pr-2.5 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-36" placeholder="Buscar..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Todos Status</option>
              {STATUS_PONTOTEL.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Todos Tipos</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button onClick={() => generateActionPlanPDF(project, filtered)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
              <Download className="w-3 h-3" />PDF
            </button>
            {!readOnly && (
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                <Plus className="w-3 h-3" />Novo
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
            {!readOnly && <button onClick={() => setShowNewModal(true)} className="mt-2 text-blue-600 hover:underline text-sm">Criar primeiro item</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <colgroup>
                {COL_W.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Tema</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Ocorrência</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Tipo</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Impacto</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Resp. Pontotel</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Status</th>
                  <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2">Prazo</th>
                  <th className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <TableRow key={item.id} item={item} onFieldSave={handleFieldSave} readOnly={readOnly} project={project} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal apenas para novo item */}
      {showNewModal && (
        <NewItemModal projectId={projectId} project={project} onClose={() => setShowNewModal(false)} onSave={handleNewSaved} />
      )}
    </div>
  );
}