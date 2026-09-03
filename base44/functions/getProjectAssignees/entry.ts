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
    const projects = await base44.asServiceRole.entities.Project.list();

    // Mapa de nomes "corrigidos" por userId, vindos dos projetos.
    // full_name do usuário pode ser um username (ex: "joao.barbosa") capturado no
    // primeiro login e não re-sincronizado do Google. Preferimos o nome real
    // preenchido no projeto (pontotel_manager_name / pontotel_analyst_name).
    const looksLikeUsername = (s: any) => {
      if (!s || typeof s !== "string") return true;
      const t = s.trim();
      if (!t) return true;
      // sem espaços e com ponto/arroba => username/email
      return !t.includes(" ") && (t.includes(".") || t.includes("@"));
    };
    const pickName = (userId: any, fallback: string, field: "pontotel_manager_name" | "pontotel_analyst_name") => {
      const candidates = (projects || [])
        .filter((p: any) => p[`${field.replace("_name", "_id")}`] === userId)
        .map((p: any) => p[field])
        .filter(Boolean);
      const real = candidates.find((n: string) => !looksLikeUsername(n));
      return real || fallback;
    };

    const managers = (users || [])
      .filter((u: any) => managerProfile && u.permission_profile_id === managerProfile.id)
      .map((u: any) => ({ id: u.id, full_name: pickName(u.id, u.full_name, "pontotel_manager_name"), email: u.email }))
      .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

    const analysts = (users || [])
      .filter((u: any) => analystProfile && u.permission_profile_id === analystProfile.id)
      .map((u: any) => ({ id: u.id, full_name: pickName(u.id, u.full_name, "pontotel_analyst_name"), email: u.email }))
      .sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));

    return Response.json({ managers, analysts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}