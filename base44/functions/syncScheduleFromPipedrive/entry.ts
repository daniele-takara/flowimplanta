import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sync manual Pipedrive → Cronograma (chamado pelo frontend do ScheduleTab).
 * Implementa a mesma lógica de applyPipedriveRules mas autenticando como o usuário logado.
 * A lógica está centralizada aqui e em applyPipedriveRules — ambas usam o mesmo algoritmo.
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429). Aguarde alguns minutos.");
  if (res.status === 401 || res.status === 403) throw new Error(`Acesso negado ao Pipedrive (${res.status}).`);
  const data = await res.json();
  return data.data || null;
}

async function fetchAllActivities(dealId, apiToken) {
  const all = [];
  let start = 0;
  while (true) {
    const res = await fetch(`${PIPE_V1}/deals/${dealId}/activities?limit=100&start=${start}&api_token=${apiToken}`);
    if (res.status === 429) throw new Error("Rate limit Pipedrive (429)");
    const data = await res.json();
    const items = data.data || [];
    all.push(...items);
    if (!data.additional_data?.pagination?.more_items_in_collection || items.length === 0) break;
    start += 100;
  }
  return all;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id } = body;
    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 1. Carregar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({
      ok: false,
      error: 'Projeto sem pipedrive_deal_id. Configure nos Dados Iniciais.'
    }, { status: 400 });

    // 2. Carregar regras do banco
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (rules.length === 0) {
      return Response.json({ ok: false, error: 'Nenhuma regra de cronograma. Execute "Atualizar regras da planilha".' }, { status: 400 });
    }

    // 3. Buscar Pipedrive
    const [deal, pipeActivities] = await Promise.all([
      fetchDeal(dealId, apiToken),
      fetchAllActivities(dealId, apiToken),
    ]);
    if (!deal) return Response.json({ ok: false, error: `Deal ${dealId} não encontrado` }, { status: 404 });

    const currentStageId = String(deal.stage_id ?? "");
    const doneActivities = pipeActivities.filter(a =>
      a.done === true || a.done === 1 || String(a.done).toLowerCase() === "true"
    );

    // 4. Carregar cronograma
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id }),
    ]);

    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];

    if (allProjectPhases.length === 0) {
      return Response.json({ ok: false, error: "Nenhuma fase encontrada no projeto.", available_phases: [] }, { status: 400 });
    }

    const activitiesCache = [...scheduleActivities];

    function phaseExists(fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(fase));
    }
    function getPhaseActivities(fase) {
      return activitiesCache.filter(a => normalize(a.phase_name) === normalize(fase));
    }

    const updatedActivities = [];
    const createdActivities = [];
    const matchErrors = [];
    let rulesApplied = 0;

    for (const rule of rules) {
      const entidade  = (rule.pipedrive_entidade || "").toLowerCase().trim();
      const campoKey  = (rule.pipedrive_campo_key || "").trim();
      const valorDisp = (rule.pipedrive_valor_disparo || "").trim();
      const base44Fase = (rule.base44_fase || "").trim();
      const base44Atv  = (rule.base44_atividade || "").trim();
      const campoData  = (rule.pipedrive_campo_data || "").trim();
      const fazInicio  = rule.faz_inicio === true;
      const fazFim     = rule.faz_fim === true;

      if (!base44Fase || (!fazInicio && !fazFim)) continue;

      if (!phaseExists(base44Fase)) {
        matchErrors.push(`Fase "${base44Fase}" não existe. Disponíveis: ${allProjectPhases.join(", ")}`);
        continue;
      }

      let phaseActs = getPhaseActivities(base44Fase);

      // ── REGRA DEAL (stage_id) ─────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        if (currentStageId !== String(valorDisp)) continue;

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        if (!dateStr) { matchErrors.push(`Deal stage=${valorDisp}: sem data no campo "${campoData}"`); continue; }

        if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
          const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
            project_id, phase_name: base44Fase, activity_name: base44Atv,
            status: fazFim ? "Concluído" : "Em andamento",
            actual_start: fazInicio || fazFim ? dateStr : null,
            actual_end: fazFim ? dateStr : null, order: 1,
          });
          activitiesCache.push(newAct);
          createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, patch: { actual_start: dateStr }, trigger: `stage_id=${valorDisp}` });
          rulesApplied++;
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
          const patch = {};
          if (fazInicio && !act.actual_start) patch.actual_start = dateStr;
          if (fazFim && !act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            Object.assign(act, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `stage_id=${valorDisp}` });
            rulesApplied++;
          }
        }
      }

      // ── REGRA ACTIVITY (done) ─────────────────────────────────────────────
      if (entidade === "activity") {
        const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
        const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();

        for (const pAct of pipeActivities) {
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;
          if (campoIdent && valorIdent && String(pAct[campoIdent] || "").trim() !== valorIdent) continue;

          const dateStr = extractDate(pAct.marked_as_done_time) || extractDate(pAct.update_time)
            || extractDate(pAct.due_date) || new Date().toISOString().substring(0, 10);

          if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
            const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
              project_id, phase_name: base44Fase, activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? dateStr : null,
              actual_end: fazFim ? dateStr : null, order: 1,
            });
            activitiesCache.push(newAct);
            createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, patch: { actual_end: dateStr }, trigger: `activity done` });
            rulesApplied++;
            break;
          }

          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const patch = {};
            if (fazFim && !act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; }
            if (fazInicio && !act.actual_start) patch.actual_start = dateStr;
            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done` });
              rulesApplied++;
            }
          }
        }
      }
    }

    // 5. Gravar IntegrationLog
    const logStatus = updatedActivities.length + createdActivities.length > 0 ? "success"
      : matchErrors.length > 0 ? "partial_success"
      : "ignored";

    try {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration_type: "pipedrive_cronograma",
        source: "manual_sync",
        action: "apply_rules",
        status: logStatus,
        deal_id: Number(dealId),
        project_id,
        project_name: project.name,
        event_type: "manual_sync",
        rules_loaded: rules.length,
        rules_matched: rulesApplied,
        phases_found: allProjectPhases.length,
        activities_found: scheduleActivities.length,
        activities_created: createdActivities.length,
        activities_updated: updatedActivities.length,
        dates_filled: updatedActivities.length + createdActivities.length,
        dates_ignored: 0,
        match_errors: JSON.stringify(matchErrors),
        errors: JSON.stringify([]),
        request_payload: JSON.stringify({ project_id, deal_id: dealId }).substring(0, 1000),
        response_payload: JSON.stringify({ updated: updatedActivities, created: createdActivities }).substring(0, 4000),
        debug_steps: JSON.stringify({ available_phases: allProjectPhases, deal_stage_id: currentStageId }).substring(0, 4000),
        duration_ms: Date.now() - startTime,
      });
    } catch (logErr) {
      console.warn("[syncSchedule] Erro ao gravar IntegrationLog:", logErr.message);
    }

    return Response.json({
      ok: true,
      deal_id: dealId,
      project_id,
      deal_stage_id: currentStageId,
      activities_found: pipeActivities.length,
      activities_done: doneActivities.length,
      rules_total: rules.length,
      rules_applied: rulesApplied,
      updated: updatedActivities.length,
      created: createdActivities.length,
      activities: updatedActivities,
      activities_created: createdActivities,
      match_errors: matchErrors,
      available_phases: allProjectPhases,
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});