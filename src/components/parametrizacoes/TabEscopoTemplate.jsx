import { useState, useMemo } from "react";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate.js";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import {
  ChevronDown, ChevronRight, AlertTriangle, Info,
  Calendar, FileText, Link, Eye, EyeOff, Search, CheckCircle2
} from "lucide-react";

// ── Mapa de impactos: pergunta → atividades do cronograma afetadas ─────────────
// Construído a partir de scheduleTasks.js — lê todas as condições visibleWhen/visibleWhenAll/visibleWhenAny

function buildImpactMap() {
  const map = {}; // questionId → { tasks, phases }

  const extractConditions = (task) => {
    const conds = [];
    const v = task.visibleWhen;
    const vAll = task.visibleWhenAll;
    const vAny = task.visibleWhenAny;
    if (v && v !== "always") conds.push(v);
    if (vAll) conds.push(...vAll);
    if (vAny) conds.push(...vAny);
    return conds;
  };

  SCHEDULE_TASKS.forEach(task => {
    if (task.type === "group") return;
    const conds = extractConditions(task);
    conds.forEach(cond => {
      const src = cond.source || "";
      // Exemplos: "escopo.q006", "dados_iniciais.modulos_contratados"
      if (!src.startsWith("escopo.")) return;
      const qId = src.replace("escopo.", ""); // ex: "q006", "q038", "q039"
      if (!map[qId]) map[qId] = { tasks: [], phases: new Set() };
      map[qId].tasks.push(task);
      map[qId].phases.add(task.phase);
    });
  });

  // Converter Set para array
  Object.keys(map).forEach(k => {
    map[k].phases = Array.from(map[k].phases);
  });
  return map;
}

const IMPACT_MAP = buildImpactMap();

// ── Impactos TAP ──────────────────────────────────────────────────────────────
// Perguntas que afetam seções da TAP (mapeamento estático baseado na lógica atual)
const TAP_IMPACT = {
  q006: ["Seção 4 — Entregas Previstas (Integração Sankhya)"],
  q037: ["Seção 4 — Entregas Previstas (Banco de Horas)"],
  q038: ["Seção 4 — Entregas Previstas (Sobreaviso)"],
  q039: ["Seção 4 — Entregas Previstas (NR17)"],
  q019: ["Seção 4 — Entregas Previstas (Notificações)"],
  q020: ["Seção 4 — Entregas Previstas (Geolocalização)"],
  q062: ["Seção 4 — Entregas Previstas (Notificações HE)"],
};

// ── Impactos Integração ───────────────────────────────────────────────────────
const INTEGRATION_IMPACT = {
  q004: ["Integração Sankhya — validação de viabilidade"],
  q005: ["Integração Sankhya — tipo de sistema (Pessoal+/MGE)"],
  q006: ["Integração Sankhya — ativação do fluxo de integração", "Cronograma fase Integração — geração de atividades"],
};

// ── Labels de tipo ─────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  number: "Número",
  text: "Texto curto",
  short_text: "Texto curto",
  long_text: "Texto livre",
  single_select: "Seleção única",
  multi_select: "Múltipla escolha",
  boolean: "Sim/Não",
  date: "Data",
  date_range_text: "Período (texto)",
  informativo: "Informativo",
};

