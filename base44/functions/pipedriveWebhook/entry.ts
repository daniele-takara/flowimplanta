import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Webhook receptor do Pipedrive.
 * Eventos: change.deal, change.activity, create.activity
 *
 * Lógica idêntica a syncScheduleFromPipedrive:
 * - stage_id match → actual_start (faz_inicio)
 * - activity done → actual_end (faz_fim)
 * - Datas existentes NUNCA sobrescritas
 * - Fase inexistente → match_error controlado
 * - Atividade inexistente → cria automaticamente
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

function buildIdempotencyKey(eventAction, eventObject, dealId, activityId, vTs) {
  return `${eventAction}:${eventObject}:${dealId || 0}:${activityId || 0}:${(vTs || "").substring(0, 16)}`;
}

async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429)");
  if (!res.ok) throw new Error(`Pipedrive retornou ${res.status} para deal ${dealId}`);
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

  const contentLength = parseInt(req.headers.get("content-length") || "0");
  if (contentLength > 500_000) {
    return Response.json({ error: "Payload too large" }, { status: 400 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const rawEvent = body.event || "";
  const meta = body.meta || {};
  const current = body.current || {};

  let eventAction = meta.action || rawEvent.split(".")[0] || "";
  let eventObject = meta.object || rawEvent.split(".")[1] || "";
  if (eventAction === "updated") eventAction = "change";
  if (eventAction === "added") eventAction = "create";
  const eventType = `${eventAction}.${eventObject}`;

  if (eventObject !== "deal" && eventObject !== "activity") {
    return Response.json({ ok: true, received: true, event_type: eventType, skipped: "unsupported object" });
  }

  let dealId = null;
  let activityId = null;
  if (eventObject === "deal") {
    dealId = current.id || meta.id || body.data?.id;
  } else {
    activityId = current.id || meta.id;
    dealId = current.deal_id || meta.deal_id;
  }

  const idempotencyKey = buildIdempotencyKey(eventAction, eventObject, dealId, activityId, meta.v_ts);

  const base44 = createClientFromRequest(req);
  const apiToken = Deno.env.get("API_PIpedrive");

  // Verificar duplicata
  try {
    const existing = await base44.asServiceRole.entities.IntegrationLog.filter({ event_type: idempotencyKey });
    if (existing.length > 0) {
      return Response.json({ ok: true, received: true, event_type: eventType, duplicate: true });
    }
  } catch {}

  // Sem deal_id
  if (!dealId) {
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_type: "pipedrive_cronograma",
      source: "webhook",
      action: "receive_event",
      status: "ignored",
      event_type: idempotencyKey,
      deal_id: null,
      errors: JSON.stringify(["Sem deal_id no payload"]),
      request_payload: JSON.stringify({ event_type: eventType }).substring(0, 500),
    }).catch(() => {});
    return Response.json({ ok: false, event_type: eventType, errors: ["Sem deal_id no payload"] });
  }

  // Localizar projeto
  let project = null;
  try {
    const projects = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: Number(dealId) });
    project = projects[0] || null;
  } catch {}

  if (!project) {
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_type: "pipedrive_cronograma",
      source: "webhook",
      action: "receive_event",
      status: "ignored",
      event_type: idempotencyKey,
      deal_id: Number(dealId),
      activity_id: activityId ? Number(activityId) : null,
      errors: JSON.stringify([`Nenhum projeto com pipedrive_deal_id=${dealId}`]),
      request_payload: JSON.stringify({ event_type: eventType, deal_id: dealId }).substring(0, 500),
    }).catch(() => {});
    return Response.json({ ok: false, event_type: eventType, errors: [`Nenhum projeto com pipedrive_deal_id=${dealId}`] });
  }

  try {
    // Carregar regras
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules.filter(r => r.rule_type === "cronograma").sort((a, b) => (a.order || 0) - (b.order || 0));

    if (rules.length === 0) {
      return Response.json({ ok: false, event_type: eventType, errors: ["Sem regras de cronograma"] });
    }

    // Buscar deal atual
    const deal = await fetchDeal(dealId, apiToken);
    if (!deal) throw new Error(`Deal ${dealId} não encontrado`);

    const pipeActivities = await fetchAllActivities(dealId, apiToken);
    const currentStageId = String(deal.stage_id ?? "");

    // Carregar cronograma
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id: project.id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id: project.id }),
    ]);

    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];

    const activitiesCache = [...scheduleActivities];

    function phaseExists(fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(fase));
    }
    function getPhaseActivities(fase) {
      return activitiesCache.filter(a => normalize(a.phase_name) === normalize(fase));
    }

    const updatedActivities = [];
    const createdActivities = [];
    const datesIgnored = [];
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
        if (!dateStr) { matchErrors.push(`Deal stage=${valorDisp}: sem data em "${campoData}"`); continue; }

        if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
          const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
            project_id: project.id, phase_name: base44Fase, activity_name: base44Atv,
            status: fazFim ? "Concluído" : "Em andamento",
            actual_start: fazInicio || fazFim ? dateStr : null,
            actual_end: fazFim ? dateStr : null, order: 1,
          });
          activitiesCache.push(newAct);
          createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase });
          rulesApplied++;
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
          const patch = {};
          if (fazInicio) { if (!act.actual_start) patch.actual_start = dateStr; else datesIgnored.push({ field: "actual_start", activity: act.activity_name }); }
          if (fazFim) { if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; } else datesIgnored.push({ field: "actual_end", activity: act.activity_name }); }
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
              project_id: project.id, phase_name: base44Fase, activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? dateStr : null,
              actual_end: fazFim ? dateStr : null, order: 1,
            });
            activitiesCache.push(newAct);
            createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase });
            rulesApplied++;
            break;
          }

          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const patch = {};
            if (fazFim) { if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; } else datesIgnored.push({ field: "actual_end", activity: act.activity_name }); }
            if (fazInicio) { if (!act.actual_start) patch.actual_start = dateStr; else datesIgnored.push({ field: "actual_start", activity: act.activity_name }); }
            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done subject="${pAct.subject}"` });
              rulesApplied++;
            }
          }
        }
      }
    }

    // Gravar IntegrationLog
    const logStatus = updatedActivities.length + createdActivities.length > 0 ? "success"
      : matchErrors.length > 0 ? "partial_success" : "ignored";

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_type: "pipedrive_cronograma",
      source: "webhook",
      action: "apply_rules",
      status: logStatus,
      event_type: idempotencyKey,
      deal_id: Number(dealId),
      activity_id: activityId ? Number(activityId) : null,
      project_id: project.id,
      project_name: project.name,
      rules_loaded: rules.length,
      rules_matched: rulesApplied,
      phases_found: allProjectPhases.length,
      activities_found: scheduleActivities.length,
      activities_created: createdActivities.length,
      activities_updated: updatedActivities.length,
      dates_filled: updatedActivities.length + createdActivities.length,
      dates_ignored: datesIgnored.length,
      match_errors: JSON.stringify(matchErrors),
      errors: JSON.stringify([]),
      request_payload: JSON.stringify({ event_type: eventType, deal_id: dealId, stage_id: deal.stage_id }).substring(0, 1000),
      response_payload: JSON.stringify({ updated: updatedActivities, created: createdActivities }).substring(0, 4000),
      debug_steps: JSON.stringify({ available_phases: allProjectPhases, deal_stage_id: currentStageId }).substring(0, 2000),
      duration_ms: Date.now() - startTime,
    }).catch(() => {});

    console.log(`[pipedriveWebhook] OK event=${eventType} deal=${dealId} project=${project.id} updated=${updatedActivities.length} created=${createdActivities.length}`);

    return Response.json({
      ok: true,
      received: true,
      event_type: eventType,
      deal_id: dealId,
      project_id: project.id,
      project_name: project.name,
      deal_stage_id: currentStageId,
      rules_loaded: rules.length,
      rules_matched: rulesApplied,
      activities_updated: updatedActivities.length,
      activities_created: createdActivities.length,
      dates_ignored: datesIgnored.length,
      match_errors: matchErrors,
    });

  } catch (error) {
    console.error("[pipedriveWebhook] erro:", error.message);

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_type: "pipedrive_cronograma",
      source: "webhook",
      action: "apply_rules",
      status: "error",
      event_type: idempotencyKey,
      deal_id: dealId ? Number(dealId) : null,
      activity_id: activityId ? Number(activityId) : null,
      project_id: project?.id || null,
      project_name: project?.name || null,
      errors: JSON.stringify([error.message]),
      request_payload: JSON.stringify({ event_type: eventType, deal_id: dealId }).substring(0, 500),
      duration_ms: Date.now() - startTime,
    }).catch(() => {});

    return Response.json({ ok: false, event_type: eventType, error: error.message }, { status: 500 });
  }
});