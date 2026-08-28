// Ordem canônica de fases para determinar a etapa mais avançada de um projeto.
export const PHASE_ORDER = [
  "Abertura de projeto",
  "Integração",
  "Cadastros",
  "Implantação de funcionários não integrados",
  "Parametrização",
  "Treinamento e Validações",
  "Operação Assistida",
  "Fechamento de Folha",
  "Expansão",
  "Encerramento",
];

// Cores para o gráfico de distribuição por etapa.
export const STAGE_COLORS = {
  "Abertura de projeto": "bg-indigo-500",
  "Integração": "bg-purple-500",
  "Cadastros": "bg-blue-500",
  "Implantação de funcionários não integrados": "bg-cyan-500",
  "Parametrização": "bg-sky-500",
  "Treinamento e Validações": "bg-teal-500",
  "Operação Assistida": "bg-green-500",
  "Fechamento de Folha": "bg-amber-500",
  "Expansão": "bg-orange-500",
  "Encerramento": "bg-rose-500",
  "Projeto Pausado": "bg-amber-300",
  "Perdido": "bg-red-400",
  "Concluído": "bg-emerald-500",
};

/**
 * Calcula a etapa atual de um projeto.
 * Retorna { stage: string, hasActiveActivity: boolean }.
 * - hasActiveActivity=false indica que não há ScheduleActivity "Em andamento"
 *   e o stage veio de Project.current_phase (requer indicador visual).
 */
export function computeCurrentStage(project, inProgressActivities) {
  if (project.status === "Pausado") return { stage: "Projeto Pausado", hasActiveActivity: false };
  if (project.status === "Perdido") return { stage: "Perdido", hasActiveActivity: false };
  if (project.status === "Concluído") return { stage: "Concluído", hasActiveActivity: false };

  const projectActs = inProgressActivities.filter(a => a.project_id === project.id);
  if (projectActs.length > 0) {
    let maxIndex = -1;
    let resultPhase = projectActs[0].phase_name;
    for (const act of projectActs) {
      const idx = PHASE_ORDER.indexOf(act.phase_name);
      if (idx > maxIndex) {
        maxIndex = idx;
        resultPhase = act.phase_name;
      }
    }
    return { stage: resultPhase, hasActiveActivity: true };
  }

  return { stage: project.current_phase || "—", hasActiveActivity: false };
}

/**
 * Retorna a data mais próxima de encerramento do projeto.
 * Prioridade: schedule_anchor_dates.agenda_encerramento_projeto → aligned_end_date → planned_end_date.
 */
export function getClosingDate(project) {
  const anchor = project.schedule_anchor_dates?.agenda_encerramento_projeto;
  if (anchor) return anchor;
  if (project.aligned_end_date) return project.aligned_end_date;
  if (project.planned_end_date) return project.planned_end_date;
  return null;
}