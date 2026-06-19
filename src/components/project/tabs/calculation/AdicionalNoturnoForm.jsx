import { Info } from "lucide-react";
import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

export default function AdicionalNoturnoForm({ companyData, data, onChange, onInfoReducaoClick, onInfoProrrogacaoClick, onInfoReducaoAmbosClick, onInfoAdicionalPausaClick }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    hasJornadaNoturna: "sim",
    percAdicional: "20", horaInicioNoturna: "22:00", horaFimNoturna: "05:00",
    separarHENoturna: "nao",
    percHENoturnaComuns: "50", percHENoturnaSabado: "50", percHENoturnaDomingo: "100", percHENoturnaFeriado: "100",
    envioE02Comuns: false, codigoVerbaComuns: "", formatoComuns: "",
    envioE02Sabado: false, codigoVerbaSabado: "", formatoSabado: "",
    envioE02Domingo: false, codigoVerbaDomingo: "", formatoDomingo: "",
    envioE02Feriado: false, codigoVerbaFeriado: "", formatoFeriado: "",
    envioE02: false, codigoVerba: "",
    reducaoHoraPeriodo: "nao",
    reducaoConsideraAmbos: "nao",
    adicionalProrrogadoFimJornada: "nao",
    adicionalIncluiTempoPausa: "nao"
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
        <p className="font-semibold mb-1">Adicional Noturno</p>
        <p>Horário noturno padrão: 22:00 às 05:00. O adicional legal é de 20% sobre a hora diurna.</p>
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
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários trabalhando em jornada noturna?</label>
              <select value={val.hasJornadaNoturna || "sim"} onChange={e => updateRule(name, "hasJornadaNoturna", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasJornadaNoturna !== "nao" && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>% Adicional Noturno</label>
                <select value={val.percAdicional} onChange={e => updateRule(name, "percAdicional", e.target.value)} className={selectClass}>
                  <option value="20">20%</option>
                  <option value="25">25%</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Início Hora Noturna</label>
                <input value={val.horaInicioNoturna || "22:00"} onChange={e => updateRule(name, "horaInicioNoturna", e.target.value)} className={inputClass} type="time" />
              </div>
              <div>
                <label className={labelClass}>Fim Hora Noturna</label>
                <input value={val.horaFimNoturna || "05:00"} onChange={e => updateRule(name, "horaFimNoturna", e.target.value)} className={inputClass} type="time" />
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Separar HE Noturna e Diurna?</label>
              <select value={val.separarHENoturna || "nao"} onChange={e => updateRule(name, "separarHENoturna", e.target.value)} className={`${selectClass} max-w-xs mb-4`}>
                <option value="nao">Não — usar mesmos percentuais da HE diurna</option>
                <option value="sim">Sim — definir percentuais específicos</option>
              </select>

              {val.separarHENoturna === "sim" && (
                <div className="space-y-3">
                  {[
                    { key: "percHENoturnaComuns", label: "Dias Comuns", envioKey: "envioE02Comuns", codigoKey: "codigoVerbaComuns", formatoKey: "formatoComuns" },
                    { key: "percHENoturnaSabado", label: "Sábado", envioKey: "envioE02Sabado", codigoKey: "codigoVerbaSabado", formatoKey: "formatoSabado" },
                    { key: "percHENoturnaDomingo", label: "Domingo", envioKey: "envioE02Domingo", codigoKey: "codigoVerbaDomingo", formatoKey: "formatoDomingo" },
                    { key: "percHENoturnaFeriado", label: "Feriado", envioKey: "envioE02Feriado", codigoKey: "codigoVerbaFeriado", formatoKey: "formatoFeriado" },
                  ].map(p => (
                    <div key={p.key} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex flex-col md:flex-row md:items-start gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700">% {p.label}</label>
                          <select value={val[p.key] || "50"} onChange={e => updateRule(name, p.key, e.target.value)} className={`${selectClass} mt-1`}>
                            <option value="50">50%</option>
                            <option value="60">60%</option>
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                            <option value="custom">Personalizado</option>
                          </select>
                        </div>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {val.separarHENoturna !== "sim" && (
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Código de Verba</p>
              <div className="flex items-center gap-4">
                <input value={val.codigoVerba || ""} onChange={e => updateRule(name, "codigoVerba", e.target.value)} className={`${inputClass} max-w-[200px]`} placeholder="Cód. verba" />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                  Enviar ao arquivo de exportação para FOPAG
                </label>
              </div>
            </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Configurações Adicionais</p>
              
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Haverá redução de hora no período informado acima?
                  <button onClick={(e) => { e.preventDefault(); onInfoReducaoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o adicional noturno e a redução noturna"><Info className="w-3.5 h-3.5" /></button>
                </label>
                <select value={val.reducaoHoraPeriodo || "nao"} onChange={e => updateRule(name, "reducaoHoraPeriodo", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  A redução informada, será considerada apenas no adicional noturno ou também nas horas trabalhadas?
                  <button onClick={(e) => { e.preventDefault(); onInfoReducaoAmbosClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda a redução de hora noturna"><Info className="w-3.5 h-3.5" /></button>
                </label>
                <select value={val.reducaoConsideraAmbos || "nao"} onChange={e => updateRule(name, "reducaoConsideraAmbos", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  O adicional noturno deve ser prorrogado até o fim da jornada?
                  <button onClick={(e) => { e.preventDefault(); onInfoProrrogacaoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda a prorrogação do adicional noturno"><Info className="w-3.5 h-3.5" /></button>
                </label>
                <select value={val.adicionalProrrogadoFimJornada || "nao"} onChange={e => updateRule(name, "adicionalProrrogadoFimJornada", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  O adicional noturno inclui o tempo de pausa do funcionário?
                  <button onClick={(e) => { e.preventDefault(); onInfoAdicionalPausaClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o impacto do tempo de pausa no adicional noturno"><Info className="w-3.5 h-3.5" /></button>
                </label>
                <select value={val.adicionalIncluiTempoPausa || "nao"} onChange={e => updateRule(name, "adicionalIncluiTempoPausa", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
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
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}