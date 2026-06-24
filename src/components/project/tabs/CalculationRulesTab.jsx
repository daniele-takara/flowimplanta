import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, ChevronDown, Users, Save, CheckCircle, Loader2, FileDown, RotateCcw, AlertCircle, Lock, Info, Trash2, Maximize2, Minimize2, Link, Copy } from "lucide-react";
import { usePermissions } from "@/lib/usePermissions";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";
import CalculationModelsInfoModal from "@/components/project/tabs/calculation/CalculationModelsInfoModal";
import { generateCalcRulesPDF } from "@/lib/calcRulesPdfExport";
import HorasExtrasInfoModal from "@/components/project/tabs/calculation/HorasExtrasInfoModal";
import CategorizacaoHEInfoModal from "@/components/project/tabs/calculation/CategorizacaoHEInfoModal";
import CategorizacaoHEMensalInfoModal from "@/components/project/tabs/calculation/CategorizacaoHEMensalInfoModal";
import ToleranciasIntervaloInfoModal from "@/components/project/tabs/calculation/ToleranciasIntervaloInfoModal";
import PausaHoraExtraInfoModal from "@/components/project/tabs/calculation/PausaHoraExtraInfoModal";
import AdicionalNoturnoInfoModal from "@/components/project/tabs/calculation/AdicionalNoturnoInfoModal";
import ProrrogacaoAdicionalNoturnoInfoModal from "@/components/project/tabs/calculation/ProrrogacaoAdicionalNoturnoInfoModal";
import ReducaoHoraNoturnaInfoModal from "@/components/project/tabs/calculation/ReducaoHoraNoturnaInfoModal";
import AdicionalIncluiPausaInfoModal from "@/components/project/tabs/calculation/AdicionalIncluiPausaInfoModal";
import Jornada12x36FeriadoInfoModal from "@/components/project/tabs/calculation/Jornada12x36FeriadoInfoModal";
import SobreavisoInfoModal from "@/components/project/tabs/calculation/SobreavisoInfoModal";
import BancoHorasInfoModal from "@/components/project/tabs/calculation/BancoHorasInfoModal";
import BancoHorasAcumuloInfoModal from "@/components/project/tabs/calculation/BancoHorasAcumuloInfoModal";
import DSRFeriasHEInfoModal from "@/components/project/tabs/calculation/DSRFeriasHEInfoModal";
import DSRMesDescontoInfoModal from "@/components/project/tabs/calculation/DSRMesDescontoInfoModal";
import { logAudit } from "@/lib/auditLog";

// ── Helpers ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: "Dados da Empresa", key: "company_data" },
  { id: 2, title: "Configuração das Regras", key: "rule_configurations" },
  { id: 3, title: "Horas Extras", key: "overtime_rules" },
  { id: 4, title: "Intervalos", key: "break_time_rules" },
  { id: 5, title: "Adicional Noturno", key: "night_shift_rules" },
  { id: 6, title: "Jornada 12x36", key: "shift_12x36_rules" },
  { id: 7, title: "Sobreaviso", key: "sobreaviso_rules" },
  { id: 8, title: "DSR / Feriados", key: "dsr_rules" },
  { id: 9, title: "Banco de Horas", key: "bank_hours_rules" },
  { id: 10, title: "Outras Verbas", key: "other_verbs_rules" },
  { id: 11, title: "Revisão Final", key: null },
];

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

