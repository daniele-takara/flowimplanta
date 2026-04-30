import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Valida toda a configuração da integração Pipedrive.
 * Payload: { deal_id?: number, project_id?: string }
 * Retorna checklist com status ok/warning/error para cada item.
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";
const WEBHOOK_URL = `https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/pipedriveWebhook`;

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

function check(id, label, status, detail, suggestion = null) {
  return { id, label, status, detail, suggestion };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { deal_id, project_id } = body;

  const checks = [];

  // ── CHECK 1: API Token ────────────────────────────────────────────────────
  const apiToken = Deno.env.get("API_PIpedrive");
  if (apiToken) {
    checks.push(check("api_token", "API Token Pipedrive configurado", "ok",
      "Variável API_PIpedrive encontrada no ambiente."));
  } else {
    checks.push(check("api_token", "API Token Pipedrive configurado", "error",
      "Variável de ambiente API_PIpedrive não está configurada.",
      "Acesse Configurações > Variáveis de ambiente e adicione API_PIpedrive com o token do Pipedrive."));
  }

  // ── CHECK 2: URL do webhook ───────────────────────────────────────────────
  checks.push(check("webhook_url", "URL do webhook exibida corretamente", "ok",
    `URL: ${WEBHOOK_URL}`,
    "Configure esta URL nos webhooks do Pipedrive (3 webhooks: change.deal, change.activity, create.activity)."));

  // ── CHECK 3: Regras cadastradas ───────────────────────────────────────────
  let allRules = [];
  let cronogramaRules = [];
  try {
    allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    cronogramaRules = allRules.filter(r => r.rule_type === "cronograma");
    const dadosRules = allRules.filter(r => r.rule_type === "dados_iniciais");

    if (allRules.length === 0) {
      checks.push(check("rules_exist", "Regras PipedriveIntegrationRule cadastradas", "error",
        "Nenhuma regra encontrada no banco.",
        "Acesse Parametrizações > Integração Pipedrive e clique em 'Atualizar regras da planilha'."));
    } else {
      checks.push(check("rules_exist", "Regras PipedriveIntegrationRule cadastradas", "ok",
        `${allRules.length} regras no total (${cronogramaRules.length} cronograma, ${dadosRules.length} dados iniciais).`));
    }

    if (cronogramaRules.length === 0) {
      checks.push(check("cronograma_rules", "Regras de cronograma existentes", "error",
        "Nenhuma regra do tipo 'cronograma' encontrada.",
        "Verifique a aba 'Cronograma' da planilha de configuração e resincronize."));
    } else {
      const stageIds = [...new Set(cronogramaRules.filter(r => r.pipedrive_entidade === "deal").map(r => r.pipedrive_valor_disparo))];
      checks.push(check("cronograma_rules", "Regras de cronograma existentes", "ok",
        `${cronogramaRules.length} regras de cronograma. Stage IDs configurados: ${stageIds.join(", ") || "nenhum"}.`));
    }
  } catch (e) {
    checks.push(check("rules_exist", "Regras PipedriveIntegrationRule cadastradas", "error",
      `Erro ao carregar regras: ${e.message}`));
  }

  // ── CHECK 4: Projetos com deal_id ─────────────────────────────────────────
  try {
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const withDealId = allProjects.filter(p => p.pipedrive_deal_id);
    const withoutDealId = allProjects.filter(p => !p.pipedrive_deal_id);

    if (withDealId.length === 0) {
      checks.push(check("projects_with_deal_id", "Projetos com pipedrive_deal_id preenchido", "warning",
        "Nenhum projeto tem pipedrive_deal_id configurado. O webhook não conseguirá vincular eventos.",
        "Ao criar ou importar um projeto, vincule-o ao deal Pipedrive pelo ID."));
    } else {
      checks.push(check("projects_with_deal_id", "Projetos com pipedrive_deal_id preenchido", "ok",
        `${withDealId.length} projetos vinculados ao Pipedrive. ${withoutDealId.length} sem vínculo.`));
    }

    // ── CHECK 5: deal_id específico no Pipedrive ──────────────────────────
    if (deal_id && apiToken) {
      try {
        const res = await fetch(`${PIPE_V1}/deals/${deal_id}?api_token=${apiToken}`);
        if (res.status === 200) {
          const data = await res.json();
          const deal = data.data;
          checks.push(check("deal_in_pipedrive", `Deal #${deal_id} existe no Pipedrive`, "ok",
            `Deal encontrado: "${deal?.title}" | Stage ID: ${deal?.stage_id} | Pipeline: ${deal?.pipeline_id}`));

          // ── CHECK 6: deal_id no Flowimplanta ─────────────────────────────
          const matchProjects = allProjects.filter(p => Number(p.pipedrive_deal_id) === Number(deal_id));
          if (matchProjects.length > 0) {
            checks.push(check("deal_in_flowimplanta", `Deal #${deal_id} vinculado a projeto Flowimplanta`, "ok",
              `Projeto encontrado: "${matchProjects[0].name}" (ID: ${matchProjects[0].id})`));

            // ── CHECK 7: stage_id tem regra correspondente ────────────────
            const currentStageId = String(deal?.stage_id ?? "");
            const stageRules = cronogramaRules.filter(r =>
              r.pipedrive_entidade === "deal" && String(r.pipedrive_valor_disparo) === currentStageId
            );
            if (stageRules.length > 0) {
              checks.push(check("stage_has_rule", `Stage ID ${currentStageId} tem regra correspondente`, "ok",
                `${stageRules.length} regra(s) para stage_id=${currentStageId}. Fases: ${stageRules.map(r => r.base44_fase).join(", ")}`));
            } else {
              checks.push(check("stage_has_rule", `Stage ID ${currentStageId} tem regra correspondente`, "warning",
                `Stage ID atual (${currentStageId}) não possui regra de cronograma configurada.`,
                `Verifique a planilha de configuração se o stage_id ${currentStageId} deveria acionar alguma regra.`));
            }

            // ── CHECK 8: Fases das regras existem no projeto ──────────────
            const proj = matchProjects[0];
            const phases = await base44.asServiceRole.entities.SchedulePhase.filter({ project_id: proj.id });
            const phaseNames = phases.map(p => p.phase_name);
            const activities = await base44.asServiceRole.entities.ScheduleActivity.filter({ project_id: proj.id });

            const rulePhases = [...new Set(cronogramaRules.map(r => r.base44_fase).filter(Boolean))];
            const missingPhases = rulePhases.filter(rp => !phaseNames.some(pp => normalize(pp) === normalize(rp)));
            const presentPhases = rulePhases.filter(rp => phaseNames.some(pp => normalize(pp) === normalize(rp)));

            if (missingPhases.length > 0) {
              checks.push(check("phases_exist", "Fases das regras existem no projeto", "warning",
                `Fases das regras NÃO encontradas no cronograma: ${missingPhases.join(", ")}`,
                "Estas fases estão nas regras mas não existem em SchedulePhase para este projeto. Verifique se o cronograma foi criado."));
            } else {
              checks.push(check("phases_exist", "Fases das regras existem no projeto", "ok",
                `Todas as ${presentPhases.length} fases das regras foram encontradas no cronograma.`));
            }

            // ── CHECK 9: Atividades das regras ────────────────────────────
            const ruleActivities = cronogramaRules
              .filter(r => r.base44_atividade && r.base44_atividade !== "*")
              .map(r => ({ fase: r.base44_fase, atividade: r.base44_atividade }));

            const missingActivities = [];
            const presentActivities = [];

            for (const ra of ruleActivities) {
              const exists = activities.some(a =>
                normalize(a.phase_name) === normalize(ra.fase) &&
                normalize(a.activity_name) === normalize(ra.atividade)
              );
              if (exists) presentActivities.push(ra);
              else missingActivities.push(ra);
            }

            if (missingActivities.length > 0) {
              checks.push(check("activities_exist", "Atividades das regras existem no cronograma", "warning",
                `${missingActivities.length} atividade(s) não encontradas. Exemplos: ${missingActivities.slice(0, 3).map(a => `"${a.atividade}" (${a.fase})`).join(", ")}`,
                "O sistema criará automaticamente atividades faltantes quando a regra der match. Verifique se isso é o comportamento esperado."));
            } else if (ruleActivities.length > 0) {
              checks.push(check("activities_exist", "Atividades das regras existem no cronograma", "ok",
                `${presentActivities.length} atividade(s) das regras encontradas no cronograma.`));
            } else {
              checks.push(check("activities_exist", "Atividades das regras (regras com '*')", "ok",
                "Todas as regras usam wildcard (*) — aplicam a todas as atividades da fase."));
            }

          } else {
            checks.push(check("deal_in_flowimplanta", `Deal #${deal_id} vinculado a projeto Flowimplanta`, "error",
              `Nenhum projeto com pipedrive_deal_id=${deal_id} encontrado.`,
              "Crie um projeto vinculado a este deal ou atualize o campo pipedrive_deal_id do projeto existente."));
          }
        } else if (res.status === 404) {
          checks.push(check("deal_in_pipedrive", `Deal #${deal_id} existe no Pipedrive`, "error",
            `Deal ${deal_id} não encontrado no Pipedrive (404).`,
            "Verifique se o ID do deal está correto no Pipedrive."));
        } else {
          checks.push(check("deal_in_pipedrive", `Deal #${deal_id} existe no Pipedrive`, "error",
            `Pipedrive retornou status ${res.status}`,
            "Verifique o API token do Pipedrive."));
        }
      } catch (e) {
        checks.push(check("deal_in_pipedrive", `Deal #${deal_id} no Pipedrive`, "error", `Erro: ${e.message}`));
      }
    }

  } catch (e) {
    checks.push(check("projects_with_deal_id", "Projetos com pipedrive_deal_id", "error", `Erro: ${e.message}`));
  }

  // ── CHECK 10: Logs recentes ───────────────────────────────────────────────
  try {
    const recentLogs = await base44.asServiceRole.entities.IntegrationLog.list("-created_date", 10);
    const webhookLogs = recentLogs.filter(l => l.source === "webhook");
    const errorLogs = recentLogs.filter(l => l.status === "error");

    if (recentLogs.length === 0) {
      checks.push(check("recent_logs", "Logs de integração recentes", "warning",
        "Nenhum log de integração encontrado. O webhook pode não ter sido disparado ainda.",
        "Configure os webhooks no Pipedrive e faça uma alteração em um deal para testar."));
    } else {
      const lastLog = recentLogs[0];
      checks.push(check("recent_logs", "Logs de integração recentes", errorLogs.length > 0 ? "warning" : "ok",
        `${recentLogs.length} logs recentes. ${webhookLogs.length} via webhook. ${errorLogs.length} com erro. Último: ${new Date(lastLog.created_date).toLocaleString("pt-BR")}`));
    }
  } catch (e) {
    // IntegrationLog pode não existir ainda
    checks.push(check("recent_logs", "Logs de integração recentes", "warning",
      "Não foi possível carregar logs: " + e.message));
  }

  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.status === "ok").length,
    warning: checks.filter(c => c.status === "warning").length,
    error: checks.filter(c => c.status === "error").length,
  };

  return Response.json({ checks, summary, deal_id, project_id, webhook_url: WEBHOOK_URL });
});