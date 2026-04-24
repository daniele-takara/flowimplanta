import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Planilha de usabilidade diária
const SPREADSHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
const SHEET_NAME = "Dados"; // aba principal — ajustar se necessário

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { empresa_id, client_name } = body;

    // Buscar access token do conector compartilhado Google Sheets
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // Buscar todas as abas disponíveis primeiro
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];
    const sheetNames = sheets.map(s => s.properties.title);

    // Tentar ler a primeira aba se "Dados" não existir
    const targetSheet = sheetNames.includes(SHEET_NAME) ? SHEET_NAME : sheetNames[0];
    if (!targetSheet) {
      return Response.json({ error: "Nenhuma aba encontrada na planilha" }, { status: 404 });
    }

    // Buscar os dados da aba
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return Response.json({ found: false, message: "Planilha vazia ou sem dados" });
    }

    // Primeira linha = cabeçalhos
    const headers = rows[0].map(h => String(h).trim().toLowerCase()
      .replace(/\s+/g, "_")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );

    // Converter todas as linhas em objetos
    const records = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ""; });
      return obj;
    });

    // Tentar encontrar o registro por empresa_id (chave prioritária)
    let found = null;
    if (empresa_id) {
      found = records.find(r => {
        const eid = String(r.empresa_id || r.id || r.empresa || "").trim();
        return eid === String(empresa_id).trim();
      });
    }

    // Fallback: buscar por nome do cliente (match parcial, case insensitive)
    if (!found && client_name) {
      const needle = client_name.toLowerCase().trim();
      found = records.find(r => {
        const nome = String(r.nome || r.empresa || r.cliente || r.client_name || "").toLowerCase().trim();
        return nome.includes(needle) || needle.includes(nome);
      });
    }

    if (!found) {
      return Response.json({
        found: false,
        message: `Nenhuma empresa encontrada com empresa_id="${empresa_id}" ou nome="${client_name}"`,
        available_ids: records.slice(0, 20).map(r => ({
          empresa_id: r.empresa_id || r.id || "",
          nome: r.nome || r.empresa || ""
        }))
      });
    }

    // Mapear campos para o formato esperado
    const result = {
      found: true,
      empresa_id: found.empresa_id || found.id || "",
      nome: found.nome || found.empresa || "",
      numero_funcionarios: parseFloat(found.numero_funcionarios || found.funcionarios || "0") || 0,
      numero_funcionarios_ativos: parseFloat(found.numero_funcionarios_ativos || found.ativos || "0") || 0,
      numero_regras_de_calculo: parseFloat(found.numero_regras_de_calculo || found.regras_de_calculo || found.regras || "0") || 0,
      email_ultimo_acesso: found.email_ultimo_acesso || found.email || "",
      data_ultimo_acesso: found.data_ultimo_acesso || found.ultimo_acesso || "",
      empregados_batendo_ponto_ultimos_15_dias: parseFloat(
        found.empregados_batendo_ponto_ultimos_15_dias || found.batendo_ponto || "0"
      ) || 0,
      data_exportacao: found.data_exportacao || found.data_atualizacao || "",
      raw: found
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});