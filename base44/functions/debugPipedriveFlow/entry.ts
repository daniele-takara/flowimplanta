import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Diagnóstico focado nos itens dealChange do flow
 */

const PIPE_V1 = "https://api.pipedrive.com/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { deal_id } = body;
    if (!deal_id) return Response.json({ error: 'deal_id obrigatório' }, { status: 400 });

    const apiToken = Deno.env.get("API_PIpedrive");

    // Buscar TODOS os itens
    const allItems = [];
    let start = 0;
    while (true) {
      const res = await fetch(`${PIPE_V1}/deals/${deal_id}/flow?limit=100&start=${start}&api_token=${apiToken}`);
      const rawJson = await res.json();
      const items = rawJson.data || [];
      allItems.push(...items);
      if (!rawJson.additional_data?.pagination?.more_items_in_collection || items.length === 0) break;
      start += 100;
    }

    // Filtrar apenas dealChange
    const dealChanges = allItems.filter(i => i.object === 'dealChange');
    console.log(`Total dealChange items: ${dealChanges.length}`);

    // Logar cada dealChange RAW completo
    dealChanges.forEach((item, idx) => {
      console.log(`\n=== dealChange #${idx} RAW ===`);
      console.log(JSON.stringify(item, null, 2));
    });

    // Analisar estrutura: item.data tem field_key, old_value, new_value?
    const stageChanges = dealChanges.filter(item => {
      const d = item.data || {};
      // Tentar vários formatos possíveis
      return (
        d.field_key === 'stage_id' ||
        d.stage_id_new != null ||
        d.stage_id != null ||
        JSON.stringify(d).includes('stage')
      );
    });

    console.log(`\nDealChanges com referência a stage: ${stageChanges.length}`);
    stageChanges.forEach((item, idx) => {
      console.log(`Stage change #${idx}:`, JSON.stringify(item, null, 2));
    });

    // Listar todos os field_key únicos dentro de dealChange
    const fieldKeys = [...new Set(dealChanges.map(i => i.data?.field_key).filter(Boolean))];
    console.log("field_key únicos em dealChange:", fieldKeys);

    return Response.json({
      deal_id,
      total_flow_items: allItems.length,
      dealChange_count: dealChanges.length,
      stage_change_count: stageChanges.length,
      // Todos os field_keys presentes
      all_field_keys: fieldKeys,
      // Primeiro dealChange completo RAW
      first_dealChange_raw: dealChanges[0] || null,
      // Todos os dealChanges mapeados (estrutura simplificada)
      all_dealChanges: dealChanges.map((item, idx) => ({
        idx,
        timestamp: item.timestamp,
        object: item.object,
        data_keys: item.data ? Object.keys(item.data) : [],
        data: item.data,
      })),
      // Stage changes específicos
      stage_changes: stageChanges,
    });

  } catch (error) {
    console.error("[debugPipedriveFlow] erro:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});