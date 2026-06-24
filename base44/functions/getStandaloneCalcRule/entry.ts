import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const rule = await base44.asServiceRole.entities.StandaloneCalcRule.get(id);
    if (!rule) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });

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