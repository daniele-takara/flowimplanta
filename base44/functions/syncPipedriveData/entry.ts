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
    // Mapa de normalização: nomes que podem vir do Pipedrive → nomes canônicos do sistema
    const MODULE_CANONICAL = {
      "registro de ponto": "Registro de Ponto",
      "ponto eletronico": "Registro de Ponto",
      "ponto eletrônico": "Registro de Ponto",
      "reducao de riscos no registro": "Redução de Riscos no Registro",
      "redução de riscos no registro": "Redução de Riscos no Registro",
      "reducao de riscos": "Redução de Riscos no Registro",
      "calculos e tratamento": "Cálculos e Tratamento",
      "cálculos e tratamento": "Cálculos e Tratamento",
      "calculos": "Cálculos e Tratamento",
      "gestao de ponto participativa": "Gestão de Ponto Participativa",
      "gestão de ponto participativa": "Gestão de Ponto Participativa",
      "gestao participativa": "Gestão de Ponto Participativa",
      "controle de custos": "Controle de Custos",
      "gestao de ferias e ausencias": "Gestão de Férias e Ausências",
      "gestão de férias e ausências": "Gestão de Férias e Ausências",
      "gestao de ferias": "Gestão de Férias e Ausências",
      "gestão de férias": "Gestão de Férias e Ausências",
      "ferias": "Gestão de Férias e Ausências",
      "férias": "Gestão de Férias e Ausências",
      "timesheet": "Timesheet",
      // Nomes legados / alternativos
      "banco de horas": "Cálculos e Tratamento",
      "escala": "Registro de Ponto",
      "app mobile": "Registro de Ponto",
    };
    const VALID_MODULES = [
      "Registro de Ponto", "Redução de Riscos no Registro", "Cálculos e Tratamento",
      "Gestão de Ponto Participativa", "Controle de Custos", "Gestão de Férias e Ausências", "Timesheet",
    ];
    function normalizeModule(raw) {
      const key = (raw || "").toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Busca direta no mapa de normalização
      for (const [k, v] of Object.entries(MODULE_CANONICAL)) {
        const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (key === normKey) return v;
      }
      // Se já é um valor canônico válido, retorna diretamente
      const directMatch = VALID_MODULES.find(v =>
        v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === key
      );
      return directMatch || null;
    }

    let contractedModules = [];
    const modRaw = org?.["a7cf0200e401a761fb5fff4f4122beb364de9adb"];
    if (modRaw) {
      const rawList = Array.isArray(modRaw)
        ? modRaw.map(m => normalizeField(m))
        : String(modRaw).split(",").map(s => s.trim());
      // Normaliza cada módulo para o nome canônico do sistema
      const normalized = rawList.map(m => normalizeModule(m)).filter(Boolean);
      // Remove duplicatas preservando ordem
      contractedModules = [...new Set(normalized)];
      if (rawList.length > 0) {
        console.log(`[syncPipedriveData] contracted_modules: raw=${JSON.stringify(rawList)} → normalized=${JSON.stringify(contractedModules)}`);
      }
    }

    // 8a. Resolver campos numéricos: funcionários contratados (da org) e MRR (deal.value)
    // deal.value → mrr (valor mensal do contrato em R$)
    const mrrRaw = deal.value != null && deal.value > 0 ? Number(deal.value) : null;
    // Org campo customizado: "Funcionários contratados" → hash e7f28ae86be385212be4b97a442150ee45ebbb56
    const funcRaw = org?.["e7f28ae86be385212be4b97a442150ee45ebbb56"] ?? null;
    const contractedEmployeesFromDeal = funcRaw != null && !isNaN(Number(funcRaw)) ? Number(funcRaw) : null;
    console.log(`[syncPipedriveData] deal.value=${deal.value} → mrr=${mrrRaw} | org.funcionarios_contratados=${funcRaw} → contracted_employees=${contractedEmployeesFromDeal}`);

    // 8b. Montar payload com apenas campos sincronizáveis (conforme planilha DE→PARA, Atualiza=sim)
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
      // Deal.value → mrr (NOVO: antes não era mapeado)
      mrr: mrrRaw != null && mrrRaw > 0 ? mrrRaw : undefined,
      // Deal.people_count / campo customizado → contracted_employees (NOVO)
      contracted_employees: contractedEmployeesFromDeal != null ? contractedEmployeesFromDeal : undefined,
    };



    // Remover undefined
    const cleanPayload = Object.fromEntries(
      Object.entries(syncPayload).filter(([, v]) => v !== undefined && v !== "")
    );

    // 9. Atualizar projeto no Base44
    const updated = await base44.entities.Project.update(project_id, cleanPayload);

    // 10. Aplicar dados do Pipedrive no Status Report (campo customizado → next_agenda / pendências)
    let statusReportResult = null;
    try {
      const srRes = await base44.functions.invoke("applyStatusReportFromPipedrive", {
        project_id,
        deal_id: Number(deal_id),
      });
      statusReportResult = srRes;
      console.log(`[syncPipedriveData] StatusReport sync: fields_updated=${srRes?.fields_updated}`);
    } catch (e) {
      console.warn(`[syncPipedriveData] StatusReport sync falhou (não crítico): ${e.message}`);
    }

    return Response.json({
      success: true,
      updated_fields: Object.keys(cleanPayload),
      project: updated,
      status_report: statusReportResult,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});