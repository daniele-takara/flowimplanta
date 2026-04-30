import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, RefreshCw, Activity, CheckCircle2, XCircle, Minus,
  AlertTriangle, Zap, Shield, TestTube2, Play, Clock, Filter, Search
} from "lucide-react";
import IntegrationLogRow from "@/components/monitor/IntegrationLogRow";
import ValidationChecklist from "@/components/monitor/ValidationChecklist";
import DealTestPanel from "@/components/monitor/DealTestPanel";
import WebhookSimulatePanel from "@/components/monitor/WebhookSimulatePanel";

// ── Stats Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "text-slate-800", bg = "bg-white" }) {
  return (
    <div className={`${bg} border border-slate-200 rounded-xl p-4`}>
      <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Filter className="w-4 h-4 text-slate-400" />
      <select
        value={filters.status}
        onChange={e => onChange({ ...filters, status: e.target.value })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">Todos os status</option>
        <option value="success">Sucesso</option>
        <option value="partial_success">Parcial</option>
        <option value="ignored">Ignorado</option>
        <option value="error">Erro</option>
      </select>
      <select
        value={filters.source}
        onChange={e => onChange({ ...filters, source: e.target.value })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">Todas as origens</option>
        <option value="webhook">Webhook</option>
        <option value="manual_sync">Sync Manual</option>
        <option value="diagnostic_test">Teste</option>
      </select>
      <select
        value={filters.event_type}
        onChange={e => onChange({ ...filters, event_type: e.target.value })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">Todos os eventos</option>
        <option value="change.deal">change.deal</option>
        <option value="change.activity">change.activity</option>
        <option value="create.activity">create.activity</option>
        <option value="manual_test">manual_test</option>
      </select>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="number"
          value={filters.deal_id}
          onChange={e => onChange({ ...filters, deal_id: e.target.value })}
          placeholder="Deal ID"
          className="pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-28 font-mono"
        />
      </div>
      {(filters.status || filters.source || filters.event_type || filters.deal_id) && (
        <button
          onClick={() => onChange({ status: "", source: "", event_type: "", deal_id: "" })}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "logs", label: "Logs de Execução", icon: Activity },
  { id: "validate", label: "Validação Pipedrive", icon: Shield },
  { id: "test_deal", label: "Testar por Deal ID", icon: Zap },
  { id: "simulate", label: "Simular Webhook", icon: TestTube2 },
];

export default function MonitorIntegracoes() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("logs");
  const [filters, setFilters] = useState({ status: "", source: "", event_type: "", deal_id: "" });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.IntegrationLog.list("-created_date", 100);
      setLogs(data || []);
    } catch (e) {
      // IntegrationLog pode ser nova entidade
      setLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleReprocess = async (log) => {
    try {
      await base44.functions.invoke("applyPipedriveRules", {
        project_id: log.project_id,
        deal_id: log.deal_id,
        source: "diagnostic_test",
        event_type: log.event_type || "reprocess",
        activity_id: log.activity_id,
      });
      await loadLogs();
    } catch (e) {
      alert("Erro ao reprocessar: " + e.message);
    }
  };

  // Filtrar logs
  const filteredLogs = logs.filter(l => {
    if (filters.status && l.status !== filters.status) return false;
    if (filters.source && l.source !== filters.source) return false;
    if (filters.event_type && l.event_type !== filters.event_type) return false;
    if (filters.deal_id && String(l.deal_id) !== String(filters.deal_id)) return false;
    return true;
  });

  // Stats
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === "success").length,
    error: logs.filter(l => l.status === "error").length,
    ignored: logs.filter(l => l.status === "ignored").length,
    partial: logs.filter(l => l.status === "partial_success").length,
  };
  const lastLog = logs[0];
  const lastError = logs.find(l => l.status === "error");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/parametrizacoes" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Monitor de Integrações
          </h1>
          <p className="text-slate-400 text-sm">Acompanhe, valide e audite todas as execuções Pipedrive → Cronograma</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total execuções" value={stats.total} />
        <StatCard label="Sucesso" value={stats.success} color="text-green-700" bg="bg-green-50" />
        <StatCard label="Parcial" value={stats.partial} color="text-yellow-700" bg="bg-yellow-50" />
        <StatCard label="Ignorados" value={stats.ignored} color="text-slate-600" />
        <StatCard label="Erros" value={stats.error} color="text-red-600" bg={stats.error > 0 ? "bg-red-50" : "bg-white"} />
        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-slate-500">Último evento</p>
          <p className="text-xs text-slate-700 mt-1 font-mono">{lastLog ? new Date(lastLog.created_date).toLocaleString("pt-BR") : "—"}</p>
          {lastError && <p className="text-xs text-red-500 mt-1 truncate">{lastError.errors ? JSON.parse(lastError.errors)?.[0] : "Erro"}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Logs */}
        {activeTab === "logs" && (
          <div className="space-y-3">
            <FilterBar filters={filters} onChange={setFilters} />
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <Clock className="w-8 h-8 opacity-30" />
                  <p className="text-sm">{logs.length === 0 ? "Nenhum log encontrado ainda" : "Nenhum log com estes filtros"}</p>
                  {logs.length === 0 && <p className="text-xs">Execute uma sincronização ou simule um webhook para gerar o primeiro log.</p>}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div
                    className="grid gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500"
                    style={{ gridTemplateColumns: "140px 80px 120px 80px 80px 1fr 90px 60px 60px 60px 28px" }}
                  >
                    <div>Data/Hora</div>
                    <div>Origem</div>
                    <div>Evento</div>
                    <div>Deal</div>
                    <div>Activity</div>
                    <div>Projeto</div>
                    <div>Status</div>
                    <div className="text-center">Regras</div>
                    <div className="text-center">Match</div>
                    <div className="text-center">Atualizadas</div>
                    <div></div>
                  </div>
                  {filteredLogs.map(log => (
                    <IntegrationLogRow key={log.id} log={log} onReprocess={handleReprocess} />
                  ))}
                  <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                    {filteredLogs.length} log(s) exibido(s) de {logs.length} total
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab: Validação */}
        {activeTab === "validate" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              Checklist de Validação da Integração
            </h3>
            <ValidationChecklist />
          </div>
        )}

        {/* Tab: Testar Deal */}
        {activeTab === "test_deal" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              Testar por Deal ID
            </h3>
            <DealTestPanel />
          </div>
        )}

        {/* Tab: Simular Webhook */}
        {activeTab === "simulate" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-purple-500" />
              Simular Webhook
            </h3>
            <WebhookSimulatePanel />
          </div>
        )}
      </div>
    </div>
  );
}