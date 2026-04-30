import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Play, Copy, CheckCircle2 } from "lucide-react";

const DEFAULT_PAYLOAD = JSON.stringify({
  event: "change.deal",
  meta: { action: "change", object: "deal", v_ts: "20260430120000" },
  current: { id: 12960, stage_id: 142, update_time: new Date().toISOString().substring(0, 10) },
  previous: { stage_id: 141 }
}, null, 2);

export default function WebhookSimulatePanel() {
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    let parsed;
    try { parsed = JSON.parse(payload); } catch { setResult({ ok: false, error: "Payload JSON inválido" }); setLoading(false); return; }
    try {
      const res = await base44.functions.invoke("pipedriveWebhook", parsed);
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message, data: e.response?.data });
    }
    setLoading(false);
  };

  const copyError = () => {
    const errData = result?.data?.errors || [result?.error];
    navigator.clipboard.writeText(JSON.stringify(errData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Cole um payload JSON do Pipedrive e simule o processamento via pipedriveWebhook. O evento será registrado em IntegrationLog.</p>

      <textarea
        value={payload}
        onChange={e => setPayload(e.target.value)}
        rows={12}
        className="w-full text-xs font-mono bg-slate-900 text-slate-100 rounded-xl p-4 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSimulate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Simular Webhook
        </button>
        {result && (
          <button onClick={copyError} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />} Copiar resultado
          </button>
        )}
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-xs ${result.ok && result.data?.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <pre className="overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap">
            {result.ok ? JSON.stringify(result.data, null, 2) : `Erro: ${result.error}\n${result.data ? JSON.stringify(result.data, null, 2) : ""}`}
          </pre>
        </div>
      )}
    </div>
  );
}