import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar todos os projetos Em andamento
    const projects = await base44.asServiceRole.entities.Project.filter({ status: 'Em andamento' });

    const projectIds = projects.map(p => p.id);

    // Buscar atividades e respostas de escopo de todos os projetos
    const [allActivities, allScopeItems] = await Promise.all([
      projectIds.length > 0
        ? base44.asServiceRole.entities.ScheduleActivity.filter({ project_id: { $in: projectIds } })
        : Promise.resolve([]),
      projectIds.length > 0
        ? base44.asServiceRole.entities.ScopeItem.filter({ project_id: { $in: projectIds } })
        : Promise.resolve([]),
    ]);

    // Indexar por projeto
    const activitiesByProject = {};
    allActivities.forEach(a => {
      if (!activitiesByProject[a.project_id]) activitiesByProject[a.project_id] = [];
      activitiesByProject[a.project_id].push(a);
    });

    const scopeByProject = {};
    allScopeItems.forEach(s => {
      if (!scopeByProject[s.project_id]) scopeByProject[s.project_id] = {};
      if (s.question_id) scopeByProject[s.project_id][s.question_id] = s.answer;
    });

    return Response.json({ projects, activitiesByProject, scopeByProject });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});