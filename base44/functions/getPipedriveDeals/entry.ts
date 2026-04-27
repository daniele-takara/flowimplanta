import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pipeline IDs alvo — ajuste conforme IDs reais da conta Pipedrive
// O sistema busca dinamicamente e filtra pelo nome.
const TARGET_PIPELINE_NAMES = ["Impl M, G e GG", "Acomp - Morfeu"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) {
      return Response.json({ error: 'API_PIpedrive secret não configurado' }, { status: 500 });
    }

    const base = "https://api.pipedrive.com/api/v2";

    // 1. Buscar todos os pipelines para resolver IDs pelos nomes alvo
    const pipelinesRes = await fetch(`${base}/pipelines?api_token=${apiToken}&limit=100`);
    const pipelinesData = await pipelinesRes.json();

    if (!pipelinesData.success) {
      return Response.json({ error: 'Erro ao buscar pipelines', details: pipelinesData }, { status: 502 });
    }

    const allPipelines = pipelinesData.data || [];
    const targetPipelines = allPipelines.filter(p =>
      TARGET_PIPELINE_NAMES.some(name => p.name === name)
    );

    if (targetPipelines.length === 0) {
      // Retorna lista dos pipelines disponíveis para facilitar diagnóstico
      return Response.json({
        deals: [],
        pipelines_found: allPipelines.map(p => ({ id: p.id, name: p.name })),
        message: `Nenhum pipeline com os nomes alvo foi encontrado. Pipelines disponíveis listados.`
      });
    }

    const pipelineIds = targetPipelines.map(p => p.id);

    // 2. Buscar deals de cada pipeline
    let allDeals = [];
    for (const pipelineId of pipelineIds) {
      let cursor = null;
      let page = 0;
      do {
        const url = new URL(`${base}/deals`);
        url.searchParams.set('api_token', apiToken);
        url.searchParams.set('pipeline_id', pipelineId);
        url.searchParams.set('limit', '100');
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url.toString());
        const data = await res.json();

        if (!data.success) break;

        const deals = data.data || [];
        allDeals = allDeals.concat(deals);

        cursor = data.additional_data?.next_cursor || null;
        page++;
        if (page > 20) break; // safety cap
      } while (cursor);
    }

    // 3. Normalizar campos para o frontend
    const normalized = allDeals.map(d => ({
      id: d.id,
      title: d.title || "",
      org_name: d.org_name || (d.organization?.name) || "",
      owner_name: d.owner_name || (d.owner?.name) || "",
      status: d.status || "open",
      pipeline_id: d.pipeline_id,
      pipeline_name: targetPipelines.find(p => p.id === d.pipeline_id)?.name || "",
      stage_name: d.stage_name || "",
      value: d.value || 0,
      currency: d.currency || "BRL",
      add_time: d.add_time || "",
    }));

    return Response.json({
      deals: normalized,
      pipelines: targetPipelines.map(p => ({ id: p.id, name: p.name })),
      total: normalized.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});