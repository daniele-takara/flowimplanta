import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Users, LayoutTemplate, Plus, Pencil, Trash2, Copy,
  CheckCircle, XCircle, Filter, Scale, Settings, DollarSign,
  Mail, ChevronRight, Shield, Zap, Type, Database, GripVertical, X
} from "lucide-react";
import { ADENDO_VARIABLES, CATEGORY_LABELS } from "@/lib/adendoVariables";
import TabUsuarios from "@/components/parametrizacoes/TabUsuarios";
import TabPerfis from "@/components/parametrizacoes/TabPerfis";
import TabCronogramaTemplate from "@/components/parametrizacoes/TabCronogramaTemplate";
import TabEscopoTemplate from "@/components/parametrizacoes/TabEscopoTemplate";
import TabIntegracaoPipedrive from "@/components/parametrizacoes/TabIntegracaoPipedrive";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${value ? "bg-green-500" : "bg-slate-300"}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}

function DeleteConfirm({ onConfirm, onCancel, message }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-base font-bold text-slate-800 mb-2">Confirmar exclusão</h3>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Excluir</button>
        </div>
      </div>
    </div>
  );
}

// ─── ABA: ADENDOS ─────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  "Jurídico": "bg-purple-50 text-purple-700 border-purple-200",
  "Técnico": "bg-blue-50 text-blue-700 border-blue-200",
  "Comercial": "bg-green-50 text-green-700 border-green-200",
};
const TYPE_ICONS = { "Jurídico": Scale, "Técnico": Settings, "Comercial": DollarSign };

