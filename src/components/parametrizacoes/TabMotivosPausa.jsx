import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, PauseCircle } from "lucide-react";

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

export default function TabMotivosPausa() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ name: "", active: true, order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const items = await base44.entities.PauseReason.list("order");
      setList(items);
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", active: true, order: list.length });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, active: item.active !== false, order: item.order || 0 });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.PauseReason.update(editing.id, form);
      } else {
        await base44.entities.PauseReason.create(form);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Cadastre os motivos de pausa disponíveis ao pausar um projeto.</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Novo Motivo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <PauseCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Nenhum motivo de pausa cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(item => (
            <div key={item.id} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${!item.active ? "opacity-60" : ""}`}>
              <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => base44.entities.PauseReason.update(item.id, { active: !item.active }).then(load)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  {item.active ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                </button>
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{editing ? "Editar Motivo" : "Novo Motivo de Pausa"}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Motivo *</label>
                <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Aguardando retorno do cliente" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ordem de exibição</label>
                <input type="number" className={inputClass} value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Toggle value={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
                <span className="text-sm text-slate-600">{form.active ? "Ativo" : "Inativo"}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirm
          message="O motivo será removido permanentemente."
          onConfirm={async () => { await base44.entities.PauseReason.delete(deleteConfirm); setDeleteConfirm(null); load(); }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}