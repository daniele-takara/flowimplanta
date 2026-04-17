import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate, impactColor } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { Plus, Save, X, AlertTriangle, ChevronDown } from "lucide-react";

function ActionRow({ item, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (item.id && !item.id.startsWith("ap")) {
      await base44.entities.ActionPlan.update(item.id, form);
    }
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const inputClass = "px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full";

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden mb-2">
      <div className="flex items-start gap-3 px-4 py-3">
        <button onClick={() => setExpanded(e => !e)} className="mt-0.5 text-slate-400">
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{item.ticket_code}</span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.theme}</span>
            <span className={`text-xs font-bold ${impactColor(item.impact)}`}>{item.impact}</span>
          </div>
          <p className="text-sm font-medium text-slate-800 mt-0.5">{item.issue}</p>
          {item.issue_description && !expanded && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.issue_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={item.status_pontotel} />
          {!editing && <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Editar</button>}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
          {!editing ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-700">{item.issue_description}</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Responsável Pontotel</p>
                  <p className="text-sm text-slate-700">{item.responsible_pontotel || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Responsável Cliente</p>
                  <p className="text-sm text-slate-700">{item.responsible_client || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Data da Solicitação</p>
                  <p className="text-sm text-slate-700">{formatDate(item.request_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Prazo</p>
                  <p className="text-sm text-slate-700">{formatDate(item.deadline_date)}</p>
                </div>
              </div>
              {item.history && (
                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Histórico</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{item.history}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Descrição</label>
                <textarea value={form.issue_description} onChange={e => setForm(f => ({ ...f, issue_description: e.target.value }))} className={`${inputClass} resize-none h-16`} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status Pontotel</label>
                <select value={form.status_pontotel} onChange={e => setForm(f => ({ ...f, status_pontotel: e.target.value }))} className={inputClass}>
                  {["Aberto", "Em andamento", "Validação", "Concluído", "Cancelado"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Status Cliente</label>
                <select value={form.status_client} onChange={e => setForm(f => ({ ...f, status_client: e.target.value }))} className={inputClass}>
                  {["Aberto", "Em validação", "Validado", "Cancelado"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Prazo</label>
                <input type="date" value={form.deadline_date || ""} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Solução</label>
                <input type="date" value={form.solution_date || ""} onChange={e => setForm(f => ({ ...f, solution_date: e.target.value }))} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Histórico</label>
                <textarea value={form.history} onChange={e => setForm(f => ({ ...f, history: e.target.value }))} className={`${inputClass} resize-none h-20`} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1">
                  <X className="w-3 h-3" />Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1">
                  <Save className="w-3 h-3" />{saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionPlanTab({ actions, projectId, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ theme: "", issue: "", issue_description: "", type: "Pendência", impact: "Médio", responsible_pontotel: "", responsible_client: "", request_date: new Date().toISOString().split("T")[0], deadline_date: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await base44.entities.ActionPlan.create({ ...newItem, project_id: projectId, status_pontotel: "Aberto", status_client: "Aberto" });
    setSaving(false);
    setShowForm(false);
    onRefresh();
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

  const openItems = actions.filter(a => !["Concluído", "Cancelado"].includes(a.status_pontotel));
  const closedItems = actions.filter(a => ["Concluído", "Cancelado"].includes(a.status_pontotel));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Plano de Ação</h2>
          <p className="text-sm text-slate-400">{openItems.length} iten{openItems.length !== 1 ? "s" : ""} em aberto</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            <Plus className="w-4 h-4" />Nova Issue
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Nova Issue / Pendência</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tema</label>
              <input className={inputClass} value={newItem.theme} onChange={e => setNewItem(p => ({ ...p, theme: e.target.value }))} placeholder="Ex: Integração Sankhya" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Issue</label>
              <input className={inputClass} value={newItem.issue} onChange={e => setNewItem(p => ({ ...p, issue: e.target.value }))} placeholder="Título da issue" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Descrição</label>
              <textarea className={`${inputClass} resize-none h-16`} value={newItem.issue_description} onChange={e => setNewItem(p => ({ ...p, issue_description: e.target.value }))} placeholder="Descrição detalhada..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo</label>
              <select className={inputClass} value={newItem.type} onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))}>
                {["Erro", "Melhoria", "Dúvida", "Pendência", "Risco"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Impacto</label>
              <select className={inputClass} value={newItem.impact} onChange={e => setNewItem(p => ({ ...p, impact: e.target.value }))}>
                {["Alto", "Médio", "Baixo"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Responsável Pontotel</label>
              <input className={inputClass} value={newItem.responsible_pontotel} onChange={e => setNewItem(p => ({ ...p, responsible_pontotel: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Prazo</label>
              <input type="date" className={inputClass} value={newItem.deadline_date} onChange={e => setNewItem(p => ({ ...p, deadline_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !newItem.theme || !newItem.issue} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-40">
              <Save className="w-4 h-4" />{saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {openItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-700">Em Aberto ({openItems.length})</h3>
          </div>
          {openItems.map(item => <ActionRow key={item.id || item.issue} item={item} onUpdate={onRefresh} />)}
        </div>
      )}

      {closedItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Encerrados ({closedItems.length})</h3>
          {closedItems.map(item => <ActionRow key={item.id || item.issue} item={item} onUpdate={onRefresh} />)}
        </div>
      )}

      {actions.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Nenhuma issue registrada.</p>
        </div>
      )}
    </div>
  );
}