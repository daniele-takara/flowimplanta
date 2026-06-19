import { Info } from "lucide-react";
import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

const intervalInputClass = "w-12 px-1.5 py-0.5 text-center text-sm border-0 border-b border-black bg-transparent focus:outline-none focus:border-blue-500 focus:border-b-2";
const intervalReadonlyClass = "w-12 px-1.5 py-0.5 text-center text-sm border-0 bg-slate-100 rounded";

export default function IntervalosForm({ companyData, data, onChange, onInfoToleranciasClick, ruleConfigurations, onInfoPausaHoraExtraClick }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    toleranciaPausaRefeicao: "", toleranciaPausaExcesso: "",
    calcularHoraExtraPausa: "nao",
    envioE02: false, codigoVerba: "",
    intervaloMinHoras: "4", intervaloMaxHoras: "6", intervaloMinMinutos: "15", intervaloMaxMinutos: "60"
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
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-700 mb-4">Divisão do intervalo para refeição e descanso</p>
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-slate-700">
                  <span>Entre</span>
                  <input value={val.intervaloMinHoras || "4"} onChange={e => updateRule(name, "intervaloMinHoras", e.target.value)} className={intervalInputClass} type="number" min="1" />
                  <span>e</span>
                  <input value={val.intervaloMaxHoras || "6"} onChange={e => updateRule(name, "intervaloMaxHoras", e.target.value)} className={intervalInputClass} type="number" min="1" />
                  <span>horas será devido</span>
                  <input value={val.intervaloMinMinutos || "15"} onChange={e => updateRule(name, "intervaloMinMinutos", e.target.value)} className={intervalInputClass} type="number" min="1" />
                  <span>mins</span>
                </div>
                <p className="text-xs text-slate-400 -mt-1 ml-0 pl-0">de intervalo para refeição</p>
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-slate-700">
                  <span>Mais que</span>
                  <input value={val.intervaloMaxHoras || "6"} readOnly className={intervalReadonlyClass} type="number" />
                  <span>horas será devido</span>
                  <input value={val.intervaloMaxMinutos || "60"} onChange={e => updateRule(name, "intervaloMaxMinutos", e.target.value)} className={intervalInputClass} type="number" min="1" />
                  <span>mins</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
              Tolerâncias (minutos)
              <button onClick={(e) => { e.preventDefault(); onInfoToleranciasClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda as tolerâncias de intervalo">
                <Info className="w-3.5 h-3.5" />
              </button>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Tolerância para duração da pausa refeição realizada</label>
                <input value={val.toleranciaPausaRefeicao || ""} onChange={e => updateRule(name, "toleranciaPausaRefeicao", e.target.value)} className={inputClass} type="number" placeholder="Ex: 10" />
              </div>
              <div>
                <label className={labelClass}>Tolerância para duração de pausa em excesso</label>
                <input value={val.toleranciaPausaExcesso || ""} onChange={e => updateRule(name, "toleranciaPausaExcesso", e.target.value)} className={inputClass} type="number" placeholder="Ex: 10" />
              </div>
            </div>

            {ruleConfigurations?.[name]?.model === "Flexível" && (
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                Caso o funcionário não cumpra o tempo total de pausa, deve ser calculada hora extra?
                <button onClick={(e) => { e.preventDefault(); onInfoPausaHoraExtraClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o impacto no cálculo de horas extras">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </p>
              <select value={val.calcularHoraExtraPausa || "nao"} onChange={e => updateRule(name, "calcularHoraExtraPausa", e.target.value)} className={selectClass}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            )}

            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Código de Verba</p>
              <div className="flex items-center gap-4">
                <input value={val.codigoVerba || ""} onChange={e => updateRule(name, "codigoVerba", e.target.value)} className={`${inputClass} max-w-[200px]`} placeholder="Cód. verba" />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                  Enviar ao arquivo de exportação para FOPAG
                </label>
              </div>
            </div>
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
            </div>
        );
      })}
    </div>
  );
}