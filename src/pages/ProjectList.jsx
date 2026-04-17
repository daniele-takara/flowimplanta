import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProjectCard from "@/components/dashboard/ProjectCard";
import { FolderKanban, Plus, Search, LayoutGrid, List } from "lucide-react";
import { formatDate, formatCurrency, phaseColor } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";

export default function ProjectList() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [viewMode, setViewMode] = useState("grid");
  const [allProjects, setAllProjects] = useState([]);

  useEffect(() => {
    base44.entities.Project.list("-created_date").then(setAllProjects);
  }, []);

  const filtered = allProjects.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "Todos" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <FolderKanban className="w-4 h-4" />
            <span>Projetos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Todos os Projetos</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} projetos encontrados</p>
        </div>
        <Link
          to="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por projeto ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {["Todos", "Em andamento", "Em risco", "Atrasado", "Concluído", "Planejamento"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {s}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-slate-100" : "hover:bg-slate-50"}`}>
            <LayoutGrid className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "bg-slate-100" : "hover:bg-slate-50"}`}>
            <List className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Projeto / Cliente</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Fase</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 min-w-[120px]">Progresso</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Prazo</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">MRR</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Gerente</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link to={`/projects/${p.id}`} className="hover:text-blue-600">
                      <p className="text-xs text-slate-400">{p.client_name}</p>
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor(p.current_phase)}`}>{p.current_phase}</span>
                  </td>
                  <td className="px-4 py-4"><ProgressBar value={p.progress_percent} size="sm" /></td>
                  <td className="px-4 py-4 text-sm text-slate-600">{formatDate(p.planned_end_date)}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{formatCurrency(p.mrr)}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{p.pontotel_manager_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}