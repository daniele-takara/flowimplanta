import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { SCHEDULE_TASKS, PHASE_ORDER, ANCHOR_IDS } from "@/lib/scheduleTasks.js";
import {
  RESPONSIBLE_ROLE_OPTIONS,
  RESPONSIBLE_ROLE_LABELS,
  RESPONSIBLE_GENERAL_TYPE_OPTIONS,
} from "@/lib/resolveResponsibleRole.js";
import {
  Save, Star, Info, ChevronDown, ChevronRight,
  Pencil, Anchor, Lock, Zap
} from "lucide-react";

const inputClass = "px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full";

// ── Helpers para interpretar as fórmulas do scheduleTasks.js ─────────────────

/**
 * Extrai informações legíveis de uma fórmula como:
 *   workday(alinhamento_inicial.plannedStart, 5)
 *   sameDay(plannedStart)
 *   agenda_escopo_tecnico.plannedEnd
 */
function parseFormula(formula, allTasks) {
  if (!formula) return { text: "—", predecessor: null, offset: null, unit: null };

  const taskById = Object.fromEntries(allTasks.map(t => [t.id, t]));

  // workday(ref, N)
  const workdayMatch = formula.match(/^workday\(([^,]+),\s*(-?\d+)\)$/);
  if (workdayMatch) {
    const ref = workdayMatch[1].trim();
    const days = parseInt(workdayMatch[2], 10);
    const { taskName, field } = resolveRef(ref, taskById);
    const sign = days >= 0 ? `+${days}` : `${days}`;
    return {
      text: taskName ? `${sign}d úteis após ${field} de "${taskName}"` : `${sign}d úteis após ${ref}`,
      predecessor: taskName,
      predecessorId: extractTaskId(ref),
      offset: days,
      unit: "dias úteis",
    };
  }

  // sameDay(ref)
  const sameDayMatch = formula.match(/^sameDay\(([^)]+)\)$/);
  if (sameDayMatch) {
    const ref = sameDayMatch[1].trim();
    if (ref === "plannedStart") return { text: "Mesmo dia que Início Planejado (self)", predecessor: null, offset: 0, unit: "—" };
    const { taskName } = resolveRef(ref, taskById);
    return {
      text: taskName ? `Mesmo dia que "${taskName}"` : `Mesmo dia que ${ref}`,
      predecessor: taskName,
      predecessorId: extractTaskId(ref),
      offset: 0,
      unit: "mesmo dia",
    };
  }

  // ref direta: taskId.field
  const directRef = formula.match(/^([a-z_]+)\.(plannedStart|plannedEnd)$/);
  if (directRef) {
    const taskId = directRef[1];
    const field = directRef[2] === "plannedStart" ? "Início" : "Fim";
    const t = taskById[taskId];
    return {
      text: t ? `${field} de "${t.activity}"` : formula,
      predecessor: t?.activity || null,
      predecessorId: taskId,
      offset: 0,
      unit: "mesmo dia",
    };
  }

  // plannedStart (self ref)
  if (formula === "plannedStart") {
    return { text: "Próprio Início Planejado", predecessor: null, offset: 0, unit: "—" };
  }

  return { text: formula, predecessor: null, offset: null, unit: null };
}

function extractTaskId(ref) {
  const m = ref.match(/^([a-z_]+)\./);
  return m ? m[1] : null;
}

function resolveRef(ref, taskById) {
  if (ref === "plannedStart") return { taskName: null, field: "Início" };
  const m = ref.match(/^([a-z_]+)\.(plannedStart|plannedEnd)$/);
  if (m) {
    const t = taskById[m[1]];
    const field = m[2] === "plannedStart" ? "Início" : "Fim";
    return { taskName: t?.activity || m[1], field };
  }
  return { taskName: null, field: ref };
}

/**
 * Descreve a condição de visibilidade de uma task de forma legível.
 */
function describeVisibility(task) {
  const v = task.visibleWhen;
  const vAll = task.visibleWhenAll;
  const vAny = task.visibleWhenAny;

  if (v === "always" || (!v && !vAll && !vAny)) return { label: "Sempre visível", color: "text-green-600 bg-green-50 border-green-200" };

  const fmt = (cond) => {
    if (!cond) return "";
    const src = cond.source || "";
    const part = src.replace("dados_iniciais.", "").replace("escopo.", "q");
    if (cond.equals)       return `${part} = "${cond.equals}"`;
    if (cond.contains)     return `${part} contém "${cond.contains}"`;
    if (cond.notContains)  return `${part} não contém "${cond.notContains}"`;
    if (cond.containsAny)  return `${part} contém ${cond.containsAny.map(x => `"${x}"`).join(" ou ")}`;
    return JSON.stringify(cond);
  };

  if (v && v !== "always") return { label: fmt(v), color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (vAll) return { label: vAll.map(fmt).join(" E "), color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (vAny) return { label: vAny.map(fmt).join(" OU "), color: "text-orange-700 bg-orange-50 border-orange-200" };
  return { label: "Condicional", color: "text-slate-500 bg-slate-50 border-slate-200" };
}

// ── Tipo badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  if (type === "anchor") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      <Anchor className="w-2.5 h-2.5" /> Âncora
    </span>
  );
  if (type === "calculated") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
      <Zap className="w-2.5 h-2.5" /> Calculada
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Pencil className="w-2.5 h-2.5" /> Manual
    </span>
  );
}

