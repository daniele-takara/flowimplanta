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

    const normName = (s: string): string =>
      (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

    const emailIndex: Record<string, any[]> = {};
    for (const u of users || []) {
      const email = (u.email || "").trim().toLowerCase();
      if (!email) continue;
      if (!emailIndex[email]) emailIndex[email] = [];
      emailIndex[email].push(u);
    }

    // ── Índice de usuários por nome normalizado (para matching por nome) ──
    const nameIndex: Record<string, any[]> = {};
    for (const u of users || []) {
      const n = normName(u.full_name);
      if (!n) continue;
      if (!nameIndex[n]) nameIndex[n] = [];
      nameIndex[n].push(u);
    }

    // Resolve um User pelo nome: match exato primeiro, depois parcial (substring)
    function resolveByName(name: string): any | null {
      if (!name) return null;
      const normN = normName(name);
      if (!normN) return null;
      // 1. Match exato normalizado
      const exact = nameIndex[normN] || [];
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) return null; // ambíguo
      // 2. Match parcial: name é substring do full_name (ex: "Felipe" → "Felipe Chaves")
      const partial = (users || []).filter(u => {
        const normFull = normName(u.full_name);
        return normFull.includes(normN) && normN.length >= 3;
      });
      if (partial.length === 1) return partial[0];
      return null;
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
      let managerMatched: any = null;
      let managerMatchMethod = "";
      const mgrEmail = (p.pontotel_manager_email || "").trim().toLowerCase();
      if (mgrEmail) {
        const candidates = emailIndex[mgrEmail] || [];
        if (candidates.length === 1) {
          managerMatched = candidates[0];
          managerMatchMethod = "email";
        } else if (candidates.length > 1) {
          managerAmbiguous.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_manager_email,
            candidates: candidates.map((c: any) => ({ id: c.id, full_name: c.full_name })),
          });
        }
        // if candidates.length === 0, fall through to name matching
      }
      if (!managerMatched && p.pontotel_manager_name) {
        const matched = resolveByName(p.pontotel_manager_name);
        if (matched) {
          managerMatched = matched;
          managerMatchMethod = "name";
        } else {
          managerNoMatch.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_manager_email || "",
            reason: mgrEmail ? "E-mail não encontrado e nome ambíguo ou sem match" : "Sem e-mail e nome não corresponde a nenhum User único",
          });
        }
      }
      if (managerMatched) {
        managerMatches.push({
          project_id: p.id, project_name: p.name,
          email: managerMatched.email, user_id: managerMatched.id, user_name: managerMatched.full_name,
          match_method: managerMatchMethod,
        });
        if (!dryRun && p.pontotel_manager_id !== managerMatched.id) {
          const payload: any = { pontotel_manager_id: managerMatched.id };
          if (managerMatched.email && !p.pontotel_manager_email) payload.pontotel_manager_email = managerMatched.email;
          // Normaliza o nome para o full_name canônico do User
          if (managerMatched.full_name && p.pontotel_manager_name !== managerMatched.full_name) {
            payload.pontotel_manager_name = managerMatched.full_name;
          }
          const existing = toUpdate.find((t) => t.id === p.id);
          if (existing) Object.assign(existing, payload);
          else toUpdate.push({ id: p.id, ...payload });
        }
      }

      // ── Analista ──
      let analystMatched: any = null;
      let analystMatchMethod = "";
      const anaEmail = (p.pontotel_analyst_email || "").trim().toLowerCase();
      if (anaEmail) {
        const candidates = emailIndex[anaEmail] || [];
        if (candidates.length === 1) {
          analystMatched = candidates[0];
          analystMatchMethod = "email";
        } else if (candidates.length > 1) {
          analystAmbiguous.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_analyst_email,
            candidates: candidates.map((c: any) => ({ id: c.id, full_name: c.full_name })),
          });
        }
      }
      if (!analystMatched && p.pontotel_analyst_name) {
        const matched = resolveByName(p.pontotel_analyst_name);
        if (matched) {
          analystMatched = matched;
          analystMatchMethod = "name";
        } else {
          analystNoMatch.push({
            project_id: p.id, project_name: p.name, email: p.pontotel_analyst_email || "",
            reason: anaEmail ? "E-mail não encontrado e nome ambíguo ou sem match" : "Sem e-mail e nome não corresponde a nenhum User único",
          });
        }
      }
      if (analystMatched) {
        analystMatches.push({
          project_id: p.id, project_name: p.name,
          email: analystMatched.email, user_id: analystMatched.id, user_name: analystMatched.full_name,
          match_method: analystMatchMethod,
        });
        if (!dryRun && p.pontotel_analyst_id !== analystMatched.id) {
          const payload: any = { pontotel_analyst_id: analystMatched.id };
          if (analystMatched.email && !p.pontotel_analyst_email) payload.pontotel_analyst_email = analystMatched.email;
          if (analystMatched.full_name && p.pontotel_analyst_name !== analystMatched.full_name) {
            payload.pontotel_analyst_name = analystMatched.full_name;
          }
          const existing = toUpdate.find((t) => t.id === p.id);
          if (existing) Object.assign(existing, payload);
          else toUpdate.push({ id: p.id, ...payload });
        }
      }
    }

    // ── Aplica as atualizações (apenas em modo apply) ──
    let updatedCount = 0;
    if (!dryRun) {
      for (const upd of toUpdate) {
        if (Object.keys(upd).length > 1) { // mais que apenas {id}
          const { id, ...payload } = upd;
          await base44.asServiceRole.entities.Project.update(id, payload);
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