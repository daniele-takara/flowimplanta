import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Monitor, Users, Activity, Clock, RefreshCw, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

function MetricCard({ iconEl, label, value, sub, color, alertMode }) {
  const bg = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", purple: "bg-purple-50 text-purple-600", orange: "bg-orange-50 text-orange-600", slate: "bg-slate-50 text-slate-500" };
  return (
    <div className={`p-4 rounded-xl border ${alertMode ? "border-orange-200 bg-orange-50" : "bg-white border-slate-100"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg[color] || bg.blue}`}>{iconEl}</div>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        {alertMode && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 ml-auto" />}
      </div>
      <p className={`text-2xl font-bold ${alertMode ? "text-orange-700" : "text-slate-800"}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function PercentBar({ label, value, total, barColor }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const cls = { blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", red: "bg-red-500" };
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{pct}% <span className="text-slate-400 font-normal">({(value||0).toLocaleString()} / {(total||0).toLocaleString()})</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cls[barColor] || cls.blue}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtDate(str) {
  if (!str) return "—";
  try { const d = new Date(str); return isNaN(d) ? str : d.toLocaleDateString("pt-BR"); } catch { return str; }
}

function daysSince(str) {
  if (!str) return null;
  try { const d = new Date(str); return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000); } catch { return null; }
}

export default function UsabilitySection({ projectId, clientName }) {
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadCached = async () => {
    try {
      const rows = await base44.entities.ClientUsability.filter({ project_id: projectId });
      if (rows.length > 0) setData(rows[0]);
    } catch (_) {}
  };

  const syncSheets = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getClientUsability", { project_id: projectId, client_name: clientName });
      if (res.data?.data) { setData(res.data.data); await loadCached(); }
      else setError("Nenhum dado encontrado para este cliente na planilha.");
    } catch (_) { setError("Erro ao sincronizar com a planilha."); }
    setSyncing(false);
  };

  useEffect(() => { loadCached(); }, [projectId]);

  const pctAtivos = data?.numero_funcionarios > 0 ? Math.round((data.numero_funcionarios_ativos / data.numero_funcionarios) * 100) : 0;
  const pctPonto  = data?.numero_funcionarios_ativos > 0 ? Math.round((data.empregados_batendo_ponto_ultimos_15_dias / data.numero_funcionarios_ativos) * 100) : 0;
  const dias = daysSince(data?.data_ultimo_acesso);
  const baixoAcesso = dias !== null && dias > 7;
  const baixaAdocao = pctPonto < 60 && data !== null;

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">Usabilidade / Adoção do Cliente</h3>
          {data?.last_synced_at && <span className="text-xs text-slate-400">· Sincronizado em {fmtDate(data.last_synced_at)}</span>}
        </div>
        <button onClick={syncSheets} disabled={syncing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Planilha"}
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{error}</div>}

      {!data && !error && (
        <div className="text-center py-8 text-slate-400">
          <Monitor className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum dado de usabilidade sincronizado ainda.</p>
          <button onClick={syncSheets} disabled={syncing} className="mt-2 text-sm text-blue-600 hover:underline">
            {syncing ? "Sincronizando..." : "Clique para buscar dados da planilha"}
          </button>
        </div>
      )}

      {data && (
        <>
          {(baixoAcesso || baixaAdocao) && (
            <div className="mb-4 space-y-2">
              {baixoAcesso && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                  <TrendingDown className="w-4 h-4 shrink-0" />
                  <span>Último acesso há <strong>{dias} dias</strong> — sinalização de baixa usabilidade da plataforma.</span>
                </div>
              )}
              {baixaAdocao && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Apenas <strong>{pctPonto}%</strong> dos ativos bateram ponto nos últimos 15 dias — baixa adoção detectada.</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            <MetricCard iconEl={<Users className="w-4 h-4" />} label="Total de Funcionários" value={(data.numero_funcionarios||0).toLocaleString()} color="blue" />
            <MetricCard iconEl={<CheckCircle2 className="w-4 h-4" />} label="Funcionários Ativos" value={(data.numero_funcionarios_ativos||0).toLocaleString()} sub={`${pctAtivos}% do total`} color="green" />
            <MetricCard iconEl={<Activity className="w-4 h-4" />} label="Batendo Ponto (15d)" value={(data.empregados_batendo_ponto_ultimos_15_dias||0).toLocaleString()} sub={`${pctPonto}% dos ativos`} color={baixaAdocao ? "orange" : "purple"} alertMode={baixaAdocao} />
            <MetricCard iconEl={<Clock className="w-4 h-4" />} label="Último Acesso" value={dias !== null ? `${dias}d atrás` : "—"} sub={data.email_ultimo_acesso || ""} color={baixoAcesso ? "orange" : "slate"} alertMode={baixoAcesso} />
          </div>

          <div className="bg-white border border-slate-100 rounded-xl p-4 mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Indicadores de Adoção</h4>
            <PercentBar label="Funcionários Ativos / Total" value={data.numero_funcionarios_ativos} total={data.numero_funcionarios} barColor={pctAtivos >= 80 ? "green" : "orange"} />
            <PercentBar label="Batendo Ponto (15d) / Ativos" value={data.empregados_batendo_ponto_ultimos_15_dias} total={data.numero_funcionarios_ativos} barColor={pctPonto >= 60 ? "green" : "red"} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div className="bg-white border border-slate-100 rounded-xl p-3">
              <p className="font-medium text-slate-600 mb-1">Detalhes da Base</p>
              <p>Criação: <span className="text-slate-700">{fmtDate(data.data_criacao)}</span></p>
              <p>Regras de cálculo: <span className="text-slate-700">{data.numero_regras_de_calculo || "—"}</span></p>
              {data.nome && <p>Empresa: <span className="text-slate-700">{data.nome}</span></p>}
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3">
              <p className="font-medium text-slate-600 mb-1">Último Acesso</p>
              <p>Data: <span className="text-slate-700">{fmtDate(data.data_ultimo_acesso)}</span></p>
              <p>Usuário: <span className="text-slate-700">{data.email_ultimo_acesso || "—"}</span></p>
              <p>Exportação: <span className="text-slate-700">{fmtDate(data.data_exportacao)}</span></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}