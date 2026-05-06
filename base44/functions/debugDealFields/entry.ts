import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Diagnóstico: encontra hashes de funcionários contratados e MRR na organização do deal.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const { deal_id } = body;
  if (!deal_id) return Response.json({ error: 'deal_id obrigatório' }, { status: 400 });

  const apiToken = Deno.env.get("API_PIpedrive");
  const baseV1 = "https://api.pipedrive.com/v1";

  const dealRes = await fetch(`${baseV1}/deals/${deal_id}?api_token=${apiToken}`);
  const deal = (await dealRes.json()).data || {};

  const orgId = deal.org_id?.value || deal.org_id;
  let org = {};
  if (orgId) {
    const orgRes = await fetch(`${baseV1}/organizations/${orgId}?api_token=${apiToken}`);
    org = (await orgRes.json()).data || {};
  }

  const orgFieldsRes = await fetch(`${baseV1}/organizationFields?api_token=${apiToken}&limit=500`);
  const orgFields = (await orgFieldsRes.json()).data || [];

  // Tudo que pode ser funcionários ou MRR (por label)
  const relevantOrgFields = orgFields.map(f => ({
    key: f.key,
    label: f.name,
    field_type: f.field_type,
    value: org[f.key] ?? null,
  })).filter(f =>
    /func|empregad|colabor|headcount|employee|mrr|mensalidad|receita|fatura|contrat|assinant|ticket|porte|tamanh/i.test(f.label)
    || (f.value != null && f.value !== '' && f.key.length > 20)
  );

  // Também listar todos os campos da org com valor não nulo
  const orgWithValues = orgFields
    .filter(f => org[f.key] != null && org[f.key] !== '')
    .map(f => ({ key: f.key, label: f.name, field_type: f.field_type, value: org[f.key] }));

  return Response.json({
    deal_id,
    org_id: orgId,
    org_name: org.name,
    relevant_fields: relevantOrgFields,
    all_org_fields_with_value: orgWithValues,
  });
});