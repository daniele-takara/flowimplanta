import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, HelpCircle, AlertCircle, Check, Loader2, Info } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const DEBOUNCE_MS = 800;

function SaveStatus({ status }) {
  if (!status) return null;
  if (status === "saving") return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  );
  if (status === "saved") return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Check className="w-3 h-3" /> Salvo
    </span>
  );
  if (status === "error") return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="w-3 h-3" /> Erro ao salvar
    </span>
  );
  return null;
}

function AnswerField({ question, answer, onChange, onBlur }) {
  const { type, options, placeholder } = question;

  if (type === "single_select") {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(answer === opt ? "" : opt)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              answer === opt
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (type === "multi_select") {
    const selected = answer ? answer.split(", ").filter(Boolean) : [];
    const toggle = (opt) => {
      const next = selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt];
      onChange(next.join(", "));
    };
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (type === "number") {
    return (
      <input
        type="number"
        value={answer}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder || ""}
        className={inputClass}
      />
    );
  }

  if (type === "short_text") {
    return (
      <input
        type="text"
        value={answer}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder || ""}
        className={inputClass}
      />
    );
  }

  if (type === "date_range_text") {
    return (
      <input
        type="text"
        value={answer}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder || "dd/mm/aaaa a dd/mm/aaaa"}
        className={inputClass}
      />
    );
  }

  // long_text (default)
  return (
    <textarea
      value={answer}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder || "Descreva a resposta..."}
      className={`${inputClass} resize-none`}
      rows={3}
    />
  );
}

// Bloco informativo — sem resposta, sem progresso
function InformativoBlock({ question }) {
  return (
    <div className="border border-amber-200 rounded-lg mb-2 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-amber-700 mb-1">{question.prompt}</p>
        {question.description && (
          <p className="text-xs text-amber-700 whitespace-pre-line leading-relaxed">{question.description}</p>
        )}
      </div>
    </div>
  );
}

