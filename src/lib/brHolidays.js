// ============================================================
// FERIADOS NACIONAIS BRASILEIROS
// Fonte única de verdade (frontend). O backend (base44/functions/
// applyAgentScheduleSuggestion) mantém uma cópia sincronizada.
//
// Datas fixas são geradas por ano via loop; a Sexta-feira Santa é
// calculada dinamicamente via algoritmo de Páscoa (Meeus/Jones/Butcher).
// ============================================================

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function toISO(d) {
  return d.toISOString().substring(0, 10);
}

function goodFriday(year) {
  const easter = easterSunday(year);
  return toISO(new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000));
}

const FIXED_HOLIDAYS = [
  ["01", "01"], // Confraternização Universal
  ["04", "21"], // Tiradentes
  ["05", "01"], // Dia do Trabalho
  ["09", "07"], // Independência do Brasil
  ["10", "12"], // Nossa Senhora Aparecida
  ["11", "02"], // Finados
  ["11", "15"], // Proclamação da República
  ["12", "25"], // Natal
];

const START_YEAR = 2024;
const END_YEAR = 2035;

const BR_HOLIDAYS = new Set();
for (let y = START_YEAR; y <= END_YEAR; y++) {
  BR_HOLIDAYS.add(goodFriday(y));
  for (const [m, d] of FIXED_HOLIDAYS) {
    BR_HOLIDAYS.add(`${y}-${m}-${d}`);
  }
}

export { BR_HOLIDAYS, easterSunday, goodFriday };
export default BR_HOLIDAYS;