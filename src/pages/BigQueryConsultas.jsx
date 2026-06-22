import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Database, Loader2, Users, Clock, Calendar, TrendingUp, Activity, Building, Hash, MapPin, DollarSign } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

const METRICS = [
  { key: "empregados_cadastrados", label: "Empregados Cadastrados", icon: Users },
  { key: "empregados_ativos", label: "Empregados Ativos", icon: Activity },
  { key: "empregados_batendo_30d", label: "Batendo Ponto (30d)", icon: Clock },
  { key: "pontos_batidos_30d", label: "Pontos Batidos (30d)", icon: Hash },
  { key: "taxa_adesao_ponto", label: "Taxa de Adesão", icon: TrendingUp, format: v => v ? `${parseFloat(v).toFixed(1)}%` : "—" },
  { key: "regras_de_calculo", label: "Regras de Cálculo", icon: Activity },
  { key: "escalas_cadastradas", label: "Escalas", icon: Calendar },
  { key: "qtd_usuarios", label: "Total Usuários", icon: Users },
  { key: "qtd_usuarios_rh", label: "Usuários RH", icon: Users },
  { key: "qtd_lideres", label: "Líderes", icon: Users },
  { key: "qtd_empregadores", label: "Empregadores", icon: Building },
  { key: "qtd_locais", label: "Locais", icon: Building },
  { key: "qtd_departamentos", label: "Departamentos", icon: Building },
  { key: "qtd_funcoes", label: "Funções", icon: Building },
  { key: "dispositivos_cadastrados", label: "Dispositivos", icon: Activity },
  { key: "admissoes_90d", label: "Admissões (90d)", icon: TrendingUp },
  { key: "demissoes_90d", label: "Demissões (90d)", icon: TrendingUp },
  { key: "taxa_turnover_90d", label: "Turnover (90d)", icon: TrendingUp, format: v => v ? `${parseFloat(v).toFixed(1)}%` : "—" },
  { key: "ferias_vencendo_30d", label: "Férias Vencendo (30d)", icon: Calendar },
  { key: "folga_trabalhada_30d", label: "Folga Trabalhada (30d)", icon: Calendar },
  { key: "trabalho_remoto_30d", label: "Trabalho Remoto (30d)", icon: Activity },
  { key: "solicitacoes_90d", label: "Solicitações (90d)", icon: Activity },
  { key: "afd_erros_30d", label: "Erros AFD (30d)", icon: Activity },
  { key: "notificacao_ativa", label: "Notificação Ativa", icon: Activity, format: v => v === "true" || v === true ? "Sim" : v === "false" || v === false ? "Não" : "—" },
  { key: "regra_aprovacao_ativa", label: "Regra Aprovação", icon: Activity, format: v => v === "true" || v === true ? "Sim" : v === "false" || v === false ? "Não" : "—" },
  { key: "regra_travamento_ativa", label: "Regra Travamento", icon: Activity, format: v => v === "true" || v === true ? "Sim" : v === "false" || v === false ? "Não" : "—" },
];

const formatCurrency = (centavos) => {
  if (!centavos) return "—";
  const reais = parseInt(centavos) / 100;
  return `R$ ${reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function BigQueryConsultas() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) {
      setError("Informe o ID da empresa (code ou comp_man_id)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("queryBigQueryUsage", { code: searchId.trim(), limite: 1 });
      if (res?.data?.success) {
        setResult(res.data);
      } else {
        setError(res?.data?.error || "Erro na consulta");
        setResult(null);
      }
    } catch (err) {
      setError(err?.message || "Erro de conexão");
      setResult(null);
    }
    setLoading(false);
  };

  const record = result?.usageData?.rows?.[0];
  const client = result?.clientData;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Consultas BigQuery</h1>
          <p className="text-sm text-slate-500">Dados de uso do produto — pontotel-homepage.customer_intelligence.fct_uso_produto</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="flex-1 max-w-md">
          <input
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            placeholder="Code da empresa ou comp_man_id"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Consultar
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Dados do Cliente */}
      {client && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{client.nome || "—"}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
                {client.cidade && client.estado && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {client.cidade}, {client.estado}
                  </span>
                )}
                {client.vertical && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium capitalize">
                    {client.vertical}
                  </span>
                )}
                {client.cliente_ativo === "true" && (
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    Ativo
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-xs text-slate-400">Funcionários (baseline)</p>
                <p className="font-semibold text-slate-700">{client.funcionarios_baseline_contratado || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">MRR Mínimo</p>
                <p className="font-semibold text-slate-700">{formatCurrency(client.mrr_minimo_centavos)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">MRR Total</p>
                <p className="font-semibold text-slate-700">{formatCurrency(client.mrr_total_centavos)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Métricas de Uso */}
      {record && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <Hash className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              <span className="text-xs text-slate-400 font-medium">comp_man_id</span>
              <p className="text-sm font-mono text-slate-600">{result.resolvedCompManId}</p>
            </div>
            {record.snapshot_at_formatted && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                Snapshot: {record.snapshot_at_formatted}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {METRICS.map(m => {
              const Icon = m.icon;
              const raw = record[m.key];
              const display = m.format ? m.format(raw) : (raw != null ? String(raw) : "—");
              return (
                <div key={m.key} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-400 truncate">{m.label}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-700">{display}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && !record && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Nenhum resultado encontrado para este ID.
        </div>
      )}

      {!result && !loading && !error && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-12 text-center">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Informe o ID da empresa (code ou comp_man_id) para consultar os dados de uso do produto.</p>
        </div>
      )}
    </div>
  );
}