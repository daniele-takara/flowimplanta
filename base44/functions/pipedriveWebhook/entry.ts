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

const CANONICAL_ACTIVITIES_BY_PHASE = {
  "Abertura de projeto": [
    "Alinhamento inicial",
    "Agenda de escopo técnico",
    "Envio de Termo de Abertura do Projeto e cronograma",
    "Agenda de Status report recorrente (1ª Validação de Cronograma e Termo de abertura)",
  ],
  "Integração": [
    "[Sankhya] Envio do formulário de dados para integração",
    "Preenchimento do formulário de integração [para clientes Sankhya]",
    "Inicio da ativação da integração, análise de inconsistências, alinhamento com o cliente para ajustes",
    "[Sankhya] Correção de cadastros Sankhya",
    "Ativação da integração [para clientes Sankhya]",
  ],
  "Cadastros": [
    "Envio da documentação com orientações para o uso do I05",
    "Importação de cadastros pelo I05",
    "Envio da planilha de importação de escalas [para clientes Sankhya]",
  ],
  "Parametrização": [
    "Reunião para parametrização de Regras (Cálculo, banco de horas e arquivo de exportação)",
    "Parametrização de regras",
    "Parametrizar permissões de usuários de acordo com o que foi definido no escopo",
    "Validar parametrização de cadastro de empregados e usuários para o registro de ponto de acordo com o escopo técnico",
  ],
  "Treinamento e Validações": [
    "Assistir ao curso EAD da Universidade",
    "Reunião para validar Regras de cálculo de banco de horas",
    "Reunião para validar Arquivo de exportação",
    "Reunião para explicar o uso e validação do fluxo de gestão",
  ],
  "Operação Assistida": [
    "Agenda de inicio de registro de ponto",
    "Inicio de registro de ponto (Go Live)",
    "Agenda de verificação e gestão de folha de ponto (pré-fechamento de ponto)",
  ],
  "Fechamento de Folha": [
    "Agenda fechamento de folha de ponto",
    "Fechamento de folha",
  ],
  "Expansão": [
    "Expansão de registro de ponto real",
    "Fechamento de folha de ponto real (100% da base)",
  ],
  "Encerramento": [
    "Agenda de encerramento de projeto",
    "Assinatura do termo de encerramento de projeto",
    "Passagem para sucesso do cliente",
  ],
};

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

/**
 * Pipedrive é a FONTE DE VERDADE para datas de execução.
 * Via integração (webhook/sync): sempre sobrescreve actual_start e actual_end.
 * Via edição manual: preserva valor existente.
 */
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

/**
 * Busca o histórico real de movimentação de etapas via GET /v1/deals/{id}/flow.
 * Retorna Map de stageId (number) → primeira data de entrada (YYYY-MM-DD).
 */
