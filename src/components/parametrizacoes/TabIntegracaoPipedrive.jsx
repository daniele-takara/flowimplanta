import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, CheckCircle2, Zap, Info, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

const WEBHOOK_FUNCTION = "pipedriveWebhook";

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <code className="flex-1 text-xs text-slate-700 break-all">{value}</code>
        <button onClick={handleCopy} className="shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors">
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function TestPanel() {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!dealId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke(WEBHOOK_FUNCTION, {
        event: "updated.deal",
        current: { id: Number(dealId), stage_id: 142, update_time: new Date().toISOString().substring(0, 10) },
        previous: { stage_id: 141 },
        meta: {},
      });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Teste Manual de Webhook</p>
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={dealId}
          onChange={e => setDealId(e.target.value)}
          placeholder="Deal ID do Pipedrive"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleTest}
          disabled={loading || !dealId}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Simular Mudança de Stage
        </button>
      </div>
      {result && (
        <div className={`rounded-lg p-3 text-xs ${result.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {result.ok ? (
            <div>
              <p className="font-bold mb-1">✓ Webhook processado</p>
              <p>Projeto: <span className="font-mono">{result.data?.project_id || "não encontrado"}</span></p>
              <p>Atividades atualizadas: <strong>{result.data?.updated ?? 0}</strong></p>
              {result.data?.activities?.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.data.activities.map((a, i) => (
                    <li key={i}>{a.name} — {JSON.stringify(a.patch)}</li>
                  ))}
                </ul>
              )}
              {result.data?.skipped && <p className="text-slate-500">Ignorado: {result.data.skipped}</p>}
            </div>
          ) : (
            <p>Erro: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TabIntegracaoPipedrive() {
  // URL da função — base44 functions são acessíveis via endpoint fixo
  const appId = window.location.hostname.split(".")[0];
  const webhookUrl = `https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/${WEBHOOK_FUNCTION}`;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Integração Pipedrive → Base44</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Atualizações no Pipedrive (mudança de etapa ou atividade concluída) disparam automaticamente
            atualizações no cronograma do projeto correspondente no Base44.
          </p>
        </div>
      </div>

      {/* Como funciona */}
      <div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Como funciona</p>
        <div className="space-y-2">
          {[
            { step: "1", text: "O Pipedrive envia um webhook quando um deal muda de etapa ou uma atividade é marcada como concluída." },
            { step: "2", text: "O sistema localiza o projeto Base44 correspondente pelo pipedrive_deal_id." },
            { step: "3", text: "As regras definidas na planilha \"Cronograma - Integração\" determinam quais atividades e datas são atualizadas." },
            { step: "4", text: "Apenas datas ainda não preenchidas são atualizadas — datas manuais nunca são sobrescritas." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{step}</div>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuração no Pipedrive */}
      <div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Configurar Webhook no Pipedrive</p>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <CopyBox label="URL do Webhook" value={webhookUrl} />
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Configurar no Pipedrive:</strong> Acesse <strong>Ferramentas → Webhooks → Adicionar Webhook</strong>.
              Cole a URL acima, método <code className="bg-amber-100 px-1 rounded">POST</code>, evento:
              <code className="bg-amber-100 px-1 rounded mx-1">updated.deal</code> e
              <code className="bg-amber-100 px-1 rounded mx-1">updated.activity</code>.
              <a href="https://pipedrive.readme.io/docs/guide-for-webhooks" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-amber-700 hover:underline">
                <ExternalLink className="w-3 h-3" /> Documentação do Pipedrive Webhooks
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Planilha de regras */}
      <div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Planilha de Regras</p>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600">
              As regras são lidas da aba <strong>"Cronograma - Integração"</strong> da planilha Google Sheets conectada.
              Cada linha define um gatilho Pipedrive e a ação correspondente no cronograma Base44.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["Coluna", "Exemplo", "Descrição"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["pipedrive_entidade", "deal / activity", "Tipo de objeto Pipedrive"],
                  ["pipedrive_campo_key", "stage_id / done", "Campo que dispara a regra"],
                  ["pipedrive_valor_disparo", "142 / true", "Valor esperado no campo"],
                  ["base44_fase", "Abertura de projeto", "Fase do cronograma Base44"],
                  ["base44_atividade", "* (todas)", "Nome da atividade ou * para todas"],
                  ["início", "sim / não", "Atualizar data de início executado"],
                  ["fim", "sim / não", "Atualizar data de fim executado"],
                ].map(([col, ex, desc]) => (
                  <tr key={col} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-blue-700 border border-slate-200">{col}</td>
                    <td className="px-3 py-2 text-slate-500 border border-slate-200">{ex}</td>
                    <td className="px-3 py-2 text-slate-600 border border-slate-200">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Teste */}
      <TestPanel />
    </div>
  );
}