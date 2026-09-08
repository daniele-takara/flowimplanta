import { useState, useMemo } from "react";
import { X, Link2, Loader2 } from "lucide-react";

export default function DependencyModal({
  successorName,
  activities,
  currentPredecessors,
  currentOffset,
  onSave,
  onClose,
}) {
  const [selected, setSelected] = useState(new Set(currentPredecessors));
  const [offsetDays, setOffsetDays] = useState(currentOffset || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    (activities || []).forEach(a => {
      if (!map[a.phase]) map[a.phase] = [];
      map[a.phase].push(a);
    });
    return map;
  }, [activities]);

  const toggle = (ref) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(selected), offsetDays);
    } catch (e) {
      setError(e.message || "Erro ao salvar dependências");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Dependências</h3>
              <p className="text-sm text-slate-500 truncate max-w-md">{successorName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offset */}
        <div className="px-6 py-3 border-b border-slate-200 bg-indigo-50/50">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="font-medium">Iniciar</span>
            <input
              type="number"
              value={offsetDays}
              onChange={e => setOffsetDays(parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              min="0"
            />
            <span className="font-medium">dias úteis após o fim da predecessora</span>
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhuma atividade disponível.</p>
          ) : (
            Object.entries(grouped).map(([phase, acts]) => (
              <div key={phase} className="mb-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">{phase}</h4>
                <div className="space-y-0.5">
                  {acts.map(a => (
                    <label
                      key={a.ref}
                      className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                        selected.has(a.ref) ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(a.ref)}
                        onChange={() => toggle(a.ref)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm text-slate-700 flex-1">{a.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">{a.dateLabel || "—"}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            {selected.size > 0 ? `${selected.size} predecessora(s) selecionada(s)` : "Nenhuma selecionada"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}