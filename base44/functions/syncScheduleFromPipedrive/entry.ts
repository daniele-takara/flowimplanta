import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PIPE_V1 = "https://api.pipedrive.com/v1";

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  const data = JSON.parse(await res.text());
  return data.data || null;
}

async function fetchAllActivities(dealId, apiToken) {
  const all = [];
  let start = 0;
  while (true) {
    const res = await fetch(
      `${PIPE_V1}/deals/${dealId}/activities?limit=100&start=${start}&api_token=${apiToken}`
    );
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

    // 2. Carregar regras do banco de dados (salvas via "Atualizar regras da planilha")
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (rules.length === 0) {
      return Response.json({
        error: 'Nenhuma regra de cronograma encontrada. Clique em "Atualizar regras da planilha" primeiro.',
      }, { status: 400 });
    }

    // 3. Buscar deal + activities em paralelo
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

    // 4. Carregar atividades do cronograma Base44
    const scheduleActivities = await base44.asServiceRole.entities.ScheduleActivity.filter({ project_id });

    const updatedActivities = [];
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

      // Validar fase existe no cronograma
      const phaseActs = scheduleActivities.filter(a => a.phase_name === base44Fase);
      if (phaseActs.length === 0) {
        matchErrors.push(`Fase "${base44Fase}" não encontrada no cronograma deste projeto`);
        continue;
      }

      // Validar atividade específica existe (se não for *)
      if (base44Atv && base44Atv !== "*") {
        const actExists = phaseActs.some(a => a.activity_name === base44Atv);
        if (!actExists) {
          matchErrors.push(`Atividade "${base44Atv}" não encontrada na fase "${base44Fase}"`);
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
          matchErrors.push(`Regra deal (stage=${valorDisp}): campo_data "${campoData}" sem valor`);
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;

          const patch = {};
          if (fazInicio && !act.actual_start) patch.actual_start = dateStr;
          if (fazFim && !act.actual_end) { patch.actual_end = dateStr; patch.status = "Concluído"; }

          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            Object.assign(act, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, rule_type: "deal", trigger: `stage_id=${valorDisp}` });
            rulesApplied++;
          }
        }
      }

      // ── REGRA ACTIVITY (done + subject) ──────────────────────────────────
      const isActivityRule = entidade === "activity" && (
        campoKey === "done" || valorDisp.toUpperCase() === "TRUE" || valorDisp === "1"
      );

      if (isActivityRule) {
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
            matchErrors.push(`Regra activity (subject="${pAct.subject}"): nenhuma data disponível`);
            continue;
          }

          for (const act of phaseActs) {
            if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;

            const patch = {};
            if (fazFim && !act.actual_end) {
              patch.actual_end = dateStr;
              if (!act.actual_start) patch.actual_start = dateStr;
              patch.status = "Concluído";
            }
            if (fazInicio && !act.actual_start) patch.actual_start = dateStr;

            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({
                id: act.id, name: act.activity_name, phase: base44Fase, patch,
                rule_type: "activity", trigger: `subject="${pAct.subject}"`,
              });
              rulesApplied++;
            }
          }
        }

        if (!matchedAny && valorIdent) {
          matchErrors.push(`Nenhuma activity concluída encontrada com ${campoIdent}="${valorIdent}"`);
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
      activities: updatedActivities,
      match_errors: matchErrors,
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});