import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Briefcase } from "lucide-react";
import RoleSelector from "@/components/carteira/RoleSelector";
import SummaryCards from "@/components/carteira/SummaryCards";
import StageDistribution from "@/components/carteira/StageDistribution";
import ClosingSoonTable from "@/components/carteira/ClosingSoonTable";
import AllProjectsTable from "@/components/carteira/AllProjectsTable";
import { computeCurrentStage } from "@/lib/computeCurrentStage";

export default function CarteiraIndividual() {
  const [role, setRole] = useState("manager");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [assignees, setAssignees] = useState({ managers: [], analysts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Project.list("-created_date"),
      base44.entities.ScheduleActivity.filter({ status: "Em andamento" }),
      base44.functions.invoke("getProjectAssignees"),
    ]).then(([projs, acts, res]) => {
      setProjects(projs);
      setActivities(acts);
      setAssignees(res.data || { managers: [], analysts: [] });
      setLoading(false);
    });
  }, []);

  const idField = role === "manager" ? "pontotel_manager_id" : "pontotel_analyst_id";
  const nameField = role === "manager" ? "pontotel_manager_name" : "pontotel_analyst_name";
  const people = role === "manager" ? assignees.managers : assignees.analysts;

  // Pessoas com contagem de projetos
  const peopleWithCounts = useMemo(() =>
    people.map(p => ({
      ...p,
      count: projects.filter(proj => proj[idField] === p.id).length,
    })).filter(p => p.count > 0),
    [people, projects, idField]
  );

  // Projetos sem responsável vinculado
  const unassignedProjects = useMemo(() =>
    projects.filter(p => !p[idField]),
    [projects, idField]
  );
  const unassignedWithName = useMemo(() =>
    unassignedProjects.filter(p => p[nameField]),
    [unassignedProjects, nameField]
  );

  // Projetos filtrados pela pessoa selecionada
  const filteredProjects = useMemo(() => {
    if (!selectedPerson) return [];
    if (selectedPerson === "unassigned") return unassignedProjects;
    return projects.filter(p => p[idField] === selectedPerson);
  }, [selectedPerson, projects, idField, unassignedProjects]);

  // Projetos filtrados por status (para tabelas e gráficos)
  const statusFilteredProjects = useMemo(() => {
    if (statusFilter === "all") return filteredProjects;
    if (statusFilter === "ativos") return filteredProjects.filter(p => ["Em andamento", "Em aberto"].includes(p.status));
    return filteredProjects.filter(p => p.status === statusFilter);
  }, [filteredProjects, statusFilter]);

  // Distribuição por etapa
  const stageCounts = useMemo(() => {
    const counts = {};
    statusFilteredProjects.forEach(p => {
      const { stage } = computeCurrentStage(p, activities);
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return counts;
  }, [statusFilteredProjects, activities]);

  const selectedPersonName = useMemo(() => {
    if (!selectedPerson) return null;
    if (selectedPerson === "unassigned") return "Sem responsável vinculado";
    return people.find(p => p.id === selectedPerson)?.full_name || "—";
  }, [selectedPerson, people]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Seletor de papel + chips de pessoas */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <RoleSelector
          role={role}
          setRole={setRole}
          people={peopleWithCounts}
          unassignedCount={unassignedProjects.length}
          unassignedWithNameCount={unassignedWithName.length}
          selectedPerson={selectedPerson}
          onSelectPerson={setSelectedPerson}
        />
      </div>

      {/* Conteúdo da pessoa selecionada */}
      {!selectedPerson ? (
        <div className="text-center py-16 text-slate-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma pessoa para ver sua carteira</p>
          <p className="text-xs mt-1">Clique num chip acima para filtrar os projetos</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{selectedPersonName}</h2>

          {/* Cards de resumo */}
          <div className="mb-6">
            <SummaryCards projects={filteredProjects} onFilter={setStatusFilter} activeFilter={statusFilter} />
          </div>

          {/* Gráfico de distribuição por etapa */}
          <div className="mb-6">
            <StageDistribution stageCounts={stageCounts} />
          </div>

          {/* Próximos de encerramento */}
          <div className="mb-6">
            <ClosingSoonTable projects={statusFilteredProjects} activities={activities} />
          </div>

          {/* Todos os projetos */}
          <AllProjectsTable projects={statusFilteredProjects} activities={activities} assignees={assignees} />
        </>
      )}
    </div>
  );
}