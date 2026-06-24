import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const rules = await base44.asServiceRole.entities.StandaloneCalcRule.filter({ token });
    if (!rules.length) return Response.json({ error: 'Link inválido' }, { status: 404 });

    const rule = rules[0];

    return Response.json({
      id: rule.id,
      client_name: rule.client_name,
      client_email: rule.client_email,
      status: rule.status,
      current_step: rule.current_step,
      company_data: rule.company_data,
      rule_configurations: rule.rule_configurations,
      overtime_rules: rule.overtime_rules,
      break_time_rules: rule.break_time_rules,
      night_shift_rules: rule.night_shift_rules,
      shift_12x36_rules: rule.shift_12x36_rules,
      sobreaviso_rules: rule.sobreaviso_rules,
      bank_hours_rules: rule.bank_hours_rules,
      dsr_rules: rule.dsr_rules,
      other_verbs_rules: rule.other_verbs_rules,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});