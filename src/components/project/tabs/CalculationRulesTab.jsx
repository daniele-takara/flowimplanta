import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Save, CheckCircle, Loader2, FileDown, RotateCcw, AlertCircle, Lock } from "lucide-react";
import { usePermissions } from "@/lib/usePermissions";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

// ── Helpers ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: "Dados da Empresa", key: "company_data" },
  { id: 2, title: "Configuração das Regras", key: "rule_configurations" },
  { id: 3, title: "Horas Extras", key: "overtime_rules" },
  { id: 4, title: "Intervalos", key: "break_time_rules" },
  { id: 5, title: "Adicional Noturno", key: "night_shift_rules" },
  { id: 6, title: "Jornada 12x36", key: "shift_12x36_rules" },
  { id: 7, title: "Sobreaviso", key: "sobreaviso_rules" },
  { id: 8, title: "Banco de Horas", key: "bank_hours_rules" },
  { id: 9, title: "DSR / Feriados", key: "dsr_rules" },
  { id: 10, title: "Outras Verbas", key: "other_verbs_rules" },
  { id: 11, title: "Revisão Final", key: null },
];

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

// ── Persistência ─────────────────────────────────────────────────────────────
function useWizardState(projectId) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await base44.entities.CalculationRule.filter({ project_id: projectId });
    setRecord(list[0] || null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data) => {
    setSaving(true);
    const payload = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) payload[k] = typeof v === "object" ? JSON.stringify(v) : v;
    });
    if (record?.id) {
      await base44.entities.CalculationRule.update(record.id, payload);
      setRecord(prev => ({ ...prev, ...payload }));
    } else {
      const created = await base44.entities.CalculationRule.create({ project_id: projectId, ...payload });
      setRecord(created);
    }
    setSaving(false);
  }, [record, projectId]);

  const getData = useCallback((key) => {
    if (!record) return null;
    const raw = record[key];
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, [record]);

  return { record, loading, saving, save, getData, reload: load };
}

