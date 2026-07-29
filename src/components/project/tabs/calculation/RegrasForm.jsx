import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

export default function RegrasForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};
  const selected = (name) => d[name] || { model: "", entradaToleranciaAtraso: "", saidaToleranciaAntecipada: "", entradaToleranciaExtra: "", saidaToleranciaExtra: "", toleranciaAtraso: "", toleranciaExtra: "", janelaAntes: "", janelaDepois: "" };
  const getInherit = (name) => {
    const val = selected(name);
    const from = val._inheritingFrom || "";
    return { isInheriting: "_inheritingFrom" in val, inheritingFrom: from, locked: ("_inheritingFrom" in val) && !!from };
  };

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo anterior primeiro.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Modelos de Regra</p>
        <p><strong>Fixo:</strong> Por Entrada e Saída — sem compensação automática. Cada evento (atraso/extra) gera apontamento individual.</p>
        <p><strong>Flexível:</strong> Por Período — compensação automática dentro das janelas definidas.</p>
        <p><strong>Híbrido:</strong> Mistura os dois modelos anteriores com tolerâncias e compensação.</p>
      </div>
      {rules.map((name) => {
        const val = selected(name);

        return (
          <div key={name} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-800 mb-3">{name}</h4>

            <CopyFromRule rules={rules} currentRule={name} data={d} onChange={onChange} isInheriting={getInherit(name).isInheriting} inheritingFrom={getInherit(name).inheritingFrom} />
            {getInherit(name).locked ? null : (
            <>
            <div className="mb-4">
              <label className={labelClass}>Modelo</label>
              <select value={val.model} onChange={e => onChange({ ...d, [name]: { ...val, model: e.target.value } })} className={selectClass}>
                <option value="">Selecione...</option>
                <option value="Fixo">Fixo — Por Entrada e Saída</option>
                <option value="Flexível">Flexível — Por Período</option>
                <option value="Híbrido">Híbrido</option>
              </select>
            </div>

            {val.model === "Fixo" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tolerância Atraso Entrada (min)</label>
                  <input value={val.entradaToleranciaAtraso || ""} onChange={e => onChange({ ...d, [name]: { ...val, entradaToleranciaAtraso: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className={labelClass}>Tolerância Antecipação Saída (min)</label>
                  <input value={val.saidaToleranciaAntecipada || ""} onChange={e => onChange({ ...d, [name]: { ...val, saidaToleranciaAntecipada: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className={labelClass}>Tolerância Extra Entrada (min)</label>
                  <input value={val.entradaToleranciaExtra || ""} onChange={e => onChange({ ...d, [name]: { ...val, entradaToleranciaExtra: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className={labelClass}>Tolerância Extra Saída (min)</label>
                  <input value={val.saidaToleranciaExtra || ""} onChange={e => onChange({ ...d, [name]: { ...val, saidaToleranciaExtra: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
              </div>
            )}

            {val.model === "Flexível" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tolerância para cálculo de hora extra</label>
                  <input value={val.janelaAntes || ""} onChange={e => onChange({ ...d, [name]: { ...val, janelaAntes: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 30" />
                </div>
                <div>
                  <label className={labelClass}>Tolerância para cálculo de atraso</label>
                  <input value={val.janelaDepois || ""} onChange={e => onChange({ ...d, [name]: { ...val, janelaDepois: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 30" />
                </div>
              </div>
            )}

            {val.model === "Híbrido" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tolerância de Atraso (min)</label>
                  <input value={val.toleranciaAtraso || ""} onChange={e => onChange({ ...d, [name]: { ...val, toleranciaAtraso: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className={labelClass}>Tolerância Extra (min)</label>
                  <input value={val.toleranciaExtra || ""} onChange={e => onChange({ ...d, [name]: { ...val, toleranciaExtra: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className={labelClass}>Janela Antes (min)</label>
                  <input value={val.janelaAntes || ""} onChange={e => onChange({ ...d, [name]: { ...val, janelaAntes: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 30" />
                </div>
                <div>
                  <label className={labelClass}>Janela Depois (min)</label>
                  <input value={val.janelaDepois || ""} onChange={e => onChange({ ...d, [name]: { ...val, janelaDepois: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 30" />
                </div>
              </div>
            )}
            <div className="border-t pt-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={!!val.incluirObservacoes} onChange={e => onChange({ ...d, [name]: { ...val, incluirObservacoes: e.target.checked } })} className="w-4 h-4 accent-blue-600 rounded" />
                Incluir observações
              </label>
              {val.incluirObservacoes && (
                <textarea value={val.observacoes || ""} onChange={e => onChange({ ...d, [name]: { ...val, observacoes: e.target.value } })} className={`${inputClass} h-24 mt-2`} placeholder="Descreva as observações..." />
              )}
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}