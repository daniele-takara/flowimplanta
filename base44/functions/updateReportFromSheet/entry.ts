import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const SHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
    const SHEET_NAME = "Mais recente";

    // Buscar todos os dados da aba "Mais recente"
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return Response.json({ error: 'Planilha vazia ou sem dados', found: false });
    }

    // Coluna B (índice 1) = Lar21
    // Normalizar: trim, lowercase para comparação
    const lar21Norm = String(lar21).trim().toLowerCase();

    // Encontrar TODAS as linhas com o Lar21 (para detectar duplicatas)
    const matchRows = rows.slice(1).filter(r => {
      const cellLar21 = String(r[1] || "").trim().toLowerCase();
      return cellLar21 === lar21Norm;
    });

    console.log(`[updateReportFromSheet] Lar21="${lar21}" | aba="${SHEET_NAME}" | col B | linhas encontradas: ${matchRows.length}`);

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

    const matchRow = matchRows[0];
    const header = rows[0];

    // Mapear cabeçalhos dinamicamente (normalizado) — coluna B é lar21
    const headerNorm = header.map(h => String(h).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
    );

    const idx = (name) => headerNorm.indexOf(name);

    const idxNome            = idx("nome");
    const idxFuncionarios    = idx("numero_empregados");
    const idxAtivos          = idx("numero_empregados_ativos");
    const idxUltimoAcesso    = idx("data_ultimo_acesso");
    const idxBatendoPonto    = idx("empregados_batendo_ponto_ultimos_15_dias");

    const registeredEmployees = parseInt(matchRow[idxFuncionarios] || "0", 10) || 0;
    const recordingEmployees  = parseInt(matchRow[idxBatendoPonto]  || "0", 10) || 0;
    const nomeEncontrado      = idxNome >= 0 ? (matchRow[idxNome] || "") : "";
    const dataUltimoAcesso    = idxUltimoAcesso >= 0 ? (matchRow[idxUltimoAcesso] || "") : "";

    console.log(`[updateReportFromSheet] Lar21="${lar21}" | nome="${nomeEncontrado}" | cadastrados=${registeredEmployees} | batendo ponto=${recordingEmployees}`);

    // Buscar projeto para calcular aderência
    const projects = await base44.entities.Project.filter({ id: project_id });
    const project = projects?.[0] || null;
    const contractedEmployees = project?.contracted_employees || 0;
    const adherencePercent = contractedEmployees > 0
      ? Math.round((recordingEmployees / contractedEmployees) * 100)
      : 0;

    const now = new Date().toISOString();
    const userName = user.full_name || user.email || "Sistema";

    // Buscar report existente
    const reports = await base44.entities.StatusReport.filter({ project_id });
    const existingReport = reports?.[0] || null;

    // Payload apenas com campos automáticos — NUNCA campos manuais
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
      report: savedReport,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});