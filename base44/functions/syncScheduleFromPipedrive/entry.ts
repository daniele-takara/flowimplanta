import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PIPE_V1 = "https://api.pipedrive.com/v1";

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

// Normaliza string: trim + lowercase + sem acentos
const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "");

async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  const text = await res.text();
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429). Aguarde alguns minutos.");
  if (res.status === 401 || res.status === 403) throw new Error(`Acesso negado ao Pipedrive (${res.status}). Verifique o API token.`);
  const data = JSON.parse(text);
  return data.data || null;
}

async function fetchAllActivities(dealId, apiToken) {
  const all = [];
  let start = 0;
  while (true) {
    const res = await fetch(
      `${PIPE_V1}/deals/${dealId}/activities?limit=100&start=${start}&api_token=${apiToken}`
    );
    if (res.status === 429) throw new Error("Rate limit Pipedrive (429). Aguarde alguns minutos.");
    const data = JSON.parse(await res.text());
    const items = data.data || [];
    all.push(...items);
    const hasMore = data.additional_data?.pagination?.more_items_in_collection === true;
    if (!hasMore || items.length === 0) break;
    start += 100;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id } = body;
    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    // 1. Buscar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({
      error: 'Projeto não vinculado ao Pipedrive. Configure o ID Deal Pipedrive nos Dados Iniciais.',
    }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 2. Carregar regras de cronograma
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (rules.length === 0) {
      return Response.json({
        error: 'Nenhuma regra de cronograma encontrada. Clique em "Atualizar regras da planilha" primeiro.',
      }, { status: 400 });
    }

    // 3. Buscar deal + activities do Pipedrive em paralelo
    const [deal, pipeActivities] = await Promise.all([
      fetchDeal(dealId, apiToken),
      fetchAllActivities(dealId, apiToken),
    ]);

    if (!deal) return Response.json({ error: `Deal ${dealId} não encontrado no Pipedrive` }, { status: 404 });

    const currentStageId = String(deal.stage_id ?? "");
    const doneActivities = pipeActivities.filter(a =>
      a.done === true || a.done === 1 || String(a.done).toLowerCase() === "true"
    );

    console.log(`[syncSchedule] deal=${dealId} stage=${currentStageId} pipe_acts=${pipeActivities.length} done=${doneActivities.length} rules=${rules.length}`);

    // 4. Carregar dados do cronograma do projeto
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id }),
    ]);

    // Fases disponíveis: SchedulePhase é fonte primária; complementa com fases das atividades
    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];

    console.log(`[syncSchedule] SchedulePhase: ${JSON.stringify(phasesFromPhaseEntity)}`);
    console.log(`[syncSchedule] Fases nas atividades: ${JSON.stringify(phasesFromActivities)}`);

    if (allProjectPhases.length === 0) {
      return Response.json({
        ok: false,
        error: "Cronograma do projeto não carregado corretamente",
        detail: "Nenhuma fase encontrada para este projeto. Verifique se o cronograma foi criado.",
        available_phases: [],
      }, { status: 400 });
    }

    // Cache mutável de atividades (para refletir criações durante o loop)
    const activitiesCache = [...scheduleActivities];

    // Helper: encontrar atividades de uma fase (busca no cache)
    // Se a fase existe em SchedulePhase mas não tem atividades, retorna array vazio com flag de "fase válida"
    function getPhaseActivities(base44Fase) {
      const acts = activitiesCache.filter(a => normalize(a.phase_name) === normalize(base44Fase));
      return acts;
    }

    // Helper: verificar se fase existe no projeto (SchedulePhase OU atividades)
    function phaseExists(base44Fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(base44Fase));
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

      if (!base44Fase) continue;
      if (!fazInicio && !fazFim) continue;

      // Verificar se fase existe no projeto
      if (!phaseExists(base44Fase)) {
        matchErrors.push(
          `Fase "${base44Fase}" não existe neste projeto. Fases disponíveis: ${allProjectPhases.map(f => `"${f}"`).join(", ")}`
        );
        continue;
      }

      // Buscar atividades da fase
      let phaseActs = getPhaseActivities(base44Fase);

      // Se fase existe mas não tem atividades E a regra aponta para uma atividade específica,
      // precisamos de uma atividade alvo. Se base44Atv = "*", não há o que atualizar sem atividades.
      // Neste caso: reportamos como informativo (não erro), pois o cronograma detalhado ainda não foi gerado.
      if (phaseActs.length === 0) {
        console.log(`[syncSchedule] Fase "${base44Fase}" existe mas sem atividades no cronograma detalhado.`);
        // Se a atividade alvo é específica (não "*"), criar registro automaticamente
        if (base44Atv && base44Atv !== "*") {
          // Tentar obter data para usar na criação
          let autoDateStr = null;

          if (entidade === "deal" && campoKey === "stage_id" && currentStageId === valorDisp) {
            autoDateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
          } else if (entidade === "activity") {
            const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
            const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();
            for (const pAct of doneActivities) {
              if (campoIdent && valorIdent) {
                if (String(pAct[campoIdent] || "").trim() !== valorIdent) continue;
              }
              autoDateStr = extractDate(pAct[campoData])
                || extractDate(pAct.marked_as_done_time)
                || extractDate(pAct.update_time);
              if (autoDateStr) break;
            }
          }

          if (autoDateStr) {
            const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
              project_id,
              phase_name: base44Fase,
              activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? autoDateStr : null,
              actual_end: fazFim ? autoDateStr : null,
              order: 1,
            });
            activitiesCache.push(newAct);
            createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase });
            rulesApplied++;
            console.log(`[syncSchedule] Atividade criada: "${base44Atv}" na fase "${base44Fase}"`);
          } else {
            console.log(`[syncSchedule] Fase "${base44Fase}" sem atividades e sem data disponível para criar.`);
          }
          continue;
        }
        // base44Atv = "*" sem atividades: nada a fazer
        continue;
      }

      // Validar atividade específica existe nas atividades da fase
      if (base44Atv && base44Atv !== "*") {
        const actExists = phaseActs.some(a => normalize(a.activity_name) === normalize(base44Atv));
        if (!actExists) {
          const available = phaseActs.map(a => `"${a.activity_name}"`).join(", ");
          matchErrors.push(`Atividade "${base44Atv}" não encontrada na fase "${base44Fase}". Disponíveis: ${available}`);
          continue;
        }
      }

      // ── REGRA DEAL (stage_id) ─────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        if (currentStageId !== valorDisp) {
          console.log(`[syncSchedule] deal skip: stage=${currentStageId} esperado=${valorDisp}`);
          continue;
        }

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        if (!dateStr) {
          matchErrors.push(`Regra deal (stage=${valorDisp}): campo "${campoData}" sem valor`);
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;

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

        let matchedAny = false;
        for (const pAct of pipeActivities) {
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;

          if (campoIdent && valorIdent) {
            const actVal = String(pAct[campoIdent] || "").trim();
            if (actVal !== valorIdent) continue;
          }

          matchedAny = true;
          const dateStr = extractDate(pAct[campoData])
            || extractDate(pAct.marked_as_done_time)
            || extractDate(pAct.update_time);

          if (!dateStr) {
            matchErrors.push(`Activity "${pAct.subject}": nenhuma data disponível`);
            continue;
          }

          for (const act of phaseActs) {
            if (base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;

            const patch = {};
            if (fazFim && !act.actual_end) {
              patch.actual_end = dateStr;
              if (!act.actual_start) patch.actual_start = dateStr;
              patch.status = "Concluído";
            } else if (fazInicio && !act.actual_start) {
              patch.actual_start = dateStr;
            }

            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({
                id: act.id, name: act.activity_name, phase: base44Fase, patch,
                trigger: `activity subject="${pAct.subject}"`,
              });
              rulesApplied++;
            }
          }
        }

        if (!matchedAny && valorIdent) {
          matchErrors.push(`Nenhuma activity concluída com ${campoIdent}="${valorIdent}"`);
        }
      }
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
      phases_from_phase_entity: phasesFromPhaseEntity,
      phases_from_activities: phasesFromActivities,
      schedule_activities_count: scheduleActivities.length,
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});