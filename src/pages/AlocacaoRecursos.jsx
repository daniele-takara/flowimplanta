import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { computeSchedule } from "@/lib/scheduleEngine";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks";
import { Users, Briefcase, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

// ── Cores por Fase ────────────────────────────────────────────
const PHASE_COLORS = {
  "Abertura de projeto":       { bg: "bg-blue-500",    light: "bg-blue-100",    text: "text-blue-700",   hex: "#3b82f6" },
  "Integração":                { bg: "bg-violet-500",  light: "bg-violet-100",  text: "text-violet-700", hex: "#8b5cf6" },
  "Cadastros":                 { bg: "bg-cyan-500",    light: "bg-cyan-100",    text: "text-cyan-700",   hex: "#06b6d4" },
  "Parametrização":            { bg: "bg-amber-500",   light: "bg-amber-100",   text: "text-amber-700",  hex: "#f59e0b" },
  "Treinamento e Validações":  { bg: "bg-orange-500",  light: "bg-orange-100",  text: "text-orange-700", hex: "#f97316" },
  "Operação Assistida":        { bg: "bg-green-500",   light: "bg-green-100",   text: "text-green-700",  hex: "#22c55e" },
  "Fechamento de Folha":       { bg: "bg-teal-500",    light: "bg-teal-100",    text: "text-teal-700",   hex: "#14b8a6" },
  "Expansão":                  { bg: "bg-indigo-500",  light: "bg-indigo-100",  text: "text-indigo-700", hex: "#6366f1" },
  "Encerramento":              { bg: "bg-slate-500",   light: "bg-slate-100",   text: "text-slate-700",  hex: "#64748b" },
};

const ROLE_LABELS = {
  gerente_projeto:      "Gerente de Projeto",
  analista_implantacao: "Analista de Implantação",
  patrocinador:         "Patrocinador",
  lider_projeto:        "Líder de Projeto",
  ti:                   "TI",
  operacao:             "Operação",
};

// Normaliza string
const norm = s => (s || "").trim().toLowerCase();

// Formata data YYYY-MM-DD → DD/MM
const fmtShort = d => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
};

// Diferença em dias entre duas datas ISO
const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
};

// ── Calcula dados de alocação por projeto ────────────────────
function buildAllocation(projects, activitiesByProject, scopeByProject) {
  // Para cada projeto, rodar computeSchedule e extrair tasks com responsible_leader
  const items = []; // { projectId, projectName, clientName, leader, role, phase, plannedStart, plannedEnd }

  projects.forEach(project => {
    const answersMap = scopeByProject[project.id] || {};
    const anchors = project.schedule_overrides || {};
    const legacyAnchors = project.schedule_anchor_dates || {};
    // Merge overrides
    const mergedAnchors = {};
    Object.entries(legacyAnchors).forEach(([k, v]) => { if (v) mergedAnchors[k] = { plannedStart: v }; });
    Object.entries(anchors).forEach(([k, v]) => { if (v) mergedAnchors[k] = { ...(mergedAnchors[k] || {}), ...v }; });

    const { dates, visible } = computeSchedule(SCHEDULE_TASKS, mergedAnchors, answersMap, project);

    const savedActivities = activitiesByProject[project.id] || [];
    // Indexar por nome normalizado
    const actByName = {};
    savedActivities.forEach(a => { if (a.activity_name) actByName[norm(a.activity_name)] = a; });

    SCHEDULE_TASKS.forEach(task => {
      if (task.type !== "task") return;
      if (!visible.has(task.id)) return;
      const d = dates[task.id];
      if (!d?.plannedStart || !d?.plannedEnd) return;

      // Buscar atividade salva para pegar responsible_leader sobrescrito
      const normTask = norm(task.activity);
      const saved = actByName[normTask] ||
        Object.entries(actByName).find(([k]) => k.includes(normTask) || normTask.includes(k))?.[1];

      // Pular canceladas/inativadas
      if (saved?.status === "Cancelado" && (saved?.history_observations || "").includes("[INATIVADO]")) return;

      // Determinar responsável
      const leader = saved?.responsible_leader || project[`pontotel_${task.responsibleRole || ""}_name`] || "";
      const role = ROLE_LABELS[task.responsibleRole] || ROLE_LABELS[saved?.responsible_role] || "Equipe Pontotel";

      items.push({
        projectId: project.id,
        projectName: project.name || project.client_name,
        clientName: project.client_name,
        leader: leader || "(não atribuído)",
        role,
        phase: task.phase,
        activity: task.activity,
        plannedStart: d.plannedStart,
        plannedEnd: d.plannedEnd,
        taskId: task.id,
      });
    });
  });

  return items;
}

