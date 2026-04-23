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
import ScheduleTab from "@/components/project/tabs/ScheduleTab";
import StatusReportTab from "@/components/project/tabs/StatusReportTab";
import ActionPlanTab from "@/components/project/tabs/ActionPlanTab";
import TAPTab from "@/components/project/tabs/TAPTab.jsx";
import ClosureTab from "@/components/project/tabs/ClosureTab.jsx";

const TABS = [
  { id: "overview",  label: "Resumo" },
  { id: "scope",     label: "Escopo Técnico" },
  { id: "tap",       label: "TAP" },
  { id: "schedule",  label: "Cronograma" },
  { id: "status",    label: "Status Report" },
  { id: "actions",   label: "Plano de Ação" },
  { id: "closure",   label: "Encerramento" }
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

  const isMock = id && id.startsWith("proj-");

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
        setProject(proj[0] || null);
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
      <ProjectHeader project={project} />

      <div className="bg-white border-b border-slate-200 px-8 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
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

      <div className="flex-1 p-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          {activeTab === "overview" && <OverviewTab project={project} phases={phases} />}
          {activeTab === "scope" && <ScopeTab scopeItems={scopeItems} projectId={id} project={project} onRefresh={loadData} />}
          {activeTab === "tap" && <TAPTab project={project} scopeItems={scopeItems} documents={documents} projectId={id} onRefresh={loadData} />}
          {activeTab === "schedule" && <ScheduleTab phases={phases} activities={activities} projectId={id} onRefresh={loadData} />}
          {activeTab === "status" && <StatusReportTab reports={reports} projectId={id} projectClientName={project.client_name} activities={activities} onRefresh={loadData} />}
          {activeTab === "actions" && <ActionPlanTab actions={actions} projectId={id} onRefresh={loadData} />}
          {activeTab === "closure" && <ClosureTab project={project} documents={documents} activities={activities} projectId={id} onRefresh={loadData} />}
        </div>
      </div>
    </div>
  );
}