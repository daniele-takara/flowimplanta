import { Link } from "react-router-dom";
import { formatDate, formatCurrency, calcDaysLeft, phaseColor } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { Users, Calendar, TrendingUp } from "lucide-react";

export default function ProjectCard({ project }) {
  const daysLeft = calcDaysLeft(project.planned_end_date);

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{project.client_name}</p>
          <h3 className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{project.name}</h3>
        </div>
        <StatusBadge status={project.status} className="ml-3 shrink-0" />
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor(project.current_phase)}`}>
            {project.current_phase}
          </span>
          <span className="text-xs text-slate-500 font-semibold">{project.progress_percent}%</span>
        </div>
        <ProgressBar value={project.progress_percent} showLabel={false} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{project.contracted_employees?.toLocaleString() || "—"} func.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{formatCurrency(project.mrr)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span className={daysLeft !== null && daysLeft < 0 ? "text-red-500 font-medium" : ""}>
            {daysLeft === null ? "—" : daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">Gerente: <span className="text-slate-600 font-medium">{project.pontotel_manager_name || "—"}</span></span>
        <span className="text-xs text-slate-400">Fim: <span className="text-slate-600 font-medium">{formatDate(project.planned_end_date)}</span></span>
      </div>
    </Link>
  );
}