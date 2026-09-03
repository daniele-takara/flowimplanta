import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatsCard from "@/components/dashboard/StatsCard";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatDate, formatCurrency, phaseColor } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, CheckCircle2, Plus,
  TrendingUp, Users, ChevronRight, Filter, Briefcase, Activity, Pause
} from "lucide-react";
import CarteiraIndividual from "@/pages/CarteiraIndividual";
import ClosingSoonTable from "@/components/carteira/ClosingSoonTable";
import CronogramaDashboard from "@/components/dashboard/CronogramaDashboard";
import { CalendarClock } from "lucide-react";

export default function Dashboard() {
  const [view, setView] = useState("portfolio");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterManager, setFilterManager] = useState("Todos");
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Project.list("-created_date"),
      base44.entities.ScheduleActivity.filter({ status: "Em andamento" }),
    ]).then(([projs, acts]) => {
      setProjects(projs);
      setActivities(acts);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = {
    total: projects.length,
    ativos: projects.filter(p => ["Em andamento", "Em aberto"].includes(p.status)).length,
    completed: projects.filter(p => p.status === "Concluído").length,
    paused: projects.filter(p => p.status === "Pausado").length,
    totalMRR: projects.reduce((acc, p) => acc + (p.mrr || 0), 0),
    totalEmployees: projects.reduce((acc, p) => acc + (p.contracted_employees || 0), 0)
  };

  const managers = ["Todos", ...new Set(projects.map(p => p.pontotel_manager_name).filter(Boolean))];
  const statuses = ["Todos", "Ativos", "Em aberto", "Em andamento", "Concluído", "Perdido", "Pausado"];

  const filtered = projects.filter(p => {
    const matchStatus = filterStatus === "Todos" ||
      (filterStatus === "Ativos" ? ["Em andamento", "Em aberto"].includes(p.status) : p.status === filterStatus);
    const matchManager = filterManager === "Todos" || p.pontotel_manager_name === filterManager;
    return matchStatus && matchManager;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {view === "portfolio" ? "Portfólio de Implantações" : view === "carteira" ? "Carteira Individual" : "Saúde dos Cronogramas"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {view === "portfolio" ? "Visão consolidada de todos os projetos" : view === "carteira" ? "Gestão segmentada por colaborador" : "Acompanhamento de cronogramas do time"}
          </p>
        </div>
        {view === "portfolio" && (
          <Link
            to="/projects/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        )}
      </div>

      {/* Layout com menu lateral interno */}
      <div className="flex gap-6">
        <aside className="w-56 shrink-0">
          <nav className="bg-white rounded-xl border border-slate-200 p-2 space-y-1 sticky top-4">
            <button
              onClick={() => setView("portfolio")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                view === "portfolio"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 border-transparent"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="text-left">Portfólio de Implantações</span>
            </button>
            <button
              onClick={() => setView("carteira")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                view === "carteira"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 border-transparent"
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="text-left">Carteira Individual</span>
            </button>
            <button
              onClick={() => setView("cronograma")}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                view === "cronograma"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 border-transparent"
              }`}
            >
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span className="text-left">Cronogramas</span>
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {view === "portfolio" && (
            <>
              {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total de Projetos" value={stats.total} icon={FolderKanban} color="blue" subtitle={`${formatCurrency(stats.totalMRR)} MRR total`} onClick={() => setFilterStatus("Todos")} active={filterStatus === "Todos"} />
        <StatsCard title="Ativos" value={stats.ativos} icon={Activity} color="purple" subtitle={`${Math.round(stats.ativos / stats.total * 100)}% do portfólio`} onClick={() => setFilterStatus("Ativos")} active={filterStatus === "Ativos"} />
        <StatsCard title="Pausados" value={stats.paused} icon={Pause} color="orange" subtitle="Projetos pausados" onClick={() => setFilterStatus("Pausado")} active={filterStatus === "Pausado"} />
        <StatsCard title="Concluídos" value={stats.completed} icon={CheckCircle2} color="green" subtitle="No período atual" onClick={() => setFilterStatus("Concluído")} active={filterStatus === "Concluído"} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Funcionários no Portfólio</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.totalEmployees.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Contratados em todos os projetos ativos</p>
          <div className="mt-4 space-y-2">
            {projects.filter(p => p.status !== "Concluído").slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate max-w-[140px]">{p.client_name}</span>
                <span className="text-slate-500">{p.contracted_employees?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Progresso Médio do Portfólio</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {Math.round(projects.reduce((acc, p) => acc + (p.progress_percent || 0), 0) / projects.length)}%
          </p>
          <p className="text-xs text-slate-400 mt-1">Média de progresso de todos os projetos</p>
          <div className="mt-4 space-y-2.5">
            {projects.filter(p => p.status !== "Concluído").slice(0, 3).map(p => (
              <div key={p.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate max-w-[140px]">{p.client_name}</span>
                  <span className="text-slate-500">{p.progress_percent}%</span>
                </div>
                <ProgressBar value={p.progress_percent} showLabel={false} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Próximos de Encerramento — projetos a 30 dias ou menos do encerramento */}
      <div className="mb-8">
        <ClosingSoonTable projects={projects} activities={activities} />
      </div>

      {/* Filters + Project list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-800">Projetos</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <select
              value={filterManager}
              onChange={e => setFilterManager(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {managers.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Table view */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Projeto</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Fase</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Progresso</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Prazo</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Gerente</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">MRR</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-xs text-slate-400">{p.client_name}</p>
                      <p className="text-sm font-medium text-slate-800 max-w-[200px] truncate">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor(p.current_phase)}`}>
                      {p.current_phase}
                    </span>
                  </td>
                  <td className="px-4 py-4 min-w-[120px]">
                    <ProgressBar value={p.progress_percent} size="sm" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{formatDate(p.planned_end_date)}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{p.pontotel_manager_name}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{formatCurrency(p.mrr)}</td>
                  <td className="px-4 py-4">
                    <Link to={`/projects/${p.id}`} className="text-blue-600 hover:text-blue-700">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
            </div>
          </>
          )}
          {view === "carteira" && <CarteiraIndividual />}
          {view === "cronograma" && <CronogramaDashboard projects={projects} inProgressActivities={activities} />}
        </div>
      </div>
    </div>
  );
}