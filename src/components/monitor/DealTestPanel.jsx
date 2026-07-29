import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Zap } from "lucide-react";

export default function DealTestPanel() {
  const [projectId, setProjectId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("applyPipedriveRules", {
        project_id: projectId.trim(),
        source: "diagnostic_test",
        event_type: "manual_test",
        dry_run: dryRun,
      });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message, data: e.response?.data });
    }
    setLoading(false);
  };

  const data = result?.data;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Simula a aplicação das regras para um projeto específico buscando o deal real no Pipedrive.
        Com "Dry Run" ativado, nenhuma alteração é gravada.
      </p>

      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          placeholder="ID do projeto Base44"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 font-mono min-w-40"
          onKeyDown={e => e.key === "Enter" && handleTest()}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
          Dry Run (simular)
        </label>
        <button
          onClick={handleTest}
          disabled={loading || !projectId.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {dryRun ? "Simular" : "Executar"}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-xs space-y-3 ${data?.ok || data?.rules_loaded ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          {!data?.ok && data?.errors?.length > 0 && (
            <div className="p-2 bg-red-100 rounded text-red-700">
              <strong>Erros:</strong> {(typeof data.errors === "string" ? JSON.parse(data.errors) : data.errors)?.join(", ")}
            </div>
          )}

          {data && (
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Deal ID", `#${data.deal_id}`],
                ["Regras carregadas", data.rules_loaded],
                ["Regras com match", data.rules_matched],
                ["Fases encontradas", data.phases_found],
                ["Atividades", data.activities_found],
                ["Atualizadas", data.activities_updated],
                ["Criadas", data.activities_created],
                ["Datas preenchidas", data.dates_filled],
              ].map(([l, v]) => (
                <div key={l} className="bg-white rounded-lg p-2 text-center border border-slate-200">
                  <p className="font-bold text-slate-700">{v ?? "—"}</p>
                  <p className="text-slate-400 mt-0.5 text-xs leading-tight">{l}</p>
                </div>
              ))}
            </div>
          )}

          {data?.match_errors?.length > 0 && (
            <div className="p-2 bg-amber-100 rounded text-amber-700">
              <strong>Inconsistências:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {data.match_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {data?.rule_debug?.length > 0 && (
            <div>
              <p className="font-bold text-slate-700 mb-2">Debug de regras ({data.rule_debug.length}):</p>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {data.rule_debug.map((r, i) => (
                  <div key={i} className={`p-2 rounded border text-xs ${r.match ? "bg-green-100 border-green-300" : "bg-white border-slate-200"}`}>
                    <div className="flex items-start gap-1.5">
                      <span className={`text-xs font-bold ${r.match ? "text-green-600" : "text-slate-400"}`}>{r.match ? "✓" : "✗"}</span>
                      <div>
                        <p className="font-mono text-slate-700">
                          [{r.order}] {r.entidade} {r.campo_key}={r.valor_disparo} → "{r.base44_fase}" / "{r.base44_atividade || "*"}"
                        </p>
                        {r.comparacao && <p className="text-slate-400 font-mono">{r.comparacao}</p>}
                        {r.skip_reason && <p className="text-orange-600">{r.skip_reason}</p>}
                        {r.actions?.map((a, j) => <p key={j} className="text-green-700 font-mono">{a}</p>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dryRun && data?.ok && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-center font-medium">
              Simulação concluída — nenhuma alteração foi gravada. Desmarque "Dry Run" para executar de verdade.
            </div>
          )}
        </div>
      )}
    </div>
  );
}