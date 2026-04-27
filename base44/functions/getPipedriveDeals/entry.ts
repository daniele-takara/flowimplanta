import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pipelines alvo (IDs reais confirmados)
const TARGET_PIPELINES = [
  { id: 16, name: "Impl M, G e GG" },
  { id: 10, name: "Acomp - Morfeu" },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(delayMs);
      continue;
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return {}; }
  }
  return {};
}

function extractDate(val) {
  if (!val) return "";
  return String(val).substring(0, 10);
}

function normalizeOrigin(val) {
  const map = {
    "pontotel": "Pontotel",
    "parceiro": "Parceiro",
    "indicação": "Indicação",
    "indicacao": "Indicação",
    "inbound": "Inbound",
    "outbound": "Outbound",
  };
  return map[(val || "").toLowerCase().trim()] || "";
}

function normalizeField(val) {
  if (!val) return "";
  if (typeof val === "object" && val.name) return val.name;
  return String(val).trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const baseV1 = "https://api.pipedrive.com/v1";

    // 1. Buscar deals abertos por pipeline via /v1/pipelines/{id}/deals?status=open
    const rawDeals = [];
    for (const pipeline of TARGET_PIPELINES) {
      await sleep(600);
      let start = 0;
      let hasMore = true;
      while (hasMore) {
        const data = await fetchWithRetry(
          `${baseV1}/pipelines/${pipeline.id}/deals?status=open&limit=100&start=${start}&api_token=${apiToken}`
        );
        if (!data.success || !data.data?.length) break;
        rawDeals.push(...data.data.map(d => ({ ...d, _pipelineName: pipeline.name })));
        hasMore = data.additional_data?.pagination?.more_items_in_collection === true;
        start += 100;
        if (hasMore) await sleep(400);
      }
    }

    if (rawDeals.length === 0) {
      return Response.json({ deals: [], pipelines: TARGET_PIPELINES, total: 0 });
    }

    // 1b. Buscar dealFields para resolver ENUMs (uma única chamada)
    const fieldsRes = await fetchWithRetry(`${baseV1}/dealFields?api_token=${apiToken}&limit=500`);
    const enumMaps = {}; // key -> { optionId -> label }
    for (const f of (fieldsRes.data || [])) {
      if (f.field_type === "enum" && f.options?.length > 0) {
        enumMaps[f.key] = {};
        for (const opt of f.options) {
          enumMaps[f.key][String(opt.id)] = opt.label;
        }
      }
    }

    // 2. Enriquecer deals com /deals/{id} completo (tem user_id.name, stage_name, etc.) — lotes de 5
    const DEAL_BATCH = 5;
    const enrichedDeals = [];
    for (let i = 0; i < rawDeals.length; i += DEAL_BATCH) {
      const batch = rawDeals.slice(i, i + DEAL_BATCH);
      const results = await Promise.all(
        batch.map(d => fetchWithRetry(`${baseV1}/deals/${d.id}?api_token=${apiToken}`))
      );
      results.forEach((r, idx) => {
        enrichedDeals.push(r.data ? { ...batch[idx], ...r.data, _pipelineName: batch[idx]._pipelineName } : batch[idx]);
      });
      if (i + DEAL_BATCH < rawDeals.length) await sleep(300);
    }

    // 3. Resolver organizações únicas — lotes de 5 em paralelo
    const orgIds = [...new Set(enrichedDeals.map(d => d.org_id?.value).filter(Boolean))];
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

    // 4. (ENUM resolvido via dealFields acima — não precisa buscar users separado)

    // 5. Normalizar campos conforme planilha DE→PARA
    const deals = enrichedDeals.map(deal => {
      const orgId = deal.org_id?.value;
      const org = orgId ? (orgMap[String(orgId)] || null) : null;

      // Gerente de Projeto (campo ENUM — converte ID → label via dealFields)
      const gerenteRaw = deal["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"];
      const gerenteEnumMap = enumMaps["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"] || {};
      const gerenteName = gerenteRaw ? (gerenteEnumMap[String(gerenteRaw)] || "") : "";

      // Analista de Implantação = owner do deal (agora com .name via /deals/{id})
      const analystName = deal.user_id?.name || "";

      // Canal → Origem (campo da organização)
      const canal = normalizeField(org?.["64fcc82db764fdd7f6bbc3add7735d6751bb5935"]);
      const origin = normalizeOrigin(canal);

      // Lar21 (campo da organização)
      const lar21 = normalizeField(org?.["a5301f920ae3f519007886f518d87832866e8c6a"]);

      // Módulos contratados
      const parseList = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(m => normalizeField(m)).filter(Boolean);
        return String(raw).split(",").map(s => s.trim()).filter(Boolean);
      };
      const contractedModules = parseList(org?.["a7cf0200e401a761fb5fff4f4122beb364de9adb"]);
      // Serviços contratados
      const contractedServices = parseList(org?.["63d9aaa839860ca131fd6c6d8804ea502326f39b"]);
      // Funcionários contratados
      const contractedEmployees = org?.["e7f28ae86be385212be4b97a442150ee45ebbb56"] ?? null;
      // stage_name: /deals/{id} retorna como string em stage_name (via details endpoint)
      const stageName = typeof deal.stage_name === "string" ? deal.stage_name : "";

      return {
        id: deal.id,
        title: deal.title || "",
        org_name: org?.name || deal.org_id?.name || deal.organization_name || "",
        owner_name: analystName,
        gerente_name: gerenteName,
        status: deal.status || "open",
        pipeline_id: deal.pipeline_id,
        pipeline_name: deal._pipelineName,
        stage_name: stageName,
        value: deal.value || 0,
        currency: deal.currency || "BRL",
        add_time: extractDate(deal.add_time),
        expected_close_date: extractDate(deal.expected_close_date),
        aligned_end_date: extractDate(deal["88d64f1a3b63ae0b5f7df83305a918dbec8503dd"]),
        origin,
        lar21,
        contracted_modules: contractedModules,
        contracted_services: contractedServices,
        contracted_employees: contractedEmployees,
        mrr: deal.value || 0,
      };
    });

    return Response.json({ deals, pipelines: TARGET_PIPELINES, total: deals.length });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});