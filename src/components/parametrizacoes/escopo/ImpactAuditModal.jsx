import { AlertTriangle, CheckCircle2, Info, X, ShieldAlert, Save } from "lucide-react";

const LEVEL_CONFIG = {
  critical: { icon: AlertTriangle, color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", label: "Crítico" },
  warning:  { icon: AlertTriangle, color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", label: "Atenção" },
  info:     { icon: Info, color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500", label: "Info" },
};

export default function ImpactAuditModal({ auditResult, questionId, onConfirmSave, onCancel, saving, changeReason, onChangeReason }) {
  const { issues, maxLevel, canSaveDirectly } = auditResult;

  const headerConfig = {
    critical: { bg: "bg-red-600", icon: ShieldAlert, title: "Alteração Crítica — Revisão Obrigatória" },
    warning:  { bg: "bg-amber-500", icon: AlertTriangle, title: "Atenção — Verifique os impactos antes de salvar" },
    safe:     { bg: "bg-green-600", icon: CheckCircle2, title: "Alteração Segura — Pronto para salvar" },
  }[maxLevel] || {};

  const HeaderIcon = headerConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 ${headerConfig.bg}`}>
          <HeaderIcon className="w-5 h-5 text-white shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">{headerConfig.title}</h2>
            <p className="text-xs text-white/80 mt-0.5">Pergunta {questionId?.toUpperCase()} — Relatório de Impacto</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/20">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {issues.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">Nenhum impacto crítico detectado</p>
                <p className="text-xs text-green-600 mt-0.5">A alteração é segura. Pode ser salva sem risco para o sistema.</p>
              </div>
            </div>
          )}

          {issues.map((issue, i) => {
            const cfg = LEVEL_CONFIG[issue.level] || LEVEL_CONFIG.info;
            const IssueIcon = cfg.icon;
            return (
              <div key={i} className={`p-3.5 rounded-xl border ${cfg.color}`}>
                <div className="flex items-start gap-2 mb-1.5">
                  <IssueIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-xs font-bold uppercase tracking-wide mr-2">{cfg.label}</span>
                    <span className="text-xs leading-relaxed">{issue.msg}</span>
                  </div>
                </div>
                {issue.affected?.length > 0 && (
                  <div className="ml-5 mt-1.5 space-y-0.5">
                    {issue.affected.map((a, j) => (
                      <p key={j} className="text-xs opacity-80">↳ {a}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Campo de justificativa */}
          <div className="mt-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Justificativa da alteração {maxLevel === "critical" ? <span className="text-red-500">*</span> : "(opcional)"}
            </label>
            <textarea
              value={changeReason}
              onChange={e => onChangeReason(e.target.value)}
              rows={2}
              placeholder="Descreva o motivo desta alteração..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {maxLevel === "critical" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <strong>⚠ Esta alteração tem impacto crítico.</strong> Revise todos os pontos acima.
              O save está liberado somente após preenchimento da justificativa. As alterações
              valerão apenas para <strong>novos projetos</strong>. Projetos existentes não serão afetados.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={onConfirmSave}
            disabled={saving || (maxLevel === "critical" && !changeReason.trim())}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors ${
              maxLevel === "critical" ? "bg-red-600 hover:bg-red-700" :
              maxLevel === "warning"  ? "bg-amber-600 hover:bg-amber-700" :
              "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : maxLevel === "critical" ? "Confirmar e salvar mesmo assim" : "Confirmar e salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}