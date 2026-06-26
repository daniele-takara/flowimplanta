import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ANCHOR_IDS = new Set([
  'alinhamento_inicial',
  'go_live_registro_ponto',
  'agenda_fechamento_folha',
  'expansao_registro_ponto_real',
  'agenda_encerramento_projeto',
]);

const BR_HOLIDAYS = new Set([
  "2024-01-01","2024-04-21","2024-05-01","2024-09-07","2024-10-12",
  "2024-11-02","2024-11-15","2024-12-25",
  "2025-01-01","2025-04-18","2025-04-21","2025-05-01","2025-09-07",
  "2025-10-12","2025-11-02","2025-11-15","2025-12-25",
  "2026-01-01","2026-04-03","2026-04-21","2026-05-01","2026-09-07",
  "2026-10-12","2026-11-02","2026-11-15","2026-12-25",
]);

function isBusinessDay(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (BR_HOLIDAYS.has(dateStr)) return false;
  return true;
}

// Normaliza date string DD/MM/AAAA → YYYY-MM-DD or passthrough if already ISO
function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  // DD/MM/AAAA
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, overrides } = body;

    if (!project_id || !overrides || typeof overrides !== 'object') {
      return Response.json({ error: 'project_id e overrides são obrigatórios' }, { status: 400 });
    }

    // Carregar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });

    // Normalizar e validar datas recebidas
    const normalizedOverrides = {};
    const warnings = [];
    const errors = [];

    for (const [taskId, dates] of Object.entries(overrides)) {
      const start = parseDate(dates.plannedStart);
      const end   = parseDate(dates.plannedEnd);

      if (!start && !end) continue;

      // Validar que são dias úteis
      if (start && !isBusinessDay(start)) {
        warnings.push(`${taskId}: início ${start} não é dia útil — salvo mesmo assim`);
      }
      if (end && !isBusinessDay(end)) {
        warnings.push(`${taskId}: fim ${end} não é dia útil — salvo mesmo assim`);
      }

      normalizedOverrides[taskId] = {};
      if (start) normalizedOverrides[taskId].plannedStart = start;
      if (end)   normalizedOverrides[taskId].plannedEnd   = end;

      // Marcar origem como "agent"
      normalizedOverrides[taskId]._origin = {
        ...(start ? { plannedStart: 'agent' } : {}),
        ...(end   ? { plannedEnd:   'agent' } : {}),
      };
    }

    if (errors.length > 0) {
      return Response.json({ error: errors.join('; ') }, { status: 400 });
    }

    // Checar conflito de alocação do responsável em outros projetos nas mesmas datas
    const allocationConflicts = [];

    // Descobrir quem são os responsáveis do projeto (analista + gerente)
    const analystName  = project.pontotel_analyst_name || '';
    const managerName  = project.pontotel_manager_name || '';

    if (analystName || managerName) {
      // Buscar todos os projetos ativos com os mesmos responsáveis (excluindo o atual)
      const allProjects = await base44.asServiceRole.entities.Project.filter({
        status: { $in: ['Em andamento', 'Em aberto'] },
      });

      const siblingProjects = allProjects.filter(p =>
        p.id !== project_id && (
          (analystName && (p.pontotel_analyst_name === analystName || p.pontotel_manager_name === analystName)) ||
          (managerName && (p.pontotel_analyst_name === managerName || p.pontotel_manager_name === managerName))
        )
      );

      if (siblingProjects.length > 0) {
        const siblingIds = siblingProjects.map(p => p.id);
        const siblingActivities = await base44.asServiceRole.entities.ScheduleActivity.filter({
          project_id: { $in: siblingIds },
        });

        // Para cada override de âncora proposto, checar sobreposição de datas
        for (const [taskId, dates] of Object.entries(normalizedOverrides)) {
          if (!ANCHOR_IDS.has(taskId)) continue; // só verifica âncoras (têm impacto amplo)
          const newStart = dates.plannedStart;
          const newEnd   = dates.plannedEnd;
          if (!newStart || !newEnd) continue;

          for (const act of siblingActivities) {
            if (!act.planned_start || !act.planned_end) continue;
            if (act.status === 'Concluído' || act.status === 'Cancelado') continue;

            // Sobreposição: (s1 <= e2) && (e1 >= s2)
            if (newStart <= act.planned_end && newEnd >= act.planned_start) {
              const sibProj = siblingProjects.find(p => p.id === act.project_id);
              allocationConflicts.push({
                task: taskId,
                conflicting_project: sibProj?.client_name || act.project_id,
                conflicting_activity: act.activity_name,
                conflicting_dates: `${act.planned_start} → ${act.planned_end}`,
              });
            }
          }
        }
      }
    }

    // Mesclar com overrides existentes (não apaga o que não foi enviado)
    const existingOverrides = (project.schedule_overrides && typeof project.schedule_overrides === 'object')
      ? project.schedule_overrides : {};

    const mergedOverrides = { ...existingOverrides };
    for (const [taskId, override] of Object.entries(normalizedOverrides)) {
      mergedOverrides[taskId] = {
        ...(mergedOverrides[taskId] || {}),
        ...override,
        _origin: {
          ...(mergedOverrides[taskId]?._origin || {}),
          ...override._origin,
        },
      };
    }

    // Salvar no banco
    await base44.asServiceRole.entities.Project.update(project_id, {
      schedule_overrides: mergedOverrides,
    });

    return Response.json({
      success: true,
      applied: Object.keys(normalizedOverrides).length,
      warnings,
      allocation_conflicts: allocationConflicts,
      message: allocationConflicts.length > 0
        ? `Datas aplicadas com ${allocationConflicts.length} conflito(s) de alocação identificado(s).`
        : `Datas aplicadas com sucesso.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});