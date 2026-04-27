import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiToken = Deno.env.get("API_PIpedrive");
    const baseV1 = "https://api.pipedrive.com/v1";

    // Buscar 1 deal aberto do pipeline 16 via endpoint individual
    const res = await fetch(`${baseV1}/deals/12655?api_token=${apiToken}`);
    const data = await res.json();
    const deal = data.data;

    return Response.json({
      // Campos principais do deal
      id: deal?.id,
      title: deal?.title,
      status: deal?.status,
      // user_id (owner)
      user_id: deal?.user_id,
      // org_id
      org_id: deal?.org_id,
      // Campos customizados (chaves da planilha)
      gerente_field: deal?.["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"],
      data_alinhada: deal?.["88d64f1a3b63ae0b5f7df83305a918dbec8503dd"],
      expected_close: deal?.expected_close_date,
      add_time: deal?.add_time,
      // org inline info
      org_name_inline: deal?.org_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});