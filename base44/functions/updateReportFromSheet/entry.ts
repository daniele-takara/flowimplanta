import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id, empresa_id } = body;
    if (!project_id || !empresa_id) {
      return Response.json({ error: 'project_id e empresa_id são obrigatórios' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    const SHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
    const SHEET_NAME = "Mais recente";

    // Buscar todos os dados da aba
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];
    if (rows.length < 2) {
      return Response.json({ error: 'Planilha vazia ou sem dados', found: false });
    }

    // Colunas: empresa_id, nome, numero_empregados, numero_empregados_ativos,
    //          numero_regras_de_calculo, data_ultimo_acesso, empregados_batendo_ponto_ultimos_15_dias
    const header = rows[0];
    const idxEmpresaId = header.indexOf("empresa_id");
    const idxNome = header.indexOf("nome");
    const idxFuncionarios = header.indexOf("numero_empregados");
    const idxAtivos = header.indexOf("numero_empregados_ativos");
    const idxUltimoAcesso = header.indexOf("data_ultimo_acesso");
    const idxBatendoPonto = header.indexOf("empregados_batendo_ponto_ultimos_15_dias");

    // Encontrar linha pelo empresa_id
    const matchRow = rows.slice(1).find(r => (r[idxEmpresaId] || "").trim() === String(empresa_id).trim());

    if (!matchRow) {
      return Response.json({ found: false, message: `empresa_id '${empresa_id}' não encontrado na planilha` });
    }

    const registeredEmployees = parseInt(matchRow[idxFuncionarios] || "0", 10) || 0;
    const recordingEmployees = parseInt(matchRow[idxBatendoPonto] || "0", 10) || 0;

    // Buscar projeto para calcular % aderência
    const project = await base44.entities.Project.filter({ id: project_id });
    const contractedEmployees = project?.[0]?.contracted_employees || 0;
    const adherencePercent = contractedEmployees > 0
      ? Math.round((recordingEmployees / contractedEmployees) * 100)
      : 0;

    const now = new Date().toISOString();
    const userName = user.full_name || user.email || "Sistema";

    // Buscar report existente
    const reports = await base44.entities.StatusReport.filter({ project_id });
    const existingReport = reports?.[0] || null;

    // Montar payload — apenas campos automáticos, NUNCA campos manuais
    const autoPayload = {
      project_id,
      report_date: now.split("T")[0],
      registered_employees: registeredEmployees,
      recording_employees: recordingEmployees,
      adherence_percent: adherencePercent,
      usability_snapshot: JSON.stringify({
        empresa_id,
        nome: matchRow[idxNome] || "",
        numero_funcionarios: registeredEmployees,
        empregados_batendo_ponto_ultimos_15_dias: recordingEmployees,
        data_ultimo_acesso: matchRow[idxUltimoAcesso] || "",
      }),
      last_auto_update: now,
      updated_by_name: userName,
    };

    let savedReport;
    if (existingReport?.id) {
      savedReport = await base44.entities.StatusReport.update(existingReport.id, autoPayload);
      savedReport = { ...existingReport, ...autoPayload };
    } else {
      savedReport = await base44.entities.StatusReport.create(autoPayload);
    }

    return Response.json({
      success: true,
      found: true,
      registered_employees: registeredEmployees,
      recording_employees: recordingEmployees,
      adherence_percent: adherencePercent,
      report: savedReport,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});