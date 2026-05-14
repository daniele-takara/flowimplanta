import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions, isModuleVisible } from "@/lib/scopeTemplate";
import { generateScopePDF } from "@/lib/scopePdfExport";
import ScopeItemRow from "@/components/project/tabs/ScopeItemRow";
import { ChevronLeft, ChevronRight, Plus, Minus, FileDown, Check, LayoutList, RefreshCw } from "lucide-react";
import ScopeSyncModal from "@/components/project/tabs/ScopeSyncModal.jsx";

// Aplica overrides do banco sobre uma lista de perguntas do template estático.
// Retorna novas perguntas com prompt/description/type/options/etc. do override quando existir.
function applyOverridesToQuestions(questions, overridesMap) {
  return questions.map(q => {
    const ov = overridesMap[q.id];
    if (!ov) return q;
    return {
      ...q,
      prompt: ov.prompt ?? q.prompt,
      description: ov.description ?? q.description,
      type: ov.type ?? q.type,
      options: ov.options ? JSON.parse(ov.options) : q.options,
      placeholder: ov.placeholder ?? q.placeholder,
      is_required: ov.is_required ?? q.is_required ?? false,
      rules: ov.rules ? JSON.parse(ov.rules) : q.rules,
    };
  });
}

// Constrói os módulos com overrides mesclados
function buildEffectiveModules(overridesMap) {
  return SCOPE_MODULES.map(mod => {
    if (mod.questions) {
      return { ...mod, questions: applyOverridesToQuestions(mod.questions, overridesMap) };
    }
    if (mod.subsections) {
      return {
        ...mod,
        subsections: mod.subsections.map(sub => ({
          ...sub,
          questions: applyOverridesToQuestions(sub.questions, overridesMap),
        })),
      };
    }
    return mod;
  });
}

const SANKHYA_KEY = "sankhya_manual_override";

