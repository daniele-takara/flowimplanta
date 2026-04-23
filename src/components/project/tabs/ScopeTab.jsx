import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions, isModuleVisible } from "@/lib/scopeTemplate";
import { generateScopePDF } from "@/lib/scopePdfExport";
import ScopeItemRow from "@/components/project/tabs/ScopeItemRow";
import { ChevronDown, ChevronRight, Plus, Minus, FileDown } from "lucide-react";

const SANKHYA_KEY = "sankhya_manual_override";

export default function ScopeTab({ scopeItems, projectId, project, onRefresh }) {
  // manualOverrides: { sankhya_manual_override: true/false }
  const [manualOverrides, setManualOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`scope_overrides_${projectId}`) || "{}");
    } catch { return {}; }
  });

  // Local cache: { [questionId]: { answer, observations } }
  const [localAnswers, setLocalAnswers] = useState(() => {
    const map = {};
    (scopeItems || []).forEach(item => {
      if (item.order_number) map[`q${String(item.order_number).padStart(3, "0")}`] = { answer: item.answer || "", observations: item.observations || "" };
    });
    return map;
  });

  // Collapsed modules state
  const [collapsed, setCollapsed] = useState({});

  // Sync scopeItems into localAnswers when they change
  useEffect(() => {
    const map = {};
    (scopeItems || []).forEach(item => {
      if (item.order_number) {
        const key = `q${String(item.order_number).padStart(3, "0")}`;
        map[key] = { answer: item.answer || "", observations: item.observations || "" };
      }
    });
    setLocalAnswers(map);
  }, [scopeItems]);

  const saveOverrides = (overrides) => {
    localStorage.setItem(`scope_overrides_${projectId}`, JSON.stringify(overrides));
    setManualOverrides(overrides);
  };

  const toggleSankhya = () => {
    const current = manualOverrides[SANKHYA_KEY] === true;
    saveOverrides({ ...manualOverrides, [SANKHYA_KEY]: !current });
  };

  const contractedModules = project?.contracted_modules || [];
  const origin = project?.origin || "";

  // Determine visible modules
  const visibleModules = useMemo(() =>
    SCOPE_MODULES.filter(mod => isModuleVisible(mod, contractedModules, origin, manualOverrides)),
    [contractedModules, origin, manualOverrides]
  );

  // Check if Sankhya is auto-visible or manually enabled
  const sankhyaMod = SCOPE_MODULES.find(m => m.moduleKey === "integracao_folha_sankhya");
  const sankhyaAutoVisible = origin === sankhyaMod?.autoShowWhen?.value;
  const sankhyaManualEnabled = manualOverrides[SANKHYA_KEY] === true;

  const handleSave = async (questionId, { answer, observations }) => {
    // Update local cache immediately
    setLocalAnswers(prev => ({ ...prev, [questionId]: { answer, observations } }));

    const orderNum = parseInt(questionId.replace("q", ""), 10);
    // Find existing ScopeItem in DB
    const existing = scopeItems.find(s => s.order_number === orderNum);
    if (existing) {
      await base44.entities.ScopeItem.update(existing.id, { answer, observations });
    } else {
      // Find question details from template
      let foundQ = null;
      let foundSection = "";
      for (const mod of SCOPE_MODULES) {
        const qs = getModuleQuestions(mod);
        const q = qs.find(q => q.id === questionId);
        if (q) { foundQ = q; foundSection = mod.moduleLabel; break; }
      }
      await base44.entities.ScopeItem.create({
        project_id: projectId,
        order_number: orderNum,
        section: foundSection,
        question: foundQ?.prompt || "",
        best_practice: foundQ?.description || "",
        answer,
        observations,
        field_type: "text",
        is_required: false
      });
    }
    onRefresh();
  };

  // Check conditional visibility of a question based on current answers
  const isQuestionVisible = (question) => {
    const rule = question.rules?.find(r => r.type === "conditional_visibility");
    if (!rule) return true;
    const depAnswer = localAnswers[rule.dependsOn]?.answer || "";
    if (rule.condition.operator === "equals") return depAnswer === rule.condition.value;
    if (rule.condition.operator === "contains") return depAnswer.includes(rule.condition.value);
    return true;
  };

  const toggleModule = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Escopo Técnico</h2>
          <p className="text-sm text-slate-400">{visibleModules.length} módulo{visibleModules.length !== 1 ? "s" : ""} visível{visibleModules.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sankhya toggle (only show if not auto-visible) */}
          {!sankhyaAutoVisible && (
            <button
              onClick={toggleSankhya}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                sankhyaManualEnabled
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              }`}
            >
              {sankhyaManualEnabled ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {sankhyaManualEnabled ? "Remover Sankhya" : "Incluir Integração Sankhya"}
            </button>
          )}

          {/* PDF export button */}
          <button
            onClick={() => generateScopePDF(project, localAnswers, contractedModules, origin, manualOverrides)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Gerar PDF do Escopo
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {visibleModules.map(mod => {
          const allQuestions = getModuleQuestions(mod);
          const answered = allQuestions.filter(q => localAnswers[q.id]?.answer).length;
          const isCollapsed = collapsed[mod.moduleKey];

          return (
            <div key={mod.moduleKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod.moduleKey)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />
                  }
                  <span className="text-sm font-semibold text-slate-700">{mod.moduleLabel}</span>
                </div>
                <span className="text-xs text-slate-400">{answered}/{allQuestions.length} respondidas</span>
              </button>

              {/* Module content */}
              {!isCollapsed && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  {mod.subsections ? (
                    mod.subsections.map((sub, si) => {
                      const visibleQs = sub.questions.filter(isQuestionVisible);
                      if (visibleQs.length === 0) return null;
                      return (
                        <div key={si} className="mt-4">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 pb-1 border-b border-slate-100">{sub.label}</p>
                          {visibleQs.map(q => (
                            <ScopeItemRow
                              key={q.id}
                              question={q}
                              savedAnswer={localAnswers[q.id]?.answer || ""}
                              savedObs={localAnswers[q.id]?.observations || ""}
                              onSave={handleSave}
                            />
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    <div className="mt-4">
                      {mod.questions.filter(isQuestionVisible).map(q => (
                        <ScopeItemRow
                          key={q.id}
                          question={q}
                          savedAnswer={localAnswers[q.id]?.answer || ""}
                          savedObs={localAnswers[q.id]?.observations || ""}
                          onSave={handleSave}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visibleModules.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Nenhum módulo visível para este projeto.</p>
            <p className="text-xs mt-1">Verifique os módulos contratados nas informações do projeto.</p>
          </div>
        )}
      </div>
    </div>
  );
}