import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { client_name, client_email, cnpj } = await req.json();
    if (!client_name || !client_email) {
      return Response.json({ error: 'Nome e e-mail são obrigatórios' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const record = await base44.asServiceRole.entities.StandaloneCalcRule.create({
      client_name,
      client_email,
      cnpj: cnpj || undefined,
      status: 'preenchimento',
      current_step: 1,
      token: crypto.randomUUID(),
    });

    return Response.json({ id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});