// ── Calcula janela do Gantt ──────────────────────────────────
function calcGanttWindow(items) {
  const today = new Date().toISOString().split("T")[0];
  const starts = items.map(i => i.plannedStart).filter(Boolean);
  const ends   = items.map(i => i.plannedEnd).filter(Boolean);
  if (!starts.length) return { ganttStart: today, ganttEnd: today, totalDays: 1 };
  const ganttStart = starts.reduce((a, b) => a < b ? a : b);
  const ganttEnd   = ends.reduce((a, b) => a > b ? a : b);
  const totalDays  = Math.max(1, daysBetween(ganttStart, ganttEnd));
  return { ganttStart, ganttEnd, totalDays };
}

// ── Componente de barra Gantt ────────────────────────────────
function GanttBar({ item, ganttStart, totalDays }) {
  const left = Math.max(0, daysBetween(ganttStart, item.plannedStart) / totalDays * 100);
  const width = Math.max(0.5, daysBetween(item.plannedStart, item.plannedEnd) / totalDays * 100);
  const color = PHASE_COLORS[item.phase] || { hex: "#94a3b8" };
  const today = new Date().toISOString().split("T")[0];
  const isPast = item.plannedEnd < today;

  return (
    <div className="relative h-7 group">
      <div
        className="absolute top-1 h-5 rounded flex items-center px-1.5 cursor-default overflow-hidden transition-opacity"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          backgroundColor: color.hex,
          opacity: isPast ? 0.45 : 0.85,
          minWidth: "4px",
        }}
        title={`${item.phase}: ${item.activity}\n${item.projectName}\n${fmtShort(item.plannedStart)} → ${fmtShort(item.plannedEnd)}`}
      >
        {width > 4 && (
          <span className="text-white text-[10px] font-medium truncate leading-none select-none">
            {item.clientName || item.projectName}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Cabeçalho de meses do Gantt ──────────────────────────────
function GanttHeader({ ganttStart, totalDays }) {
  const months = [];
  const start = new Date(ganttStart + "T12:00:00");
  const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (true) {
    const monthStart = cur.toISOString().split("T")[0];
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];
    const left = Math.max(0, daysBetween(ganttStart, monthStart) / totalDays * 100);
    const w = daysBetween(
      monthStart < ganttStart ? ganttStart : monthStart,
      monthEnd
    ) / totalDays * 100;
    if (left >= 100) break;
    months.push({ label: `${MONTH_NAMES[cur.getMonth()]}/${cur.getFullYear().toString().slice(2)}`, left, w });
    cur = nextMonth;
    if (months.length > 36) break;
  }

  return (
    <div className="relative h-6 border-b border-slate-200 bg-slate-50">
      {months.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 h-full flex items-center border-r border-slate-200"
          style={{ left: `${m.left}%`, width: `${m.w}%` }}
        >
          <span className="text-[10px] text-slate-500 pl-1 font-medium">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Linha "hoje" ─────────────────────────────────────────────
function TodayLine({ ganttStart, totalDays }) {
  const today = new Date().toISOString().split("T")[0];
  if (today < ganttStart) return null;
  const left = daysBetween(ganttStart, today) / totalDays * 100;
  if (left > 100) return null;
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
      style={{ left: `${left}%` }}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-400 text-white text-[9px] px-1 rounded">Hoje</div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function AlocacaoRecursos() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [groupBy, setGroupBy] = useState("cargo"); // "cargo" | "pessoa"
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getAllocationData");
      setRawData(res.data);
    } catch (e) {
      setError(e.message || "Erro ao carregar dados");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const allItems = useMemo(() => {
    if (!rawData) return [];
    return buildAllocation(
      rawData.projects || [],
      rawData.activitiesByProject || {},
      rawData.scopeByProject || {}
    );
  }, [rawData]);

  const { ganttStart, ganttEnd, totalDays } = useMemo(() => calcGanttWindow(allItems), [allItems]);

  // Agrupar por cargo ou pessoa
  const groups = useMemo(() => {
    const map = {};
    allItems.forEach(item => {
      const key = groupBy === "cargo" ? item.role : (item.leader || "(não atribuído)");
      if (!map[key]) map[key] = { label: key, items: [] };
      map[key].items.push(item);
    });
    // Ordenar grupos alfabeticamente
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }, [allItems, groupBy]);

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Legend
  const usedPhases = useMemo(() => {
    const phases = new Set(allItems.map(i => i.phase));
    return PHASE_ORDER.filter(p => phases.has(p));
  }, [allItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Alocação de Recursos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Projetos ativos · {(rawData?.projects || []).length} projetos · {allItems.length} atividades
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle agrupamento */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button
              onClick={() => setGroupBy("cargo")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${groupBy === "cargo" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <Briefcase className="w-3.5 h-3.5" /> Cargo
            </button>
            <button
              onClick={() => setGroupBy("pessoa")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${groupBy === "pessoa" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <Users className="w-3.5 h-3.5" /> Pessoa
            </button>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Legenda de fases */}
      <div className="flex flex-wrap gap-2">
        {usedPhases.map(phase => {
          const c = PHASE_COLORS[phase] || { hex: "#94a3b8" };
          return (
            <span key={phase} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: c.hex }}></span>
              {phase}
            </span>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Nenhuma atividade encontrada nos projetos em andamento.
        </div>
      )}

      {/* Gantt */}
      {groups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex">
            {/* Coluna fixa esquerda */}
            <div className="w-56 shrink-0 border-r border-slate-200">
              <div className="h-6 border-b border-slate-200 bg-slate-50 flex items-center px-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {groupBy === "cargo" ? "Cargo" : "Pessoa"}
                </span>
              </div>
              {groups.map(group => (
                <div key={group.label}>
                  {/* Cabeçalho do grupo */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    {collapsedGroups[group.label]
                      ? <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
                    <span className="text-xs font-semibold text-slate-700 truncate text-left">{group.label}</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{group.items.length}</span>
                  </button>
                  {/* Linhas de atividades */}
                  {!collapsedGroups[group.label] && group.items.map((item, idx) => (
                    <div
                      key={`${item.projectId}-${item.taskId}-${idx}`}
                      className="flex items-center px-3 h-7 border-b border-slate-100 hover:bg-slate-50"
                    >
                      <span className="text-[11px] text-slate-500 truncate" title={`${item.clientName} · ${item.activity}`}>
                        {item.clientName}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Coluna do Gantt */}
            <div className="flex-1 overflow-x-auto">
              <div style={{ minWidth: "600px" }}>
                {/* Cabeçalho de meses */}
                <GanttHeader ganttStart={ganttStart} totalDays={totalDays} />

                {/* Linhas */}
                {groups.map(group => (
                  <div key={group.label}>
                    {/* Linha do cabeçalho do grupo */}
                    <div className="h-9 bg-slate-50 border-b border-slate-200 relative">
                      <TodayLine ganttStart={ganttStart} totalDays={totalDays} />
                    </div>
                    {/* Linhas de atividades */}
                    {!collapsedGroups[group.label] && group.items.map((item, idx) => (
                      <div
                        key={`${item.projectId}-${item.taskId}-${idx}`}
                        className="border-b border-slate-100 relative"
                      >
                        <TodayLine ganttStart={ganttStart} totalDays={totalDays} />
                        <GanttBar item={item} ganttStart={ganttStart} totalDays={totalDays} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}