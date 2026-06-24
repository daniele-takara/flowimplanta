import { useState } from "react";
import { inputClass, labelClass } from "@/lib/calcRulesStandaloneShared";

export default function DadosEmpresaForm({ data, onChange, project, readOnly }) {
  const d = { responsibleName: "", rulesNames: [], hasNightShift: true, has12x36Shift: true, hasTimeBank: true, ...(data || {}) };
  const [ruleInput, setRuleInput] = useState("");

  const addRule = () => {
    if (!ruleInput.trim()) return;
    onChange({ ...d, rulesNames: [...(d.rulesNames || []), ruleInput.trim()] });
    setRuleInput("");
  };

  const removeRule = (idx) => {
    const next = [...(d.rulesNames || [])];
    next.splice(idx, 1);
    onChange({ ...d, rulesNames: next });
  };

  const toggle = (field) => onChange({ ...d, [field]: !d[field] });

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
       <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dados da Empresa (Dados Iniciais)</p>
       <div>
         <span className="text-xs text-slate-400">Empresa</span>
         <p className="text-sm font-medium text-slate-700">{project?.client_name || "—"}</p>
       </div>
      </div>

      <div>
        <label className={labelClass}>Responsável</label>
        <input value={d.responsibleName} onChange={e => onChange({ ...d, responsibleName: e.target.value })} className={`${inputClass} max-w-sm`} placeholder="Nome do responsável pelas regras" disabled={readOnly} />
      </div>

      <div>
        <label className={labelClass}>Regras de Cálculo</label>
        <p className="text-xs text-slate-400 mb-2">Adicione os nomes das regras de cálculo da empresa</p>
        <div className="flex gap-2 mb-3">
          <input value={ruleInput} onChange={e => setRuleInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRule())} className={`${inputClass} flex-1`} placeholder="Ex: Matriz, Filial SP, Filial RJ..." disabled={readOnly} />
          <button onClick={addRule} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={readOnly}>Adicionar</button>
        </div>
        {d.rulesNames.length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma regra adicionada ainda.</p>}
        <div className="flex flex-wrap gap-2">
          {d.rulesNames.map((r, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full text-sm">
              {r}
              <button onClick={() => removeRule(i)} className="text-blue-400 hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Características da Empresa</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "hasNightShift", label: "Possui Adicional Noturno" },
            { key: "has12x36Shift", label: "Possui Jornada 12x36" },
            { key: "hasTimeBank", label: "Possui Banco de Horas" },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={!!d[item.key]} onChange={() => toggle(item.key)} className="w-4 h-4 accent-blue-600" disabled={readOnly} />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={!!d.incluirObservacoes} onChange={e => onChange({ ...d, incluirObservacoes: e.target.checked })} className="w-4 h-4 accent-blue-600 rounded" disabled={readOnly} />
          Incluir observações
        </label>
        {d.incluirObservacoes && (
          <textarea value={d.observacoes || ""} onChange={e => onChange({ ...d, observacoes: e.target.value })} className={`${inputClass} h-24 mt-2`} placeholder="Descreva as observações..." disabled={readOnly} />
        )}
      </div>
    </div>
  );
}