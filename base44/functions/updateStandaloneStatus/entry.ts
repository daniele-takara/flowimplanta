import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, status, reviewer_notes } = await req.json();
    if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 });

    const validStatuses = ['pendente', 'em_revisao', 'validado', 'concluido'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Status inválido' }, { status: 400 });
    }

    const payload = {
      status,
      reviewed_by: user.full_name,
      reviewed_at: new Date().toISOString(),
    };
    if (reviewer_notes !== undefined) payload.reviewer_notes = reviewer_notes;

    await base44.entities.StandaloneCalcRule.update(id, payload);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});