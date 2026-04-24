import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Filter, FileText, Scale, Settings, DollarSign } from "lucide-react";

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

function AdendoForm({ adendo, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: adendo?.title || "",
    type: adendo?.type || "Técnico",
    description: adendo?.description || "",
    content: adendo?.content || "",
    active: adendo?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{adendo ? "Editar Adendo" : "Novo Adendo"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Título *</label>
            <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Título do adendo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo *</label>
              <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option>Jurídico</option>
                <option>Técnico</option>
                <option>Comercial</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${form.active ? "bg-green-500" : "bg-slate-300"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-slate-600">{form.active ? "Ativo" : "Inativo"}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição resumida</label>
            <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do adendo" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Texto do adendo *</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={8}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
              placeholder="Texto completo do adendo..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

  const handleSave = async (form) => {
    if (editing) {
      await base44.entities.Adendo.update(editing.id, form);
    } else {
      await base44.entities.Adendo.create(form);
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
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{adendo.content}</p>
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