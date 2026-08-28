import { Link } from "react-router-dom";
import { List } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { computeCurrentStage } from "@/lib/computeCurrentStage";

function resolveName(project, idField, nameField, managers, analysts) {
  const id = project[idField];
  if (id) {
    const list = idField === "pontotel_manager_id" ? managers : analysts;
    const user = list.find(u => u.id === id);
    if (user?.full_name) return user.full_name;
  }
  return project[nameField] || "—";
}

export default function AllProjectsTable({ projects, activities, assignees }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <List className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Todos os Projetos</h3>
        <span className="text-xs text-slate-400 ml-1">({projects.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 px-5 py-2.5">Projeto</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Etapa atual</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Gerente</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Analista</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => {
              const { stage, hasActiveActivity } = computeCurrentStage(project, activities);
              return (
                <tr key={project.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/projects/${project.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-600">{stage}</span>
                      {!hasActiveActivity && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200" title="Sem atividade em cronograma ativa">
                          sem cronograma ativo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {resolveName(project, "pontotel_manager_id", "pontotel_manager_name", assignees.managers, assignees.analysts)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {resolveName(project, "pontotel_analyst_id", "pontotel_analyst_name", assignees.managers, assignees.analysts)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}