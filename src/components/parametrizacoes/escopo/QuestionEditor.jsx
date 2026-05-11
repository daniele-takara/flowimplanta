import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Pencil, X, Plus, Trash2, ChevronDown, ChevronRight,
  Calendar, FileText, AlertTriangle, CheckCircle2, Link,
  FlaskConical, History
} from "lucide-react";
import {
  TYPE_LABELS, TYPE_COLORS, TYPE_OPTIONS,
  TAP_IMPACT, INTEGRATION_IMPACT, RISK_CONFIG, getRiskLevel,
  runImpactAudit, getAllQuestions
} from "@/components/parametrizacoes/escopo/scopeImpactHelpers.js";
import ImpactAuditModal from "@/components/parametrizacoes/escopo/ImpactAuditModal.jsx";

const inputClass = "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

function ImpactBadge({ label, color, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

// ── Editor inline de opções ───────────────────────────────────────────────────
function OptionsEditor({ options, onChange }) {
  const [newOpt, setNewOpt] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs">
            <span>{opt}</span>
            <button onClick={() => onChange(options.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={newOpt}
          onChange={e => setNewOpt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newOpt.trim()) { onChange([...options, newOpt.trim()]); setNewOpt(""); e.preventDefault(); }}}
          placeholder="Nova opção (Enter para adicionar)"
          className={inputClass}
        />
        <button
          onClick={() => { if (newOpt.trim()) { onChange([...options, newOpt.trim()]); setNewOpt(""); }}}
          className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Editor de regra condicional ───────────────────────────────────────────────
function ConditionalRuleEditor({ rule, onChange, onRemove, allQuestions }) {
  return (
    <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-700">Visível quando:</span>
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="text-xs text-slate-500 mb-0.5 block">Pergunta pai</label>
          <select
            value={rule.dependsOn || ""}
            onChange={e => onChange({ ...rule, dependsOn: e.target.value })}
            className={inputClass}
          >
            <option value="">— selecionar —</option>
            {allQuestions.map(q => <option key={q.id} value={q.id}>{q.id.toUpperCase()}: {q.prompt.substring(0, 40)}...</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-0.5 block">Operador</label>
          <select
            value={rule.condition?.operator || "equals"}
            onChange={e => onChange({ ...rule, condition: { ...rule.condition, operator: e.target.value } })}
            className={inputClass}
          >
            <option value="equals">igual a</option>
            <option value="contains">contém</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-0.5 block">Valor</label>
          <input
            value={rule.condition?.value || ""}
            onChange={e => onChange({ ...rule, condition: { ...rule.condition, value: e.target.value } })}
            className={inputClass}
            placeholder="Ex: Sim"
          />
        </div>
      </div>
    </div>
  );
}

// ── Componente principal: linha de pergunta editável ─────────────────────────
export default function QuestionEditor({ q, override, impactMap, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Merge: override do banco tem prioridade sobre scopeTemplate.js
  const effectiveQ = override
    ? {
        ...q,
        prompt: override.prompt ?? q.prompt,
        description: override.description ?? q.description,
        type: override.type ?? q.type,
        options: override.options ? JSON.parse(override.options) : q.options,
        placeholder: override.placeholder ?? q.placeholder,
        is_required: override.is_required ?? false,
        rules: override.rules ? JSON.parse(override.rules) : q.rules,
        active: override.active !== undefined ? override.active : true,
      }
    : { ...q, active: true, is_required: false };

  const impactTasks = impactMap[q.id]?.tasks || [];
  const impactPhases = impactMap[q.id]?.phases || [];
  const tapImpacts = TAP_IMPACT[q.id] || [];
  const integImpacts = INTEGRATION_IMPACT[q.id] || [];
  const riskLevel = getRiskLevel(q.id, impactMap);
  const riskConfig = RISK_CONFIG[riskLevel];
  const totalImpact = impactTasks.length + tapImpacts.length + integImpacts.length;
  const allQuestions = getAllQuestions();

  const condVisRule = (effectiveQ.rules || []).find(r => r.type === "conditional_visibility");
  const parentQ = condVisRule ? allQuestions.find(aq => aq.id === condVisRule.dependsOn) : null;

  const startEditing = () => {
    setForm({
      prompt: effectiveQ.prompt,
      description: effectiveQ.description || "",
      type: effectiveQ.type,
      options: [...(effectiveQ.options || [])],
      placeholder: effectiveQ.placeholder || "",
      is_required: effectiveQ.is_required || false,
      active: effectiveQ.active !== false,
      rules: JSON.parse(JSON.stringify(effectiveQ.rules || [])),
    });
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => { setEditing(false); setForm(null); setAuditResult(null); setChangeReason(""); };

  const handleTestAndSave = () => {
    const audit = runImpactAudit(effectiveQ, form, impactMap, allQuestions);
    setAuditResult(audit);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    const user = await base44.auth.me();
    const previousSnapshot = JSON.stringify({
      prompt: effectiveQ.prompt,
      type: effectiveQ.type,
      options: effectiveQ.options,
      rules: effectiveQ.rules,
      active: effectiveQ.active,
    });

    const payload = {
      question_id: q.id,
      version: (override?.version || 0) + 1,
      prompt: form.prompt,
      description: form.description,
      type: form.type,
      options: JSON.stringify(form.options),
      placeholder: form.placeholder,
      is_required: form.is_required,
      rules: JSON.stringify(form.rules),
      active: form.active,
      changed_by: user?.email || "unknown",
      change_reason: changeReason,
      previous_snapshot: previousSnapshot,
      impact_audit: JSON.stringify(auditResult),
    };

    if (override?.id) {
      await base44.entities.ScopeTemplateOverride.update(override.id, payload);
    } else {
      await base44.entities.ScopeTemplateOverride.create(payload);
    }

    setSaving(false);
    setAuditResult(null);
    setEditing(false);
    setForm(null);
    setChangeReason("");
    if (onSaved) onSaved();
  };

  const condRuleIndex = (form?.rules || []).findIndex(r => r.type === "conditional_visibility");

  return (
    <>
      <div className={`border rounded-xl overflow-hidden mb-2 ${!effectiveQ.active ? "opacity-60" : ""} ${expanded ? "border-blue-300 shadow-sm" : editing ? "border-amber-300 shadow-sm" : "border-slate-200"}`}>

        {/* Header */}
        <div
          className={`flex items-start gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${expanded ? (editing ? "bg-amber-50" : "bg-blue-50") : "bg-white hover:bg-slate-50"}`}
          onClick={() => { if (!editing) setExpanded(v => !v); }}
        >
          <div className="w-12 shrink-0 pt-0.5">
            <span className="text-xs font-bold text-slate-400 font-mono">{q.id.toUpperCase()}</span>
            {override && <span className="block text-xs text-amber-600 font-semibold">v{override.version}</span>}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 leading-snug">
              {effectiveQ.prompt}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[effectiveQ.type] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                {TYPE_LABELS[effectiveQ.type] || effectiveQ.type}
              </span>
              {!effectiveQ.active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 border border-slate-300">Desativada</span>}
              {override && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Personalizada</span>}
              {condVisRule && <ImpactBadge label="Condicional" color="text-orange-700 bg-orange-50 border-orange-200" icon={Link} />}
              {impactTasks.length > 0 && <ImpactBadge label={`${impactTasks.length} ativ. cronograma`} color="text-blue-700 bg-blue-50 border-blue-200" icon={Calendar} />}
              {tapImpacts.length > 0 && <ImpactBadge label="TAP" color="text-purple-700 bg-purple-50 border-purple-200" icon={FileText} />}
              {integImpacts.length > 0 && <ImpactBadge label="Integração" color="text-amber-700 bg-amber-50 border-amber-200" icon={AlertTriangle} />}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${riskConfig.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${riskConfig.dot}`} />
              {riskConfig.label}
            </span>
            {!editing && (
              <button
                onClick={e => { e.stopPropagation(); startEditing(); }}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-400 transition-colors"
                title="Editar pergunta"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {expanded && !editing ? <ChevronDown className="w-4 h-4 text-slate-400" /> : !editing ? <ChevronRight className="w-4 h-4 text-slate-400" /> : null}
          </div>
        </div>

        {/* Detalhe expandido — modo VIEW */}
        {expanded && !editing && (
          <div className="bg-white border-t border-slate-100 px-4 py-4 space-y-4">
            {effectiveQ.description && (
              <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                {effectiveQ.description}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Configuração</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo</span>
                    <span className={`px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[effectiveQ.type]}`}>{TYPE_LABELS[effectiveQ.type]}</span>
                  </div>
                  {effectiveQ.options?.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0">Opções</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {effectiveQ.options.map(o => <span key={o} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{o}</span>)}
                      </div>
                    </div>
                  )}
                  {effectiveQ.placeholder && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Placeholder</span>
                      <span className="text-slate-400 italic">{effectiveQ.placeholder}</span>
                    </div>
                  )}
                </div>
                {condVisRule && (
                  <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-600">
                    <strong>Visível quando:</strong> {condVisRule.dependsOn?.toUpperCase()} {condVisRule.condition?.operator === "equals" ? "=" : "contém"} "{condVisRule.condition?.value}"
                    {parentQ && <div className="mt-0.5 italic text-orange-400">Pai: "{parentQ.prompt.substring(0, 50)}..."</div>}
                  </div>
                )}
                {override && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <History className="w-3 h-3 inline mr-1" />
                    Versão {override.version} · por {override.changed_by} · {override.change_reason || "sem justificativa"}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Impactos no sistema</h4>
                {totalImpact === 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Sem dependências críticas
                  </div>
                )}
                {impactTasks.length > 0 && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                    <p className="font-semibold text-blue-700 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {impactTasks.length} atividade(s) no cronograma</p>
                    {impactPhases.map(ph => <div key={ph} className="text-blue-600 font-medium">{ph}</div>)}
                    <div className="mt-1 space-y-0.5">{impactTasks.map(t => <div key={t.id} className="text-blue-500">↳ {t.activity}</div>)}</div>
                  </div>
                )}
                {tapImpacts.length > 0 && (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                    <p className="font-semibold text-purple-700 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Impacto na TAP</p>
                    {tapImpacts.map((t, i) => <div key={i} className="text-purple-600">↳ {t}</div>)}
                  </div>
                )}
                {integImpacts.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                    <p className="font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Integrações</p>
                    {integImpacts.map((t, i) => <div key={i} className="text-amber-600">↳ {t}</div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modo EDIÇÃO */}
        {editing && form && (
          <div className="bg-amber-50/30 border-t border-amber-200 px-4 py-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Pencil className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-700">Modo edição — alterações valem para novos projetos</span>
            </div>

            {/* Texto */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pergunta</label>
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição / Orientação</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Texto de apoio para o analista..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de resposta</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className={inputClass}
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Placeholder</label>
                <input
                  value={form.placeholder}
                  onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))}
                  className={inputClass}
                  placeholder="Ex: [texto livre]"
                />
              </div>
            </div>

            {/* Opções */}
            {["single_select", "multi_select"].includes(form.type) && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Opções de resposta</label>
                <OptionsEditor options={form.options} onChange={opts => setForm(f => ({ ...f, options: opts }))} />
              </div>
            )}

            {/* Obrigatória */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-slate-600">Resposta obrigatória</span>
            </label>

            {/* Ativa */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-slate-600">Pergunta ativa (visível em novos projetos)</span>
            </label>

            {/* Regra condicional */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Regra de visibilidade condicional</label>
              {condRuleIndex >= 0 ? (
                <ConditionalRuleEditor
                  rule={form.rules[condRuleIndex]}
                  allQuestions={allQuestions.filter(aq => aq.id !== q.id)}
                  onChange={r => setForm(f => { const rules = [...f.rules]; rules[condRuleIndex] = { ...rules[condRuleIndex], ...r }; return { ...f, rules }; })}
                  onRemove={() => setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== condRuleIndex) }))}
                />
              ) : (
                <button
                  onClick={() => setForm(f => ({ ...f, rules: [...f.rules, { type: "conditional_visibility", dependsOn: "", condition: { operator: "equals", value: "" } }] }))}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Adicionar condição de visibilidade
                </button>
              )}
            </div>

            {/* Botões */}
            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                onClick={handleTestAndSave}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Testar e Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de auditoria */}
      {auditResult && (
        <ImpactAuditModal
          auditResult={auditResult}
          questionId={q.id}
          changeReason={changeReason}
          onChangeReason={setChangeReason}
          onConfirmSave={handleConfirmSave}
          onCancel={() => { setAuditResult(null); setChangeReason(""); }}
          saving={saving}
        />
      )}
    </>
  );
}