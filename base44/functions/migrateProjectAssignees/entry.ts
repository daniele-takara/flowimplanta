import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const dryRun = body?.dry_run !== false;

    // ── Backup completo dos projetos (snapshot antes de qualquer alteração) ──
    const projects = await base44.asServiceRole.entities.Project.list();
    const backup = projects.map((p: any) => ({ ...p }));

    // ── Índice de usuários por e-mail (case-insensitive, trim) ──
    const users = await base44.asServiceRole.entities.User.list();
    const emailIndex: Record<string, any[]> = {};
    for (const u of users || []) {
      const email = (u.email || "").trim().toLowerCase();
      if (!email) continue;
      if (!emailIndex[email]) emailIndex[email] = [];
      emailIndex[email].push(u);
    }

    const managerMatches: any[] = [];
    const analystMatches: any[] = [];
    const managerNoMatch: any[] = [];
    const analystNoMatch: any[] = [];
    const managerAmbiguous: any[] = [];
    const analystAmbiguous: any[] = [];

    const toUpdate: any[] = [];

    for (const p of projects || []) {
      // ── Gerente ──
      const mgrEmail = (p.pontotel_manager_email || "").trim().toLowerCase();
      if (mgrEmail) {
        const candidates = emailIndex[mgrEmail] || [];
        if (candidates.length === 1) {
          managerMatches.push({
            project_id: p.id, project_name: p.name,
            email: p.pontotel_manager_email, user_id: candidates[0].id, user_name: candidates[0].full_name,
          });
          if (!dryRun && p.pontotel_manager_id !== candidates[0].id) {
            toUpdate.push({ id: p.id, pontotel_manager_id: candidates[0].id });
          }
        } else if (candidates.length > 1) {
          managerAmbiguous.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_manager_email,
            candidates: candidates.map((c: any) => ({ id: c.id, full_name: c.full_name })),
          });
        } else {
          managerNoMatch.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_manager_email, reason: "E-mail não encontrado em nenhum User",
          });
        }
      } else if (p.pontotel_manager_name) {
        managerNoMatch.push({
          project_id: p.id, project_name: p.name, email: "", reason: "Sem e-mail preenchido (apenas nome em texto)",
        });
      }

      // ── Analista ──
      const anaEmail = (p.pontotel_analyst_email || "").trim().toLowerCase();
      if (anaEmail) {
        const candidates = emailIndex[anaEmail] || [];
        if (candidates.length === 1) {
          analystMatches.push({
            project_id: p.id, project_name: p.name,
            email: p.pontotel_analyst_email, user_id: candidates[0].id, user_name: candidates[0].full_name,
          });
          if (!dryRun && p.pontotel_analyst_id !== candidates[0].id) {
            // Acumula no mesmo registro se já existir um update de gerente para este projeto
            const existing = toUpdate.find((t) => t.id === p.id);
            if (existing) existing.pontotel_analyst_id = candidates[0].id;
            else toUpdate.push({ id: p.id, pontotel_analyst_id: candidates[0].id });
          }
        } else if (candidates.length > 1) {
          analystAmbiguous.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_analyst_email,
            candidates: candidates.map((c: any) => ({ id: c.id, full_name: c.full_name })),
          });
        } else {
          analystNoMatch.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_analyst_email, reason: "E-mail não encontrado em nenhum User",
          });
        }
      } else if (p.pontotel_analyst_name) {
        analystNoMatch.push({
          project_id: p.id, project_name: p.name, email: "", reason: "Sem e-mail preenchido (apenas nome em texto)",
        });
      }
    }

    // ── Aplica as atualizações (apenas em modo apply) ──
    let updatedCount = 0;
    if (!dryRun) {
      for (const upd of toUpdate) {
        const payload: any = {};
        if (upd.pontotel_manager_id) payload.pontotel_manager_id = upd.pontotel_manager_id;
        if (upd.pontotel_analyst_id) payload.pontotel_analyst_id = upd.pontotel_analyst_id;
        if (Object.keys(payload).length > 0) {
          await base44.asServiceRole.entities.Project.update(upd.id, payload);
          updatedCount++;
        }
      }
    }

    return Response.json({
      dry_run: dryRun,
      applied: !dryRun,
      total_projects: (projects || []).length,
      backup,
      summary: {
        manager_auto_match: managerMatches.length,
        analyst_auto_match: analystMatches.length,
        manager_no_match: managerNoMatch.length,
        analyst_no_match: analystNoMatch.length,
        manager_ambiguous: managerAmbiguous.length,
        analyst_ambiguous: analystAmbiguous.length,
        updated_projects: updatedCount,
      },
      manager_matches: managerMatches,
      analyst_matches: analystMatches,
      manager_no_match: managerNoMatch,
      analyst_no_match: analystNoMatch,
      manager_ambiguous: managerAmbiguous,
      analyst_ambiguous: analystAmbiguous,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}