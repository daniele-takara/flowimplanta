import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Exclusão segura de projeto com validação de permissão no backend.
 * Apenas usuários com role=admin ou com permissão projetos_excluir no perfil podem excluir.
 * NÃO afeta dados no Pipedrive.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { project_id } = body;
    if (!project_id) return Response.json({ error: 'project_id é obrigatório' }, { status: 400 });

    // ── Verificar permissão de exclusão ──────────────────────────────────────
    // Admin de sistema → sempre pode
    const isSystemAdmin = user.role === 'admin';

    // Usuário com perfil → verificar permissão no perfil
    let canDelete = isSystemAdmin;
    if (!isSystemAdmin && user.permission_profile_id) {
      try {
        const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({
          id: user.permission_profile_id,
        });
        const profile = profiles?.[0];
        if (profile?.permissions?.projetos_excluir === true) {
          canDelete = true;
        }
      } catch (e) {
        // Se não conseguir resolver o perfil, nega
        canDelete = false;
      }
    }

    if (!canDelete) {
      return Response.json(
        { error: 'Sem permissão para excluir projetos' },
        { status: 403 }
      );
    }

    // ── Cascata: excluir todas as entidades relacionadas ao projeto ──────────
    // Cada deleteMany filtra por project_id; se uma entidade não tiver registros,
    // o filtro simplesmente não casa nada. Feito em paralelo para velocidade.
    const cascadeEntities = [
      'ScheduleActivity',
      'LocalSchedulePhase',
      'SchedulePhaseOverride',
      'SchedulePhase',
      'ActionPlan',
      'Meeting',
      'ProjectTeamMember',
      'AuditLog',
      'ProjectDocument',
      'ClientUsability',
      'CalculationRule',
    ];
    const cascadeResults = await Promise.allSettled(
      cascadeEntities.map(name =>
        base44.asServiceRole.entities[name].deleteMany({ project_id })
      )
    );
    const cascadeFailures = cascadeResults
      .map((r, i) => r.status === 'rejected' ? `${cascadeEntities[i]}: ${r.reason?.message || r.reason}` : null)
      .filter(Boolean);

    // ── Excluir o projeto — NÃO afeta Pipedrive ─────────────────────────────
    // O SDK lança exceção se não encontrar; capturada pelo catch externo
    await base44.asServiceRole.entities.Project.delete(project_id);

    return Response.json({
      success: true,
      deleted_project_id: project_id,
      cascade_deleted: cascadeEntities,
      cascade_failures: cascadeFailures,
      message: 'Projeto e dados relacionados excluídos com sucesso. O deal no Pipedrive não foi afetado.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});