import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const SHEET_NAME = "Cronograma - Integração";

// Lê as regras da planilha "Cronograma - Integração"
// Colunas: pipedrive_entidade, pipedrive_evento, pipedrive_campo_key, pipedrive_valor_disparo,
//          pipedrive_campo_identificacao, pipedrive_valor_identificacao, pipedrive_campo_data,
//          base44_fase, base44_atividade, base44_acao, inicio, fim
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

function extractDate(val) {
  if (!val) return null;
  return String(val).substring(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Payload do webhook Pipedrive
    const body = await req.json();
    console.log("[pipedriveWebhook] event:", body.event, "meta:", JSON.stringify(body.meta || {}));

    const event = body.event || ""; // ex: "updated.deal", "updated.activity"
    const current = body.current || {};
    const previous = body.previous || {};

    // Carregar regras da planilha
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const rules = await loadRules(accessToken);
    console.log("[pipedriveWebhook] regras carregadas:", rules.length);

    // Identificar deal_id para localizar o projeto no Base44
    let dealId = null;
    if (event.includes("deal")) {
      dealId = current.id || body.meta?.id;
    } else if (event.includes("activity")) {
      dealId = current.deal_id || body.meta?.deal_id;
    }

    if (!dealId) {
      console.log("[pipedriveWebhook] sem deal_id, ignorando");
      return Response.json({ ok: true, skipped: "no deal_id" });
    }

    // Encontrar projeto no Base44 via pipedrive_deal_id
    const projects = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: dealId });
    if (!projects.length) {
      console.log("[pipedriveWebhook] nenhum projeto encontrado para deal_id:", dealId);
      return Response.json({ ok: true, skipped: "no project found", deal_id: dealId });
    }
    const project = projects[0];
    console.log("[pipedriveWebhook] projeto encontrado:", project.id, project.name);

    const updatedActivities = [];

    // Processar cada regra
    for (const rule of rules) {
      const entidade  = rule.pipedrive_entidade || "";
      const campoKey  = rule.pipedrive_campo_key || "";
      const valorDisp = rule.pipedrive_valor_disparo || "";
      const base44Fase = rule.base44_fase || "";
      const base44Atv  = rule.base44_atividade || "";
      const campoData  = rule.pipedrive_campo_data || "";
      // Colunas "início" e "fim" da planilha
      const iniKey = Object.keys(rule).find(k => k.includes("in") && k.includes("cio")) || "início";
      const fazInicio  = (rule[iniKey] || "").toLowerCase() === "sim";
      const fazFim     = (rule["fim"] || "").toLowerCase() === "sim";

      // ── REGRA ACTIVITY (done) ──────────────────────────────────────────────
      if (entidade === "activity" && event.includes("activity")) {
        const currentDoneVal = String(current[campoKey] || "").toLowerCase();
        const matchDone = (valorDisp.toLowerCase() === "true" && currentDoneVal === "true") ||
                          (valorDisp.toLowerCase() === "1"    && currentDoneVal === "1");

        if (!matchDone) continue;

        // Verificar identificação (subject)
        const campoIdent  = rule.pipedrive_campo_identificacao || "";
        const valorIdent  = rule.pipedrive_valor_identificacao || "";
        if (campoIdent && valorIdent) {
          const actualVal = String(current[campoIdent] || "").trim();
          if (actualVal !== valorIdent) {
            console.log("[pipedriveWebhook] subject não bate:", actualVal, "!=", valorIdent);
            continue;
          }
        }

        // Data da ação
        const dateStr = extractDate(current[campoData] || current.marked_as_done_time || current.update_time);
        if (!dateStr) continue;

        // Buscar atividade no cronograma
        const activities = await base44.asServiceRole.entities.ScheduleActivity.filter({
          project_id: project.id,
          phase_name: base44Fase,
        });

        for (const act of activities) {
          if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;

          const patch = {};
          if (fazFim && !act.actual_end) {
            patch.actual_end = dateStr;
            if (!act.actual_start) patch.actual_start = dateStr;
            patch.status = "Concluído";
          }
          if (fazInicio && !act.actual_start) {
            patch.actual_start = dateStr;
          }

          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, patch });
            console.log("[pipedriveWebhook] atualizado:", act.activity_name, patch);
          }
        }
      }

      // ── REGRA DEAL (stage_change) ──────────────────────────────────────────
      if (entidade === "deal" && event.includes("deal")) {
        const currentStageId = String(current[campoKey] || "");
        const prevStageId    = String(previous[campoKey] || "");

        // Só processa se o stage realmente mudou
        if (currentStageId === prevStageId) continue;

        // valorDisp pode ser ID numérico ou texto descritivo como 'ID da etapa "Início de projeto"'
        // Mapa fixo: nome da etapa → ID (pipelines 16 e 10)
        const STAGE_NAME_TO_ID = {
          "inicio de projeto": "142",
          "início de projeto": "142",
          "alocar responsável": "140",
          "passagem de bastão": "141",
          "parametrizações": "143",
        };

        let targetStageId = valorDisp.trim();
        if (!/^\d+$/.test(targetStageId)) {
          const normalized = targetStageId.toLowerCase().replace(/[""""\u201c\u201d]/g, "").trim();
          // Extrai o nome da etapa de textos como: ID da etapa "Início de projeto"
          const matched = normalized.match(/(?:etapa\s+)?"?([^"]+)"?\s*$/);
          const key = matched ? matched[1].trim() : normalized;
          targetStageId = STAGE_NAME_TO_ID[key] || targetStageId;
        }

        if (currentStageId !== targetStageId) continue;

        // Data da ação
        const dateStr = extractDate(current[campoData] || current.update_time);
        if (!dateStr) continue;

        // Buscar atividades da fase
        const activities = await base44.asServiceRole.entities.ScheduleActivity.filter({
          project_id: project.id,
          phase_name: base44Fase,
        });

        for (const act of activities) {
          if (base44Atv !== "*" && act.activity_name !== base44Atv) continue;

          const patch = {};
          if (fazInicio && !act.actual_start) {
            patch.actual_start = dateStr;
          }
          if (fazFim && !act.actual_end) {
            patch.actual_end = dateStr;
          }

          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
            updatedActivities.push({ id: act.id, name: act.activity_name, patch });
            console.log("[pipedriveWebhook] atualizado:", act.activity_name, patch);
          }
        }
      }
    }

    return Response.json({
      ok: true,
      event,
      deal_id: dealId,
      project_id: project.id,
      updated: updatedActivities.length,
      activities: updatedActivities,
    });

  } catch (error) {
    console.error("[pipedriveWebhook] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});