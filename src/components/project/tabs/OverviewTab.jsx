import { formatDate } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-400 w-48 shrink-0">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value || "—"}</span>
    </div>
  );
}

function ParticipantCard({ role, name, contact }) {
  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{role}</p>
      <p className="text-sm font-semibold text-slate-800">{name || "—"}</p>
      {contact && <p className="text-xs text-slate-500 mt-0.5">{contact}</p>}
    </div>
  );
}

export default function OverviewTab({ project, phases }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left column */}
      <div className="col-span-2 space-y-6">
        {/* General Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Dados do Projeto</h3>
          <InfoRow label="Cliente" value={project.client_name} />
          <InfoRow label="Origem" value={project.origin} />
          <InfoRow label="Tipo de Implantação" value={project.implantation_type} />
          <InfoRow label="Status" value={<StatusBadge status={project.status} />} />
          <InfoRow label="Fase Atual" value={project.current_phase} />
          <InfoRow label="Data de Início" value={formatDate(project.start_date)} />
          <InfoRow label="Previsão de Conclusão" value={formatDate(project.planned_end_date)} />
          <InfoRow label="Data Alinhada" value={formatDate(project.aligned_end_date)} />
          <InfoRow label="Observações" value={project.observations} />
        </div>

        {/* Phases progress */}
        {phases && phases.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Progresso por Fase</h3>
            <div className="space-y-4">
              {phases.map(phase => (
                <div key={phase.id || phase.phase_name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{phase.phase_name}</span>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={phase.status} />
                      <span className="text-sm font-semibold text-slate-600">{phase.progress_percent}%</span>
                    </div>
                  </div>
                  <ProgressBar value={phase.progress_percent} showLabel={false} />
                  {(phase.planned_start || phase.planned_end) && (
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(phase.planned_start)} → {formatDate(phase.planned_end)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modules & Services */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Módulos e Serviços Contratados</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Módulos</p>
              <div className="flex flex-wrap gap-2">
                {project.contracted_modules?.length > 0
                  ? project.contracted_modules.map(m => (
                    <span key={m} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">{m}</span>
                  ))
                  : <span className="text-sm text-slate-400">Nenhum módulo cadastrado</span>
                }
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Serviços</p>
              <div className="flex flex-wrap gap-2">
                {project.contracted_services?.length > 0
                  ? project.contracted_services.map(s => (
                    <span key={s} className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">{s}</span>
                  ))
                  : <span className="text-sm text-slate-400">Nenhum serviço cadastrado</span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right column: participants */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Equipe Pontotel</h3>
          <div className="space-y-3">
            <ParticipantCard role="Gerente de Projeto" name={project.pontotel_manager_name} contact={project.pontotel_manager_contact} />
            <ParticipantCard role="Analista de Implantação" name={project.pontotel_analyst_name} contact={project.pontotel_analyst_contact} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Equipe Cliente</h3>
          <div className="space-y-3">
            <ParticipantCard role="Patrocinador" name={project.sponsor_name} contact={project.sponsor_contact} />
            <ParticipantCard role="Líder do Projeto" name={project.project_leader_name} contact={project.project_leader_contact} />
            <ParticipantCard role="Operação" name={project.operation_name} contact={project.operation_contact} />
            <ParticipantCard role="TI" name={project.ti_client_name} contact={project.ti_client_contact} />
          </div>
        </div>
      </div>
    </div>
  );
}