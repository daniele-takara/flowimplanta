import { useState, useMemo, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate.js";
import { ChevronDown, ChevronRight, EyeOff, Search, Info, RefreshCw } from "lucide-react";
import { buildImpactMap, getRiskLevel, getAllQuestions } from "@/lib/scopeImpactHelpers.js";
import QuestionEditor from "@/components/parametrizacoes/escopo/QuestionEditor.jsx";

const IMPACT_MAP = buildImpactMap();

// ── Seção de módulo ───────────────────────────────────────────────────────────
function ModuleSection({ mod, overridesMap, allQuestions, searchTerm, onSaved }) {
  const [open, setOpen] = useState(true);

  const baseQuestions = getModuleQuestions(mod);
  const questions = baseQuestions.filter(q =>
    !searchTerm ||
    q.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  if (questions.length === 0) return null;

  const criticalCount = questions.filter(q => getRiskLevel(q.id, IMPACT_MAP) === "high").length;
  const attnCount = questions.filter(q => getRiskLevel(q.id, IMPACT_MAP) === "medium").length;
  const customizedCount = questions.filter(q => overridesMap[q.id]).length;

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
          {customizedCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white">{customizedCount} personalizada(s)</span>}
          {criticalCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{criticalCount} crítico(s)</span>}
          {attnCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-300 text-slate-800">{attnCount} atenção</span>}
        </div>
      </div>
      {open && (
        <div className="p-4">
          {!mod.alwaysVisible && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              {mod.showWhenContractedModule
                ? `Módulo "${mod.showWhenContractedModule}" precisa estar contratado para este bloco aparecer`
                : "Visibilidade condicional"}
            </div>
          )}
          {questions.map(q => (
            <QuestionEditor
              key={q.id}
              q={q}
              override={overridesMap[q.id] || null}
              impactMap={IMPACT_MAP}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabEscopoTemplate() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterImpact, setFilterImpact] = useState("all");
  const [overridesMap, setOverridesMap] = useState({}); // { [question_id]: ScopeTemplateOverride }
  const [loading, setLoading] = useState(true);

  const allQuestions = useMemo(() => getAllQuestions(), []);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    const list = await base44.entities.ScopeTemplateOverride.list("-version");
    // Manter apenas o override mais recente por question_id
    const map = {};
    list.forEach(o => {
      if (!map[o.question_id]) map[o.question_id] = o;
    });
    setOverridesMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { loadOverrides(); }, [loadOverrides]);

  // Estatísticas
  const stats = useMemo(() => {
    let critical = 0, warning = 0, safe = 0, customized = 0;
    allQuestions.forEach(q => {
      const level = getRiskLevel(q.id, IMPACT_MAP);
      if (level === "high") critical++;
      else if (level === "medium") warning++;
      else safe++;
      if (overridesMap[q.id]) customized++;
    });
    return { total: allQuestions.length, critical, warning, safe, customized };
  }, [allQuestions, overridesMap]);

  const filteredModules = useMemo(() => {
    if (filterImpact === "all") return SCOPE_MODULES;
    return SCOPE_MODULES.map(mod => ({
      ...mod,
      _filteredIds: new Set(
        getModuleQuestions(mod)
          .filter(q => {
            const level = getRiskLevel(q.id, IMPACT_MAP);
            if (filterImpact === "critical") return level === "high";
            if (filterImpact === "warning") return level === "medium";
            if (filterImpact === "safe") return level === "low";
            if (filterImpact === "custom") return !!overridesMap[q.id];
            return true;
          })
          .map(q => q.id)
      ),
    })).filter(mod => mod._filteredIds?.size > 0);
  }, [filterImpact, overridesMap]);

  // Adaptar módulo filtrado para manter apenas as perguntas relevantes
  const adaptMod = (mod) => {
    if (!mod._filteredIds) return mod;
    return {
      ...mod,
      questions: mod.questions?.filter(q => mod._filteredIds.has(q.id)),
      subsections: mod.subsections?.map(s => ({
        ...s,
        questions: s.questions.filter(q => mod._filteredIds.has(q.id)),
      })).filter(s => s.questions.length > 0),
    };
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-0.5">Escopo Técnico — Parametrizações</h3>
          <p className="text-xs text-slate-400">
            Clique em <strong>Editar</strong> em qualquer pergunta para personalizar. O botão
            <strong> Testar e Salvar</strong> executa auditoria de impacto antes de persistir.
          </p>
        </div>
        <button
          onClick={loadOverrides}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3 h-3" /> Recarregar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total</p>
        </div>
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center cursor-pointer hover:border-amber-400 transition-colors"
          onClick={() => setFilterImpact(f => f === "custom" ? "all" : "custom")}
        >
          <p className="text-2xl font-bold text-amber-600">{stats.customized}</p>
          <p className="text-xs text-amber-500 mt-0.5">Personalizadas</p>
        </div>
        <div
          className="bg-red-50 border border-red-200 rounded-xl p-3 text-center cursor-pointer hover:border-red-400 transition-colors"
          onClick={() => setFilterImpact(f => f === "critical" ? "all" : "critical")}
        >
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          <p className="text-xs text-red-500 mt-0.5">Críticas</p>
        </div>
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center cursor-pointer hover:border-yellow-400 transition-colors"
          onClick={() => setFilterImpact(f => f === "warning" ? "all" : "warning")}
        >
          <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
          <p className="text-xs text-yellow-500 mt-0.5">Atenção</p>
        </div>
        <div
          className="bg-green-50 border border-green-200 rounded-xl p-3 text-center cursor-pointer hover:border-green-400 transition-colors"
          onClick={() => setFilterImpact(f => f === "safe" ? "all" : "safe")}
        >
          <p className="text-2xl font-bold text-green-600">{stats.safe}</p>
          <p className="text-xs text-green-500 mt-0.5">Seguras</p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <strong>Persistência segura:</strong> Alterações são salvas em{" "}
          <code className="bg-blue-100 px-1 rounded">ScopeTemplateOverride</code> no banco.
          O <code className="bg-blue-100 px-1 rounded">scopeTemplate.js</code> permanece intacto como fallback.
          Projetos existentes <strong>não são afetados</strong> — novos projetos carregarão as configurações personalizadas.
          Perguntas marcadas como <span className="font-bold text-amber-700">Personalizadas</span> têm override ativo.
        </div>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por texto ou ID (ex: q006)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Todas" },
            { id: "custom", label: "🟠 Personalizadas" },
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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        filteredModules.map(mod => (
          <ModuleSection
            key={mod.moduleKey}
            mod={adaptMod(mod)}
            overridesMap={overridesMap}
            allQuestions={allQuestions}
            searchTerm={searchTerm}
            onSaved={loadOverrides}
          />
        ))
      )}
    </div>
  );
}