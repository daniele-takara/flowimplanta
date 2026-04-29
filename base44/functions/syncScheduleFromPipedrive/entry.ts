import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const CRONOGRAMA_GID = "1377224895"; // Aba "Cronograma - Integração"
const PIPE_V1 = "https://api.pipedrive.com/v1";

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

// Lê uma aba da planilha por GID (resolve o nome dinamicamente)
async function loadSheetByGid(accessToken, gid) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const sheetMeta = meta.sheets?.find(s => String(s.properties.sheetId) === gid);
  if (!sheetMeta) throw new Error(`Aba GID ${gid} não encontrada na planilha`);
  const sheetName = sheetMeta.properties.title;

  const dataRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await dataRes.json();
  const rows = data.values || [];
  if (rows.length < 2) return { sheetName, rows: [] };

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const parsed = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
  return { sheetName, rows: parsed };
}

// Busca deal via API v1 (retorna stage_id, update_time, etc.)
async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  const text = await res.text();
  const data = JSON.parse(text);
  return data.data || null;
}

// Busca TODAS as activities do deal (paginado, todas — não só as done)
async function fetchAllActivities(dealId, apiToken) {
  const all = [];
  let start = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(
      `${PIPE_V1}/deals/${dealId}/activities?limit=${limit}&start=${start}&api_token=${apiToken}`
    );
    const text = await res.text();
    const data = JSON.parse(text);
    const items = data.data || [];
    all.push(...items);
    const hasMore = data.additional_data?.pagination?.more_items_in_collection === true;
    if (!hasMore || items.length === 0) break;
    start += limit;
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

    // 1. Buscar projeto no Base44
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({ error: 'Projeto não vinculado ao Pipedrive. Configure o ID Deal Pipedrive nos Dados Iniciais.' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 2. Buscar deal + todas as atividades em paralelo (API v1)
    const [deal, pipeActivities] = await Promise.all([
      fetchDeal(dealId, apiToken),
      fetchAllActivities(dealId, apiToken),
    ]);

    if (!deal) return Response.json({ error: `Deal ${dealId} não encontrado no Pipedrive` }, { status: 404 });

    const currentStageId = String(deal.stage_id ?? "");
    const doneActivities = pipeActivities.filter(a => a.done === true || a.done === 1);

    console.log(`[syncSchedule] deal=${dealId} stage_id=${currentStageId} activities_total=${pipeActivities.length} activities_done=${doneActivities.length}`);

    // 3. Carregar regras da aba "Cronograma - Integração" pelo GID
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const { sheetName, rows: rules } = await loadSheetByGid(accessToken, CRONOGRAMA_GID);
    console.log(`[syncSchedule] aba="${sheetName}" regras=${rules.length}`);

    // 4. Carregar atividades do cronograma Base44
    const scheduleActivities = await base44.asServiceRole.entities.ScheduleActivity.filter({ project_id });
    console.log(`[syncSchedule] schedule_activities=${scheduleActivities.length}`);

    const updatedActivities = [];
    const matchErrors = [];
    let rulesApplied = 0;

    for (const rule of rules) {
      const entidade   = (rule.pipedrive_entidade || "").toLowerCase().trim();
      const campoKey   = (rule.pipedrive_campo_key || "").trim();
      const valorDisp  = (rule.pipedrive_valor_disparo || "").trim();
      const base44Fase = (rule.base44_fase || "").trim();
      const base44Atv  = (rule.base44_atividade || "").trim();
      const campoData  = (rule.pipedrive_campo_data || "").trim();

      // Colunas início/fim — header pode vir com ou sem acento
      const iniKey = Object.keys(rule).find(k => /in.?cio/i.test(k)) || "início";
      const fazInicio = (rule[iniKey] || "").toLowerCase() === "sim";
      const fazFim    = (rule["fim"] || "").toLowerCase() === "sim";

      if (!base44Fase) continue;
      if (!fazInicio && !fazFim) continue;

      // ── REGRA DEAL (stage_id) ─────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        if (currentStageId !== valorDisp) {
          console.log(`[syncSchedule] deal skip: stage=${currentStageId} esperado=${valorDisp}`);
          continue;
        }

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        if (!dateStr) {
          matchErrors.push(`Regra deal (stage=${valorDisp}): campo_data "${campoData}" vazio`);
          continue;
        }

        const phaseActs = scheduleActivities.filter(a => a.phase_name === base44Fase);
        if (phaseActs.length === 0) {
          matchErrors.push(`Regra deal: fase "${base44Fase}" não tem atividades no cronograma deste projeto`);
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
            console.log(`[syncSchedule] ✓ deal-rule "${act.activity_name}"`, patch);
          }
        }
      }

      // ── REGRA ACTIVITY (done + subject) ──────────────────────────────────
      // pipedrive_campo_key pode ser "done" e valorDisp pode ser "TRUE", "true", "1"
      const isActivityRule = entidade === "activity" && (
        campoKey === "done" ||
        valorDisp.toUpperCase() === "TRUE" ||
        valorDisp === "1"
      );
      if (isActivityRule) {
        const campoIdent = (rule.pipedrive_campo_identificacao || "").trim();
        const valorIdent = (rule.pipedrive_valor_identificacao || "").trim();

        // Percorre TODAS as activities do deal
        for (const pAct of pipeActivities) {
          // done pode vir como booleano true, número 1 ou string "true"/"1"
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;

          // Verificar identificação (subject)
          if (campoIdent && valorIdent) {
            const actVal = String(pAct[campoIdent] || "").trim();
            if (actVal !== valorIdent) continue;
          }

          const dateStr = extractDate(pAct[campoData])
            || extractDate(pAct.marked_as_done_time)
            || extractDate(pAct.update_time);
          if (!dateStr) {
            matchErrors.push(`Regra activity (subject="${pAct.subject}"): nenhuma data disponível`);
            continue;
          }

          const phaseActs = scheduleActivities.filter(a => a.phase_name === base44Fase);
          if (phaseActs.length === 0) {
            matchErrors.push(`Regra activity: fase "${base44Fase}" não tem atividades no cronograma deste projeto`);
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
                id: act.id,
                name: act.activity_name,
                phase: base44Fase,
                patch,
                rule_type: "activity",
                trigger: `subject="${pAct.subject}"`,
              });
              rulesApplied++;
              console.log(`[syncSchedule] ✓ activity-rule "${act.activity_name}"`, patch);
            }
          }
        }
      }
    }

    return Response.json({
      ok: true,
      // Dados do vínculo
      deal_id: dealId,
      project_id,
      // Relatório do Pipedrive
      deal_stage_id: currentStageId,
      activities_found: pipeActivities.length,
      activities_done: doneActivities.length,
      // Relatório das regras
      sheet_tab: sheetName,
      rules_total: rules.length,
      rules_applied: rulesApplied,
      // Resultado
      updated: updatedActivities.length,
      activities: updatedActivities,
      match_errors: matchErrors,
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});