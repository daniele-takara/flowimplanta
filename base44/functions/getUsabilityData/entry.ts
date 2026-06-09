import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Planilha de usabilidade
const SPREADSHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
const SHEET_NAME = "Mais recente";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { lar21 } = body;

    if (!lar21 || !String(lar21).trim()) {
      return Response.json({
        found: false,
        lar21_missing: true,
        message: "Lar21 não preenchido. Não foi possível buscar dados da planilha.",
      });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // Buscar dados da aba "Mais recente"
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return Response.json({ found: false, message: "Planilha vazia ou sem dados" });
    }

    // Coluna B (índice 1) = Lar21
    const lar21Norm = String(lar21).trim().toLowerCase();

    const matchRows = rows.slice(1).filter(r => {
      const cellLar21 = String(r[1] || "").trim().toLowerCase();
      return cellLar21 === lar21Norm;
    });

    console.log(`[getUsabilityData] Lar21="${lar21}" | aba="${SHEET_NAME}" | col B | linhas encontradas: ${matchRows.length}`);

    if (matchRows.length === 0) {
      return Response.json({
        found: false,
        lar21_not_found: true,
        message: `Lar21 não encontrado na aba "${SHEET_NAME}" da planilha.`,
        lar21,
      });
    }

    if (matchRows.length > 1) {
      return Response.json({
        found: false,
        lar21_duplicate: true,
        message: `Lar21 duplicado na planilha. ${matchRows.length} linhas encontradas. Revise a base.`,
        lar21,
      });
    }

    const matchRow = matchRows[0];
    const header = rows[0];

    const headerNorm = header.map(h => String(h).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
    );

    const idx = (name) => headerNorm.indexOf(name);

    const found = {};
    headerNorm.forEach((h, i) => { found[h] = matchRow[i] || ""; });

    const result = {
      found: true,
      lar21,
      nome: found.nome || found.empresa || "",
      numero_funcionarios: parseFloat(found.numero_empregados || found.numero_funcionarios || "0") || 0,
      numero_funcionarios_ativos: parseFloat(found.numero_empregados_ativos || "0") || 0,
      numero_regras_de_calculo: parseFloat(found.numero_regras_de_calculo || found.regras || "0") || 0,
      email_ultimo_acesso: found.email_ultimo_acesso || found.email || "",
      data_ultimo_acesso: found.data_ultimo_acesso || found.ultimo_acesso || "",
      empregados_batendo_ponto_ultimos_15_dias: parseFloat(
        found.empregados_batendo_ponto_ultimos_15_dias || found.batendo_ponto || "0"
      ) || 0,
      data_exportacao: found.data_exportacao || found.data_atualizacao || "",
      raw: found,
    };

    console.log(`[getUsabilityData] Resultado: nome="${result.nome}" | cadastrados=${result.numero_funcionarios} | batendo ponto=${result.empregados_batendo_ponto_ultimos_15_dias}`);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});