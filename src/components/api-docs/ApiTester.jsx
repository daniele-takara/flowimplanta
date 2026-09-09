import { useState } from "react";
import { Play, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { API_BASE_URL, METHOD_COLORS } from "@/lib/apiDocsConfig";

const ERROR_MESSAGES = {
  401: "Chave ausente, inválida ou desativada. Verifique a chave x-api-key.",
  404: "Projeto não encontrado para o id/cnpj informado.",
  500: "Erro interno no servidor. Tente novamente em instantes.",
};

export default function ApiTester({ endpoint }) {
  const [apiKey, setApiKey] = useState("");
  const [paramValues, setParamValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const queryParams = (endpoint.parameters || []).filter(p => p.in === "query");

  const buildUrl = () => {
    const base = `${API_BASE_URL}/${endpoint.id}`;
    const qs = new URLSearchParams();
    Object.entries(paramValues).forEach(([k, v]) => {
      if (v && v.trim()) qs.append(k, v.trim());
    });
    const query = qs.toString();
    return query ? `${base}?${query}` : base;
  };

  const buildCurl = () => {
    const url = buildUrl();
    return `curl -H "x-api-key: ${apiKey || "<sua-chave>"}" \\\n  "${url}"`;
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setResult(null);
    const url = buildUrl();
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers: { "x-api-key": apiKey.trim() },
      });
      const elapsed = Math.round(performance.now() - start);
      const text = await res.text();
      let body;
      try { body = JSON.stringify(JSON.parse(text), null, 2); }
      catch { body = text; }
      setResult({
        status: res.status,
        ok: res.ok,
        durationMs: elapsed,
        body,
        error: !res.ok ? (ERROR_MESSAGES[res.status] || `Erro HTTP ${res.status}`) : null,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResult({
        status: 0,
        ok: false,
        durationMs: elapsed,
        body: "",
        error: `Falha de rede: ${err.message}. Verifique sua conexão.`,
      });
    }
    setLoading(false);
  };

  const colors = METHOD_COLORS[endpoint.method] || METHOD_COLORS.GET;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border-b border-purple-100">
        <span className="flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-wide">
          <Play className="w-3.5 h-3.5" /> Testar endpoint
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border} ml-auto`}>
          {endpoint.method}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Chave de API <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="ptl_..."
            className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <p className="text-[11px] text-slate-400 mt-1">A chave não é salva nem enviada para nenhum outro lugar além do endpoint oficial.</p>
        </div>

        {queryParams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {queryParams.map(p => (
              <div key={p.name}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {p.name} <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={paramValues[p.name] || ""}
                  onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                  placeholder={p.example || ""}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={loading || !apiKey.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Testando..." : "Testar"}
        </button>

        {result && (
          <div className={`rounded-lg border p-3 ${result.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.ok
                ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                : <XCircle className="w-4 h-4 text-red-600" />}
              <span className={`text-sm font-bold ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
                {result.status || "Sem resposta"} · {result.durationMs}ms
              </span>
            </div>
            {result.error && (
              <div className="flex items-start gap-1.5 mb-2 text-xs text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{result.error}</span>
              </div>
            )}
            {result.body && (
              <pre className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-80 overflow-y-auto">
                {result.body}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Comando equivalente (curl)</label>
        <pre className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
          {buildCurl()}
        </pre>
      </div>
    </div>
  );
}