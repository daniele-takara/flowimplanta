import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TARGET_PIPELINE_IDS = [16, 10];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const allStages = [];
    for (const pipelineId of TARGET_PIPELINE_IDS) {
      const res = await fetch(
        `https://api.pipedrive.com/v1/stages?pipeline_id=${pipelineId}&api_token=${apiToken}`
      );
      const data = await res.json();
      if (data.data) {
        allStages.push(...data.data.map(s => ({
          id: s.id,
          name: s.name,
          pipeline_id: s.pipeline_id,
        })));
      }
    }

    return Response.json({ stages: allStages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});