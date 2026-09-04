import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import ProjectCard from "@/components/dashboard/ProjectCard";
import DeleteProjectDialog from "@/components/project/DeleteProjectDialog";
import { FolderKanban, Plus, Search, LayoutGrid, List, X, User, Trash2, Filter, UserCog, UserCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import MultiSelectFilter from "@/components/project/MultiSelectFilter";
import { usePermissions } from "@/lib/usePermissions";

const STATUS_OPTIONS = ["Em aberto", "Em andamento", "Concluído", "Perdido", "Pausado"];

const normalize = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

export default function ProjectList() {
  const { user } = useAuth();
  const { canCreateProject, canDeleteProject } = usePermissions();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterManagers, setFilterManagers] = useState([]);
  const [filterAnalysts, setFilterAnalysts] = useState([]);
  const [myProjects, setMyProjects] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteProject, setDeleteProject] = useState(null);
  const [assignees, setAssignees] = useState({ managers: [], analysts: [] });

  const loadProjects = () => {
    base44.entities.Project.list("-created_date").then(p => {
      setAllProjects(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    base44.functions.invoke("getProjectAssignees")
      .then(res => setAssignees(res.data || { managers: [], analysts: [] }))
      .catch(() => setAssignees({ managers: [], analysts: [] }));
  }, []);

  useEffect(() => { loadProjects(); }, []);

  // Composite key: projects with _id group by "id:<id>" (shows real User full_name);
  // projects still in text-only transition group by "text:<name>".
  const managerKey = (p) => {
    if (p.pontotel_manager_id) return `id:${p.pontotel_manager_id}`;
    if (p.pontotel_manager_name) return `text:${p.pontotel_manager_name}`;
    return null;
  };
  const analystKey = (p) => {
    if (p.pontotel_analyst_id) return `id:${p.pontotel_analyst_id}`;
    if (p.pontotel_analyst_name) return `text:${p.pontotel_analyst_name}`;
    return null;
  };

  const managerLabel = (key) => {
    if (key?.startsWith("id:")) {
      const id = key.slice(3);
      const u = assignees.managers.find(m => m.id === id);
      return u?.full_name || id;
    }
    if (key?.startsWith("text:")) return key.slice(5);
    return key || "";
  };
  const analystLabel = (key) => {
    if (key?.startsWith("id:")) {
      const id = key.slice(3);
      const u = assignees.analysts.find(a => a.id === id);
      return u?.full_name || id;
    }
    if (key?.startsWith("text:")) return key.slice(5);
    return key || "";
  };

  const managerOptions = useMemo(() => {
    const keys = allProjects.map(managerKey).filter(Boolean);
    return [...new Set(keys)].sort();
  }, [allProjects]);

  const analystOptions = useMemo(() => {
    const keys = allProjects.map(analystKey).filter(Boolean);
    return [...new Set(keys)].sort();
  }, [allProjects]);

  const currentUserId = user?.id || "";
  const currentUserName = user?.full_name || user?.email || "";

  const filtered = useMemo(() => {
    return allProjects.filter(p => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search ||
        (p.name || "").toLowerCase().includes(searchLower) ||
        (p.id || "").toLowerCase().includes(searchLower);
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(p.status);
      const normUserName = normalize(currentUserName);
      const matchMy = !myProjects || (
        (p.pontotel_manager_id && p.pontotel_manager_id === currentUserId) ||
        (p.pontotel_analyst_id && p.pontotel_analyst_id === currentUserId) ||
        (!p.pontotel_manager_id && p.pontotel_manager_name && normalize(p.pontotel_manager_name) === normUserName) ||
        (!p.pontotel_analyst_id && p.pontotel_analyst_name && normalize(p.pontotel_analyst_name) === normUserName)
      );
      const matchManager = filterManagers.length === 0 || filterManagers.includes(managerKey(p));
      const matchAnalyst = filterAnalysts.length === 0 || filterAnalysts.includes(analystKey(p));
      return matchSearch && matchStatus && matchMy && matchManager && matchAnalyst;
    });
  }, [allProjects, search, filterStatus, myProjects, filterManagers, filterAnalysts, currentUserId, currentUserName]);

  const toggleMulti = (value, list, setList) => {
    setList(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  };

  const hasActiveFilters = filterStatus.length > 0 || filterManagers.length > 0 || filterAnalysts.length > 0 || !myProjects || search;

  const clearAll = () => {
    setSearch("");
    setFilterStatus([]);
    setFilterManagers([]);
    setFilterAnalysts([]);
    setMyProjects(false);
  };

  const handleDeleted = (projectId) => {
    setAllProjects(prev => prev.filter(p => p.id !== projectId));
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
        <div className="flex items-center gap-2">
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
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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

          <MultiSelectFilter
            label="Status"
            icon={Filter}
            options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
            selected={filterStatus}
            onChange={setFilterStatus}
            emptyValue="Todos"
            accentColor="blue"
          />

          {managerOptions.length > 0 && (
            <MultiSelectFilter
              label="Gerente"
              icon={UserCog}
              options={managerOptions.map(key => ({ value: key, label: managerLabel(key) }))}
              selected={filterManagers}
              onChange={setFilterManagers}
              accentColor="indigo"
            />
          )}

          {analystOptions.length > 0 && (
            <MultiSelectFilter
              label="Analista"
              icon={UserCheck}
              options={analystOptions.map(key => ({ value: key, label: analystLabel(key) }))}
              selected={filterAnalysts}
              onChange={setFilterAnalysts}
              accentColor="purple"
            />
          )}

          <button
            onClick={() => setMyProjects(m => !m)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
              myProjects ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Meus projetos
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors px-2 py-1 border border-slate-200 rounded-lg bg-white"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}

          <div className="ml-auto flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {(filterManagers.length > 0 || filterAnalysts.length > 0 || filterStatus.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-400">Filtros ativos:</span>
            {filterStatus.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                Status: {s}
                <button onClick={() => toggleMulti(s, filterStatus, setFilterStatus)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {filterManagers.map(k => (
              <span key={k} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                Gerente: {managerLabel(k)}
                <button onClick={() => toggleMulti(k, filterManagers, setFilterManagers)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {filterAnalysts.map(k => (
              <span key={k} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                Analista: {analystLabel(k)}
                <button onClick={() => toggleMulti(k, filterAnalysts, setFilterAnalysts)}><X className="w-3 h-3" /></button>
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

      {/* Empty */}
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
          {filtered.map(p => (
            <div key={p.id} className="relative group">
              <ProjectCard project={p} />
              {canDeleteProject && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteProject(p); }}
                  title="Excluir projeto"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-lg text-slate-400 hover:text-red-500 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
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
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Gerente do Projeto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Analista</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Início</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Previsão</th>
                  {canDeleteProject && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link to={`/projects/${p.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                          {p.name}
                        </Link>
                        {p.pipedrive_deal_id && (
                          <span title={`Deal Pipedrive #${p.pipedrive_deal_id}`}
                            className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded font-medium">
                            PD
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.client_name}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.pontotel_manager_name || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{p.pontotel_analyst_name || "—"}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(p.start_date) || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(p.aligned_end_date || p.planned_end_date) || "—"}</td>
                    {canDeleteProject && (
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setDeleteProject(p)}
                          title="Excluir projeto"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg text-slate-300 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {deleteProject && (
        <DeleteProjectDialog
          project={deleteProject}
          onClose={() => setDeleteProject(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}