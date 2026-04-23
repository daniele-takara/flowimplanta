import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Save, AlertCircle } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function AnswerField({ question, answer, onChange }) {
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
      placeholder={placeholder || "Descreva a resposta..."}
      className={`${inputClass} resize-none`}
      rows={3}
    />
  );
}

export default function ScopeItemRow({ question, savedAnswer, savedObs, onSave }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [obs, setObs] = useState(savedObs || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleAnswerChange = (val) => {
    setAnswer(val);
    setDirty(true);
  };

  const handleObsChange = (val) => {
    setObs(val);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(question.id, { answer, observations: obs });
    setSaving(false);
    setDirty(false);
  };

  // Check if observation is required by rule
  const needsObsWarning = question.rules?.some(r =>
    r.type === "require_observations_when_option_selected" && answer === r.option && !obs
  );

  // Rule hint messages
  const ruleHints = question.rules?.filter(r => r.type === "additional_context_in_observations") || [];

  const hasAnswer = !!answer;

  return (
    <div className={`border rounded-lg mb-2 overflow-hidden transition-colors ${open ? "border-blue-200 bg-white" : "border-slate-100 bg-white hover:border-slate-200"}`}>
      {/* Header row */}
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
        <div className="shrink-0 flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-500 font-medium">Não salvo</span>}
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
          {/* Description/boa prática */}
          {question.description && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mt-3 mb-4">
              <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 whitespace-pre-line leading-relaxed">{question.description}</p>
            </div>
          )}

          {/* Rule hints */}
          {ruleHints.map((r, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">{r.message}</p>
            </div>
          ))}

          {/* Answer field */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resposta</label>
            <AnswerField question={question} answer={answer} onChange={handleAnswerChange} />
          </div>

          {/* Observations — always visible */}
          <div className="mb-4">
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${needsObsWarning ? "text-orange-500" : "text-slate-500"}`}>
              Observações {needsObsWarning && <span className="text-orange-500">*obrigatório</span>}
            </label>
            <textarea
              value={obs}
              onChange={e => handleObsChange(e.target.value)}
              placeholder="Observações adicionais..."
              className={`${inputClass} resize-none ${needsObsWarning && !obs ? "border-orange-300 focus:ring-orange-500" : ""}`}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}