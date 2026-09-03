import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Validar chave de API (header x-api-key)
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return Response.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const keys = await base44.asServiceRole.entities.PartnerApiKey.filter({ api_key: apiKey });
    const keyRecord = (keys || []).find((k: any) => k.active === true);
    if (!keyRecord) {
      return Response.json({ error: 'Invalid or inactive API key' }, { status: 401 });
    }

    // 2. Atualizar last_used_at / last_used_ip (fire-and-forget)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    base44.asServiceRole.entities.PartnerApiKey.update(keyRecord.id, {
      last_used_at: new Date().toISOString(),
      last_used_ip: clientIp,
    }).catch(() => {});

    // 3. Parse query params
    const url = new URL(req.url);
    const filterId = url.searchParams.get('id');
    const filterCnpj = url.searchParams.get('cnpj');

    // 4. Consultar projetos acessíveis (origem != Pontotel)
    const projects = await base44.asServiceRole.entities.Project.list();
    const accessible = (projects || []).filter((p: any) => p.origin !== 'Pontotel');

    const formatProject = (p: any) => ({
      id: p.id,
      cnpj: p.cnpj || null,
      nome_cliente: p.client_name || null,
      origem: p.origin || null,
      status: p.status || null,
      data_prevista_encerramento: p.aligned_end_date || p.planned_end_date || null,
      gerente_projeto: (p.pontotel_manager_name || p.pontotel_manager_email)
        ? { nome: p.pontotel_manager_name || null, email: p.pontotel_manager_email || null }
        : null,
    });

    // 5. Retornar projeto único ou lista
    if (filterId) {
      const proj = accessible.find((p: any) => p.id === filterId);
      if (!proj) return Response.json({ error: 'Project not found' }, { status: 404 });
      return Response.json(formatProject(proj));
    }

    if (filterCnpj) {
      const clean = filterCnpj.replace(/\D/g, '');
      const proj = accessible.find((p: any) => (p.cnpj || '').replace(/\D/g, '') === clean);
      if (!proj) return Response.json({ error: 'Project not found' }, { status: 404 });
      return Response.json(formatProject(proj));
    }

    return Response.json(accessible.map(formatProject));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}