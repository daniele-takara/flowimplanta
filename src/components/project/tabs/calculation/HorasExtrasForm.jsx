import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function HorasExtrasForm({ companyData, data, onChange, onInfoDiariaClick, onInfoMensalClick, hideFopag }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    model: "", percDiasComuns: "50", percSabado: "50", percDomingo: "100", percFeriado: "100",
    envioE02DiasComuns: false, envioE02Sabado: false, envioE02Domingo: false, envioE02Feriado: false,
    codigoVerbaDiasComuns: "", codigoVerbaSabado: "", codigoVerbaDomingo: "", codigoVerbaFeriado: "",
    formatoDiasComuns: "", formatoSabado: "", formatoDomingo: "", formatoFeriado: "",
    categorizacaoHEDiaria: "Não", categorizacaoHEMensal: "Não",
    hasAdditionalRates: false, additionalRates: [],
    faixasLimiteDiaria: [], faixasLimiteMensal: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const addAdditionalRate = (name) => {
    const val = selected(name);
    const rates = [...(val.additionalRates || [])];
    rates.push({ name: "", percentage: "50", explanation: "", envioE02: false, codigoVerba: "", formato: "" });
    onChange({ ...d, [name]: { ...val, additionalRates: rates } });
  };

  const removeAdditionalRate = (name, idx) => {
    const val = selected(name);
    const rates = [...(val.additionalRates || [])];
    rates.splice(idx, 1);
    onChange({ ...d, [name]: { ...val, additionalRates: rates } });
  };

  const updateAdditionalRate = (name, idx, field, value) => {
    const val = selected(name);
    const rates = [...(val.additionalRates || [])];
    rates[idx] = { ...rates[idx], [field]: value };
    onChange({ ...d, [name]: { ...val, additionalRates: rates } });
  };

  const addFaixaLimite = (name, tipo) => {
    const val = selected(name);
    const key = tipo === "diaria" ? "faixasLimiteDiaria" : "faixasLimiteMensal";
    const faixas = [...(val[key] || [])];
    faixas.push({ inicio: "", fim: "", valorPorcentagem: "", envioE02: false, codigoVerba: "", formato: "" });
    onChange({ ...d, [name]: { ...val, [key]: faixas } });
  };

  const removeFaixaLimite = (name, tipo, idx) => {
    const val = selected(name);
    const key = tipo === "diaria" ? "faixasLimiteDiaria" : "faixasLimiteMensal";
    const faixas = [...(val[key] || [])];
    faixas.splice(idx, 1);
    onChange({ ...d, [name]: { ...val, [key]: faixas } });
  };

  const updateFaixaLimite = (name, tipo, idx, field, value) => {
    const val = selected(name);
    const key = tipo === "diaria" ? "faixasLimiteDiaria" : "faixasLimiteMensal";
    const faixas = [...(val[key] || [])];
    faixas[idx] = { ...faixas[idx], [field]: value };
    onChange({ ...d, [name]: { ...val, [key]: faixas } });
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-semibold mb-1">Percentuais de Hora Extra</p>
        <p>Configure os percentuais para cada tipo de dia. Os valores padrão seguem a CLT.</p>
      </div>

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
            {/* Percentuais e Envio FOPAG */}
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Percentuais de Hora Extra</p>
              <div className="space-y-3">
                {[
                  { key: "percDiasComuns", label: "Porcentagem da hora extra em dias comuns", envioKey: "envioE02DiasComuns", codigoKey: "codigoVerbaDiasComuns", formatoKey: "formatoDiasComuns" },
                  { key: "percSabado", label: "Porcentagem da hora extra aos sábados", envioKey: "envioE02Sabado", codigoKey: "codigoVerbaSabado", formatoKey: "formatoSabado" },
                  { key: "percDomingo", label: "Porcentagem da hora extra aos domingos", envioKey: "envioE02Domingo", codigoKey: "codigoVerbaDomingo", formatoKey: "formatoDomingo" },
                  { key: "percFeriado", label: "Porcentagem da hora extra em feriados", envioKey: "envioE02Feriado", codigoKey: "codigoVerbaFeriado", formatoKey: "formatoFeriado" },
                ].map(p => (
                  <div key={p.key} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-700">{p.label}</label>
                        <select value={val[p.key] || "50"} onChange={e => updateRule(name, p.key, e.target.value)} className={`${selectClass} mt-1`}>
                          <option value="50">50%</option>
                          <option value="60">60%</option>
                          <option value="75">75%</option>
                          <option value="100">100%</option>
                          <option value="custom">Personalizado</option>
                        </select>
                      </div>
                      {!hideFopag && (
                      <div className="flex-1 space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={!!val[p.envioKey]} onChange={e => updateRule(name, p.envioKey, e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                          Enviar para arquivo de exportação para FOPAG (E02)?
                        </label>
                        {val[p.envioKey] && (
                          <div className="space-y-2 pl-6">
                            <input value={val[p.codigoKey] || ""} onChange={e => updateRule(name, p.codigoKey, e.target.value)} className={inputClass} placeholder="Código da verba" />
                            <select value={val[p.formatoKey] || ""} onChange={e => updateRule(name, p.formatoKey, e.target.value)} className={selectClass}>
                              <option value="">Selecione o formato</option>
                              <option value="Dia">Dia</option>
                              <option value="HH:MM">HH:MM</option>
                              <option value="Centesimal">Centesimal</option>
                            </select>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categorização de HE */}
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Categorização de Horas Extras</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    Existe categorização de hora extra diária?
                    <button onClick={(e) => { e.preventDefault(); onInfoDiariaClick?.(); }} className="inline-flex"><Info className="w-3.5 h-3.5 text-purple-500 cursor-pointer hover:text-purple-700" /></button>
                  </label>
                  <select value={val.categorizacaoHEDiaria || "Não"} onChange={e => updateRule(name, "categorizacaoHEDiaria", e.target.value)} className={`${selectClass} mt-1`}>
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    Existe categorização de hora extra mensal?
                    <button onClick={(e) => { e.preventDefault(); onInfoMensalClick?.(); }} className="inline-flex"><Info className="w-3.5 h-3.5 text-purple-500 cursor-pointer hover:text-purple-700" /></button>
                  </label>
                  <select value={val.categorizacaoHEMensal || "Não"} onChange={e => updateRule(name, "categorizacaoHEMensal", e.target.value)} className={`${selectClass} mt-1`}>
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Faixas de Limitação Diária */}
            {val.categorizacaoHEDiaria === "Sim" && (
            <div className="border-t pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Faixas de Limitação Diária</p>
                <button onClick={() => addFaixaLimite(name, "diaria")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  + Adicionar Faixa
                </button>
              </div>
              {(val.faixasLimiteDiaria || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma faixa de limitação diária configurada.</p>
              )}
              {(val.faixasLimiteDiaria || []).map((f, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Faixa #{i + 1}</span>
                    <button onClick={() => removeFaixaLimite(name, "diaria", i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={f.inicio || ""} onChange={e => updateFaixaLimite(name, "diaria", i, "inicio", e.target.value)} className={inputClass} type="time" placeholder="Início" />
                    <input value={f.fim || ""} onChange={e => updateFaixaLimite(name, "diaria", i, "fim", e.target.value)} className={inputClass} type="time" placeholder="Fim" />
                    <select value={f.valorPorcentagem || ""} onChange={e => updateFaixaLimite(name, "diaria", i, "valorPorcentagem", e.target.value)} className={selectClass}>
                      <option value="">Valor da Porcentagem</option>
                      <option value="50">50%</option>
                      <option value="60">60%</option>
                      <option value="75">75%</option>
                      <option value="100">100%</option>
                    </select>
                  </div>
                  {!hideFopag && (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={!!f.envioE02} onChange={e => updateFaixaLimite(name, "diaria", i, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                      Enviar para arquivo de exportação para FOPAG (E02)?
                    </label>
                    {f.envioE02 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                        <input value={f.codigoVerba || ""} onChange={e => updateFaixaLimite(name, "diaria", i, "codigoVerba", e.target.value)} className={inputClass} placeholder="Código da verba" />
                        <select value={f.formato || ""} onChange={e => updateFaixaLimite(name, "diaria", i, "formato", e.target.value)} className={selectClass}>
                          <option value="">Selecione o formato</option>
                          <option value="Dia">Dia</option>
                          <option value="HH:MM">HH:MM</option>
                          <option value="Centesimal">Centesimal</option>
                        </select>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Faixas de Limitação Mensal */}
            {val.categorizacaoHEMensal === "Sim" && (
            <div className="border-t pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Faixas de Limitação Mensal</p>
                <button onClick={() => addFaixaLimite(name, "mensal")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  + Adicionar Faixa
                </button>
              </div>
              {(val.faixasLimiteMensal || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma faixa de limitação mensal configurada.</p>
              )}
              {(val.faixasLimiteMensal || []).map((f, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Faixa #{i + 1}</span>
                    <button onClick={() => removeFaixaLimite(name, "mensal", i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={f.inicio || ""} onChange={e => updateFaixaLimite(name, "mensal", i, "inicio", e.target.value)} className={inputClass} type="number" placeholder="Ex: 0" />
                    <input value={f.fim || ""} onChange={e => updateFaixaLimite(name, "mensal", i, "fim", e.target.value)} className={inputClass} type="number" placeholder="Ex: 150" />
                    <select value={f.valorPorcentagem || ""} onChange={e => updateFaixaLimite(name, "mensal", i, "valorPorcentagem", e.target.value)} className={selectClass}>
                      <option value="">Valor da Porcentagem</option>
                      <option value="50">50%</option>
                      <option value="60">60%</option>
                      <option value="75">75%</option>
                      <option value="100">100%</option>
                    </select>
                  </div>
                  {!hideFopag && (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={!!f.envioE02} onChange={e => updateFaixaLimite(name, "mensal", i, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                      Enviar para arquivo de exportação para FOPAG (E02)?
                    </label>
                    {f.envioE02 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                        <input value={f.codigoVerba || ""} onChange={e => updateFaixaLimite(name, "mensal", i, "codigoVerba", e.target.value)} className={inputClass} placeholder="Código da verba" />
                        <select value={f.formato || ""} onChange={e => updateFaixaLimite(name, "mensal", i, "formato", e.target.value)} className={selectClass}>
                          <option value="">Selecione o formato</option>
                          <option value="Dia">Dia</option>
                          <option value="HH:MM">HH:MM</option>
                          <option value="Centesimal">Centesimal</option>
                        </select>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Percentuais Adicionais */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={!!val.hasAdditionalRates} onChange={e => updateRule(name, "hasAdditionalRates", e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  Possui percentuais adicionais
                </label>
                {val.hasAdditionalRates && (
                  <button onClick={() => addAdditionalRate(name)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                    + Adicionar percentual
                  </button>
                )}
              </div>

              {(val.additionalRates || []).map((rate, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Percentual Adicional #{i + 1}</span>
                    <button onClick={() => removeAdditionalRate(name, i)} className="text-slate-400 hover:text-red-500 text-sm">&times;</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={rate.name || ""} onChange={e => updateAdditionalRate(name, i, "name", e.target.value)} className={inputClass} placeholder="Nome (ex: 70% extra)" />
                    <input value={rate.percentage || ""} onChange={e => updateAdditionalRate(name, i, "percentage", e.target.value)} className={inputClass} placeholder="Percentual (ex: 70)" />
                    <input value={rate.explanation || ""} onChange={e => updateAdditionalRate(name, i, "explanation", e.target.value)} className={inputClass} placeholder="Justificativa" />
                  </div>
                  {!hideFopag && (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={!!rate.envioE02} onChange={e => updateAdditionalRate(name, i, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                      Enviar para arquivo de exportação para FOPAG (E02)?
                    </label>
                    {rate.envioE02 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                        <input value={rate.codigoVerba || ""} onChange={e => updateAdditionalRate(name, i, "codigoVerba", e.target.value)} className={inputClass} placeholder="Código da verba" />
                        <select value={rate.formato || ""} onChange={e => updateAdditionalRate(name, i, "formato", e.target.value)} className={selectClass}>
                          <option value="">Selecione o formato</option>
                          <option value="Dia">Dia</option>
                          <option value="HH:MM">HH:MM</option>
                          <option value="Centesimal">Centesimal</option>
                        </select>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>

            {/* Observações */}
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