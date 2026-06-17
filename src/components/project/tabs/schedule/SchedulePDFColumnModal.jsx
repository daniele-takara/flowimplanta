import { useState } from "react";
import { Download, X } from "lucide-react";
import { SCHEDULE_PDF_COLUMNS, SCHEDULE_PDF_DEFAULT_COLUMNS } from "@/lib/schedulePdfExport.js";

export default function SchedulePDFColumnModal({ onClose, onGenerate }) {
  const [selected, setSelected] = useState([...SCHEDULE_PDF_DEFAULT_COLUMNS]);

  const toggle = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectAll = () => setSelected(SCHEDULE_PDF_COLUMNS.map(c => c.key));
  const selectDefaults = () => setSelected([...SCHEDULE_PDF_DEFAULT_COLUMNS]);

  const groups = {};
  SCHEDULE_PDF_COLUMNS.forEach(c => {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-bold text-slate-800">Selecionar Colunas do PDF</h3>
            <p className="text-xs text-slate-400 mt-0.5">{selected.length} de {SCHEDULE_PDF_COLUMNS.length} colunas</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-50 flex gap-2">
          <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Marcar todas</button>
          <span className="text-slate-300">·</span>
          <button onClick={selectDefaults} className="text-xs text-blue-600 hover:underline">Restaurar padrão</button>
        </div>

        <div className="p-5 space-y-4">
          {Object.entries(groups).map(([group, cols]) => (
            <div key={group}>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
              <div className="space-y-1">
                {cols.map(c => (
                  <label key={c.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.key)}
                      onChange={() => toggle(c.key)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                    />
                    <span className={`text-xs ${selected.includes(c.key) ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => onGenerate(selected)}
            disabled={selected.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}