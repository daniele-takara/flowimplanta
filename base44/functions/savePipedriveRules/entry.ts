import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";
const DADOS_GID = "432071218";
const CRONOGRAMA_GID = "1377224895";

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

    // 1. Ler as duas abas em paralelo
    const [dadosResult, cronogramaResult] = await Promise.all([
      loadSheetByGid(accessToken, DADOS_GID),
      loadSheetByGid(accessToken, CRONOGRAMA_GID),
    ]);

    // 2. Apagar TODAS as regras existentes
    const existing = await base44.asServiceRole.entities.PipedriveIntegrationRule.list();
    if (existing.length > 0) {
      await Promise.all(
        existing.map(r => base44.asServiceRole.entities.PipedriveIntegrationRule.delete(r.id))
      );
    }

    // 3. Converter e salvar regras de dados_iniciais
    const dadosRules = dadosResult.rows.map((row, i) => ({
      rule_type: "dados_iniciais",
      sheet_tab: dadosResult.sheetName,
      order: i + 1,
      raw_data: JSON.stringify(row),
      synced_at: syncedAt,
    }));

    // 4. Converter e salvar regras de cronograma
    const cronoRules = cronogramaResult.rows.map((row, i) => {
      const iniKey = Object.keys(row).find(k => /in.?cio/i.test(k)) || "início";
      const fazInicio = (row[iniKey] || "").toLowerCase() === "sim";
      const fazFim = (row["fim"] || "").toLowerCase() === "sim";

      return {
        rule_type: "cronograma",
        sheet_tab: cronogramaResult.sheetName,
        order: i + 1,
        raw_data: JSON.stringify(row),
        pipedrive_entidade: (row.pipedrive_entidade || "").toLowerCase().trim(),
        pipedrive_campo_key: (row.pipedrive_campo_key || "").trim(),
        pipedrive_valor_disparo: (row.pipedrive_valor_disparo || "").trim(),
        pipedrive_campo_identificacao: (row.pipedrive_campo_identificacao || "").trim(),
        pipedrive_valor_identificacao: (row.pipedrive_valor_identificacao || "").trim(),
        pipedrive_campo_data: (row.pipedrive_campo_data || "").trim(),
        base44_fase: (row.base44_fase || "").trim(),
        base44_atividade: (row.base44_atividade || "").trim(),
        faz_inicio: fazInicio,
        faz_fim: fazFim,
        synced_at: syncedAt,
      };
    });

    // 5. Salvar todas as novas regras em bulk
    const allRules = [...dadosRules, ...cronoRules];
    if (allRules.length > 0) {
      await base44.asServiceRole.entities.PipedriveIntegrationRule.bulkCreate(allRules);
    }

    return Response.json({
      ok: true,
      synced_at: syncedAt,
      dados_iniciais: {
        sheet_tab: dadosResult.sheetName,
        count: dadosRules.length,
      },
      cronograma: {
        sheet_tab: cronogramaResult.sheetName,
        count: cronoRules.length,
      },
      total: allRules.length,
      deleted: existing.length,
    });

  } catch (error) {
    console.error("[savePipedriveRules] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});