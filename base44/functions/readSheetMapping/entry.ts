import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SHEET_ID = "1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { gid } = body;
    if (!gid) return Response.json({ error: 'gid obrigatório' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // 1. Descobrir nome da aba pelo GID
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const sheetMeta = meta.sheets?.find(s => String(s.properties.sheetId) === String(gid));
    if (!sheetMeta) {
      return Response.json({ error: `Aba GID ${gid} não encontrada` }, { status: 404 });
    }
    const sheetName = sheetMeta.properties.title;

    // 2. Ler valores
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rawRows = data.values || [];

    if (rawRows.length < 2) {
      return Response.json({ sheet_name: sheetName, rows: [], total: 0 });
    }

    const headers = rawRows[0].map(h => h.trim().toLowerCase());
    const rows = rawRows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || "").trim(); });
      return obj;
    });

    return Response.json({ sheet_name: sheetName, rows, total: rows.length });

  } catch (error) {
    console.error("[readSheetMapping] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});