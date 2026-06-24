import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, client_email } = await req.json();
    if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

    // Generate a random token
    const token = crypto.randomUUID();

    // Check if a client rule already exists for this project
    const existing = await base44.entities.CalculationRule.filter({
      project_id,
      rule_type: 'client'
    });

    // Expira em 30 dias
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (existing.length > 0) {
      // Update existing client rule with new token and expiry
      await base44.entities.CalculationRule.update(existing[0].id, {
        client_token: token,
        client_token_expires_at: expiresAt,
        status: 'rascunho',
      });
    } else {
      // Get team rule to copy company_data (rule names, etc.)
      const teamRules = await base44.entities.CalculationRule.filter({
        project_id,
        rule_type: 'team'
      });

      const companyData = teamRules.length > 0 ? (teamRules[0].company_data || null) : null;

      // Create new client rule
      await base44.entities.CalculationRule.create({
        project_id,
        rule_type: 'client',
        client_token: token,
        client_token_expires_at: expiresAt,
        status: 'rascunho',
        current_step: 1,
        company_data: companyData,
      });
    }

    // Invite client email as "cliente" role so they get restricted access
    if (client_email) {
      try {
        await base44.users.inviteUser(client_email, "cliente");
      } catch (inviteErr) {
        // User may already exist or be invited — non-blocking
        console.log("Invite skipped:", inviteErr.message);
      }
    }

    return Response.json({ token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});