function AdendoForm({ adendo, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: adendo?.title || "", type: adendo?.type || "Técnico",
    description: adendo?.description || "",
    blocks: adendo?.blocks ? (() => { try { return JSON.parse(adendo.blocks); } catch { return []; } })() : [{ type: "text", value: "" }],
    active: adendo?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const addTextBlock = () => setForm(f => ({ ...f, blocks: [...f.blocks, { type: "text", value: "" }] }));
  const addFieldBlock = (variableKey) => {
    setForm(f => ({ ...f, blocks: [...f.blocks, { type: "field", value: variableKey }] }));
    setShowFieldPicker(false);
  };
  const removeBlock = (idx) => setForm(f => ({ ...f, blocks: f.blocks.filter((_, i) => i !== idx) }));
  const updateBlock = (idx, value) => setForm(f => { const blocks = [...f.blocks]; blocks[idx] = { ...blocks[idx], value }; return { ...f, blocks }; });
  const moveBlock = (idx, dir) => setForm(f => { const blocks = [...f.blocks]; const ni = idx + dir; if (ni < 0 || ni >= blocks.length) return f; [blocks[idx], blocks[ni]] = [blocks[ni], blocks[idx]]; return { ...f, blocks }; });

  const buildContent = (blocks) => blocks.map(b => b.type === "field" ? b.value : b.value).join("");

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    const content = buildContent(form.blocks);
    await onSave({ ...form, content, blocks: JSON.stringify(form.blocks) });
    setSaving(false);
  };

  const previewContent = form.blocks.map(b => {
    if (b.type === "field") { const v = ADENDO_VARIABLES.find(x => x.key === b.value); return v ? v.example : b.value; }
    return b.value;
  }).join("");

  const taClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-base font-bold text-slate-800">{adendo ? "Editar Adendo" : "Novo Adendo"}</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Título *</label>
              <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Título do adendo" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo *</label>
              <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option>Jurídico</option><option>Técnico</option><option>Comercial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição resumida</label>
            <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição" />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Toggle value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
              <span className="text-sm text-slate-600">{form.active ? "Ativo" : "Inativo"}</span>
            </label>
          </div>

          {/* ─── Builder de blocos ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conteúdo do Adendo (blocos)</label>
              <span className="text-xs text-slate-400">{form.blocks.length} bloco(s)</span>
            </div>
            <div className="space-y-3 mb-4">
              {form.blocks.map((block, idx) => (
                <div key={idx} className="flex items-start gap-2 group">
                  <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                    <button type="button" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
                      <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <button type="button" onClick={() => moveBlock(idx, 1)} disabled={idx === form.blocks.length - 1}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </div>
                  <div className={`flex-1 rounded-xl border-2 transition-all ${block.type === "field" ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center gap-2 px-2 py-1 border-b border-slate-100">
                      <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${block.type === "field" ? "text-blue-600" : "text-slate-500"}`}>
                        {block.type === "field" ? <><Database className="w-3 h-3" /> Campo do projeto</> : <><Type className="w-3 h-3" /> Texto</>}
                      </span>
                      <span className="flex-1" />
                      <button type="button" onClick={() => removeBlock(idx)} className="text-slate-300 hover:text-red-400 p-0.5"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="p-2">
                      {block.type === "field" ? (
                        <select className={inputClass} value={block.value} onChange={e => updateBlock(idx, e.target.value)}>
                          <option value="">— Selecionar campo —</option>
                          {ADENDO_VARIABLES.map(v => <option key={v.key} value={v.key}>{v.label} ({v.key})</option>)}
                        </select>
                      ) : (
                        <textarea className={taClass} rows={2} value={block.value} onChange={e => updateBlock(idx, e.target.value)} placeholder="Digite o texto do adendo aqui..." />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={addTextBlock}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all">
                <Type className="w-4 h-4" /> Adicionar bloco de texto
              </button>
              <button type="button" onClick={() => setShowFieldPicker(!showFieldPicker)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Database className="w-4 h-4" /> Adicionar campo do projeto
              </button>
            </div>

            {showFieldPicker && (
              <div className="mt-3 border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-blue-700 uppercase">Selecionar campo do projeto</span>
                  <button type="button" onClick={() => setShowFieldPicker(false)} className="ml-auto text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-3 space-y-3 max-h-[250px] overflow-y-auto">
                  {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                    const vars = ADENDO_VARIABLES.filter(v => v.category === catKey);
                    if (vars.length === 0) return null;
                    return (
                      <div key={catKey}>
                        <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">{catLabel}</span>
                        <div className="space-y-1">
                          {vars.map(v => (
                            <button key={v.key} type="button" onClick={() => addFieldBlock(v.key)}
                              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all group cursor-pointer">
                              <code className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{v.key}</code>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-slate-700 block">{v.label}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{v.source}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {form.blocks.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Pré-visualização</label>
              <div className="p-4 border border-blue-200 rounded-xl bg-blue-50/30 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                {previewContent || <span className="text-slate-400 italic">Adicione blocos de texto e campos para montar o adendo...</span>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving || !form.title} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabAdendos() {
  const [adendos, setAdendos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("Todos");
  const [filterActive, setFilterActive] = useState("Todos");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => { setLoading(true); setAdendos(await base44.entities.Adendo.list("-created_date")); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing?.id) await base44.entities.Adendo.update(editing.id, form);
    else await base44.entities.Adendo.create(form);
    setShowForm(false); setEditing(null); load();
  };

  const filtered = adendos.filter(a => {
    if (filterType !== "Todos" && a.type !== filterType) return false;
    if (filterActive === "Ativos" && !a.active) return false;
    if (filterActive === "Inativos" && a.active) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Biblioteca global de adendos reutilizáveis em qualquer Termo de Encerramento.</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Novo Adendo
        </button>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {["Todos", "Jurídico", "Técnico", "Comercial"].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${filterType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {["Todos", "Ativos", "Inativos"].map(s => (
            <button key={s} onClick={() => setFilterActive(s)} className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${filterActive === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>{s}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
        : filtered.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Nenhum adendo encontrado.</div>
        : (
          <div className="space-y-3">
            {filtered.map(adendo => {
              const TypeIcon = TYPE_ICONS[adendo.type] || FileText;
              return (
                <div key={adendo.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${!adendo.active ? "opacity-60" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[adendo.type]?.split(" ").slice(0,2).join(" ") || "bg-slate-100"}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-800">{adendo.title}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[adendo.type] || "bg-slate-100 text-slate-500"}`}>{adendo.type}</span>
                      {!adendo.active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inativo</span>}
                    </div>
                    {adendo.description && <p className="text-xs text-slate-500 mt-0.5">{adendo.description}</p>}
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{
                      (() => {
                        let blocks = [];
                        try { blocks = JSON.parse(adendo.blocks || "[]"); } catch { return adendo.content || ""; }
                        return blocks.map(b => b.type === "field" ? (ADENDO_VARIABLES.find(v => v.key === b.value)?.label || b.value) : b.value?.substring(0, 80)).join(" ");
                      })()
                    }</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => base44.entities.Adendo.update(adendo.id, { active: !adendo.active }).then(load)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                      {adendo.active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button onClick={() => { setEditing({ ...adendo, id: undefined }); setShowForm(true); }} title="Duplicar" className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => { setEditing(adendo); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirm(adendo.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      {showForm && <AdendoForm adendo={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}
      {deleteConfirm && <DeleteConfirm message="Esta ação não pode ser desfeita. O adendo será removido." onConfirm={async () => { await base44.entities.Adendo.delete(deleteConfirm); setDeleteConfirm(null); load(); }} onCancel={() => setDeleteConfirm(null)} />}
    </div>
  );
}

// ─── ABA: ASSINATURAS ─────────────────────────────────────────────────────────

function AssinaturaForm({ assinatura, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: assinatura?.name || "", email: assinatura?.email || "",
    role: assinatura?.role || "Coordenadora de implantação", active: assinatura?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{assinatura ? "Editar Assinatura" : "Nova Assinatura"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Nome completo *</label>
            <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Nome completo" /></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">E-mail *</label>
            <input type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="email@pontotel.com.br" /></div>
          <div><label className="block text-xs font-semibold text-slate-500 mb-1">Cargo *</label>
            <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option>Coordenadora de implantação</option>
              <option>Líder de implantação</option>
            </select></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm text-slate-600">{form.active ? "Ativo" : "Inativo"}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabAssinaturas() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => { setLoading(true); setList(await base44.entities.Assinatura.list("name")); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing) await base44.entities.Assinatura.update(editing.id, form);
    else await base44.entities.Assinatura.create(form);
    setShowForm(false); setEditing(null); load();
  };

  const ROLE_COLORS = {
    "Coordenadora de implantação": "bg-purple-50 text-purple-700 border-purple-200",
    "Líder de implantação": "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Cadastre as assinaturas Pontotel disponíveis para uso nos Termos de Encerramento.</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nova Assinatura
        </button>
      </div>
      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
        : list.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">Nenhuma assinatura cadastrada.</div>
        : (
          <div className="space-y-3">
            {list.map(a => (
              <div key={a.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${!a.active ? "opacity-60" : ""}`}>
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-slate-600">{a.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-800">{a.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[a.role] || "bg-slate-100 text-slate-500 border-slate-200"}`}>{a.role}</span>
                    {!a.active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inativo</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Mail className="w-3 h-3" />{a.email}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => base44.entities.Assinatura.update(a.id, { active: !a.active }).then(load)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    {a.active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                  </button>
                  <button onClick={() => { setEditing(a); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      {showForm && <AssinaturaForm assinatura={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}
      {deleteConfirm && <DeleteConfirm message="A assinatura será removida permanentemente." onConfirm={async () => { await base44.entities.Assinatura.delete(deleteConfirm); setDeleteConfirm(null); load(); }} onCancel={() => setDeleteConfirm(null)} />}
    </div>
  );
}

// ─── ABA: TEMPLATES ───────────────────────────────────────────────────────────

const DOCUMENT_TEMPLATES_CONFIG = [
  { id: "dados_iniciais", label: "Dados Iniciais", description: "Configuração base do projeto", sections: [
    { id: "identificacao", label: "Identificação do Projeto", required: true, description: "Cliente, datas, equipe, tipo de implantação" },
    { id: "empresa_id", label: "ID da Empresa (vínculo Sheets)", required: true, description: "Chave de busca na planilha de usabilidade" },
    { id: "modulos_servicos", label: "Módulos e Serviços Contratados", required: true, description: "Define visibilidade no Escopo e TAP" },
    { id: "contatos", label: "Contatos e Equipes", required: false, description: "Pontotel e Cliente" },
    { id: "observacoes", label: "Observações Gerais", required: false, description: "Campo livre" },
  ]},
  { id: "escopo", label: "Escopo Técnico", description: "Mapeamento de regras e configurações", sections: [
    { id: "info_geral", label: "Informações Gerais", required: true, description: "Funcionários, operações, folha" },
    { id: "registro_ponto", label: "Registro de Ponto", required: true, description: "Método, autenticação, cerca virtual" },
    { id: "calculos", label: "Cálculos e Tratamento", required: false, description: "Regras de cálculo, banco de horas" },
    { id: "integracao_sankhya", label: "Integração Sankhya", required: false, description: "Visível apenas se contratado" },
    { id: "gestao_participativa", label: "Gestão Participativa", required: false, description: "Solicitações, aprovações" },
    { id: "ferias_ausencias", label: "Férias e Ausências", required: false, description: "Gestão de férias" },
  ]},
  { id: "tap", label: "TAP", description: "Termo de Abertura do Projeto", sections: [
    { id: "objetivo", label: "1. Objetivo", required: true, editable: true, defaultText: "Este Termo de Abertura define as diretrizes e premissas para a configuração do sistema Pontotel." },
    { id: "participantes", label: "2. Participantes", required: true, editable: false, description: "Automático — Dados Iniciais" },
    { id: "condicoes_gerais", label: "3. Condições Gerais", required: true, editable: false, description: "Dimensão, Datas, Módulos — automático" },
    { id: "entregas", label: "4. Entregas Previstas", required: true, editable: false, description: "Gerado via Escopo Técnico" },
    { id: "cronograma", label: "5. Cronograma", required: true, editable: false, description: "Snapshot do Cronograma Detalhado v1" },
    { id: "conclusao", label: "6. Conclusão", required: true, editable: true, defaultText: "Este Termo formaliza as diretrizes do projeto de implantação da Pontotel." },
  ]},
  { id: "status_report", label: "Status Report", description: "Relatório executivo semanal", sections: [
    { id: "kpis", label: "KPIs Executivos", required: true, editable: false, description: "Cadastrados, Ponto/mês, Aderência, Progresso" },
    { id: "cronograma_macro", label: "Cronograma Macro", required: true, editable: false, description: "Agregado do Cronograma Detalhado" },
    { id: "aderencia", label: "Bloco de Aderência", required: true, editable: false, description: "Barra visual + dados de usabilidade" },
    { id: "proxima_agenda", label: "Próxima Agenda", required: false, editable: true, description: "Campo manual" },
    { id: "riscos", label: "Riscos", required: false, editable: true, description: "Lista manual" },
  ]},
  { id: "termo_encerramento", label: "Termo de Encerramento", description: "Documento formal de encerramento", sections: [
    { id: "identificacao", label: "1. Identificação do Projeto", required: true, editable: false, description: "Automático — Dados Iniciais" },
    { id: "cronograma", label: "5. Cronograma Plan vs Real", required: true, editable: false, description: "Automático — Cronograma Macro" },
    { id: "pendencias", label: "7. Pendências", required: false, editable: true, description: "Manual — ou 'Não há pendências'" },
    { id: "adendos", label: "8. Adendos", required: false, editable: true, description: "Seleção da biblioteca global" },
    { id: "consideracoes", label: "9. Considerações Finais", required: false, editable: true, description: "Campo livre" },
    { id: "assinaturas", label: "10. Aceite e Assinaturas", required: true, editable: true, description: "Coordenadora + Líder (Parametrização) + Líder Cliente (Dados Iniciais)" },
  ]},
];

function TabTemplates() {
  const [subTab, setSubTab] = useState("documentos");
  const [selected, setSelected] = useState("dados_iniciais");
  const template = DOCUMENT_TEMPLATES_CONFIG.find(t => t.id === selected);
  return (
    <div>
      {/* Sub-navegação */}
      <div className="flex gap-2 mb-5">
        {[
          { id: "documentos", label: "Documentos" },
          { id: "cronograma", label: "Cronograma" },
          { id: "escopo", label: "Escopo Técnico" },
        ].map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${subTab === st.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === "cronograma" && <TabCronogramaTemplate />}
      {subTab === "escopo" && <TabEscopoTemplate />}

      {subTab === "documentos" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-1 space-y-2">
            {DOCUMENT_TEMPLATES_CONFIG.map(t => (
              <button key={t.id} onClick={() => setSelected(t.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selected === t.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                  <ChevronRight className={`w-4 h-4 ${selected === t.id ? "text-blue-500" : "text-slate-300"}`} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
          {template && (
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">{template.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{template.description}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 w-fit">
                  <Settings className="w-3 h-3" />
                  Somente usuários com permissão avançada podem editar templates
                </div>
              </div>
              <div className="p-5 space-y-2">
                {template.sections.map((sec, i) => (
                  <div key={sec.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sec.required ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-700">{sec.label}</span>
                        {sec.required && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-medium">Obrigatório</span>}
                        {sec.editable !== undefined && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${sec.editable ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                            {sec.editable ? "✎ Editável" : "🔒 Automático"}
                          </span>
                        )}
                      </div>
                      {sec.description && <p className="text-xs text-slate-400">{sec.description}</p>}
                      {sec.defaultText && (
                        <div className="mt-1.5 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500 italic">
                          "{sec.defaultText}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const TABS = [
  { id: "usuarios",    label: "Usuários",             icon: Users,          description: "Pessoas do sistema" },
  { id: "perfis",      label: "Perfis de Permissão",  icon: Shield,         description: "Controle de acesso RBAC" },
  { id: "adendos",     label: "Adendos",              icon: FileText,       description: "Biblioteca global" },
  { id: "assinaturas", label: "Assinaturas",          icon: Users,          description: "Equipe Pontotel" },
  { id: "templates",   label: "Templates",            icon: LayoutTemplate, description: "Estrutura dos documentos" },
  { id: "pipedrive",   label: "Integração Pipedrive", icon: Zap,            description: "Webhook e automações" },
];

export default function Parametrizacoes() {
  const [activeTab, setActiveTab] = useState("usuarios");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Parametrizações</h1>
        <p className="text-sm text-slate-400 mt-0.5">Configurações globais do sistema de implantação</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${activeTab === tab.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "usuarios"    && <TabUsuarios />}
      {activeTab === "perfis"      && <TabPerfis />}
      {activeTab === "adendos"     && <TabAdendos />}
      {activeTab === "assinaturas" && <TabAssinaturas />}
      {activeTab === "templates"   && <TabTemplates />}
      {activeTab === "pipedrive"   && <TabIntegracaoPipedrive />}
    </div>
  );
}