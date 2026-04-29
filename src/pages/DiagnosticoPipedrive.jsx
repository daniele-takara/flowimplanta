import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";

function StatusChip({ code }) {
  const color = code === 200 ? "bg-green-100 text-green-700 border-green-200"
    : code === 429 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : code === 401 || code === 403 ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${color}`}>
      {code}
    </span>
  );
}

function ResultCard({ label, result }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;
  const ok = result.status_code === 200 && result.success;
  const is429 = result.status_code === 429;

  return (
    <div className={`rounded-xl border p-4 ${ok ? "border-green-200 bg-green-50" : is429 ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {ok ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : is429 ? <Clock className="w-4 h-4 text-yellow-600" />
            : <XCircle className="w-4 h-4 text-red-500" />}
          <span className="font-semibold text-sm text-slate-800">{label}</span>
          <StatusChip code={result.status_code} />
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-slate-400 hover:text-slate-600 underline">
          {expanded ? "ocultar JSON" : "ver JSON completo"}
        </button>
      </div>

      <p className="text-xs font-mono text-slate-500 mb-2">{result.url}</p>

      {is429 && (
        <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-100 rounded-lg px-3 py-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Rate limit atingido. Aguarde alguns minutos e tente novamente.
        </div>
      )}

      {result.error && (
        <p className="text-xs text-red-700 mb-1"><strong>Erro:</strong> {result.error} {result.error_info && `— ${result.error_info}`}</p>
      )}

      {result.data_summary && (
        <div className="text-xs space-y-0.5 text-slate-700 bg-white rounded-lg p-3 border border-inherit">
          <p><strong>ID:</strong> {result.data_summary.id}</p>
          <p><strong>Título:</strong> {result.data_summary.title}</p>
          <p><strong>Status:</strong> {result.data_summary.status}</p>
          <p><strong>Pipeline ID:</strong> {result.data_summary.pipeline_id}</p>
          <p><strong>Stage ID:</strong> {result.data_summary.stage_id}</p>
          <p><strong>Org ID:</strong> {result.data_summary.org_id?.value ?? result.data_summary.org_id ?? "—"}</p>
        </div>
      )}

      {expanded && (
        <pre className="mt-2 text-xs bg-white rounded-lg p-3 border border-inherit overflow-auto max-h-64 text-slate-700">
          {JSON.stringify(result.full_response, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function DiagnosticoPipedrive() {
  const [dealId, setDealId] = useState("12960");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke("testPipedriveDeal", { deal_id: Number(dealId) });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/parametrizacoes" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Diagnóstico Pipedrive</h1>
          <p className="text-slate-400 text-sm">Testa endpoints v1 e v2 para um deal específico</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">ID Deal Pipedrive</label>
            <input
              type="number"
              value={dealId}
              onChange={e => setDealId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 12960"
              onKeyDown={e => e.key === "Enter" && handleTest()}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleTest}
              disabled={loading || !dealId.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
            >
              <Play className="w-4 h-4" />
              {loading ? "Testando..." : "Executar Teste"}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-3 flex gap-4 text-xs text-slate-500 border-t pt-3">
            <span>Deal ID testado: <strong className="text-slate-700">{result.tested_deal_id}</strong></span>
            <span>Tipo JS: <strong className="text-slate-700">{result.id_type}</strong></span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {result?.results && (
        <div className="space-y-4">
          <ResultCard label="API v1" result={result.results.v1} />
          <ResultCard label="API v2" result={result.results.v2} />
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Informe um ID e clique em "Executar Teste" para ver os resultados.
        </div>
      )}
    </div>
  );
}