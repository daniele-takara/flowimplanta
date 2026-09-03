// ── Shared Pipedrive utilities used by syncPipedriveData and importSankhyaProjects ──

export const OFFICIAL_MODULES = [
  "Registro de Ponto",
  "Redução de Riscos no Registro",
  "Cálculos e Tratamento",
  "Gestão de Ponto Participativa",
  "Controle de Custos",
  "Gestão de Férias e Ausências",
  "Timesheet",
];

export const MODULE_ALIASES = {
  "ponto eletronico": "Registro de Ponto",
  "ponto eletrônico": "Registro de Ponto",
  "registro ponto": "Registro de Ponto",
  "ponto": "Registro de Ponto",
  "reducao de riscos": "Redução de Riscos no Registro",
  "reducao riscos registro": "Redução de Riscos no Registro",
  "calculos e fechamento": "Cálculos e Tratamento",
  "calculos fechamento": "Cálculos e Tratamento",
  "calculo e tratamento": "Cálculos e Tratamento",
  "calculo e fechamento": "Cálculos e Tratamento",
  "banco de horas": "Cálculos e Tratamento",
  "tratamento de ponto": "Cálculos e Tratamento",
  "gestao participativa": "Gestão de Ponto Participativa",
  "ponto participativo": "Gestão de Ponto Participativa",
  "controle custos": "Controle de Custos",
  "custos": "Controle de Custos",
  "gestao de ferias": "Gestão de Férias e Ausências",
  "ferias e ausencias": "Gestão de Férias e Ausências",
  "ferias": "Gestão de Férias e Ausências",
  "gestao ferias": "Gestão de Férias e Ausências",
};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchWithRetry(url: string, retries = 3, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(delayMs); continue; }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return {}; }
  }
  return {};
}

export function extractDate(val: any): string {
  if (!val) return "";
  return String(val).substring(0, 10);
}

export function normalizeField(val: any): string {
  if (!val) return "";
  if (typeof val === "object" && val.name) return val.name;
  return String(val).trim();
}

export function normalizeOrigin(val: string): string {
  const map: Record<string, string> = {
    "pontotel": "Pontotel",
    "parceiro": "Parceiro",
    "indicação": "Indicação", "indicacao": "Indicação",
    "inbound": "Inbound",
    "outbound": "Outbound",
    "sankhya": "Parceiro",
  };
  return map[(val || "").toLowerCase().trim()] || "";
}

export function norm(s: string): string {
  return (s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(s: string): string {
  return (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function resolveModule(raw: string): { canonical: string | null; isAlias: boolean; isUnknown: boolean } {
  const key = norm(raw);
  const exact = OFFICIAL_MODULES.find(m => norm(m) === key);
  if (exact) return { canonical: exact, isAlias: false, isUnknown: false };
  const alias = (MODULE_ALIASES as Record<string, string>)[key];
  if (alias) return { canonical: alias, isAlias: true, isUnknown: false };
  return { canonical: null, isAlias: false, isUnknown: true };
}

export function parseList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(m => normalizeField(m)).filter(Boolean);
  return String(raw).split(",").map(s => s.trim()).filter(Boolean);
}

export function resolveUserByName(
  name: string,
  allUsers: any[]
): { id: string; email: string; full_name: string } | null {
  if (!name) return null;
  const normN = normalizeName(name);
  if (!normN) return null;
  const exact = (allUsers || []).filter(u => normalizeName(u.full_name) === normN);
  if (exact.length === 1) return { id: exact[0].id, email: exact[0].email, full_name: exact[0].full_name };
  if (exact.length > 1) return null;
  const partial = (allUsers || []).filter(u => {
    const normFull = normalizeName(u.full_name);
    return normFull.includes(normN) && normN.length >= 3;
  });
  if (partial.length === 1) return { id: partial[0].id, email: partial[0].email, full_name: partial[0].full_name };
  return null;
}