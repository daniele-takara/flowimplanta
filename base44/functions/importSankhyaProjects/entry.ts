import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  sleep, fetchWithRetry, extractDate, normalizeField,
  norm, normalizeName, resolveModule, parseList, resolveUserByName,
} from "../../shared/pipedriveUtils.ts";

const TARGET_PIPELINES = [
  { id: 16, name: "Impl M, G e GG" },
  { id: 10, name: "Acomp - Morfeu" },
];

const SCHEDULE_PHASES = [
  "Abertura de projeto", "Integração", "Cadastros", "Parametrização",
  "Treinamento e Validações", "Operação Assistida", "Fechamento de Folha",
  "Expansão", "Encerramento",
];

const DEAL_STATUSES = ["open", "lost", "won"];

// ── Stage → status + pause_reason mapping ───────────────────────────────────
function mapStatusAndPauseReason(stageName) {
  const sn = norm(stageName);
  if (sn.includes("pausado")) {
    const pauseReason = (sn.includes("snk") || sn.includes("sankhya"))
      ? "Aguardando integração Sankhya"
      : "Aguardando retorno do cliente";
    return { status: "Pausado", pause_reason: pauseReason };
  }
  if (sn.includes("nao iniciado") || sn.includes("alocar")) {
    return { status: "Em aberto", pause_reason: "" };
  }
  return { status: "Em andamento", pause_reason: "" };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Permission check
    const isSystemAdmin = user.role === 'admin';
    let canSync = isSystemAdmin;
    if (!isSystemAdmin && user.permission_profile_id) {
      try {
        const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({ id: user.permission_profile_id });
        if (profiles?.[0]?.permissions?.integracao_sync_pipedrive_dados === true) canSync = true;
      } catch { canSync = false; }
    }
    if (!canSync) return Response.json({ error: 'Sem permissão para importar projetos' }, { status: 403 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const baseV1 = "https://api.pipedrive.com/v1";

    // 1. Fetch stages for both pipelines (stage_id → stage_name)
    const stageMap = {};
    for (const pipeline of TARGET_PIPELINES) {
      await sleep(300);
      const stagesData = await fetchWithRetry(`${baseV1}/stages?pipeline_id=${pipeline.id}&api_token=${apiToken}&limit=500`);
      stageMap[pipeline.id] = {};
      for (const stage of (stagesData.data || [])) {
        stageMap[pipeline.id][String(stage.id)] = stage.name;
      }
    }

    // 2. Fetch all deals (3 statuses per pipeline, dedup by deal id)
    const rawDeals = [];
    const seenDealIds = new Set();
    for (const pipeline of TARGET_PIPELINES) {
      for (const status of DEAL_STATUSES) {
        await sleep(400);
        let start = 0;
        let hasMore = true;
        while (hasMore) {
          const data = await fetchWithRetry(
            `${baseV1}/pipelines/${pipeline.id}/deals?status=${status}&limit=100&start=${start}&api_token=${apiToken}`
          );
          if (!data.success || !data.data?.length) break;
          for (const d of data.data) {
            if (!seenDealIds.has(d.id)) {
              seenDealIds.add(d.id);
              rawDeals.push({ ...d, _pipelineName: pipeline.name });
            }
          }
          hasMore = data.additional_data?.pagination?.more_items_in_collection === true;
          start += 100;
          if (hasMore) await sleep(400);
        }
      }
    }

    // 3. Fetch dealFields for ENUM resolution (gerente)
    const fieldsRes = await fetchWithRetry(`${baseV1}/dealFields?api_token=${apiToken}&limit=500`);
    const enumMaps = {};
    for (const f of (fieldsRes.data || [])) {
      if (f.field_type === "enum" && f.options?.length > 0) {
        enumMaps[f.key] = {};
        for (const opt of f.options) {
          enumMaps[f.key][String(opt.id)] = opt.label;
        }
      }
    }

    // 4. Fetch unique orgs (for canal filter + data)
    const getOrgId = (d) => typeof d.org_id === "object" ? d.org_id?.value : d.org_id;
    const orgIds = [...new Set(rawDeals.map(getOrgId).filter(Boolean))];
    const orgMap = {};
    const ORG_BATCH = 5;
    for (let i = 0; i < orgIds.length; i += ORG_BATCH) {
      const batch = orgIds.slice(i, i + ORG_BATCH);
      const results = await Promise.all(
        batch.map(orgId => fetchWithRetry(`${baseV1}/organizations/${orgId}?api_token=${apiToken}`))
      );
      results.forEach((d, idx) => { if (d.data) orgMap[String(batch[idx])] = d.data; });
      if (i + ORG_BATCH < orgIds.length) await sleep(300);
    }

    // 5. Filter Sankhya deals and map data
    const sankhyaDeals = rawDeals.filter(deal => {
      const orgId = getOrgId(deal);
      const org = orgId ? (orgMap[String(orgId)] || null) : null;
      const canal = norm(normalizeField(org?.["64fcc82db764fdd7f6bbc3add7735d6751bb5935"]));
      return canal.includes("sankhya");
    }).map(deal => {
      const orgId = getOrgId(deal);
      const org = orgId ? (orgMap[String(orgId)] || null) : null;
      const stageName = stageMap[deal.pipeline_id]?.[String(deal.stage_id)] || "";
      const gerenteRaw = deal["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"];
      const gerenteEnumMap = enumMaps["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"] || {};
      const gerenteName = gerenteRaw ? (gerenteEnumMap[String(gerenteRaw)] || "") : "";
      const analystName = typeof deal.user_id === "object" ? (deal.user_id?.name || "") : "";

      // Normalize modules
      const rawModules = parseList(org?.["a7cf0200e401a761fb5fff4f4122beb364de9adb"]);
      const contractedModules = [...new Set(rawModules.map(m => resolveModule(m).canonical).filter(Boolean))];

      return {
        id: deal.id,
        title: deal.title || "",
        org_name: org?.name || deal.org_id?.name || "",
        owner_name: analystName,
        gerente_name: gerenteName,
        status: deal.status,
        pipeline_id: deal.pipeline_id,
        pipeline_name: deal._pipelineName,
        stage_name: stageName,
        value: deal.value || 0,
        add_time: extractDate(deal.add_time),
        expected_close_date: extractDate(deal.expected_close_date),
        aligned_end_date: extractDate(deal["88d64f1a3b63ae0b5f7df83305a918dbec8503dd"]),
        lar21: normalizeField(org?.["a5301f920ae3f519007886f518d87832866e8c6a"]),
        contracted_modules: contractedModules,
        contracted_services: parseList(org?.["63d9aaa839860ca131fd6c6d8804ea502326f39b"]),
        contracted_employees: org?.["e7f28ae86be385212be4b97a442150ee45ebbb56"] ?? null,
        drive_folder: deal["818ba230f563236eb64f93c228328903a5376413"] || "",
      };
    });

    // 6. Fetch Base44 users for name → ID resolution
    const allUsers = await base44.asServiceRole.entities.User.list();

    // 7. Get all existing projects (to check duplicates)
    const existingProjects = await base44.asServiceRole.entities.Project.list("-created_date", 500);
    const existingByDealId = {};
    for (const p of existingProjects) {
      if (p.pipedrive_deal_id != null) {
        existingByDealId[String(p.pipedrive_deal_id)] = p;
      }
    }

    // 8. Process each Sankhya deal
    const summary = { created: [], updated: [], skipped: [], errors: [] };

    for (const deal of sankhyaDeals) {
      const { status, pause_reason } = mapStatusAndPauseReason(deal.stage_name);
      const existing = existingByDealId[String(deal.id)];

      if (existing) {
        // Update pause_reason if paused and missing
        if (existing.status === "Pausado" && !existing.pause_reason && pause_reason) {
          try {
            await base44.asServiceRole.entities.Project.update(existing.id, { pause_reason });
            summary.updated.push({ id: existing.id, name: existing.name, pause_reason, stage: deal.stage_name });
          } catch (e) {
            summary.errors.push({ deal_id: deal.id, name: existing.name, error: e.message });
          }
        } else {
          summary.skipped.push({ id: existing.id, name: existing.name, status: existing.status });
        }
        continue;
      }

      // Resolve user IDs
      const managerUser = resolveUserByName(deal.gerente_name, allUsers);
      const analystUser = resolveUserByName(deal.owner_name, allUsers);

      // Create new project
      try {
        const cleanPayload = Object.fromEntries(Object.entries({
          name: deal.title || `Projeto #${deal.id}`,
          client_name: deal.org_name || "—",
          pipedrive_deal_id: deal.id,
          pipedrive_pipeline_name: deal.pipeline_name,
          status,
          pause_reason: pause_reason || undefined,
          current_phase: "Abertura de projeto",
          progress_percent: 0,
          origin: "Parceiro",
          start_date: deal.add_time || undefined,
          planned_end_date: deal.expected_close_date || undefined,
          aligned_end_date: deal.aligned_end_date || undefined,
          mrr: deal.value > 0 ? deal.value : undefined,
          contracted_employees: deal.contracted_employees != null ? Number(deal.contracted_employees) : undefined,
          pontotel_analyst_name: analystUser?.full_name || deal.owner_name || undefined,
          pontotel_analyst_id: analystUser?.id || undefined,
          pontotel_analyst_email: analystUser?.email || undefined,
          pontotel_manager_name: managerUser?.full_name || deal.gerente_name || undefined,
          pontotel_manager_id: managerUser?.id || undefined,
          pontotel_manager_email: managerUser?.email || undefined,
          lar21: deal.lar21 || undefined,
          contracted_modules: deal.contracted_modules.length > 0 ? deal.contracted_modules : undefined,
          contracted_services: deal.contracted_services.length > 0 ? deal.contracted_services : undefined,
          drive_folder: deal.drive_folder || undefined,
        }).filter(([, v]) => v !== undefined && v !== ""));

        const project = await base44.asServiceRole.entities.Project.create(cleanPayload);

        // Create schedule phases
        const phases = SCHEDULE_PHASES.map((phase_name, i) => ({
          project_id: project.id,
          phase_name,
          progress_percent: 0,
          status: "Não iniciado",
          order: i + 1,
        }));
        await base44.asServiceRole.entities.SchedulePhase.bulkCreate(phases);

        summary.created.push({
          id: project.id,
          name: deal.title,
          client: deal.org_name,
          status,
          pause_reason,
          deal_id: deal.id,
          stage: deal.stage_name,
        });
      } catch (e) {
        summary.errors.push({ deal_id: deal.id, name: deal.title, error: e.message });
      }

      await sleep(150);
    }

    return Response.json({
      success: true,
      total_sankhya_deals: sankhyaDeals.length,
      created: summary.created.length,
      updated: summary.updated.length,
      skipped: summary.skipped.length,
      errors: summary.errors.length,
      details: summary,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});