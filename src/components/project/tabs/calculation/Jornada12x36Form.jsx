import { Info } from "lucide-react";
import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

export default function Jornada12x36Form({ companyData, data, onChange, onInfoFeriadoClick }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    hasJornada12x36: "sim",
    pagamentoFeriado: "normal",
    faltaFeriado: "sim"
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  return (
    <div className="space-y-6">
      {rules.map((name) => {
        const val = selected(name);
        const inhr = (d || {})[name] || {};
        const inhFrom = inhr._inheritingFrom || "";
        const inhLocked = ("_inheritingFrom" in inhr) && !!inhFrom;
        const inhActive = "_inheritingFrom" in inhr;
        return (
          <div key={name} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-800 mb-3">{name}</h4>

            <CopyFromRule rules={rules} currentRule={name} data={d} onChange={onChange} isInheriting={inhActive} inheritingFrom={inhFrom} />
            {inhLocked ? null : (
            <>
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários trabalhando em jornada 12x36?</label>
              <select value={val.hasJornada12x36 || "sim"} onChange={e => updateRule(name, "hasJornada12x36", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasJornada12x36 !== "nao" && (
            <>
            <div className="border-t pt-4 mb-4">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Funcionários com jornada 12x36 recebem como hora normal caso o dia trabalhado coincida com feriado?
                <button onClick={(e) => { e.preventDefault(); onInfoFeriadoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o pagamento de feriados na jornada 12x36">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <select value={val.pagamentoFeriado || "normal"} onChange={e => updateRule(name, "pagamentoFeriado", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="normal">Pagamento normal (dia útil)</option>
                <option value="extra">Pagamento de hora extra (considerando o feriado)</option>
              </select>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className="text-xs font-semibold text-slate-700">
                Funcionários 12x36 recebem falta caso não trabalhem em dias de feriado que coincidem com dias trabalhados?
              </label>
              <select value={val.faltaFeriado || "sim"} onChange={e => updateRule(name, "faltaFeriado", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="sim">Sim, é considerado falta</option>
                <option value="nao">Não, é considerado folga</option>
              </select>
            </div>
            <div className="border-t pt-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={!!val.incluirObservacoes} onChange={e => updateRule(name, "incluirObservacoes", e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
                Incluir observações
              </label>
              {val.incluirObservacoes && (
                <textarea value={val.observacoes || ""} onChange={e => updateRule(name, "observacoes", e.target.value)} className={`${inputClass} h-24 mt-2`} placeholder="Descreva as observações..." />
              )}
            </div>
            </>
            )}
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}