async function fetchStageEntryDates(dealId, apiToken) {
  const stageMap = new Map();
  try {
    let start = 0;
    while (true) {
      const res = await fetch(`${PIPE_V1}/deals/${dealId}/flow?limit=100&start=${start}&api_token=${apiToken}`);
      if (res.status === 429) throw new Error("Rate limit Pipedrive (429)");
      if (!res.ok) { console.warn(`[fetchStageEntryDates] flow ${res.status}`); break; }
      const data = await res.json();
      const items = data.data || [];
      for (const item of items) {
        const d = item.data || item;
        const newStage = d.stage_id_new != null ? Number(d.stage_id_new) : null;
        const logTime  = item.log_time || d.log_time || item.add_time || d.add_time || null;
        if (newStage != null && logTime && !stageMap.has(newStage)) {
          stageMap.set(newStage, String(logTime).substring(0, 10));
          console.log(`[pipedriveWebhook/flow] stage ${newStage} → ${String(logTime).substring(0, 10)}`);
        }
      }
      if (!data.additional_data?.pagination?.more_items_in_collection || items.length === 0) break;
      start += 100;
    }
  } catch (e) {
    console.warn(`[pipedriveWebhook/flow] Erro: ${e.message}`);
  }
  return stageMap;
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

  // Localizar projeto — unicidade: se duplicados, usa o mais recente e loga alerta
  let project = null;
  try {
    const projects = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: Number(dealId) });
    if (projects.length > 1) {
      console.warn(`[pipedriveWebhook] ⚠️ DUPLICADO: ${projects.length} projetos com pipedrive_deal_id=${dealId}. IDs: ${projects.map(p => p.id).join(", ")}. Usando o mais recente.`);
      projects.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
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

    const [pipeActivities, stageEntryDates] = await Promise.all([
      fetchAllActivities(dealId, apiToken),
      fetchStageEntryDates(dealId, apiToken),
    ]);
    console.log(`[pipedriveWebhook] Activities do deal: ${pipeActivities.length} total, ${pipeActivities.filter(a => a.done).length} concluídas`);
    console.log(`[pipedriveWebhook] Flow histórico: ${stageEntryDates.size} etapas → ${JSON.stringify(Object.fromEntries(stageEntryDates))}`);

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

    // Cópia profunda para evitar mutação de referências compartilhadas entre regras
    const activitiesCache = scheduleActivities.map(a => ({ ...a }));

    function phaseExists(fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(fase));
    }
    // Sempre retorna nova lista filtrada — garante isolamento entre regras com mesmo stage_id
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
      // ISOLAMENTO: cada regra obtém sua própria lista filtrada por phase_name
      let phaseActs = getPhaseActivities(base44Fase);
      console.log(`[pipedriveWebhook] [Regra #${rule.order}] LOOKUP fase="${base44Fase}" stage_id=${valorDisp} → ${phaseActs.length} atividades [${phaseActs.map(a => a.activity_name).join(" | ")}]`);

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

        // actual_start: usa data histórica real do flow; actual_end: usa deal ao vivo
        let dateStr;
        if (fazInicio && stageEntryDates.has(ruleStageNum)) {
          dateStr = stageEntryDates.get(ruleStageNum);
          ruleEntry.date_source = "flow_history";
          console.log(`[pipedriveWebhook] [Regra #${rule.order}] actual_start via FLOW HISTÓRICO: stage=${ruleStageNum} → ${dateStr}`);
        } else {
          dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time) || new Date().toISOString().substring(0, 10);
          ruleEntry.date_source = "deal_live";
          console.log(`[pipedriveWebhook] [Regra #${rule.order}] actual_start/end via deal ao vivo: ${dateStr}`);
        }
        ruleEntry.date_used = dateStr;
        ruleEntry.date_field = campoData;

        // Wildcard "*": garantir que TODAS as atividades canônicas da fase existam no banco
        if (base44Atv === "*") {
          const canonicalNames = CANONICAL_ACTIVITIES_BY_PHASE[base44Fase] || [];
          console.log(`[pipedriveWebhook] [Regra #${rule.order}] wildcard "*" → fase="${base44Fase}" | canônicas=${canonicalNames.length} | existentes=${phaseActs.length}`);
          for (let i = 0; i < canonicalNames.length; i++) {
            const cName = canonicalNames[i];
            const alreadyExists = phaseActs.find(a => normalize(a.activity_name) === normalize(cName));
            if (!alreadyExists) {
              console.log(`[pipedriveWebhook]   CRIANDO atividade faltante: "${cName}"`);
              const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
                project_id: project.id, phase_name: base44Fase, activity_name: cName,
                status: "Não iniciado", order: i + 1,
              });
              activitiesCache.push(newAct);
              ruleEntry.actions.push(`CRIOU atividade faltante "${cName}"`);
              phaseActs = getPhaseActivities(base44Fase);
            }
          }
        }

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
        // Pipedrive é fonte de verdade: SEMPRE sobrescreve actual_start e actual_end
        let actsProcessed = 0;
        for (const act of phaseActs) {
          // Wildcard "*" = todas; senão filtra por nome
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) {
            ruleEntry.actions.push(`SKIP "${act.activity_name}" — nome não bate com "${base44Atv}"`);
            continue;
          }
          const patch = {};
          if (fazInicio) {
            console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_start: "${act.actual_start}" → "${dateStr}" (sobrescrita Pipedrive)`);
            patch.actual_start = dateStr;
            ruleEntry.actions.push(`SOBRESCREVEU actual_start: "${act.actual_start}" → "${dateStr}"`);
          }
          if (fazFim) {
            console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_end: "${act.actual_end}" → "${dateStr}" (sobrescrita Pipedrive)`);
            patch.actual_end = dateStr;
            patch.status = "Concluído";
            ruleEntry.actions.push(`SOBRESCREVEU actual_end: "${act.actual_end}" → "${dateStr}"`);
          }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            const cacheIdx = activitiesCache.findIndex(c => c.id === act.id);
            if (cacheIdx >= 0) Object.assign(activitiesCache[cacheIdx], patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `stage_id=${currentStageNum}` });
            rulesApplied++;
            actsProcessed++;
          }
        }
        console.log(`[pipedriveWebhook] [Regra #${rule.order}] fase="${base44Fase}" processadas ${actsProcessed} atividades`);
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

          // Pipedrive é fonte de verdade: SEMPRE sobrescreve actual_start e actual_end
          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const patch = {};
            if (fazFim) {
              console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_end: "${act.actual_end}" → "${dateStr}" (sobrescrita Pipedrive)`);
              patch.actual_end = dateStr;
              patch.status = "Concluído";
              ruleEntry.actions.push(`SOBRESCREVEU actual_end: "${act.actual_end}" → "${dateStr}"`);
            }
            if (fazInicio) {
              console.log(`[pipedriveWebhook]   atividade="${act.activity_name}" actual_start: "${act.actual_start}" → "${dateStr}" (sobrescrita Pipedrive)`);
              patch.actual_start = dateStr;
              ruleEntry.actions.push(`SOBRESCREVEU actual_start: "${act.actual_start}" → "${dateStr}"`);
            }
            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              const cacheIdx = activitiesCache.findIndex(c => c.id === act.id);
              if (cacheIdx >= 0) Object.assign(activitiesCache[cacheIdx], patch);
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done subject="${pAct.subject}"` });
              ruleEntry.actions.push(`ATUALIZOU fase="${base44Fase}" atividade="${act.activity_name}": ${JSON.stringify(patch)}`);
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