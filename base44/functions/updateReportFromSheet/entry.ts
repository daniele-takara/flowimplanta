import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
const SHEET_NAME = "Mais recente";

// Normaliza cabeçalho: lowercase, sem acentos, espaços → _
function normHeader(h) {
  return String(h).trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, lar21 } = body;

    if (!project_id) {
      return Response.json({ error: 'project_id é obrigatório' }, { status: 400 });
    }
    if (!lar21 || !String(lar21).trim()) {
      return Response.json({
        found: false,
        lar21_missing: true,
        message: 'Lar21 não preenchido. Não foi possível buscar dados da planilha.',
      });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // Buscar todos os dados da aba "Mais recente" — sem cache
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Cache-Control': 'no-cache' } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return Response.json({ error: 'Planilha vazia ou sem dados', found: false });
    }

    // ── Cabeçalhos: buscar por NOME, nunca por índice fixo ──────────────────
    const header = rows[0];
    const headerNorm = header.map(normHeader);

    const idxLar21        = headerNorm.indexOf("lar21");
    const idxNome         = headerNorm.indexOf("nome");
    const idxFuncionarios = headerNorm.indexOf("numero_empregados");
    const idxAtivos       = headerNorm.indexOf("numero_empregados_ativos");
    const idxUltimoAcesso = headerNorm.indexOf("data_ultimo_acesso");
    const idxBatendoPonto = headerNorm.indexOf("empregados_batendo_ponto_ultimos_15_dias");

    console.log(`[updateReportFromSheet] Cabeçalhos: ${headerNorm.join(", ")}`);
    console.log(`[updateReportFromSheet] Índices → lar21=${idxLar21} nome=${idxNome} funcionarios=${idxFuncionarios} batendo_ponto=${idxBatendoPonto}`);

    if (idxLar21 < 0) {
      console.error(`[updateReportFromSheet] ERRO: coluna "lar21" não encontrada nos cabeçalhos.`);
      return Response.json({
        found: false,
        lar21_not_found: true,
        message: 'Coluna "lar21" não encontrada na planilha. Verifique o cabeçalho da aba "Mais recente".',
        headers_found: header,
      });
    }

    // ── Busca pelo valor Lar21 — case-insensitive, trim ─────────────────────
    const lar21Norm = String(lar21).trim().toLowerCase();

    const matchRows = rows.slice(1).filter(r => {
      const cell = String(r[idxLar21] || "").trim().toLowerCase();
      return cell === lar21Norm;
    });

    console.log(`[updateReportFromSheet] Lar21="${lar21}" | col_idx=${idxLar21} | linhas encontradas: ${matchRows.length}`);

    if (matchRows.length === 0) {
      console.warn(`[updateReportFromSheet] Lar21 "${lar21}" não encontrado na aba "${SHEET_NAME}"`);
      return Response.json({
        found: false,
        lar21_not_found: true,
        message: `Lar21 não encontrado na aba "${SHEET_NAME}" da planilha.`,
      });
    }

    if (matchRows.length > 1) {
      console.warn(`[updateReportFromSheet] Lar21 "${lar21}" duplicado — ${matchRows.length} ocorrências`);
      return Response.json({
        found: false,
        lar21_duplicate: true,
        message: `Lar21 duplicado na planilha. ${matchRows.length} linhas encontradas. Revise a base.`,
      });
    }

    // ── Extrair dados da linha encontrada ────────────────────────────────────
    const matchRow = matchRows[0];

    const registeredEmployees = parseInt(idxFuncionarios >= 0 ? (matchRow[idxFuncionarios] || "0") : "0", 10) || 0;
    const recordingEmployees  = parseInt(idxBatendoPonto  >= 0 ? (matchRow[idxBatendoPonto]  || "0") : "0", 10) || 0;
    const nomeEncontrado      = idxNome         >= 0 ? (matchRow[idxNome]         || "") : "";
    const dataUltimoAcesso    = idxUltimoAcesso >= 0 ? (matchRow[idxUltimoAcesso] || "") : "";

    // ── Calcular aderência ───────────────────────────────────────────────────
    const projects = await base44.entities.Project.filter({ id: project_id });
    const project = projects?.[0] || null;
    const contractedEmployees = project?.contracted_employees || 0;
    const adherencePercent = contractedEmployees > 0
      ? Math.round((recordingEmployees / contractedEmployees) * 100)
      : 0;

    console.log(`[updateReportFromSheet] RESULTADO FINAL → Lar21="${lar21}" | nome="${nomeEncontrado}" | cadastrados=${registeredEmployees} | batendo_ponto=${recordingEmployees} | contratados=${contractedEmployees} | aderência=${adherencePercent}%`);

    // ── Persistir no StatusReport ────────────────────────────────────────────
    const now = new Date().toISOString();
    const userName = user.full_name || user.email || "Sistema";

    const reports = await base44.entities.StatusReport.filter({ project_id });
    const existingReport = reports?.[0] || null;

    const autoPayload = {
      project_id,
      report_date: now.split("T")[0],
      registered_employees: registeredEmployees,
      recording_employees:  recordingEmployees,
      adherence_percent:    adherencePercent,
      usability_snapshot: JSON.stringify({
        lar21,
        nome: nomeEncontrado,
        numero_funcionarios: registeredEmployees,
        empregados_batendo_ponto_ultimos_15_dias: recordingEmployees,
        data_ultimo_acesso: dataUltimoAcesso,
      }),
      last_auto_update: now,
      updated_by_name:  userName,
    };

    let savedReport;
    if (existingReport?.id) {
      await base44.entities.StatusReport.update(existingReport.id, autoPayload);
      savedReport = { ...existingReport, ...autoPayload };
    } else {
      savedReport = await base44.entities.StatusReport.create(autoPayload);
    }

    return Response.json({
      success: true,
      found: true,
      lar21,
      nome: nomeEncontrado,
      registered_employees: registeredEmployees,
      recording_employees:  recordingEmployees,
      adherence_percent:    adherencePercent,
      contracted_employees: contractedEmployees,
      report: savedReport,
    });

  } catch (error) {
    console.error(`[updateReportFromSheet] ERRO:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});