import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Lê o campo customizado do Pipedrive:
 *   deal["77e52d481be474c3eb61ad1aea1784b9948828f7"]
 *
 * Formato do texto:
 *   Próxima Agenda: ...
 *   Pendência cliente: ...
 *   Pendência Pontotel: ...
 *   Risco: ...
 *
 * Aplica nos campos JÁ EXISTENTES do StatusReport:
 *   next_agenda         ← Próxima Agenda
 *   client_pending      ← Pendência cliente  (array [{item, deadline, responsible}])
 *   internal_pending    ← Pendência Pontotel (array [{item, deadline, responsible}])
 *   (Risco → ignorado)
 */

const STATUS_REPORT_FIELD_KEY = "77e52d481be474c3eb61ad1aea1784b9948828f7";

// Normaliza: N/A, vazio, null → null; remove trailing ponto-e-vírgula
function normalizeText(val) {
  if (!val) return null;
  const s = String(val).trim().replace(/[;,]+$/, "").trim();
  if (!s || /^n\/?a$/i.test(s)) return null;
  return s;
}

// Parser: extrai o valor após "Label:" do bloco de texto
function parseTextBlock(text) {
  const result = {
    proxima_agenda: null,
    pendencia_cliente: null,
    pendencia_pontotel: null,
  };

  if (!text) return result;

  // Quebra por linhas e reconstrói os blocos por label
  const lines = text.split(/\r?\n/);
  const labelMap = {
    "proxima agenda": "proxima_agenda",
    "pendencia cliente": "pendencia_cliente",
    "pendencia pontotel": "pendencia_pontotel",
    // risco / riscos → ignorado (mapeados para null abaixo)
    "risco": "__ignore__",
    "riscos": "__ignore__",
  };

  let currentKey = null;
  const buffer = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const possibleLabel = line.substring(0, colonIdx).trim().toLowerCase()
        .normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const matchedKey = Object.keys(labelMap).find(k =>
        k.normalize("NFD").replace(/\p{Diacritic}/gu, "") === possibleLabel
      );
      if (matchedKey) {
        currentKey = labelMap[matchedKey]; // pode ser "__ignore__"
        const val = line.substring(colonIdx + 1).trim();
        if (currentKey !== "__ignore__") {
          buffer[currentKey] = val ? [val] : [];
        }
        continue;
      }
    }
    // linha de continuação (sem label) — só acumula se currentKey válido
    if (currentKey && currentKey !== "__ignore__" && line.trim()) {
      if (!buffer[currentKey]) buffer[currentKey] = [];
      buffer[currentKey].push(line.trim());
    }
  }

  // Montar resultado
  for (const [key] of Object.entries(result)) {
    const lines = buffer[key] || [];
    const joined = lines.join(" ").trim();
    result[key] = normalizeText(joined);
  }

  return result;
}

