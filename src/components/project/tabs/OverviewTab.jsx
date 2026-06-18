import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { Pencil, Link2 } from "lucide-react";

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-400 w-48 shrink-0">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value || "—"}</span>
    </div>
  );
}

function ParticipantCard({ role, name, email, phone, legacyContact }) {
  const displayEmail = email || "";
  const displayPhone = phone || "";
  const displayContact = legacyContact || "";
  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{role}</p>
      <p className="text-sm font-semibold text-slate-800">{name || "—"}</p>
      {displayEmail && <p className="text-xs text-slate-500 mt-0.5">{displayEmail}</p>}
      {displayPhone && <p className="text-xs text-slate-400">{displayPhone}</p>}
      {!displayEmail && !displayPhone && displayContact && <p className="text-xs text-slate-500 mt-0.5">{displayContact}</p>}
      {!displayEmail && !displayPhone && !displayContact && !name && <p className="text-xs text-slate-400 italic">Não informado</p>}
    </div>
  );
}

export default function OverviewTab({ project, phases, onEditDadosIniciais, onProjectUpdated }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  useEffect(() => {
    if (!project?.id || membersLoaded) return;
    base44.entities.ProjectTeamMember.filter({ project_id: project.id })
      .then(list => { setTeamMembers(list || []); setMembersLoaded(true); })
      .catch(() => setMembersLoaded(true));
  }, [project?.id, membersLoaded]);

  const pontotelMembers = teamMembers.filter(m => m.team === "pontotel");
  const clienteMembers = teamMembers.filter(m => m.team === "cliente");

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Banner de vínculo Pipedrive */}
      {project?.pipedrive_deal_id && (
        <div className="col-span-3 flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
          <Link2 className="w-4 h-4 text-orange-500 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-orange-800">Projeto vinculado ao Pipedrive</span>
            <span className="text-orange-600 ml-2">Deal #{project.pipedrive_deal_id} — os dados iniciais são alimentados pelo CRM e podem ser re-sincronizados a qualquer momento.</span>
          </div>
          {project?.pipedrive_pipeline_name && (
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full font-medium shrink-0">
              {project.pipedrive_pipeline_name}
            </span>
          )}
        </div>
      )}

      {/* Left column */}
      <div className="col-span-2 space-y-6">
        {/* General Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Dados do Projeto</h3>
            <div className="flex items-center gap-2">
              {onEditDadosIniciais && (
                <button
                  onClick={onEditDadosIniciais}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
            </div>
          </div>

          <InfoRow label="Cliente" value={project.client_name} />
          <InfoRow label="ID da Empresa" value={project.empresa_id} />
          <InfoRow label="Origem" value={project.origin} />
          <InfoRow label="Tipo de Implantação" value={project.implantation_type} />
          <InfoRow label="Status" value={<StatusBadge status={project.status} />} />
          <InfoRow label="Fase Atual" value={project.current_phase} />
          <InfoRow label="Data de Início" value={formatDate(project.start_date)} />
          <InfoRow label="Previsão de Conclusão" value={formatDate(project.planned_end_date)} />
          <InfoRow label="Data Alinhada" value={formatDate(project.aligned_end_date)} />
          <InfoRow label="Funcionários Contratados" value={project.contracted_employees ? project.contracted_employees.toLocaleString("pt-BR") : null} />
          <InfoRow label="MRR" value={project.mrr ? `R$ ${Number(project.mrr).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
          <InfoRow label="ID Deal Pipedrive" value={project.pipedrive_deal_id ? `#${project.pipedrive_deal_id}` : null} />
          <InfoRow label="Lar21" value={project.lar21} />
          <InfoRow label="Pasta do Drive" value={project.drive_folder ? <a href={project.drive_folder} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3" />Abrir pasta</a> : null} />
          <InfoRow label="Observações" value={project.observations} />
        </div>



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
            <ParticipantCard role="Gerente de Projeto" name={project.pontotel_manager_name} email={project.pontotel_manager_email} phone={project.pontotel_manager_phone} legacyContact={project.pontotel_manager_contact} />
            <ParticipantCard role="Analista de Implantação" name={project.pontotel_analyst_name} email={project.pontotel_analyst_email} phone={project.pontotel_analyst_phone} legacyContact={project.pontotel_analyst_contact} />
            {pontotelMembers.map((m, i) => (
              <ParticipantCard key={i} role={m.role || "Membro Pontotel"} name={m.name} email={m.email} phone={m.phone} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Equipe Cliente</h3>
          <div className="space-y-3">
            <ParticipantCard role="Patrocinador" name={project.sponsor_name} email={project.sponsor_email} phone={project.sponsor_phone} legacyContact={project.sponsor_contact} />
            <ParticipantCard role="Líder do Projeto" name={project.project_leader_name} email={project.project_leader_email} phone={project.project_leader_phone} legacyContact={project.project_leader_contact} />
            <ParticipantCard role="Operação" name={project.operation_name} email={project.operation_email} phone={project.operation_phone} legacyContact={project.operation_contact} />
            <ParticipantCard role="TI" name={project.ti_client_name} email={project.ti_client_email} phone={project.ti_client_phone} legacyContact={project.ti_client_contact} />
            {clienteMembers.map((m, i) => (
              <ParticipantCard key={i} role={m.role || "Membro Cliente"} name={m.name} email={m.email} phone={m.phone} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}