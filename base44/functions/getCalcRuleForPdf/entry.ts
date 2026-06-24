import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const rule = await base44.asServiceRole.entities.StandaloneCalcRule.get(id);
    if (!rule) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });

    const parseJSON = (val) => {
      if (!val) return {};
      try { return JSON.parse(val); } catch { return val; }
    };

    return Response.json({
      project: {
        client_name: rule.client_name,
      },
      companyData: parseJSON(rule.company_data),
      allStepData: {
        rule_configurations: parseJSON(rule.rule_configurations),
        overtime_rules: parseJSON(rule.overtime_rules),
        break_time_rules: parseJSON(rule.break_time_rules),
        night_shift_rules: parseJSON(rule.night_shift_rules),
        shift_12x36_rules: parseJSON(rule.shift_12x36_rules),
        sobreaviso_rules: parseJSON(rule.sobreaviso_rules),
        dsr_rules: parseJSON(rule.dsr_rules),
        bank_hours_rules: parseJSON(rule.bank_hours_rules),
        other_verbs_rules: parseJSON(rule.other_verbs_rules),
        timesheet_config: parseJSON(rule.timesheet_config),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});