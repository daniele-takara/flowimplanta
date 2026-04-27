import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    const SHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";

    // Buscar metadados para descobrir nome da aba pelo gid
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];

    // Retornar lista de abas e primeiras 5 linhas de "Mais recente"
    const sheetNames = sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }));

    const targetSheet = sheets.find(s => s.properties.title === "Mais recente");
    if (!targetSheet) {
      return Response.json({ sheets: sheetNames, error: "Aba 'Mais recente' não encontrada" });
    }

    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("Mais recente")}?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];

    // Retornar header + primeiras 3 linhas de dados
    return Response.json({
      sheets: sheetNames,
      header: rows[0] || [],
      sample_rows: rows.slice(0, 6),
      total_rows: rows.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});