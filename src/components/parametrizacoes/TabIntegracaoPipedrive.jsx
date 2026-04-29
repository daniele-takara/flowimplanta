import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, CheckCircle2, Zap, ExternalLink, RefreshCw, AlertCircle, Table2, Link2, Info } from "lucide-react";

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const DADOS_GID = "432071218";      // Aba "Dados iniciais - integração"
const CRONOGRAMA_GID = "1377224895"; // Aba "Cronograma - Integração"

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

// Componente que carrega e exibe as regras de uma aba da planilha
function RulesViewer({ title, gid, description }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sheetName, setSheetName] = useState("");

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("readSheetMapping", { gid });
      const data = res.data;
      if (data.error) {
        setError(data.error);
      } else {
        setSheetName(data.sheet_name || "");
        const rawRows = data.rows || [];
        if (rawRows.length > 0) {
          setHeaders(Object.keys(rawRows[0]));
          setRows(rawRows);
        } else {
          setHeaders([]);
          setRows([]);
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          {sheetName && <p className="text-xs text-slate-400 mt-0.5">Aba: <span className="font-mono">{sheetName}</span></p>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${gid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Abrir planilha
          </a>
          <button
            onClick={loadRules}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {rows.length > 0 ? "Recarregar" : "Carregar regras"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-100 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm gap-2">
          <Table2 className="w-8 h-8 opacity-30" />
          <p>Clique em "Carregar regras" para buscar da planilha</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {headers.map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-100 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  {headers.map(h => (
                    <td key={h} className="px-3 py-2 text-slate-700 border border-slate-50 whitespace-nowrap max-w-[200px] truncate" title={row[h]}>
                      {row[h] || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
            {rows.length} regra(s) carregada(s)
          </div>
        </div>
      )}
    </div>
  );
}

// Teste manual do botão "Atualizar Cronograma"
function TestScheduleSync() {
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", {
        project_id: projectId.trim(),
      });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Teste Manual — Atualizar Cronograma</p>
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
          disabled={loading || !projectId.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Executar Sync
        </button>
      </div>
      {result && (
        <div className={`rounded-lg p-3 text-xs ${result.ok && result.data?.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {result.ok && result.data?.ok ? (
            <div className="space-y-1">
              <p className="font-bold">✓ Sincronização concluída</p>
              <p>Deal ID: <span className="font-mono font-bold">{result.data.deal_id}</span></p>
              <p>Stage atual: <span className="font-mono">{result.data.deal_stage_id}</span></p>
              <p>Activities Pipedrive: <strong>{result.data.activities_found}</strong> (concluídas: {result.data.activities_done})</p>
              <p>Regras na planilha: <strong>{result.data.rules_total}</strong></p>
              <p>Regras aplicadas: <strong>{result.data.rules_applied}</strong></p>
              <p>Atividades atualizadas: <strong>{result.data.updated}</strong></p>
              {result.data.activities?.length > 0 && (
                <ul className="mt-2 list-disc pl-4 space-y-0.5">
                  {result.data.activities.map((a, i) => (
                    <li key={i}><span className="font-mono">{a.name}</span> ({a.phase}) — {JSON.stringify(a.patch)}</li>
                  ))}
                </ul>
              )}
              {result.data.match_errors?.length > 0 && (
                <div className="mt-2 text-amber-700 bg-amber-50 rounded p-2">
                  <p className="font-bold">Inconsistências:</p>
                  <ul className="list-disc pl-4">
                    {result.data.match_errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
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

export default function TabIntegracaoPipedrive() {
  const webhookUrl = `https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/pipedriveWebhook`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Integração Pipedrive ↔ Base44</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Fonte única de verdade para as regras de sincronização. As regras são lidas diretamente da planilha Google Sheets e aplicadas ao clicar em "Atualizar Cronograma (Pipedrive)" na tela de Cronograma do projeto.
          </p>
        </div>
      </div>

      {/* Arquitetura */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: "⚙️", title: "Parametrizações", desc: "Define as regras de mapeamento (esta tela)" },
          { icon: "🔗", title: "Dados Iniciais", desc: "Define o vínculo via campo ID Deal Pipedrive" },
          { icon: "▶️", title: "Botão Cronograma", desc: 'Executa a lógica ao clicar "Atualizar Cronograma (Pipedrive)"' },
        ].map(item => (
          <div key={item.title} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-sm font-bold text-slate-700">{item.title}</p>
            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Regras — Dados Iniciais */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aba 1 — Dados Iniciais (mapeamento de campos)</p>
        </div>
        <RulesViewer
          title="Dados iniciais - integração"
          gid={DADOS_GID}
          description="Regras de mapeamento entre campos do Pipedrive e campos dos Dados Iniciais do projeto"
        />
      </div>

      {/* Regras — Cronograma */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Table2 className="w-4 h-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aba 2 — Cronograma (início e fim executados)</p>
        </div>
        <div className="flex items-start gap-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Lógica de segurança:</strong> Apenas campos vazios são preenchidos — datas já cadastradas manualmente <strong>nunca são sobrescritas</strong>.
            Planned_start e planned_end nunca são alterados.
          </div>
        </div>
        <RulesViewer
          title="Cronograma - Integração"
          gid={CRONOGRAMA_GID}
          description="Regras de atualização de início/fim executado com base em mudanças de stage (deal) ou conclusão de activities"
        />
      </div>

      {/* Legenda das colunas */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Legenda das colunas do Cronograma</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {["Coluna", "Valores", "Descrição"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-slate-500 border border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["pipedrive_entidade", "deal / activity", "Tipo de objeto Pipedrive que dispara a regra"],
                ["pipedrive_campo_key", "stage_id / done", "Campo do objeto que é verificado"],
                ["pipedrive_valor_disparo", "142 / true", "Valor esperado (para deal: ID numérico do stage)"],
                ["pipedrive_campo_identificacao", "subject", "Campo de identificação (para activity)"],
                ["pipedrive_valor_identificacao", "Alinhamento inicial", "Valor esperado no campo de identificação"],
                ["pipedrive_campo_data", "marked_as_done_time", "Campo de onde extrair a data"],
                ["base44_fase", "Abertura de projeto", "Fase do cronograma Base44 onde aplicar"],
                ["base44_atividade", "* ou nome exato", "Atividade específica ou * para todas da fase"],
                ["início", "sim / não", "Se deve preencher actual_start"],
                ["fim", "sim / não", "Se deve preencher actual_end e marcar Concluído"],
              ].map(([col, vals, desc]) => (
                <tr key={col} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-blue-700 border border-slate-200">{col}</td>
                  <td className="px-3 py-2 text-slate-500 border border-slate-200">{vals}</td>
                  <td className="px-3 py-2 text-slate-600 border border-slate-200">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook */}
      <div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Webhook Pipedrive (atualização automática)</p>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <CopyBox label="URL do Webhook" value={webhookUrl} />
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Configurar no Pipedrive:</strong> Ferramentas → Webhooks → Adicionar Webhook. Método <code className="bg-amber-100 px-1 rounded">POST</code>,
              eventos: <code className="bg-amber-100 px-1 rounded">updated.deal</code> e <code className="bg-amber-100 px-1 rounded">updated.activity</code>.
              <a href="https://pipedrive.readme.io/docs/guide-for-webhooks" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-amber-700 hover:underline">
                <ExternalLink className="w-3 h-3" /> Documentação do Pipedrive Webhooks
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Teste */}
      <TestScheduleSync />
    </div>
  );
}