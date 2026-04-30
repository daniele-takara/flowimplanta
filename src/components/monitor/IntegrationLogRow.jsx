import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, CheckCircle2, AlertCircle, Clock, Minus, RotateCcw } from "lucide-react";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status }) {
  const map = {
    success: "bg-green-100 text-green-700",
    partial_success: "bg-yellow-100 text-yellow-700",
    ignored: "bg-slate-100 text-slate-500",
    error: "bg-red-100 text-red-700",
  };
  const labels = { success: "Sucesso", partial_success: "Parcial", ignored: "Ignorado", error: "Erro" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || "bg-slate-100 text-slate-500"}`}>{labels[status] || status}</span>;
}

function SourceBadge({ source }) {
  const map = { webhook: "bg-blue-100 text-blue-700", manual_sync: "bg-purple-100 text-purple-700", diagnostic_test: "bg-orange-100 text-orange-700" };
  const labels = { webhook: "Webhook", manual_sync: "Sync Manual", diagnostic_test: "Teste" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[source] || "bg-slate-100 text-slate-500"}`}>{labels[source] || source}</span>;
}

function JsonBlock({ label, value }) {
  const [copied, setCopied] = useState(false);
  let formatted = value;
  try { formatted = JSON.stringify(JSON.parse(value), null, 2); } catch {}
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <button onClick={() => { navigator.clipboard.writeText(value || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1">
          {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} copiar
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">{formatted || "—"}</pre>
    </div>
  );
}

export default function IntegrationLogRow({ log, onReprocess }) {
  const [expanded, setExpanded] = useState(false);

  let matchErrors = [];
  let errors = [];
  let debugSteps = [];
  try { matchErrors = JSON.parse(log.match_errors || "[]"); } catch {}
  try { errors = JSON.parse(log.errors || "[]"); } catch {}
  try { debugSteps = JSON.parse(log.debug_steps || "[]"); } catch {}

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div
        className="grid gap-2 px-4 py-3 hover:bg-slate-50 cursor-pointer items-center text-xs"
        style={{ gridTemplateColumns: "140px 80px 120px 80px 80px 1fr 90px 60px 60px 60px 28px" }}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-slate-400 whitespace-nowrap">{fmtDate(log.created_date)}</div>
        <div><SourceBadge source={log.source} /></div>
        <div className="font-mono text-slate-600">{log.event_type || "—"}</div>
        <div className="font-mono text-blue-600">{log.deal_id ? `#${log.deal_id}` : "—"}</div>
        <div className="font-mono text-slate-500">{log.activity_id ? `#${log.activity_id}` : "—"}</div>
        <div className="text-slate-600 truncate" title={log.project_name}>{log.project_name || log.project_id?.substring(0, 8) || "—"}</div>
        <div><StatusBadge status={log.status} /></div>
        <div className="text-center text-slate-500">{log.rules_loaded ?? "—"}</div>
        <div className="text-center text-slate-500">{log.rules_matched ?? "—"}</div>
        <div className="text-center text-slate-500">{log.activities_updated ?? "—"}</div>
        <div className="flex justify-end">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-5 space-y-4 bg-slate-50 border-t border-slate-100">
          {/* Resumo */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 pt-3">
            {[
              ["Regras carregadas", log.rules_loaded],
              ["Regras com match", log.rules_matched],
              ["Fases encontradas", log.phases_found],
              ["Atividades", log.activities_found],
              ["Criadas", log.activities_created],
              ["Atualizadas", log.activities_updated],
              ["Datas preenchidas", log.dates_filled],
              ["Datas ignoradas", log.dates_ignored],
            ].map(([label, val]) => (
              <div key={label} className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                <p className="text-base font-bold text-slate-700">{val ?? "—"}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Duração */}
          {log.duration_ms && (
            <p className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Processado em {log.duration_ms}ms</p>
          )}

          {/* Erros */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Erros</p>
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600 font-mono">{e}</p>)}
            </div>
          )}

          {/* Match errors */}
          {matchErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-bold text-amber-700 mb-1">Inconsistências de match</p>
              {matchErrors.map((e, i) => <p key={i} className="text-xs text-amber-600 font-mono">{e}</p>)}
            </div>
          )}

          {/* Debug steps de regras */}
          {debugSteps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2">Debug de regras ({debugSteps.filter(s => s.rule_id).length} regras avaliadas)</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {debugSteps.filter(s => s.rule_id).map((step, i) => (
                  <div key={i} className={`p-2 rounded text-xs border ${step.match ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${step.match ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                        {step.match ? "✓" : "✗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-slate-700 truncate">
                          [{step.order}] {step.entidade} / {step.campo_key}={step.valor_disparo} → {step.base44_fase} / {step.base44_atividade || "*"}
                        </p>
                        {step.comparacao && <p className="text-slate-400 mt-0.5 font-mono">{step.comparacao}</p>}
                        {step.skip_reason && <p className="text-orange-600 mt-0.5">{step.skip_reason}</p>}
                        {step.actions?.map((a, j) => <p key={j} className="text-green-700 font-mono mt-0.5">{a}</p>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payloads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <JsonBlock label="Request payload" value={log.request_payload} />
            <JsonBlock label="Response (atualizado/criado)" value={log.response_payload} />
          </div>

          {/* Reprocessar */}
          {log.status === "error" && onReprocess && (
            <div className="flex justify-end">
              <button onClick={() => onReprocess(log)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reprocessar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}