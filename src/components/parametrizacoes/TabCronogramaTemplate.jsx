import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { SCHEDULE_TASKS, PHASE_ORDER } from "@/lib/scheduleTasks.js";
import { RESPONSIBLE_ROLE_OPTIONS, RESPONSIBLE_ROLE_LABELS } from "@/lib/resolveResponsibleRole.js";
import { Save, Star, Info, ChevronDown, ChevronRight, Pencil, X, Check } from "lucide-react";

const inputClass = "px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full";

// Apenas tarefas (não grupos)
const TASK_LIST = SCHEDULE_TASKS.filter(t => t.type === "task");

// Mapeia tasks por ID
const TASK_BY_ID = Object.fromEntries(TASK_LIST.map(t => [t.id, t]));

function TaskConfigRow({ task, config, onChange }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState({ responsible_role: config?.responsible_role || "" });

  const handleSave = () => {
    onChange(task.id, local);
    setEditing(false);
  };

  const resolvedRole = config?.responsible_role
    ? RESPONSIBLE_ROLE_LABELS[config.responsible_role] || config.responsible_role
    : "—";

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[340px] leading-snug">{task.activity}</td>
      <td className="px-3 py-2.5 text-xs text-slate-500">{task.phase}</td>
      <td className="px-3 py-2.5 min-w-[200px]">
        {editing ? (
          <select
            value={local.responsible_role}
            onChange={e => setLocal(l => ({ ...l, responsible_role: e.target.value }))}
            className={inputClass}
          >
            <option value="">— Sem papel definido —</option>
            {RESPONSIBLE_ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            config?.responsible_role
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-slate-50 text-slate-400 border-slate-200"
          }`}>
            {resolvedRole}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Salvar">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Cancelar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => { setLocal({ responsible_role: config?.responsible_role || "" }); setEditing(true); }}
            className="text-xs text-blue-600 hover:underline px-1">
            <Pencil className="w-3 h-3 inline" /> Editar
          </button>
        )}
      </td>
    </tr>
  );
}

function PhaseSection({ phaseName, tasks, tasksConfig, onChangeTask }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 rounded-xl border border-slate-200 overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 bg-blue-600 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
        <h3 className="text-sm font-bold text-white">{phaseName}</h3>
        <span className="text-xs text-blue-200 ml-auto">{tasks.length} atividade(s)</span>
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 min-w-[300px]">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Fase</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 min-w-[180px]">Papel Responsável</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <TaskConfigRow
                  key={task.id}
                  task={task}
                  config={tasksConfig[task.id]}
                  onChange={onChangeTask}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TabCronogramaTemplate() {
  const [template, setTemplate] = useState(null);
  const [tasksConfig, setTasksConfig] = useState({}); // { [taskId]: { responsible_role } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.ScheduleTemplate.filter({ is_default: true });
    if (list.length > 0) {
      const tmpl = list[0];
      setTemplate(tmpl);
      try {
        setTasksConfig(JSON.parse(tmpl.tasks_config || "{}"));
      } catch {
        setTasksConfig({});
      }
    } else {
      // Criar template padrão automaticamente se não existir
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
  };

  useEffect(() => { load(); }, []);

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

  // Agrupa tarefas por fase
  const tasksByPhase = {};
  TASK_LIST.forEach(t => {
    const ph = t.phase || "Geral";
    if (!tasksByPhase[ph]) tasksByPhase[ph] = [];
    tasksByPhase[ph].push(t);
  });
  const phases = PHASE_ORDER.filter(ph => tasksByPhase[ph]?.length > 0);

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
            <h3 className="text-sm font-bold text-slate-800">{template?.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">Padrão ativo</span>
          </div>
          {template?.description && (
            <p className="text-xs text-slate-400 ml-6">{template.description}</p>
          )}
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

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          <strong>Como funciona:</strong> Alterações neste template são aplicadas automaticamente em novos projetos.
          Projetos já criados <strong>não são afetados</strong>. O papel responsável é resolvido dinamicamente
          a partir dos <strong>Dados Iniciais</strong> de cada projeto.
        </div>
      </div>

      {/* Fases e atividades */}
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