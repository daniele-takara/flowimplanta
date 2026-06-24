import { Info, Trash2 } from "lucide-react";
import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

export default function DSRForm({ companyData, data, onChange, onInfoHEFeriadoClick, onInfoMesDescontoClick, hideFopag }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    tipoHEFeriado: "extra",
    pausaFolgaHoraTrabalhada: "nao_considerar",
    dsrDobroFalta: "sim",
    mesDescontoDSR: "falta",
    dispensaParcial: "atraso",
    envioE02: false,
    codigoVerba: "",
    formatoVerba: "",
    verbas: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const addVerba = (name) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas.push({ nome: "", codigo: "", percentual: "" });
    onChange({ ...d, [name]: { ...val, verbas } });
  };

  const removeVerba = (name, idx) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas.splice(idx, 1);
    onChange({ ...d, [name]: { ...val, verbas } });
  };

  const updateVerba = (name, idx, field, value) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas[idx] = { ...verbas[idx], [field]: value };
    onChange({ ...d, [name]: { ...val, verbas } });
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
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Se o funcionário trabalhar em um dia de feriado ou folga, qual o tipo de % de Hora Extra deve ser considerada caso não seja realizada a pausa refeição? Selecione a opção mais indicada.
                <button onClick={(e) => { e.preventDefault(); onInfoHEFeriadoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors shrink-0" title="Entenda os modelos">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <select value={val.tipoHEFeriado || "extra"} onChange={e => updateRule(name, "tipoHEFeriado", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="extra">Extra</option>
                <option value="nao_considerar">Não considerar</option>
              </select>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Caso o funcionário trabalhe em um dia de folga, a pausa refeição deve ser considerada como hora trabalhada?</label>
              <select value={val.pausaFolgaHoraTrabalhada || "nao_considerar"} onChange={e => updateRule(name, "pausaFolgaHoraTrabalhada", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Selecione uma opção</option>
                <option value="nao_considerar">Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 08:00 trabalhadas (não considerando a pausa)</option>
                <option value="considerar">Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 09:00 trabalhadas (considerando a pausa)</option>
              </select>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Se o funcionário falta em uma semana com feriado, é descontado DSR em dobro?</label>
              <select value={val.dsrDobroFalta || "sim"} onChange={e => updateRule(name, "dsrDobroFalta", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="sim">Sim, descontar o DSR do domingo e do feriado</option>
                <option value="nao">Não, descontar apenas um DSR</option>
              </select>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Quando a falta for realizada em uma semana em que o domingo acontecerá na próxima folha, o desconto será:
                <button onClick={(e) => { e.preventDefault(); onInfoMesDescontoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors shrink-0" title="Entenda o mês de desconto do DSR">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <select value={val.mesDescontoDSR || "falta"} onChange={e => updateRule(name, "mesDescontoDSR", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="falta">Realizado na folha em que ocorreu a falta</option>
                <option value="proximo_mes">No próximo mês, olhando para o domingo</option>
              </select>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Em dias de falta com dispensa parcial lançada, é considerado atraso ou falta?</label>
              <select value={val.dispensaParcial || "atraso"} onChange={e => updateRule(name, "dispensaParcial", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Selecione uma opção</option>
                <option value="atraso">Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, as horas serão descontadas como atraso.</option>
                <option value="falta">Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, o dia será contabilizado como falta.</option>
              </select>
            </div>

            {!hideFopag && (
            <div className="border-t pt-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-3">
                <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                Enviar para arquivo de exportação para FOPAG (E02)?
              </label>
              {val.envioE02 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                  <input value={val.codigoVerba || ""} onChange={e => updateRule(name, "codigoVerba", e.target.value)} className={inputClass} placeholder="Código da verba" />
                  <select value={val.formatoVerba || ""} onChange={e => updateRule(name, "formatoVerba", e.target.value)} className={selectClass}>
                    <option value="">Selecione o formato</option>
                    <option value="Dia">Dia</option>
                    <option value="HH:MM">HH:MM</option>
                    <option value="Centesimal">Centesimal</option>
                  </select>
                </div>
              )}
            </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Folga/Feriado/DSR)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">+ Adicionar Verba</button>
              </div>
              {(val.verbas || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>}
              {(val.verbas || []).map((v, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Verba #{i + 1}</span>
                    <button onClick={() => removeVerba(name, i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={v.nome || ""} onChange={e => updateVerba(name, i, "nome", e.target.value)} className={inputClass} placeholder="Nome da verba" />
                    <input value={v.codigo || ""} onChange={e => updateVerba(name, i, "codigo", e.target.value)} className={inputClass} placeholder="Código" />
                    <input value={v.percentual || ""} onChange={e => updateVerba(name, i, "percentual", e.target.value)} className={inputClass} placeholder="%" />
                  </div>
                </div>
              ))}
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