// ── Step 1: Dados da Empresa ─────────────────────────────────────────────────
// Nome da Empresa vem dos Dados Iniciais do projeto — não é editável aqui
function DadosEmpresaForm({ data, onChange, project, readOnly }) {
  const d = { responsibleName: "", rulesNames: [], hasNightShift: true, has12x36Shift: true, hasOnCallWorkers: true, hasTimeBank: true, ...(data || {}) };
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
      {/* Info da empresa — somente leitura, dos Dados Iniciais */}
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
            { key: "hasOnCallWorkers", label: "Possui Sobreaviso" },
            { key: "hasTimeBank", label: "Possui Banco de Horas" },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={!!d[item.key]} onChange={() => toggle(item.key)} className="w-4 h-4 accent-blue-600" disabled={readOnly} />
              {item.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Configuração das Regras ──────────────────────────────────────────
function RegrasForm({ companyData, data, onChange }) {
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
                  <label className={labelClass}>Janela Antes (min)</label>
                  <input value={val.janelaAntes || ""} onChange={e => onChange({ ...d, [name]: { ...val, janelaAntes: e.target.value } })} className={inputClass} type="number" placeholder="Ex: 30" />
                </div>
                <div>
                  <label className={labelClass}>Janela Depois (min)</label>
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
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 3: Horas Extras ─────────────────────────────────────────────────────
function HorasExtrasForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    model: "", percDiasComuns: "50", percSabado: "50", percDomingo: "100", percFeriado: "100",
    envioE02DiasComuns: false, envioE02Sabado: false, envioE02Domingo: false, envioE02Feriado: false,
    codigoVerbaDiasComuns: "", codigoVerbaSabado: "", codigoVerbaDomingo: "", codigoVerbaFeriado: "",
    hasAdditionalRates: false, additionalRates: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const addAdditionalRate = (name) => {
    const val = selected(name);
    const rates = [...(val.additionalRates || [])];
    rates.push({ name: "", percentage: "50", explanation: "", envioE02: false, codigoVerba: "" });
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
            {/* Percentuais principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { key: "percDiasComuns", label: "% Dias Comuns", envioKey: "envioE02DiasComuns", codigoKey: "codigoVerbaDiasComuns" },
                { key: "percSabado", label: "% Sábado", envioKey: "envioE02Sabado", codigoKey: "codigoVerbaSabado" },
                { key: "percDomingo", label: "% Domingo", envioKey: "envioE02Domingo", codigoKey: "codigoVerbaDomingo" },
                { key: "percFeriado", label: "% Feriado", envioKey: "envioE02Feriado", codigoKey: "codigoVerbaFeriado" },
              ].map(p => (
                <div key={p.key}>
                  <label className={labelClass}>{p.label}</label>
                  <select value={val[p.key] || "50"} onChange={e => updateRule(name, p.key, e.target.value)} className={selectClass}>
                    <option value="50">50%</option>
                    <option value="60">60%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Códigos de verba e envio E02 */}
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Códigos de Verba e Envio E02</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Dias Comuns", codigoKey: "codigoVerbaDiasComuns", envioKey: "envioE02DiasComuns" },
                  { label: "Sábado", codigoKey: "codigoVerbaSabado", envioKey: "envioE02Sabado" },
                  { label: "Domingo", codigoKey: "codigoVerbaDomingo", envioKey: "envioE02Domingo" },
                  { label: "Feriado", codigoKey: "codigoVerbaFeriado", envioKey: "envioE02Feriado" },
                ].map(p => (
                  <div key={p.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">{p.label}</p>
                    <input value={val[p.codigoKey] || ""} onChange={e => updateRule(name, p.codigoKey, e.target.value)} className={`${inputClass} mb-2`} placeholder="Cód. verba" />
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input type="checkbox" checked={!!val[p.envioKey]} onChange={e => updateRule(name, p.envioKey, e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                      Envio E02
                    </label>
                  </div>
                ))}
              </div>
            </div>

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
                    <input value={rate.codigoVerba || ""} onChange={e => updateAdditionalRate(name, i, "codigoVerba", e.target.value)} className={inputClass} placeholder="Cód. verba" />
                  </div>
                  <div className="mt-2 flex items-center gap-4">
                    <input value={rate.explanation || ""} onChange={e => updateAdditionalRate(name, i, "explanation", e.target.value)} className={`${inputClass} flex-1`} placeholder="Justificativa do percentual" />
                    <label className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                      <input type="checkbox" checked={!!rate.envioE02} onChange={e => updateAdditionalRate(name, i, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                      E02
                    </label>
                  </div>
                </div>
              ))}
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 4: Intervalos ───────────────────────────────────────────────────────
function IntervalosForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    model: "", toleranciaAtrasoPausa: "5", toleranciaInicioPausa: "10", toleranciaFimPausa: "10",
    envioE02: false, codigoVerba: "",
    ranges: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const addRange = (name) => {
    const val = selected(name);
    const ranges = [...(val.ranges || [])];
    ranges.push({ inicio: "", fim: "", duracaoPrevista: "" });
    onChange({ ...d, [name]: { ...val, ranges } });
  };

  const removeRange = (name, idx) => {
    const val = selected(name);
    const ranges = [...(val.ranges || [])];
    ranges.splice(idx, 1);
    onChange({ ...d, [name]: { ...val, ranges } });
  };

  const updateRange = (name, idx, field, value) => {
    const val = selected(name);
    const ranges = [...(val.ranges || [])];
    ranges[idx] = { ...ranges[idx], [field]: value };
    onChange({ ...d, [name]: { ...val, ranges } });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Modelos de Intervalo</p>
        <p><strong>Modelo 1:</strong> Tempo integral de pausa conta como hora trabalhada para compensação.</p>
        <p><strong>Modelo 2:</strong> Tempo excedente da pausa NÃO conta como hora trabalhada.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Modelo</label>
                <select value={val.model} onChange={e => updateRule(name, "model", e.target.value)} className={selectClass}>
                  <option value="">Selecione...</option>
                  <option value="Modelo 1">Modelo 1 — Tempo integral conta como trabalhada</option>
                  <option value="Modelo 2">Modelo 2 — Excedente NÃO conta como trabalhada</option>
                </select>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Tolerâncias (minutos)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Atraso da Pausa</label>
                <input value={val.toleranciaAtrasoPausa || ""} onChange={e => updateRule(name, "toleranciaAtrasoPausa", e.target.value)} className={inputClass} type="number" placeholder="Ex: 5" />
              </div>
              <div>
                <label className={labelClass}>Início da Pausa</label>
                <input value={val.toleranciaInicioPausa || ""} onChange={e => updateRule(name, "toleranciaInicioPausa", e.target.value)} className={inputClass} type="number" placeholder="Ex: 10" />
              </div>
              <div>
                <label className={labelClass}>Fim da Pausa</label>
                <input value={val.toleranciaFimPausa || ""} onChange={e => updateRule(name, "toleranciaFimPausa", e.target.value)} className={inputClass} type="number" placeholder="Ex: 10" />
                <p className="text-xs text-slate-400 mt-1">Tolerância para antecipação do fim da pausa.</p>
              </div>
            </div>

            {/* Faixas de horário */}
            <div className="border-t pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Faixas de Horário de Pausa</p>
                <button onClick={() => addRange(name)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  + Adicionar faixa
                </button>
              </div>
              {(val.ranges || []).map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 mb-2">
                  <span className="text-xs text-slate-400 font-mono w-5">{i + 1}.</span>
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div>
                      <span className="text-xs text-slate-400">Início</span>
                      <input value={r.inicio || ""} onChange={e => updateRange(name, i, "inicio", e.target.value)} className={inputClass} type="time" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Fim</span>
                      <input value={r.fim || ""} onChange={e => updateRange(name, i, "fim", e.target.value)} className={inputClass} type="time" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Dur. Prevista (min)</span>
                      <input value={r.duracaoPrevista || ""} onChange={e => updateRange(name, i, "duracaoPrevista", e.target.value)} className={inputClass} type="number" placeholder="Ex: 60" />
                    </div>
                  </div>
                  <button onClick={() => removeRange(name, i)} className="text-slate-400 hover:text-red-500 shrink-0">&times;</button>
                </div>
              ))}
              {(val.ranges || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma faixa configurada. O sistema usará a duração padrão da jornada.</p>
              )}
            </div>

            {/* Código de verba */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Código de Verba</p>
              <div className="flex items-center gap-4">
                <input value={val.codigoVerba || ""} onChange={e => updateRule(name, "codigoVerba", e.target.value)} className={`${inputClass} max-w-[200px]`} placeholder="Cód. verba" />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                  Envio E02
                </label>
              </div>
            </div>
            </>
            )}
          </div>
        );
      })}

    </div>
  );
}

