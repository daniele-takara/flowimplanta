import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Copy, CheckCircle2, AlertCircle, RefreshCw, Zap, Play,
  Activity, Clock, Info, ChevronDown, ChevronRight, Shield, Globe, TestTube2
} from "lucide-react";

const WEBHOOK_URL = `https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/pipedriveWebhook`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CopyBox({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>}
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <code className={`flex-1 text-xs text-slate-700 break-all ${!mono ? "font-sans" : ""}`}>{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors"
          title="Copiar"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function StatusDot({ ok }) {
  return (
    <span className={`w-2 h-2 rounded-full inline-block ${ok ? "bg-green-500" : "bg-slate-300"}`} />
  );
}

function EventBadge({ type }) {
  const colors = {
    "change.deal": "bg-blue-100 text-blue-700",
    "change.activity": "bg-purple-100 text-purple-700",
    "create.activity": "bg-green-100 text-green-700",
    "create.deal": "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-medium ${colors[type] || "bg-slate-100 text-slate-500"}`}>
      {type || "—"}
    </span>
  );
}

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);

  let resultObj = null;
  try { resultObj = log.result ? JSON.parse(log.result) : null; } catch {}
  let matchErrorsArr = [];
  try { matchErrorsArr = log.match_errors ? JSON.parse(log.match_errors) : []; } catch {}

  const isDuplicate = log.duplicate_of;
  const hasUpdate = (log.activities_updated || 0) + (log.activities_created || 0) > 0;

  return (
    <div className={`border-b border-slate-100 last:border-0 ${isDuplicate ? "opacity-50" : ""}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <StatusDot ok={log.processed} />
        <div className="flex-1 min-w-0 grid grid-cols-6 gap-2 items-center">
          <div className="col-span-1 text-xs text-slate-400 whitespace-nowrap">{fmtDate(log.processed_at || log.created_date)}</div>
          <div className="col-span-1"><EventBadge type={log.event_type} /></div>
          <div className="col-span-1 text-xs font-mono text-slate-600">
            {log.deal_id ? `Deal #${log.deal_id}` : "—"}
            {log.activity_id ? ` · Act #${log.activity_id}` : ""}
          </div>
          <div className="col-span-1 text-xs text-slate-500 truncate">{log.project_name || (log.project_id ? log.project_id.substring(0, 8) + "..." : "—")}</div>
          <div className="col-span-1 text-xs">
            {isDuplicate ? (
              <span className="text-slate-400 italic">duplicado</span>
            ) : log.processed ? (
              <span className="text-green-600">✓ {log.activities_updated || 0} atualiz. · {log.activities_created || 0} criado(s)</span>
            ) : (
              <span className="text-red-500 truncate">{log.error || "falhou"}</span>
            )}
          </div>
          <div className="col-span-1 flex justify-end">
            {expanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-500 uppercase mb-1">Regras</p>
              <p>Carregadas: <strong>{log.rules_loaded || 0}</strong></p>
              <p>Bateram: <strong>{log.rules_matched || 0}</strong></p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-500 uppercase mb-1">Atividades</p>
              <p>Atualizadas: <strong>{log.activities_updated || 0}</strong></p>
              <p>Criadas: <strong>{log.activities_created || 0}</strong></p>
              <p>Datas ignoradas: <strong>{log.dates_ignored || 0}</strong></p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-500 uppercase mb-1">IDs</p>
              <p className="font-mono break-all text-slate-600">{log.event_id || "—"}</p>
            </div>
          </div>

          {log.error && (
            <div className="p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
              <strong>Erro:</strong> {log.error}
            </div>
          )}

          {matchErrorsArr.length > 0 && (
            <div className="p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
              <strong>Inconsistências de match:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">{matchErrorsArr.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          {resultObj?.updated?.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-slate-600 mb-1">Atividades atualizadas:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                {resultObj.updated.map((a, i) => <li key={i}><strong>{a.name}</strong> ({a.phase}) — {JSON.stringify(a.patch)}</li>)}
              </ul>
            </div>
          )}

          {resultObj?.created?.length > 0 && (
            <div className="text-xs text-blue-700">
              <p className="font-semibold mb-1">Atividades criadas:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {resultObj.created.map((a, i) => <li key={i}><strong>{a.name}</strong> ({a.phase})</li>)}
              </ul>
            </div>
          )}

          {resultObj?.dates_ignored?.length > 0 && (
            <div className="text-xs text-slate-500">
              <p className="font-semibold mb-1">Datas ignoradas (já existiam):</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {resultObj.dates_ignored.map((d, i) => <li key={i}>{d.activity} · {d.field}: {d.reason}</li>)}
              </ul>
            </div>
          )}

          {log.payload_snapshot && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Ver payload recebido</summary>
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-48 text-xs">
                {(() => { try { return JSON.stringify(JSON.parse(log.payload_snapshot), null, 2); } catch { return log.payload_snapshot; } })()}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Simulate Panel ────────────────────────────────────────────────────────────

function SimulatePanel() {
  const [payload, setPayload] = useState(JSON.stringify({
    event: "change.deal",
    meta: { action: "change", object: "deal" },
    current: { id: 12960, stage_id: 142, update_time: new Date().toISOString().substring(0, 10) },
    previous: { stage_id: 141 }
  }, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    try {
      let parsed;
      try { parsed = JSON.parse(payload); } catch { setResult({ ok: false, error: "Payload JSON inválido" }); setLoading(false); return; }
      const res = await base44.functions.invoke("pipedriveWebhook", parsed);
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Cole um payload JSON do Pipedrive e simule o processamento sem depender de evento real.</p>
      <textarea
        value={payload}
        onChange={e => setPayload(e.target.value)}
        rows={10}
        className="w-full text-xs font-mono bg-slate-900 text-slate-100 rounded-xl p-4 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        placeholder="Cole o payload JSON aqui..."
      />
      <button
        onClick={handleSimulate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Simular Processamento
      </button>

      {result && (
        <div className={`rounded-xl p-4 text-xs ${result.ok && result.data?.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <pre className="overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap">
            {result.ok ? JSON.stringify(result.data, null, 2) : `Erro: ${result.error}`}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Manual Test Panel ─────────────────────────────────────────────────────────

function ManualTestPanel() {
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId.trim() });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      const errData = e.response?.data;
      setResult({ ok: !!errData, data: errData, error: errData ? null : e.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Executa a reconciliação manual (syncScheduleFromPipedrive) — usa a mesma lógica do webhook.</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          placeholder="ID do projeto Base44"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          onKeyDown={e => e.key === "Enter" && handleTest()}
        />
        <button
          onClick={handleTest}
          disabled={loading || !projectId.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Testar Deal
        </button>
      </div>

      {result && (
        <div className={`rounded-xl p-4 text-xs ${result.data?.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {result.data ? (
            <div className="space-y-1">
              <p className="font-bold">{result.data.ok ? "✓ Sync executado" : "✗ " + (result.data.error || "Falhou")}</p>
              {result.data.ok && <>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <p>Deal: <strong>#{result.data.deal_id}</strong></p>
                  <p>Stage: <strong>{result.data.deal_stage_id}</strong></p>
                  <p>Regras: <strong>{result.data.rules_total}</strong> (aplicadas: {result.data.rules_applied})</p>
                  <p>Atualizadas: <strong>{result.data.updated}</strong></p>
                  <p>Criadas: <strong>{result.data.created}</strong></p>
                  <p>Activities Pipe: <strong>{result.data.activities_found}</strong></p>
                </div>
                {result.data.match_errors?.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-100 rounded">
                    <strong>Inconsistências:</strong>
                    <ul className="list-disc pl-4 mt-1">{result.data.match_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
              </>}
            </div>
          ) : (
            <p>Erro: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ logs }) {
  const total = logs.length;
  const processed = logs.filter(l => l.processed).length;
  const withErrors = logs.filter(l => !l.processed && !l.duplicate_of).length;
  const lastLog = logs[0];
  const lastProcessed = logs.find(l => l.processed);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Total de eventos", value: total, color: "text-slate-800" },
        { label: "Processados com sucesso", value: processed, color: "text-green-700" },
        { label: "Com erro", value: withErrors, color: withErrors > 0 ? "text-red-600" : "text-slate-800" },
        { label: "Último deal recebido", value: lastLog?.deal_id ? `#${lastLog.deal_id}` : "—", color: "text-blue-700" },
      ].map(s => (
        <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function WebhookConfig() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("config");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.PipedriveWebhookEvent.list("-created_date", 50);
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const lastLog = logs[0];
  const lastProcessed = logs.find(l => l.processed);

  const TABS = [
    { id: "config", label: "Configuração", icon: Globe },
    { id: "logs", label: `Eventos (${logs.length})`, icon: Activity },
    { id: "simulate", label: "Simular Webhook", icon: TestTube2 },
    { id: "test", label: "Testar Deal", icon: Zap },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/parametrizacoes" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Configuração Webhook Pipedrive
          </h1>
          <p className="text-slate-400 text-sm">Motor principal de integração em tempo real Pipedrive → Cronograma</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Status rápido */}
      <StatsBar logs={logs} />

      {/* Status de integração */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" />Status da Integração</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Webhook configurado", value: logs.length > 0 ? "Sim (eventos recebidos)" : "Aguardando 1º evento", ok: logs.length > 0 },
            { label: "Último evento", value: lastLog ? fmtDate(lastLog.processed_at || lastLog.created_date) : "—", ok: !!lastLog },
            { label: "Último deal recebido", value: lastLog?.deal_id ? `#${lastLog.deal_id}` : "—", ok: !!lastLog?.deal_id },
            { label: "Último projeto atualizado", value: lastProcessed?.project_name || (lastProcessed?.project_id ? lastProcessed.project_id.substring(0, 10) + "..." : "—"), ok: !!lastProcessed },
            { label: "Último erro", value: logs.find(l => l.error)?.error?.substring(0, 60) || "Nenhum", ok: !logs.find(l => l.error) },
            { label: "Último processamento OK", value: lastProcessed ? fmtDate(lastProcessed.processed_at) : "—", ok: !!lastProcessed },
          ].map(s => (
            <div key={s.label} className="flex items-start gap-2">
              <StatusDot ok={s.ok} />
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xs font-medium text-slate-800 mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Configuração */}
        {activeTab === "config" && (
          <div className="space-y-5">
            {/* URL e segredo */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" />URL do Webhook</h3>
              <CopyBox label="URL pública — use esta no Pipedrive" value={WEBHOOK_URL} />
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <strong>Segurança opcional:</strong> Configure a variável de ambiente <code className="bg-blue-100 px-1 rounded">PIPEDRIVE_WEBHOOK_SECRET</code> no painel Base44 e adicione como query param na URL: <code className="bg-blue-100 px-1 rounded">?secret=SEU_TOKEN</code> ou no header <code className="bg-blue-100 px-1 rounded">x-flowimplanta-webhook-secret</code>.
              </div>
            </div>

            {/* Instruções Pipedrive */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-orange-500" />Como configurar no Pipedrive</h3>

              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Você precisa configurar <strong>3 webhooks separados</strong> no Pipedrive (um por evento).</span>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase">Caminho no Pipedrive:</p>
                <div className="flex flex-wrap gap-2 text-xs items-center text-slate-600">
                  {["Settings / Ferramentas", "→", "Tools and apps", "→", "Webhooks", "→", "+ Add webhook"].map((s, i) => (
                    <span key={i} className={s === "→" ? "text-slate-300" : "bg-slate-100 px-2 py-1 rounded font-medium"}>{s}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { action: "change", object: "deal", desc: "Mudança de stage, campos customizados, datas", color: "blue" },
                  { action: "change", object: "activity", desc: "Atividade concluída, data alterada", color: "purple" },
                  { action: "create", object: "activity", desc: "Nova atividade criada no Pipedrive", color: "green" },
                ].map((wh, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide bg-${wh.color}-50 text-${wh.color}-700 border-b border-slate-200`}>
                      Webhook {i + 1} — {wh.action}.{wh.object}
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">URL</p>
                        <CopyBox value={WEBHOOK_URL} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Event action</p>
                          <CopyBox value={wh.action} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Event object</p>
                          <CopyBox value={wh.object} />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">{wh.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Importantes:</p>
                <p>• <strong>Versão de API:</strong> Use a versão padrão (v1) — não precisa selecionar</p>
                <p>• <strong>HTTP Auth:</strong> Deixar vazio (não obrigatório)</p>
                <p>• <strong>Subscription for:</strong> "All" ou filtre por pipeline se preferir</p>
                <p>• Após salvar, o Pipedrive enviará um evento de teste — verifique na aba "Eventos" abaixo</p>
              </div>
            </div>

            {/* Eventos suportados */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-green-500" />Eventos Suportados</h3>
              <div className="space-y-2">
                {[
                  { type: "change.deal", desc: "Mudança de stage_id → preenche actual_start/end conforme regras da planilha" },
                  { type: "change.activity", desc: "Activity concluída (done=true) → localiza deal e atualiza cronograma" },
                  { type: "create.activity", desc: "Nova activity → processa se houver regra aplicável" },
                  { type: "create.deal", desc: "Novo deal criado → recebe e registra log (sem criação automática de projeto)" },
                ].map(e => (
                  <div key={e.type} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <EventBadge type={e.type} />
                    <p className="text-xs text-slate-600 flex-1">{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Arquitetura */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-bold text-slate-800 mb-3">Fonte única de regras</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {["Google Sheets", "→", "savePipedriveRules", "→", "PipedriveIntegrationRule (banco)", "→", "pipedriveWebhook (tempo real)", "OU", "syncScheduleFromPipedrive (manual)", "→", "ScheduleActivity"].map((s, i) => (
                  <span key={i} className={s === "→" || s === "OU" ? "text-slate-400 font-bold" : "bg-slate-100 px-2 py-1 rounded font-medium text-slate-700"}>{s}</span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">Webhook e sync manual usam <strong>exatamente a mesma lógica</strong> e a mesma fonte de regras (banco). Datas existentes <strong>nunca são sobrescritas</strong>.</p>
            </div>
          </div>
        )}

        {/* Tab: Logs */}
        {activeTab === "logs" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Clock className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhum evento recebido ainda</p>
                <p className="text-xs">Configure o webhook no Pipedrive e aguarde o primeiro evento</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <div>Status</div>
                  <div>Evento</div>
                  <div>Deal / Activity</div>
                  <div>Projeto</div>
                  <div>Resultado</div>
                  <div></div>
                </div>
                {logs.map(log => <LogRow key={log.id} log={log} />)}
              </div>
            )}
          </div>
        )}

        {/* Tab: Simular */}
        {activeTab === "simulate" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><TestTube2 className="w-4 h-4 text-purple-500" />Simular Webhook</h3>
            <SimulatePanel />
          </div>
        )}

        {/* Tab: Testar Deal */}
        {activeTab === "test" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-orange-500" />Reconciliação Manual (Testar Deal)</h3>
            <ManualTestPanel />
          </div>
        )}
      </div>
    </div>
  );
}