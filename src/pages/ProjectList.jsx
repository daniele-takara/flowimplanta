import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import ProjectCard from "@/components/dashboard/ProjectCard";
import { FolderKanban, Plus, Search, LayoutGrid, List, X, User } from "lucide-react";
import { formatDate, formatCurrency, phaseColor } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { usePermissions } from "@/lib/usePermissions";

const STATUS_OPTIONS = ["Todos", "Planejamento", "Em andamento", "Em risco", "Atrasado", "Concluído", "Cancelado"];

export default function ProjectList() {
  const { user } = useAuth();
  const { canCreateProject } = usePermissions();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterManagers, setFilterManagers] = useState([]); // gerentes selecionados
  const [filterAnalysts, setFilterAnalysts] = useState([]); // analistas selecionados
  const [myProjects, setMyProjects] = useState(true); // filtro padrão "Meus projetos"
  const [viewMode, setViewMode] = useState("grid");
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Project.list("-created_date").then(p => {
      setAllProjects(p);
      setLoading(false);
    });
  }, []);

  // Listas únicas de gerentes e analistas
  const managerOptions = useMemo(() => {
    const names = allProjects.map(p => p.pontotel_manager_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [allProjects]);

  const analystOptions = useMemo(() => {
    const names = allProjects.map(p => p.pontotel_analyst_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [allProjects]);

  const currentUserName = user?.full_name || user?.email || "";

  const filtered = useMemo(() => {
    return allProjects.filter(p => {
      // Busca por nome ou id
      const searchLower = search.toLowerCase();
      const matchSearch = !search ||
        (p.name || "").toLowerCase().includes(searchLower) ||
        (p.id || "").toLowerCase().includes(searchLower);

      // Status
      const matchStatus = filterStatus === "Todos" || p.status === filterStatus;

      // Meus projetos: gerente OU analista é o usuário logado
      const matchMy = !myProjects || (
        (p.pontotel_manager_name && p.pontotel_manager_name === currentUserName) ||
        (p.pontotel_analyst_name && p.pontotel_analyst_name === currentUserName)
      );

      // Filtro de gerente (multi)
      const matchManager = filterManagers.length === 0 ||
        filterManagers.includes(p.pontotel_manager_name);

      // Filtro de analista (multi)
      const matchAnalyst = filterAnalysts.length === 0 ||
        filterAnalysts.includes(p.pontotel_analyst_name);

      return matchSearch && matchStatus && matchMy && matchManager && matchAnalyst;
    });
  }, [allProjects, search, filterStatus, myProjects, filterManagers, filterAnalysts, currentUserName]);

  const toggleMulti = (value, list, setList) => {
    setList(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  };

  const hasActiveFilters = filterStatus !== "Todos" || filterManagers.length > 0 || filterAnalysts.length > 0 || !myProjects || search;

  const clearAll = () => {
    setSearch("");
    setFilterStatus("Todos");
    setFilterManagers([]);
    setFilterAnalysts([]);
    setMyProjects(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <FolderKanban className="w-4 h-4" />
            <span>Projetos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Todos os Projetos</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} de {allProjects.length} projetos</p>
        </div>
        {canCreateProject && (
          <Link
            to="/projects/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        )}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm space-y-3">
        {/* Row 1: busca + meus projetos + view toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou ID do projeto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Meus projetos toggle */}
          <button
            onClick={() => setMyProjects(m => !m)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              myProjects ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Meus projetos
          </button>

          {/* Limpar filtros */}
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1 border border-slate-200 rounded-lg bg-white"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
            <button
              onClick={() => setViewMode("grid")}
              title="Cards"
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="Lista"
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Row 2: filtro de status */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Row 3: filtros por gerente e analista */}
        <div className="flex items-start gap-6 flex-wrap">
          {managerOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Gerente do projeto</p>
              <div className="flex flex-wrap gap-1.5">
                {managerOptions.map(name => (
                  <button
                    key={name}
                    onClick={() => toggleMulti(name, filterManagers, setFilterManagers)}
                    className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                      filterManagers.includes(name)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {analystOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Analista de implantação</p>
              <div className="flex flex-wrap gap-1.5">
                {analystOptions.map(name => (
                  <button
                    key={name}
                    onClick={() => toggleMulti(name, filterAnalysts, setFilterAnalysts)}
                    className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                      filterAnalysts.includes(name)
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filtros ativos */}
        {(filterManagers.length > 0 || filterAnalysts.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-400">Filtros ativos:</span>
            {filterManagers.map(n => (
              <span key={n} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                Gerente: {n}
                <button onClick={() => toggleMulti(n, filterManagers, setFilterManagers)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {filterAnalysts.map(n => (
              <span key={n} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                Analista: {n}
                <button onClick={() => toggleMulti(n, filterAnalysts, setFilterAnalysts)}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-7 h-7 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum projeto encontrado</p>
          <p className="text-xs mt-1">Ajuste os filtros ou limpe a busca</p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && viewMode === "list" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Nome do Projeto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Gerente do Projeto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Analista de Implantação</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Data de Início</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Previsão de Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link to={`/projects/${p.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono text-slate-400">{p.id?.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.client_name}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.pontotel_manager_name || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.pontotel_analyst_name || "—"}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(p.start_date) || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(p.aligned_end_date || p.planned_end_date) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}