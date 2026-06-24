import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { id, ...data } = payload;
    if (!id) return Response.json({ error: 'ID required' }, { status: 400 });

    const base44 = createClientFromRequest(req);

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
    if (data.client_name !== undefined) updatePayload.client_name = data.client_name;
    if (data.client_email !== undefined) updatePayload.client_email = data.client_email;

    await base44.asServiceRole.entities.StandaloneCalcRule.update(id, updatePayload);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});