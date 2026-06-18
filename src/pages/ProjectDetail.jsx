import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
import EditProjectModal from "@/components/project/EditProjectModal";
import { usePermissions } from "@/lib/usePermissions";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

const TABS = [
  { id: "overview",  label: "Dados Iniciais" },
  { id: "scope",     label: "Escopo Técnico" },
  { id: "tap",       label: "TAP" },
  { id: "schedule",  label: "Cronograma" },
  { id: "status",    label: "Status Report" },
  { id: "actions",   label: "Plano de Ação" },
  { id: "termo",     label: "Termo de Encerramento" },
  { id: "calc",      label: "Regras de Cálculo" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [project, setProject]     = useState(null);
  const [phases, setPhases]       = useState([]);
  const [activities, setActivities] = useState([]);
  const [scopeItems, setScopeItems] = useState([]);
  const [reports, setReports]     = useState([]);
  const [actions, setActions]     = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const perms = usePermissions();
  const isMock = id && id.startsWith("proj-");

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === "calc" && !perms.canReadCalcRules) return false;
    return true;
  });

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
        const [proj, ph, ac, sc, rp, ap, docs] = await Promise.all([
          base44.entities.Project.filter({ id }),
          base44.entities.SchedulePhase.filter({ project_id: id }, "order"),
          base44.entities.ScheduleActivity.filter({ project_id: id }, "order"),
          base44.entities.ScopeItem.filter({ project_id: id }, "order_number"),
          base44.entities.StatusReport.filter({ project_id: id }, "-report_date"),
          base44.entities.ActionPlan.filter({ project_id: id }, "-created_date"),
          base44.entities.ProjectDocument.filter({ project_id: id })
        ]);
        const freshProject = proj[0] || null;
        // Log para diagnóstico de módulos
        console.log("[ProjectDetail] loadData → contracted_modules:", freshProject?.contracted_modules, "| contracted_services:", freshProject?.contracted_services);
        setProject(freshProject);
        setPhases(ph);
        setActivities(ac);
        setScopeItems(sc);
        setReports(rp);
        setActions(ap);
        setDocuments(docs);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Recarrega apenas os ScopeItems — chamado silenciosamente após cada save no ScopeTab
  // Isso garante que TAP, Cronograma e Termo de Encerramento recebam o answersMap atualizado
  const reloadScopeItems = async () => {
    if (isMock) return;
    try {
      const ts = new Date().toISOString().substr(11, 12);
      console.log(`[ProjectDetail] ⏱ ${ts} reloadScopeItems — INÍCIO`);
      const sc = await base44.entities.ScopeItem.filter({ project_id: id }, "order_number");
      console.log("[ProjectDetail] reloadScopeItems — carregados", {
        count: sc?.length || 0,
        sampleWithAnswer: sc?.filter(s => s.answer).slice(0, 5).map(s => ({ question_id: s.question_id, order_number: s.order_number, answer: s.answer, observations: s.observations })),
        itemsWithoutOrderNumber: sc?.filter(s => !s.order_number).map(s => ({ id: s.id, question_id: s.question_id })),
      });
      setScopeItems(sc);
    } catch (e) {
      console.error("[ProjectDetail] reloadScopeItems erro:", e);
    }
  };

  // Recarrega apenas o projeto (contracted_modules, etc.) sem spinner global
  const reloadProject = async () => {
    if (isMock) return;
    try {
      const fresh = await base44.entities.Project.filter({ id });
      if (fresh[0]) {
        console.log("[ProjectDetail] reloadProject → contracted_modules:", fresh[0]?.contracted_modules);
        setProject(fresh[0]);
      }
    } catch (e) {
      console.error("[ProjectDetail] reloadProject erro:", e);
    }
  };

  useEffect(() => { loadData(); }, [id]);

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

  return (
    <div className="flex flex-col min-h-screen">
      <ProjectHeader project={project} onEditDadosIniciais={!isMock ? () => setShowEditModal(true) : null} />
      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSaved={loadData}
        />
      )}

      <div className="bg-white border-b border-slate-200 px-8 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
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
            // NUNCA fazer merge parcial — sempre recarregar do banco para garantir
            // que contracted_modules e contracted_services sejam a versão oficial.
            // Merge parcial com dados do Pipedrive pode sobrescrever módulos com undefined.
            try {
              const fresh = await base44.entities.Project.filter({ id });
              if (fresh[0]) {
                console.log("[ProjectDetail] onProjectUpdated → contracted_modules:", fresh[0]?.contracted_modules);
                setProject(fresh[0]);
              }
            } catch {
              // Fallback seguro: só usa o updated se busca falhar
              setProject(prev => ({ ...prev, ...updated }));
            }
          }} />}
          {activeTab === "scope" && <ScopeTab scopeItems={scopeItems} projectId={id} project={project} onRefresh={loadData} onScopeSaved={reloadScopeItems} readOnly={!perms.canEditScope} canUpdateTemplate={perms.canUpdateScopeTemplate} />}
          {activeTab === "tap" && <TAPTab project={project} scopeItems={scopeItems} documents={documents} projectId={id} onRefresh={loadData} readOnly={!perms.canEditTAP} canGeneratePDF={perms.canGenerateTAPPDF} />}
          {activeTab === "schedule" && <ScheduleTab scopeItems={scopeItems} project={project} projectId={id} onRefresh={loadData} readOnly={!perms.canEditSchedule} canEditPlanned={perms.canEditSchedulePlanned} canEditExecuted={perms.canEditSchedule} canCompletePhase={perms.canCompletePhase} canRecalculate={perms.canRecalculateSchedule} canSyncPipedrive={perms.canSyncPipedriveCronograma} canAddActivity={perms.canAddScheduleActivity} canCreatePhase={perms.canCreateSchedulePhase} canEditPhase={perms.canEditSchedulePhase} canExcluirPhase={perms.canExcluirSchedulePhase} canExcluirActivity={perms.canExcluirScheduleActivity} canGeneratePDF={perms.canGenerateSchedulePDF} />}
          {activeTab === "status" && <StatusReportTab reports={reports} projectId={id} projectClientName={project.client_name} project={project} scopeItems={scopeItems} savedActivities={activities} onRefresh={loadData} readOnly={!perms.canEditStatusReport} canUpdate={perms.canUpdateStatusReport} canGenerateEmail={perms.canGenerateStatusReportEmail} canSyncPipedrive={perms.canSyncPipedriveStatus} />}
          {activeTab === "actions" && <ActionPlanTab actions={actions} projectId={id} project={project} onRefresh={loadData} readOnly={!perms.canEditActionPlan} canDelete={perms.canDeleteActionPlan} />}
          {activeTab === "termo" && <TermoEncerramentoTab project={project} scopeItems={scopeItems} reports={reports} savedActivities={activities} projectId={id} readOnly={!perms.canEditTermo} canGeneratePDF={perms.canGenerateTermoPDF} />}
          {activeTab === "calc" && (
            <ProtectedRoute allowed={perms.canReadCalcRules}>
              <CalculationRulesTab projectId={id} project={project} />
            </ProtectedRoute>
          )}
          {activeTab === "closure" && <ClosureTab project={project} documents={documents} activities={activities} projectId={id} onRefresh={loadData} readOnly={!perms.canEditTermo} />}
        </div>
      </div>
    </div>
  );
}