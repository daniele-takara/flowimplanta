import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SPREADSHEET_ID = '1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8';
const SHEET_RANGE = 'dados!A1:M1851';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, client_name } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    // Get Google Sheets access token from shared connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Fetch spreadsheet data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}`;
    const sheetsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!sheetsRes.ok) {
      const err = await sheetsRes.text();
      return Response.json({ error: `Sheets API error: ${err}` }, { status: 502 });
    }

    const sheetsData = await sheetsRes.json();
    const rows = sheetsData.values || [];
    if (rows.length < 2) return Response.json({ data: null, message: 'Planilha vazia' });

    // Parse header + rows
    const headers = rows[0].map(h => h.toString().trim().toLowerCase()
      .replace(/\s+/g, '_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    
    const dataRows = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });

    // Try to match by client_name (fuzzy) or return first row if no match
    let matched = null;
    if (client_name) {
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cn = norm(client_name);
      matched = dataRows.find(r => {
        const nome = norm(r.nome || r.empresa || r.name || '');
        return nome.includes(cn) || cn.includes(nome);
      });
    }
    // fallback: first data row
    if (!matched && dataRows.length > 0) matched = dataRows[0];

    if (!matched) return Response.json({ data: null, message: 'Nenhum dado encontrado' });

    // Normalize field names to expected schema
    const normalize = (row) => ({
      empresa_id: row.empresa_id || row.id || '',
      nome: row.nome || row.empresa || row.name || '',
      data_criacao: row.data_criacao || row.created_at || '',
      numero_funcionarios: Number(row.numero_funcionarios || row.funcionarios || 0),
      numero_funcionarios_ativos: Number(row.numero_funcionarios_ativos || row.funcionarios_ativos || 0),
      numero_regras_de_calculo: Number(row.numero_regras_de_calculo || row.regras_de_calculo || 0),
      email_ultimo_acesso: row.email_ultimo_acesso || row.ultimo_acesso_email || '',
      data_ultimo_acesso: row.data_ultimo_acesso || row.ultimo_acesso || '',
      empregados_batendo_ponto_ultimos_15_dias: Number(row.empregados_batendo_ponto_ultimos_15_dias || row.batendo_ponto_15_dias || 0),
      data_exportacao: row.data_exportacao || row.exportacao || ''
    });

    const usabilityData = normalize(matched);

    // Upsert in ClientUsability entity
    const existing = await base44.asServiceRole.entities.ClientUsability.filter({ project_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ClientUsability.update(existing[0].id, {
        ...usabilityData,
        project_id,
        last_synced_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.ClientUsability.create({
        ...usabilityData,
        project_id,
        last_synced_at: new Date().toISOString()
      });
    }

    return Response.json({ data: usabilityData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});