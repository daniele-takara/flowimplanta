import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.PermissionProfile.list();
    const managerProfile = (profiles || []).find((p: any) => p.name === "Gestor de Projetos");
    const analystProfile = (profiles || []).find((p: any) => p.name === "Implantação");

    const users = await base44.asServiceRole.entities.User.list();

    const managers = (users || [])
      .filter((u: any) => managerProfile && u.permission_profile_id === managerProfile.id)
      .map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }))
      .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

    const analysts = (users || [])
      .filter((u: any) => analystProfile && u.permission_profile_id === analystProfile.id)
      .map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }))
      .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

    return Response.json({ managers, analysts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}