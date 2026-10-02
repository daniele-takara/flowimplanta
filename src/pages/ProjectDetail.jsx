import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  MOCK_PROJECTS, MOCK_SCOPE_ITEMS, MOCK_SCHEDULE_PHASES,
  MOCK_ACTIVITIES, MOCK_STATUS_REPORTS, MOCK_ACTION_PLANS
} from "@/lib/mockData";
import ProjectHeader from "@/components/project/ProjectHeader";
import OverviewTab from "@/components/project/tabs/OverviewTab";
import ScopeTab from "@/components/project/tabs/ScopeTab.jsx";
import ScheduleTab from "@/components/project/tabs/ScheduleTab.jsx";
import StatusReportTab from "@/components/project/tabs/StatusReportTab";
import ActionPlanTab from "@/components/project/tabs/ActionPlanTab";
import TAPTab from "@/components/project/tabs/TAPTab.jsx";
import ClosureTab from "@/components/project/tabs/ClosureTab.jsx";
import TermoEncerramentoTab from "@/components/project/tabs/TermoEncerramentoTab";
import CalculationRulesTab from "@/components/project/tabs/CalculationRulesTab.jsx";
import AuditLogTab from "@/components/project/tabs/AuditLogTab.jsx";
import EditProjectModal from "@/components/project/EditProjectModal";
import BoasPraticasModal from "@/components/project/BoasPraticasModal";
import { usePermissions } from "@/lib/usePermissions";
import { logAudit } from "@/lib/auditLog";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

