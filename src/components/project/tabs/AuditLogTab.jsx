import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Clock, FileText, User, ArrowUpDown, Search } from "lucide-react";

export default function AuditLogTab({ projectId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("created_date");
  const [sortDir, setSortDir] = useState(-1);
  const [filterScreen, setFilterScreen] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const items = await base44.entities.AuditLog.filter(
      { project_id: projectId },
      "-created_date",
      200
    );
    setLogs(items || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev * -1);
    } else {
      setSortField(field);
      setSortDir(-1);
    }
  };

  const screens = [...new Set(logs.map(l => l.screen).filter(Boolean))].sort();

  const filtered = logs
    .filter(l => {
      if (filterScreen && l.screen !== filterScreen) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.field || "").toLowerCase().includes(q) ||
          (l.screen || "").toLowerCase().includes(q) ||
          (l.user_email || "").toLowerCase().includes(q) ||
          (l.new_value || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const va = a[sortField] || "";
      const vb = b[sortField] || "";
      return va < vb ? -1 * sortDir : va > vb ? 1 * sortDir : 0;
    });

  const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Histórico de Alterações</h2>
          <span className="text-xs text-slate-400">({filtered.length} registros)</span>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por campo, tela, usuário..."
          />
        </div>
        <select
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600"
          value={filterScreen}
          onChange={e => setFilterScreen(e.target.value)}
        >
          <option value="">Todas as telas</option>
          {screens.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          {logs.length === 0
            ? "Nenhum registro de alteração encontrado para este projeto."
            : "Nenhum resultado para os filtros aplicados."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th
                  className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("created_date")}
                >
                  <span className="inline-flex items-center gap-1">
                    Data/Hora
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("screen")}
                >
                  <span className="inline-flex items-center gap-1">
                    Tela
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("field")}
                >
                  <span className="inline-flex items-center gap-1">
                    Campo
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Valor Anterior</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Novo Valor</th>
                <th
                  className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("user_email")}
                >
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Usuário
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr
                  key={log.id}
                  className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {fmtDate(log.created_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[11px]">
                      <FileText className="w-3 h-3" />
                      {log.screen}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {log.field}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">
                    {log.old_value || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">
                    {log.new_value || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {log.user_email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}