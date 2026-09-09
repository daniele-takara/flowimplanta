import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown, ChevronRight, Save, X, Anchor, Pencil, Lock,
  AlertCircle, CheckCircle, CheckCircle2, Loader2, RefreshCw,
  Database, Plus, RotateCcw, Zap, Eye, MoreHorizontal, EyeOff, FileDown,
  Maximize2, Minimize2, GripVertical
} from "lucide-react";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { computeSchedule, workday } from "@/lib/scheduleEngine.js";
import { classifyScheduleActivities } from "@/lib/scheduleActivityMatch.js";
import AddActivityModal from "./schedule/AddActivityModal.jsx";
import LocalActivityRow from "./schedule/LocalActivityRow.jsx";
import AddPhaseModal from "./schedule/AddPhaseModal.jsx";
import LocalPhaseSection from "./schedule/LocalPhaseSection.jsx";
import TemplateTaskRow from "./schedule/TemplateTaskRow.jsx";
import PhaseOverrideModal from "./schedule/PhaseOverrideModal.jsx";
import { generateSchedulePDF } from "@/lib/schedulePdfExport.js";
import SchedulePDFColumnModal from "./schedule/SchedulePDFColumnModal.jsx";
import { logAudit } from "@/lib/auditLog";
import ScheduleAgentChat from "./schedule/ScheduleAgentChat.jsx";
import { autoPromoteToInProgress } from "@/lib/autoPromoteStatus";
import DependencyModal from "./schedule/DependencyModal.jsx";
import DependencyBadge from "./schedule/DependencyBadge.jsx";
import {
  buildRef, parseRef, wouldCreateCycle, computeSuccessorStart,
  getActivityEnd, cascadeRecalculate, computeTemplateEnd, computeDurationDays,
} from "@/lib/scheduleDependencies.js";
import { getTaskPhase, getTaskOrder, sortTasksByOrder } from "@/lib/scheduleOrderOverride.js";

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.question_id) map[item.question_id] = item.answer || "";
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      if (!map[key]) map[key] = item.answer || "";
    }
  });
  return map;
}

function GroupRow({ task, computedDates }) {
  const dates = computedDates[task.id] || {};
  return (
    <tr className="bg-slate-100 border-b border-slate-200">
      <td className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide" colSpan={3}>{task.activity}</td>
      <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(dates.plannedStart)} → {fmtDate(dates.plannedEnd)}</td>
      <td colSpan={6} />
    </tr>
  );
}

function SubGroupRow({ task, computedDates }) {
  const dates = computedDates[task.id] || {};
  return (
    <tr className="bg-purple-50 border-b border-purple-200">
      <td className="pl-6 pr-4 py-2 text-xs font-semibold text-purple-700" colSpan={3}>
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-3 rounded-full bg-purple-400 shrink-0" />
          {task.activity}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-purple-500">{fmtDate(dates.plannedStart)} → {fmtDate(dates.plannedEnd)}</td>
      <td colSpan={6} />
    </tr>
  );
}

