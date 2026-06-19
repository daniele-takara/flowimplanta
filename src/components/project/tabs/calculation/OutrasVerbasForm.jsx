import { useState } from "react";
import { inputClass, labelClass } from "@/lib/calcRulesShared";

export default function OutrasVerbasForm({ companyData, data, onChange }) {
  const d = { verbas: [], observacoes: "", incluirObservacoes: false, ...(data || {}) };
  const [novaVerba, setNovaVerba] = useState({ nome: "", codigo: "", percentual: "", descricao: "" });

  const add = () => {
    if (!novaVerba.nome.trim()) return;
    onChange({ ...d, verbas: [...(d.verbas || []), { ...novaVerba }] });
    setNovaVerba({ nome: "", codigo: "", percentual: "", descricao: "" });
  };

  const remove = (idx) => {
    const next = [...(d.verbas || [])];
    next.splice(idx, 1);
    onChange({ ...d, verbas: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className={labelClass}>Nome da Verba</label>
          <input value={novaVerba.nome} onChange={e => setNovaVerba(prev => ({ ...prev, nome: e.target.value }))} className={inputClass} placeholder="Ex: Adicional de Insalubridade" />
        </div>
        <div>
          <label className={labelClass}>Código</label>
          <input value={novaVerba.codigo} onChange={e => setNovaVerba(prev => ({ ...prev, codigo: e.target.value }))} className={`${inputClass} w-28`} placeholder="Ex: 1234" />
        </div>
        <div>
          <label className={labelClass}>%</label>
          <input value={novaVerba.percentual} onChange={e => setNovaVerba(prev => ({ ...prev, percentual: e.target.value }))} className={`${inputClass} w-20`} placeholder="Ex: 20" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className={labelClass}>Descrição</label>
          <input value={novaVerba.descricao} onChange={e => setNovaVerba(prev => ({ ...prev, descricao: e.target.value }))} className={inputClass} placeholder="Ex: Verba adicional" />
        </div>
        <button onClick={add} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-10 shrink-0">+</button>
      </div>

      {(d.verbas || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>}

      <div className="space-y-2">
        {(d.verbas || []).map((v, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-700">{v.nome}</span>
              <span className="text-xs text-slate-400 ml-3">cód: {v.codigo || "-"}</span>
              <span className="text-xs text-slate-400 ml-3">%: {v.percentual || "-"}</span>
              {v.descricao && <span className="text-xs text-slate-400 ml-3">{v.descricao}</span>}
            </div>
            <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 text-lg shrink-0 ml-2">&times;</button>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!d.incluirObservacoes} onChange={e => onChange({ ...d, incluirObservacoes: e.target.checked, observacoes: e.target.checked ? (d.observacoes || "") : "" })} className="w-4 h-4 accent-blue-600 rounded" />
          Incluir observações
        </label>
        {d.incluirObservacoes && (
          <textarea value={d.observacoes || ""} onChange={e => onChange({ ...d, observacoes: e.target.value })} className={`${inputClass} h-24 mt-2`} placeholder="Descreva as observações para outras verbas..." />
        )}
      </div>
    </div>
  );
}