// ── Linha de subgrupo ─────────────────────────────────────────────────────────

function SubGroupRow({ task }) {
  const visibility = describeVisibility(task);
  return (
    <tr className="bg-purple-50 border-b border-purple-200">
      <td className="pl-6 pr-4 py-2 text-xs font-semibold text-purple-700" colSpan={7}>
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-3 rounded-full bg-purple-400 shrink-0" />
          {task.activity}
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded border font-normal ${visibility.color}`}>
            {visibility.label}
          </span>
        </span>
      </td>
    </tr>
  );
}

// ── Linha de atividade ────────────────────────────────────────────────────────

function TaskRow({ task, config, onChange, indented = false }) {
  const startSpec = task.plannedStart || {};
  const endSpec   = task.plannedEnd   || {};

  const startInfo    = parseFormula(startSpec.formula, SCHEDULE_TASKS);
  const endInfo      = parseFormula(endSpec.formula,   SCHEDULE_TASKS);
  const fallbackInfo = startSpec.fallback ? parseFormula(startSpec.fallback, SCHEDULE_TASKS) : null;

  const isAnchor  = startSpec.type === "anchor";
  const startType = startSpec.type || "calculated";
  const endType   = endSpec.type   || "calculated";

  const visibility      = describeVisibility(task);
  const isAlwaysVisible = task.visibleWhen === "always" || (!task.visibleWhen && !task.visibleWhenAll && !task.visibleWhenAny);

  const handleChange = (field, value) => {
    onChange(task.id, { [field]: value });
  };

  const genValue  = config?.responsible_general_type || "";
  const roleValue = config?.responsible_role || "";

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      {/* Atividade */}
      <td className={`py-3 text-xs text-slate-800 max-w-[220px] leading-snug font-medium ${indented ? "pl-8 pr-4" : "px-4"}`}>
        <div>
          {indented && <span className="inline-block w-1 h-3 rounded-full bg-purple-300 mr-1.5 align-middle" />}
          {task.activity}
        </div>
        {!isAlwaysVisible && (
          <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded border ${visibility.color} font-normal`}>
            {visibility.label}
          </span>
        )}
      </td>

      {/* Tipo */}
      <td className="px-3 py-3 whitespace-nowrap">
        <TypeBadge type={startType} />
      </td>

      {/* Início Planejado — regra */}
      <td className="px-3 py-3 text-xs text-slate-500 max-w-[200px]">
        {isAnchor ? (
          <span className="text-amber-700 font-medium">Data âncora: <em>{task.activity}</em></span>
        ) : startType === "manual_override" ? (
          <span className="flex items-center gap-1 text-slate-400"><Lock className="w-3 h-3" /> Entrada manual</span>
        ) : (
          <div>
            <span>{startInfo.text}</span>
            {fallbackInfo && (
              <div className="text-xs text-slate-400 mt-0.5 italic">Fallback: {fallbackInfo.text}</div>
            )}
          </div>
        )}
      </td>

      {/* Fim Planejado — regra */}
      <td className="px-3 py-3 text-xs text-slate-500 max-w-[200px]">
        {endType === "anchor" ? (
          <span className="text-amber-700 font-medium">= Início (âncora)</span>
        ) : endType === "manual_override" ? (
          <span className="flex items-center gap-1 text-slate-400"><Lock className="w-3 h-3" /> Entrada manual</span>
        ) : (
          <span>{endInfo.text}</span>
        )}
      </td>

      {/* Recalcula dependentes */}
      <td className="px-3 py-3 text-center text-xs">
        {startSpec.propagates
          ? <span className="text-green-600 font-semibold">✓ Sim</span>
          : <span className="text-slate-300">Não</span>
        }
      </td>

      {/* Resp. Geral — inline editável */}
      <td className="px-3 py-3 min-w-[150px]">
        <select
          value={genValue}
          onChange={e => handleChange("responsible_general_type", e.target.value)}
          className={`${inputClass} ${genValue ? "text-purple-700 border-purple-200 bg-purple-50" : "text-slate-400"}`}
        >
          <option value="">— Não definido —</option>
          {RESPONSIBLE_GENERAL_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* Papel Líder — inline editável */}
      <td className="px-3 py-3 min-w-[170px]">
        <select
          value={roleValue}
          onChange={e => handleChange("responsible_role", e.target.value)}
          className={`${inputClass} ${roleValue ? "text-blue-700 border-blue-200 bg-blue-50" : "text-slate-400"}`}
        >
          <option value="">— Sem papel —</option>
          {RESPONSIBLE_ROLE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// ── Seção de fase ─────────────────────────────────────────────────────────────

function PhaseSection({ phaseName, tasks, tasksConfig, onChangeTask }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-3 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 px-5 py-3.5 bg-blue-600 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white">{phaseName}</h3>
        <span className="text-xs text-blue-200 ml-auto">{tasks.length} atividade(s)</span>
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 min-w-[200px]">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Tipo</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 min-w-[200px]">Regra de Início</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 min-w-[200px]">Regra de Fim</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap text-center">Recalcula</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 min-w-[140px]">Resp. Geral</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 min-w-[160px]">Papel Líder</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                if (task.type === "subgroup") return <SubGroupRow key={task.id} task={task} />;
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    config={tasksConfig[task.id]}
                    onChange={onChangeTask}
                    indented={!!task.parentGroup}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TabCronogramaTemplate() {
  const [template, setTemplate]       = useState(null);
  const [tasksConfig, setTasksConfig] = useState({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await base44.entities.ScheduleTemplate.filter({ is_default: true });
      if (list.length > 0) {
        const tmpl = list[0];
        setTemplate(tmpl);
        try { setTasksConfig(JSON.parse(tmpl.tasks_config || "{}")); }
        catch { setTasksConfig({}); }
      } else {
        const created = await base44.entities.ScheduleTemplate.create({
          name: "Template Padrão",
          is_default: true,
          description: "Template base para todos os novos projetos Pontotel",
          tasks_config: "{}",
        });
        setTemplate(created);
        setTasksConfig({});
      }
      setLoading(false);
    })();
  }, []);

  const handleChangeTask = (taskId, values) => {
    setTasksConfig(prev => ({ ...prev, [taskId]: { ...(prev[taskId] || {}), ...values } }));
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    await base44.entities.ScheduleTemplate.update(template.id, {
      tasks_config: JSON.stringify(tasksConfig),
    });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  // Agrupa tasks e subgroups por fase (type=task ou subgroup, sem grupos de fase)
  const TASK_LIST = SCHEDULE_TASKS.filter(t => t.type === "task");
  const tasksByPhase = {};
  SCHEDULE_TASKS.filter(t => t.type === "task" || t.type === "subgroup").forEach(t => {
    const ph = t.phase || "Geral";
    if (!tasksByPhase[ph]) tasksByPhase[ph] = [];
    tasksByPhase[ph].push(t);
  });
  // Ordenar por row para garantir sequência correta
  Object.values(tasksByPhase).forEach(arr => arr.sort((a, b) => (a.row ?? 0) - (b.row ?? 0)));
  const phases = PHASE_ORDER.filter(ph => tasksByPhase[ph]?.some(t => t.type === "task"));

  // Resumo das âncoras
  const anchors = SCHEDULE_TASKS.filter(t => t.plannedStart?.type === "anchor");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">{template?.name || "Template Padrão"}</h3>
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">Padrão ativo</span>
          </div>
          <p className="text-xs text-slate-400 ml-6">
            Fonte oficial do cronograma — {TASK_LIST.length} atividades em {phases.length} fases
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : savedMsg ? "✓ Salvo!" : "Salvar template"}
        </button>
      </div>

      {/* Âncoras do cronograma */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
            {anchors.length} Datas Âncora — definidas por projeto, propagam para atividades dependentes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {anchors.map(a => (
            <span key={a.id} className="text-xs bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg font-medium shadow-sm">
              {a.activity}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <strong>Esta é a fonte oficial do cronograma.</strong> As regras de data (âncora, cálculo, offset) são definidas em
          <code className="bg-blue-100 px-1 rounded mx-0.5">scheduleTasks.js</code> e não são alteradas aqui.
          Aqui você configura <strong>Resp. Geral</strong> e <strong>Papel Líder</strong> padrão de cada atividade.
          Atividades condicionais (<span className="bg-amber-100 text-amber-700 px-1 rounded">condicional</span>) só aparecem no projeto se os módulos/escopo estiverem ativos.
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold"><Anchor className="w-2.5 h-2.5" /> Âncora</span>
        <span>Data definida por projeto, propaga para dependentes</span>
        <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-semibold"><Zap className="w-2.5 h-2.5" /> Calculada</span>
        <span>Calculada automaticamente por fórmula</span>
        <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold"><Pencil className="w-2.5 h-2.5" /> Manual</span>
        <span>Preenchida manualmente no projeto</span>
      </div>

      {/* Fases */}
      {phases.map(ph => (
        <PhaseSection
          key={ph}
          phaseName={ph}
          tasks={tasksByPhase[ph]}
          tasksConfig={tasksConfig}
          onChangeTask={handleChangeTask}
        />
      ))}
    </div>
  );
}