// ── PhaseSection (fases do template) ──────────────────────────────────────────
function PhaseSection({
  phaseName, tasks, computedDates, manualOverrides, activitiesByTask, localActivities,
  onSaveOverride, onRemoveOverride, onSaveActivity, onInactivateTask, onCompletePhase, onAddActivity,
  onActivityUpdated, onActivityRemoved,
  project, templateConfig, readOnly,
  canCompletePhase, canEditPlanned, canEditExecuted, canAddActivity, canEditActivity = true, canExcluirActivity = true, showInactive,
  phaseOverride, onEditOverride, onInactivate, onReactivate,
  canEditPhase, canExcluirPhase,
  dependencies, activitiesMap, onOpenDependencyModal,
  // Drag & drop (estado compartilhado — vem do ScheduleTab)
  draggedId, dragOverId,
  onDragStartActivity, onDragOverActivity, onDropOnActivity, onDragEndActivity,
  onDropOnPhaseHeader,
}) {
  const [open, setOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerDragOver, setHeaderDragOver] = useState(false);

  const isInactive = phaseOverride?.is_active === false;
  const displayName = phaseOverride?.custom_name || phaseName;

  const visibleTasks = tasks.filter(t => {
    if (t.type !== "task") return false;
    // Oculta tarefas do template que foram inativadas (via ScheduleActivity com [INATIVADO])
    const act = activitiesByTask[t.id];
    if (act && act.status === "Cancelado" && (act.history_observations || "").includes("[INATIVADO]")) {
      return showInactive; // só mostra se toggle de inativos ativo
    }
    return true;
  });
  const phaseLocalActivities = localActivities.filter(a => a.phase_name === phaseName);
  const activeLocalActivities = phaseLocalActivities.filter(a =>
    !(a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]"))
  );
  const total = visibleTasks.length + (showInactive ? phaseLocalActivities.length : activeLocalActivities.length);

  if (visibleTasks.length === 0 && phaseLocalActivities.length === 0) return null;

  return (
    <div className={`mb-2 rounded-xl border overflow-hidden shadow-sm ${isInactive ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
      <div
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none flex-wrap ${isInactive ? "bg-slate-400" : "bg-blue-600"} ${headerDragOver ? "ring-2 ring-blue-300 ring-inset" : ""}`}
        onClick={() => setOpen(o => !o)}
        onDragOver={(e) => { if (draggedId) { e.preventDefault(); setHeaderDragOver(true); } }}
        onDragLeave={() => setHeaderDragOver(false)}
        onDrop={(e) => { setHeaderDragOver(false); if (onDropOnPhaseHeader) onDropOnPhaseHeader(e, phaseName); }}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white shrink-0" /> : <ChevronRight className="w-4 h-4 text-white shrink-0" />}
        <h3 className="text-sm font-bold text-white flex-1 min-w-0">{displayName}</h3>
        {isInactive && (
          <span className="text-xs bg-slate-500 text-white px-2 py-0.5 rounded-full font-medium shrink-0">Inativa neste projeto</span>
        )}
        {phaseOverride?.custom_name && (
          <span className="text-xs bg-blue-500/50 text-blue-100 px-2 py-0.5 rounded-full font-medium shrink-0">Personalizada</span>
        )}
        <span className={`text-xs shrink-0 ${isInactive ? "text-slate-300" : "text-blue-200"}`}>{total} atividade(s)</span>

        <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>
          {!readOnly && !isInactive && canCompletePhase && (
            <button
              onClick={async () => { setCompleting(true); await onCompletePhase(visibleTasks); setCompleting(false); }}
              disabled={completing}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Concluir fase
            </button>
          )}
          {!readOnly && !isInactive && canAddActivity && (
            <button
              onClick={() => onAddActivity(phaseName)}
              className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              <Plus className="w-3 h-3" /> Adicionar atividade
            </button>
          )}
          {/* Menu ⋯ de override */}
          {(canEditPhase || canExcluirPhase) && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen(m => !m)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
                title="Ações da fase neste projeto"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[200px]">
                    {canEditPhase && !isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onEditOverride(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar fase neste projeto
                      </button>
                    )}
                    {canExcluirPhase && !isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onInactivate(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Inativar fase neste projeto
                      </button>
                    )}
                    {isInactive && (
                      <button
                        onClick={() => { setMenuOpen(false); onReactivate(phaseName); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Reativar fase neste projeto
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {open && phaseOverride?.observations && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 italic">
          {phaseOverride.observations}
        </div>
      )}

      {open && (
        <div>
          <table className="w-full">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-2 py-2.5">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Início Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Fim Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Início Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Fim Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Resp. Geral</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Resp. Líder</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1 py-2.5">Obs.</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-1 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                if (task.type === "group") return <GroupRow key={task.id} task={task} computedDates={computedDates} />;
                if (task.type === "subgroup") return <SubGroupRow key={task.id} task={task} computedDates={computedDates} />;
                if (task.type === "task") {
                  const isSubActivity = !!task.parentGroup;
                  return (
                    <TemplateTaskRow
                      key={task.id} task={task} computedDates={computedDates} manualOverrides={manualOverrides}
                      onSaveOverride={onSaveOverride} onRemoveOverride={onRemoveOverride} onSaveActivity={onSaveActivity}
                      onInactivateTask={onInactivateTask}
                      existingActivity={activitiesByTask[task.id]} project={project} templateConfig={templateConfig}
                      readOnly={readOnly} canEditPlanned={canEditPlanned} canEditExecuted={canEditExecuted}
                      indented={isSubActivity}
                      dependencies={dependencies} activitiesMap={activitiesMap} onOpenDependencyModal={onOpenDependencyModal}
                      draggable={!readOnly && !isInactive && !!onDropOnActivity}
                      onDragStart={onDragStartActivity} onDragOver={onDragOverActivity}
                      onDrop={onDropOnActivity} onDragEnd={onDragEndActivity}
                      isDragged={draggedId === `tmpl:${task.id}`}
                      isDragOver={dragOverId === `tmpl:${task.id}`}
                    />
                  );
                }
                return null;
              })}
              {phaseLocalActivities.map(act => (
                <LocalActivityRow
                  key={act.id} activity={act}
                  onUpdated={onActivityUpdated}
                  onRemoved={onActivityRemoved}
                  readOnly={readOnly}
                  showInactive={showInactive}
                  canEdit={canEditActivity}
                  canExcluir={canExcluirActivity}
                  draggable={!readOnly && !isInactive && !!onDropOnActivity}
                  onDragStart={onDragStartActivity} onDragOver={onDragOverActivity}
                  onDrop={onDropOnActivity} onDragEnd={onDragEndActivity}
                  isDragged={draggedId === `local:${act.id}`}
                  isDragOver={dragOverId === `local:${act.id}`}
                  dependencies={dependencies} activitiesMap={activitiesMap} onOpenDependencyModal={onOpenDependencyModal}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SyncPipedriveButton({ projectId, onSuccess, onReload }) {
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    setLoading(true); setResult(null); setError(null); setShowDetails(false);
    try {
      const res  = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId });
      const data = res.data;
      if (data.error) setError(data.detail || data.error);
      else { setResult(data); if (onReload) onReload(); if (onSuccess) onSuccess(); }
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={handleSync} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100 disabled:opacity-60">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Atualizar Cronograma (Pipedrive)
      </button>
      {result && (
        <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-sm text-right w-full">
          <div className="flex items-center justify-between gap-2 text-green-800">
            <span>✓ Deal #{result.deal_id} · Stage {result.deal_stage_id}</span>
            <button onClick={() => setShowDetails(v => !v)} className="text-green-600 underline shrink-0">{showDetails ? "ocultar" : "detalhes"}</button>
          </div>
          <div className="text-green-700 mt-0.5">{result.updated} atualizada(s) · {result.created > 0 ? `${result.created} criada(s) · ` : ""}{result.rules_applied} regra(s)</div>
          {showDetails && result.match_errors?.length > 0 && (
            <div className="mt-1 text-amber-700 text-left">
              <p className="font-bold">Inconsistências:</p>
              <ul className="list-disc pl-4">{result.match_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 max-w-sm text-right w-full">Erro: {error}</div>}
    </div>
  );
}

function CompleteProjectButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  return (
    <button
      onClick={async () => { setLoading(true); await onComplete(); setLoading(false); setDone(true); setTimeout(() => setDone(false), 3000); }}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-green-50 text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
      {done ? "Cronograma atualizado!" : "Concluir projeto conforme planejado"}
    </button>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function ScheduleTab({
  scopeItems, project, projectId, onRefresh, onStatusPromoted, readOnly = false, onSyncSuccess,
  canEditPlanned = true, canCompletePhase = true, canRecalculate = true, canSyncPipedrive = true,
  canEditExecuted = true, canAddActivity = true,
  canCreatePhase = true, canEditPhase = true, canExcluirPhase = true,
  canExcluirActivity = true,
  canGeneratePDF = true,
}) {
  const [anchorsLoaded, setAnchorsLoaded]       = useState(false);
  const [manualOverrides, setManualOverrides]   = useState({});
  const [savedActivities, setSavedActivities]   = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [templateConfig, setTemplateConfig]     = useState({});
  const [showAddModal, setShowAddModal]         = useState(false);
  const [addModalPhase, setAddModalPhase]       = useState(null);
  const [showInactive, setShowInactive]         = useState(false);

  // Fases locais
  const [localPhases, setLocalPhases]           = useState([]);
  const [localPhasesLoaded, setLocalPhasesLoaded] = useState(false);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase]         = useState(null);

  // Overrides de fases do template (por fase canônica)
  const [phaseOverrides, setPhaseOverrides]         = useState({}); // { phaseName: overrideRecord }
  const [phaseOverridesLoaded, setPhaseOverridesLoaded] = useState(false);
  const [showOverrideModal, setShowOverrideModal]   = useState(false);
  const [overrideModalPhase, setOverrideModalPhase] = useState(null);

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);

  // Dependências
  const [dependencies, setDependencies] = useState([]);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [dependencyModalInfo, setDependencyModalInfo] = useState(null);

  // Drag & drop entre fases (estado compartilhado entre todas as fases locais)
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Ref para rastrear se já inicializamos para este projectId
  const initializedForProjectRef = useRef(null);
  // Ref para guardar os overrides que NÓS salvamos (para não serem sobrescritos pelo prop)
  const localSavedOverridesRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;

    // Já inicializado para este projeto: ignora atualizações do prop enquanto
    // temos dados salvos localmente nesta sessão (evita sobrescrever âncoras recém-salvas)
    if (initializedForProjectRef.current === projectId) {
      // Só re-sincroniza se ainda não temos nada salvo localmente (ex: abertura inicial com delay)
      if (localSavedOverridesRef.current !== null) return;
    }

    const raw = project?.schedule_overrides;
    const dbOverrides = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};

    // Primeira inicialização para este projeto
    initializedForProjectRef.current = projectId;
    localSavedOverridesRef.current = null;

    let overrides = { ...dbOverrides };
    // Fallback legado: schedule_anchor_dates
    if (Object.keys(overrides).length === 0) {
      const dbAnchors = project?.schedule_anchor_dates || {};
      Object.entries(dbAnchors).forEach(([taskId, dateStr]) => {
        if (dateStr) overrides[taskId] = { plannedStart: dateStr };
      });
    }
    setManualOverrides(overrides);
    setAnchorsLoaded(true);
  }, [projectId, project?.schedule_overrides, project?.schedule_anchor_dates]);

  const reloadActivities = useCallback(() => {
    if (!projectId) return;
    base44.entities.ScheduleActivity.filter({ project_id: projectId })
      .then(acts => { setSavedActivities(acts || []); setActivitiesLoaded(true); })
      .catch(() => setActivitiesLoaded(true));
  }, [projectId]);

  useEffect(() => {
    if (!activitiesLoaded && projectId) reloadActivities();
  }, [projectId, activitiesLoaded, reloadActivities]);

  // Carregar fases locais — inclui inativas para toggle
  useEffect(() => {
    if (!projectId || localPhasesLoaded) return;
    base44.entities.LocalSchedulePhase.filter({ project_id: projectId })
      .then(list => { setLocalPhases(list || []); setLocalPhasesLoaded(true); })
      .catch(() => setLocalPhasesLoaded(true));
  }, [projectId, localPhasesLoaded]);

  // Carregar overrides de fases do template
  useEffect(() => {
    if (!projectId || phaseOverridesLoaded) return;
    base44.entities.SchedulePhaseOverride.filter({ project_id: projectId })
      .then(list => {
        const map = {};
        (list || []).forEach(o => { map[o.phase_name] = o; });
        setPhaseOverrides(map);
        setPhaseOverridesLoaded(true);
      })
      .catch(() => setPhaseOverridesLoaded(true));
  }, [projectId, phaseOverridesLoaded]);

  useEffect(() => {
    base44.entities.ScheduleTemplate.filter({ is_default: true }).then(list => {
      if (list.length > 0) try { setTemplateConfig(JSON.parse(list[0].tasks_config || "{}")); } catch {}
    }).catch(() => {});
  }, []);

  // Carregar dependências
  useEffect(() => {
    if (!projectId) return;
    base44.entities.ScheduleDependency.filter({ project_id: projectId })
      .then(list => setDependencies(list || []))
      .catch(() => setDependencies([]));
  }, [projectId]);

  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);

  const { dates: computedDates, visible } = useMemo(() => {
    return computeSchedule(SCHEDULE_TASKS, manualOverrides, answersMap, project);
  }, [manualOverrides, answersMap, project]);

  const tasksByPhase = useMemo(() => {
    const grouped = {};
    SCHEDULE_TASKS.forEach(task => {
      if (!visible.has(task.id)) return;
      // Usa a fase efetiva (override de movimentação entre fases ou fase canônica)
      const ph = getTaskPhase(task, manualOverrides) || "Geral";
      if (!grouped[ph]) grouped[ph] = [];
      grouped[ph].push(task);
    });
    // Ordena cada fase pela ordem efetiva (override de reordenação ou row natural)
    Object.keys(grouped).forEach(ph => {
      grouped[ph] = sortTasksByOrder(grouped[ph], manualOverrides);
    });
    return grouped;
  }, [visible, manualOverrides]);

  // ── Cascata de dependências ──────────────────────────────────
  // Recalcula datas de sucessoras quando predecessoras mudam.
  // Só afeta atividades COM dependências definidas — projetos sem
  // dependências não são tocados. É idempotente (não gera loop).
  useEffect(() => {
    if (!dependencies || dependencies.length === 0) return;

    const timer = setTimeout(() => {
      const { overrideUpdates, localUpdates } = cascadeRecalculate({
        dependencies, computedDates, overrides: manualOverrides, localActivities: savedActivities,
      });

      const hasOverride = Object.keys(overrideUpdates).length > 0;
      const hasLocal = Object.keys(localUpdates).length > 0;
      if (!hasOverride && !hasLocal) return;

      (async () => {
        try {
          if (hasOverride) {
            const newOverrides = { ...manualOverrides };
            Object.entries(overrideUpdates).forEach(([taskId, { plannedStart, plannedEnd }]) => {
              newOverrides[taskId] = {
                ...(newOverrides[taskId] || {}),
                plannedStart,
                ...(plannedEnd ? { plannedEnd } : {}),
                _origin: {
                  ...(newOverrides[taskId]?._origin || {}),
                  plannedStart: "dependency",
                  ...(plannedEnd ? { plannedEnd: "dependency" } : {}),
                },
              };
            });
            await base44.entities.Project.update(projectId, { schedule_overrides: newOverrides });
            localSavedOverridesRef.current = newOverrides;
            setManualOverrides(newOverrides);
          }
          if (hasLocal) {
            const updates = Object.entries(localUpdates).map(([id, data]) => ({ id, ...data }));
            await base44.entities.ScheduleActivity.bulkUpdate(updates);
            setSavedActivities(prev => prev.map(a =>
              localUpdates[a.id] ? { ...a, ...localUpdates[a.id] } : a
            ));
          }
        } catch (err) {
          console.error("[ScheduleTab] Erro no recálculo de dependências:", err);
        }
      })();
    }, 200);

    return () => clearTimeout(timer);
  }, [dependencies, computedDates, manualOverrides, savedActivities, projectId]);

  // Classificação consistente com buildProjectScheduleView: casamento por nome + fase,
  // com fallback para atividades órfãs (fase que não é template, nem local, nem custom_name)
  // — mantém visibilidade (anexa ao template task) como no comportamento anterior.
  const { activitiesByTask, localActivities } = useMemo(
    () => classifyScheduleActivities(
      savedActivities,
      localPhases.map(p => p.phase_name),
      Object.values(phaseOverrides).map(o => o.custom_name).filter(Boolean),
    ),
    [savedActivities, localPhases, phaseOverrides],
  );

  // Lista unificada de atividades para o modal de dependências
  const allActivitiesForModal = useMemo(() => {
    const list = [];
    SCHEDULE_TASKS.forEach(t => {
      if (t.type !== "task" || !visible.has(t.id)) return;
      const start = manualOverrides[t.id]?.plannedStart || computedDates[t.id]?.plannedStart;
      list.push({
        ref: buildRef("tmpl", t.id),
        name: t.activity,
        phase: getTaskPhase(t, manualOverrides),
        dateLabel: start ? fmtDate(start) : "—",
      });
    });
    (savedActivities || []).forEach(a => {
      if (a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]")) return;
      list.push({
        ref: buildRef("local", a.id),
        name: a.activity_name,
        phase: a.phase_name,
        dateLabel: a.planned_start ? fmtDate(a.planned_start) : "—",
      });
    });
    return list;
  }, [visible, manualOverrides, computedDates, savedActivities]);

  // Mapa ref → atividade (para lookup de nomes nas badges)
  const activitiesMap = useMemo(() => {
    const map = {};
    allActivitiesForModal.forEach(a => { map[a.ref] = a; });
    return map;
  }, [allActivitiesForModal]);

  // Fases visíveis (respeita toggle showInactive)
  const visibleLocalPhases = useMemo(() => {
    return localPhases
      .filter(p => showInactive || p.is_active !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [localPhases, showInactive]);

  // Fases do template: inclui ou exclui conforme override local + toggle inativos
  const phases = PHASE_ORDER.filter(ph => {
    const hasContent = tasksByPhase[ph]?.some(t => t.type === "task") || localActivities.some(a => a.phase_name === ph);
    if (!hasContent) return false;
    const override = phaseOverrides[ph];
    if (override?.is_active === false) return showInactive;
    return true;
  });

  // ── Lista unificada de fases (template + locais) ordenada por posição ──
  const unifiedPhases = useMemo(() => {
    const items = [];
    // Fases do template
    phases.forEach(ph => {
      items.push({
        key: `tmpl-${ph}`,
        type: 'template',
        phaseName: ph,
        order: PHASE_ORDER.indexOf(ph),
        tasks: tasksByPhase[ph] || [],
        phaseOverride: phaseOverrides[ph],
      });
    });
    // Fases locais (já ordenadas por visibleLocalPhases)
    visibleLocalPhases.forEach(phase => {
      items.push({
        key: `local-${phase.id}`,
        type: 'local',
        phase: phase,
        order: phase.order ?? 99,
      });
    });
    return items.sort((a, b) => a.order - b.order);
  }, [phases, visibleLocalPhases, tasksByPhase, phaseOverrides]);

  const handleSaveOverride = useCallback(async (taskId, payload) => {
    const prevOverrides = manualOverrides;
    const nextOverrides = { ...prevOverrides, [taskId]: { ...(prevOverrides[taskId] || {}), ...payload } };

    // Optimistic update — atualiza UI imediatamente
    localSavedOverridesRef.current = nextOverrides;
    setManualOverrides(nextOverrides);

    // Persiste no banco (await — se falhar, reverte e propaga erro para o caller)
    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: nextOverrides });
    } catch (err) {
      console.error("[ScheduleTab] Erro ao persistir schedule_overrides:", err);
      // Reverte optimistic update para evitar dados "fantasmas" que somem ao remontar
      localSavedOverridesRef.current = prevOverrides;
      setManualOverrides(prevOverrides);
      throw err;
    }

    // Atualiza o project do parent para que schedule_overrides reflita o save
    // (evita reverter a âncora ao trocar de aba e remontar o componente)
    if (onRefresh) onRefresh();

    // Promoção automática "Em aberto" → "Em andamento" ao editar o cronograma
    const newStatus = await autoPromoteToInProgress(projectId, project?.status);
    if (newStatus !== project?.status && onStatusPromoted) onStatusPromoted();
  }, [projectId, project?.status, onStatusPromoted, onRefresh, manualOverrides]);

  const handleRemoveOverride = useCallback(async (taskId, field) => {
    const prevOverrides = manualOverrides;
    const current = { ...(prevOverrides[taskId] || {}) };
    delete current[field];
    if (current._origin) delete current._origin[field];
    const keysLeft = Object.keys(current).filter(k => k !== "_origin");
    let nextOverrides;
    if (keysLeft.length === 0) {
      nextOverrides = { ...prevOverrides };
      delete nextOverrides[taskId];
    } else {
      nextOverrides = { ...prevOverrides, [taskId]: current };
    }

    // Optimistic update
    localSavedOverridesRef.current = nextOverrides;
    setManualOverrides(nextOverrides);

    // Persiste no banco (await — se falhar, reverte)
    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: nextOverrides });
    } catch (err) {
      console.error("[ScheduleTab] Erro ao remover override:", err);
      localSavedOverridesRef.current = prevOverrides;
      setManualOverrides(prevOverrides);
      return;
    }

    // Atualiza o project do parent para que schedule_overrides reflita o save
    if (onRefresh) onRefresh();
  }, [projectId, onRefresh, manualOverrides]);

  const handleSaveActivity = useCallback(async (task, data) => {
    const existing = activitiesByTask[task.id];
    const payload = {
      actual_start:         data.actual_start || null,
      actual_end:           data.actual_end   || null,
      status:               data.status       || "Não iniciado",
      history_observations: data.history_observations || "",
      responsible_leader:   data.responsible_leader   || "",
      responsible_general:  data.responsible_general  || "",
    };
    if (existing) {
      await base44.entities.ScheduleActivity.update(existing.id, payload);
      setSavedActivities(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a));
      logAudit({ project_id: projectId, screen: "Cronograma", field: `Atividade: ${task.activity}`, old_value: existing.status || "", new_value: payload.status });
    } else {
      const created = await base44.entities.ScheduleActivity.create({
        project_id: projectId, phase_name: task.phase, activity_name: task.activity, order: task.row, ...payload
      });
      setSavedActivities(prev => [...prev, created]);
      logAudit({ project_id: projectId, screen: "Cronograma", field: `Atividade (criada): ${task.activity}`, new_value: payload.status });
    }
    // Promoção automática "Em aberto" → "Em andamento" ao editar o cronograma
    const newStatus = await autoPromoteToInProgress(projectId, project?.status);
    if (newStatus !== project?.status && onStatusPromoted) onStatusPromoted();
  }, [activitiesByTask, projectId, project?.status, onStatusPromoted]);

  // ── Dependências ──────────────────────────────────────────────
  const handleOpenDependencyModal = useCallback((ref, name) => {
    setDependencyModalInfo({ ref, name });
    setShowDependencyModal(true);
  }, []);

  const handleSaveDependencies = useCallback(async (successorRef, selectedRefs, offset) => {
    // Validação de ciclos
    const otherDeps = dependencies.filter(d => d.successor_ref !== successorRef);
    for (const ref of selectedRefs) {
      if (wouldCreateCycle(otherDeps, successorRef, ref)) {
        throw new Error("Dependência circular detectada. Não é possível criar este vínculo.");
      }
    }

    const currentDeps = dependencies.filter(d => d.successor_ref === successorRef);
    const currentPreds = new Set(currentDeps.map(d => d.predecessor_ref));

    // Deletar removidas
    await Promise.all(
      currentDeps
        .filter(d => !selectedRefs.includes(d.predecessor_ref))
        .map(d => base44.entities.ScheduleDependency.delete(d.id))
    );
    // Criar novas
    await Promise.all(
      selectedRefs
        .filter(ref => !currentPreds.has(ref))
        .map(ref => base44.entities.ScheduleDependency.create({
          project_id: projectId, successor_ref: successorRef,
          predecessor_ref: ref, start_offset_days: offset,
        }))
    );
    // Atualizar offset das existentes
    await Promise.all(
      currentDeps
        .filter(d => selectedRefs.includes(d.predecessor_ref) && d.start_offset_days !== offset)
        .map(d => base44.entities.ScheduleDependency.update(d.id, { start_offset_days: offset }))
    );

    // Recarregar dependências
    const refreshed = await base44.entities.ScheduleDependency.filter({ project_id: projectId });
    setDependencies(refreshed || []);

    // Forçar recálculo da sucessora
    const { type, id } = parseRef(successorRef);

    if (selectedRefs.length === 0) {
      // Sem predecessoras — remover override de dependência (template volta à fórmula)
      if (type === "tmpl") {
        const existing = manualOverrides[id];
        if (existing?._origin?.plannedStart === "dependency") {
          const newOverrides = { ...manualOverrides };
          const updated = { ...existing };
          delete updated.plannedStart;
          if (updated._origin) {
            delete updated._origin.plannedStart;
            if (Object.keys(updated._origin).length === 0) delete updated._origin;
          }
          const hasContent = Object.keys(updated).some(k => k !== "_origin") || updated._origin;
          if (!hasContent) delete newOverrides[id];
          else newOverrides[id] = updated;
          await base44.entities.Project.update(projectId, { schedule_overrides: newOverrides });
          localSavedOverridesRef.current = newOverrides;
          setManualOverrides(newOverrides);
        }
      }
    } else {
      const depsForThis = selectedRefs.map(ref => ({ predecessor_ref: ref, start_offset_days: offset }));
      const newStart = computeSuccessorStart(depsForThis, (ref) =>
        getActivityEnd(ref, computedDates, manualOverrides, savedActivities)
      );

      if (newStart) {
        if (type === "tmpl") {
          const task = SCHEDULE_TASKS.find(t => t.id === id);
          const currentEnd = getActivityEnd(successorRef, computedDates, manualOverrides, savedActivities);
          const newEnd = computeTemplateEnd(task, newStart, currentEnd);
          const newOverrides = {
            ...manualOverrides,
            [id]: {
              ...(manualOverrides[id] || {}),
              plannedStart: newStart,
              ...(newEnd ? { plannedEnd: newEnd } : {}),
              _origin: {
                ...(manualOverrides[id]?._origin || {}),
                plannedStart: "dependency",
                ...(newEnd ? { plannedEnd: "dependency" } : {}),
              },
            },
          };
          await base44.entities.Project.update(projectId, { schedule_overrides: newOverrides });
          localSavedOverridesRef.current = newOverrides;
          setManualOverrides(newOverrides);
        } else if (type === "local") {
          const act = savedActivities.find(a => a.id === id);
          const oldStart = act?.planned_start;
          const oldEnd = act?.planned_end;
          const durationDays = computeDurationDays(oldStart, oldEnd);
          const newEnd = durationDays > 0 ? workday(newStart, durationDays) : (oldEnd || null);
          await base44.entities.ScheduleActivity.update(id, { planned_start: newStart, planned_end: newEnd });
          setSavedActivities(prev => prev.map(a => a.id === id ? { ...a, planned_start: newStart, planned_end: newEnd } : a));
        }
      }
    }
  }, [dependencies, projectId, manualOverrides, computedDates, savedActivities]);

  const handleCompleteAsTasks = useCallback(async (tasks) => {
    await Promise.all(
      tasks
        .filter(task => !activitiesByTask[task.id]?.actual_start && !activitiesByTask[task.id]?.actual_end)
        .map(task => {
          const d        = computedDates[task.id] || {};
          const override = manualOverrides[task.id] || {};
          return handleSaveActivity(task, {
            actual_start: override.plannedStart || d.plannedStart || null,
            actual_end:   override.plannedEnd   || d.plannedEnd   || null,
            status:       "Concluído",
            history_observations: activitiesByTask[task.id]?.history_observations || "",
            responsible_leader:   activitiesByTask[task.id]?.responsible_leader   || task.responsibleLeader  || "",
            responsible_general:  activitiesByTask[task.id]?.responsible_general  || task.responsibleGeneral || "",
          });
        })
    );
  }, [activitiesByTask, computedDates, manualOverrides, handleSaveActivity]);

  const handleAddLocalActivity = async (data) => {
    try {
      const created = await base44.entities.ScheduleActivity.create(data);
      setSavedActivities(prev => [...prev, created]);
    } catch (err) {
      console.error("[ScheduleTab] Erro ao criar atividade local:", err);
      throw err; // Relança para o modal capturar e exibir
    }
  };

  // Reordena atividades locais dentro de uma fase — persiste novo `order` via bulkUpdate
  const handleReorderLocalActivities = useCallback(async (orderedIds) => {
    if (!orderedIds || orderedIds.length === 0) return;
    // Atualiza estado local imediatamente (optimistic)
    setSavedActivities(prev => {
      const orderMap = {};
      orderedIds.forEach((id, i) => { orderMap[id] = i; });
      return prev.map(a => orderMap[a.id] !== undefined ? { ...a, order: orderMap[a.id] } : a);
    });
    // Persiste no banco
    try {
      const updates = orderedIds.map((id, i) => ({ id, order: i }));
      await base44.entities.ScheduleActivity.bulkUpdate(updates);
    } catch (err) {
      console.error("[ScheduleTab] Erro ao reordenar atividades:", err);
      toast({ title: "Erro ao reordenar atividades. Tente novamente.", variant: "destructive" });
    }
  }, []);

  // ── Drag & drop unificado (template + local) usando refs ────────────────────
  const handleDragStartActivity = useCallback((ref) => {
    setDraggedId(ref);
  }, []);

  const handleDragOverActivity = useCallback((e, ref) => {
    e.preventDefault();
    if (ref === draggedId) return;
    setDragOverId(ref);
  }, [draggedId]);

  const handleDragEndActivity = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  // Reordena atividades do template dentro de uma fase — persiste order em schedule_overrides
  const handleReorderTemplateTasks = useCallback(async (phaseName, draggedTaskId, targetTaskId) => {
    const phaseTasks = SCHEDULE_TASKS.filter(t =>
      t.type === "task" && visible.has(t.id) && getTaskPhase(t, manualOverrides) === phaseName
    ).sort((a, b) => getTaskOrder(a, manualOverrides) - getTaskOrder(b, manualOverrides));

    const reordered = [...phaseTasks];
    const fromIdx = reordered.findIndex(t => t.id === draggedTaskId);
    const toIdx = reordered.findIndex(t => t.id === targetTaskId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Atribui ordem sequencial a todas as tasks da fase
    const newOverrides = { ...manualOverrides };
    reordered.forEach((t, idx) => {
      newOverrides[t.id] = { ...(newOverrides[t.id] || {}), order: idx };
    });

    const prevOverrides = manualOverrides;
    localSavedOverridesRef.current = newOverrides;
    setManualOverrides(newOverrides);

    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: newOverrides });
      const newStatus = await autoPromoteToInProgress(projectId, project?.status);
      if (newStatus !== project?.status && onStatusPromoted) onStatusPromoted();
    } catch (err) {
      console.error("[ScheduleTab] Erro ao reordenar template tasks:", err);
      localSavedOverridesRef.current = prevOverrides;
      setManualOverrides(prevOverrides);
      toast({ title: "Erro ao reordenar atividades. Tente novamente.", variant: "destructive" });
    }
  }, [visible, manualOverrides, projectId, project?.status, onStatusPromoted]);

  // Move atividade do template para outra fase — persiste phase_name + order em schedule_overrides
  const handleMoveTemplateTask = useCallback(async (taskId, targetPhaseName) => {
    const targetPhaseTasks = SCHEDULE_TASKS.filter(t =>
      t.type === "task" && visible.has(t.id) && getTaskPhase(t, manualOverrides) === targetPhaseName
    ).sort((a, b) => getTaskOrder(a, manualOverrides) - getTaskOrder(b, manualOverrides));

    const newOrder = targetPhaseTasks.length > 0
      ? Math.max(...targetPhaseTasks.map(t => getTaskOrder(t, manualOverrides))) + 1
      : 0;

    const newOverrides = {
      ...manualOverrides,
      [taskId]: { ...(manualOverrides[taskId] || {}), phase_name: targetPhaseName, order: newOrder },
    };

    const prevOverrides = manualOverrides;
    localSavedOverridesRef.current = newOverrides;
    setManualOverrides(newOverrides);

    try {
      await base44.entities.Project.update(projectId, { schedule_overrides: newOverrides });
      const newStatus = await autoPromoteToInProgress(projectId, project?.status);
      if (newStatus !== project?.status && onStatusPromoted) onStatusPromoted();
    } catch (err) {
      console.error("[ScheduleTab] Erro ao mover template task:", err);
      localSavedOverridesRef.current = prevOverrides;
      setManualOverrides(prevOverrides);
      toast({ title: "Erro ao mover atividade. Tente novamente.", variant: "destructive" });
    }
  }, [visible, manualOverrides, projectId, project?.status, onStatusPromoted]);

  // Move atividade local para outra fase — atualiza phase_name + order via ScheduleActivity
  const handleMoveLocalActivity = useCallback(async (activityId, targetPhaseName) => {
    const draggedAct = savedActivities.find(a => a.id === activityId);
    if (!draggedAct) return;
    const sourcePhase = draggedAct.phase_name;
    if (sourcePhase === targetPhaseName) return;

    const targetPhaseActs = savedActivities
      .filter(a => a.phase_name === targetPhaseName)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const newOrder = targetPhaseActs.length > 0
      ? Math.max(...targetPhaseActs.map(a => a.order ?? 0)) + 1
      : 0;

    setSavedActivities(prev => prev.map(a =>
      a.id === activityId ? { ...a, phase_name: targetPhaseName, order: newOrder } : a
    ));
    try {
      await base44.entities.ScheduleActivity.update(activityId, { phase_name: targetPhaseName, order: newOrder });
    } catch (err) {
      console.error("[ScheduleTab] Erro ao mover atividade entre fases:", err);
      toast({ title: "Erro ao mover atividade. Tente novamente.", variant: "destructive" });
      setSavedActivities(prev => prev.map(a =>
        a.id === activityId ? { ...a, phase_name: sourcePhase, order: draggedAct.order } : a
      ));
    }
  }, [savedActivities]);

  // Drop sobre uma atividade — reordena (mesma fase, mesmo tipo) ou move (fase diferente)
  const handleDropOnActivity = useCallback(async (e, targetRef) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetRef) {
      setDraggedId(null); setDragOverId(null);
      return;
    }

    const src = parseRef(draggedId);
    const tgt = parseRef(targetRef);

    // Determina fase destino
    let targetPhase;
    if (tgt.type === "tmpl") {
      const tgtTask = SCHEDULE_TASKS.find(t => t.id === tgt.id);
      if (!tgtTask) { setDraggedId(null); setDragOverId(null); return; }
      targetPhase = getTaskPhase(tgtTask, manualOverrides);
    } else {
      const tgtAct = savedActivities.find(a => a.id === tgt.id);
      if (!tgtAct) { setDraggedId(null); setDragOverId(null); return; }
      targetPhase = tgtAct.phase_name;
    }

    // Determina fase origem
    let sourcePhase;
    if (src.type === "tmpl") {
      const srcTask = SCHEDULE_TASKS.find(t => t.id === src.id);
      if (!srcTask) { setDraggedId(null); setDragOverId(null); return; }
      sourcePhase = getTaskPhase(srcTask, manualOverrides);
    } else {
      const srcAct = savedActivities.find(a => a.id === src.id);
      if (!srcAct) { setDraggedId(null); setDragOverId(null); return; }
      sourcePhase = srcAct.phase_name;
    }

    // Mesma fase → reordenar (apenas mesmo tipo)
    if (sourcePhase === targetPhase) {
      if (src.type === "tmpl" && tgt.type === "tmpl") {
        await handleReorderTemplateTasks(sourcePhase, src.id, tgt.id);
      } else if (src.type === "local" && tgt.type === "local") {
        const phaseActs = savedActivities
          .filter(a => a.phase_name === sourcePhase && !(a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]")))
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        const reordered = [...phaseActs];
        const fromIdx = reordered.findIndex(a => a.id === src.id);
        const toIdx = reordered.findIndex(a => a.id === tgt.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = reordered.splice(fromIdx, 1);
          reordered.splice(toIdx, 0, moved);
          await handleReorderLocalActivities(reordered.map(a => a.id));
        }
      }
      setDraggedId(null); setDragOverId(null);
      return;
    }

    // Fase diferente → mover
    if (src.type === "tmpl") {
      // Template task: só move para fases canônicas (PHASE_ORDER)
      if (!PHASE_ORDER.includes(targetPhase)) {
        setDraggedId(null); setDragOverId(null);
        return;
      }
      await handleMoveTemplateTask(src.id, targetPhase);
    } else {
      // Atividade local: move para qualquer fase
      await handleMoveLocalActivity(src.id, targetPhase);
    }

    setDraggedId(null); setDragOverId(null);
  }, [draggedId, savedActivities, manualOverrides, handleReorderTemplateTasks, handleMoveTemplateTask, handleMoveLocalActivity, handleReorderLocalActivities]);

  // Drop sobre o cabeçalho da fase — move atividade para o final da fase destino
  const handleDropOnPhaseHeader = useCallback(async (e, targetPhaseName) => {
    e.preventDefault();
    if (!draggedId) { setDraggedId(null); setDragOverId(null); return; }

    const src = parseRef(draggedId);

    if (src.type === "tmpl") {
      const srcTask = SCHEDULE_TASKS.find(t => t.id === src.id);
      if (!srcTask) { setDraggedId(null); setDragOverId(null); return; }
      const sourcePhase = getTaskPhase(srcTask, manualOverrides);
      if (sourcePhase === targetPhaseName) { setDraggedId(null); setDragOverId(null); return; }
      // Template task: só move para fases canônicas (PHASE_ORDER)
      if (!PHASE_ORDER.includes(targetPhaseName)) { setDraggedId(null); setDragOverId(null); return; }
      await handleMoveTemplateTask(src.id, targetPhaseName);
    } else {
      const srcAct = savedActivities.find(a => a.id === src.id);
      if (!srcAct) { setDraggedId(null); setDragOverId(null); return; }
      await handleMoveLocalActivity(src.id, targetPhaseName);
    }

    setDraggedId(null); setDragOverId(null);
  }, [draggedId, savedActivities, manualOverrides, handleMoveTemplateTask, handleMoveLocalActivity]);

  // Handlers para overrides de fases do template
  const handleInactivateTemplatePhase = useCallback(async (phaseName) => {
    try {
      const existing = phaseOverrides[phaseName];
      const user = await base44.auth.me().catch(() => null);
      const payload = {
        project_id: projectId, phase_name: phaseName, is_active: false,
        updated_by: user?.full_name || user?.email || "", updated_at: new Date().toISOString(),
      };
      let saved;
      if (existing?.id) {
        await base44.entities.SchedulePhaseOverride.update(existing.id, payload);
        saved = { ...existing, ...payload };
      } else {
        saved = await base44.entities.SchedulePhaseOverride.create(payload);
      }
      setPhaseOverrides(prev => ({ ...prev, [phaseName]: saved }));
    } catch (err) {
      console.error("[ScheduleTab] Erro ao inativar fase:", phaseName, err);
      toast({ title: "Erro ao inativar fase. Verifique suas permissões ou tente novamente.", variant: "destructive" });
    }
  }, [phaseOverrides, projectId]);

  const handleReactivateTemplatePhase = useCallback(async (phaseName) => {
    try {
      const existing = phaseOverrides[phaseName];
      if (!existing?.id) return;
      const user = await base44.auth.me().catch(() => null);
      const payload = { is_active: true, updated_by: user?.full_name || user?.email || "", updated_at: new Date().toISOString() };
      await base44.entities.SchedulePhaseOverride.update(existing.id, payload);
      setPhaseOverrides(prev => ({ ...prev, [phaseName]: { ...existing, ...payload } }));
    } catch (err) {
      console.error("[ScheduleTab] Erro ao reativar fase:", phaseName, err);
      toast({ title: "Erro ao reativar fase. Verifique suas permissões ou tente novamente.", variant: "destructive" });
    }
  }, [phaseOverrides]);

  const handleSavePhaseOverride = useCallback((saved) => {
    setPhaseOverrides(prev => ({ ...prev, [saved.phase_name]: saved }));
    setShowOverrideModal(false);
    setOverrideModalPhase(null);
  }, []);

  const handleInactivateTemplateActivity = useCallback(async (task) => {
    const existing = activitiesByTask[task.id];
    const payload = {
      status: "Cancelado",
      history_observations: (existing?.history_observations || "").replace(" [INATIVADO]", "") + " [INATIVADO]",
    };
    if (existing) {
      await base44.entities.ScheduleActivity.update(existing.id, payload);
      setSavedActivities(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a));
    } else {
      const created = await base44.entities.ScheduleActivity.create({
        project_id: projectId, phase_name: task.phase, activity_name: task.activity,
        order: task.row, status: "Cancelado",
        history_observations: " [INATIVADO]",
      });
      setSavedActivities(prev => [...prev, created]);
    }
  }, [activitiesByTask, projectId]);

  // Lista de nomes de fase para o modal de atividade
  const allPhaseNames = useMemo(() => {
    const templatePhases = PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task"));
    const localPhaseNames = localPhases.filter(p => p.is_active !== false).map(p => p.phase_name);
    return [...new Set([...templatePhases, ...localPhaseNames])];
  }, [tasksByPhase, localPhases]);


  const anchors = SCHEDULE_TASKS.filter(t => t.plannedStart?.type === "anchor");
  const anchorsSavedInDB = project?.schedule_anchor_dates && Object.values(project.schedule_anchor_dates).some(Boolean);

  // Estado local para edição silenciosa das âncoras (blur-based save)
  const [anchorEditValues, setAnchorEditValues] = useState({});
  const inactiveLocalCount = localPhases.filter(p => p.is_active === false).length;
  const inactiveTemplatePhaseCount = Object.values(phaseOverrides).filter(o => o.is_active === false).length;
  const inactiveActivityCount = savedActivities.filter(a =>
    a.status === "Cancelado" && (a.history_observations || "").includes("[INATIVADO]")
  ).length;
  const totalInactiveCount = inactiveLocalCount + inactiveTemplatePhaseCount + inactiveActivityCount;
  const hasInactiveItems = totalInactiveCount > 0;

  const handleGeneratePDF = useCallback(async (selectedCols) => {
    setShowPDFModal(false);
    setGeneratingPDF(true);
    try {
      const doc = await generateSchedulePDF({
        project,
        scopeItems,
        savedActivities,
        localPhases,
        phaseOverrides,
        manualOverrides,
        templateConfig,
        selectedColumns: selectedCols,
      });
      doc.save(`Cronograma_${(project?.client_name || project?.name || "projeto").replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("[ScheduleTab] Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar PDF do cronograma. Tente novamente.", variant: "destructive" });
    }
    setGeneratingPDF(false);
  }, [project, scopeItems, savedActivities, localPhases, phaseOverrides, manualOverrides, templateConfig]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Cronograma Detalhado</h2>
          <p className="text-sm text-slate-400">Gerado automaticamente com base em Dados Iniciais e Escopo Técnico</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {/* Toggle inativos */}
          {hasInactiveItems && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-500 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:bg-slate-50">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 accent-slate-600"
              />
              <Eye className="w-3.5 h-3.5" />
              Mostrar itens inativos
              {totalInactiveCount > 0 && (
                <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {totalInactiveCount}
                </span>
              )}
            </label>
          )}

          {!readOnly && project?.pipedrive_deal_id && canSyncPipedrive && (
            <SyncPipedriveButton projectId={projectId} onReload={reloadActivities} onSuccess={() => { if (onSyncSuccess) onSyncSuccess(); }} />
          )}
          {!readOnly && canRecalculate && (
            <CompleteProjectButton onComplete={async () => {
              const all = SCHEDULE_TASKS.filter(t => {
                if (t.type !== "task" || !visible.has(t.id)) return false;
                const act = activitiesByTask[t.id];
                const isInactivated = act?.status === "Cancelado" && (act?.history_observations || "").includes("[INATIVADO]");
                return !isInactivated;
              });
              await handleCompleteAsTasks(all);
            }} />
          )}
          {canGeneratePDF && (
            <button
              onClick={() => setShowPDFModal(true)}
              disabled={generatingPDF}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 disabled:opacity-60"
            >
              {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Gerar PDF do Cronograma
            </button>
          )}
          <button
            onClick={() => {
              if (window.location.hash === "#presentation") {
                window.location.hash = "";
              } else {
                window.location.hash = "presentation";
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            title={window.location.hash === "#presentation" ? "Sair da tela cheia" : "Expandir tela para apresentação"}
          >
            {window.location.hash === "#presentation" ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {window.location.hash === "#presentation" ? "Recolher" : "Expandir"}
          </button>
          {canCreatePhase && (
            <button
              onClick={() => { setEditingPhase(null); setShowAddPhaseModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
            >
              <Plus className="w-4 h-4" /> Adicionar marco/fase
            </button>
          )}
        </div>
      </div>

      {/* Modal de Seleção de Colunas do PDF */}
      {showPDFModal && (
        <SchedulePDFColumnModal
          onClose={() => setShowPDFModal(false)}
          onGenerate={handleGeneratePDF}
        />
      )}

      {/* Painel de âncoras */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Datas Âncora — editável e recalcula dependentes</p>
          {anchorsSavedInDB && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Database className="w-3 h-3" /> Salvo no banco
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {anchors.map(anchor => {
            const persistedVal = manualOverrides[anchor.id]?.plannedStart || computedDates[anchor.id]?.plannedStart || "";
            const displayVal = anchorEditValues[anchor.id] !== undefined ? anchorEditValues[anchor.id] : persistedVal;
            return (
              <div key={anchor.id} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1 leading-tight">{anchor.activity}</p>
                <input
                  type="date"
                  value={displayVal}
                  onChange={e => {
                    if (readOnly || !canEditPlanned) return;
                    setAnchorEditValues(prev => ({ ...prev, [anchor.id]: e.target.value }));
                  }}
                  onBlur={e => {
                    if (readOnly || !canEditPlanned) return;
                    const newVal = e.target.value;
                    if (newVal !== persistedVal) {
                      handleSaveOverride(anchor.id, { plannedStart: newVal, _origin: { plannedStart: "manual" } })
                        .catch(() => { /* erro já logado e revertido em handleSaveOverride */ });
                    }
                    setAnchorEditValues(prev => {
                      const next = { ...prev };
                      delete next[anchor.id];
                      return next;
                    });
                  }}
                  readOnly={readOnly || !canEditPlanned}
                  disabled={readOnly || !canEditPlanned}
                  className={`w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 ${(readOnly || !canEditPlanned) ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white"}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium"><Anchor className="w-2.5 h-2.5" />Âncora</span>
          Recalcula dependentes
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-slate-100 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded font-medium"><Lock className="w-2.5 h-2.5" />Auto</span>
          Calculada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium"><Pencil className="w-2.5 h-2.5" />Manual</span>
          Override manual
          <RotateCcw className="w-3 h-3 text-slate-400" /> = remover
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded font-medium"><Zap className="w-2.5 h-2.5" />Pipedrive</span>
          Sincronizada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium">Local</span>
          Adicionada neste projeto
        </div>
      </div>

      {!manualOverrides["alinhamento_inicial"]?.plannedStart && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Defina a data do <strong>Alinhamento inicial</strong> no painel acima para calcular o cronograma completo.
        </div>
      )}

      {/* Fases unificadas (template + locais) ordenadas por posição */}
      {unifiedPhases.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma fase visível. Verifique os módulos contratados e o Escopo Técnico.
        </div>
      ) : (
        unifiedPhases.map(item => {
          if (item.type === 'template') {
            return (
              <PhaseSection
                key={item.key} phaseName={item.phaseName} tasks={item.tasks}
                computedDates={computedDates} manualOverrides={manualOverrides}
                activitiesByTask={activitiesByTask} localActivities={localActivities}
                onSaveOverride={readOnly ? () => {} : handleSaveOverride}
                onRemoveOverride={readOnly ? () => {} : handleRemoveOverride}
                onSaveActivity={readOnly ? () => {} : handleSaveActivity}
                onInactivateTask={readOnly ? null : handleInactivateTemplateActivity}
                onCompletePhase={(readOnly || !canCompletePhase) ? () => {} : handleCompleteAsTasks}
                onAddActivity={(phase) => { setAddModalPhase(phase); setShowAddModal(true); }}
                onActivityUpdated={(act) => setSavedActivities(prev => prev.map(a => a.id === act.id ? act : a))}
                onActivityRemoved={(id) => setSavedActivities(prev => prev.filter(a => a.id !== id))}
                project={project} templateConfig={templateConfig}
                readOnly={readOnly} canCompletePhase={canCompletePhase}
                canEditPlanned={canEditPlanned} canEditExecuted={canEditExecuted}
                canAddActivity={canAddActivity}
                canEditActivity={!readOnly}
                canExcluirActivity={!readOnly && canExcluirActivity}
                showInactive={showInactive}
                phaseOverride={item.phaseOverride}
                onEditOverride={(phaseName) => { setOverrideModalPhase(phaseName); setShowOverrideModal(true); }}
                onInactivate={handleInactivateTemplatePhase}
                onReactivate={handleReactivateTemplatePhase}
                canEditPhase={canEditPhase && !readOnly}
                canExcluirPhase={canExcluirPhase && !readOnly}
                dependencies={dependencies} activitiesMap={activitiesMap} onOpenDependencyModal={handleOpenDependencyModal}
                draggedId={draggedId} dragOverId={dragOverId}
                onDragStartActivity={handleDragStartActivity} onDragOverActivity={handleDragOverActivity}
                onDropOnActivity={handleDropOnActivity} onDragEndActivity={handleDragEndActivity}
                onDropOnPhaseHeader={handleDropOnPhaseHeader}
              />
            );
          }
          return (
            <LocalPhaseSection
              key={item.key}
              phase={item.phase}
              localActivities={localActivities}
              onEditPhase={(ph) => { setEditingPhase(ph); setShowAddPhaseModal(true); }}
              onPhaseInactivated={(id) => setLocalPhases(prev => prev.map(p => p.id === id ? { ...p, is_active: false } : p))}
              onPhaseRemoved={(id) => setLocalPhases(prev => prev.filter(p => p.id !== id))}
              onAddActivity={(phaseName) => { setAddModalPhase(phaseName); setShowAddModal(true); }}
              onActivityUpdated={(act) => setSavedActivities(prev => prev.map(a => a.id === act.id ? act : a))}
              onActivityRemoved={(id) => setSavedActivities(prev => prev.filter(a => a.id !== id))}
              onReorder={handleReorderLocalActivities}
              readOnly={readOnly}
              canEditPhase={canEditPhase}
              canExcluirPhase={canExcluirPhase}
              canAddActivity={canAddActivity}
              canEditActivity={!readOnly && canEditExecuted}
              canExcluirActivity={!readOnly && canExcluirActivity}
              showInactive={showInactive}
              dependencies={dependencies} activitiesMap={activitiesMap} onOpenDependencyModal={handleOpenDependencyModal}
              draggedId={draggedId} dragOverId={dragOverId}
              onDragStartActivity={handleDragStartActivity}
              onDragOverActivity={handleDragOverActivity}
              onDropOnActivity={handleDropOnActivity}
              onDragEndActivity={handleDragEndActivity}
              onDropOnPhaseHeader={handleDropOnPhaseHeader}
            />
          );
        })
      )}

      {/* Modal adicionar atividade */}
      {showAddModal && (
        <AddActivityModal
          projectId={projectId}
          project={project}
          defaultPhase={addModalPhase}
          allPhaseNames={allPhaseNames}
          onSave={handleAddLocalActivity}
          onClose={() => { setShowAddModal(false); setAddModalPhase(null); }}
        />
      )}

      {/* Modal adicionar/editar fase */}
      {showAddPhaseModal && (
        <AddPhaseModal
          project={project}
          projectId={projectId}
          phase={editingPhase}
          existingPhases={[...new Set([
            ...PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task")).map(name => ({ phase_name: name, order: PHASE_ORDER.indexOf(name) })),
            ...localPhases.filter(p => p.is_active !== false).map(p => ({ phase_name: p.phase_name, order: p.order ?? 99 })),
          ])].sort((a, b) => a.order - b.order)}
          onSave={(saved) => {
            setLocalPhases(prev => {
              const exists = prev.find(p => p.id === saved.id);
              return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
            });
            setShowAddPhaseModal(false);
            setEditingPhase(null);
          }}
          onClose={() => { setShowAddPhaseModal(false); setEditingPhase(null); }}
        />
      )}

      {/* Modal override de fase do template */}
      {showOverrideModal && overrideModalPhase && (
        <PhaseOverrideModal
          projectId={projectId}
          phaseName={overrideModalPhase}
          existing={phaseOverrides[overrideModalPhase] || null}
          onSave={handleSavePhaseOverride}
          onClose={() => { setShowOverrideModal(false); setOverrideModalPhase(null); }}
        />
      )}

      {/* Agente de Cronograma — chat flutuante */}
      <ScheduleAgentChat
        project={project}
        computedDates={computedDates}
        savedActivities={savedActivities}
        templateConfig={templateConfig}
      />

      {/* Modal de dependências */}
      {showDependencyModal && dependencyModalInfo && (
        <DependencyModal
          successorName={dependencyModalInfo.name}
          activities={allActivitiesForModal}
          currentPredecessors={new Set(
            dependencies
              .filter(d => d.successor_ref === dependencyModalInfo.ref)
              .map(d => d.predecessor_ref)
          )}
          currentOffset={(() => {
            const d = dependencies.find(d => d.successor_ref === dependencyModalInfo.ref);
            return d?.start_offset_days || 0;
          })()}
          onSave={async (selectedRefs, offset) => {
            await handleSaveDependencies(dependencyModalInfo.ref, selectedRefs, offset);
            setShowDependencyModal(false);
            setDependencyModalInfo(null);
          }}
          onClose={() => { setShowDependencyModal(false); setDependencyModalInfo(null); }}
        />
      )}
    </div>
  );
}