// Validações por passo do Wizard Morfeu (StandaloneCalcWizard)
// Retorna array de strings com o que está faltando, ou [] se tudo OK.

export function validateStep(stepKey, stepData) {
  switch (stepKey) {
    case "company_data":      return validateCompanyData(stepData.company_data);
    case "rule_configurations": return validateRuleConfigurations(stepData);
    case "overtime_rules":    return validateOvertimeRules(stepData);
    case "break_time_rules":  return validateBreakTimeRules(stepData);
    case "bank_hours_rules":  return validateBankHoursRules(stepData);
    default:                  return [];
  }
}

// ── Passo 1: Dados da Empresa ──────────────────────────────────────────────────
function validateCompanyData(cd = {}) {
  const errors = [];
  if (!cd.responsibleName?.trim())
    errors.push("Nome do responsável pelas regras");
  if (!(cd.aparelho_registro?.length > 0))
    errors.push("Aparelho utilizado para registro de ponto (selecione ao menos um)");
  if (!cd.rulesNames?.length)
    errors.push("Pelo menos uma Regra de Cálculo deve ser adicionada");
  return errors;
}

// ── Passo 2: Configuração das Regras ──────────────────────────────────────────
function validateRuleConfigurations(stepData) {
  const rules = stepData.company_data?.rulesNames || [];
  const d = stepData.rule_configurations || {};
  const errors = [];

  for (const name of rules) {
    const val = d[name] || {};
    const inhLocked = ("_inheritingFrom" in val) && !!val._inheritingFrom;
    if (inhLocked) continue;

    if (!val.model)
      errors.push(`${name}: selecione o Modelo (Fixo ou Flexível)`);

    if (val.model === "Fixo") {
      if (val.entradaToleranciaAtraso === "" || val.entradaToleranciaAtraso === undefined)
        errors.push(`${name}: Tolerância Atraso Entrada`);
      if (val.saidaToleranciaAntecipada === "" || val.saidaToleranciaAntecipada === undefined)
        errors.push(`${name}: Tolerância Antecipação Saída`);
      if (val.entradaToleranciaExtra === "" || val.entradaToleranciaExtra === undefined)
        errors.push(`${name}: Tolerância Extra Entrada`);
      if (val.saidaToleranciaExtra === "" || val.saidaToleranciaExtra === undefined)
        errors.push(`${name}: Tolerância Extra Saída`);
    }

    if (val.model === "Flexível") {
      if (val.janelaAntes === "" || val.janelaAntes === undefined)
        errors.push(`${name}: Tolerância para cálculo de hora extra`);
      if (val.janelaDepois === "" || val.janelaDepois === undefined)
        errors.push(`${name}: Tolerância para cálculo de atraso`);
    }
  }
  return errors;
}

// ── Passo 3: Horas Extras ─────────────────────────────────────────────────────
function validateOvertimeRules(stepData) {
  const rules = stepData.company_data?.rulesNames || [];
  const d = stepData.overtime_rules || {};
  const errors = [];

  for (const name of rules) {
    const val = d[name] || {};
    const inhLocked = ("_inheritingFrom" in val) && !!val._inheritingFrom;
    if (inhLocked) continue;

    // "custom" percentuals require a value
    const percKeys = ["percDiasComuns", "percSabado", "percDomingo", "percFeriado"];
    for (const k of percKeys) {
      if ((val[k] || "50") === "custom" && !(val[k + "Custom"] + "").trim())
        errors.push(`${name}: valor personalizado para ${k.replace("perc", "% ").replace(/([A-Z])/g, " $1").trim()}`);
    }
  }
  return errors;
}

// ── Passo 4: Intervalos ───────────────────────────────────────────────────────
function validateBreakTimeRules(stepData) {
  const rules = stepData.company_data?.rulesNames || [];
  const d = stepData.break_time_rules || {};
  const errors = [];

  for (const name of rules) {
    const val = d[name] || {};
    const inhLocked = ("_inheritingFrom" in val) && !!val._inheritingFrom;
    if (inhLocked) continue;

    if (val.toleranciaPausaRefeicao === "" || val.toleranciaPausaRefeicao === undefined)
      errors.push(`${name}: Tolerância para duração da pausa refeição`);
    if (val.toleranciaPausaExcesso === "" || val.toleranciaPausaExcesso === undefined)
      errors.push(`${name}: Tolerância para duração de pausa em excesso`);
  }
  return errors;
}

// ── Passo 8: Banco de Horas ───────────────────────────────────────────────────
// (já existia validateBancoHoras no wizard, mas unificamos aqui)
import { FATORES_OPTIONS } from "@/lib/calcRulesShared";

function validateBankHoursRules(stepData) {
  const rules = stepData.company_data?.rulesNames || [];
  const d = stepData.bank_hours_rules || {};
  const errors = [];

  for (const name of rules) {
    const val = d[name] || {};
    const inhLocked = ("_inheritingFrom" in val) && !!val._inheritingFrom;
    if (inhLocked) continue;

    const fatores = val.fatoresTransformacao || [];
    for (const f of fatores) {
      if (f.ativo && !f.fator) {
        const label = FATORES_OPTIONS.find(opt => opt.key === f.key)?.label || f.key;
        errors.push(`${name}: fator de transformação para "${label}"`);
      }
    }
  }
  return errors;
}