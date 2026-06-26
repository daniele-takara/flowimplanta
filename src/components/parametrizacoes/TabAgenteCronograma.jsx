import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, Save, RefreshCw, Eye, ToggleLeft } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${value ? "bg-green-500" : "bg-slate-300"}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}

const TONE_LABELS = {
  formal: "Formal — linguagem técnica e estruturada",
  direto: "Direto — respostas objetivas e concisas",
  didatico: "Didático — explica o raciocínio passo a passo",
};

const DEFAULT_CONFIG = {
  max_activities_per_day: 3,
  enforce_dependencies: true,
  confirm_before_apply: true,
  report_impact: true,
  work_hours_start: "09:00",
  work_hours_end: "18:00",
  agent_tone: "direto",
  extra_instructions: "",
};

function buildPromptPreview(config) {
  const toneMap = {
    formal: "Use linguagem formal e técnica.",
    direto: "Seja direto e objetivo. Evite explicações longas.",
    didatico: "Explique o raciocínio passo a passo para cada cálculo ou sugestão.",
  };

  return `# Agente de Cronograma — Prompt de Sistema

## Identidade
Você é o Especialista em Cronograma da FlowImplanta (Pontotel).
Tom: ${toneMap[config.agent_tone] || toneMap.direto}

## Regras Operacionais
- Máximo de ${config.max_activities_per_day} atividade(s) por recurso por dia.
- Dependências obrigatórias: ${config.enforce_dependencies ? "SIM — nunca quebre a cadeia de predecessoras." : "NÃO — datas podem ser ajustadas livremente."}
- Horário de trabalho: ${config.work_hours_start} às ${config.work_hours_end}.
- Reportar impacto ao sugerir mudanças: ${config.report_impact ? "SIM" : "NÃO"}.
- Confirmação antes de aplicar: ${config.confirm_before_apply ? "SIM — sempre aguarde ok do usuário." : "NÃO — pode aplicar diretamente."}

## Feriados (Brasil 2024-2026)
Ignorar: fins de semana, 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12 e Sexta-feira Santa.

## Formato de Resposta
- Datas sempre em DD/MM/AAAA.
- Ao mover uma tarefa, liste TODAS as tarefas impactadas com novas datas.
- Nunca "alucine" datas — se faltar contexto, peça ao usuário.
${config.extra_instructions ? `\n## Instruções Adicionais\n${config.extra_instructions}` : ""}`.trim();
}

export default function TabAgenteCronograma() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.ScheduleAgentConfig.list();
    if (list.length > 0) {
      setConfigId(list[0].id);
      setConfig({ ...DEFAULT_CONFIG, ...list[0] });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (key, value) => {
    setConfig(c => ({ ...c, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (configId) {
      await base44.entities.ScheduleAgentConfig.update(configId, config);
    } else {
      const created = await base44.entities.ScheduleAgentConfig.create(config);
      setConfigId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const promptPreview = buildPromptPreview(config);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Agente de Cronograma</p>
            <p className="text-xs text-slate-500">Configure o comportamento do assistente de cronograma</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar Configuração"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Coluna 1: Configurações */}
        <div className="space-y-4">
          {/* Carga de trabalho */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carga de Trabalho</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Máximo de atividades por recurso/dia
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.max_activities_per_day}
                onChange={e => set("max_activities_per_day", parseInt(e.target.value) || 1)}
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">O agente alertará se um responsável exceder este limite.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Início do expediente</label>
                <input
                  type="time"
                  value={config.work_hours_start}
                  onChange={e => set("work_hours_start", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fim do expediente</label>
                <input
                  type="time"
                  value={config.work_hours_end}
                  onChange={e => set("work_hours_end", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Comportamento */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comportamento</p>

            {[
              { key: "enforce_dependencies", label: "Forçar dependências (predecessoras)", desc: "O agente nunca sugerirá datas que quebrem a cadeia de dependências." },
              { key: "report_impact", label: "Reportar impacto ao sugerir mudanças", desc: "Lista todas as tarefas afetadas antes de confirmar." },
              { key: "confirm_before_apply", label: "Exigir confirmação antes de aplicar", desc: "O agente aguarda ok do usuário antes de salvar alterações." },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle value={!!config[key]} onChange={v => set(key, v)} />
              </div>
            ))}
          </div>

          {/* Tom do agente */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tom de Comunicação</p>
            <div className="space-y-2">
              {Object.entries(TONE_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${config.agent_tone === value ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <input
                    type="radio"
                    name="agent_tone"
                    value={value}
                    checked={config.agent_tone === value}
                    onChange={() => set("agent_tone", value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Instruções extras */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instruções Adicionais (opcional)</p>
            <textarea
              rows={4}
              value={config.extra_instructions || ""}
              onChange={e => set("extra_instructions", e.target.value)}
              placeholder="Ex: Para clientes do setor de Varejo, priorize tarefas no período da manhã..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>
        </div>

        {/* Coluna 2: Preview do Prompt */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pré-visualização do Prompt</p>
          </div>
          <div className="flex-1 bg-slate-900 rounded-xl p-4 overflow-auto min-h-[500px]">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
              {promptPreview}
            </pre>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Este é o prompt exato que o Agente de Cronograma receberá ao ser invocado.
          </p>
        </div>
      </div>
    </div>
  );
}