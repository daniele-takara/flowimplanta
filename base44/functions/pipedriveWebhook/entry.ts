import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PIPE_V1 = "https://api.pipedrive.com/v1";
const WEBHOOK_SECRET = Deno.env.get("PIPEDRIVE_WEBHOOK_SECRET") || "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

async function fetchDeal(dealId) {
  const apiToken = Deno.env.get("API_PIpedrive");
  if (!apiToken) throw new Error("API_PIpedrive não configurado");
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429)");
  if (res.status === 401 || res.status === 403) throw new Error(`Acesso negado Pipedrive (${res.status})`);
  const data = await res.json();
  return data.data || null;
}

async function fetchActivity(activityId) {
  const apiToken = Deno.env.get("API_PIpedrive");
  const res = await fetch(`${PIPE_V1}/activities/${activityId}?api_token=${apiToken}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || null;
}

// Gera chave de idempotência combinando campos relevantes
function buildIdempotencyKey(eventAction, eventObject, dealId, activityId, currentUpdatedTime) {
  const parts = [eventAction, eventObject, dealId || "0", activityId || "0", (currentUpdatedTime || "").substring(0, 16)];
  return parts.join(":");
}

// ── Lógica central de cronograma ──────────────────────────────────────────────
// IDÊNTICA à do syncScheduleFromPipedrive para garantir consistência

async function applyRulesToSchedule({ base44, project, rules, dealCurrent, activityCurrent }) {
  const projectId = project.id;
  const currentStageId = String(dealCurrent?.stage_id ?? "");

  const [scheduleActivities, schedulePhases] = await Promise.all([
    base44.asServiceRole.entities.ScheduleActivity.filter({ project_id: projectId }),
    base44.asServiceRole.entities.SchedulePhase.filter({ project_id: projectId }),
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
  let rulesMatched = 0;

  for (const rule of rules) {
    const entidade  = (rule.pipedrive_entidade || "").toLowerCase().trim();
    const campoKey  = (rule.pipedrive_campo_key || "").trim();
    const valorDisp = (rule.pipedrive_valor_disparo || "").trim();
    const base44Fase = (rule.base44_fase || "").trim();
    const base44Atv  = (rule.base44_atividade || "").trim();
    const campoData  = (rule.pipedrive_campo_data || "").trim();
    const fazInicio  = rule.faz_inicio === true;
    const fazFim     = rule.faz_fim === true;

    if (!base44Fase) continue;
    if (!fazInicio && !fazFim) continue;

    if (!phaseExists(base44Fase)) {
      matchErrors.push(`Fase "${base44Fase}" não existe neste projeto`);
      continue;
    }

    let phaseActs = getPhaseActivities(base44Fase);

    // ── REGRA DEAL ────────────────────────────────────────────────────────────
    if (entidade === "deal" && dealCurrent) {
      if (campoKey !== "stage_id") continue;
      if (String(dealCurrent.stage_id) !== String(valorDisp)) continue;

      const dateStr = extractDate(dealCurrent[campoData]) || extractDate(dealCurrent.update_time);
      if (!dateStr) { matchErrors.push(`Deal regra: sem data no campo "${campoData}"`); continue; }

      rulesMatched++;

      // Se fase sem atividades e regra específica → criar
      if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
        const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
          project_id: projectId,
          phase_name: base44Fase,
          activity_name: base44Atv,
          status: fazFim ? "Concluído" : "Em andamento",
          actual_start: fazInicio || fazFim ? dateStr : null,
          actual_end: fazFim ? dateStr : null,
          order: 1,
        });
        activitiesCache.push(newAct);
        createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase });
        continue;
      }

      for (const act of phaseActs) {
        if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
        const patch = {};
        if (fazInicio) {
          if (!act.actual_start) patch.actual_start = dateStr;
          else datesIgnored.push({ field: "actual_start", activity: act.activity_name, reason: "já existia" });
        }
        if (fazFim) {
          if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; }
          else datesIgnored.push({ field: "actual_end", activity: act.activity_name, reason: "já existia" });
        }
        if (Object.keys(patch).length > 0) {
          await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
          Object.assign(act, patch);
          updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `stage_id=${valorDisp}` });
        }
      }
    }

    // ── REGRA ACTIVITY ────────────────────────────────────────────────────────
    if (entidade === "activity" && activityCurrent) {
      const isDone = activityCurrent.done === true || activityCurrent.done === 1 || String(activityCurrent.done).toLowerCase() === "true";
      if (!isDone) continue;

      const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
      const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();

      if (campoIdent && valorIdent) {
        const actVal = String(activityCurrent[campoIdent] || "").trim();
        if (actVal !== valorIdent) continue;
      }

      // Melhor data disponível
      const dateStr = extractDate(activityCurrent.marked_as_done_time)
        || extractDate(activityCurrent.update_time)
        || extractDate(activityCurrent.due_date)
        || new Date().toISOString().substring(0, 10);

      rulesMatched++;

      if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
        const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
          project_id: projectId,
          phase_name: base44Fase,
          activity_name: base44Atv,
          status: fazFim ? "Concluído" : "Em andamento",
          actual_start: fazInicio || fazFim ? dateStr : null,
          actual_end: fazFim ? dateStr : null,
          order: 1,
        });
        activitiesCache.push(newAct);
        createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase });
        continue;
      }

      for (const act of phaseActs) {
        if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
        const patch = {};
        if (fazFim) {
          if (!act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; }
          else datesIgnored.push({ field: "actual_end", activity: act.activity_name, reason: "já existia" });
        }
        if (fazInicio) {
          if (!act.actual_start) patch.actual_start = dateStr;
          else datesIgnored.push({ field: "actual_start", activity: act.activity_name, reason: "já existia" });
        }
        if (Object.keys(patch).length > 0) {
          await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
          Object.assign(act, patch);
          updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done subject="${activityCurrent.subject}"` });
        }
      }
    }
  }

  return { updatedActivities, createdActivities, datesIgnored, matchErrors, rulesMatched };
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const receivedAt = new Date().toISOString();

  // Validação de segredo opcional
  if (WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-flowimplanta-webhook-secret") || "";
    const urlSecret = new URL(req.url).searchParams.get("secret") || "";
    if (headerSecret !== WEBHOOK_SECRET && urlSecret !== WEBHOOK_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Limitar tamanho do payload
  const contentLength = parseInt(req.headers.get("content-length") || "0");
  if (contentLength > 500_000) {
    return Response.json({ error: "Payload too large" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Extrair campos do evento Pipedrive
  // Pipedrive envia: { event: "change.deal", meta: { action, object, ... }, current: {}, previous: {} }
  const rawEvent = body.event || "";
  const meta = body.meta || {};
  const current = body.current || {};
  const previous = body.previous || {};

  // Suportar formatos: "change.deal" e "updated.deal" (legado)
  let eventAction = meta.action || rawEvent.split(".")[0] || "";
  let eventObject = meta.object || rawEvent.split(".")[1] || "";

  // Normalizar legado updated.* → change.*
  if (eventAction === "updated") eventAction = "change";
  if (eventAction === "added") eventAction = "create";

  const eventType = `${eventAction}.${eventObject}`;

  // Validar evento mínimo
  const supportedEvents = ["change.deal", "change.activity", "create.activity", "create.deal"];
  if (eventObject !== "deal" && eventObject !== "activity") {
    return Response.json({ ok: true, received: true, event_type: eventType, skipped: "unsupported object" });
  }

  // Extrair IDs
  let dealId = null;
  let activityId = null;

  if (eventObject === "deal") {
    dealId = current.id || meta.id || body.data?.id;
  } else if (eventObject === "activity") {
    activityId = current.id || meta.id;
    dealId = current.deal_id || meta.deal_id;
  }

  // Gerar chave de idempotência
  const idempotencyKey = meta.v_ts
    ? `${eventAction}:${eventObject}:${dealId || 0}:${activityId || 0}:${meta.v_ts}`
    : buildIdempotencyKey(eventAction, eventObject, dealId, activityId, current.update_time);

  // Inicializar base44 service
  const base44 = createClientFromRequest(req);

  // Verificar duplicata
  let duplicateLog = null;
  try {
    const existingLogs = await base44.asServiceRole.entities.PipedriveWebhookEvent.filter({ event_id: idempotencyKey });
    if (existingLogs.length > 0) {
      const prev = existingLogs[0];
      // Registrar como duplicata e retornar 200
      await base44.asServiceRole.entities.PipedriveWebhookEvent.create({
        event_id: `dup:${idempotencyKey}:${Date.now()}`,
        event_action: eventAction,
        event_object: eventObject,
        event_type: eventType,
        deal_id: dealId ? Number(dealId) : null,
        activity_id: activityId ? Number(activityId) : null,
        processed: false,
        processed_at: receivedAt,
        result: JSON.stringify({ skipped: "duplicate", original_id: prev.id }),
        source: "webhook",
        duplicate_of: prev.id,
      });
      return Response.json({ ok: true, received: true, event_type: eventType, duplicate: true, deal_id: dealId });
    }
  } catch (e) {
    console.warn("[pipedriveWebhook] Erro ao checar duplicata:", e.message);
  }

  // Criar log inicial (will update após processamento)
  let logEntry;
  try {
    logEntry = await base44.asServiceRole.entities.PipedriveWebhookEvent.create({
      event_id: idempotencyKey,
      event_action: eventAction,
      event_object: eventObject,
      event_type: eventType,
      deal_id: dealId ? Number(dealId) : null,
      activity_id: activityId ? Number(activityId) : null,
      payload_snapshot: JSON.stringify({ current: Object.fromEntries(Object.entries(current).slice(0, 20)), meta }).substring(0, 4000),
      processed: false,
      processed_at: receivedAt,
      activities_updated: 0,
      activities_created: 0,
      dates_ignored: 0,
      source: "webhook",
    });
  } catch (e) {
    console.warn("[pipedriveWebhook] Erro ao criar log inicial:", e.message);
  }

  const responseBase = {
    ok: false,
    received: true,
    event_action: eventAction,
    event_object: eventObject,
    event_type: eventType,
    deal_id: dealId,
    activity_id: activityId,
    project_id: null,
    rules_loaded: 0,
    rules_matched: 0,
    activities_updated: 0,
    activities_created: 0,
    dates_ignored: 0,
    match_errors: [],
    errors: [],
    debug: {},
  };

  try {
    // Carregar regras do banco (fonte única — PipedriveIntegrationRule)
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    responseBase.rules_loaded = rules.length;

    if (rules.length === 0) {
      const msg = "Nenhuma regra de cronograma. Execute 'Atualizar regras da planilha' primeiro.";
      responseBase.errors.push(msg);
      if (logEntry) {
        await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
          processed: false, error: msg, rules_loaded: 0,
        });
      }
      return Response.json(responseBase);
    }

    // Sem deal_id → não processa mas registra
    if (!dealId) {
      if (logEntry) {
        await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
          processed: false, error: "Sem deal_id no payload", rules_loaded: rules.length,
        });
      }
      return Response.json({ ...responseBase, ok: false, errors: ["Sem deal_id no payload"] });
    }

    // Localizar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: Number(dealId) });
    if (!projects.length) {
      const msg = `Nenhum projeto com pipedrive_deal_id=${dealId}`;
      if (logEntry) {
        await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
          processed: false, error: msg, rules_loaded: rules.length,
        });
      }
      return Response.json({ ...responseBase, ok: false, errors: [msg] });
    }
    const project = projects[0];
    responseBase.project_id = project.id;

    if (logEntry) {
      await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
        project_id: project.id,
        project_name: project.name,
      });
    }

    // Resolver dados para aplicar regras
    let dealCurrent = null;
    let activityCurrent = null;

    if (eventObject === "deal") {
      // Para deal, buscar no Pipedrive para ter stage_id atual confirmado
      dealCurrent = await fetchDeal(dealId);
      if (!dealCurrent) {
        responseBase.errors.push(`Deal ${dealId} não encontrado no Pipedrive`);
      }
    } else if (eventObject === "activity") {
      // Usar dados do payload (mais rápido). Se não tiver deal_id, buscar activity
      activityCurrent = current;
      if (!activityCurrent.id) {
        activityCurrent = await fetchActivity(activityId);
      }
      if (activityCurrent && !activityCurrent.deal_id && dealId) {
        activityCurrent.deal_id = dealId;
      }
      // Para regras de deal que podem estar misturadas, buscar deal também
      if (dealId) {
        try { dealCurrent = await fetchDeal(dealId); } catch {}
      }
    }

    // Aplicar regras
    const result = await applyRulesToSchedule({
      base44,
      project,
      rules,
      dealCurrent,
      activityCurrent,
    });

    responseBase.ok = true;
    responseBase.rules_matched = result.rulesMatched;
    responseBase.activities_updated = result.updatedActivities.length;
    responseBase.activities_created = result.createdActivities.length;
    responseBase.dates_ignored = result.datesIgnored.length;
    responseBase.match_errors = result.matchErrors;
    responseBase.debug = {
      updated: result.updatedActivities,
      created: result.createdActivities,
      dates_ignored: result.datesIgnored,
    };

    // Atualizar log
    if (logEntry) {
      await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
        processed: true,
        processed_at: new Date().toISOString(),
        rules_loaded: rules.length,
        rules_matched: result.rulesMatched,
        activities_updated: result.updatedActivities.length,
        activities_created: result.createdActivities.length,
        dates_ignored: result.datesIgnored.length,
        result: JSON.stringify({
          updated: result.updatedActivities,
          created: result.createdActivities,
          dates_ignored: result.datesIgnored,
        }).substring(0, 4000),
        match_errors: JSON.stringify(result.matchErrors),
        error: null,
      });
    }

    console.log(`[pipedriveWebhook] OK event=${eventType} deal=${dealId} project=${project.id} updated=${result.updatedActivities.length} created=${result.createdActivities.length}`);
    return Response.json(responseBase);

  } catch (error) {
    console.error("[pipedriveWebhook] erro inesperado:", error.message);
    responseBase.errors.push(error.message);
    if (logEntry) {
      try {
        await base44.asServiceRole.entities.PipedriveWebhookEvent.update(logEntry.id, {
          processed: false,
          error: error.message,
        });
      } catch {}
    }
    return Response.json({ ...responseBase, ok: false }, { status: 500 });
  }
});