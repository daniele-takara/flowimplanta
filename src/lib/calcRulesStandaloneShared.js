// ── Shared constants for Standalone Calculation Rules Wizard (Morfeu) ────────────
// Forked from calcRulesShared.js — edit freely without affecting project rules.

export const STEPS = [
  { id: 1, title: "Dados da Empresa", key: "company_data" },
  { id: 2, title: "Configuração das Regras", key: "rule_configurations" },
  { id: 3, title: "Horas Extras", key: "overtime_rules" },
  { id: 4, title: "Intervalos", key: "break_time_rules" },
  { id: 5, title: "Adicional Noturno", key: "night_shift_rules" },
  { id: 6, title: "Jornada 12x36", key: "shift_12x36_rules" },
  { id: 7, title: "Sobreaviso", key: "sobreaviso_rules" },
  { id: 8, title: "DSR / Feriados", key: "dsr_rules" },
  { id: 9, title: "Banco de Horas", key: "bank_hours_rules" },
  { id: 10, title: "Outras Verbas", key: "other_verbs_rules" },
  { id: 11, title: "Revisão Final", key: null },
];

export const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
export const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
export const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export const FATORES_OPTIONS = [
  { key: "hora_extra", label: "Hora Extra (jornada com presença obrigatória)" },
  { key: "hora_extra_extraordinaria", label: "Hora Extra Extraordinária (sem jornada esperada – folga/feriado)" },
  { key: "hora_extra_especial", label: "Hora Extra Especial" },
  { key: "atraso", label: "Atraso" },
  { key: "saida_antecipada", label: "Saída Antecipada" },
  { key: "excesso_pausa", label: "Excesso de Pausa" },
  { key: "falta", label: "Falta" },
];

export const APONTAMENTO_OPTIONS = [
  { value: "baixa_negativa", label: "Baixa Negativa", desc: "Registro de horas descontadas do banco de horas sendo negativa ( cliente precisa pagar o empregado)" },
  { value: "baixa_parcial_negativa", label: "Baixa Parcial Negativa", desc: "Registro parcial de horas descontadas do banco de horas, semelhante às baixas negativa, mas realizadas de forma fracionada." },
  { value: "baixa_parcial_positiva", label: "Baixa Parcial Positiva", desc: "Registro parcial de horas descontadas do banco de horas, semelhante às baixas positivas, mas realizadas de forma fracionada." },
  { value: "baixa_positiva", label: "Baixa Positiva", desc: "Registro de horas descontadas do banco de horas sendo positiva (cliente precisa descontar o empregado)" },
  { value: "outra_forma", label: "Outra forma de baixa", desc: "Permite personalizar uma forma específica de baixa não listada nas opções padrões" },
];