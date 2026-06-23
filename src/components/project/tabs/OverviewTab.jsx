import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import { Pencil, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Link2 } from "lucide-react";

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

export default function OverviewTab({ project, phases, onEditDadosIniciais, onProjectUpdated, canSyncPipedrive = true }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [bqSyncing, setBqSyncing] = useState(false);
  const [bqResult, setBqResult] = useState(null);
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

  const handleSyncPipedrive = async () => {
    if (!project?.pipedrive_deal_id) {
      setSyncResult({ error: "Informe o ID Deal Pipedrive para integrar os dados" });
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncPipedriveData", {
        project_id: project.id,
        deal_id: project.pipedrive_deal_id,
      });
      if (res.data?.success) {
        setSyncResult({
          success: true,
          deal_id: project.pipedrive_deal_id,
          deal_name: res.data.project?.name,
          fields: res.data.updated_fields || [],
          module_alerts: res.data.module_alerts || [],
        });
        if (onProjectUpdated) onProjectUpdated(res.data.project);
      } else {
        setSyncResult({ error: res.data?.error || "Erro ao sincronizar", deal_id: project.pipedrive_deal_id });
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setSyncResult({ error: msg, deal_id: project.pipedrive_deal_id });
    }
    setSyncing(false);
  };

  const handleSyncBigQuery = async () => {
    if (!project?.empresa_id) {
      setBqResult({ error: "Informe o ID da Empresa (empresa_id) nos Dados Iniciais para buscar no BigQuery" });
      return;
    }
    setBqSyncing(true);
    setBqResult(null);
    try {
      const res = await base44.functions.invoke("queryBigQueryUsage", {
        code: project.empresa_id,
        limite: 1,
      });
      const d = res.data;
      if (!d?.success || !d.clientData) {
        setBqResult({ error: "Cliente não encontrado no BigQuery para este empresa_id" });
        setBqSyncing(false);
        return;
      }
      const client = d.clientData;
      const funcionarios = client.funcionarios_baseline_contratado != null ? parseInt(client.funcionarios_baseline_contratado) : null;
      const mrrCentavos = client.mrr_total_centavos != null ? parseFloat(client.mrr_total_centavos) : null;
      const mrr = mrrCentavos != null ? mrrCentavos / 100 : null;

      const updates = {};
      if (funcionarios != null) updates.contracted_employees = funcionarios;
      if (mrr != null) updates.mrr = mrr;

      if (Object.keys(updates).length === 0) {
        setBqResult({ error: "Dados não encontrados no BigQuery (funcionarios_baseline_contratado e mrr_total_centavos ausentes)" });
        setBqSyncing(false);
        return;
      }

      const updated = await base44.entities.Project.update(project.id, updates);
      setBqResult({
        success: true,
        funcionarios,
        mrr,
        fields: Object.keys(updates),
      });
      if (onProjectUpdated) onProjectUpdated(updated);
    } catch (e) {
      setBqResult({ error: e.response?.data?.error || e.message });
    }
    setBqSyncing(false);
  };

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
              {canSyncPipedrive && <button
                onClick={handleSyncPipedrive}
                disabled={syncing}
                title={project?.pipedrive_deal_id ? `Sincronizar com deal #${project.pipedrive_deal_id}` : "Informe o ID Deal Pipedrive"}
                className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 border border-orange-200 bg-orange-50 hover:bg-orange-100 rounded-lg px-2.5 py-1 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Atualizar dados do Pipedrive"}
              </button>}
              <button
                onClick={handleSyncBigQuery}
                disabled={bqSyncing}
                title={project?.empresa_id ? "Atualizar Funcionários e MRR do BigQuery" : "Informe o ID da Empresa nos Dados Iniciais"}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bqSyncing ? "animate-spin" : ""}`} />
                {bqSyncing ? "Consultando..." : "Atualizar com o BigQuery"}
              </button>
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

          {/* Relatório de sincronização */}
          {syncResult && (
            <div className="mb-3 space-y-2">
              <div className={`rounded-lg text-xs border ${
                syncResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
              }`}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
                  {syncResult.success
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  }
                  <span className="font-semibold">
                    {syncResult.success ? "Sincronização concluída" : "Erro na sincronização"}
                    {syncResult.success && syncResult.module_alerts?.length > 0 && (
                      <span className="ml-1 font-normal text-amber-700">— com alertas de módulos</span>
                    )}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-0.5">
                  {syncResult.deal_id && <p>Deal Pipedrive: <strong>#{syncResult.deal_id}</strong></p>}
                  {syncResult.deal_name && <p>Nome encontrado: <strong>{syncResult.deal_name}</strong></p>}
                  {syncResult.success && syncResult.fields.length > 0 && (
                    <p>Campos atualizados: <strong>{syncResult.fields.join(", ")}</strong></p>
                  )}
                  {syncResult.error && <p>{syncResult.error}</p>}
                </div>
              </div>
              {syncResult.module_alerts?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border-b border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="font-semibold">
                      {syncResult.module_alerts.length} módulo(s) com cadastro fora do padrão no Pipedrive
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    {syncResult.module_alerts.map((alert, i) => (
                      <div key={i} className={`flex items-start gap-2 ${alert.severity === "error" ? "text-red-700" : "text-amber-800"}`}>
                        {alert.severity === "error"
                          ? <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                          : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                        }
                        <div>
                          <p>{alert.message}</p>
                          {alert.severity === "error" && (
                            <p className="mt-0.5 font-semibold">Este módulo NÃO foi importado. Corrija no Pipedrive.</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="pt-1 text-amber-600 border-t border-amber-200">
                      Acesse o Pipedrive → Organização → campo Módulos e corrija para os nomes oficiais.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* BigQuery sync feedback */}
          {bqResult && (
            <div className={`rounded-lg text-xs border mb-3 ${
              bqResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
                {bqResult.success
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                }
                <span className="font-semibold">
                  {bqResult.success ? "BigQuery atualizado" : "Erro BigQuery"}
                </span>
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {bqResult.success && bqResult.funcionarios != null && (
                  <p>Funcionários: <strong>{bqResult.funcionarios.toLocaleString("pt-BR")}</strong></p>
                )}
                {bqResult.success && bqResult.mrr != null && (
                  <p>MRR: <strong>R$ {bqResult.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
                )}
                {bqResult.error && <p>{bqResult.error}</p>}
              </div>
            </div>
          )}
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