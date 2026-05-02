import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Webhook receptor do Pipedrive.
 * Eventos: change.deal, change.activity, create.activity
 *
 * Regras de stage_id:
 * - stage_id lido de: body.current.stage_id  (PAYLOAD, nunca do deal ao vivo)
 * - Comparação numérica: Number(current.stage_id) == Number(regra.pipedrive_valor_disparo)
 * - Só dispara quando previous.stage_id != current.stage_id
 * - Wildcard "*" em base44_atividade → aplica em TODAS as atividades da fase
 * - Datas existentes NUNCA sobrescritas
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

/** Trata como vazio: null, undefined, "", " ", "—", "–" */
function isDateEmpty(val) {
  if (val == null) return true;
  const s = String(val).trim();
  return s === "" || s === "—" || s === "–";
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
  const previous = body.previous || {};

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

  // ── Leitura do stage_id: SEMPRE do payload current (nunca do deal ao vivo) ──
  const currentStageNum = current.stage_id != null ? Number(current.stage_id) : null;
  const previousStageNum = previous.stage_id != null ? Number(previous.stage_id) : null;
  const stageChanged = currentStageNum != null && currentStageNum !== previousStageNum;

  console.log(`[pipedriveWebhook] Recebido: event=${eventType} deal_id=${dealId} activity_id=${activityId || "N/A"}`);
  console.log(`[pipedriveWebhook] Stage: current=${currentStageNum} previous=${previousStageNum} changed=${stageChanged}`);

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

  console.log(`[pipedriveWebhook] Projeto encontrado: ${project.name} (id=${project.id})`);

  try {
    // Carregar regras
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules.filter(r => r.rule_type === "cronograma").sort((a, b) => (a.order || 0) - (b.order || 0));
    console.log(`[pipedriveWebhook] Regras carregadas: ${rules.length}`);

    if (rules.length === 0) {
      return Response.json({ ok: false, event_type: eventType, errors: ["Sem regras de cronograma"] });
    }

    // Buscar deal ao vivo para campos de data (update_time, etc.)
    // Mas stage_id = SEMPRE do payload current
    let deal = current;
    if (!deal.update_time && !deal.add_time) {
      const liveDeal = await fetchDeal(dealId, apiToken);
      if (liveDeal) {
        // Usa dados do deal ao vivo EXCETO stage_id que vem do payload
        deal = { ...liveDeal, stage_id: currentStageNum ?? liveDeal.stage_id };
      }
    }

    const pipeActivities = await fetchAllActivities(dealId, apiToken);
    console.log(`[pipedriveWebhook] Activities do deal: ${pipeActivities.length} total, ${pipeActivities.filter(a => a.done).length} concluídas`);

    // Carregar cronograma
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id: project.id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id: project.id }),
    ]);

    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];
    console.log(`[pipedriveWebhook] Fases do projeto: ${allProjectPhases.join(" | ")}`);
    console.log(`[pipedriveWebhook] Atividades no cronograma: ${scheduleActivities.length}`);

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
    const ruleReport = []; // relatório detalhado por regra
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

      const ruleEntry = {
        rule_id: rule.id,
        order: rule.order,
        entidade,
        campo_key: campoKey,
        valor_disparo: valorDisp,
        base44_fase: base44Fase,
        base44_atividade: base44Atv,
        faz_inicio: fazInicio,
        faz_fim: fazFim,
        evaluated: false,
        matched: false,
        skip_reason: null,
        actions: [],
      };

      if (!base44Fase || (!fazInicio && !fazFim)) {
        ruleEntry.skip_reason = "base44_fase vazio ou faz_inicio/faz_fim ambos false";
        ruleReport.push(ruleEntry);
        continue;
      }

      if (!phaseExists(base44Fase)) {
        const msg = `Fase "${base44Fase}" não existe. Disponíveis: ${allProjectPhases.join(", ")}`;
        ruleEntry.skip_reason = msg;
        matchErrors.push(msg);
        ruleReport.push(ruleEntry);
        continue;
      }

      ruleEntry.evaluated = true;
      let phaseActs = getPhaseActivities(base44Fase);

      // ── REGRA DEAL (stage_id) ─────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        const ruleStageNum = Number(valorDisp);
        const comparison = `Number(current.stage_id)=${currentStageNum} == Number(regra.valor_disparo)=${ruleStageNum}`;

        console.log(`[pipedriveWebhook] [Regra #${rule.order}] deal/stage_id | ${comparison} | stageChanged=${stageChanged}`);
        ruleEntry.comparison = comparison;
        ruleEntry.stage_changed = stageChanged;
        ruleEntry.current_stage = currentStageNum;
        ruleEntry.rule_stage = ruleStageNum;

        // Verificar mudança de stage
        if (!stageChanged) {
          ruleEntry.skip_reason = `stage_id não mudou (${previousStageNum} → ${currentStageNum})`;
          console.log(`[pipedriveWebhook] [Regra #${rule.order}] SKIP: stage não mudou`);
          ruleReport.push(ruleEntry);
          continue;
        }

        // Comparação NUMÉRICA
        if (currentStageNum !== ruleStageNum) {
          ruleEntry.skip_reason = `stage_id atual (${currentStageNum}) ≠ valor esperado (${ruleStageNum})`;
          console.log(`[pipedriveWebhook] [Regra #${rule.order}] SKIP: ${ruleEntry.skip_reason}`);
          ruleReport.push(ruleEntry);
          continue;
        }

        // MATCH!
        ruleEntry.matched = true;
        console.log(`[pipedriveWebhook] [Regra #${rule.order}] ✓ MATCH stage=${currentStageNum} → fase="${base44Fase}" atividade="${base44Atv}"`);

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time) || new Date().toISOString().substring(0, 10);
        ruleEntry.date_used = dateStr;
        ruleEntry.date_field = campoData;

        if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
          // Criar atividade nova
          const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
            project_id: project.id, phase_name: base44Fase, activity_name: base44Atv,
            status: fazFim ? "Concluído" : "Em andamento",
            actual_start: fazInicio || fazFim ? dateStr : null,
            actual_end: fazFim ? dateStr : null, order: 1,
          });
          activitiesCache.push(newAct);
          createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, date: dateStr });
          ruleEntry.actions.push(`CRIOU atividade "${base44Atv}" com actual_start=${dateStr}`);
          rulesApplied++;
          ruleReport.push(ruleEntry);
          continue;
        }

        // Aplicar em atividades existentes
        let actsProcessed = 0;
        for (const act of phaseActs) {
          // Wildcard "*" = todas; senão filtra por nome
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) {
            ruleEntry.actions.push(`SKIP "${act.activity_name}" — nome não bate com "${base44Atv}"`);
            continue;
          }
          const startEmpty = isDateEmpty(act.actual_start);
          const endEmpty   = isDateEmpty(act.actual_end);
          console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_start="${act.actual_start}" isEmpty=${startEmpty} | actual_end="${act.actual_end}" isEmpty=${endEmpty}`);
          const patch = {};
          if (fazInicio) {
            if (startEmpty) { patch.actual_start = dateStr; ruleEntry.actions.push(`ATUALIZOU actual_start="${dateStr}" (era vazio: "${act.actual_start}")`); }
            else { datesIgnored.push({ field: "actual_start", activity: act.activity_name, existing: act.actual_start }); ruleEntry.actions.push(`SKIP "${act.activity_name}": actual_start já preenchido (${act.actual_start})`); }
          }
          if (fazFim) {
            if (endEmpty) { patch.actual_end = dateStr; patch.status = "Concluído"; ruleEntry.actions.push(`ATUALIZOU actual_end="${dateStr}" (era vazio: "${act.actual_end}")`); }
            else { datesIgnored.push({ field: "actual_end", activity: act.activity_name, existing: act.actual_end }); ruleEntry.actions.push(`SKIP "${act.activity_name}": actual_end já preenchido (${act.actual_end})`); }
          }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            Object.assign(act, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `stage_id=${currentStageNum}` });
            ruleEntry.actions.push(`ATUALIZOU "${act.activity_name}": ${JSON.stringify(patch)}`);
            rulesApplied++;
            actsProcessed++;
          }
        }
        console.log(`[pipedriveWebhook] [Regra #${rule.order}] processadas ${actsProcessed} atividades da fase "${base44Fase}"`);
      }

      // ── REGRA ACTIVITY (done) ─────────────────────────────────────────────
      if (entidade === "activity") {
        const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
        const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();
        ruleEntry.campo_identificacao = campoIdent;
        ruleEntry.valor_identificacao = valorIdent;

        let anyMatch = false;
        for (const pAct of pipeActivities) {
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;

          if (campoIdent && valorIdent) {
            const actVal = String(pAct[campoIdent] || "").trim();
            const exactMatch = actVal === valorIdent;
            const normalizedMatch = normalize(actVal) === normalize(valorIdent);
            if (!exactMatch && !normalizedMatch) {
              console.log(`[pipedriveWebhook] [Regra #${rule.order}] activity skip: ${campoIdent}="${actVal}" ≠ "${valorIdent}"`);
              ruleEntry.actions.push(`SKIP activity "${pAct.subject}": ${campoIdent}="${actVal}" ≠ "${valorIdent}"`);
              continue;
            }
          }

          anyMatch = true;
          ruleEntry.matched = true;
          const dateStr = extractDate(pAct.marked_as_done_time) || extractDate(pAct.update_time)
            || extractDate(pAct.due_date) || new Date().toISOString().substring(0, 10);
          ruleEntry.date_used = dateStr;

          console.log(`[pipedriveWebhook] [Regra #${rule.order}] ✓ MATCH activity "${pAct.subject}" done → fase="${base44Fase}"`);

          if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
            const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
              project_id: project.id, phase_name: base44Fase, activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? dateStr : null,
              actual_end: fazFim ? dateStr : null, order: 1,
            });
            activitiesCache.push(newAct);
            createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, date: dateStr });
            ruleEntry.actions.push(`CRIOU atividade "${base44Atv}" com actual_end=${dateStr}`);
            rulesApplied++;
            break;
          }

          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const startEmpty = isDateEmpty(act.actual_start);
            const endEmpty   = isDateEmpty(act.actual_end);
            console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_start="${act.actual_start}" isEmpty=${startEmpty} | actual_end="${act.actual_end}" isEmpty=${endEmpty}`);
            const patch = {};
            if (fazFim) {
              if (endEmpty) { patch.actual_end = dateStr; patch.status = "Concluído"; }
              else { datesIgnored.push({ field: "actual_end", activity: act.activity_name, existing: act.actual_end }); }
            }
            if (fazInicio) {
              if (startEmpty) { patch.actual_start = dateStr; }
              else { datesIgnored.push({ field: "actual_start", activity: act.activity_name, existing: act.actual_start }); }
            }
            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done subject="${pAct.subject}"` });
              ruleEntry.actions.push(`ATUALIZOU "${act.activity_name}": ${JSON.stringify(patch)}`);
              rulesApplied++;
            }
          }
        }

        if (!anyMatch && valorIdent) {
          ruleEntry.skip_reason = `Nenhuma activity concluída com ${campoIdent}="${valorIdent}"`;
        }
      }

      ruleReport.push(ruleEntry);
    }

    // Gravar IntegrationLog com relatório detalhado
    const logStatus = updatedActivities.length + createdActivities.length > 0 ? "success"
      : matchErrors.length > 0 ? "partial_success" : "ignored";

    const debugSteps = {
      stage_current: currentStageNum,
      stage_previous: previousStageNum,
      stage_changed: stageChanged,
      available_phases: allProjectPhases,
      activities_in_schedule: scheduleActivities.length,
      rule_report: ruleReport,
    };

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
      request_payload: JSON.stringify({
        event_type: eventType, deal_id: dealId,
        stage_current: currentStageNum, stage_previous: previousStageNum
      }).substring(0, 1000),
      response_payload: JSON.stringify({ updated: updatedActivities, created: createdActivities }).substring(0, 4000),
      debug_steps: JSON.stringify(debugSteps).substring(0, 8000),
      duration_ms: Date.now() - startTime,
    }).catch(() => {});

    console.log(`[pipedriveWebhook] RESULTADO: event=${eventType} deal=${dealId} project=${project.id} rules_matched=${rulesApplied} updated=${updatedActivities.length} created=${createdActivities.length} ignored=${datesIgnored.length} match_errors=${matchErrors.length} duration=${Date.now() - startTime}ms`);

    return Response.json({
      ok: true,
      received: true,
      event_type: eventType,
      deal_id: dealId,
      project_id: project.id,
      project_name: project.name,
      stage_current: currentStageNum,
      stage_previous: previousStageNum,
      stage_changed: stageChanged,
      rules_loaded: rules.length,
      rules_matched: rulesApplied,
      activities_updated: updatedActivities.length,
      activities_created: createdActivities.length,
      dates_ignored: datesIgnored.length,
      match_errors: matchErrors,
      rule_report: ruleReport,
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