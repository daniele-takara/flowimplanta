import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const deal_id = Number(body.deal_id);

    if (!deal_id || isNaN(deal_id)) {
      return Response.json({ error: 'deal_id inválido' }, { status: 400 });
    }

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    // Escolher qual versão testar (padrão: ambas)
    const version = body.version || "both";

    const results = {};

    // Aguardar 1s para evitar rate limit de chamadas anteriores
    await new Promise(r => setTimeout(r, 1000));

    // Testar v1
    const urlV1 = `https://api.pipedrive.com/v1/deals/${deal_id}?api_token=${apiToken}`;
    const resV1 = await fetch(urlV1);
    const textV1 = await resV1.text();
    let jsonV1 = null;
    try { jsonV1 = JSON.parse(textV1); } catch { jsonV1 = { raw: textV1 }; }
    results.v1 = {
      url: `GET /api/v1/deals/${deal_id}`,
      status_code: resV1.status,
      status_text: resV1.statusText,
      success: jsonV1?.success ?? false,
      data_summary: jsonV1?.data ? {
        id: jsonV1.data.id,
        title: jsonV1.data.title,
        status: jsonV1.data.status,
        org_id: jsonV1.data.org_id,
        pipeline_id: jsonV1.data.pipeline_id,
        stage_id: jsonV1.data.stage_id,
      } : null,
      error: jsonV1?.error || null,
      error_info: jsonV1?.error_info || null,
      full_response: jsonV1,
    };

    // Pausa entre chamadas
    await new Promise(r => setTimeout(r, 2000));

    // Testar v2
    const urlV2 = `https://api.pipedrive.com/api/v2/deals/${deal_id}?api_token=${apiToken}`;
    const resV2 = await fetch(urlV2);
    const textV2 = await resV2.text();
    let jsonV2 = null;
    try { jsonV2 = JSON.parse(textV2); } catch { jsonV2 = { raw: textV2 }; }
    results.v2 = {
      url: `GET /api/v2/deals/${deal_id}`,
      status_code: resV2.status,
      status_text: resV2.statusText,
      success: jsonV2?.success ?? (resV2.status === 200),
      data_summary: jsonV2?.data ? {
        id: jsonV2.data.id,
        title: jsonV2.data.title,
        status: jsonV2.data.status,
        org_id: jsonV2.data.org_id,
        pipeline_id: jsonV2.data.pipeline_id,
        stage_id: jsonV2.data.stage_id,
      } : null,
      error: jsonV2?.error || null,
      error_info: jsonV2?.error_info || null,
      full_response: jsonV2,
    };

    return Response.json({
      tested_deal_id: deal_id,
      id_type: typeof deal_id,
      results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});