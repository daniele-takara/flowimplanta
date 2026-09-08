import { useState } from "react";
import { X, Save, Loader2, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ObservationsModal({ activity, onSaved, onClose }) {
  const [text, setText] = useState(activity.history_observations || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.ScheduleActivity.update(activity.id, { history_observations: text });
      onSaved({ ...activity, history_observations: text });
      onClose();
    } catch (err) {
      console.error("[ObservationsModal] Erro ao salvar:", err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800">Observações da Atividade</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-2 font-medium truncate">{activity.activity_name}</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder="Adicione observações, comentários ou histórico..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}