import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(delayMs); continue; }
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
    "pontotel": "Pontotel", "parceiro": "Parceiro",
    "indicação": "Indicação", "indicacao": "Indicação",
    "inbound": "Inbound", "outbound": "Outbound",
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

    const body = await req.json();
    const { project_id, deal_id } = body;

    if (!project_id || !deal_id) {
      return Response.json({ error: 'project_id e deal_id são obrigatórios' }, { status: 400 });
    }

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const baseV1 = "https://api.pipedrive.com/v1";

    // 1. Buscar deal
    const dealData = await fetchWithRetry(`${baseV1}/deals/${deal_id}?api_token=${apiToken}`);
    if (!dealData.success || !dealData.data) {
      return Response.json({ error: 'Deal não encontrado no Pipedrive' }, { status: 404 });
    }
    const deal = dealData.data;

    // 2. Buscar organização
    const orgId = deal.org_id?.value || deal.org_id;
    let org = null;
    if (orgId) {
      await sleep(300);
      const orgData = await fetchWithRetry(`${baseV1}/organizations/${orgId}?api_token=${apiToken}`);
      if (orgData.data) org = orgData.data;
    }

    // 3. Resolver gerente de projeto — campo ENUM, converte ID → label via /dealFields
    const gerenteIdRaw = deal["30e71cbb54fad7e29fb71e3bcf9bfe59b4500743"];
    let gerenteName = "";
    if (gerenteIdRaw) {
      await sleep(200);
      const fieldsData = await fetchWithRetry(`${baseV1}/dealFields?api_token=${apiToken}&limit=500`);
      const gerenteField = (fieldsData.data || []).find(f => f.key === "30e71cbb54fad7e29fb71e3bcf9bfe59b4500743");
      if (gerenteField?.options) {
        const opt = gerenteField.options.find(o => String(o.id) === String(gerenteIdRaw));
        gerenteName = opt?.label || "";
      }
    }

    // 4. Analista = owner do deal
    const analystName = deal.user_id?.name || "";

    // 5. Canal → Origem
    const canal = normalizeField(org?.["64fcc82db764fdd7f6bbc3add7735d6751bb5935"]);
    const origin = normalizeOrigin(canal);

    // 6. Lar21
    const lar21 = normalizeField(org?.["a5301f920ae3f519007886f518d87832866e8c6a"]);

    // 7. Módulos contratados
    let contractedModules = [];
    const modRaw = org?.["a7cf0200e401a761fb5fff4f4122beb364de9adb"];
    if (modRaw) {
      if (Array.isArray(modRaw)) {
        contractedModules = modRaw.map(m => normalizeField(m)).filter(Boolean);
      } else {
        contractedModules = String(modRaw).split(",").map(s => s.trim()).filter(Boolean);
      }
    }

    // 8. Montar payload com apenas campos sincronizáveis (conforme planilha DE→PARA, Atualiza=sim)
    // NÃO sobrescreve campos editados manualmente que não estão na planilha
    const syncPayload = {
      // Garantir que o ID Deal Pipedrive está sempre salvo (chave de vínculo)
      pipedrive_deal_id: Number(deal_id),
      // Deal.title → nome do projeto
      name: deal.title || undefined,
      // Org.name → client_name
      client_name: org?.name || deal.org_id?.name || undefined,
      // Deal.add_time → start_date
      start_date: extractDate(deal.add_time) || undefined,
      // Deal.expected_close_date → planned_end_date
      planned_end_date: extractDate(deal.expected_close_date) || undefined,
      // Deal.88d64f... → aligned_end_date
      aligned_end_date: extractDate(deal["88d64f1a3b63ae0b5f7df83305a918dbec8503dd"]) || undefined,
      // Deal.user_id → pontotel_analyst_name
      pontotel_analyst_name: analystName || undefined,
      // Deal.30e71c... → pontotel_manager_name
      pontotel_manager_name: gerenteName || undefined,
      // Org.Canal → origin
      origin: origin || undefined,
      // Org.lar21 → lar21
      lar21: lar21 || undefined,
      // Org.módulos → contracted_modules
      contracted_modules: contractedModules.length > 0 ? contractedModules : undefined,
    };

    // Remover undefined
    const cleanPayload = Object.fromEntries(
      Object.entries(syncPayload).filter(([, v]) => v !== undefined && v !== "")
    );

    // 9. Atualizar projeto no Base44
    const updated = await base44.entities.Project.update(project_id, cleanPayload);

    return Response.json({
      success: true,
      updated_fields: Object.keys(cleanPayload),
      project: updated,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});