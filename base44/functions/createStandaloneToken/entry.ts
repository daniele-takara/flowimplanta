import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = crypto.randomUUID();

    await base44.entities.StandaloneCalcRule.create({
      token,
      client_name: '',
      client_email: '',
      status: 'pendente',
      current_step: 1,
    });

    return Response.json({ token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});