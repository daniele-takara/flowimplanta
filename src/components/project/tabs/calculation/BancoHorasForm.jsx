import { Info, Trash2 } from "lucide-react";
import { inputClass, labelClass, selectClass, FATORES_OPTIONS, APONTAMENTO_OPTIONS } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

const defaultFatores = FATORES_OPTIONS.map(f => ({ key: f.key, ativo: false, fator: "", fatorCustom: "" }));

export default function BancoHorasForm({ companyData, data, onChange, onInfoAcumuloClick, hideFopag }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => {
    const ruleData = d[name] || {};
    return {
      formato: "",
      dataInicio: "",
      limiteDias: "",
      limiteDiasCustom: "",
      criterioAcumulo: "",
      prazoVencimento: "",
      limiteAcumuloTipo: "",
      saldoAutomatico: "",
      mostrarHistorico: "",
      verbas: [],
      fatoresTransformacao: defaultFatores,
      ...ruleData,
      fatoresTransformacao: ruleData.fatoresTransformacao?.length ? ruleData.fatoresTransformacao : defaultFatores,
    };
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const toggleFator = (name, fatorKey) => {
    const val = selected(name);
    const fatores = val.fatoresTransformacao.map(f =>
      f.key === fatorKey ? { ...f, ativo: !f.ativo, fator: f.ativo ? "" : f.fator, fatorCustom: f.ativo ? "" : f.fatorCustom } : f
    );
    onChange({ ...d, [name]: { ...val, fatoresTransformacao: fatores } });
  };

  const updateFator = (name, fatorKey, field, value) => {
    const val = selected(name);
    const fatores = val.fatoresTransformacao.map(f =>
      f.key === fatorKey ? { ...f, [field]: value } : f
    );
    onChange({ ...d, [name]: { ...val, fatoresTransformacao: fatores } });
  };

  const addVerba = (name) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas.push({ apontamento: "", envioE02: false });
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
              <label className={labelClass}>Qual o formato do banco de horas?</label>
              <select value={val.formato || ""} onChange={e => updateRule(name, "formato", e.target.value)} className={`${selectClass} max-w-sm mt-1`}>
                <option value="">Selecione o formato</option>
                <option value="compensacao_geral">Compensação geral</option>
                <option value="por_janela">Compensação por janelas / Cascata</option>
              </select>
            </div>

            {val.formato === "compensacao_geral" && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <label className={labelClass}>Modelo de Banco de Horas</label>
                <div className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500">Compensação Geral</div>
              </div>
              <div>
                <label className={labelClass}>Data de início de banco de horas na Pontotel</label>
                <input value={val.dataInicio || ""} onChange={e => updateRule(name, "dataInicio", e.target.value)} className={`${inputClass} max-w-sm`} type="date" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qual o limite de dias para acúmulo/vencimento do banco de horas?</label>
                <select value={val.limiteDias || ""} onChange={e => updateRule(name, "limiteDias", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione o limite</option>
                  <option value="90">90 dias</option>
                  <option value="180">180 dias</option>
                  <option value="365">365 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
                {val.limiteDias === "custom" && (
                  <input value={val.limiteDiasCustom || ""} onChange={e => updateRule(name, "limiteDiasCustom", e.target.value)} className={`${inputClass} max-w-sm mt-2`} type="number" placeholder="Quantidade de dias" />
                )}
              </div>
              <div>
                <label className={labelClass}>Qual o critério para o início de acúmulo das horas no banco?</label>
                <select value={val.criterioAcumulo || ""} onChange={e => updateRule(name, "criterioAcumulo", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione o critério</option>
                  <option value="data_admissao">Data de admissão</option>
                  <option value="data_inicio_banco">Data de início do banco</option>
                </select>
              </div>
            </div>
            )}

            {val.formato === "por_janela" && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <label className={labelClass}>Modelo de Banco de Horas</label>
                <div className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500">Por Janela</div>
              </div>
              <div>
                <label className={labelClass}>Data de início de banco de horas na Pontotel</label>
                <input value={val.dataInicio || ""} onChange={e => updateRule(name, "dataInicio", e.target.value)} className={`${inputClass} max-w-sm`} type="date" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Qual o limite de dias para acúmulo/vencimento do banco de horas?</label>
                <select value={val.limiteDias || ""} onChange={e => updateRule(name, "limiteDias", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione o limite</option>
                  <option value="90">90 dias</option>
                  <option value="180">180 dias</option>
                  <option value="365">365 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
                {val.limiteDias === "custom" && (
                  <input value={val.limiteDiasCustom || ""} onChange={e => updateRule(name, "limiteDiasCustom", e.target.value)} className={`${inputClass} max-w-sm mt-2`} type="number" placeholder="Quantidade de dias" />
                )}
              </div>
              <div>
                <label className={labelClass}>Prazo de vencimento</label>
                <select value={val.prazoVencimento || ""} onChange={e => updateRule(name, "prazoVencimento", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione o prazo</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                  <option value="custom">Personalizado</option>
                </select>
                {val.prazoVencimento === "custom" && (
                  <input value={val.prazoVencimentoCustom || ""} onChange={e => updateRule(name, "prazoVencimentoCustom", e.target.value)} className={`${inputClass} max-w-sm mt-2`} type="number" placeholder="Quantidade de meses" />
                )}
              </div>
            </div>
            )}

            {val.formato && (
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                Acúmulo em banco de horas e fator de transformação
                <button onClick={(e) => { e.preventDefault(); onInfoAcumuloClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o acúmulo e fator de transformação"><Info className="w-3.5 h-3.5" /></button>
              </p>
              <div className="space-y-2">
                {FATORES_OPTIONS.map(fatorOpt => {
                  const fatorData = val.fatoresTransformacao.find(f => f.key === fatorOpt.key) || { ativo: false, fator: "", fatorCustom: "" };
                  return (
                    <div key={fatorOpt.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-[200px]">
                          <input type="checkbox" checked={!!fatorData.ativo} onChange={() => toggleFator(name, fatorOpt.key)} className="w-4 h-4 accent-purple-600 rounded shrink-0" />
                          <span className="text-sm text-slate-700">{fatorOpt.label}</span>
                        </label>
                        {fatorData.ativo && (
                          <div className="flex items-center gap-2">
                            <select value={fatorData.fator || ""} onChange={e => updateFator(name, fatorOpt.key, "fator", e.target.value)} className="w-28 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">Fator</option>
                              <option value="1_para_1">1 para 1</option>
                              <option value="1_para_2">1 para 2</option>
                              <option value="OUTRO">OUTRO</option>
                            </select>
                            {fatorData.fator === "OUTRO" && (
                              <input value={fatorData.fatorCustom || ""} onChange={e => updateFator(name, fatorOpt.key, "fatorCustom", e.target.value)} className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1 p/ 3" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {val.formato && (
            <div className="border-t pt-4 mt-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-800">Existe algum limite de acúmulo diário, mensal, semanal ou geral?</label>
                <p className="text-xs text-slate-500 mb-2">Caso tenha limitação, todo o saldo remanescente que ultrapasse o limite definido, será direcionado diretamente para pagamento, sendo hora extra para saldo positivo e atraso para saldos negativos.</p>
                <select value={val.limiteAcumuloTipo || ""} onChange={e => updateRule(name, "limiteAcumuloTipo", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione o tipo de limite</option>
                  <option value="diario">Diário</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="geral">Geral</option>
                  <option value="sem_acumulo">Sem acúmulo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">Os saldos devem entrar automaticamente para banco de horas?</label>
                <p className="text-xs text-slate-500 mb-2">Ao deixar o saldo do dia para entrar automaticamente para o banco de horas, significa que todos os dias que houver apontamento (positivos e negativos) farão a compensação automaticamente no banco de horas, podendo ser reprovado pontualmente caso opte por pagar aquele crédito ou débito.</p>
                <select value={val.saldoAutomatico || ""} onChange={e => updateRule(name, "saldoAutomatico", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione uma opção</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">Mostrar histórico de saldo anterior após a baixa?</label>
                <select value={val.mostrarHistorico || ""} onChange={e => updateRule(name, "mostrarHistorico", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="">Selecione uma opção</option>
                  <option value="sim">Sim, mesmo após a baixa do banco de horas, o sistema continuará mostrando o saldo anterior que já foi pago ao colaborador.</option>
                  <option value="nao">Não, após a baixa o saldo é zerado e o histórico de horas já pagas não será exibido.</option>
                </select>
              </div>
            </div>
            )}

            {val.formato && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Banco de Horas)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">+ Adicionar Verba</button>
              </div>
              {(val.verbas || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>}
              {(val.verbas || []).map((v, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-600">Verba #{i + 1}</span>
                    <button onClick={() => removeVerba(name, i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div>
                    <label className={labelClass}>Nome do Apontamento</label>
                    <select value={v.apontamento || ""} onChange={e => updateVerba(name, i, "apontamento", e.target.value)} className={selectClass}>
                      <option value="">Selecione um apontamento</option>
                      {APONTAMENTO_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label} — {opt.desc}</option>
                      ))}
                    </select>
                  </div>
                  {!hideFopag && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-3">
                    <input type="checkbox" checked={!!v.envioE02} onChange={e => updateVerba(name, i, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                    Enviar para arquivo de exportação para FOPAG (E02)?
                  </label>
                  )}
                </div>
              ))}
            </div>
            )}

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