export default function ScopeTab({ scopeItems, projectId, project, onRefresh, onScopeSaved, readOnly = false }) {
  // manualOverrides: { sankhya_manual_override: true/false }
  const [manualOverrides, setManualOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`scope_overrides_${projectId}`) || "{}");
    } catch { return {}; }
  });

  // Overrides do template persistidos no banco (ScopeTemplateOverride)
  const [overridesMap, setOverridesMap] = useState({});
  useEffect(() => {
    base44.entities.ScopeTemplateOverride.list("-version").then(list => {
      const map = {};
      list.forEach(o => { if (!map[o.question_id]) map[o.question_id] = o; });
      setOverridesMap(map);
    });
  }, []);

  // Local cache: { [questionId]: { answer, observations } }
  const [localAnswers, setLocalAnswers] = useState({});

  // Keep a ref of scopeItems for save lookups without needing re-renders
  const scopeItemsRef = useRef(scopeItems);
  useEffect(() => { scopeItemsRef.current = scopeItems; }, [scopeItems]);

  // Track which keys have pending (unsaved) edits so we don't overwrite them on re-sync
  const pendingKeys = useRef(new Set());

  // Sync localAnswers from scopeItems whenever the prop changes (e.g. after loadData in parent)
  // Only update keys that are NOT currently being edited
  useEffect(() => {
    if (!scopeItems?.length) return;
    setLocalAnswers(prev => {
      const next = { ...prev };
      scopeItems.forEach(item => {
        if (!item.order_number) return;
        const key = `q${String(item.order_number).padStart(3, "0")}`;
        // Don't overwrite a key the user is actively editing
        if (pendingKeys.current.has(key)) return;
        next[key] = { answer: item.answer || "", observations: item.observations || "" };
      });
      return next;
    });
  }, [scopeItems]);

  const contractedModules = project?.contracted_modules || [];
  const origin = project?.origin || "";

  // Log diagnóstico: detectar quando módulos chegam vazios inesperadamente
  if (contractedModules.length === 0 && project) {
    console.warn("[ScopeTab] contracted_modules vazio para projeto:", project.id, "| project completo:", JSON.stringify({ id: project.id, contracted_modules: project.contracted_modules, origin: project.origin }));
  }

  // Módulos com overrides mesclados (fonte de verdade para renderização)
  const effectiveModules = useMemo(() => buildEffectiveModules(overridesMap), [overridesMap]);

  const visibleModules = useMemo(() =>
    effectiveModules.filter(mod => isModuleVisible(mod, contractedModules, origin, manualOverrides)),
    [effectiveModules, contractedModules, origin, manualOverrides]
  );

  const sankhyaMod = effectiveModules.find(m => m.moduleKey === "integracao_folha_sankhya");
  const sankhyaAutoVisible = origin === sankhyaMod?.autoShowWhen?.value;
  const sankhyaManualEnabled = manualOverrides[SANKHYA_KEY] === true;

  // Current module index (stepper)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  // Clamp index when visible modules change
  const safeIndex = Math.min(currentIndex, Math.max(0, visibleModules.length - 1));

  const saveOverrides = (overrides) => {
    localStorage.setItem(`scope_overrides_${projectId}`, JSON.stringify(overrides));
    setManualOverrides(overrides);
  };

  const toggleSankhya = () => {
    const current = manualOverrides[SANKHYA_KEY] === true;
    saveOverrides({ ...manualOverrides, [SANKHYA_KEY]: !current });
  };

  // Save a single question answer — NO onRefresh, NO page reload
  const handleSave = async (questionId, { answer, observations }) => {
    // Mark as pending to prevent parent re-sync from overwriting
    pendingKeys.current.add(questionId);

    // Update local state immediately (optimistic)
    setLocalAnswers(prev => ({ ...prev, [questionId]: { answer, observations } }));

    // Support both "q025" style (padded) and "q251" style (direct numeric)
    const orderNum = parseInt(questionId.replace("q", ""), 10);
    const existing = scopeItemsRef.current.find(s => Number(s.order_number) === orderNum);

    if (existing) {
      await base44.entities.ScopeItem.update(existing.id, { answer, observations });
    } else {
      // Find question metadata from effective modules (overrides already applied)
      let foundQ = null;
      let foundSection = "";
      for (const mod of effectiveModules) {
        const qs = getModuleQuestions(mod);
        const q = qs.find(q => q.id === questionId);
        if (q) { foundQ = q; foundSection = mod.moduleLabel; break; }
      }
      const created = await base44.entities.ScopeItem.create({
        project_id: projectId,
        question_id: questionId,
        order_number: orderNum,
        section: foundSection,
        question: foundQ?.prompt || "",
        best_practice: foundQ?.description || "",
        answer,
        observations,
        field_type: foundQ?.type || "text",
        is_required: foundQ?.is_required || false
      });
      // Add to ref so subsequent saves find the record
      if (created?.id) {
        scopeItemsRef.current = [
          ...scopeItemsRef.current,
          { ...created, order_number: orderNum }
        ];
      }
    }
    // Clear pending flag — data is now persisted
    pendingKeys.current.delete(questionId);
    // Notifica o pai para recarregar scopeItems silenciosamente (sem spinner),
    // garantindo que TAP, Cronograma e Termo de Encerramento recebam o answersMap atualizado
    if (onScopeSaved) onScopeSaved();
  };

  const isQuestionVisible = (question) => {
    const rule = question.rules?.find(r => r.type === "conditional_visibility");
    if (!rule) return true;
    const depAnswer = localAnswers[rule.dependsOn]?.answer || "";
    if (rule.condition.operator === "equals") return depAnswer === rule.condition.value;
    if (rule.condition.operator === "contains") return depAnswer.includes(rule.condition.value);
    return true;
  };

  // Returns only questions that count toward completeness:
  // exclude informativo types and conditionally hidden questions
  const getCountableQuestions = (mod) => {
    return getModuleQuestions(mod).filter(q =>
      q.type !== "informativo" && isQuestionVisible(q)
    );
  };

  const getModuleAnsweredCount = (mod) => {
    return getCountableQuestions(mod).filter(q => localAnswers[q.id]?.answer).length;
  };

  if (visibleModules.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">Nenhum módulo visível para este projeto.</p>
        <p className="text-xs mt-1">
          {contractedModules.length === 0
            ? "Nenhum módulo contratado cadastrado nos Dados Iniciais. Clique em \"Editar\" na aba Dados Iniciais para adicionar."
            : "Verifique os módulos contratados nas informações do projeto."}
        </p>
      </div>
    );
  }

  const currentMod = visibleModules[safeIndex];
  const allCurrentQs = getCountableQuestions(currentMod);
  const answeredCurrent = getModuleAnsweredCount(currentMod);
  const totalModules = visibleModules.length;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Escopo Técnico</h2>
          <p className="text-sm text-slate-400">
            Módulo {safeIndex + 1} de {totalModules} &nbsp;·&nbsp; {answeredCurrent}/{allCurrentQs.length} respondidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!sankhyaAutoVisible && !readOnly && (
            <button
              onClick={toggleSankhya}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                sankhyaManualEnabled
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              }`}
            >
              {sankhyaManualEnabled ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {sankhyaManualEnabled ? "Remover Sankhya" : "Incluir Sankhya"}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar template
            </button>
          )}
          <button
            onClick={() => generateScopePDF(project, localAnswers, contractedModules, origin, manualOverrides, effectiveModules)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Gerar PDF
          </button>
        </div>
      </div>

      {/* Module stepper nav */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {visibleModules.map((mod, idx) => {
          const total = getCountableQuestions(mod).length;
          const answered = getModuleAnsweredCount(mod);
          const complete = total > 0 && answered === total;
          const active = idx === safeIndex;
          return (
            <button
              key={mod.moduleKey}
              onClick={() => setCurrentIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : complete
                  ? "bg-green-50 text-green-700 border-green-200 hover:border-green-400"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {complete && !active && <Check className="w-3 h-3 text-green-500" />}
              <span className="text-xs opacity-60 font-mono">{idx + 1}</span>
              <span className="hidden sm:inline">{mod.moduleLabel.replace(/^(MÓDULO:|PROCESSO:)\s*/i, "")}</span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700 truncate pr-4">{currentMod.moduleLabel}</span>
          <span className="text-xs text-slate-400 shrink-0">{answeredCurrent}/{allCurrentQs.length}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: allCurrentQs.length > 0 ? `${(answeredCurrent / allCurrentQs.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Module content */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <LayoutList className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{currentMod.moduleLabel}</span>
        </div>

        <div className="px-5 pb-5">
          {currentMod.subsections ? (
            currentMod.subsections.map((sub, si) => {
              const visibleQs = sub.questions.filter(isQuestionVisible);
              if (visibleQs.length === 0) return null;
              return (
                <div key={si} className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 pb-1 border-b border-slate-100">
                    {sub.label}
                  </p>
                  {visibleQs.map(q => (
                    <ScopeItemRow
                      key={q.id}
                      question={q}
                      savedAnswer={localAnswers[q.id]?.answer || ""}
                      savedObs={localAnswers[q.id]?.observations || ""}
                      onSave={readOnly ? () => {} : handleSave}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            <div className="mt-4">
              {currentMod.questions.filter(isQuestionVisible).map(q => (
                <ScopeItemRow
                  key={q.id}
                  question={q}
                  savedAnswer={localAnswers[q.id]?.answer || ""}
                  savedObs={localAnswers[q.id]?.observations || ""}
                  onSave={readOnly ? () => {} : handleSave}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sync modal */}
      {showSyncModal && (
        <ScopeSyncModal
          projectId={projectId}
          scopeItems={scopeItems}
          onClose={() => setShowSyncModal(false)}
          onSynced={() => { setShowSyncModal(false); if (onRefresh) onRefresh(); }}
        />
      )}

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={safeIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        <span className="text-xs text-slate-400">
          {safeIndex + 1} / {totalModules}
        </span>

        <button
          onClick={() => setCurrentIndex(i => Math.min(totalModules - 1, i + 1))}
          disabled={safeIndex === totalModules - 1}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}