// Converte texto de pendência em array de items para o StatusReport
function textToPendingArray(text) {
  if (!text) return [];
  // Separa por quebras de linha ou ponto-e-vírgula
  const parts = text.split(/[;\n]/).map(s => s.trim().replace(/[;,]+$/, "").trim()).filter(Boolean);
  // Filtra items que são só N/A
  return parts
    .filter(s => !/^n\/?a$/i.test(s))
    .map(item => ({ item, deadline: "", responsible: "" }));
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    // Auth obrigatória + checagem de permissão (sync de status ou dados — este endpoint
    // é invocado tanto pelo fluxo de status quanto internamente pelo sync de dados)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, deal_id, dry_run = false } = body;

    if (!project_id) return Response.json({ error: 'project_id obrigatório' }, { status: 400 });

    const isSystemAdmin = user.role === 'admin';
    let canDo = isSystemAdmin;
    if (!isSystemAdmin && user.permission_profile_id) {
      try {
        const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({ id: user.permission_profile_id });
        const p = profiles?.[0]?.permissions || {};
        if (p.integracao_sync_pipedrive_status === true || p.integracao_sync_pipedrive_dados === true) canDo = true;
      } catch { canDo = false; }
    }
    if (!canDo) return Response.json({ error: 'Sem permissão para sincronizar status report' }, { status: 403 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // 1. Carregar regras de status_report do banco
    const allRules = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    const srRules = allRules.filter(r => r.rule_type === "status_report");
    console.log(`[applyStatusReport] Regras status_report carregadas: ${srRules.length}`);

    // 2. Buscar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: `Projeto ${project_id} não encontrado` }, { status: 404 });

    const actualDealId = deal_id || project.pipedrive_deal_id;
    if (!actualDealId) return Response.json({ error: 'Projeto sem pipedrive_deal_id' }, { status: 400 });

    // 3. Buscar deal no Pipedrive
    const dealRes = await fetch(`https://api.pipedrive.com/v1/deals/${actualDealId}?api_token=${apiToken}`);
    if (!dealRes.ok) return Response.json({ error: `Deal ${actualDealId} não encontrado (${dealRes.status})` }, { status: 404 });
    const dealJson = await dealRes.json();
    const deal = dealJson.data;
    if (!deal) return Response.json({ error: 'Deal vazio no Pipedrive' }, { status: 404 });

    // 4. Ler o campo customizado
    const rawField = deal[STATUS_REPORT_FIELD_KEY];
    console.log(`[applyStatusReport] Campo customizado bruto: "${rawField}"`);

    // 5. Fazer parser do texto
    const parsed = parseTextBlock(rawField);
    console.log(`[applyStatusReport] Valores extraídos: ${JSON.stringify(parsed)}`);

    // 6. Montar patch para StatusReport
    const patch = {};

    // Próxima Agenda → next_agenda (string)
    if (parsed.proxima_agenda !== null) {
      patch.next_agenda = parsed.proxima_agenda;
      console.log(`[applyStatusReport] next_agenda ← "${parsed.proxima_agenda}"`);
    }

    // Pendência cliente → client_pending (array)
    if (parsed.pendencia_cliente !== null) {
      patch.client_pending = textToPendingArray(parsed.pendencia_cliente);
      console.log(`[applyStatusReport] client_pending ← ${JSON.stringify(patch.client_pending)}`);
    }

    // Pendência Pontotel → internal_pending (array)
    if (parsed.pendencia_pontotel !== null) {
      patch.internal_pending = textToPendingArray(parsed.pendencia_pontotel);
      console.log(`[applyStatusReport] internal_pending ← ${JSON.stringify(patch.internal_pending)}`);
    }

    console.log(`[applyStatusReport] Patch final: ${JSON.stringify(patch)}`);

    if (Object.keys(patch).length === 0) {
      console.log(`[applyStatusReport] Nenhum campo para atualizar (campo vazio ou todos N/A)`);
      return Response.json({
        ok: true,
        project_id,
        deal_id: actualDealId,
        parsed,
        patch: {},
        fields_updated: 0,
        message: "Campo customizado vazio ou todos os valores são N/A — nenhum campo atualizado.",
        duration_ms: Date.now() - startTime,
      });
    }

    // 7. Buscar StatusReport existente do projeto
    const reports = await base44.asServiceRole.entities.StatusReport.filter({ project_id });
    const report = reports[0] || null;

    let savedReport = null;
    if (!dry_run) {
      if (report?.id) {
        await base44.asServiceRole.entities.StatusReport.update(report.id, patch);
        savedReport = { ...report, ...patch };
        console.log(`[applyStatusReport] StatusReport ${report.id} atualizado`);
      } else {
        savedReport = await base44.asServiceRole.entities.StatusReport.create({
          project_id,
          report_date: new Date().toISOString().split("T")[0],
          ...patch,
        });
        console.log(`[applyStatusReport] StatusReport criado: ${savedReport.id}`);
      }
    }

    return Response.json({
      ok: true,
      project_id,
      deal_id: actualDealId,
      raw_field: rawField || null,
      parsed,
      patch,
      fields_updated: Object.keys(patch).length,
      report_id: savedReport?.id || report?.id || null,
      dry_run,
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error("[applyStatusReport] ERRO:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});