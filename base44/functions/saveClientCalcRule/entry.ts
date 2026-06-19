import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { token, ...data } = payload;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const base44 = createClientFromRequest(req);

    const rules = await base44.asServiceRole.entities.CalculationRule.filter({ client_token: token });
    if (!rules.length) return Response.json({ error: 'Link inválido ou expirado' }, { status: 404 });

    const rule = rules[0];

    // Build update payload — only send fields that are provided
    const updatePayload = {};
    const stepKeys = [
      'company_data', 'rule_configurations', 'overtime_rules',
      'break_time_rules', 'night_shift_rules', 'shift_12x36_rules',
      'sobreaviso_rules', 'bank_hours_rules', 'dsr_rules', 'other_verbs_rules'
    ];
    stepKeys.forEach(k => {
      if (data[k] !== undefined) updatePayload[k] = typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k];
    });
    if (data.current_step !== undefined) updatePayload.current_step = data.current_step;
    if (data.status !== undefined) updatePayload.status = data.status;

    await base44.asServiceRole.entities.CalculationRule.update(rule.id, updatePayload);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});