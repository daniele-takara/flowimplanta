import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { formatDate, calcDaysLeft } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { computeCurrentStage, getClosingDate } from "@/lib/computeCurrentStage";

export default function ClosingSoonTable({ projects, activities }) {
  const rows = projects
    .filter(p => p.status !== "Concluído" && p.status !== "Perdido")
    .map(p => ({ project: p, closingDate: getClosingDate(p) }))
    .filter(r => r.closingDate)
    .map(r => ({ ...r, daysLeft: calcDaysLeft(r.closingDate) }))
    .filter(r => Math.abs(r.daysLeft) <= 30)
    .sort((a, b) => new Date(a.closingDate) - new Date(b.closingDate));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Próximos de Encerramento</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">Nenhum projeto com data de encerramento definida.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-2.5">Projeto</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Etapa atual</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Encerramento</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Dias restantes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, closingDate, daysLeft }) => {
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
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(closingDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${daysLeft < 0 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : "text-slate-500"}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)} dias atrasado` : `${daysLeft} dias`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}