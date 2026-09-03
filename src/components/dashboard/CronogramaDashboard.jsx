import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarClock, CalendarX, CalendarDays, Filter } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import MultiSelectFilter from "@/components/project/MultiSelectFilter";
import { computeCurrentStage } from "@/lib/computeCurrentStage";

const CATEGORIES = [
  {
    key: "sem_cronograma",
    label: "Sem cronograma planejado",
    color: "#ef4444",
    icon: CalendarX,
    description: "Nenhuma atividade de cronograma criada no projeto",
  },
  {
    key: "atrasado",
    label: "Cronograma em atraso",
    color: "#f59e0b",
    icon: CalendarClock,
    description: "Há atividades atrasadas ou com data planejada no passado não concluídas",
  },
  {
    key: "sem_atualizacao",
    label: "Sem atualização de cronograma",
    color: "#6366f1",
    icon: CalendarDays,
    description: "Cronograma planejado, mas sem nenhum avanço de execução registrado",
  },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

/**
 * Classifica um projeto em uma das três categorias de saúde do cronograma.
 * Prioridade: sem_cronograma > atrasado > sem_atualizacao > em_dia (não exibido no gráfico).
 */
function classifySchedule(project, allActivities) {
  const projActs = allActivities.filter(a => a.project_id === project.id);
  if (projActs.length === 0) return "sem_cronograma";

  const today = new Date().toISOString().split("T")[0];
  const hasDelay = projActs.some(a =>
    a.status === "Atrasado" ||
    a.status === "Bloqueado" ||
    (a.planned_end && a.planned_end < today && a.status !== "Concluído")
  );
  if (hasDelay) return "atrasado";

  const hasUpdate = projActs.some(a =>
    !!a.actual_start || !!a.actual_end ||
    a.status === "Em andamento" || a.status === "Concluído"
  );
  if (!hasUpdate) return "sem_atualizacao";

  return "em_dia";
}

export default function CronogramaDashboard({ projects, inProgressActivities }) {
  const [allActivities, setAllActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterManager, setFilterManager] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterCategory, setFilterCategory] = useState("Todos");

  const managers = useMemo(
    () => ["Todos", ...new Set(projects.map(p => p.pontotel_manager_name).filter(Boolean))],
    [projects]
  );
  const statusOptions = [
    { value: "Ativos", label: "Ativos (Em aberto + Em andamento)" },
    { value: "Em aberto", label: "Em aberto" },
    { value: "Em andamento", label: "Em andamento" },
    { value: "Concluído", label: "Concluído" },
    { value: "Perdido", label: "Perdido" },
    { value: "Pausado", label: "Pausado" },
  ];

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchStatus = filterStatus.length === 0 ||
        filterStatus.some(s => s === "Ativos" ? ["Em andamento", "Em aberto"].includes(p.status) : p.status === s);
      const matchManager = filterManager === "Todos" || p.pontotel_manager_name === filterManager;
      return matchStatus && matchManager;
    });
  }, [projects, filterStatus, filterManager]);

  // Busca atividades apenas dos projetos filtrados (sem limite global de 500)
  useEffect(() => {
    if (filteredProjects.length === 0) {
      setAllActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const projectIds = filteredProjects.map(p => p.id);
    Promise.all(
      projectIds.map(id =>
        base44.entities.ScheduleActivity.filter({ project_id: id }).catch(() => [])
      )
    )
      .then(results => setAllActivities(results.flat()))
      .catch(() => setAllActivities([]))
      .finally(() => setLoading(false));
  }, [filteredProjects]);

  // Classifica cada projeto filtrado
  const classified = useMemo(
    () => filteredProjects.map(p => ({
      project: p,
      category: classifySchedule(p, allActivities),
    })),
    [filteredProjects, allActivities]
  );

  // Dados do gráfico (3 categorias)
  const chartData = useMemo(() => {
    const counts = { sem_cronograma: 0, atrasado: 0, sem_atualizacao: 0 };
    classified.forEach(({ category }) => {
      if (counts[category] !== undefined) counts[category]++;
    });
    return CATEGORIES.map(c => ({ name: c.label, key: c.key, value: counts[c.key], color: c.color }));
  }, [classified]);

  const totalAlertas = chartData.reduce((acc, d) => acc + d.value, 0);

  // Lista de projetos conforme filtro de categoria
  const listProjects = useMemo(() => {
    if (filterCategory === "Todos") return classified;
    return classified.filter(c => c.category === filterCategory);
  }, [classified, filterCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Gerente</label>
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {managers.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Status</label>
          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selected={filterStatus}
            onChange={setFilterStatus}
            accentColor="blue"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Categoria</label>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Todos">Todas</option>
            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Gráfico + Cards de legenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Saúde do Cronograma</h3>
          <p className="text-xs text-slate-400 mb-4">
            {filterManager === "Todos" ? "Todo o time" : filterManager} · {filteredProjects.length} projetos
          </p>
          {totalAlertas === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <CalendarClock className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum alerta de cronograma</p>
              <p className="text-xs mt-1">Todos os projetos filtrados estão em dia</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={2}
                  onClick={(entry) => setFilterCategory(entry.key)}
                >
                  {chartData.map(entry => (
                    <Cell key={entry.key} fill={entry.color} className="cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} projeto(s)`, name]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {CATEGORIES.map(cat => {
            const count = chartData.find(d => d.key === cat.key)?.value || 0;
            const Icon = cat.icon;
            const active = filterCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setFilterCategory(active ? "Todos" : cat.key)}
                className={`text-left bg-white rounded-xl border p-4 transition-all hover:shadow-sm ${
                  active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + "15" }}>
                    <Icon className="w-5 h-5" style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">{cat.label}</p>
                      <span className="text-2xl font-bold" style={{ color: cat.color }}>{count}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{cat.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela de projetos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Projetos {filterCategory === "Todos" ? "" : `— ${CATEGORY_MAP[filterCategory]?.label}`}
          </h3>
          <span className="text-xs text-slate-400">{listProjects.length} projeto(s)</span>
        </div>
        {listProjects.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Nenhum projeto nesta categoria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-2.5">Projeto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Etapa atual</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Gerente</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {listProjects.map(({ project, category }) => {
                  const { stage } = computeCurrentStage(project, inProgressActivities);
                  const cat = CATEGORY_MAP[category];
                  return (
                    <tr key={project.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link to={`/projects/${project.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">
                          {project.name}
                        </Link>
                        <p className="text-xs text-slate-400">{project.client_name}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{stage}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{project.pontotel_manager_name || "—"}</td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span
                            className="text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: cat.color + "15", color: cat.color }}
                          >
                            {cat.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Em dia</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}