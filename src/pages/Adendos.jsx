import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Filter, FileText, Scale, Settings, DollarSign, Zap, X, Type, Database } from "lucide-react";
import { ADENDO_VARIABLES, CATEGORY_LABELS } from "@/lib/adendoVariables";

const TYPE_COLORS = {
  "Jurídico": "bg-purple-50 text-purple-700 border-purple-200",
  "Técnico": "bg-blue-50 text-blue-700 border-blue-200",
  "Comercial": "bg-green-50 text-green-700 border-green-200",
};

const TYPE_ICONS = {
  "Jurídico": Scale,
  "Técnico": Settings,
  "Comercial": DollarSign,
};

// ─── AdendoForm com builder de blocos ─────────────────────────────────────────

function AdendoForm({ adendo, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: adendo?.title || "",
    type: adendo?.type || "Técnico",
    description: adendo?.description || "",
    blocks: adendo?.blocks ? (() => { try { return JSON.parse(adendo.blocks); } catch { return []; } })() : [{ type: "text", value: "" }],
    active: adendo?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(null); // index do bloco que quer adicionar campo após

  const addTextBlock = () => {
    setForm(f => ({ ...f, blocks: [...f.blocks, { type: "text", value: "" }] }));
  };

  const addFieldBlock = (variableKey) => {
    setForm(f => ({ ...f, blocks: [...f.blocks, { type: "field", value: variableKey }] }));
    setShowFieldPicker(null);
  };

  const removeBlock = (idx) => {
    setForm(f => ({ ...f, blocks: f.blocks.filter((_, i) => i !== idx) }));
  };

  const updateBlock = (idx, value) => {
    setForm(f => {
      const blocks = [...f.blocks];
      blocks[idx] = { ...blocks[idx], value };
      return { ...f, blocks };
    });
  };

  const moveBlock = (idx, dir) => {
    setForm(f => {
      const blocks = [...f.blocks];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= blocks.length) return f;
      [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
      return { ...f, blocks };
    });
  };

  const buildContent = (blocks) => {
    return blocks.map(b => {
      if (b.type === "field") return b.value; // ex: {{client_name}}
      return b.value;
    }).join("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const content = buildContent(form.blocks);
    await onSave({
      ...form,
      content,
      blocks: JSON.stringify(form.blocks),
    });
    setSaving(false);
  };

  // Preview
  const previewContent = form.blocks.map(b => {
    if (b.type === "field") {
      const v = ADENDO_VARIABLES.find(x => x.key === b.value);
      return v ? v.example : b.value;
    }
    return b.value;
  }).join("");

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const textareaClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-base font-bold text-slate-800">{adendo ? "Editar Adendo" : "Novo Adendo"}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Campos básicos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Título *</label>
              <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Título do adendo" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo *</label>
              <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option>Jurídico</option>
                <option>Técnico</option>
                <option>Comercial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição resumida</label>
            <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do adendo" />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${form.active ? "bg-green-500" : "bg-slate-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
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
                <div key={idx} className="relative flex items-start gap-2 group">
                  {/* Controles de ordem */}
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

                  {/* Bloco */}
                  <div className={`flex-1 rounded-xl border-2 transition-all ${
                    block.type === "field"
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-slate-200 bg-white"
                  }`}>
                    <div className="flex items-center gap-2 px-2 py-1 border-b border-slate-100">
                      <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${
                        block.type === "field" ? "text-blue-600" : "text-slate-500"
                      }`}>
                        {block.type === "field"
                          ? <><Database className="w-3 h-3" /> Campo do projeto</>
                          : <><Type className="w-3 h-3" /> Texto</>
                        }
                      </span>
                      <span className="flex-1" />
                      <button type="button" onClick={() => removeBlock(idx)}
                        className="text-slate-300 hover:text-red-400 p-0.5" title="Remover bloco">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2">
                      {block.type === "field" ? (
                        <select
                          className={inputClass}
                          value={block.value}
                          onChange={e => updateBlock(idx, e.target.value)}
                        >
                          <option value="">— Selecionar campo —</option>
                          {ADENDO_VARIABLES.map(v => (
                            <option key={v.key} value={v.key}>{v.label} ({v.key})</option>
                          ))}
                        </select>
                      ) : (
                        <textarea
                          className={textareaClass}
                          rows={2}
                          value={block.value}
                          onChange={e => updateBlock(idx, e.target.value)}
                          placeholder="Digite o texto do adendo aqui..."
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botões de adicionar bloco */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={addTextBlock}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
              >
                <Type className="w-4 h-4" /> Adicionar bloco de texto
              </button>
              <button
                type="button"
                onClick={() => setShowFieldPicker(showFieldPicker === null ? true : null)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <Database className="w-4 h-4" /> Adicionar campo do projeto
              </button>
            </div>

            {/* Seletor de campo (dropdown) */}
            {showFieldPicker && (
              <div className="mt-3 border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-blue-700 uppercase">Selecionar campo do projeto</span>
                  <button type="button" onClick={() => setShowFieldPicker(null)} className="ml-auto text-blue-400 hover:text-blue-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
                  {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                    const vars = ADENDO_VARIABLES.filter(v => v.category === catKey);
                    if (vars.length === 0) return null;
                    return (
                      <div key={catKey}>
                        <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">{catLabel}</span>
                        <div className="space-y-1">
                          {vars.map(v => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => addFieldBlock(v.key)}
                              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all group cursor-pointer"
                            >
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
            <button type="submit" disabled={saving || !form.title} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Adendos() {
  const [adendos, setAdendos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("Todos");
  const [filterActive, setFilterActive] = useState("Todos");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.Adendo.list("-created_date");
    setAdendos(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (formData) => {
    if (editing) {
      await base44.entities.Adendo.update(editing.id, formData);
    } else {
      await base44.entities.Adendo.create(formData);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Adendo.delete(id);
    setDeleteConfirm(null);
    load();
  };

  const handleToggleActive = async (adendo) => {
    await base44.entities.Adendo.update(adendo.id, { active: !adendo.active });
    load();
  };

  const filtered = adendos.filter(a => {
    if (filterType !== "Todos" && a.type !== filterType) return false;
    if (filterActive === "Ativos" && !a.active) return false;
    if (filterActive === "Inativos" && a.active) return false;
    return true;
  });

  // Preview helper: renderiza blocos como preview resumido
  const renderBlocksPreview = (adendo) => {
    let blocks = [];
    try { blocks = JSON.parse(adendo.blocks || "[]"); } catch { return adendo.content || ""; }
    return blocks.map(b => {
      if (b.type === "field") {
        const v = ADENDO_VARIABLES.find(x => x.key === b.value);
        return v ? v.label : b.value;
      }
      return b.value?.substring(0, 80) + (b.value?.length > 80 ? "..." : "");
    }).join(" ");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Adendos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Biblioteca global de adendos reutilizáveis em qualquer projeto</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Adendo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Tipo:</span>
          {["Todos", "Jurídico", "Técnico", "Comercial"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${filterType === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          {["Todos", "Ativos", "Inativos"].map(s => (
            <button key={s} onClick={() => setFilterActive(s)}
              className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${filterActive === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum adendo encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(adendo => {
            const TypeIcon = TYPE_ICONS[adendo.type] || FileText;
            return (
              <div key={adendo.id} className={`bg-white rounded-xl border p-5 flex items-start gap-4 ${!adendo.active ? "opacity-60" : ""}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[adendo.type]?.split(" ").slice(0, 2).join(" ") || "bg-slate-100"}`}>
                  <TypeIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-800">{adendo.title}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[adendo.type] || "bg-slate-100 text-slate-500"}`}>{adendo.type}</span>
                    {!adendo.active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inativo</span>}
                  </div>
                  {adendo.description && <p className="text-xs text-slate-500 mt-0.5">{adendo.description}</p>}
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{renderBlocksPreview(adendo)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggleActive(adendo)} title={adendo.active ? "Desativar" : "Ativar"}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
                    {adendo.active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditing(adendo); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-slate-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(adendo.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <AdendoForm
          adendo={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-800 mb-2">Excluir adendo?</h3>
            <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita. O adendo será removido da biblioteca global.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}