export default function ScopeItemRow({ question, savedAnswer, savedObs, onSave }) {
  const isInfo = question.type === "informativo";
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [obs, setObs] = useState(savedObs || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);
  const savedAnswerRef = useRef(savedAnswer);
  const savedObsRef = useRef(savedObs);

  // Sync when parent updates saved values
  const syncCallCount = useRef(0);
  useEffect(() => {
    syncCallCount.current += 1;
    const callN = syncCallCount.current;
    const prevAnswer = savedAnswerRef.current;
    const prevObs = savedObsRef.current;
    const ts = new Date().toISOString().substr(11, 12);
    const overwriting = (!!savedAnswer && savedAnswer !== answer) || (!!savedObs && savedObs !== obs);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} useEffect SYNC #${callN} — parent props mudaram`, {
      question_id: question.id,
      savedAnswer_prev: prevAnswer,
      savedAnswer_new: savedAnswer,
      savedObs_prev: prevObs,
      savedObs_new: savedObs,
      localAnswer_antes: answer,
      localObs_antes: obs,
      OVERWRITING: overwriting ? "⚠️ SOBRESCREVENDO VALOR LOCAL" : "✓ sem conflito",
    });
    setAnswer(savedAnswer || "");
    setObs(savedObs || "");
    savedAnswerRef.current = savedAnswer;
    savedObsRef.current = savedObs;
  }, [savedAnswer, savedObs]);

  const triggerSaveCallCount = useRef(0);
  const triggerSave = useCallback(async (a, o) => {
    triggerSaveCallCount.current += 1;
    const callN = triggerSaveCallCount.current;
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} triggerSave #${callN} — DISPARO`, {
      question_id: question.id,
      type: question.type,
      answer: a,
      observations: o,
      hasAnswer: !!a,
      hasObs: !!o,
      savedAnswerRef: savedAnswerRef.current,
      savedObsRef: savedObsRef.current,
    });
    setSaveStatus("saving");
    try {
      await onSave(question.id, { answer: a, observations: o });
      console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} triggerSave #${callN} — SUCESSO`);
      setSaveStatus("saved");
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error(`[ScopeItemRow ${question.id}] ⏱ ${ts} triggerSave #${callN} — ERRO`, {
        question_id: question.id,
        error: err?.message,
        response: err?.response?.data,
      });
      setSaveStatus("error");
      setTimeout(() => triggerSave(a, o), 2000);
    }
  }, [onSave, question.id]);

  const scheduleDebounce = useCallback((a, o) => {
    clearTimeout(debounceRef.current);
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} scheduleDebounce — agendado em ${DEBOUNCE_MS}ms | answer="${a}" obs="${o}"`);
    debounceRef.current = setTimeout(() => {
      const ts2 = new Date().toISOString().substr(11, 12);
      console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts2} scheduleDebounce — DISPAROU após ${DEBOUNCE_MS}ms`);
      triggerSave(a, o);
    }, DEBOUNCE_MS);
  }, [triggerSave, question.id]);

  const handleAnswerChange = (val) => {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} handleAnswerChange → val="${val}" | localAnswer_atual="${answer}"`);
    setAnswer(val);
    scheduleDebounce(val, obs);
  };

  const handleObsChange = (val) => {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} handleObsChange → val="${val}" | localObs_atual="${obs}"`);
    setObs(val);
    scheduleDebounce(answer, val);
  };

  const handleBlur = () => {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} handleBlur — limpando debounce, save imediato | answer="${answer}" obs="${obs}"`);
    clearTimeout(debounceRef.current);
    triggerSave(answer, obs);
  };

  // For select types, save immediately on change (no blur)
  const handleSelectChange = (val) => {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} handleSelectChange — save imediato | val="${val}" obs="${obs}"`);
    setAnswer(val);
    clearTimeout(debounceRef.current);
    triggerSave(val, obs);
  };

  const handleMultiSelectChange = (val) => {
    const ts = new Date().toISOString().substr(11, 12);
    console.log(`[ScopeItemRow ${question.id}] ⏱ ${ts} handleMultiSelectChange — save imediato | val="${val}" obs="${obs}"`);
    setAnswer(val);
    clearTimeout(debounceRef.current);
    triggerSave(val, obs);
  };

  if (isInfo) return <InformativoBlock question={question} />;

  const needsObsWarning = question.rules?.some(r =>
    r.type === "require_observations_when_option_selected" && answer === r.option && !obs
  );
  const ruleHints = question.rules?.filter(r => r.type === "additional_context_in_observations") || [];
  const hasAnswer = !!answer;

  // Wrap AnswerField to inject correct handlers by type
  const renderAnswerField = () => {
    const { type, options, placeholder } = question;

    if (type === "single_select") {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelectChange(answer === opt ? "" : opt)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                answer === opt
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (type === "multi_select") {
      const selected = answer ? answer.split(", ").filter(Boolean) : [];
      const toggle = (opt) => {
        const next = selected.includes(opt)
          ? selected.filter(s => s !== opt)
          : [...selected, opt];
        handleMultiSelectChange(next.join(", "));
      };
      return (
        <div className="flex flex-wrap gap-2">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selected.includes(opt)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (type === "number") {
      return (
        <input
          type="number"
          value={answer}
          onChange={e => handleAnswerChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || ""}
          className={inputClass}
        />
      );
    }

    if (type === "short_text") {
      return (
        <input
          type="text"
          value={answer}
          onChange={e => handleAnswerChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || ""}
          className={inputClass}
        />
      );
    }

    if (type === "date_range_text") {
      return (
        <input
          type="text"
          value={answer}
          onChange={e => handleAnswerChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || "dd/mm/aaaa a dd/mm/aaaa"}
          className={inputClass}
        />
      );
    }

    return (
      <textarea
        value={answer}
        onChange={e => handleAnswerChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder || "Descreva a resposta..."}
        className={`${inputClass} resize-none`}
        rows={3}
      />
    );
  };

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden transition-colors ${open ? "border-blue-200 bg-white" : "border-slate-100 bg-white hover:border-slate-200"}`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-1 mt-0.5 shrink-0">
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />
          }
          <span className="text-xs text-slate-300 font-mono w-4 text-right">{question.order}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 leading-snug">{question.prompt}</p>
          {hasAnswer && !open && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">→ {answer}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <SaveStatus status={saveStatus} />
          {needsObsWarning && (
            <AlertCircle className="w-4 h-4 text-orange-500" title="Observações obrigatórias" />
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasAnswer ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
            {hasAnswer ? "Respondido" : "Pendente"}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
          {question.description && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mt-3 mb-4">
              <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 whitespace-pre-line leading-relaxed">{question.description}</p>
            </div>
          )}

          {ruleHints.map((r, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">{r.message}</p>
            </div>
          ))}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Resposta</label>
              <SaveStatus status={saveStatus} />
            </div>
            {renderAnswerField()}
          </div>

          <div className="mb-2">
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${needsObsWarning ? "text-orange-500" : "text-slate-500"}`}>
              Observações {needsObsWarning && <span className="text-orange-500">*obrigatório</span>}
            </label>
            <textarea
              value={obs}
              onChange={e => handleObsChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="Observações adicionais..."
              className={`${inputClass} resize-none ${needsObsWarning && !obs ? "border-orange-300 focus:ring-orange-500" : ""}`}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}