import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  Copy, CheckCircle2, Zap, ExternalLink, RefreshCw,
  AlertCircle, Table2, Link2, Info, Database, Shield, Settings, Activity
} from "lucide-react";

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const DADOS_GID = "432071218";
const CRONOGRAMA_GID = "1377224895";
const STATUS_REPORT_GID = "1556112644";
const WEBHOOK_URL = `https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/pipedriveWebhook`;

// ── Componente CopyBox ────────────────────────────────────────────────────────
function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <code className="flex-1 text-xs text-slate-700 break-all">{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Tabela de regras salvas no banco ─────────────────────────────────────────
function SavedRulesTable({ ruleType, rules, loading }) {
  const filtered = rules.filter(r => r.rule_type === ruleType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm gap-2">
        <Database className="w-7 h-7 opacity-30" />
        <p>Nenhuma regra salva. Clique em "Atualizar regras da planilha".</p>
      </div>
    );
  }

  if (ruleType === "cronograma") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["#", "Entidade", "Campo/Valor", "Identificação", "Fase", "Atividade", "Início", "Fim"].map(h => (
                <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-100 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-400 border border-slate-50">{r.order}</td>
                <td className="px-3 py-2 font-mono text-blue-700 border border-slate-50">{r.pipedrive_entidade}</td>
                <td className="px-3 py-2 text-slate-600 border border-slate-50 whitespace-nowrap">
                  <span className="font-mono">{r.pipedrive_campo_key}</span>=<span className="font-mono font-bold">{r.pipedrive_valor_disparo}</span>
                </td>
                <td className="px-3 py-2 text-slate-500 border border-slate-50 max-w-[140px] truncate" title={r.pipedrive_valor_identificacao}>
                  {r.pipedrive_valor_identificacao || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-slate-700 border border-slate-50 whitespace-nowrap">{r.base44_fase}</td>
                <td className="px-3 py-2 text-slate-600 border border-slate-50">{r.base44_atividade || "*"}</td>
                <td className="px-3 py-2 border border-slate-50">
                  {r.faz_inicio ? <span className="text-green-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 border border-slate-50">
                  {r.faz_fim ? <span className="text-green-600 font-bold">✓</span> : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} regra(s) · última sync: {filtered[0]?.synced_at ? new Date(filtered[0].synced_at).toLocaleString("pt-BR") : "—"}
        </div>
      </div>
    );
  }

  // dados_iniciais — exibir raw
  const rows = filtered.map(r => { try { return JSON.parse(r.raw_data || "{}"); } catch { return {}; } });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-100 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              {headers.map(h => (
                <td key={h} className="px-3 py-2 text-slate-700 border border-slate-50 whitespace-nowrap max-w-[180px] truncate" title={row[h]}>
                  {row[h] || <span className="text-slate-300">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
        {filtered.length} regra(s) · última sync: {filtered[0]?.synced_at ? new Date(filtered[0].synced_at).toLocaleString("pt-BR") : "—"}
      </div>
    </div>
  );
}

// ── Modal de confirmação ──────────────────────────────────────────────────────
function ConfirmModal({ onConfirm, onCancel, existingCount }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-800">Confirmar atualização de regras</p>
            <p className="text-sm text-slate-600 mt-1">
              Isso irá substituir as <strong>{existingCount} regra(s) atuais</strong> pelas regras da planilha. Deseja continuar?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Sim, atualizar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Teste E2E ─────────────────────────────────────────────────────────────────
function TestScheduleSync({ rulesCount }) {
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleTest = async () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setResult(null);
    setShowDetails(false);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId.trim() });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      const errData = e.response?.data;
      if (errData) {
        setResult({ ok: true, data: { ...errData, ok: false } });
      } else {
        setResult({ ok: false, error: e.message });
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">
        Teste E2E — Atualizar Cronograma
      </p>
      {rulesCount === 0 && (
        <div className="flex items-center gap-2 p-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Sincronize as regras da planilha antes de testar.
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          placeholder="ID do projeto Base44"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />
        <button
          onClick={handleTest}
          disabled={loading || !projectId.trim() || rulesCount === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Executar
        </button>
      </div>

      {result && (
        <div className={`rounded-lg p-3 text-xs ${result.ok && result.data?.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {result.ok && result.data?.ok ? (
            <div className="space-y-1">
              <p className="font-bold">✓ Sincronização executada</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <p>Deal ID: <strong>#{result.data.deal_id}</strong></p>
                <p>Stage: <strong>{result.data.deal_stage_id}</strong></p>
                <p>Activities: <strong>{result.data.activities_found}</strong> (done: {result.data.activities_done})</p>
                <p>Regras: <strong>{result.data.rules_total}</strong> (aplicadas: {result.data.rules_applied})</p>
                <p>Atualizadas: <strong>{result.data.updated}</strong></p>
              </div>
              {(result.data.activities?.length > 0 || result.data.match_errors?.length > 0) && (
                <button onClick={() => setShowDetails(v => !v)} className="text-green-700 underline text-xs mt-1">
                  {showDetails ? "ocultar detalhes" : "ver detalhes"}
                </button>
              )}
              {showDetails && (
                <div className="mt-2 space-y-2">
                  {result.data.available_phases?.length > 0 && (
                    <div>
                      <p className="font-semibold">Fases carregadas do projeto ({result.data.schedule_activities_count} atividades):</p>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 font-mono">
                        {result.data.available_phases.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.data.activities?.length > 0 && (
                    <div>
                      <p className="font-bold">Atividades atualizadas:</p>
                      <ul className="list-disc pl-4 space-y-0.5 mt-1">
                        {result.data.activities.map((a, i) => (
                          <li key={i}><strong>{a.name}</strong> ({a.phase}) — {JSON.stringify(a.patch)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.data.match_errors?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                      <p className="font-bold">Inconsistências:</p>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {result.data.match_errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p>Erro: {result.data?.error || result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function TabIntegracaoPipedrive() {
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const all = await base44.entities.PipedriveIntegrationRule.list();
      setRules(all.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (e) {
      console.error(e);
    }
    setRulesLoading(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSyncRules = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    setShowConfirm(false);
    try {
      const res = await base44.functions.invoke("savePipedriveRules", {});
      const data = res.data;
      if (data.error) {
        setSyncResult({ ok: false, error: data.error });
      } else {
        setSyncResult({ ok: true, data });
        await loadRules();
      }
    } catch (e) {
      setSyncResult({ ok: false, error: e.message });
    }
    setSyncLoading(false);
  };

  const handleMergeRules = async () => {
    setMergeLoading(true);
    setMergeResult(null);
    try {
      const res = await base44.functions.invoke("mergePipedriveRules", {});
      const data = res.data;
      if (data.error) {
        setMergeResult({ ok: false, error: data.error });
      } else {
        setMergeResult({ ok: true, data });
        await loadRules();
      }
    } catch (e) {
      setMergeResult({ ok: false, error: e.message });
    }
    setMergeLoading(false);
  };

  const dadosCount = rules.filter(r => r.rule_type === "dados_iniciais").length;
  const cronoCount = rules.filter(r => r.rule_type === "cronograma").length;
  const srCount = rules.filter(r => r.rule_type === "status_report").length;
  const lastSync = rules.length > 0 ? rules[0]?.synced_at : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {showConfirm && (
        <ConfirmModal
          existingCount={rules.length}
          onConfirm={handleSyncRules}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-blue-800">Integração Pipedrive ↔ Base44</p>
          <p className="text-xs text-blue-600 mt-0.5">
            A planilha é a fonte de configuração. Sincronize as regras abaixo e use os botões nos projetos para executar a integração.
          </p>
        </div>
      </div>

      {/* Botão principal + status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Regras salvas no sistema
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {rulesLoading ? "Carregando..." : rules.length === 0
                ? "Nenhuma regra. Clique em Atualizar para sincronizar."
                : `${dadosCount} dados iniciais · ${cronoCount} cronograma · ${srCount} status report`}
              {lastSync && !rulesLoading && (
                <span className="ml-2 text-slate-400">
                  · última sync: {new Date(lastSync).toLocaleString("pt-BR")}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={handleMergeRules}
              disabled={mergeLoading || syncLoading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-300 rounded-xl disabled:opacity-50 transition-colors"
              title="Adiciona apenas as novas linhas da planilha, sem apagar as existentes"
            >
              {mergeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Adicionar novas regras
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={syncLoading || mergeLoading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors"
              title="Apaga todas as regras e recria do zero a partir da planilha"
            >
              {syncLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recriar todas as regras
            </button>
          </div>
        </div>

        {mergeResult && (
          <div className={`mt-4 rounded-lg p-3 text-xs flex items-start gap-2 ${mergeResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {mergeResult.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              {mergeResult.ok
                  ? <>
                      <p className="font-bold">Sincronização incremental concluída</p>
                      <p className="mt-0.5">
                        {mergeResult.data.total_created} nova(s) regra(s) adicionada(s) ·{" "}
                        {mergeResult.data.cronograma?.ignored || 0} cronograma ignorada(s) ·{" "}
                        {mergeResult.data.dados_iniciais?.ignored || 0} dados_iniciais ignorada(s) ·{" "}
                        {mergeResult.data.status_report?.created || 0} status report criada(s) ·{" "}
                        Total: {mergeResult.data.total_after} regras
                      </p>
                    </>
                : <p>Erro: {mergeResult.error}</p>}
            </div>
          </div>
        )}

        {syncResult && (
          <div className={`mt-4 rounded-lg p-3 text-xs flex items-start gap-2 ${syncResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {syncResult.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              {syncResult.ok
                  ? <>
                      <p className="font-bold">Todas as regras recriadas do zero</p>
                      <p className="mt-0.5">
                        {syncResult.data.dados_iniciais?.count || 0} dados iniciais ·{" "}
                        {syncResult.data.cronograma?.count || 0} cronograma ·{" "}
                        {syncResult.data.status_report?.count || 0} status report ·{" "}
                        {syncResult.data.deleted} regra(s) anteriores removidas
                      </p>
                    </>
                : <p>Erro: {syncResult.error}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Aba 1 — Dados Iniciais */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aba 1 — Dados Iniciais (mapeamento)</p>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${DADOS_GID}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline ml-auto">
            <ExternalLink className="w-3 h-3" /> Abrir planilha
          </a>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SavedRulesTable ruleType="dados_iniciais" rules={rules} loading={rulesLoading} />
        </div>
      </div>

      {/* Aba 2 — Cronograma */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Table2 className="w-4 h-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aba 2 — Cronograma (início e fim executados)</p>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${CRONOGRAMA_GID}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline ml-auto">
            <ExternalLink className="w-3 h-3" /> Abrir planilha
          </a>
        </div>
        <div className="flex items-start gap-2 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><strong>Pipedrive é fonte de verdade:</strong> datas de execução são sempre sobrescritas com os valores do Pipedrive.</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SavedRulesTable ruleType="cronograma" rules={rules} loading={rulesLoading} />
        </div>
      </div>

      {/* Aba 3 — Status Report */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aba 3 — Status Report (parser texto)</p>
          <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${STATUS_REPORT_GID}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline ml-auto">
            <ExternalLink className="w-3 h-3" /> Abrir planilha
          </a>
        </div>
        <div className="flex items-start gap-2 mb-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Campo Pipedrive:</strong>{" "}
            <code className="bg-purple-100 px-1 rounded text-xs">77e52d...828f7</code>{" "}
            — texto estruturado (<em>Próxima Agenda / Pendência cliente / Pendência Pontotel / Risco</em>) mapeado para os campos existentes do Status Report.
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {rulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : srCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm gap-2">
              <Database className="w-7 h-7 opacity-30" />
              <p>Nenhuma regra de status report. Clique em "Adicionar novas regras".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["#", "Campo Pipedrive", "Destino Base44", "Observação"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-100 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.filter(r => r.rule_type === "status_report").map((r) => {
                    const raw = (() => { try { return JSON.parse(r.raw_data || "{}"); } catch { return {}; } })();
                    return (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 border border-slate-50">{r.order}</td>
                        <td className="px-3 py-2 font-mono text-purple-700 border border-slate-50 whitespace-nowrap">{r.pipedrive_campo_key || raw.campo_pipe_key || raw.origem_pipe || "—"}</td>
                        <td className="px-3 py-2 text-slate-700 border border-slate-50 font-mono">{r.base44_atividade || "—"}</td>
                        <td className="px-3 py-2 text-slate-500 border border-slate-50">{raw.observacao || raw.label_pipe || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                {srCount} regra(s) · última sync: {rules.find(r => r.rule_type === "status_report")?.synced_at ? new Date(rules.find(r => r.rule_type === "status_report").synced_at).toLocaleString("pt-BR") : "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Webhook */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Webhook Pipedrive (atualização automática)</p>
          <div className="flex gap-2">
            <Link
              to="/monitor-integracoes"
              className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Monitor
            </Link>
            <Link
              to="/webhook-config"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Configuração & Diagnóstico
            </Link>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <CopyBox label="URL do Webhook" value={WEBHOOK_URL} />
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>3 webhooks devem ser configurados no Pipedrive:</strong>{" "}
              <code className="bg-blue-100 px-1 rounded">change.deal</code>,{" "}
              <code className="bg-blue-100 px-1 rounded">change.activity</code> e{" "}
              <code className="bg-blue-100 px-1 rounded">create.activity</code>.{" "}
              <Link to="/webhook-config" className="text-blue-700 underline">Ver instruções completas →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Teste E2E */}
      <TestScheduleSync rulesCount={cronoCount} />
    </div>
  );
}