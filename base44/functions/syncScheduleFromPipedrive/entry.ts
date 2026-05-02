import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sync manual Pipedrive → Cronograma (chamado pelo frontend do ScheduleTab).
 * Implementa a mesma lógica de applyPipedriveRules mas autenticando como o usuário logado.
 * A lógica está centralizada aqui e em applyPipedriveRules — ambas usam o mesmo algoritmo.
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

const normalize = s => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/\s+/g, " ");

// Mapa canônico de atividades por fase (espelho do scheduleTasks.js)
// Usado pelo wildcard "*" para criar atividades faltantes no banco
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
 * syncScheduleFromPipedrive (manual via frontend) SEMPRE sobrescreve actual_start/actual_end.
 * isDateEmpty mantida apenas para criação de novas atividades.
 */
function isDateEmpty(val) {
  if (val == null) return true;
  const s = String(val).trim();
  return s === "" || s === "—" || s === "–";
}

async function fetchDeal(dealId, apiToken) {
  const res = await fetch(`${PIPE_V1}/deals/${dealId}?api_token=${apiToken}`);
  if (res.status === 429) throw new Error("Rate limit Pipedrive (429). Aguarde alguns minutos.");
  if (res.status === 401 || res.status === 403) throw new Error(`Acesso negado ao Pipedrive (${res.status}).`);
  const data = await res.json();
  return data.data || null;
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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id } = body;
    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 1. Carregar projeto por project_id, verificar unicidade do deal
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });

    // Verificar e logar duplicatas de pipedrive_deal_id
    if (project.pipedrive_deal_id) {
      const dealDuplicates = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: Number(project.pipedrive_deal_id) });
      if (dealDuplicates.length > 1) {
        console.warn(`[syncSchedule] ⚠️ DUPLICADO: ${dealDuplicates.length} projetos com pipedrive_deal_id=${project.pipedrive_deal_id}. IDs: ${dealDuplicates.map(p => p.id).join(", ")}`);
      }
    }

    const dealId = project.pipedrive_deal_id;
    if (!dealId) return Response.json({
      ok: false,
      error: 'Projeto sem pipedrive_deal_id. Configure nos Dados Iniciais.'
    }, { status: 400 });

    // 2. Carregar regras do banco
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const rules = allRules
      .filter(r => r.rule_type === "cronograma")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (rules.length === 0) {
      return Response.json({ ok: false, error: 'Nenhuma regra de cronograma. Execute "Atualizar regras da planilha".' }, { status: 400 });
    }

    // 3. Buscar Pipedrive
    const [deal, pipeActivities] = await Promise.all([
      fetchDeal(dealId, apiToken),
      fetchAllActivities(dealId, apiToken),
    ]);
    if (!deal) return Response.json({ ok: false, error: `Deal ${dealId} não encontrado` }, { status: 404 });

    // Comparação numérica — stage_id pode vir como número ou string
    const currentStageNum = deal.stage_id != null ? Number(deal.stage_id) : null;
    const doneActivities = pipeActivities.filter(a =>
      a.done === true || a.done === 1 || String(a.done).toLowerCase() === "true"
    );

    console.log(`[syncSchedule] Deal #${dealId} stage_id=${currentStageNum} | activities=${pipeActivities.length} done=${doneActivities.length}`);
    console.log(`[syncSchedule] Regras carregadas: ${rules.length} | ${rules.map(r => `[${r.order}] ${r.pipedrive_entidade}/${r.pipedrive_campo_key}=${r.pipedrive_valor_disparo} → ${r.base44_fase}/${r.base44_atividade}`).join(" | ")}`);

    // 4. Carregar cronograma
    const [scheduleActivities, schedulePhases] = await Promise.all([
      base44.asServiceRole.entities.ScheduleActivity.filter({ project_id }),
      base44.asServiceRole.entities.SchedulePhase.filter({ project_id }),
    ]);

    const phasesFromPhaseEntity = schedulePhases.map(p => p.phase_name).filter(Boolean);
    const phasesFromActivities = [...new Set(scheduleActivities.map(a => a.phase_name).filter(Boolean))];
    const allProjectPhases = [...new Set([...phasesFromPhaseEntity, ...phasesFromActivities])];

    if (allProjectPhases.length === 0) {
      return Response.json({ ok: false, error: "Nenhuma fase encontrada no projeto.", available_phases: [] }, { status: 400 });
    }
    console.log(`[syncSchedule] Fases do projeto: ${allProjectPhases.join(" | ")} | Atividades: ${scheduleActivities.length}`);

    const activitiesCache = [...scheduleActivities];

    function phaseExists(fase) {
      return allProjectPhases.some(p => normalize(p) === normalize(fase));
    }
    function getPhaseActivities(fase) {
      return activitiesCache.filter(a => normalize(a.phase_name) === normalize(fase));
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

      if (!base44Fase || (!fazInicio && !fazFim)) continue;

      if (!phaseExists(base44Fase)) {
        matchErrors.push(`Fase "${base44Fase}" não existe. Disponíveis: ${allProjectPhases.join(", ")}`);
        continue;
      }

      let phaseActs = getPhaseActivities(base44Fase);

      // ── REGRA DEAL (stage_id) ─────────────────────────────────────────────
      if (entidade === "deal" && campoKey === "stage_id") {
        // Comparação numérica — evita falhas por tipo (string "142" vs number 142)
        const ruleStageNum = Number(valorDisp);
        const stageMatch = currentStageNum !== null && currentStageNum === ruleStageNum;
        console.log(`[syncSchedule] [Regra #${rule.order}] deal/stage_id: recebido=${currentStageNum} esperado=${ruleStageNum} match=${stageMatch}`);
        if (!stageMatch) continue;

        const dateStr = extractDate(deal[campoData]) || extractDate(deal.update_time);
        if (!dateStr) { matchErrors.push(`Deal stage=${valorDisp}: sem data no campo "${campoData}"`); continue; }

        // Wildcard "*": garantir que TODAS as atividades canônicas da fase existam no banco
        if (base44Atv === "*") {
          const canonicalNames = CANONICAL_ACTIVITIES_BY_PHASE[base44Fase] || [];
          console.log(`[syncSchedule] [Regra #${rule.order}] wildcard "*" → fase="${base44Fase}" | canônicas=${canonicalNames.length} | existentes no banco=${phaseActs.length}`);
          for (let i = 0; i < canonicalNames.length; i++) {
            const cName = canonicalNames[i];
            const alreadyExists = phaseActs.find(a => normalize(a.activity_name) === normalize(cName));
            if (!alreadyExists) {
              console.log(`[syncSchedule]   CRIANDO atividade faltante: "${cName}"`);
              const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
                project_id, phase_name: base44Fase, activity_name: cName,
                status: "Não iniciado", order: i + 1,
              });
              activitiesCache.push(newAct);
              phaseActs = getPhaseActivities(base44Fase); // recarrega após criação
            }
          }
        }

        if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
          const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
            project_id, phase_name: base44Fase, activity_name: base44Atv,
            status: fazFim ? "Concluído" : "Em andamento",
            actual_start: fazInicio || fazFim ? dateStr : null,
            actual_end: fazFim ? dateStr : null, order: 1,
          });
          activitiesCache.push(newAct);
          createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, patch: { actual_start: dateStr }, trigger: `stage_id=${valorDisp}` });
          rulesApplied++;
          continue;
        }

        // Pipedrive é fonte de verdade: SEMPRE sobrescreve actual_start e actual_end
        for (const act of phaseActs) {
          if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
          const patch = {};
          if (fazInicio) {
            console.log(`[syncSchedule]   atividade="${act.activity_name}" actual_start: "${act.actual_start}" → "${dateStr}" (sobrescrita Pipedrive)`);
            patch.actual_start = dateStr;
          }
          if (fazFim) {
            console.log(`[syncSchedule]   atividade="${act.activity_name}" actual_end: "${act.actual_end}" → "${dateStr}" (sobrescrita Pipedrive)`);
            patch.actual_end = dateStr;
            patch.status = "Concluído";
          }
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

        for (const pAct of pipeActivities) {
          const isDone = pAct.done === true || pAct.done === 1 || String(pAct.done).toLowerCase() === "true";
          if (!isDone) continue;
          if (campoIdent && valorIdent && String(pAct[campoIdent] || "").trim() !== valorIdent) continue;

          const dateStr = extractDate(pAct.marked_as_done_time) || extractDate(pAct.update_time)
            || extractDate(pAct.due_date) || new Date().toISOString().substring(0, 10);

          if (phaseActs.length === 0 && base44Atv && base44Atv !== "*") {
            const newAct = await base44.asServiceRole.entities.ScheduleActivity.create({
              project_id, phase_name: base44Fase, activity_name: base44Atv,
              status: fazFim ? "Concluído" : "Em andamento",
              actual_start: fazInicio || fazFim ? dateStr : null,
              actual_end: fazFim ? dateStr : null, order: 1,
            });
            activitiesCache.push(newAct);
            createdActivities.push({ id: newAct.id, name: base44Atv, phase: base44Fase, patch: { actual_end: dateStr }, trigger: `activity done` });
            rulesApplied++;
            break;
          }

          // Pipedrive é fonte de verdade: SEMPRE sobrescreve actual_start e actual_end
          for (const act of phaseActs) {
            if (base44Atv && base44Atv !== "*" && normalize(act.activity_name) !== normalize(base44Atv)) continue;
            const patch = {};
            if (fazFim) {
              console.log(`[syncSchedule]   atividade="${act.activity_name}" actual_end: "${act.actual_end}" → "${dateStr}" (sobrescrita Pipedrive)`);
              patch.actual_end = dateStr;
              patch.status = "Concluído";
            }
            if (fazInicio) {
              console.log(`[syncSchedule]   atividade="${act.activity_name}" actual_start: "${act.actual_start}" → "${dateStr}" (sobrescrita Pipedrive)`);
              patch.actual_start = dateStr;
            }
            if (Object.keys(patch).length > 0) {
              await base44.asServiceRole.entities.ScheduleActivity.update(act.id, patch);
              Object.assign(act, patch);
              updatedActivities.push({ id: act.id, name: act.activity_name, phase: base44Fase, patch, trigger: `activity done` });
              rulesApplied++;
            }
          }
        }
      }
    }

    // 5. Gravar IntegrationLog
    const logStatus = updatedActivities.length + createdActivities.length > 0 ? "success"
      : matchErrors.length > 0 ? "partial_success"
      : "ignored";

    try {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration_type: "pipedrive_cronograma",
        source: "manual_sync",
        action: "apply_rules",
        status: logStatus,
        deal_id: Number(dealId),
        project_id,
        project_name: project.name,
        event_type: "manual_sync",
        rules_loaded: rules.length,
        rules_matched: rulesApplied,
        phases_found: allProjectPhases.length,
        activities_found: scheduleActivities.length,
        activities_created: createdActivities.length,
        activities_updated: updatedActivities.length,
        dates_filled: updatedActivities.length + createdActivities.length,
        dates_ignored: 0,
        match_errors: JSON.stringify(matchErrors),
        errors: JSON.stringify([]),
        request_payload: JSON.stringify({ project_id, deal_id: dealId }).substring(0, 1000),
        response_payload: JSON.stringify({ updated: updatedActivities, created: createdActivities }).substring(0, 4000),
        debug_steps: JSON.stringify({ available_phases: allProjectPhases, deal_stage_id: currentStageNum }).substring(0, 4000),
        duration_ms: Date.now() - startTime,
      });
    } catch (logErr) {
      console.warn("[syncSchedule] Erro ao gravar IntegrationLog:", logErr.message);
    }

    return Response.json({
      ok: true,
      deal_id: dealId,
      project_id,
      deal_stage_id: currentStageNum,
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
    });

  } catch (error) {
    console.error("[syncScheduleFromPipedrive] erro:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});