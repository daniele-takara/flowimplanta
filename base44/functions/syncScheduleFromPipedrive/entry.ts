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
    const res = await fetch(`${PIPE_V1}/deals/${dealId}/activities?limit=100&start=${start}&api_token=${apiToken}`);
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

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    // 1. Buscar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({ error: 'Projeto não vinculado ao Pipedrive. Configure o ID Deal Pipedrive nos Dados Iniciais.' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 2. Buscar regras EXCLUSIVAMENTE do Base44 (fonte de verdade)
    const allRules = await base44.asServiceRole.entities.PipedriveRule.filter({ ativo: true });
    const rules = allRules.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (rules.length === 0) {
      return Response.json({ error: 'Nenhuma regra ativa cadastrada. Configure as regras em Parametrizações > Integração Pipedrive.' }, { status: 400 });
    }

    // 3. Buscar dados do Pipedrive em paralelo
    const [deal, pipeActivities] = await Promise.all([
      fetchDeal(dealId, apiToken),
      fetchAllActivities(dealId, apiToken),
    ]);

    if (!deal) return Response.json({ error: `Deal ${dealId} não encontrado no Pipedrive` }, { status: 404 });

    const currentStageId = String(deal.stage_id ?? "");
    const doneActivities = pipeActivities.filter(a => a.done === true || a.done === 1 || String(a.done).toLowerCase() === "true");

    console.log(`[syncSchedule] deal=${dealId} stage_id=${currentStageId} activities_total=${pipeActivities.length} done=${doneActivities.length} rules=${rules.length}`);

    // 4. Carregar atividades do cronograma Base44
    const scheduleActivities = await base44.asServiceRole.entities.ScheduleActivity.filter({ project_id });

    const updatedActivities = [];
    const matchErrors = [];
    let rulesApplied = 0;

    for (const rule of rules) {
      const entidade    = (rule.pipedrive_entidade || "").toLowerCase();
      const campoKey    = rule.pipedrive_campo_key || "";
      const valorDisp   = rule.pipedrive_valor_disparo || "";
      const base44Fase  = rule.base44_fase || "";
      const base44Atv   = rule.base44_atividade || "";
      const campoData   = rule.pipedrive_campo_data || "";
      const fazInicio   = !!rule.atualiza_inicio;
      const fazFim      = !!rule.atualiza_fim;

      if (!base44Fase || (!fazInicio && !fazFim)) continue;

      // Validar existência da fase no cronograma
      const phaseActs = scheduleActivities.filter(a => a.phase_name === base44Fase);
      if (phaseActs.length === 0) {
        matchErrors.push(`Regra "${rule.descricao || rule.id}": fase "${base44Fase}" não encontrada no cronograma deste projeto`);
        continue;
      }

      // Validar existência da atividade (se não for curinga)
      if (base44Atv !== "*") {
        const found = phaseActs.find(a => a.activity_name === base44Atv);
        if (!found) {
          matchErrors.push(`Regra "${rule.descricao || rule.id}": atividade "${base44Atv}" não encontrada na fase "${base44Fase}"`);
          continue;
        }
      }

      // ── REGRA DEAL (stage_id) ──────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        if (currentStageId !== valorDisp) {
          console.log(`[syncSchedule] deal skip: stage=${currentStageId} esperado=${valorDisp}`);
          continue;
        }

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        if (!dateStr) {
          matchErrors.push(`Regra "${rule.descricao || rule.id}": campo_data "${campoData}" vazio no deal`);
          continue;
        }

        for (const act of phaseActs) {
          if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;
          const patch = {};
          if (fazInicio && !act.actual_start) patch.actual_start = dateStr;
          if (fazFim    && !act.actual_end)   { patch.actual_end = dateStr; patch.status = "Concluído"; }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            Object.assign(act, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, rule_type: "deal", trigger: `stage_id=${valorDisp}` });
            rulesApplied++;
          }
        }
      }

      // ── REGRA ACTIVITY (done) ──────────────────────────────────────────────
      if (entidade === "activity") {
        const campoIdent = rule.pipedrive_campo_identificacao || "";
        const valorIdent = rule.pipedrive_valor_identificacao || "";

        for (const pAct of pipeActivities) {
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;

          if (campoIdent && valorIdent) {
            if (String(pAct[campoIdent] || "").trim() !== valorIdent) continue;
          }

          const dateStr = extractDate(pAct[campoData]) || extractDate(pAct.marked_as_done_time) || extractDate(pAct.update_time);
          if (!dateStr) {
            matchErrors.push(`Regra "${rule.descricao || rule.id}": nenhuma data disponível para activity "${pAct.subject}"`);
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
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, rule_type: "activity", trigger: `subject="${pAct.subject}"` });
              rulesApplied++;
            }
          }
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