// ── Persistência ─────────────────────────────────────────────────────────────
function useWizardState(projectId, ruleType = "team") {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await base44.entities.CalculationRule.filter({ project_id: projectId, rule_type: ruleType });
    setRecord(list[0] || null);
    setLoading(false);
  }, [projectId, ruleType]);

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
      // Auditoria dos campos alterados (apenas os nomes dos campos, valores são JSON complexos)
      const changedKeys = Object.keys(payload).filter(k => k !== "current_step");
      if (changedKeys.length > 0) {
        logAudit({ project_id: projectId, screen: "Regras de Cálculo", field: changedKeys.join(", "), new_value: "Atualizado" });
      }
    } else {
      const created = await base44.entities.CalculationRule.create({ project_id: projectId, ...payload });
      setRecord(created);
      logAudit({ project_id: projectId, screen: "Regras de Cálculo", field: "Criação", new_value: "Wizard iniciado" });
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

      {/* Observações */}
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
            {/* Observações */}
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

// ── Step 3: Horas Extras ─────────────────────────────────────────────────────
import HorasExtrasForm from "@/components/project/tabs/calculation/HorasExtrasForm";

// ── Step 4: Intervalos ───────────────────────────────────────────────────────
const intervalInputClass = "w-12 px-1.5 py-0.5 text-center text-sm border-0 border-b border-black bg-transparent focus:outline-none focus:border-blue-500 focus:border-b-2";
const intervalReadonlyClass = "w-12 px-1.5 py-0.5 text-center text-sm border-0 bg-slate-100 rounded";

function IntervalosForm({ companyData, data, onChange, onInfoToleranciasClick, ruleConfigurations, onInfoPausaHoraExtraClick }) {
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
            {/* Divisão do intervalo para refeição e descanso */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-700 mb-4">Divisão do intervalo para refeição e descanso</p>
              <div className="space-y-3">
                {/* Linha 1: Entre X e Y horas será devido Z mins */}
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-slate-700">
                  <span>Entre</span>
                  <input
                    value={val.intervaloMinHoras || "4"}
                    onChange={e => updateRule(name, "intervaloMinHoras", e.target.value)}
                    className={intervalInputClass}
                    type="number"
                    min="1"
                  />
                  <span>e</span>
                  <input
                    value={val.intervaloMaxHoras || "6"}
                    onChange={e => updateRule(name, "intervaloMaxHoras", e.target.value)}
                    className={intervalInputClass}
                    type="number"
                    min="1"
                  />
                  <span>horas será devido</span>
                  <input
                    value={val.intervaloMinMinutos || "15"}
                    onChange={e => updateRule(name, "intervaloMinMinutos", e.target.value)}
                    className={intervalInputClass}
                    type="number"
                    min="1"
                  />
                  <span>mins</span>
                </div>
                <p className="text-xs text-slate-400 -mt-1 ml-0 pl-0">de intervalo para refeição</p>

                {/* Linha 2: Mais que X horas será devido Y mins */}
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-slate-700">
                  <span>Mais que</span>
                  <input
                    value={val.intervaloMaxHoras || "6"}
                    readOnly
                    className={intervalReadonlyClass}
                    type="number"
                  />
                  <span>horas será devido</span>
                  <input
                    value={val.intervaloMaxMinutos || "60"}
                    onChange={e => updateRule(name, "intervaloMaxMinutos", e.target.value)}
                    className={intervalInputClass}
                    type="number"
                    min="1"
                  />
                  <span>mins</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
              Tolerâncias (minutos)
              <button
                onClick={(e) => { e.preventDefault(); onInfoToleranciasClick?.(); }}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
                title="Entenda as tolerâncias de intervalo"
              >
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

            {/* Pergunta condicional — apenas se modelo Flexível no passo 2 */}
            {ruleConfigurations?.[name]?.model === "Flexível" && (
            <div className="border-t pt-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                Caso o funcionário não cumpra o tempo total de pausa, deve ser calculada hora extra?
                <button
                  onClick={(e) => { e.preventDefault(); onInfoPausaHoraExtraClick?.(); }}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
                  title="Entenda o impacto no cálculo de horas extras"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </p>
              <select value={val.calcularHoraExtraPausa || "nao"} onChange={e => updateRule(name, "calcularHoraExtraPausa", e.target.value)} className={selectClass}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            )}

            {/* Código de verba */}
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

            // ── Step 5: Adicional Noturno ────────────────────────────────────────────────
function AdicionalNoturnoForm({ companyData, data, onChange, onInfoReducaoClick, onInfoProrrogacaoClick, onInfoReducaoAmbosClick, onInfoAdicionalPausaClick }) {
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
            {/* Pergunta condicional — jornada noturna */}
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários trabalhando em jornada noturna?</label>
              <select value={val.hasJornadaNoturna || "sim"} onChange={e => updateRule(name, "hasJornadaNoturna", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasJornadaNoturna !== "nao" && (
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
                {val.percAdicional === "custom" && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      value={val.percAdicionalCustom || ""}
                      onChange={e => updateRule(name, "percAdicionalCustom", e.target.value)}
                      className={inputClass}
                      type="number"
                      placeholder="Ex: 30"
                      min="0"
                    />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                )}
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
                          {val[p.key] === "custom" && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <input value={val[p.key + "Custom"] || ""} onChange={e => updateRule(name, p.key + "Custom", e.target.value)} className={inputClass} type="number" placeholder="Ex: 30" min="0" />
                              <span className="text-sm text-slate-400">%</span>
                            </div>
                          )}
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

            {/* Código de verba (geral — usado quando não há separação) */}
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

            {/* Perguntas adicionais */}
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Configurações Adicionais</p>
              
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Haverá redução de hora no período informado acima?
                  <button onClick={(e) => { e.preventDefault(); onInfoReducaoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o adicional noturno e a redução noturna">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                <select value={val.reducaoHoraPeriodo || "nao"} onChange={e => updateRule(name, "reducaoHoraPeriodo", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  A redução informada, será considerada apenas no adicional noturno ou também nas horas trabalhadas?
                  <button onClick={(e) => { e.preventDefault(); onInfoReducaoAmbosClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda a redução de hora noturna">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                <select value={val.reducaoConsideraAmbos || "nao"} onChange={e => updateRule(name, "reducaoConsideraAmbos", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Será considerada apenas no adicional noturno</option>
                  <option value="sim">Considera as horas trabalhadas</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  O adicional noturno deve ser prorrogado até o fim da jornada?
                  <button onClick={(e) => { e.preventDefault(); onInfoProrrogacaoClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda a prorrogação do adicional noturno">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                <select value={val.adicionalProrrogadoFimJornada || "nao"} onChange={e => updateRule(name, "adicionalProrrogadoFimJornada", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  O adicional noturno inclui o tempo de pausa do funcionário?
                  <button onClick={(e) => { e.preventDefault(); onInfoAdicionalPausaClick?.(); }} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o impacto do tempo de pausa no adicional noturno">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </label>
                <select value={val.adicionalIncluiTempoPausa || "nao"} onChange={e => updateRule(name, "adicionalIncluiTempoPausa", e.target.value)} className={`${selectClass} mt-1`}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
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
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 6: Jornada 12x36 ────────────────────────────────────────────────────
function Jornada12x36Form({ companyData, data, onChange, onInfoFeriadoClick }) {
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
            {/* Pergunta condicional — jornada 12x36 */}
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários trabalhando em jornada 12x36?</label>
              <select value={val.hasJornada12x36 || "sim"} onChange={e => updateRule(name, "hasJornada12x36", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasJornada12x36 !== "nao" && (
            <>
            {/* Pagamento em feriado */}
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

            {/* Falta em feriado */}
            <div className="border-t pt-4 mb-4">
              <label className="text-xs font-semibold text-slate-700">
                Funcionários 12x36 recebem falta caso não trabalhem em dias de feriado que coincidem com dias trabalhados?
              </label>
              <select value={val.faltaFeriado || "sim"} onChange={e => updateRule(name, "faltaFeriado", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="sim">Sim, é considerado falta</option>
                <option value="nao">Não, é considerado folga</option>
              </select>
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

  const selected = (name) => d[name] || {
    hasSobreaviso: "sim",
    bancoHoras: "",
    porcentagem: "",
    envioE02: false,
    verbasE02: {
      horaExtra: { codigo: "", formato: "" },
      duracaoNaoTrabalhada: { codigo: "", formato: "" },
      adicionalNoturno: { codigo: "", formato: "" }
    },
    particularidade: "",
    verbas: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const updateVerbaE02 = (name, verbaKey, field, value) => {
    const val = selected(name);
    const verbasE02 = { ...(val.verbasE02 || {}) };
    verbasE02[verbaKey] = { ...verbasE02[verbaKey], [field]: value };
    onChange({ ...d, [name]: { ...val, verbasE02 } });
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
            {/* Pergunta condicional — sobreaviso */}
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários com jornadas de sobreaviso?</label>
              <select value={val.hasSobreaviso || "sim"} onChange={e => updateRule(name, "hasSobreaviso", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasSobreaviso !== "nao" && (
            <>
            {/* Banco de horas */}
            <div className="mb-4">
              <label className={labelClass}>A hora de sobreaviso deverá entrar para banco de horas?</label>
              <select value={val.bancoHoras || ""} onChange={e => updateRule(name, "bancoHoras", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="">Selecione uma opção</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {/* Porcentagem */}
            <div className="mb-4">
              <label className={labelClass}>Qual a porcentagem de sobreaviso trabalhado?</label>
              <input value={val.porcentagem || ""} onChange={e => updateRule(name, "porcentagem", e.target.value)} className={`${inputClass} max-w-xs`} placeholder="Ex: 100%" />
            </div>

            {/* Envio FOPAG */}
            <div className="border-t pt-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-3">
                <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                Enviar para arquivo de exportação para FOPAG (E02)?
              </label>
              {val.envioE02 && (
                <div className="space-y-4 pl-6">
                  {/* Verba 1: Hora extra de sobreaviso */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">1. Hora extra de sobreaviso</p>
                    <p className="text-xs text-slate-400 mb-2">Quando o empregado trabalha durante o período de sobreaviso</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={(val.verbasE02?.horaExtra?.codigo) || ""}
                        onChange={e => updateVerbaE02(name, "horaExtra", "codigo", e.target.value)}
                        className={inputClass}
                        placeholder="Código da verba"
                      />
                      <select
                        value={(val.verbasE02?.horaExtra?.formato) || ""}
                        onChange={e => updateVerbaE02(name, "horaExtra", "formato", e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Selecione o formato</option>
                        <option value="Dia">Dia</option>
                        <option value="HH:MM">HH:MM</option>
                        <option value="Centesimal">Centesimal</option>
                      </select>
                    </div>
                  </div>

                  {/* Verba 2: Duração de sobreaviso não trabalhada */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">2. Duração de sobreaviso não trabalhada</p>
                    <p className="text-xs text-slate-400 mb-2">Quando o empregado estava de sobreaviso mas não foi acionado e não trabalhou</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={(val.verbasE02?.duracaoNaoTrabalhada?.codigo) || ""}
                        onChange={e => updateVerbaE02(name, "duracaoNaoTrabalhada", "codigo", e.target.value)}
                        className={inputClass}
                        placeholder="Código da verba"
                      />
                      <select
                        value={(val.verbasE02?.duracaoNaoTrabalhada?.formato) || ""}
                        onChange={e => updateVerbaE02(name, "duracaoNaoTrabalhada", "formato", e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Selecione o formato</option>
                        <option value="Dia">Dia</option>
                        <option value="HH:MM">HH:MM</option>
                        <option value="Centesimal">Centesimal</option>
                      </select>
                    </div>
                  </div>

                  {/* Verba 3: Adicional noturno de sobreaviso */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">3. Adicional noturno de sobreaviso</p>
                    <p className="text-xs text-slate-400 mb-2">Quando o empregado trabalhou durante o sobreaviso em horário noturno</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={(val.verbasE02?.adicionalNoturno?.codigo) || ""}
                        onChange={e => updateVerbaE02(name, "adicionalNoturno", "codigo", e.target.value)}
                        className={inputClass}
                        placeholder="Código da verba"
                      />
                      <select
                        value={(val.verbasE02?.adicionalNoturno?.formato) || ""}
                        onChange={e => updateVerbaE02(name, "adicionalNoturno", "formato", e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Selecione o formato</option>
                        <option value="Dia">Dia</option>
                        <option value="HH:MM">HH:MM</option>
                        <option value="Centesimal">Centesimal</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Particularidade */}
            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Possui alguma particularidade?</label>
              <p className="text-xs text-slate-400 mb-2">Deixe explícito o funcionamento do sobreaviso (trabalhado e não trabalhado).</p>
              <textarea value={val.particularidade || ""} onChange={e => updateRule(name, "particularidade", e.target.value)} className={`${inputClass} h-24`} placeholder="Descreva as particularidades do sobreaviso..." />
            </div>

            {/* Outras Verbas */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Sobreaviso)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  + Adicionar Verba
                </button>
              </div>
              {(val.verbas || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>
              )}
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
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 9: Banco de Horas ───────────────────────────────────────────────────
function BancoHorasForm({ companyData, data, onChange, onInfoAcumuloClick }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const FATORES_OPTIONS = [
    { key: "hora_extra", label: "Hora Extra (jornada com presença obrigatória)" },
    { key: "hora_extra_extraordinaria", label: "Hora Extra Extraordinária (sem jornada esperada – folga/feriado)" },
    { key: "hora_extra_especial", label: "Hora Extra Especial" },
    { key: "atraso", label: "Atraso" },
    { key: "saida_antecipada", label: "Saída Antecipada" },
    { key: "excesso_pausa", label: "Excesso de Pausa" },
    { key: "falta", label: "Falta" },
  ];

  const APONTAMENTO_OPTIONS = [
    { value: "baixa_negativa", label: "Baixa Negativa", desc: "Registro de horas descontadas do banco de horas sendo negativa ( cliente precisa pagar o empregado)" },
    { value: "baixa_parcial_negativa", label: "Baixa Parcial Negativa", desc: "Registro parcial de horas descontadas do banco de horas, semelhante às baixas negativa, mas realizadas de forma fracionada." },
    { value: "baixa_parcial_positiva", label: "Baixa Parcial Positiva", desc: "Registro parcial de horas descontadas do banco de horas, semelhante às baixas positivas, mas realizadas de forma fracionada." },
    { value: "baixa_positiva", label: "Baixa Positiva", desc: "Registro de horas descontadas do banco de horas sendo positiva (cliente precisa descontar o empregado)" },
    { value: "outra_forma", label: "Outra forma de baixa", desc: "Permite personalizar uma forma específica de baixa não listada nas opções padrões" },
  ];

  const defaultFatores = FATORES_OPTIONS.map(f => ({ key: f.key, ativo: false, fator: "", fatorCustom: "" }));

  const selected = (name) => {
    const ruleData = d[name] || {};
    return {
      formato: "",
      dataInicio: "",
      limiteDias: "",
      limiteDiasCustom: "",
      criterioAcumulo: "",
      prazoVencimento: "",
      limiteAcumuloTipos: [],
      limiteAcumuloValores: {},
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

            {/* Pergunta 1: Formato do banco de horas */}
            <div className="mb-4">
              <label className={labelClass}>Qual o formato do banco de horas?</label>
              <select value={val.formato || ""} onChange={e => updateRule(name, "formato", e.target.value)} className={`${selectClass} max-w-sm mt-1`}>
                <option value="">Selecione o formato</option>
                <option value="compensacao_geral">Compensação geral</option>
                <option value="por_janela">Compensação por janelas / Cascata</option>
              </select>
            </div>

            {/* Campos condicionais: Compensação Geral */}
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
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Qual o limite de dias para acúmulo/vencimento do banco de horas?
                </label>
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

            {/* Campos condicionais: Por Janela */}
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
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Qual o limite de dias para acúmulo/vencimento do banco de horas?
                </label>
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

            {/* Seção: Acúmulo em banco de horas e fator de transformação (independente do formato) */}
            {val.formato && (
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                Acúmulo em banco de horas e fator de transformação
                <button
                  onClick={(e) => { e.preventDefault(); onInfoAcumuloClick?.(); }}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
                  title="Entenda o acúmulo e fator de transformação"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </p>

              <div className="space-y-2">
                {FATORES_OPTIONS.map(fatorOpt => {
                  const fatorData = val.fatoresTransformacao.find(f => f.key === fatorOpt.key) || { ativo: false, fator: "", fatorCustom: "" };
                  return (
                    <div key={fatorOpt.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-[200px]">
                          <input
                            type="checkbox"
                            checked={!!fatorData.ativo}
                            onChange={() => toggleFator(name, fatorOpt.key)}
                            className="w-4 h-4 accent-purple-600 rounded shrink-0"
                          />
                          <span className="text-sm text-slate-700">{fatorOpt.label}</span>
                        </label>
                        {fatorData.ativo && (
                          <div className="flex items-center gap-2">
                            <select
                              value={fatorData.fator || ""}
                              onChange={e => updateFator(name, fatorOpt.key, "fator", e.target.value)}
                              className="w-28 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Fator</option>
                              <option value="1_para_1">1 para 1</option>
                              <option value="1_para_2">1 para 2</option>
                              <option value="OUTRO">OUTRO</option>
                            </select>
                            {fatorData.fator === "OUTRO" && (
                              <input
                                value={fatorData.fatorCustom || ""}
                                onChange={e => updateFator(name, fatorOpt.key, "fatorCustom", e.target.value)}
                                className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: 1 p/ 3"
                              />
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

            {/* Novas perguntas (prints) — independente do formato */}
            {val.formato && (
            <div className="border-t pt-4 mt-4 space-y-4">
              {/* Pergunta: Limite de acúmulo */}
              <div>
                <label className="text-sm font-semibold text-slate-800">Existe algum limite de acúmulo diário, mensal, semanal ou geral?</label>
                <p className="text-xs text-slate-500 mb-2">Caso tenha limitação, todo o saldo remanescente que ultrapasse o limite definido, será direcionado diretamente para pagamento, sendo hora extra para saldo positivo e atraso para saldos negativos.</p>
                <div className="space-y-2">
                  {[
                    { key: "diario", label: "Diário" },
                    { key: "semanal", label: "Semanal" },
                    { key: "mensal", label: "Mensal" },
                    { key: "geral", label: "Geral" },
                  ].map(opt => {
                    const tipos = val.limiteAcumuloTipos || [];
                    const isChecked = tipos.includes(opt.key);
                    const isSemAcumulo = tipos.includes("sem_acumulo");
                    return (
                      <div key={opt.key}>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isSemAcumulo}
                            onChange={() => {
                              const next = isChecked
                                ? tipos.filter(t => t !== opt.key)
                                : [...tipos.filter(t => t !== "sem_acumulo"), opt.key];
                              onChange({ ...d, [name]: { ...val, limiteAcumuloTipos: next } });
                            }}
                            className="w-4 h-4 accent-blue-600 rounded"
                          />
                          {opt.label}
                        </label>
                        {isChecked && (
                          <div className="ml-6 mt-1">
                            <input
                              value={(val.limiteAcumuloValores || {})[opt.key] || ""}
                              onChange={e => {
                                const vals = { ...(val.limiteAcumuloValores || {}) };
                                vals[opt.key] = e.target.value;
                                onChange({ ...d, [name]: { ...val, limiteAcumuloValores: vals } });
                              }}
                              className={inputClass}
                              placeholder={`Ex: 2 (horas ${opt.label.toLowerCase()})`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <label className={`flex items-center gap-2 cursor-pointer text-sm ${((val.limiteAcumuloTipos || []).length > 0 && !(val.limiteAcumuloTipos || []).includes("sem_acumulo")) ? "text-slate-400" : "text-slate-700"}`}>
                    <input
                      type="checkbox"
                      checked={(val.limiteAcumuloTipos || []).includes("sem_acumulo")}
                      disabled={(val.limiteAcumuloTipos || []).length > 0 && !(val.limiteAcumuloTipos || []).includes("sem_acumulo")}
                      onChange={() => {
                        const tipos = val.limiteAcumuloTipos || [];
                        const next = tipos.includes("sem_acumulo") ? [] : ["sem_acumulo"];
                        onChange({ ...d, [name]: { ...val, limiteAcumuloTipos: next, limiteAcumuloValores: {} } });
                      }}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    Sem acúmulo
                  </label>
                </div>
              </div>

              {/* Pergunta: Saldos automáticos */}
              <div>
                <label className="text-sm font-semibold text-slate-800">Os saldos devem entrar automaticamente para banco de horas?</label>
                <p className="text-xs text-slate-500 mb-2">Ao deixar o saldo do dia para entrar automaticamente para o banco de horas, significa que todos os dias que houver apontamento (positivos e negativos) farão a compensação automaticamente no banco de horas, podendo ser reprovado pontualmente caso opte por pagar aquele crédito ou débito.</p>
                <p className="text-xs text-slate-500 mb-2">Caso opte por aprovar manualmente os saldos diários, eles irão diretamente para pagamento até ocorrer a aprovação manual.</p>
                <select value={val.saldoAutomatico || ""} onChange={e => updateRule(name, "saldoAutomatico", e.target.value)} className={`${selectClass} max-w-sm`}>
                  <option value="">Selecione uma opção</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>

              {/* Pergunta: Mostrar histórico */}
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

            {/* Seção: Outras Verbas (Banco de Horas) */}
            {val.formato && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Banco de Horas)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  + Adicionar Verba
                </button>
              </div>
              {(val.verbas || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>
              )}
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
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-3">
                    <input type="checkbox" checked={!!v.envioE02} onChange={e => updateVerba(name, i, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                    Enviar para arquivo de exportação para FOPAG (E02)?
                  </label>
                </div>
              ))}
            </div>
            )}

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

// ── Step 8: DSR / Feriados ───────────────────────────────────────────────────
function DSRForm({ companyData, data, onChange, onInfoHEFeriadoClick, onInfoMesDescontoClick }) {
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

            {/* Pergunta 1: Tipo de HE em feriado/folga com pausa */}
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

            {/* Pergunta 2: Pausa refeição em dia de folga */}
            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Caso o funcionário trabalhe em um dia de folga, a pausa refeição deve ser considerada como hora trabalhada?</label>
              <select value={val.pausaFolgaHoraTrabalhada || "nao_considerar"} onChange={e => updateRule(name, "pausaFolgaHoraTrabalhada", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Selecione uma opção</option>
                <option value="nao_considerar">Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 08:00 trabalhadas (não considerando a pausa)</option>
                <option value="considerar">Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 09:00 trabalhadas (considerando a pausa)</option>
              </select>
            </div>

            {/* Pergunta 3: DSR em dobro */}
            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Se o funcionário falta em uma semana com feriado, é descontado DSR em dobro?</label>
              <select value={val.dsrDobroFalta || "sim"} onChange={e => updateRule(name, "dsrDobroFalta", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="sim">Sim, descontar o DSR do domingo e do feriado</option>
                <option value="nao">Não, descontar apenas um DSR</option>
              </select>
            </div>

            {/* Pergunta 4: Mês de desconto do DSR */}
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

            {/* Pergunta 5: Dispensa parcial */}
            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Em dias de falta com dispensa parcial lançada, é considerado atraso ou falta?</label>
              <select value={val.dispensaParcial || "atraso"} onChange={e => updateRule(name, "dispensaParcial", e.target.value)} className={`${selectClass} mt-1`}>
                <option value="">Selecione uma opção</option>
                <option value="atraso">Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, as horas serão descontadas como atraso.</option>
                <option value="falta">Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, o dia será contabilizado como falta.</option>
              </select>
            </div>

            {/* Pergunta 6: Envio FOPAG */}
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

            {/* Pergunta 7: Outras Verbas */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Folga/Feriado/DSR)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  + Adicionar Verba
                </button>
              </div>
              {(val.verbas || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>
              )}
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

// ── Step 10: Outras Verbas ───────────────────────────────────────────────────
function OutrasVerbasForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
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

      {/* Observações */}
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

// ── Step 11: Revisão Final (componente extraído) ──────────────────────────────
import RevisaoFinal from "@/components/project/tabs/calculation/RevisaoFinal";

// _RevisaoFinalStub removido — substituído por import acima

// ── Componente Principal ─────────────────────────────────────────────────────
export default function CalculationRulesTab({ projectId, project }) {
  const [viewMode, setViewMode] = useState("team");
  const { record, loading, saving, save, getData, reload } = useWizardState(projectId, viewMode);
  const perms = usePermissions();
  const canEdit = perms.canEditCalcRules;
  const canFinalize = perms.canFinalizeCalcRules;

  const [clientLink, setClientLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [clientTeamMembers, setClientTeamMembers] = useState([]);
  const [selectedClientEmail, setSelectedClientEmail] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    (async () => {
      const members = await base44.entities.ProjectTeamMember.filter({
        project_id: projectId,
        team: "cliente"
      });
      const withEmail = members.filter(m => m.email);
      setClientTeamMembers(withEmail);
      if (withEmail.length > 0 && !selectedClientEmail) {
        setSelectedClientEmail(withEmail[0].email);
      }
    })();
  }, [projectId]);

  const generateClientLink = async () => {
    setGeneratingLink(true);
    setShowClientPicker(false);
    const clientEmail = selectedClientEmail || project?.project_leader_email || project?.sponsor_email || "";
    const res = await base44.functions.invoke('generateClientToken', {
      project_id: projectId,
      client_email: clientEmail,
    });
    const token = res.data?.token;
    if (token) setClientLink(`${window.location.origin}/cliente/${token}`);
    setGeneratingLink(false);
  };

  const copyClientLink = () => {
    navigator.clipboard.writeText(clientLink);
    alert("Link copiado!");
  };

  const switchView = async (mode) => {
    await flushPending();
    setViewMode(mode);
    await reload();
  };

  const dbCompanyData = getData("company_data") || {};
  const [currentStep, setCurrentStep] = useState(record?.current_step || 1);
  const [showCalcModelsModal, setShowCalcModelsModal] = useState(false);
  const [showHorasExtrasModal, setShowHorasExtrasModal] = useState(false);
  const [showCategorizacaoHEModal, setShowCategorizacaoHEModal] = useState(false);
  const [showCategorizacaoHEMensalModal, setShowCategorizacaoHEMensalModal] = useState(false);
  const [showToleranciasIntervaloModal, setShowToleranciasIntervaloModal] = useState(false);
  const [showPausaHoraExtraModal, setShowPausaHoraExtraModal] = useState(false);
  const [showAdicionalNoturnoModal, setShowAdicionalNoturnoModal] = useState(false);
  const [showProrrogacaoNoturnoModal, setShowProrrogacaoNoturnoModal] = useState(false);
  const [showReducaoHoraNoturnaModal, setShowReducaoHoraNoturnaModal] = useState(false);
  const [showAdicionalIncluiPausaModal, setShowAdicionalIncluiPausaModal] = useState(false);
  const [showJornada12x36FeriadoModal, setShowJornada12x36FeriadoModal] = useState(false);
  const [showSobreavisoModal, setShowSobreavisoModal] = useState(false);
  const [showDSRFeriasHEModal, setShowDSRFeriasHEModal] = useState(false);
  const [showDSRMesDescontoModal, setShowDSRMesDescontoModal] = useState(false);
  const [showBancoHorasModal, setShowBancoHorasModal] = useState(false);
  const [showBancoHorasAcumuloModal, setShowBancoHorasAcumuloModal] = useState(false);
  const [generatingCalcPDF, setGeneratingCalcPDF] = useState(false);
  const [parametrizacaoRealizada, setParametrizacaoRealizada] = useState(false);

  // Ao carregar, verifica se a atividade de parametrização já foi concluída no cronograma
  useEffect(() => {
    (async () => {
      const atividadeNome = "Parametrização de regras";
      const atividades = await base44.entities.ScheduleActivity.filter({
        project_id: projectId,
        activity_name: atividadeNome
      });
      if (atividades.length > 0 && atividades[0].actual_end) {
        setParametrizacaoRealizada(true);
      }
    })();
  }, [projectId]);

  useEffect(() => { if (record?.current_step) setCurrentStep(record.current_step); }, [record?.current_step]);

  // Build stepData from DB (used as initial seed for buffer)
  const dbStepData = {
    company_data: dbCompanyData,
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

  // Local buffer: updates immediately on every keystroke, feeds form inputs
  const [stepData, setStepData] = useState(dbStepData);

  // Sync buffer from DB when record changes (e.g. after load, after save completes)
  useEffect(() => {
    setStepData(dbStepData);
  }, [record]);

  // Determine visible steps based on company data
  const visibleSteps = STEPS.filter(step => {
    const cd = stepData.company_data;
    if (!cd?.rulesNames?.length && step.id > 1) return false;
    if (step.key === "night_shift_rules" && cd?.hasNightShift === false) return false;
    if (step.key === "shift_12x36_rules" && cd?.has12x36Shift === false) return false;
    if (step.key === "sobreaviso_rules" && cd?.hasOnCallWorkers === false) return false;
    if (step.key === "bank_hours_rules" && cd?.hasTimeBank === false) return false;
    return true;
  });

  const currentStepIdx = visibleSteps.findIndex(s => s.id === currentStep);
  const step = visibleSteps[currentStepIdx];

  // Safety: if currentStep is not in visibleSteps (e.g. step 5 but hasNightShift was toggled off),
  // reset to the first visible step so the UI doesn't render empty
  useEffect(() => {
    if (visibleSteps.length > 0 && currentStepIdx === -1) {
      setCurrentStep(visibleSteps[0].id);
    }
  }, [visibleSteps, currentStepIdx]);

  // Debounce: buffer local changes and persist only after inactivity
  const pendingSaveRef = useRef(null);
  const pendingDataRef = useRef({});

  const flushPending = useCallback(async () => {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    const keys = Object.keys(pendingDataRef.current);
    if (keys.length > 0) {
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      try { await save(payload); } catch (_) { /* não perder dados do buffer em caso de erro */ }
    }
  }, [save, currentStep]);

  const scheduleSave = useCallback((key, data) => {
    // Update UI buffer immediately — input stays responsive
    setStepData(prev => ({ ...prev, [key]: data }));
    // Schedule DB persistence
    pendingDataRef.current[key] = data;
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null;
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      save(payload);
    }, 500);
  }, [save, currentStep]);

  // ── Persistence safeguards: save on unmount, tab close, and tab hidden ──
  const flushPendingRef = useRef(flushPending);
  flushPendingRef.current = flushPending;

  useEffect(() => {
    const handleBeforeUnload = () => { flushPendingRef.current(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') { flushPendingRef.current(); }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      // Cleanup on unmount — flush any pending data
      flushPendingRef.current();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-400">Wizard de configuração das regras de cálculo</p>
            {/* Toggle Time / Cliente */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => switchView("team")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "team" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Time
              </button>
              <button
                onClick={async () => {
                  // Carrega versão cliente se existir
                  const clientRules = await base44.entities.CalculationRule.filter({ project_id: projectId, rule_type: "client" });
                  if (clientRules.length === 0) {
                    alert("Nenhuma versão do cliente encontrada. Gere um link primeiro.");
                    return;
                  }
                  switchView("client");
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === "client" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Cliente
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/09fa0a8a2_LogoPontotel_AmarelaePreta.png" alt="Pontotel" className="h-5 opacity-80" />
          {/* Enviar para cliente */}
          {canEdit && viewMode === "team" && (
            <>
              {clientLink ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1.5 rounded-lg max-w-[180px] truncate">{clientLink}</span>
                  <button onClick={copyClientLink} className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors" title="Copiar link">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex">
                    <button
                      onClick={generateClientLink}
                      disabled={generatingLink}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-l-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-60 transition-colors"
                    >
                      {generatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                      Enviar para cliente
                    </button>
                    {clientTeamMembers.length > 1 && (
                      <button
                        onClick={() => setShowClientPicker(!showClientPicker)}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-r-lg border border-l-0 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {showClientPicker && clientTeamMembers.length > 1 && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-72">
                      <div className="p-1.5 text-xs font-medium text-slate-500 border-b">Selecionar destinatário</div>
                      {clientTeamMembers.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedClientEmail(m.email); setShowClientPicker(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${m.email === selectedClientEmail ? "bg-purple-50 text-purple-700 font-medium" : "text-slate-700"}`}
                        >
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate">{m.name}</p>
                            <p className="text-xs text-slate-400 truncate">{m.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button
            onClick={() => {
              if (window.location.hash === "#presentation") {
                window.location.hash = "";
              } else {
                window.location.hash = "presentation";
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            title={window.location.hash === "#presentation" ? "Sair da tela cheia" : "Expandir tela para apresentação"}
          >
            {window.location.hash === "#presentation" ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {window.location.hash === "#presentation" ? "Recolher" : "Expandir"}
          </button>
          <button
            onClick={async () => {
              setGeneratingCalcPDF(true);
              try {
                const pdfBytes = await generateCalcRulesPDF({
                  project,
                  companyData: stepData.company_data,
                  allStepData: stepData,
                });
                const blob = new Blob([pdfBytes], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `Regras_Calculo_${(project?.client_name || "projeto").replace(/\s+/g, "_")}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error("Erro ao gerar PDF das regras:", err);
                alert("Erro ao gerar PDF. Tente novamente.");
              }
              setGeneratingCalcPDF(false);
            }}
            disabled={generatingCalcPDF}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 disabled:opacity-60 transition-colors"
          >
            {generatingCalcPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Gerar PDF
          </button>
          {canEdit && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={!!parametrizacaoRealizada}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setParametrizacaoRealizada(checked);
                  if (checked) {
                    const today = new Date().toISOString().split("T")[0];
                    const atividadeNome = "Parametrização de regras";
                    const atividades = await base44.entities.ScheduleActivity.filter({
                      project_id: projectId,
                      activity_name: atividadeNome
                    });
                    if (atividades.length > 0) {
                      await base44.entities.ScheduleActivity.update(atividades[0].id, { actual_end: today, status: "Concluído" });
                    } else {
                      await base44.entities.ScheduleActivity.create({
                        project_id: projectId,
                        phase_name: "Parametrização",
                        activity_name: atividadeNome,
                        order: 28,
                        actual_end: today,
                        status: "Concluído",
                      });
                    }
                  }
                }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              Parametrização realizada
            </label>
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
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-semibold text-slate-800">{step?.title}</h3>
          {step?.id === 2 && (
            <button
              onClick={() => setShowCalcModelsModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
              title="Entenda os modelos de cálculo"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {step?.id === 3 && (
            <button
              onClick={() => setShowHorasExtrasModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
              title="Entenda o funcionamento das horas extras"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {step?.id === 7 && (
            <button
              onClick={() => setShowSobreavisoModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
              title="Entenda o funcionamento do sobreaviso"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {step?.id === 9 && (
            <button
              onClick={() => setShowBancoHorasModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors"
              title="Entenda os modelos de banco de horas"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400 mb-6">Passo {currentStepIdx + 1} de {visibleSteps.length}</p>

        {step?.key === "company_data" && (
          <DadosEmpresaForm data={stepData.company_data} onChange={(data) => scheduleSave("company_data", data)} project={project} readOnly={!canEdit} />
        )}
        {step?.key === "rule_configurations" && (
          <RegrasForm companyData={stepData.company_data} data={stepData.rule_configurations} onChange={canEdit ? (data) => scheduleSave("rule_configurations", data) : () => {}} />
        )}
        {step?.key === "overtime_rules" && (
          <HorasExtrasForm companyData={stepData.company_data} data={stepData.overtime_rules} onChange={canEdit ? (data) => scheduleSave("overtime_rules", data) : () => {}} onInfoDiariaClick={() => setShowCategorizacaoHEModal(true)} onInfoMensalClick={() => setShowCategorizacaoHEMensalModal(true)} />
        )}
        {step?.key === "break_time_rules" && (
          <IntervalosForm companyData={stepData.company_data} data={stepData.break_time_rules} onChange={canEdit ? (data) => scheduleSave("break_time_rules", data) : () => {}} onInfoToleranciasClick={() => setShowToleranciasIntervaloModal(true)} ruleConfigurations={stepData.rule_configurations} onInfoPausaHoraExtraClick={() => setShowPausaHoraExtraModal(true)} />
        )}
        {step?.key === "night_shift_rules" && (
          <AdicionalNoturnoForm companyData={stepData.company_data} data={stepData.night_shift_rules} onChange={canEdit ? (data) => scheduleSave("night_shift_rules", data) : () => {}} onInfoReducaoClick={() => setShowAdicionalNoturnoModal(true)} onInfoProrrogacaoClick={() => setShowProrrogacaoNoturnoModal(true)} onInfoReducaoAmbosClick={() => setShowReducaoHoraNoturnaModal(true)} onInfoAdicionalPausaClick={() => setShowAdicionalIncluiPausaModal(true)} />
        )}
        {step?.key === "shift_12x36_rules" && (
          <Jornada12x36Form companyData={stepData.company_data} data={stepData.shift_12x36_rules} onChange={canEdit ? (data) => scheduleSave("shift_12x36_rules", data) : () => {}} onInfoFeriadoClick={() => setShowJornada12x36FeriadoModal(true)} />
        )}
        {step?.key === "sobreaviso_rules" && (
          <SobreavisoForm companyData={stepData.company_data} data={stepData.sobreaviso_rules} onChange={canEdit ? (data) => scheduleSave("sobreaviso_rules", data) : () => {}} />
        )}
        {step?.key === "bank_hours_rules" && (
          <BancoHorasForm companyData={stepData.company_data} data={stepData.bank_hours_rules} onChange={canEdit ? (data) => scheduleSave("bank_hours_rules", data) : () => {}} onInfoAcumuloClick={() => setShowBancoHorasAcumuloModal(true)} />
        )}
        {step?.key === "dsr_rules" && (
          <DSRForm companyData={stepData.company_data} data={stepData.dsr_rules} onChange={canEdit ? (data) => scheduleSave("dsr_rules", data) : () => {}} onInfoHEFeriadoClick={() => setShowDSRFeriasHEModal(true)} onInfoMesDescontoClick={() => setShowDSRMesDescontoModal(true)} />
        )}
        {step?.key === "other_verbs_rules" && (
          <OutrasVerbasForm companyData={stepData.company_data} data={stepData.other_verbs_rules} onChange={canEdit ? (data) => scheduleSave("other_verbs_rules", data) : () => {}} />
        )}
        {step?.id === 11 && <RevisaoFinal companyData={stepData.company_data} allData={stepData} project={project} />}
      </div>

      {/* Modal informativo de modelos de cálculo */}
      {showCalcModelsModal && (
        <CalculationModelsInfoModal onClose={() => setShowCalcModelsModal(false)} />
      )}

      {/* Modal informativo de horas extras */}
      {showHorasExtrasModal && (
        <HorasExtrasInfoModal onClose={() => setShowHorasExtrasModal(false)} />
      )}

      {/* Modal informativo de categorização de hora extra diária */}
      {showCategorizacaoHEModal && (
        <CategorizacaoHEInfoModal onClose={() => setShowCategorizacaoHEModal(false)} />
      )}

      {/* Modal informativo de categorização de hora extra mensal */}
      {showCategorizacaoHEMensalModal && (
        <CategorizacaoHEMensalInfoModal onClose={() => setShowCategorizacaoHEMensalModal(false)} />
      )}

      {/* Modal informativo de tolerâncias de intervalo */}
      {showToleranciasIntervaloModal && (
        <ToleranciasIntervaloInfoModal onClose={() => setShowToleranciasIntervaloModal(false)} />
      )}

      {/* Modal informativo de pausa x hora extra */}
      {showPausaHoraExtraModal && (
        <PausaHoraExtraInfoModal onClose={() => setShowPausaHoraExtraModal(false)} />
      )}

      {/* Modal informativo de adicional noturno e redução noturna */}
      {showAdicionalNoturnoModal && (
        <AdicionalNoturnoInfoModal onClose={() => setShowAdicionalNoturnoModal(false)} />
      )}

      {/* Modal informativo de prorrogação do adicional noturno */}
      {showProrrogacaoNoturnoModal && (
        <ProrrogacaoAdicionalNoturnoInfoModal onClose={() => setShowProrrogacaoNoturnoModal(false)} />
      )}

      {/* Modal informativo de redução de hora noturna */}
      {showReducaoHoraNoturnaModal && (
        <ReducaoHoraNoturnaInfoModal onClose={() => setShowReducaoHoraNoturnaModal(false)} />
      )}

      {/* Modal informativo de adicional noturno — tempo de pausa */}
      {showAdicionalIncluiPausaModal && (
        <AdicionalIncluiPausaInfoModal onClose={() => setShowAdicionalIncluiPausaModal(false)} />
      )}

      {/* Modal informativo de feriados na jornada 12x36 */}
      {showJornada12x36FeriadoModal && (
        <Jornada12x36FeriadoInfoModal onClose={() => setShowJornada12x36FeriadoModal(false)} />
      )}

      {/* Modal informativo de sobreaviso */}
      {showSobreavisoModal && (
        <SobreavisoInfoModal onClose={() => setShowSobreavisoModal(false)} />
      )}

      {/* Modal informativo de banco de horas */}
      {showBancoHorasModal && (
        <BancoHorasInfoModal onClose={() => setShowBancoHorasModal(false)} />
      )}

      {/* Modal informativo de acúmulo e fator de transformação */}
      {showBancoHorasAcumuloModal && (
        <BancoHorasAcumuloInfoModal onClose={() => setShowBancoHorasAcumuloModal(false)} />
      )}

      {/* Modal informativo de tipo de HE em feriados/folgas */}
      {showDSRFeriasHEModal && (
        <DSRFeriasHEInfoModal onClose={() => setShowDSRFeriasHEModal(false)} />
      )}

      {/* Modal informativo de mês de desconto do DSR */}
      {showDSRMesDescontoModal && (
        <DSRMesDescontoInfoModal onClose={() => setShowDSRMesDescontoModal(false)} />
      )}

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
                await flushPending();
                await save({ status: "finalizado" });

                // Preencher data de fim de execução da atividade de reunião de parametrização
                const today = new Date().toISOString().split("T")[0];
                const atividadeNome = "Reunião para parametrização de Regras (Cálculo, banco de horas e arquivo de exportação)";
                const atividades = await base44.entities.ScheduleActivity.filter({
                  project_id: projectId,
                  activity_name: atividadeNome
                });
                if (atividades.length > 0) {
                  await base44.entities.ScheduleActivity.update(atividades[0].id, { actual_end: today, status: "Concluído" });
                } else {
                  await base44.entities.ScheduleActivity.create({
                    project_id: projectId,
                    phase_name: "Parametrização",
                    activity_name: atividadeNome,
                    order: 26,
                    actual_end: today,
                    status: "Concluído",
                  });
                }

                alert("Regras de cálculo finalizadas com sucesso! E data atualizada em cronograma");
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