// ── Step 5: Adicional Noturno ────────────────────────────────────────────────
function AdicionalNoturnoForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    percAdicional: "20", horaInicioNoturna: "22:00", horaFimNoturna: "05:00",
    separarHENoturna: "nao",
    percHENoturnaComuns: "50", percHENoturnaSabado: "50", percHENoturnaDomingo: "100", percHENoturnaFeriado: "100",
    envioE02: false, codigoVerba: ""
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
            {/* Configuração básica */}
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

            {/* Separação HE Noturna vs Diurna */}
            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Separar HE Noturna e Diurna?</label>
              <select value={val.separarHENoturna || "nao"} onChange={e => updateRule(name, "separarHENoturna", e.target.value)} className={`${selectClass} max-w-xs mb-4`}>
                <option value="nao">Não — usar mesmos percentuais da HE diurna</option>
                <option value="sim">Sim — definir percentuais específicos</option>
              </select>

              {val.separarHENoturna === "sim" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: "percHENoturnaComuns", label: "% Dias Comuns" },
                    { key: "percHENoturnaSabado", label: "% Sábado" },
                    { key: "percHENoturnaDomingo", label: "% Domingo" },
                    { key: "percHENoturnaFeriado", label: "% Feriado" },
                  ].map(p => (
                    <div key={p.key}>
                      <label className="text-xs text-slate-500">{p.label}</label>
                      <select value={val[p.key] || "50"} onChange={e => updateRule(name, p.key, e.target.value)} className={selectClass}>
                        <option value="50">50%</option>
                        <option value="60">60%</option>
                        <option value="75">75%</option>
                        <option value="100">100%</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Código de verba */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Código de Verba</p>
              <div className="flex items-center gap-4">
                <input value={val.codigoVerba || ""} onChange={e => updateRule(name, "codigoVerba", e.target.value)} className={`${inputClass} max-w-[200px]`} placeholder="Cód. verba" />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                  Envio E02
                </label>
              </div>
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 6: Jornada 12x36 ────────────────────────────────────────────────────
function Jornada12x36Form({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || { model: "", folgaFixa: false, diaFolga: "" };

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Modelo</label>
                <select value={val.model} onChange={e => onChange({ ...d, [name]: { ...val, model: e.target.value } })} className={selectClass}>
                  <option value="">Selecione...</option>
                  <option value="Modelo 1">Modelo 1 — Semana cheia 12x36</option>
                  <option value="Modelo 2">Modelo 2 — 12x36 com 4h extras semanais</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 pt-6">
                <input type="checkbox" checked={!!val.folgaFixa} onChange={e => onChange({ ...d, [name]: { ...val, folgaFixa: e.target.checked } })} className="w-4 h-4 accent-blue-600" />
                Possui dia de folga fixa
              </label>
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 7: Sobreaviso ───────────────────────────────────────────────────────
function SobreavisoForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || { percSobreaviso: "1/3" };

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
            <div>
              <label className={labelClass}>Percentual do Sobreaviso</label>
              <select value={val.percSobreaviso} onChange={e => onChange({ ...d, [name]: { ...val, percSobreaviso: e.target.value } })} className={`${selectClass} max-w-xs`}>
                <option value="1/3">1/3 do salário hora</option>
                <option value="1/2">1/2 do salário hora</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 8: Banco de Horas ───────────────────────────────────────────────────
function BancoHorasForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    model: "", periodoCompensacao: "mensal",
    limiteCreditoMensal: "", limiteDebitoMensal: "",
    limiteCreditoSemestral: "", limiteDebitoSemestral: "",
    permiteEstouro: false, toleranciaEstouro: "",
    envioE02: false, codigoVerbaCredito: "", codigoVerbaDebito: ""
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  return (
    <div className="space-y-6">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700">
        <p className="font-semibold mb-1">Banco de Horas</p>
        <p>Configure o período de compensação e os limites de acúmulo de crédito e débito de horas.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Modelo</label>
                <select value={val.model} onChange={e => updateRule(name, "model", e.target.value)} className={selectClass}>
                  <option value="">Selecione...</option>
                  <option value="Modelo 1">Modelo 1 — Compensação mensal</option>
                  <option value="Modelo 2">Modelo 2 — Compensação semestral</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Período de Compensação</label>
                <select value={val.periodoCompensacao} onChange={e => updateRule(name, "periodoCompensacao", e.target.value)} className={selectClass}>
                  <option value="mensal">Mensal</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>

            {/* Limites de acúmulo */}
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Limites de Acúmulo (horas)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-2">Crédito (saldo positivo)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-slate-400">Mensal</span>
                      <input value={val.limiteCreditoMensal || ""} onChange={e => updateRule(name, "limiteCreditoMensal", e.target.value)} className={inputClass} type="number" placeholder="Ex: 10" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Semestral</span>
                      <input value={val.limiteCreditoSemestral || ""} onChange={e => updateRule(name, "limiteCreditoSemestral", e.target.value)} className={inputClass} type="number" placeholder="Ex: 40" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 mb-2">Débito (saldo negativo)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-slate-400">Mensal</span>
                      <input value={val.limiteDebitoMensal || ""} onChange={e => updateRule(name, "limiteDebitoMensal", e.target.value)} className={inputClass} type="number" placeholder="Ex: 8" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Semestral</span>
                      <input value={val.limiteDebitoSemestral || ""} onChange={e => updateRule(name, "limiteDebitoSemestral", e.target.value)} className={inputClass} type="number" placeholder="Ex: 24" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estouro de limite */}
              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <input type="checkbox" checked={!!val.permiteEstouro} onChange={e => updateRule(name, "permiteEstouro", e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  Permitir estouro de limite
                </label>
                {val.permiteEstouro && (
                  <div>
                    <span className="text-xs text-slate-400">Tolerância de estouro (horas)</span>
                    <input value={val.toleranciaEstouro || ""} onChange={e => updateRule(name, "toleranciaEstouro", e.target.value)} className={`${inputClass} max-w-[150px]`} type="number" placeholder="Ex: 4" />
                  </div>
                )}
              </div>
            </div>

            {/* Códigos de verba */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Códigos de Verba</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Cód. Verba Crédito</label>
                  <input value={val.codigoVerbaCredito || ""} onChange={e => updateRule(name, "codigoVerbaCredito", e.target.value)} className={inputClass} placeholder="Código" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Cód. Verba Débito</label>
                  <input value={val.codigoVerbaDebito || ""} onChange={e => updateRule(name, "codigoVerbaDebito", e.target.value)} className={inputClass} placeholder="Código" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500 mt-3">
                <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                Envio E02
              </label>
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 9: DSR / Feriados ───────────────────────────────────────────────────
function DSRForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || { modeloDSR: "padrao" };

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
            <div>
              <label className={labelClass}>Modelo DSR/Feriados</label>
              <select value={val.modeloDSR} onChange={e => onChange({ ...d, [name]: { ...val, modeloDSR: e.target.value } })} className={`${selectClass} max-w-xs`}>
                <option value="padrao">Padrão — DSR incluso nas horas extras</option>
                <option value="separado">Separado — DSR calculado separadamente</option>
              </select>
            </div>
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 10: Outras Verbas ───────────────────────────────────────────────────
function OutrasVerbasForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = { verbas: [], ...(data || {}) };

  const [novaVerba, setNovaVerba] = useState({ nome: "", codigo: "", percentual: "" });

  const add = () => {
    if (!novaVerba.nome.trim()) return;
    onChange({ ...d, verbas: [...(d.verbas || []), { ...novaVerba }] });
    setNovaVerba({ nome: "", codigo: "", percentual: "" });
  };

  const remove = (idx) => {
    const next = [...(d.verbas || [])];
    next.splice(idx, 1);
    onChange({ ...d, verbas: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className={labelClass}>Nome da Verba</label>
          <input value={novaVerba.nome} onChange={e => setNovaVerba(prev => ({ ...prev, nome: e.target.value }))} className={inputClass} placeholder="Ex: Adicional de Insalubridade" />
        </div>
        <div>
          <label className={labelClass}>Código</label>
          <input value={novaVerba.codigo} onChange={e => setNovaVerba(prev => ({ ...prev, codigo: e.target.value }))} className={`${inputClass} w-28`} placeholder="Ex: 1234" />
        </div>
        <div>
          <label className={labelClass}>%</label>
          <input value={novaVerba.percentual} onChange={e => setNovaVerba(prev => ({ ...prev, percentual: e.target.value }))} className={`${inputClass} w-24`} placeholder="Ex: 20" />
        </div>
        <button onClick={add} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-10">+</button>
      </div>

      {(d.verbas || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>}

      <div className="space-y-2">
        {(d.verbas || []).map((v, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
            <div>
              <span className="text-sm font-medium text-slate-700">{v.nome}</span>
              <span className="text-xs text-slate-400 ml-3">cód: {v.codigo || "-"}</span>
              <span className="text-xs text-slate-400 ml-3">%: {v.percentual || "-"}</span>
            </div>
            <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 text-lg">&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 11: Revisão Final ───────────────────────────────────────────────────
function RevisaoFinal({ companyData, allData, project }) {
  const rules = companyData?.rulesNames || [];
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h4 className="font-semibold text-green-800 mb-2">Dados da Empresa</h4>
        <p className="text-sm text-green-700">{project?.client_name || "—"}</p>
        <p className="text-sm text-green-700">Responsável: {companyData?.responsibleName || "—"}</p>
        <p className="text-sm text-green-700">Regras: {(rules || []).join(", ") || "Nenhuma"}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {companyData?.hasNightShift && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Noturno</span>}
          {companyData?.has12x36Shift && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">12x36</span>}
          {companyData?.hasOnCallWorkers && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sobreaviso</span>}
          {companyData?.hasTimeBank && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Banco de Horas</span>}
        </div>
      </div>

      {rules.map(name => {
        const rc = allData.rule_configurations?.[name] || {};
        const he = allData.overtime_rules?.[name] || {};
        const br = allData.break_time_rules?.[name] || {};
        const an = allData.night_shift_rules?.[name] || {};
        const j12 = allData.shift_12x36_rules?.[name] || {};
        const sb = allData.sobreaviso_rules?.[name] || {};
        const bh = allData.bank_hours_rules?.[name] || {};
        const dsr = allData.dsr_rules?.[name] || {};

        return (
          <div key={name} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-800 mb-3">{name}</h4>
            <div className="text-xs text-slate-500 space-y-1.5">
              {rc.model && (
                <p><span className="font-medium text-slate-600">Modelo:</span> {rc.model}
                  {rc.model === "Fixo" && ` — Atraso Entrada: ${rc.entradaToleranciaAtraso || "—"}min, Antecipação Saída: ${rc.saidaToleranciaAntecipada || "—"}min`}
                  {rc.model === "Flexível" && ` — Janela: ${rc.janelaAntes || "—"}min antes / ${rc.janelaDepois || "—"}min depois`}
                  {rc.model === "Híbrido" && ` — Tolerância: ${rc.toleranciaAtraso || "—"}min / Janela: ${rc.janelaAntes || "—"}min`}
                </p>
              )}
              {he.percDiasComuns && (
                <p><span className="font-medium text-slate-600">HE:</span> Dias Comuns {he.percDiasComuns}% | Sáb {he.percSabado || "50"}% | Dom {he.percDomingo || "100"}% | Fer {he.percFeriado || "100"}%
                  {(he.additionalRates || []).length > 0 && ` + ${he.additionalRates.length} percentual(is) adicional(is)`}
                </p>
              )}
              {br.model && <p><span className="font-medium text-slate-600">Intervalos:</span> {br.model} — Atraso: {br.toleranciaAtrasoPausa || "—"}min, Início: {br.toleranciaInicioPausa || "—"}min, Fim: {br.toleranciaFimPausa || "—"}min {(br.ranges || []).length > 0 && `(${br.ranges.length} faixas)`}</p>}
              {an.percAdicional && <p><span className="font-medium text-slate-600">Noturno:</span> {an.percAdicional}% — {an.horaInicioNoturna || "22:00"} às {an.horaFimNoturna || "05:00"}{an.separarHENoturna === "sim" ? " (HE separada)" : ""}</p>}
              {j12.model && <p><span className="font-medium text-slate-600">12x36:</span> {j12.model}{j12.folgaFixa ? " — Folga fixa" : ""}</p>}
              {sb.percSobreaviso && <p><span className="font-medium text-slate-600">Sobreaviso:</span> {sb.percSobreaviso}</p>}
              {bh.model && <p><span className="font-medium text-slate-600">Banco de Horas:</span> {bh.model} — {bh.periodoCompensacao || "mensal"}{bh.limiteCreditoMensal ? ` | Crédito máx: ${bh.limiteCreditoMensal}h/mês` : ""}</p>}
              {dsr.modeloDSR && <p><span className="font-medium text-slate-600">DSR:</span> {dsr.modeloDSR === "padrao" ? "Incluso nas HE" : "Separado"}</p>}
            </div>
          </div>
        );
      })}

      {allData.other_verbs_rules?.verbas?.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4">
          <h4 className="font-semibold text-slate-800 mb-2">Outras Verbas</h4>
          <div className="flex flex-wrap gap-2">
            {allData.other_verbs_rules.verbas.map((v, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                {v.nome} {v.codigo && `(${v.codigo})`} {v.percentual && `${v.percentual}%`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────
export default function CalculationRulesTab({ projectId, project }) {
  const { record, loading, saving, save, getData, reload } = useWizardState(projectId);
  const perms = usePermissions();
  const canEdit = perms.canEditCalcRules;
  const canFinalize = perms.canFinalizeCalcRules;

  const companyData = getData("company_data") || {};
  const [currentStep, setCurrentStep] = useState(record?.current_step || 1);

  useEffect(() => { if (record?.current_step) setCurrentStep(record.current_step); }, [record?.current_step]);

  const stepData = {
    company_data: companyData,
    rule_configurations: getData("rule_configurations") || {},
    overtime_rules: getData("overtime_rules") || {},
    break_time_rules: getData("break_time_rules") || {},
    night_shift_rules: getData("night_shift_rules") || {},
    shift_12x36_rules: getData("shift_12x36_rules") || {},
    sobreaviso_rules: getData("sobreaviso_rules") || {},
    bank_hours_rules: getData("bank_hours_rules") || {},
    dsr_rules: getData("dsr_rules") || {},
    other_verbs_rules: getData("other_verbs_rules") || {},
  };

  // Determine visible steps based on company data
  const visibleSteps = STEPS.filter(step => {
    if (!companyData?.rulesNames?.length && step.id > 1) return false;
    if (step.key === "night_shift_rules" && companyData?.hasNightShift === false) return false;
    if (step.key === "shift_12x36_rules" && companyData?.has12x36Shift === false) return false;
    if (step.key === "sobreaviso_rules" && companyData?.hasOnCallWorkers === false) return false;
    if (step.key === "bank_hours_rules" && companyData?.hasTimeBank === false) return false;
    return true;
  });

  const currentStepIdx = visibleSteps.findIndex(s => s.id === currentStep);
  const step = visibleSteps[currentStepIdx];

  // Debounce: buffer local changes and persist only after inactivity
  const pendingSaveRef = useRef(null);
  const pendingDataRef = useRef({});

  const flushPending = async () => {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    const keys = Object.keys(pendingDataRef.current);
    if (keys.length > 0) {
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      await save(payload);
    }
  };

  const scheduleSave = (key, data) => {
    pendingDataRef.current[key] = data;
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null;
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      save(payload);
    }, 800);
  };

  const goToStep = async (newStep) => {
    setCurrentStep(newStep);
    await flushPending();
    await save({ current_step: newStep });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Read-only banner */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4 flex items-center gap-2 text-sm text-amber-700">
          <Lock className="w-4 h-4" />
          <span>Modo somente leitura — seu perfil não permite edições nas Regras de Cálculo.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Regras de Cálculo</h2>
          <p className="text-sm text-slate-400">Wizard de configuração das regras de cálculo da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={async () => {
                if (window.confirm("Reiniciar o assistente? Todos os dados serão perdidos.")) {
                  if (record?.id) await base44.entities.CalculationRule.delete(record.id);
                  reload();
                  setCurrentStep(1);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
            </button>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </span>
          )}
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {visibleSteps.map((s, idx) => {
          const isActive = s.id === currentStep;
          const isPast = s.id < currentStep;
          return (
            <button
              key={s.id}
              onClick={() => goToStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive ? "bg-blue-600 text-white border-blue-600" :
                isPast ? "bg-green-50 text-green-700 border-green-200" :
                "bg-white text-slate-400 border-slate-200"
              }`}
            >
              {isPast && <CheckCircle className="w-3 h-3 text-green-500" />}
              <span className="font-mono text-xs opacity-60">{s.id}</span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5 min-h-[300px]">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{step?.title}</h3>
        <p className="text-sm text-slate-400 mb-6">Passo {currentStepIdx + 1} de {visibleSteps.length}</p>

        {step?.key === "company_data" && (
          <DadosEmpresaForm data={companyData} onChange={(data) => scheduleSave("company_data", data)} project={project} readOnly={!canEdit} />
        )}
        {step?.key === "rule_configurations" && (
          <RegrasForm companyData={companyData} data={stepData.rule_configurations} onChange={canEdit ? (data) => scheduleSave("rule_configurations", data) : () => {}} />
        )}
        {step?.key === "overtime_rules" && (
          <HorasExtrasForm companyData={companyData} data={stepData.overtime_rules} onChange={canEdit ? (data) => scheduleSave("overtime_rules", data) : () => {}} />
        )}
        {step?.key === "break_time_rules" && (
          <IntervalosForm companyData={companyData} data={stepData.break_time_rules} onChange={canEdit ? (data) => scheduleSave("break_time_rules", data) : () => {}} />
        )}
        {step?.key === "night_shift_rules" && (
          <AdicionalNoturnoForm companyData={companyData} data={stepData.night_shift_rules} onChange={canEdit ? (data) => scheduleSave("night_shift_rules", data) : () => {}} />
        )}
        {step?.key === "shift_12x36_rules" && (
          <Jornada12x36Form companyData={companyData} data={stepData.shift_12x36_rules} onChange={canEdit ? (data) => scheduleSave("shift_12x36_rules", data) : () => {}} />
        )}
        {step?.key === "sobreaviso_rules" && (
          <SobreavisoForm companyData={companyData} data={stepData.sobreaviso_rules} onChange={canEdit ? (data) => scheduleSave("sobreaviso_rules", data) : () => {}} />
        )}
        {step?.key === "bank_hours_rules" && (
          <BancoHorasForm companyData={companyData} data={stepData.bank_hours_rules} onChange={canEdit ? (data) => scheduleSave("bank_hours_rules", data) : () => {}} />
        )}
        {step?.key === "dsr_rules" && (
          <DSRForm companyData={companyData} data={stepData.dsr_rules} onChange={canEdit ? (data) => scheduleSave("dsr_rules", data) : () => {}} />
        )}
        {step?.key === "other_verbs_rules" && (
          <OutrasVerbasForm companyData={companyData} data={stepData.other_verbs_rules} onChange={canEdit ? (data) => scheduleSave("other_verbs_rules", data) : () => {}} />
        )}
        {step?.id === 11 && <RevisaoFinal companyData={companyData} allData={stepData} project={project} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => currentStepIdx > 0 && goToStep(visibleSteps[currentStepIdx - 1].id)}
          disabled={currentStepIdx === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        <span className="text-xs text-slate-400">{currentStepIdx + 1} / {visibleSteps.length}</span>

        {currentStepIdx < visibleSteps.length - 1 ? (
          <button
            onClick={() => goToStep(visibleSteps[currentStepIdx + 1].id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          canFinalize ? (
            <button
              onClick={async () => {
                await save({ status: "finalizado" });
                alert("Regras de cálculo finalizadas com sucesso!");
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-green-600 bg-green-600 text-white hover:bg-green-700"
            >
              <FileDown className="w-4 h-4" /> Finalizar
            </button>
          ) : (
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
              title="Você não tem permissão para finalizar"
            >
              <Lock className="w-4 h-4" /> Finalizar
            </button>
          )
        )}
      </div>
    </div>
  );
}