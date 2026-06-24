import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar perfil "Implantação"
    const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({ name: "Implantação" });
    if (!profiles || profiles.length === 0) {
      return Response.json([]);
    }
    const implantacaoProfileId = profiles[0].id;

    // Buscar usuários com esse perfil
    const users = await base44.asServiceRole.entities.User.list();
    const implantacaoUsers = (users || []).filter(
      u => u.permission_profile_id === implantacaoProfileId
    ).map(u => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
    }));

    return Response.json(implantacaoUsers);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});