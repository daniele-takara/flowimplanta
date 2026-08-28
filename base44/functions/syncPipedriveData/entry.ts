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
    "pontotel": "Pontotel",
    "parceiro": "Parceiro",
    "indicação": "Indicação", "indicacao": "Indicação",
    "inbound": "Inbound",
    "outbound": "Outbound",
    // "Sankhya" no campo Canal indica origem via parceiro Sankhya → mapeado para "Parceiro"
    "sankhya": "Parceiro",
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

    // ── Permissão: sincronizar dados iniciais via Pipedrive ──
    const isSystemAdmin = user.role === 'admin';
    let canSync = isSystemAdmin;
    if (!isSystemAdmin && user.permission_profile_id) {
      try {
        const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({ id: user.permission_profile_id });
        if (profiles?.[0]?.permissions?.integracao_sync_pipedrive_dados === true) canSync = true;
      } catch { canSync = false; }
    }
    if (!canSync) return Response.json({ error: 'Sem permissão para sincronizar dados do Pipedrive' }, { status: 403 });

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

    // 4b. Resolver IDs de usuários a partir dos nomes (gerente e analista)
    // O ENUM do Pipedrive traz nomes curtos (ex: "Felipe"); aqui fazemos o match
    // com o User real e preenchemos pontotel_manager_id + email automaticamente.
    const allUsers = await base44.asServiceRole.entities.User.list();
    function normalizeName(s: string): string {
      return (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    }
    function resolveUserByName(name: string): { id: string; email: string; full_name: string } | null {
      if (!name) return null;
      const normN = normalizeName(name);
      if (!normN) return null;
      // 1. Match exato normalizado
      const exact = (allUsers || []).filter(u => normalizeName(u.full_name) === normN);
      if (exact.length === 1) return { id: exact[0].id, email: exact[0].email, full_name: exact[0].full_name };
      if (exact.length > 1) return null; // ambíguo — não resolve
      // 2. Match parcial: nome do Pipedrive é substring do full_name do User
      //    (ex: "Felipe" → "Felipe Chaves"). Só resolve se houver exatamente 1 candidato.
      const partial = (allUsers || []).filter(u => {
        const normFull = normalizeName(u.full_name);
        return normFull.includes(normN) && normN.length >= 3;
      });
      if (partial.length === 1) return { id: partial[0].id, email: partial[0].email, full_name: partial[0].full_name };
      return null;
    }
    const managerUser = resolveUserByName(gerenteName);
    const analystUser = resolveUserByName(analystName);
    if (managerUser) console.log(`[syncPipedriveData] Gerente resolvido: "${gerenteName}" → ${managerUser.full_name} (id=${managerUser.id})`);
    if (analystUser) console.log(`[syncPipedriveData] Analista resolvido: "${analystName}" → ${analystUser.full_name} (id=${analystUser.id})`);

    // 5. Canal → Origem
    const canal = normalizeField(org?.["64fcc82db764fdd7f6bbc3add7735d6751bb5935"]);
    const origin = normalizeOrigin(canal);

    // 6. Lar21
    const lar21 = normalizeField(org?.["a5301f920ae3f519007886f518d87832866e8c6a"]);

    // 7. Módulos contratados
    // Mapa de normalização: nomes que podem vir do Pipedrive → nomes canônicos do sistema
    // Mapa canônico: normaliza QUALQUER variação de nome de módulo que venha do Pipedrive
    // para o nome exato esperado pelo sistema (contractedModules enum do Base44).
    // Chaves: lowercase + sem acentos (NFD stripped). Valores: nome canônico exato.
    // ── Módulos oficiais do sistema ─────────────────────────────────────────────
    const OFFICIAL_MODULES = [
      "Registro de Ponto",
      "Redução de Riscos no Registro",
      "Cálculos e Tratamento",
      "Gestão de Ponto Participativa",
      "Controle de Custos",
      "Gestão de Férias e Ausências",
      "Timesheet",
    ];

    // Aliases conhecidos: nome não-oficial → nome canônico oficial
    // Qualquer entrada aqui representa um cadastro fora do padrão no Pipedrive.
    const MODULE_ALIASES = {
      // Registro de Ponto
      "ponto eletronico": "Registro de Ponto",
      "ponto eletrônico": "Registro de Ponto",
      "registro ponto": "Registro de Ponto",
      "ponto": "Registro de Ponto",
      // Redução de Riscos no Registro
      "reducao de riscos": "Redução de Riscos no Registro",
      "reducao riscos registro": "Redução de Riscos no Registro",
      // Cálculos e Tratamento
      "calculos e fechamento": "Cálculos e Tratamento",   // ← alias histórico principal
      "calculos fechamento": "Cálculos e Tratamento",
      "calculo e tratamento": "Cálculos e Tratamento",
      "calculo e fechamento": "Cálculos e Tratamento",
      "banco de horas": "Cálculos e Tratamento",
      "tratamento de ponto": "Cálculos e Tratamento",
      // Gestão de Ponto Participativa
      "gestao participativa": "Gestão de Ponto Participativa",
      "ponto participativo": "Gestão de Ponto Participativa",
      // Controle de Custos
      "controle custos": "Controle de Custos",
      "custos": "Controle de Custos",
      // Gestão de Férias e Ausências
      "gestao de ferias": "Gestão de Férias e Ausências",
      "ferias e ausencias": "Gestão de Férias e Ausências",
      "ferias": "Gestão de Férias e Ausências",
      "gestao ferias": "Gestão de Férias e Ausências",
    };

    function norm(s) {
      return (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // Pré-computar chaves normalizadas dos módulos oficiais para lookup rápido
    const OFFICIAL_NORMS = OFFICIAL_MODULES.map(m => ({ original: m, normed: norm(m) }));

    // Retorna { canonical, isAlias, isUnknown }
    function resolveModule(raw) {
      const key = norm(raw);
      // 1. Match exato com nome oficial (caso correto)
      const exactMatch = OFFICIAL_NORMS.find(o => o.normed === key);
      if (exactMatch) return { canonical: exactMatch.original, isAlias: false, isUnknown: false };
      // 2. Match com alias conhecido (cadastro fora do padrão, mas normalizável)
      const aliasCanonical = MODULE_ALIASES[key];
      if (aliasCanonical) return { canonical: aliasCanonical, isAlias: true, isUnknown: false };
      // 3. Desconhecido — não normalizar silenciosamente
      return { canonical: null, isAlias: false, isUnknown: true };
    }

    let contractedModules = [];
    const moduleAlerts = [];   // alertas de divergência para retornar ao frontend
    const modRaw = org?.["a7cf0200e401a761fb5fff4f4122beb364de9adb"];

    if (modRaw) {
      const rawList = Array.isArray(modRaw)
        ? modRaw.map(m => normalizeField(m)).filter(Boolean)
        : String(modRaw).split(",").map(s => s.trim()).filter(Boolean);

      for (const rawName of rawList) {
        const { canonical, isAlias, isUnknown } = resolveModule(rawName);

        if (!isAlias && !isUnknown) {
          // Nome correto — sem alerta
          contractedModules.push(canonical);
        } else if (isAlias) {
          // Nome fora do padrão, mas normalizável
          contractedModules.push(canonical);
          const alert = {
            type: "alias",
            severity: "warning",
            raw: rawName,
            canonical,
            message: `O módulo "${rawName}" não está no padrão oficial. Foi normalizado para "${canonical}". Recomendado corrigir o cadastro no Pipedrive.`,
          };
          moduleAlerts.push(alert);
          console.warn(`[syncPipedriveData] MODULE_ALIAS: "${rawName}" → "${canonical}"`);
        } else {
          // Desconhecido — não adicionar ao projeto, mas registrar alerta crítico
          const alert = {
            type: "unknown",
            severity: "error",
            raw: rawName,
            canonical: null,
            message: `O módulo "${rawName}" não foi reconhecido e não foi importado. Verifique o cadastro no Pipedrive e corrija para um dos módulos oficiais.`,
          };
          moduleAlerts.push(alert);
          console.error(`[syncPipedriveData] MODULE_UNKNOWN: "${rawName}" — não importado`);
        }
      }

      // Remove duplicatas preservando ordem
      contractedModules = [...new Set(contractedModules)];

      console.log(`[syncPipedriveData] contracted_modules: raw=${JSON.stringify(rawList)} → normalized=${JSON.stringify(contractedModules)} | alerts=${moduleAlerts.length}`);
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
      // Deal.user_id → pontotel_analyst_name (usa full_name canônico se resolveu User)
      pontotel_analyst_name: analystUser?.full_name || analystName || undefined,
      pontotel_analyst_id: analystUser?.id || undefined,
      pontotel_analyst_email: analystUser?.email || undefined,
      // Deal.30e71c... → pontotel_manager_name (usa full_name canônico se resolveu User)
      pontotel_manager_name: managerUser?.full_name || gerenteName || undefined,
      pontotel_manager_id: managerUser?.id || undefined,
      pontotel_manager_email: managerUser?.email || undefined,
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
      // Deal.818ba230... → drive_folder (NOVO: Pasta do Drive)
      drive_folder: deal["818ba230f563236eb64f93c228328903a5376413"] || undefined,
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
      // Diagnóstico de módulos: expõe divergências ao frontend
      modules_raw: modRaw
        ? (Array.isArray(modRaw)
            ? modRaw.map(m => normalizeField(m)).filter(Boolean)
            : String(modRaw).split(",").map(s => s.trim()).filter(Boolean))
        : [],
      modules_normalized: contractedModules,
      module_alerts: moduleAlerts,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});