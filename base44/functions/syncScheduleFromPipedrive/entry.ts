import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const SHEET_NAME = "Integracao";

const STAGE_NAME_TO_ID = {
  "inicio de projeto": "142",
  "início de projeto": "142",
  "alocar responsável": "140",
  "passagem de bastão": "141",
  "parametrizações": "143",
};

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

async function loadRules(accessToken) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
}

async function fetchPipedriveDeal(dealId, apiToken) {
  const res = await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`);
  const data = await res.json();
  return data.data || null;
}

async function fetchPipedriveActivities(dealId, apiToken) {
  const res = await fetch(`https://api.pipedrive.com/v1/deals/${dealId}/activities?limit=100&api_token=${apiToken}`);
  const data = await res.json();
  return data.data || [];
}

function resolveStageId(valorDisp) {
  const raw = valorDisp.trim();
  if (/^\d+$/.test(raw)) return raw;
  const normalized = raw.toLowerCase().replace(/[""""\u201c\u201d]/g, "").trim();
  const matched = normalized.match(/(?:etapa\s+)?"?([^"]+)"?\s*$/);
  const key = matched ? matched[1].trim() : normalized;
  return STAGE_NAME_TO_ID[key] || raw;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    // Buscar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({ error: 'Projeto sem pipedrive_deal_id' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // Buscar dados do Pipedrive em paralelo
    const [deal, pipeActivities] = await Promise.all([
      fetchPipedriveDeal(dealId, apiToken),
      fetchPipedriveActivities(dealId, apiToken),
    ]);

    if (!deal) return Response.json({ error: 'Deal não encontrado no Pipedrive' }, { status: 404 });

    const currentStageId = String(deal.stage_id || "");
    const updateTime = extractDate(deal.update_time);

    console.log("[syncSchedule] deal:", dealId, "stage:", currentStageId, "activities:", pipeActivities.length);

    // Carregar regras da planilha
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const rules = await loadRules(accessToken);
    console.log("[syncSchedule] regras:", rules.length);

    // Carregar atividades do cronograma Base44
    const scheduleActivities = await base44.asServiceRole.entities.ScheduleActivity.filter({ project_id });

    const updatedActivities = [];
    const appliedRules = [];

    for (const rule of rules) {
      const entidade   = (rule.pipedrive_entidade || "").toLowerCase();
      const campoKey   = rule.pipedrive_campo_key || "";
      const valorDisp  = rule.pipedrive_valor_disparo || "";
      const base44Fase = rule.base44_fase || "";
      const base44Atv  = rule.base44_atividade || "";
      const campoData  = rule.pipedrive_campo_data || "";

      // Detectar colunas início/fim (suporta variações de header)
      const iniKey = Object.keys(rule).find(k => /in.?cio/i.test(k)) || "início";
      const fazInicio = (rule[iniKey] || "").toLowerCase() === "sim";
      const fazFim    = (rule["fim"] || "").toLowerCase() === "sim";

      if (!base44Fase) continue;

      // ── REGRA DEAL (stage) ───────────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        const targetStageId = resolveStageId(valorDisp);
        if (currentStageId !== targetStageId) continue;

        const dateStr = extractDate(deal[campoData]) || updateTime;
        if (!dateStr) continue;

        const phaseActivities = scheduleActivities.filter(a => a.phase_name === base44Fase);

        for (const act of phaseActivities) {
          if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;

          const patch = {};
          if (fazInicio && !act.actual_start) patch.actual_start = dateStr;
          if (fazFim    && !act.actual_end)   { patch.actual_end = dateStr; patch.status = "Concluído"; }

          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            // Atualizar cache local
            Object.assign(act, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch });
            console.log("[syncSchedule] deal-rule atualizado:", act.activity_name, patch);
          }
        }

        appliedRules.push({ type: "deal", stage: targetStageId, fase: base44Fase, atividade: base44Atv });
      }

      // ── REGRA ACTIVITY (done) ────────────────────────────────────────────────
      if (entidade === "activity") {
        const campoIdent = rule.pipedrive_campo_identificacao || "";
        const valorIdent = rule.pipedrive_valor_identificacao || "";

        for (const pAct of pipeActivities) {
          // Checar done
          const doneVal = String(pAct[campoKey] || "").toLowerCase();
          const isDone = doneVal === "true" || doneVal === "1" || pAct.done === true;
          if (!isDone) continue;

          // Checar identificação (subject)
          if (campoIdent && valorIdent) {
            const actualVal = String(pAct[campoIdent] || "").trim();
            if (actualVal !== valorIdent) continue;
          }

          const dateStr = extractDate(pAct[campoData] || pAct.marked_as_done_time || pAct.update_time);
          if (!dateStr) continue;

          const phaseActivities = scheduleActivities.filter(a => a.phase_name === base44Fase);

          for (const act of phaseActivities) {
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
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch });
              console.log("[syncSchedule] activity-rule atualizado:", act.activity_name, patch);
            }
          }

          appliedRules.push({ type: "activity", subject: pAct.subject, fase: base44Fase, atividade: base44Atv });
        }
      }
    }

    return Response.json({
      ok: true,
      deal_id: dealId,
      project_id,
      deal_stage_id: currentStageId,
      rules_total: rules.length,
      rules_applied: appliedRules.length,
      updated: updatedActivities.length,
      activities: updatedActivities,
      applied_rules: appliedRules,
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});