import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronRight, Search } from "lucide-react";

function CheckRow({ item }) {
  const [open, setOpen] = useState(false);
  const icon = item.status === "ok"
    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
    : item.status === "warning"
    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;

  const bg = item.status === "ok" ? "bg-green-50 border-green-200"
    : item.status === "warning" ? "bg-amber-50 border-amber-200"
    : "bg-red-50 border-red-200";

  return (
    <div className={`border rounded-xl overflow-hidden ${bg}`}>
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:opacity-90"
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.detail}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-inherit">
          <p className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap">{item.detail}</p>
          {item.suggestion && (
            <div className="p-2 bg-white border border-slate-200 rounded-lg text-xs text-blue-700">
              <strong>Sugestão: </strong>{item.suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ValidationChecklist() {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("validatePipedriveSetup", {
        deal_id: dealId ? Number(dealId) : undefined,
      });
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="number"
          value={dealId}
          onChange={e => setDealId(e.target.value)}
          placeholder="Deal ID (opcional — para validação completa)"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          onKeyDown={e => e.key === "Enter" && run()}
        />
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Validar
        </button>
      </div>

      {result?.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{result.error}</div>
      )}

      {result?.summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{result.summary.ok}</p>
            <p className="text-xs text-green-600 mt-1">OK</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{result.summary.warning}</p>
            <p className="text-xs text-amber-600 mt-1">Avisos</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{result.summary.error}</p>
            <p className="text-xs text-red-600 mt-1">Erros</p>
          </div>
        </div>
      )}

      {result?.checks && (
        <div className="space-y-2">
          {result.checks.map(c => <CheckRow key={c.id} item={c} />)}
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-10 text-slate-400 text-sm">
          Clique em "Validar" para executar o checklist de configuração.
        </div>
      )}
    </div>
  );
}