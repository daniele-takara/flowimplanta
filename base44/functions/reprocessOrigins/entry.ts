import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { sleep, fetchWithRetry, normalizeField } from "../../shared/pipedriveUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem reprocessar origens' }, { status: 403 });
    }

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const baseV1 = "https://api.pipedrive.com/v1";
    const CANAL_FIELD = "64fcc82db764fdd7f6bbc3add7735d6751bb5935";
    const BATCH = 5;

    // 1. Listar todos os projetos com pipedrive_deal_id
    const projects = await base44.asServiceRole.entities.Project.list("-created_date", 500);
    const withDealId = projects.filter((p: any) => p.pipedrive_deal_id != null);

    if (withDealId.length === 0) {
      return Response.json({ success: true, message: 'Nenhum projeto com pipedrive_deal_id', updated: 0 });
    }

    // 2. Buscar deals em lotes de 5 (paralelo) para obter org_id
    const dealToOrg: Record<string, number> = {};
    for (let i = 0; i < withDealId.length; i += BATCH) {
      const batch = withDealId.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((p: any) =>
          fetchWithRetry(`${baseV1}/deals/${p.pipedrive_deal_id}?api_token=${apiToken}`)
        )
      );
      results.forEach((r: any, idx: number) => {
        const orgId = r.data?.org_id?.value;
        if (orgId) {
          dealToOrg[String(batch[idx].pipedrive_deal_id)] = orgId;
        }
      });
      if (i + BATCH < withDealId.length) await sleep(300);
    }

    // 3. Buscar organizações únicas em lotes de 5 para obter o canal
    const orgIds = [...new Set(Object.values(dealToOrg))];
    const orgCanal: Record<string, string> = {};
    for (let i = 0; i < orgIds.length; i += BATCH) {
      const batch = orgIds.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((orgId: number) =>
          fetchWithRetry(`${baseV1}/organizations/${orgId}?api_token=${apiToken}`)
        )
      );
      results.forEach((r: any, idx: number) => {
        if (r.data) {
          orgCanal[String(batch[idx])] = normalizeField(r.data[CANAL_FIELD]);
        }
      });
      if (i + BATCH < orgIds.length) await sleep(300);
    }

    // 4. Atualizar origem de cada projeto cujo canal mudou
    const updates: Array<{ id: string; origin: string }> = [];
    const details: Array<{ id: string; name: string; old: string; new: string }> = [];
    let unchanged = 0;
    let noCanal = 0;

    for (const p of withDealId) {
      const orgId = dealToOrg[String(p.pipedrive_deal_id)];
      if (!orgId) { noCanal++; continue; }
      const canal = (orgCanal[String(orgId)] || "").trim();
      if (!canal) { noCanal++; continue; }
      if (canal !== (p.origin || "")) {
        updates.push({ id: p.id, origin: canal });
        details.push({ id: p.id, name: p.name, old: p.origin || "", new: canal });
      } else {
        unchanged++;
      }
    }

    // 5. Aplicar updates em lote (bulkUpdate até 500 por chamada)
    if (updates.length > 0) {
      await base44.asServiceRole.entities.Project.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      total_with_deal_id: withDealId.length,
      unique_orgs: orgIds.length,
      updated: updates.length,
      unchanged,
      no_canal: noCanal,
      details: details.slice(0, 100),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});