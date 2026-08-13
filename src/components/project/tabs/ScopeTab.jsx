import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions, isModuleVisible } from "@/lib/scopeTemplate";
import { generateScopePDF } from "@/lib/scopePdfExport";
import { downloadScopeTemplatePDF } from "@/lib/scopeTemplatePdfExport";
import ScopeItemRow from "@/components/project/tabs/ScopeItemRow";
import { ChevronLeft, ChevronRight, Plus, Minus, FileDown, Check, LayoutList, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import ScopeSyncModal from "@/components/project/tabs/ScopeSyncModal.jsx";
import { logAudit } from "@/lib/auditLog";

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

export default function ScopeTab({ scopeItems, projectId, project, onRefresh, onScopeSaved, readOnly = false, canUpdateTemplate = true }) {
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

  // Track last save timestamp per key to prevent stale DB data from overwriting optimistic updates
  const lastSavedAt = useRef({});

  // Sync localAnswers from scopeItems whenever the prop changes (e.g. after loadData in parent)
  // Only update keys that are NOT currently being edited AND were not recently saved
  // (previne que reloadScopeItems com dados stale sobrescreva save otimista recém-feito)
  const STALE_PROTECTION_WINDOW_MS = 3000; // 3s de proteção após save
  useEffect(() => {
    const ts = new Date().toISOString().substr(11, 12);
    if (!scopeItems?.length) {
      console.log(`[ScopeTab] ⏱ ${ts} useEffect sync — scopeItems VAZIO, pulando`);
      return;
    }
    const now = Date.now();
    console.log(`[ScopeTab] ⏱ ${ts} useEffect sync — scopeItems recebidos`, {
      count: scopeItems.length,
      pendingKeys: [...pendingKeys.current],
      orderNumbers: scopeItems.map(s => s.order_number),
      questionIds: scopeItems.map(s => s.question_id),
    });
    setLocalAnswers(prev => {
      const next = { ...prev };
      let syncedCount = 0;
      let skippedPending = 0;
      let skippedStaleProtection = 0;
      let skippedNoOrder = 0;
      // Deduplicate by order_number: keep item with non-empty answer; if both have answers, keep latest updated
      const seen = {};
      scopeItems.forEach(item => {
        const on = item.order_number;
        if (on == null) {
          skippedNoOrder++;
          return;
        }
        const key = `q${String(on).padStart(3, "0")}`;
        if (!seen[key]) { seen[key] = item; return; }
        // Duplicate detected — keep best (non-empty answer wins; then latest updated_date)
        const existing = seen[key];
        const existingHas = !!existing.answer;
        const currentHas = !!item.answer;
        if (!existingHas && currentHas) { seen[key] = item; }
        else if (existingHas && !currentHas) { /* keep existing */ }
        else if (currentHas && existingHas) {
          const exUp = new Date(existing.updated_date || existing.created_date || 0).getTime();
          const curUp = new Date(item.updated_date || item.created_date || 0).getTime();
          if (curUp > exUp) seen[key] = item;
        }
      });

      Object.values(seen).forEach(item => {
        const key = `q${String(item.order_number).padStart(3, "0")}`;
        if (pendingKeys.current.has(key)) {
          skippedPending++;
          return;
        }
        const lastSave = lastSavedAt.current[key] || 0;
        const wasRecentlySaved = (now - lastSave) < STALE_PROTECTION_WINDOW_MS;
        const prevVal = prev[key];
        const newVal = { answer: item.answer || "", observations: item.observations || "" };
        if (wasRecentlySaved && prevVal && (prevVal.answer || prevVal.observations)) {
          const dbHasLess = (!newVal.answer && prevVal.answer) || (!newVal.observations && prevVal.observations);
          if (dbHasLess) {
            skippedStaleProtection++;
            return;
          }
        }
        if (prevVal?.answer !== newVal.answer || prevVal?.observations !== newVal.observations) {
          syncedCount++;
        }
        next[key] = newVal;
      });
      console.log(`[ScopeTab] ⏱ ${ts} useEffect sync — RESULTADO`, {
        syncedCount,
        skippedPending,
        skippedStaleProtection,
        skippedNoOrder,
        totalLocalKeys: Object.keys(next).length,
        sampleEntries: Object.fromEntries(
          Object.entries(next).filter(([k]) => syncedCount > 0 || skippedStaleProtection > 0)
        ),
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
    console.log("[ScopeTab] handleSave — INÍCIO", {
      questionId,
      answer,
      observations,
      hasAnswer: !!answer,
      hasObs: !!observations,
      scopeItemsCount: scopeItemsRef.current?.length || 0,
    });

    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeTab] ⏱ ${ts} handleSave — INÍCIO (DEMAIS LOGS ABAIXO)`);

    // Mark as pending to prevent parent re-sync from overwriting
    pendingKeys.current.add(questionId);

    // Update local state immediately (optimistic)
    setLocalAnswers(prev => ({ ...prev, [questionId]: { answer, observations } }));

    // Support both "q025" style (padded) and "q251" style (direct numeric)
    const orderNum = parseInt(questionId.replace("q", ""), 10);
    const existing = scopeItemsRef.current.find(s => Number(s.order_number) === orderNum);

    // Log detalhado da busca
    console.log("[ScopeTab] handleSave — BUSCA ScopeItem existente", {
      questionId,
      orderNum,
      found: !!existing,
      existingId: existing?.id || null,
      existingOrderNum: existing?.order_number ?? null,
      existingQuestionId: existing?.question_id ?? null,
      existingAnswer: existing?.answer ?? null,
      existingObs: existing?.observations ?? null,
      allOrderNumbers: scopeItemsRef.current.map(s => ({ id: s.id, order_number: s.order_number, question_id: s.question_id })),
    });

    if (existing) {
      console.log("[ScopeTab] handleSave — UPDATE", { id: existing.id, answer, observations });
      const oldAnswer = existing.answer || "";
      const oldObs = existing.observations || "";
      await base44.entities.ScopeItem.update(existing.id, { answer, observations });
      console.log("[ScopeTab] handleSave — UPDATE OK", { id: existing.id });
      if (oldAnswer !== (answer || "") || oldObs !== (observations || "")) {
        logAudit({ project_id: projectId, screen: "Escopo Técnico", field: `Pergunta ${questionId}`, old_value: oldAnswer, new_value: answer });
      }
      // Atualiza o ref IMEDIATAMENTE com os novos valores para evitar
      // que um reloadScopeItems subsequente traga dados stale e sobrescreva
      scopeItemsRef.current = scopeItemsRef.current.map(s =>
        s.id === existing.id ? { ...s, answer, observations } : s
      );
      // Registra timestamp do save para proteção contra overwrite por sync stale
      lastSavedAt.current[questionId] = Date.now();
    } else {
      // Anti-duplicate: check DB before creating, in case the item exists but wasn't in scopeItemsRef
      const dbExisting = await base44.entities.ScopeItem.filter({ project_id: projectId, order_number: orderNum });
      if (dbExisting.length > 0) {
        const match = dbExisting[0];
        const tsAlt = new Date().toISOString().substr(11, 12);
        console.log(`[ScopeTab] ⏱ ${tsAlt} handleSave — UPDATE (via DB lookup, item não estava no ref)`, { id: match.id, answer, observations });
        const oldAnswer2 = match.answer || "";
      const oldObs2 = match.observations || "";
      await base44.entities.ScopeItem.update(match.id, { answer, observations });
      if (oldAnswer2 !== (answer || "") || oldObs2 !== (observations || "")) {
        logAudit({ project_id: projectId, screen: "Escopo Técnico", field: `Pergunta ${questionId}`, old_value: oldAnswer2, new_value: answer });
      }
      scopeItemsRef.current = scopeItemsRef.current.map(s =>
          s.id === match.id ? { ...s, answer, observations } : s
        );
        lastSavedAt.current[questionId] = Date.now();
        pendingKeys.current.delete(questionId);
        if (onScopeSaved) onScopeSaved();
        return;
      }
      // Find question metadata from effective modules (overrides already applied)
      let foundQ = null;
      let foundSection = "";
      for (const mod of effectiveModules) {
        const qs = getModuleQuestions(mod);
        const q = qs.find(q => q.id === questionId);
        if (q) { foundQ = q; foundSection = mod.moduleLabel; break; }
      }
      console.log("[ScopeTab] handleSave — CREATE (sem ScopeItem existente)", {
        questionId,
        orderNum,
        foundInTemplate: !!foundQ,
        section: foundSection,
        questionPrompt: foundQ?.prompt || "não encontrado no template",
        field_type: foundQ?.type || "text",
      });
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
      logAudit({ project_id: projectId, screen: "Escopo Técnico", field: `Pergunta ${questionId} (criada)`, new_value: answer });
      console.log("[ScopeTab] handleSave — CREATE OK", { id: created?.id, question_id: created?.question_id, order_number: created?.order_number });
      // Add to ref so subsequent saves find the record
      if (created?.id) {
        scopeItemsRef.current = [
          ...scopeItemsRef.current,
          { ...created, order_number: orderNum }
        ];
        // Registra timestamp do save para proteção contra overwrite por sync stale
        lastSavedAt.current[questionId] = Date.now();
      }
    }
    // Clear pending flag — data is now persisted
    pendingKeys.current.delete(questionId);
    // Notifica o pai para recarregar scopeItems silenciosamente (sem spinner),
    // garantindo que TAP, Cronograma e Termo de Encerramento recebam o answersMap atualizado
    console.log(`[ScopeTab] ⏱ ${ts} handleSave — FIM → chamando onScopeSaved()`);
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
            Etapa {safeIndex + 1} de {totalModules} &nbsp;·&nbsp; {answeredCurrent}/{allCurrentQs.length} respondidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/09fa0a8a2_LogoPontotel_AmarelaePreta.png" alt="Pontotel" className="h-5 opacity-80" />
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
          {!readOnly && canUpdateTemplate && (
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
          <button
            onClick={() => downloadScopeTemplatePDF()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400 hover:bg-purple-100 transition-colors"
            title="Baixar modelo em branco com todas as perguntas possíveis"
          >
            <LayoutList className="w-3.5 h-3.5" />
            Modelo em branco
          </button>
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
        </div>
      </div>

      {/* Stepper visual de etapas */}
      <div className="mb-5">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {visibleModules.map((mod, idx) => {
            const total = getCountableQuestions(mod).length;
            const answered = getModuleAnsweredCount(mod);
            const complete = total > 0 && answered === total;
            const partial = answered > 0 && answered < total;
            const active = idx === safeIndex;
            const isLast = idx === visibleModules.length - 1;
            return (
              <div key={mod.moduleKey} className="flex items-center shrink-0">
                <button
                  onClick={() => setCurrentIndex(idx)}
                  className="flex items-center gap-2 group"
                >
                  {/* Círculo numerado / check */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                      active
                        ? "bg-blue-600 text-white ring-4 ring-blue-100 scale-110"
                        : complete
                        ? "bg-green-500 text-white group-hover:bg-green-600"
                        : partial
                        ? "bg-amber-100 text-amber-700 border-2 border-amber-300 group-hover:bg-amber-200"
                        : "bg-slate-100 text-slate-400 border-2 border-slate-200 group-hover:bg-slate-200"
                    }`}
                  >
                    {complete && !active ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {/* Label da etapa */}
                  <div className="hidden md:block text-left">
                    <p
                      className={`text-xs font-semibold leading-tight max-w-[140px] truncate ${
                        active ? "text-blue-700" : complete ? "text-green-700" : partial ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {mod.moduleLabel.replace(/^(MÓDULO:|PROCESSO:)\s*/i, "")}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {complete ? "Concluído" : partial ? `${answered}/${total}` : total > 0 ? `${total} perguntas` : "—"}
                    </p>
                  </div>
                </button>
                {/* Linha conectora entre etapas */}
                {!isLast && (
                  <div
                    className={`w-6 md:w-10 h-0.5 mx-1 rounded-full transition-colors ${
                      complete || idx < safeIndex ? "bg-green-400" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
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