const TABS = [
  { id: "overview",  label: "Dados Iniciais" },
  { id: "scope",     label: "Escopo Técnico" },
  { id: "tap",       label: "TAP" },
  { id: "calc",      label: "Regras de Cálculo" },
  { id: "schedule",  label: "Cronograma" },
  { id: "status",    label: "Status Report" },
  { id: "actions",   label: "Plano de Ação" },
  { id: "termo",     label: "Termo de Encerramento" },
  { id: "audit",     label: "Histórico" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [project, setProject]     = useState(null);
  const [isPresentation, setIsPresentation] = useState(() => window.location.hash === "#presentation");

  useEffect(() => {
    const handler = () => setIsPresentation(window.location.hash === "#presentation");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const [phases, setPhases]       = useState([]);
  const [activities, setActivities] = useState([]);
  const [scopeItems, setScopeItems] = useState([]);
  const [reports, setReports]     = useState([]);
  const [actions, setActions]     = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBoasPraticas, setShowBoasPraticas] = useState(false);

  const perms = usePermissions();
  const isMock = id && id.startsWith("proj-");

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === "calc" && !perms.canReadCalcRules) return false;
    return true;
  });

  // Recarga silenciosa unificada — busca todas as entidades sem spinner global.
  // Usada por todos os botões de "Atualizar" e callbacks de propagação entre abas.
  const reloadAll = useCallback(async () => {
    if (isMock) return;
    try {
      const [proj, ph, ac, sc, rp, ap, docs] = await Promise.all([
        base44.entities.Project.filter({ id }),
        base44.entities.SchedulePhase.filter({ project_id: id }, "order"),
        base44.entities.ScheduleActivity.filter({ project_id: id }, "order"),
        base44.entities.ScopeItem.filter({ project_id: id }, "order_number"),
        base44.entities.StatusReport.filter({ project_id: id }, "-report_date"),
        base44.entities.ActionPlan.filter({ project_id: id }, "-created_date"),
        base44.entities.ProjectDocument.filter({ project_id: id })
      ]);
      setProject(proj[0] || null);
      setPhases(ph);
      setActivities(ac);
      setScopeItems(sc);
      setReports(rp);
      setActions(ap);
      setDocuments(docs);
    } catch (e) {
      console.error("[ProjectDetail] reloadAll erro:", e);
    }
  }, [id, isMock]);

  // Carga inicial com spinner — apenas na primeira renderização / troca de projeto.
  const loadData = async () => {
    setLoading(true);
    try {
      if (isMock) {
        setProject(MOCK_PROJECTS.find(p => p.id === id) || null);
        setPhases(MOCK_SCHEDULE_PHASES[id] || []);
        setActivities(MOCK_ACTIVITIES[id] || []);
        setScopeItems(MOCK_SCOPE_ITEMS[id] || []);
        setReports(MOCK_STATUS_REPORTS[id] || []);
        setActions(MOCK_ACTION_PLANS[id] || []);
        setDocuments([]);
      } else {
        await reloadAll();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Propagação instantânea de atividades do Cronograma para o parent (optimistic).
  // O ScheduleTab chama com sua lista local atualizada; o parent atualiza o state
  // para que Status Report e Termo de Encerramento recebam atividades frescas sem troca de página.
  const handleActivitiesChanged = useCallback((updatedActivities) => {
    setActivities(updatedActivities);
  }, []);

  useEffect(() => { loadData(); }, [id]);

  // Subscrições realtime nas entidades críticas — alterações (desta ou de outras
  // sessões) refletem automaticamente no parent sem refresh manual.
  useEffect(() => {
    if (isMock || !id) return;

    const applyEvent = (setter) => (event) => {
      setter(prev => {
        if (!prev) return prev;
        if (event.type === "create") {
          if (event.data?.project_id && event.data.project_id !== id) return prev;
          const exists = prev.some(x => x.id === event.data.id);
          return exists ? prev.map(x => x.id === event.data.id ? { ...x, ...event.data } : x) : [...prev, event.data];
        }
        if (event.type === "update") {
          return prev.map(x => x.id === event.data.id ? { ...x, ...event.data } : x);
        }
        if (event.type === "delete") {
          return prev.filter(x => x.id !== event.id);
        }
        return prev;
      });
    };

    let unsubActivities, unsubScope, unsubReports;
    try { unsubActivities = base44.entities.ScheduleActivity.subscribe(applyEvent(setActivities)); } catch (e) { console.warn("[ProjectDetail] subscribe ScheduleActivity falhou:", e); }
    try { unsubScope = base44.entities.ScopeItem.subscribe(applyEvent(setScopeItems)); } catch (e) { console.warn("[ProjectDetail] subscribe ScopeItem falhou:", e); }
    try { unsubReports = base44.entities.StatusReport.subscribe(applyEvent(setReports)); } catch (e) { console.warn("[ProjectDetail] subscribe StatusReport falhou:", e); }

    return () => {
      unsubActivities?.();
      unsubScope?.();
      unsubReports?.();
    };
  }, [id, isMock]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-center text-slate-400">Projeto não encontrado.</div>;
  }

  // Presentation mode: fullscreen content only
  if (isPresentation) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <div className="flex-1 p-4 md:p-8">
          <div className={activeTab === "schedule" ? "" : "max-w-6xl mx-auto"}>
            {activeTab === "scope" && <ScopeTab scopeItems={scopeItems} projectId={id} project={project} onRefresh={reloadAll} onScopeSaved={reloadAll} onStatusPromoted={reloadAll} readOnly={!perms.canEditScope} canUpdateTemplate={perms.canUpdateScopeTemplate} />}
            {activeTab === "calc" && (
              <ProtectedRoute allowed={perms.canReadCalcRules}>
                <CalculationRulesTab projectId={id} project={project} />
              </ProtectedRoute>
            )}
            {activeTab === "schedule" && <ScheduleTab scopeItems={scopeItems} project={project} projectId={id} onRefresh={reloadAll} onStatusPromoted={reloadAll} onActivitiesChanged={handleActivitiesChanged} readOnly={!perms.canEditSchedule} canEditPlanned={perms.canEditSchedulePlanned} canEditExecuted={perms.canEditSchedule} canCompletePhase={perms.canCompletePhase} canRecalculate={perms.canRecalculateSchedule} canSyncPipedrive={perms.canSyncPipedriveCronograma} canAddActivity={perms.canAddScheduleActivity} canCreatePhase={perms.canCreateSchedulePhase} canEditPhase={perms.canEditSchedulePhase} canExcluirPhase={perms.canExcluirSchedulePhase} canExcluirActivity={perms.canExcluirScheduleActivity} canGeneratePDF={perms.canGenerateSchedulePDF} />}
            {activeTab === "status" && <StatusReportTab reports={reports} projectId={id} projectClientName={project.client_name} project={project} scopeItems={scopeItems} savedActivities={activities} onRefresh={reloadAll} readOnly={!perms.canEditStatusReport} canUpdate={perms.canUpdateStatusReport} canGenerateEmail={perms.canGenerateStatusReportEmail} canSyncPipedrive={perms.canSyncPipedriveStatus} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <ProjectHeader
        project={project}
        onChangeStatus={!isMock ? async (newStatus, pauseReason) => {
          const oldStatus = project.status;
          const oldReason = project.pause_reason || "";
          const updates = { status: newStatus };
          if (newStatus === "Pausado") {
            updates.pause_reason = pauseReason || "";
          } else {
            updates.pause_reason = "";
          }
          setProject(prev => ({ ...prev, ...updates }));
          await base44.entities.Project.update(id, updates);
          await logAudit({
            project_id: id,
            screen: "Dados Iniciais",
            field: "status",
            old_value: oldStatus,
            new_value: newStatus,
          });
          if (oldReason !== updates.pause_reason) {
            await logAudit({
              project_id: id,
              screen: "Dados Iniciais",
              field: "pause_reason",
              old_value: oldReason,
              new_value: updates.pause_reason,
            });
          }
        } : null}
      />
      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSaved={reloadAll}
        />
      )}

      {showBoasPraticas && (
        <BoasPraticasModal onClose={() => setShowBoasPraticas(false)} />
      )}

      <div className="bg-white border-b border-slate-200 px-8 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          <div className="flex gap-0">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBoasPraticas(true)}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 my-1.5 mr-2 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
            title="Gerar PDFs de boas práticas de cada aba"
          >
            <FileDown className="w-3.5 h-3.5" />
            Boas Práticas
          </button>
        </div>
      </div>

      {perms.readOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-8 py-2 flex items-center gap-2 text-sm text-amber-700">
          <span className="font-semibold">Modo somente leitura</span> — seu perfil <strong>{perms.profileName}</strong> não permite edições.
        </div>
      )}

      <div className={`flex-1 bg-slate-50 ${(activeTab === "actions" || activeTab === "schedule") ? "p-4" : "p-8"}`}>
        <div className={(activeTab === "actions" || activeTab === "schedule") ? "" : "max-w-6xl mx-auto"}>
          {activeTab === "overview" && <OverviewTab project={project} phases={phases} canSyncPipedrive={perms.canSyncPipedriveDados} onEditDadosIniciais={(!isMock && perms.canEditProject) ? () => setShowEditModal(true) : null} onProjectUpdated={async (updated) => {
            if (!updated) return;
            try {
              const fresh = await base44.entities.Project.filter({ id });
              if (fresh[0]) {
                setProject(fresh[0]);
              }
            } catch {
              setProject(prev => ({ ...prev, ...updated }));
            }
          }} />}
          {activeTab === "scope" && <ScopeTab scopeItems={scopeItems} projectId={id} project={project} onRefresh={reloadAll} onScopeSaved={reloadAll} onStatusPromoted={reloadAll} readOnly={!perms.canEditScope} canUpdateTemplate={perms.canUpdateScopeTemplate} />}
          {activeTab === "tap" && <TAPTab project={project} scopeItems={scopeItems} documents={documents} projectId={id} onRefresh={reloadAll} onStatusPromoted={reloadAll} readOnly={!perms.canEditTAP} canGeneratePDF={perms.canGenerateTAPPDF} />}
          {activeTab === "schedule" && <ScheduleTab scopeItems={scopeItems} project={project} projectId={id} onRefresh={reloadAll} onStatusPromoted={reloadAll} onActivitiesChanged={handleActivitiesChanged} readOnly={!perms.canEditSchedule} canEditPlanned={perms.canEditSchedulePlanned} canEditExecuted={perms.canEditSchedule} canCompletePhase={perms.canCompletePhase} canRecalculate={perms.canRecalculateSchedule} canSyncPipedrive={perms.canSyncPipedriveCronograma} canAddActivity={perms.canAddScheduleActivity} canCreatePhase={perms.canCreateSchedulePhase} canEditPhase={perms.canEditSchedulePhase} canExcluirPhase={perms.canExcluirSchedulePhase} canExcluirActivity={perms.canExcluirScheduleActivity} canGeneratePDF={perms.canGenerateSchedulePDF} />}
          {activeTab === "status" && <StatusReportTab reports={reports} projectId={id} projectClientName={project.client_name} project={project} scopeItems={scopeItems} savedActivities={activities} onRefresh={reloadAll} readOnly={!perms.canEditStatusReport} canUpdate={perms.canUpdateStatusReport} canGenerateEmail={perms.canGenerateStatusReportEmail} canSyncPipedrive={perms.canSyncPipedriveStatus} />}
          {activeTab === "actions" && <ActionPlanTab actions={actions} projectId={id} project={project} onRefresh={reloadAll} readOnly={!perms.canEditActionPlan} canDelete={perms.canDeleteActionPlan} />}
          {activeTab === "termo" && <TermoEncerramentoTab project={project} scopeItems={scopeItems} reports={reports} savedActivities={activities} projectId={id} onRefresh={reloadAll} readOnly={!perms.canEditTermo} canEditAutoFields={perms.canEditTermoAutoFields} canGeneratePDF={perms.canGenerateTermoPDF} />}
          {activeTab === "calc" && (
            <ProtectedRoute allowed={perms.canReadCalcRules}>
              <CalculationRulesTab projectId={id} project={project} />
            </ProtectedRoute>
          )}
          {activeTab === "closure" && <ClosureTab project={project} documents={documents} activities={activities} projectId={id} onRefresh={reloadAll} readOnly={!perms.canEditTermo} />}
          {activeTab === "audit" && <AuditLogTab projectId={id} />}
        </div>
      </div>
    </div>
  );
}