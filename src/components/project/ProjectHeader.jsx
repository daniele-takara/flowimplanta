import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, Users, TrendingUp, Building2, ChevronDown } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatDate, formatCurrency, calcDaysLeft, phaseColor } from "@/lib/utils";

const STATUS_OPTIONS = ["Em aberto", "Em andamento", "Concluído", "Perdido", "Pausado"];

const STATUS_DOT = {
  "Em aberto":    "bg-blue-500",
  "Em andamento": "bg-indigo-500",
  "Concluído":    "bg-green-500",
  "Perdido":      "bg-red-500",
  "Pausado":      "bg-amber-500",
};

export default function ProjectHeader({ project, onChangeStatus }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const daysLeft = calcDaysLeft(project.planned_end_date);
  const currentStatus = project.status || "Em aberto";

  const handleStatusChange = (newStatus) => {
    setStatusOpen(false);
    if (newStatus !== currentStatus && onChangeStatus) {
      onChangeStatus(newStatus);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-8 py-6">
      <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
        <Link to="/projects" className="hover:text-slate-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Projetos
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-medium truncate max-w-xs">{project.name}</span>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{project.client_name}</p>
            <StatusBadge status={currentStatus} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor(project.current_phase)}`}>
              {project.current_phase}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mt-1">{project.name}</h1>
          {project.executive_summary && (
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">{project.executive_summary}</p>
          )}
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          <div className="relative">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[currentStatus] || "bg-slate-400"}`} />
              Status: {currentStatus}
              <ChevronDown className={`w-3 h-3 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                        status === currentStatus ? "font-semibold text-slate-800 bg-slate-50" : "text-slate-600"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] || "bg-slate-400"}`} />
                      {status}
                      {status === currentStatus && (
                        <span className="ml-auto text-green-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{project.progress_percent}%</div>
            <div className="text-xs text-slate-400">concluído</div>
            <div className="mt-2 w-32">
              <ProgressBar value={project.progress_percent} showLabel={false} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-5 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span>Tipo: <strong className="text-slate-700">{project.implantation_type}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span>MRR: <strong className="text-slate-700">{formatCurrency(project.mrr)}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="w-4 h-4 text-slate-400" />
          <span>Funcionários: <strong className="text-slate-700">{project.contracted_employees?.toLocaleString() || "—"}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>
            {formatDate(project.start_date)} → {formatDate(project.planned_end_date)}
            {daysLeft !== null && (
              <strong className={daysLeft < 0 ? "text-red-600 ml-2" : "text-slate-700 ml-2"}>
                ({daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`})
              </strong>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}