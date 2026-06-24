import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, status, reviewer_notes, empresa_id, implantacao_user_id, implantacao_user_name } = await req.json();
    if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 });

    const validStatuses = ['pendente', 'em_revisao', 'validado', 'concluido'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Status inválido' }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities.StandaloneCalcRule.get(id);
    if (!record) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });

    const isAdvancing = validStatuses.indexOf(status) > validStatuses.indexOf(record.status);

    // Ao avançar (qualquer transição para frente), validar campos obrigatórios
    if (isAdvancing) {
      const effectiveEmpresaId = empresa_id ?? record.empresa_id;
      const effectiveUserId = implantacao_user_id ?? record.implantacao_user_id;

      if (!effectiveEmpresaId || !effectiveEmpresaId.trim()) {
        return Response.json({ error: 'Preencha o ID do cliente antes de avançar.' }, { status: 400 });
      }
      if (!effectiveUserId) {
        return Response.json({ error: 'Selecione o usuário de implantação antes de avançar.' }, { status: 400 });
      }
    }

    const payload = {
      status,
      reviewed_by: user.full_name,
      reviewed_at: new Date().toISOString(),
    };
    if (reviewer_notes !== undefined) payload.reviewer_notes = reviewer_notes;
    if (empresa_id !== undefined) payload.empresa_id = empresa_id;
    if (implantacao_user_id !== undefined) {
      payload.implantacao_user_id = implantacao_user_id;
      payload.implantacao_user_name = implantacao_user_name || '';
    }

    await base44.asServiceRole.entities.StandaloneCalcRule.update(id, payload);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});