import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Função central de aplicação de regras Pipedrive → Cronograma.
 * Usada por: pipedriveWebhook, syncScheduleFromPipedrive, e diagnóstico.
 *
 * Payload esperado:
 * {
 *   project_id: string,
 *   deal_id: number,
 *   source: "webhook" | "manual_sync" | "diagnostic_test",
 *   event_type?: string,
 *   activity_id?: number,
 *   pipedrive_current?: object,   // dados do deal/activity do Pipedrive
 *   dry_run?: boolean             // se true, simula sem gravar
 * }
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

async function fetchDeal(dealId) {
  const apiToken = Deno.env.get("API_PIpedrive");
  if (!apiToken) throw new Error("API_PIpedrive não configurado");
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429). Aguarde alguns minutos.");
  if (!res.ok) throw new Error(`Pipedrive retornou ${res.status} para deal ${dealId}`);
  const data = await res.json();
  return data.data || null;
}

async function fetchAllActivities(dealId) {
  const apiToken = Deno.env.get("API_PIpedrive");
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
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    project_id,
    deal_id,
    source = "manual_sync",
    event_type = "manual",
    activity_id,
    pipedrive_current,
    dry_run = false,
  } = body;

  if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

  const debugSteps = [];
  const log = (step, data) => {
    debugSteps.push({ step, ...data, ts: new Date().toISOString() });
    console.log(`[applyPipedriveRules] ${step}:`, JSON.stringify(data));
  };

  const result = {
    ok: false,
    source,
    event_type,
    project_id,
    deal_id,
    activity_id: activity_id || null,
    rules_loaded: 0,
    rules_matched: 0,
    phases_found: 0,
    activities_found: 0,
    activities_updated: 0,
    activities_created: 0,
    dates_filled: 0,
    dates_ignored: 0,
    match_errors: [],
    errors: [],
    rule_debug: [],
    updated: [],
    created: [],
    ignored_dates: [],
    dry_run,
    duration_ms: 0,
  };

  try {
    // ── STEP 1: Carregar projeto ──────────────────────────────────────────
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) {
      result.errors.push(`Projeto ${project_id} não encontrado`);
      log("STEP_1_PROJECT", { status: "NOT_FOUND", project_id });
      return Response.json({ ...result, duration_ms: Date.now() - startTime });
    }
    log("STEP_1_PROJECT", { status: "OK", name: project.name, pipedrive_deal_id: project.pipedrive_deal_id });

    const actualDealId = deal_id || project.pipedrive_deal_id;
    if (!actualDealId) {
      result.errors.push("Projeto sem pipedrive_deal_id configurado");
      log("STEP_1_PROJECT", { status: "NO_DEAL_ID" });
      return Response.json({ ...result, duration_ms: Date.now() - startTime });
    }
    result.deal_id = actualDealId;

    // ── STEP 2: Carregar regras do banco ──────────────────────────────────
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    result.rules_loaded = rules.length;
    log("STEP_2_RULES", {
      total_rules: allRules.length,
      cronograma_rules: rules.length,
      dados_iniciais_rules: allRules.filter(r => r.rule_type === "dados_iniciais").length
    });

    if (rules.length === 0) {
      result.errors.push("Nenhuma regra de cronograma cadastrada. Execute 'Atualizar regras da planilha'.");
      return Response.json({ ...result, duration_ms: Date.now() - startTime });
    }

    // ── STEP 3: Buscar dados do Pipedrive ─────────────────────────────────
    let deal = pipedrive_current;
    let pipeActivities = [];

    if (!deal) {
      log("STEP_3_PIPEDRIVE", { status: "FETCHING", deal_id: actualDealId });
      deal = await fetchDeal(actualDealId);
      if (!deal) {
        result.errors.push(`Deal ${actualDealId} não encontrado no Pipedrive`);
        log("STEP_3_PIPEDRIVE", { status: "DEAL_NOT_FOUND" });
        return Response.json({ ...result, duration_ms: Date.now() - startTime });
      }
    }

    pipeActivities = await fetchAllActivities(actualDealId);
    const doneActivities = pipeActivities.filter(a =>
      a.done === true || a.done === 1 || String(a.done).toLowerCase() === "true"
    );

    log("STEP_3_PIPEDRIVE", {
      status: "OK",
      deal_id: deal.id,
      stage_id: deal.stage_id,
      stage_id_type: typeof deal.stage_id,
      pipeline_id: deal.pipeline_id,
      total_activities: pipeActivities.length,
      done_activities: doneActivities.length,
      done_subjects: doneActivities.map(a => a.subject),
    });

    // ── STEP 4: Carregar cronograma do projeto ────────────────────────────
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id }),
    ]);

    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];

    result.phases_found = allProjectPhases.length;
    result.activities_found = scheduleActivities.length;

    log("STEP_4_SCHEDULE", {
      phases_count: allProjectPhases.length,
      phases: allProjectPhases,
      activities_count: scheduleActivities.length,
    });

    const activitiesCache = [...scheduleActivities];

    function phaseExists(fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(fase));
    }
    function getPhaseActivities(fase) {
      return activitiesCache.filter(a => normalize(a.phase_name) === normalize(fase));
    }

    const currentStageId = String(deal.stage_id ?? "");

    // ── STEP 5: Avaliar e aplicar regras ──────────────────────────────────
    log("STEP_5_RULES_EVAL", { stage_id_received: currentStageId, rules_to_eval: rules.length });

    for (const rule of rules) {
      const entidade  = (rule.pipedrive_entidade || "").toLowerCase().trim();
      const campoKey  = (rule.pipedrive_campo_key || "").trim();
      const valorDisp = (rule.pipedrive_valor_disparo || "").trim();
      const base44Fase = (rule.base44_fase || "").trim();
      const base44Atv  = (rule.base44_atividade || "").trim();
      const campoData  = (rule.pipedrive_campo_data || "").trim();
      const fazInicio  = rule.faz_inicio === true;
      const fazFim     = rule.faz_fim === true;

      const ruleDebug = {
        rule_id: rule.id,
        order: rule.order,
        entidade,
        campo_key: campoKey,
        valor_disparo: valorDisp,
        base44_fase: base44Fase,
        base44_atividade: base44Atv,
        campo_data: campoData,
        faz_inicio: fazInicio,
        faz_fim: fazFim,
        match: false,
        skip_reason: null,
        actions: [],
      };

      if (!base44Fase) { ruleDebug.skip_reason = "base44_fase vazio"; result.rule_debug.push(ruleDebug); continue; }
      if (!fazInicio && !fazFim) { ruleDebug.skip_reason = "faz_inicio e faz_fim ambos false"; result.rule_debug.push(ruleDebug); continue; }

      // Verificar fase
      if (!phaseExists(base44Fase)) {
        ruleDebug.skip_reason = `Fase "${base44Fase}" não existe no projeto. Fases disponíveis: ${allProjectPhases.join(", ")}`;
        result.match_errors.push(ruleDebug.skip_reason);
        result.rule_debug.push(ruleDebug);
        continue;
      }

      let phaseActs = getPhaseActivities(base44Fase);

      // ── REGRA DEAL ──────────────────────────────────────────────────────
      if (entidade === "deal") {
        if (campoKey !== "stage_id") {
          ruleDebug.skip_reason = `campo_key="${campoKey}" não suportado para deal (somente stage_id)`;
          result.rule_debug.push(ruleDebug);
          continue;
        }

        const stageIdMatch = currentStageId === String(valorDisp);
        ruleDebug.valor_recebido = currentStageId;
        ruleDebug.valor_disparo_normalizado = String(valorDisp);
        ruleDebug.comparacao = `"${currentStageId}" === "${String(valorDisp)}" → ${stageIdMatch}`;

        if (!stageIdMatch) {
          ruleDebug.skip_reason = `stage_id="${currentStageId}" ≠ valor_disparo="${valorDisp}"`;
          result.rule_debug.push(ruleDebug);
          continue;
        }

        ruleDebug.match = true;
        result.rules_matched++;

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        ruleDebug.date_used = dateStr;
        ruleDebug.date_field = campoData;
        ruleDebug.date_raw = deal[campoData];

        if (!dateStr) {
          ruleDebug.skip_reason = `Sem data no campo "${campoData}" e update_time`;
          result.match_errors.push(`Deal stage=${valorDisp}: sem data no campo "${campoData}"`);
          result.rule_debug.push(ruleDebug);
          continue;
        }

        if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
          ruleDebug.actions.push(`CRIAR atividade "${base44Atv}" na fase "${base44Fase}" com data ${dateStr}`);
          if (!dry_run) {
            const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
              project_id, phase_name: base44Fase, activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? dateStr : null,
              actual_end: fazFim ? dateStr : null, order: 1,
            });
            activitiesCache.push(newAct);
            result.created.push({ id: newAct.id, name: base44Atv, phase: base44Fase, date: dateStr });
            result.activities_created++;
            result.dates_filled++;
          }
          result.rule_debug.push(ruleDebug);
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) {
            ruleDebug.actions.push(`SKIP atividade "${act.activity_name}" — não bate com "${base44Atv}"`);
            continue;
          }
          const patch = {};
          if (fazInicio) {
            if (!act.actual_start) { patch.actual_start = dateStr; result.dates_filled++; }
            else result.ignored_dates.push({ field: "actual_start", activity: act.activity_name, existing: act.actual_start });
          }
          if (fazFim) {
            if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; result.dates_filled++; }
            else result.ignored_dates.push({ field: "actual_end", activity: act.activity_name, existing: act.actual_end });
          }
          if (Object.keys(patch).length > 0) {
            ruleDebug.actions.push(`UPDATE "${act.activity_name}" → ${JSON.stringify(patch)}`);
            if (!dry_run) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
            }
            result.updated.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `stage_id=${valorDisp}` });
            result.activities_updated++;
          } else {
            ruleDebug.actions.push(`SKIP "${act.activity_name}" — datas já preenchidas`);
          }
        }
      }

      // ── REGRA ACTIVITY ──────────────────────────────────────────────────
      if (entidade === "activity") {
        const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
        const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();

        ruleDebug.campo_identificacao = campoIdent;
        ruleDebug.valor_identificacao = valorIdent;
        ruleDebug.done_activities_checked = doneActivities.map(a => ({
          id: a.id, subject: a.subject, done: a.done,
          [campoIdent]: a[campoIdent],
        }));

        let matched = false;
        for (const pAct of doneActivities) {
          if (campoIdent && valorIdent) {
            const actVal = String(pAct[campoIdent] || "").trim();
            if (actVal !== valorIdent) {
              ruleDebug.actions.push(`SKIP activity "${pAct.subject}": ${campoIdent}="${actVal}" ≠ "${valorIdent}"`);
              continue;
            }
          }

          matched = true;
          ruleDebug.match = true;
          result.rules_matched++;

          const dateStr = extractDate(pAct.marked_as_done_time) || extractDate(pAct.update_time)
            || extractDate(pAct.due_date) || new Date().toISOString().substring(0, 10);

          ruleDebug.date_used = dateStr;

          if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
            ruleDebug.actions.push(`CRIAR atividade "${base44Atv}" na fase "${base44Fase}"`);
            if (!dry_run) {
              const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
                project_id, phase_name: base44Fase, activity_name: base44Atv,
                status: fazFim ? "Concluído" : "Em andamento",
                actual_start: fazInicio || fazFim ? dateStr : null,
                actual_end: fazFim ? dateStr : null, order: 1,
              });
              activitiesCache.push(newAct);
              result.created.push({ id: newAct.id, name: base44Atv, phase: base44Fase, date: dateStr });
              result.activities_created++;
              result.dates_filled++;
            }
            break;
          }

          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const patch = {};
            if (fazFim) {
              if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; result.dates_filled++; }
              else result.ignored_dates.push({ field: "actual_end", activity: act.activity_name, existing: act.actual_end });
            }
            if (fazInicio) {
              if (!act.actual_start) { patch.actual_start = dateStr; result.dates_filled++; }
              else result.ignored_dates.push({ field: "actual_start", activity: act.activity_name, existing: act.actual_start });
            }
            if (Object.keys(patch).length > 0) {
              ruleDebug.actions.push(`UPDATE "${act.activity_name}" → ${JSON.stringify(patch)}`);
              if (!dry_run) {
                await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
                Object.assign(act, patch);
              }
              result.updated.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch });
              result.activities_updated++;
            }
          }
        }

        if (!matched && valorIdent) {
          ruleDebug.skip_reason = `Nenhuma activity concluída com ${campoIdent}="${valorIdent}"`;
        }
      }

      result.rule_debug.push(ruleDebug);
    }

    // ── STEP 6: Gravar IntegrationLog ─────────────────────────────────────
    result.dates_ignored = result.ignored_dates.length;
    result.ok = result.errors.length === 0;
    result.duration_ms = Date.now() - startTime;

    const logStatus = result.errors.length > 0 ? "error"
      : result.activities_updated === 0 && result.activities_created === 0 && result.dates_filled === 0 ? "ignored"
      : result.match_errors.length > 0 ? "partial_success"
      : "success";

    if (!dry_run) {
      try {
        await base44.asServiceRole.entities.IntegrationLog.create({
          integration_type: "pipedrive_cronograma",
          source,
          action: "apply_rules",
          status: logStatus,
          deal_id: actualDealId ? Number(actualDealId) : null,
          activity_id: activity_id ? Number(activity_id) : null,
          project_id,
          project_name: project.name,
          event_type,
          rules_loaded: result.rules_loaded,
          rules_matched: result.rules_matched,
          phases_found: result.phases_found,
          activities_found: result.activities_found,
          activities_created: result.activities_created,
          activities_updated: result.activities_updated,
          dates_filled: result.dates_filled,
          dates_ignored: result.dates_ignored,
          match_errors: JSON.stringify(result.match_errors),
          errors: JSON.stringify(result.errors),
          request_payload: JSON.stringify({ project_id, deal_id: actualDealId, source, event_type }).substring(0, 2000),
          response_payload: JSON.stringify({ updated: result.updated, created: result.created }).substring(0, 4000),
          debug_steps: JSON.stringify([...debugSteps, ...result.rule_debug]).substring(0, 8000),
          duration_ms: result.duration_ms,
        });
      } catch (e) {
        console.warn("[applyPipedriveRules] Erro ao gravar IntegrationLog:", e.message);
      }
    }

    log("STEP_6_RESULT", { status: logStatus, updated: result.activities_updated, created: result.activities_created, errors: result.errors.length });

    return Response.json(result);

  } catch (error) {
    console.error("[applyPipedriveRules] ERRO:", error.message);
    result.errors.push(error.message);
    result.duration_ms = Date.now() - startTime;
    return Response.json({ ...result, ok: false }, { status: 500 });
  }
});