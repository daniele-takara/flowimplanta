import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sincronização INCREMENTAL de regras Pipedrive da planilha Google Sheets.
 * 
 * Diferente de savePipedriveRules (que apaga e recria tudo),
 * esta função compara regra por regra e apenas CRIA as novas.
 * 
 * Chave única de deduplicação:
 * pipedrive_entidade + pipedrive_campo_key + pipedrive_valor_disparo + base44_fase + base44_atividade
 */

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const DADOS_GID = "432071218";
const CRONOGRAMA_GID = "1377224895";

function makeRuleKey(entidade, campoKey, valorDisparo, fase, atividade) {
  return [
    (entidade || "").toLowerCase().trim(),
    (campoKey || "").trim(),
    (valorDisparo || "").trim(),
    (fase || "").trim(),
    (atividade || "").trim(),
  ].join("|");
}

async function loadSheetByGid(accessToken, gid) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const sheetMeta = meta.sheets?.find(s => String(s.properties.sheetId) === String(gid));
  if (!sheetMeta) throw new Error(`Aba GID ${gid} não encontrada`);
  const sheetName = sheetMeta.properties.title;

  const dataRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await dataRes.json();
  const rawRows = data.values || [];
  if (rawRows.length < 2) return { sheetName, rows: [] };

  const headers = rawRows[0].map(h => h.trim().toLowerCase());
  const rows = rawRows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
    return obj;
  });
  return { sheetName, rows };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const syncedAt = new Date().toISOString();

    // 1. Ler planilha e regras existentes em paralelo
    const [dadosResult, cronogramaResult, existingRules] = await Promise.all([
      loadSheetByGid(accessToken, DADOS_GID),
      loadSheetByGid(accessToken, CRONOGRAMA_GID),
      base44.asServiceRole.entities.PipedriveIntegrationRule.list(),
    ]);

    console.log(`[mergePipedriveRules] Regras existentes no banco: ${existingRules.length}`);
    console.log(`[mergePipedriveRules] Linhas na planilha cronograma: ${cronogramaResult.rows.length}`);
    console.log(`[mergePipedriveRules] Linhas na planilha dados_iniciais: ${dadosResult.rows.length}`);

    // 2. Construir set de chaves existentes (cronograma)
    const existingCronoKeys = new Set(
      existingRules
        .filter(r => r.rule_type === "cronograma")
        .map(r => makeRuleKey(
          r.pipedrive_entidade,
          r.pipedrive_campo_key,
          r.pipedrive_valor_disparo,
          r.base44_fase,
          r.base44_atividade,
        ))
    );

    // 3. Construir set de chaves existentes (dados_iniciais) — por order
    const existingDadosOrders = new Set(
      existingRules
        .filter(r => r.rule_type === "dados_iniciais")
        .map(r => r.order)
    );

    console.log(`[mergePipedriveRules] Chaves cronograma existentes: ${existingCronoKeys.size}`);
    console.log(`[mergePipedriveRules] Ordens dados_iniciais existentes: ${existingDadosOrders.size}`);

    // 4. Processar regras de CRONOGRAMA — apenas novas
    const cronogramaIgnored = [];
    const cronogramaToCreate = [];

    const existingOrders = existingRules.map(r => r.order || 0).filter(n => n > 0);
    let nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;

    cronogramaResult.rows.forEach((row, i) => {
      const entidade = (row.pipedrive_entidade || "").toLowerCase().trim();
      const campoKey = (row.pipedrive_campo_key || "").trim();
      const valorDisparo = (row.pipedrive_valor_disparo || "").trim();
      const fase = (row.base44_fase || "").trim();
      const atividade = (row.base44_atividade || "").trim();

      if (!fase && !atividade) return; // linha vazia / header

      const key = makeRuleKey(entidade, campoKey, valorDisparo, fase, atividade);

      if (existingCronoKeys.has(key)) {
        cronogramaIgnored.push({ row: i + 2, key, reason: "já existe" });
        console.log(`[mergePipedriveRules] IGNORADO cronograma row=${i + 2} key="${key}"`);
        return;
      }

      const iniKey = Object.keys(row).find(k => /in.?cio/i.test(k)) || "início";
      const fazInicio = (row[iniKey] || "").toLowerCase() === "sim";
      const fazFim = (row["fim"] || "").toLowerCase() === "sim";

      const rule = {
        rule_type: "cronograma",
        sheet_tab: cronogramaResult.sheetName,
        order: nextOrder++,
        raw_data: JSON.stringify(row),
        pipedrive_entidade: entidade,
        pipedrive_campo_key: campoKey,
        pipedrive_valor_disparo: valorDisparo,
        pipedrive_campo_identificacao: (row.pipedrive_campo_identificacao || "").trim(),
        pipedrive_valor_identificacao: (row.pipedrive_valor_identificacao || "").trim(),
        pipedrive_campo_data: (row.pipedrive_campo_data || "").trim(),
        base44_fase: fase,
        base44_atividade: atividade,
        faz_inicio: fazInicio,
        faz_fim: fazFim,
        synced_at: syncedAt,
      };

      cronogramaToCreate.push(rule);
      console.log(`[mergePipedriveRules] NOVA cronograma row=${i + 2} key="${key}" faz_inicio=${fazInicio} faz_fim=${fazFim}`);
    });

    // 5. Processar regras de DADOS_INICIAIS — apenas linhas com order novo
    const dadosIgnored = [];
    const dadosToCreate = [];

    dadosResult.rows.forEach((row, i) => {
      const order = i + 1;
      if (existingDadosOrders.has(order)) {
        dadosIgnored.push({ row: i + 2, order, reason: "já existe" });
        return;
      }
      dadosToCreate.push({
        rule_type: "dados_iniciais",
        sheet_tab: dadosResult.sheetName,
        order,
        raw_data: JSON.stringify(row),
        synced_at: syncedAt,
      });
      console.log(`[mergePipedriveRules] NOVA dados_iniciais row=${i + 2} order=${order}`);
    });

    // 6. Criar apenas as novas regras
    const allToCreate = [...dadosToCreate, ...cronogramaToCreate];
    if (allToCreate.length > 0) {
      await base44.asServiceRole.entities.PipedriveIntegrationRule.bulkCreate(allToCreate);
    }

    const totalAfter = existingRules.length + allToCreate.length;

    console.log(`[mergePipedriveRules] RESULTADO: criadas=${allToCreate.length} ignoradas=${cronogramaIgnored.length + dadosIgnored.length} total_após=${totalAfter}`);

    return Response.json({
      ok: true,
      synced_at: syncedAt,
      cronograma: {
        sheet_tab: cronogramaResult.sheetName,
        sheet_rows: cronogramaResult.rows.length,
        created: cronogramaToCreate.length,
        ignored: cronogramaIgnored.length,
        created_keys: cronogramaToCreate.map(r => makeRuleKey(r.pipedrive_entidade, r.pipedrive_campo_key, r.pipedrive_valor_disparo, r.base44_fase, r.base44_atividade)),
        ignored_keys: cronogramaIgnored.map(r => r.key),
      },
      dados_iniciais: {
        sheet_tab: dadosResult.sheetName,
        sheet_rows: dadosResult.rows.length,
        created: dadosToCreate.length,
        ignored: dadosIgnored.length,
      },
      total_created: allToCreate.length,
      total_before: existingRules.length,
      total_after: totalAfter,
    });

  } catch (error) {
    console.error("[mergePipedriveRules] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});