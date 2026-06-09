import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(delayMs); continue; }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return {}; }
  }
  return {};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiToken = Deno.env.get("API_PIpedrive");
    if (!apiToken) return Response.json({ error: 'API_PIpedrive não configurado' }, { status: 500 });

    const baseV1 = "https://api.pipedrive.com/v1";
    const DEAL_ID = 10806;
    const MODULES_KEY = "a7cf0200e401a761fb5fff4f4122beb364de9adb";
    const SERVICES_KEY = "contracted_services"; // may not exist in pipedrive
    const CANAL_KEY = "64fcc82db764fdd7f6bbc3add7735d6751bb5935";

    // 1. Buscar deal
    const dealData = await fetchWithRetry(`${baseV1}/deals/${DEAL_ID}?api_token=${apiToken}`);
    if (!dealData.success || !dealData.data) {
      return Response.json({ error: 'Deal não encontrado' }, { status: 404 });
    }
    const deal = dealData.data;
    const orgId = deal.org_id?.value || deal.org_id;

    // 2. Buscar organização completa
    await sleep(300);
    const orgData = await fetchWithRetry(`${baseV1}/organizations/${orgId}?api_token=${apiToken}`);
    const org = orgData.data || null;

    // 3. Buscar campos da organização (para resolver enums/labels)
    await sleep(300);
    const orgFieldsData = await fetchWithRetry(`${baseV1}/organizationFields?api_token=${apiToken}&limit=500`);
    const orgFields = orgFieldsData.data || [];

    // 4. Buscar campos do deal (para resolver enums/labels)
    await sleep(300);
    const dealFieldsData = await fetchWithRetry(`${baseV1}/dealFields?api_token=${apiToken}&limit=500`);
    const dealFields = dealFieldsData.data || [];

    // Helper: resolver label de enum/set a partir do value
    function resolveEnumLabel(fields, key, value) {
      const field = fields.find(f => f.key === key);
      if (!field) return { label: null, options: null, field_type: 'unknown' };
      const options = field.options || [];
      if (!value) return { label: null, options: options.map(o => ({ id: o.id, label: o.label })), field_type: field.field_type };
      
      // set/enum: value pode ser "50" ou "50,51" (múltiplos)
      const ids = String(value).split(',').map(s => s.trim());
      const labels = ids.map(id => {
        const opt = options.find(o => String(o.id) === String(id));
        return opt ? opt.label : `ID:${id}`;
      });
      return { 
        label: labels.join(', '), 
        labels,
        options: options.map(o => ({ id: o.id, label: o.label })),
        field_type: field.field_type,
        raw_ids: ids
      };
    }

    // 5. Analisar campo de módulos na organização
    const modulesRaw = org?.[MODULES_KEY];
    const modulesOrgField = orgFields.find(f => f.key === MODULES_KEY);
    const modulesResolved = resolveEnumLabel(orgFields, MODULES_KEY, modulesRaw);

    // 6. Verificar também se há campo de módulos no DEAL
    const modulesInDeal = deal[MODULES_KEY];
    const canalInOrg = org?.[CANAL_KEY];
    const canalInDeal = deal[CANAL_KEY];

    // 7. Todos os campos customizados da organização com valor não-null
    const orgCustomFields = {};
    Object.entries(org || {}).forEach(([k, v]) => {
      if (k.length === 40 && v !== null && v !== undefined && v !== '') {
        const field = orgFields.find(f => f.key === k);
        orgCustomFields[k] = {
          label: field?.name || '(unknown)',
          field_type: field?.field_type || 'unknown',
          raw_value: v,
          options_count: (field?.options || []).length,
        };
      }
    });

    // 8. Projeto Base44 vinculado
    const projects = await base44.asServiceRole.entities.Project.filter({ pipedrive_deal_id: 10806 });
    const project = projects[0] || null;

    // 9. ScopeItems existentes (apenas contagem por seção)
    let scopeSummary = [];
    if (project?.id) {
      const items = await base44.asServiceRole.entities.ScopeItem.filter({ project_id: project.id });
      const bySection = {};
      items.forEach(i => {
        bySection[i.section] = (bySection[i.section] || 0) + 1;
      });
      scopeSummary = Object.entries(bySection).map(([section, count]) => ({ section, count }));
    }

    return Response.json({
      audit: {
        deal_id: DEAL_ID,
        deal_title: deal.title,
        deal_value: deal.value,
        pipeline_name: deal.pipeline_id,
        org_id: orgId,
        org_name: org?.name,
      },
      modules_field: {
        key: MODULES_KEY,
        found_in_org: MODULES_KEY in (org || {}),
        found_in_deal: MODULES_KEY in deal,
        org_field_name: modulesOrgField?.name || '(not found in orgFields)',
        org_field_type: modulesOrgField?.field_type || 'unknown',
        raw_value_in_org: modulesRaw,
        raw_value_in_deal: modulesInDeal,
        resolved_labels: modulesResolved.labels || [],
        resolved_string: modulesResolved.label,
        all_options: modulesResolved.options || [],
      },
      canal_field: {
        in_org: canalInOrg,
        in_deal: canalInDeal,
      },
      org_custom_fields_with_values: orgCustomFields,
      base44_project: project ? {
        id: project.id,
        name: project.name,
        contracted_modules_saved: project.contracted_modules,
        contracted_services_saved: project.contracted_services,
        origin: project.origin,
        status: project.status,
      } : null,
      scope_items_summary: scopeSummary,
      total_scope_items: scopeSummary.reduce((a, b) => a + b.count, 0),
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});