const TYPE_COLORS = {
  number: "bg-blue-50 text-blue-700 border-blue-200",
  text: "bg-slate-50 text-slate-600 border-slate-200",
  short_text: "bg-slate-50 text-slate-600 border-slate-200",
  long_text: "bg-slate-50 text-slate-600 border-slate-200",
  single_select: "bg-purple-50 text-purple-700 border-purple-200",
  multi_select: "bg-indigo-50 text-indigo-700 border-indigo-200",
  boolean: "bg-green-50 text-green-700 border-green-200",
  date: "bg-amber-50 text-amber-700 border-amber-200",
  date_range_text: "bg-amber-50 text-amber-700 border-amber-200",
  informativo: "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Componente: badge de impacto ───────────────────────────────────────────────
function ImpactBadge({ label, color, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

// ── Componente: linha de pergunta ──────────────────────────────────────────────
function QuestionRow({ q, allQuestions }) {
  const [expanded, setExpanded] = useState(false);

  const impactTasks = IMPACT_MAP[q.id]?.tasks || [];
  const impactPhases = IMPACT_MAP[q.id]?.phases || [];
  const tapImpacts = TAP_IMPACT[q.id] || [];
  const integImpacts = INTEGRATION_IMPACT[q.id] || [];

  const dependsOn = (q.rules || []).find(r => r.type === "conditional_visibility");
  const parentQ = dependsOn ? allQuestions.find(aq => aq.id === dependsOn.dependsOn) : null;

  const totalImpact = impactTasks.length + tapImpacts.length + integImpacts.length;
  const riskLevel = totalImpact >= 4 ? "high" : totalImpact >= 1 ? "medium" : "low";

  const riskConfig = {
    high: { label: "Crítico", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500" },
    medium: { label: "Atenção", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
    low: { label: "Seguro", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
  }[riskLevel];

  return (
    <div className={`border rounded-xl overflow-hidden mb-2 ${expanded ? "border-blue-300 shadow-sm" : "border-slate-200"}`}>
      {/* Header da pergunta */}
      <div
        className={`flex items-start gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${expanded ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-12 shrink-0 pt-0.5">
          <span className="text-xs font-bold text-slate-400 font-mono">{q.id.toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">{q.prompt}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[q.type] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
              {TYPE_LABELS[q.type] || q.type}
            </span>
            {dependsOn && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                <Link className="w-2.5 h-2.5" /> Condicional ({q.id})
              </span>
            )}
            {impactTasks.length > 0 && (
              <ImpactBadge label={`${impactTasks.length} atividade(s)`} color="text-blue-700 bg-blue-50 border-blue-200" icon={Calendar} />
            )}
            {tapImpacts.length > 0 && (
              <ImpactBadge label="Impacto na TAP" color="text-purple-700 bg-purple-50 border-purple-200" icon={FileText} />
            )}
            {integImpacts.length > 0 && (
              <ImpactBadge label="Integração" color="text-amber-700 bg-amber-50 border-amber-200" icon={AlertTriangle} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${riskConfig.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${riskConfig.dot}`} />
            {riskConfig.label}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="bg-white border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Descrição */}
          {q.description && (
            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
              {q.description}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Configuração */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Configuração</h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tipo de resposta</span>
                  <span className={`px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[q.type] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                </div>

                {q.options?.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">Opções</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {q.options.map(opt => (
                        <span key={opt} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">{opt}</span>
                      ))}
                    </div>
                  </div>
                )}

                {q.placeholder && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Placeholder</span>
                    <span className="text-slate-400 italic">{q.placeholder}</span>
                  </div>
                )}
              </div>

              {/* Dependência condicional */}
              {dependsOn && (
                <div className="mt-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Visível quando:</p>
                  <p className="text-xs text-orange-600">
                    <strong>{dependsOn.dependsOn.toUpperCase()}</strong> {dependsOn.condition.operator === "equals" ? "=" : "contém"} <strong>"{dependsOn.condition.value}"</strong>
                  </p>
                  {parentQ && (
                    <p className="text-xs text-orange-500 mt-1 italic">
                      Pergunta pai: "{parentQ.prompt.substring(0, 60)}..."
                    </p>
                  )}
                </div>
              )}

              {/* Regras especiais */}
              {(q.rules || []).filter(r => r.type !== "conditional_visibility").map((r, i) => (
                <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  <span className="font-semibold">Regra:</span> {r.message || `${r.type}${r.option ? ` → "${r.option}"` : ""}`}
                </div>
              ))}
            </div>

            {/* Impactos */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Impactos no sistema</h4>

              {totalImpact === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Nenhuma dependência crítica no cronograma, TAP ou integrações
                </div>
              )}

              {/* Impacto cronograma */}
              {impactTasks.length > 0 && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Cronograma — {impactTasks.length} atividade(s) afetada(s)
                  </p>
                  <div className="space-y-1">
                    {impactPhases.map(ph => (
                      <div key={ph} className="text-xs text-blue-600 font-medium">{ph}</div>
                    ))}
                    <div className="mt-1.5 space-y-0.5">
                      {impactTasks.map(t => (
                        <div key={t.id} className="text-xs text-blue-500 flex items-start gap-1">
                          <span className="shrink-0 mt-0.5">↳</span>
                          <span>{t.activity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Impacto TAP */}
              {tapImpacts.length > 0 && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Impacto na TAP
                  </p>
                  {tapImpacts.map((t, i) => (
                    <p key={i} className="text-xs text-purple-600">↳ {t}</p>
                  ))}
                </div>
              )}

              {/* Impacto integrações */}
              {integImpacts.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Integrações afetadas
                  </p>
                  {integImpacts.map((t, i) => (
                    <p key={i} className="text-xs text-amber-600">↳ {t}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente: seção de módulo ────────────────────────────────────────────────
function ModuleSection({ mod, allQuestions, searchTerm }) {
  const [open, setOpen] = useState(true);
  const questions = getModuleQuestions(mod).filter(q =>
    !searchTerm || q.prompt.toLowerCase().includes(searchTerm.toLowerCase()) || q.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  if (questions.length === 0) return null;

  const criticalCount = questions.filter(q => {
    const t = (IMPACT_MAP[q.id]?.tasks?.length || 0) + (TAP_IMPACT[q.id]?.length || 0) + (INTEGRATION_IMPACT[q.id]?.length || 0);
    return t >= 4;
  }).length;

  const attnCount = questions.filter(q => {
    const t = (IMPACT_MAP[q.id]?.tasks?.length || 0) + (TAP_IMPACT[q.id]?.length || 0) + (INTEGRATION_IMPACT[q.id]?.length || 0);
    return t >= 1 && t < 4;
  }).length;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 px-5 py-3.5 bg-slate-700 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white flex-1">{mod.moduleLabel}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">{questions.length} pergunta(s)</span>
          {criticalCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{criticalCount} crítico(s)</span>}
          {attnCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white">{attnCount} atenção</span>}
        </div>
      </div>
      {open && (
        <div className="p-4 space-y-0">
          {!mod.alwaysVisible && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              {mod.showWhenContractedModule ? `Visível apenas quando módulo "${mod.showWhenContractedModule}" está contratado` : "Visibilidade condicional"}
            </div>
          )}
          {questions.map(q => (
            <QuestionRow key={q.id} q={q} allQuestions={allQuestions} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function TabEscopoTemplate() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterImpact, setFilterImpact] = useState("all");

  const allQuestions = useMemo(() => SCOPE_MODULES.flatMap(m => getModuleQuestions(m)), []);

  // Estatísticas globais
  const stats = useMemo(() => {
    let critical = 0, warning = 0, safe = 0;
    allQuestions.forEach(q => {
      const t = (IMPACT_MAP[q.id]?.tasks?.length || 0) + (TAP_IMPACT[q.id]?.length || 0) + (INTEGRATION_IMPACT[q.id]?.length || 0);
      if (t >= 4) critical++;
      else if (t >= 1) warning++;
      else safe++;
    });
    return { total: allQuestions.length, critical, warning, safe };
  }, [allQuestions]);

  const filteredModules = useMemo(() => {
    if (filterImpact === "all") return SCOPE_MODULES;
    return SCOPE_MODULES.map(mod => ({
      ...mod,
      _filteredQuestions: getModuleQuestions(mod).filter(q => {
        const t = (IMPACT_MAP[q.id]?.tasks?.length || 0) + (TAP_IMPACT[q.id]?.length || 0) + (INTEGRATION_IMPACT[q.id]?.length || 0);
        if (filterImpact === "critical") return t >= 4;
        if (filterImpact === "warning") return t >= 1 && t < 4;
        if (filterImpact === "safe") return t === 0;
        return true;
      }),
    })).filter(mod => (mod._filteredQuestions?.length || 0) > 0);
  }, [filterImpact]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-sm font-bold text-slate-800 mb-0.5">Escopo Técnico — Mapa de Dependências</h3>
        <p className="text-xs text-slate-400">
          Visualização completa de cada pergunta com seus impactos no cronograma, TAP e integrações.
          Perguntas marcadas como <strong>Crítico</strong> afetam múltiplas atividades do sistema.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Perguntas totais</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center cursor-pointer hover:border-red-400 transition-colors" onClick={() => setFilterImpact(f => f === "critical" ? "all" : "critical")}>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          <p className="text-xs text-red-500 mt-0.5">Críticas</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center cursor-pointer hover:border-amber-400 transition-colors" onClick={() => setFilterImpact(f => f === "warning" ? "all" : "warning")}>
          <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
          <p className="text-xs text-amber-500 mt-0.5">Atenção</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center cursor-pointer hover:border-green-400 transition-colors" onClick={() => setFilterImpact(f => f === "safe" ? "all" : "safe")}>
          <p className="text-2xl font-bold text-green-600">{stats.safe}</p>
          <p className="text-xs text-green-500 mt-0.5">Sem impacto crítico</p>
        </div>
      </div>

      {/* Aviso de segurança */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <strong>Visualização de dependências — somente leitura.</strong> As perguntas do Escopo Técnico estão definidas em
          <code className="bg-blue-100 px-1 rounded mx-0.5">scopeTemplate.js</code> e impactam diretamente o cronograma, a TAP e as integrações.
          Alterações requerem validação de impacto em <strong>todos os projetos existentes</strong> antes de serem aplicadas.
        </div>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar pergunta ou ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { id: "all", label: "Todas" },
            { id: "critical", label: "🔴 Críticas" },
            { id: "warning", label: "🟡 Atenção" },
            { id: "safe", label: "🟢 Seguras" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterImpact(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filterImpact === f.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de módulos */}
      {filteredModules.map(mod => (
        <ModuleSection
          key={mod.moduleKey}
          mod={filterImpact !== "all" ? { ...mod, questions: mod._filteredQuestions, subsections: mod.subsections?.map(s => ({ ...s, questions: s.questions.filter(q => (mod._filteredQuestions || []).find(fq => fq.id === q.id)) })).filter(s => s.questions.length > 0) } : mod}
          allQuestions={allQuestions}
          searchTerm={searchTerm}
        />
      ))}
    </div>
  );
}