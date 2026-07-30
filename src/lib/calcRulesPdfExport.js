import { jsPDF } from "jspdf";

// ── Pontotel brand colors ─────────────────────────────────────────────────────
const PURPLE   = [121, 40, 135];   // #792887
const YELLOW   = [240, 185, 11];   // #F0B90B
const PURPLE_LIGHT = [180, 130, 195]; // row alt
const ROW_PURPLE = [140, 82, 153]; // label cell bg
const ROW_WHITE  = [255, 255, 255];
const ROW_LIGHT  = [245, 240, 247]; // alt row
const TEXT_WHITE = [255, 255, 255];
const TEXT_DARK  = [40, 20, 50];
const TEXT_GRAY  = [120, 100, 130];

const LOGO_URL = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png";

const M  = 14;        // left/right margin
const PW = 182;       // page width usable
const PAGE_H = 297;
const FOOTER_H = 12;
const COL1 = 84;      // label column width
const COL2 = PW - COL1;

function fmt(d) {
  if (!d) return "—";
  return d.substring(8,10)+"/"+d.substring(5,7)+"/"+d.substring(0,4);
}

export async function generateCalcRulesPDF({ project, companyData, allStepData }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const clientName = project?.client_name || "Cliente";
  const today = new Date().toLocaleDateString("pt-BR");
  const rulesNames = companyData?.rulesNames || [];

  // ── Load logo ─────────────────────────────────────────────────────────────
  let logoDataUrl = null;
  try {
    const r = await fetch(LOGO_URL);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let b = "";
      for (let i = 0; i < bytes.length; i += 8192)
        b += String.fromCharCode(...bytes.slice(i, i + 8192));
      logoDataUrl = `data:image/png;base64,${btoa(b)}`;
    }
  } catch (_) {}

  let y = 0;
  let pageNum = 1;
  let totalPages = 1; // placeholder; we'll patch at the end

  // ── Page header ──────────────────────────────────────────────────────────
  function drawPageHeader() {
    // Purple top bar
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, 210, 18, "F");
    // Yellow accent line
    doc.setFillColor(...YELLOW);
    doc.rect(0, 18, 210, 2.5, "F");
    // Logo on header
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", M + PW - 30, 3, 30, 10);
    }
    // Title text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_WHITE);
    doc.text("PONTOTEL - Configurações de Regras Trabalhistas", M, 12);
    y = 28;
  }

  // ── Page footer ──────────────────────────────────────────────────────────
  function drawPageFooter(pn) {
    const fy = PAGE_H - FOOTER_H;
    doc.setDrawColor(...PURPLE_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, fy, M + PW, fy);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${today}`, M, fy + 5);
    doc.text(`Página ${pn}`, M + PW / 2, fy + 5, { align: "center" });
    doc.text(clientName, M + PW, fy + 5, { align: "right" });
    // Bottom purple + yellow bar
    doc.setFillColor(...PURPLE);
    doc.rect(0, PAGE_H - 5, 210, 5, "F");
    doc.setFillColor(...YELLOW);
    doc.rect(0, PAGE_H - 5, 5, 5, "F");
  }

  // ── New page ──────────────────────────────────────────────────────────────
  function newPage() {
    drawPageFooter(pageNum);
    doc.addPage();
    pageNum++;
    drawPageHeader();
  }

  function checkPage(need = 10) {
    if (y + need > PAGE_H - FOOTER_H - 2) newPage();
  }

  // ── Section banner (yellow bg, bold text) ────────────────────────────────
  function sectionBanner(text) {
    checkPage(16);
    y += 4;
    doc.setFillColor(...YELLOW);
    doc.roundedRect(M, y, PW, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_DARK);
    doc.text(text, M + 4, y + 6.2);
    y += 13;
  }

  // ── Sub-section label (purple text) ──────────────────────────────────────
  function subSection(text) {
    checkPage(10);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PURPLE);
    doc.text(text, M, y);
    y += 5;
  }

  // ── Two-column info row ───────────────────────────────────────────────────
  // alternating: even rows are light purple bg, odd rows are white
  let rowCount = 0;
  function resetRowCount() { rowCount = 0; }

  function infoRow(label, value, forceAlt = null) {
    const txt = String(value || "—");
    const lines = doc.splitTextToSize(txt, COL2 - 4);
    const labelLines = doc.splitTextToSize(label, COL1 - 4);
    const rowH = Math.max(labelLines.length, lines.length) * 4.8 + 3;
    checkPage(rowH + 1);

    const alt = forceAlt !== null ? forceAlt : rowCount % 2 === 0;
    rowCount++;

    // Label cell — purple bg
    doc.setFillColor(...ROW_PURPLE);
    doc.rect(M, y, COL1, rowH, "F");
    // Value cell — alternating
    doc.setFillColor(alt ? 248 : 255, alt ? 243 : 255, alt ? 250 : 255);
    doc.rect(M + COL1, y, COL2, rowH, "F");
    // Borders
    doc.setDrawColor(210, 190, 220);
    doc.setLineWidth(0.15);
    doc.rect(M, y, PW, rowH, "S");
    doc.line(M + COL1, y, M + COL1, y + rowH);
    // Label text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_WHITE);
    doc.text(labelLines, M + 2.5, y + 3.8, { lineHeightFactor: 1.3 });
    // Value text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(lines, M + COL1 + 2.5, y + 3.8, { lineHeightFactor: 1.3 });

    y += rowH;
  }

  // ── Table header ─────────────────────────────────────────────────────────
  function tableHeader(cols) {
    // cols: [{label, w}]
    checkPage(9);
    let x = M;
    doc.setFillColor(...PURPLE);
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    doc.rect(M, y, totalW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_WHITE);
    for (const c of cols) {
      doc.text(c.label, x + 2, y + 4.8);
      x += c.w;
    }
    y += 7;
    return cols;
  }

  function tableRow(cols, values, alt = false) {
    const lines = values.map((v, i) => doc.splitTextToSize(String(v || "—"), cols[i].w - 4));
    const maxLines = Math.max(...lines.map(l => l.length));
    const rowH = maxLines * 4.5 + 2.5;
    checkPage(rowH + 1);
    let x = M;
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    doc.setFillColor(alt ? 245 : 255, alt ? 240 : 255, alt ? 248 : 255);
    doc.rect(M, y, totalW, rowH, "F");
    doc.setDrawColor(210, 190, 220);
    doc.setLineWidth(0.15);
    doc.rect(M, y, totalW, rowH, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    for (let i = 0; i < cols.length; i++) {
      doc.line(x, y, x, y + rowH);
      doc.text(lines[i], x + 2, y + 3.8, { lineHeightFactor: 1.3 });
      x += cols[i].w;
    }
    y += rowH;
  }

  function spacer(h = 5) { checkPage(h); y += h; }

  // ═══ START ════════════════════════════════════════════════════════════════
  drawPageHeader();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DADOS DA EMPRESA
  // ═══════════════════════════════════════════════════════════════════════════
  sectionBanner("DADOS DA EMPRESA");
  resetRowCount();
  infoRow("Nome da Empresa", clientName);
  infoRow("Nome do Responsável pelo Preenchimento", companyData?.responsibleName || "—");
  if (companyData?.apuracao_inicio || companyData?.apuracao_fim) {
    infoRow("Período de Apuração da Folha de Ponto", `Dia ${companyData.apuracao_inicio || 1} a ${companyData.apuracao_fim || 30}`);
  }
  if (companyData?.modo_registro) {
    infoRow("Modo de Registro de Ponto", companyData.modo_registro === "individual" ? "Registro individual" : "Registro coletivo");
  }
  if ((companyData?.aparelho_registro || []).length > 0) {
    const aparelhoLabels = { celular_pessoal: "Celular pessoal", celular_coletivo: "Celular coletivo", tablet_coletivo: "Tablet coletivo", computador: "Computador" };
    infoRow("Aparelho de Registro de Ponto", companyData.aparelho_registro.map(a => aparelhoLabels[a] || a).join(", "));
  }
  infoRow("Nomes das Regras", rulesNames.length > 0 ? rulesNames.join(", ") : "Nenhuma");
  infoRow("Funcionários em jornada noturna", companyData?.hasNightShift !== false ? "Sim" : "Não");
  infoRow("Funcionários em jornada 12x36", companyData?.has12x36Shift !== false ? "Sim" : "Não");
  infoRow("Funcionários de sobreaviso", companyData?.hasOnCallWorkers ? "Sim" : "Não");
  infoRow("Banco de horas", companyData?.hasTimeBank !== false ? "Sim" : "Não");
  if (companyData?.incluirObservacoes && companyData?.observacoes) {
    infoRow("Observações", companyData.observacoes);
  }
  spacer(4);

  // ═══════════════════════════════════════════════════════════════════════════
  // INDEX
  // ═══════════════════════════════════════════════════════════════════════════
  sectionBanner("ÍNDICE DE REGRAS DE CONFIGURAÇÃO");
  for (const name of rulesNames) {
    checkPage(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PURPLE);
    doc.text(name, M, y);
    doc.setTextColor(...TEXT_GRAY);
    const dots = "·".repeat(80);
    const dotsWidth = PW - 20;
    doc.setFontSize(8);
    doc.text(dots, M + 20, y, { maxWidth: dotsWidth });
    y += 6;
  }
  spacer(4);

  // ═══════════════════════════════════════════════════════════════════════════
  // Per-rule sections
  // ═══════════════════════════════════════════════════════════════════════════
  const rc  = allStepData?.rule_configurations || {};
  const he  = allStepData?.overtime_rules || {};
  const br  = allStepData?.break_time_rules || {};
  const an  = allStepData?.night_shift_rules || {};
  const j12 = allStepData?.shift_12x36_rules || {};
  const sb  = allStepData?.sobreaviso_rules || {};
  const dsr = allStepData?.dsr_rules || {};
  const bh  = allStepData?.bank_hours_rules || {};
  const ov  = allStepData?.other_verbs_rules || {};

  for (let ri = 0; ri < rulesNames.length; ri++) {
    const name = rulesNames[ri];

    // ── CONFIGURAÇÃO DA REGRA ──
    sectionBanner(`CONFIGURAÇÃO DA REGRA DE CÁLCULO - ${name.toUpperCase()}`);
    const cfg = rc[name] || {};
    resetRowCount();
    if (cfg._inheritingFrom) {
      infoRow("Configuração", `Igual à regra: ${cfg._inheritingFrom}`);
    } else {
      infoRow("Modelo", cfg.model || "—");
      if (cfg.model === "Fixo") {
        infoRow("Tolerância de Atraso na Entrada", cfg.entradaToleranciaAtraso ? `${cfg.entradaToleranciaAtraso} min` : "Não configurado");
        infoRow("Tolerância de Saída Antecipada", cfg.saidaToleranciaAntecipada ? `${cfg.saidaToleranciaAntecipada} min` : "Não configurado");
        infoRow("Tolerância Extra na Entrada", cfg.entradaToleranciaExtra ? `${cfg.entradaToleranciaExtra} min` : "Não configurado");
        infoRow("Tolerância Extra na Saída", cfg.saidaToleranciaExtra ? `${cfg.saidaToleranciaExtra} min` : "Não configurado");
      } else if (cfg.model === "Flexível") {
        infoRow("Janela Antes", cfg.janelaAntes ? `${cfg.janelaAntes} min` : "Não configurado");
        infoRow("Janela Depois", cfg.janelaDepois ? `${cfg.janelaDepois} min` : "Não configurado");
      } else if (cfg.model === "Híbrido") {
        infoRow("Tolerância de Atraso", cfg.toleranciaAtraso ? `${cfg.toleranciaAtraso} min` : "Não configurado");
        infoRow("Tolerância Extra", cfg.toleranciaExtra ? `${cfg.toleranciaExtra} min` : "Não configurado");
        infoRow("Janela Antes", cfg.janelaAntes ? `${cfg.janelaAntes} min` : "Não configurado");
        infoRow("Janela Depois", cfg.janelaDepois ? `${cfg.janelaDepois} min` : "Não configurado");
      }
      if (cfg.incluirObservacoes && cfg.observacoes) infoRow("Observações", cfg.observacoes);
    }
    spacer(4);

    // ── HORAS EXTRAS ──
    sectionBanner(`FUNCIONAMENTO DAS HORAS EXTRAS - ${name.toUpperCase()}`);
    const heCfg = he[name] || {};
    if (heCfg._inheritingFrom) {
      resetRowCount(); infoRow("Configuração", `Igual à regra: ${heCfg._inheritingFrom}`);
    } else {
      const heTypes = [
        { label: "Porcentagem Dias Comuns", key: "percDiasComuns", envKey: "envioE02DiasComuns", codKey: "codigoVerbaDiasComuns", fmtKey: "formatoDiasComuns", def: "50" },
        { label: "Porcentagem Sábado",      key: "percSabado",     envKey: "envioE02Sabado",     codKey: "codigoVerbaSabado",     fmtKey: "formatoSabado",     def: "50" },
        { label: "Porcentagem Domingo",     key: "percDomingo",    envKey: "envioE02Domingo",    codKey: "codigoVerbaDomingo",    fmtKey: "formatoDomingo",    def: "100" },
        { label: "Porcentagem Feriado",     key: "percFeriado",    envKey: "envioE02Feriado",    codKey: "codigoVerbaFeriado",    fmtKey: "formatoFeriado",    def: "100" },
      ];
      const heHasFopag = heTypes.some(t => heCfg[t.envKey] || heCfg[t.codKey]);
      const heCols = heHasFopag
        ? [ { label: "Tipo", w: 50 }, { label: "Porcentagem", w: 32 }, { label: "Envio Fopag", w: 28 }, { label: "Código", w: 36 }, { label: "Formato", w: PW - 146 } ]
        : [ { label: "Tipo", w: 90 }, { label: "Porcentagem", w: PW - 90 } ];
      tableHeader(heCols);
      heTypes.forEach((t, i) => {
        const perc = heCfg[t.key] || t.def;
        const percLabel = perc === "custom" ? (heCfg[t.key + "Custom"] || "—") + "% (custom)" : `H.E. ${perc}%`;
        if (heHasFopag) {
          tableRow(heCols, [ t.label, percLabel, heCfg[t.envKey] ? "Sim" : "Não", heCfg[t.codKey] || "A definir", heCfg[t.fmtKey] || "N/A" ], i % 2 !== 0);
        } else {
          tableRow(heCols, [ t.label, percLabel ], i % 2 !== 0);
        }
      });
      if (heCfg.categorizacaoHEDiaria === "Sim" || heCfg.categorizacaoHEMensal === "Sim") {
        spacer(3);
        resetRowCount();
        infoRow("Categorização de Hora Extra Diária",  heCfg.categorizacaoHEDiaria  || "Não");
        infoRow("Categorização de Hora Extra Mensal", heCfg.categorizacaoHEMensal || "Não");
      }
      if ((heCfg.additionalRates || []).length > 0) {
        spacer(3);
        subSection("Percentuais Adicionais de Hora Extra");
        const arCols = [ { label: "Nome", w: 50 }, { label: "Percentual", w: 30 }, { label: "Justificativa", w: PW - 80 } ];
        tableHeader(arCols);
        heCfg.additionalRates.forEach((r, i) => {
          tableRow(arCols, [ r.name || "—", r.percentage ? `${r.percentage}%` : "—", r.explanation || "—" ], i % 2 !== 0);
        });
      }
      if (heCfg.incluirObservacoes && heCfg.observacoes) infoRow("Observações", heCfg.observacoes);
    }
    spacer(4);

    // ── PAUSA REFEIÇÃO ──
    sectionBanner(`PAUSA REFEIÇÃO - ${name.toUpperCase()}`);
    const brCfg = br[name] || {};
    if (brCfg._inheritingFrom) {
      resetRowCount(); infoRow("Configuração", `Igual à regra: ${brCfg._inheritingFrom}`);
    } else {
      // Interval table
      const intCols = [
        { label: "Jornada Mínima", w: 46 },
        { label: "Jornada Máxima", w: 46 },
        { label: "Tempo de Pausa", w: PW - 92 },
      ];
      tableHeader(intCols);
      tableRow(intCols, [`${brCfg.intervaloMinHoras || "4"}h`, `${brCfg.intervaloMaxHoras || "6"}h`, `${brCfg.intervaloMinMinutos || "15"} min`], false);
      tableRow(intCols, [`${brCfg.intervaloMaxHoras || "6"}h`, "N/D", `${brCfg.intervaloMaxMinutos || "60"} min`], true);
      spacer(3);
      subSection("Tolerância para Pausa Refeição");
      const tolCols = [{ label: "Tipo de Tolerância", w: PW / 2 }, { label: "Valor", w: PW / 2 }];
      tableHeader(tolCols);
      tableRow(tolCols, ["Pausa Refeição", brCfg.toleranciaPausaRefeicao ? `${brCfg.toleranciaPausaRefeicao} min` : "Não há tolerância configurada"], false);
      tableRow(tolCols, ["Excesso de Pausa", brCfg.toleranciaPausaExcesso ? `${brCfg.toleranciaPausaExcesso} min` : "Não há tolerância configurada"], true);
      spacer(3);
      resetRowCount();
      infoRow("Calcular Hora Extra para Pausa Não Realizada", brCfg.calcularHoraExtraPausa === "sim" ? "Sim" : "Não");
      if (brCfg.codigoVerba) infoRow("Código de Verba", brCfg.codigoVerba + (brCfg.envioE02 ? " (Envia FOPAG)" : ""));
      if (brCfg.incluirObservacoes && brCfg.observacoes) infoRow("Observações", brCfg.observacoes);
    }
    spacer(4);

    // ── JORNADA NOTURNA ──
    if (companyData?.hasNightShift !== false) {
      sectionBanner(`JORNADA NOTURNA - ${name.toUpperCase()}`);
      const anCfg = an[name] || {};
      resetRowCount();
      if (anCfg._inheritingFrom) {
        infoRow("Configuração", `Igual à regra: ${anCfg._inheritingFrom}`);
      } else {
        infoRow("Existem funcionários trabalhando em jornada noturna", anCfg.hasJornadaNoturna === "nao" ? "Não" : "Sim");
        if (anCfg.hasJornadaNoturna !== "nao") {
          infoRow("Horário de início", anCfg.horaInicioNoturna || "22:00");
          infoRow("Horário de fim", anCfg.horaFimNoturna || "05:00");
          const percAd = anCfg.percAdicional === "custom" ? (anCfg.percAdicionalCustom || "—") + "% (custom)" : `${anCfg.percAdicional || "20"}%`;
          infoRow("Haverá redução de hora no período informado acima", anCfg.reducaoHoraPeriodo === "sim" ? "Sim" : "Não, a hora noturna é equivalente a 60min");
          infoRow("A redução informada, será considerada apenas no adicional noturno ou também nas horas trabalhadas", anCfg.reducaoConsideraAmbos === "sim" ? "Considera as horas trabalhadas" : "Considerar apenas no adicional noturno");
          infoRow("Prorrogar adicional noturno após às 5h", anCfg.adicionalProrrogadoFimJornada === "sim" ? "Sim" : "Não");
          infoRow("Adicional noturno deve incidir sobre a pausa", anCfg.adicionalIncluiTempoPausa === "sim" ? "Sim" : "Não");
          spacer(3);
          // Noturno % table
          const ntTypes = anCfg.separarHENoturna === "sim" ? [
            { label: "Porcentagem Adicional Noturno", key: "percHENoturnaComuns", envKey: "envioE02Comuns", codKey: "codigoVerbaComuns", fmtKey: "formatoComuns" },
            { label: "Sábado", key: "percHENoturnaSabado", envKey: "envioE02Sabado", codKey: "codigoVerbaSabado", fmtKey: "formatoSabado" },
            { label: "Domingo", key: "percHENoturnaDomingo", envKey: "envioE02Domingo", codKey: "codigoVerbaDomingo", fmtKey: "formatoDomingo" },
            { label: "Feriado", key: "percHENoturnaFeriado", envKey: "envioE02Feriado", codKey: "codigoVerbaFeriado", fmtKey: "formatoFeriado" },
          ] : [];
          const ntHasFopag = !!(anCfg.envioE02 || anCfg.codigoVerba) || ntTypes.some(t => anCfg[t.envKey] || anCfg[t.codKey]);
          const ntCols = ntHasFopag
            ? [ { label: "Tipo", w: 50 }, { label: "Porcentagem", w: 36 }, { label: "Envio Fopag", w: 28 }, { label: "Código", w: 34 }, { label: "Formato", w: PW - 148 } ]
            : [ { label: "Tipo", w: 90 }, { label: "Porcentagem", w: PW - 90 } ];
          tableHeader(ntCols);
          if (anCfg.separarHENoturna === "sim") {
            ntTypes.forEach((t, i) => {
              if (ntHasFopag) tableRow(ntCols, [t.label, `${anCfg[t.key] || "50"}%`, anCfg[t.envKey] ? "Sim" : "Não", anCfg[t.codKey] || "A definir", anCfg[t.fmtKey] || "N/A"], i % 2 !== 0);
              else tableRow(ntCols, [t.label, `${anCfg[t.key] || "50"}%`], i % 2 !== 0);
            });
          } else {
            if (ntHasFopag) tableRow(ntCols, ["Porcentagem Adicional Noturno", percAd, anCfg.envioE02 ? "Sim" : "Não", anCfg.codigoVerba || "A definir", "N/A"], false);
            else tableRow(ntCols, ["Porcentagem Adicional Noturno", percAd], false);
          }
          spacer(3);
          resetRowCount();
          infoRow("Separar hora extra noturna da diurna", anCfg.separarHENoturna === "sim" ? "Sim" : "Não");
          if (anCfg.incluirObservacoes && anCfg.observacoes) infoRow("Observações", anCfg.observacoes);
        }
      }
      spacer(4);
    }

    // ── JORNADA 12x36 ──
    if (companyData?.has12x36Shift !== false) {
      sectionBanner(`JORNADA 12x36 - ${name.toUpperCase()}`);
      const j12Cfg = j12[name] || {};
      resetRowCount();
      if (j12Cfg._inheritingFrom) {
        infoRow("Configuração", `Igual à regra: ${j12Cfg._inheritingFrom}`);
      } else {
        infoRow("Existem funcionários em jornada 12x36", j12Cfg.hasJornada12x36 === "nao" ? "Não" : "Sim");
        if (j12Cfg.hasJornada12x36 !== "nao") {
          infoRow("Pagamento em feriado", j12Cfg.pagamentoFeriado === "extra" ? "Pagamento de hora extra" : "Pagamento normal (dia útil)");
          infoRow("Falta em feriado", j12Cfg.faltaFeriado === "sim" ? "Sim, é considerado falta" : "Não, é considerado folga");
          if (j12Cfg.incluirObservacoes && j12Cfg.observacoes) infoRow("Observações", j12Cfg.observacoes);
        }
      }
      spacer(4);
    }

    // ── FOLGA, FERIADO E DSR ──
    sectionBanner(`FOLGA, FERIADO E DSR - ${name.toUpperCase()}`);
    const dsrCfg = dsr[name] || {};
    resetRowCount();
    if (dsrCfg._inheritingFrom) {
      infoRow("Configuração", `Igual à regra: ${dsrCfg._inheritingFrom}`);
    } else {
      infoRow(
        "Se o funcionário trabalhar em um dia de feriado ou folga, qual o tipo de % de Hora Extra deve ser considerada caso não seja realizada a pausa refeição? Selecione a opção mais indicada.",
        dsrCfg.tipoHEFeriado === "extra" ? "Extra" : "Não considerar"
      );
      infoRow(
        "Caso o funcionário trabalhe em um dia de folga, a pausa refeição deve ser considerada como hora trabalhada?",
        dsrCfg.pausaFolgaHoraTrabalhada === "considerar"
          ? "Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 09:00 trabalhadas (considerando a pausa)"
          : "Se o funcionário trabalha 08:00 + 01:00 de pausa, será gerado apontamento de 08:00 trabalhadas (não considerando a pausa)"
      );
      infoRow(
        "Se o funcionário falta em uma semana com feriado, é descontado DSR em dobro?",
        dsrCfg.dsrDobroFalta === "sim" ? "Sim, descontar o DSR em dobro (feriado + domingo)" : "Não, descontar apenas um DSR"
      );
      infoRow(
        "O DSR deve ser descontado no dia da falta?",
        dsrCfg.mesDescontoDSR === "proximo_mes" ? "No próximo mês, olhando para o domingo" : "DIA DA FALTA"
      );
      infoRow(
        "Em dias de falta com dispensa parcial lançada, é considerado atraso ou falta?",
        dsrCfg.dispensaParcial === "falta"
          ? "Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, o dia será contabilizado como falta."
          : "Se o funcionário possui uma jornada das 09:00 às 18:00 e possui atestado das 09:00 às 15:00, caso ele não trabalhe o tempo restante da jornada, as horas serão descontadas como atraso."
      );
      if (dsrCfg.envioE02) {
        spacer(3);
        subSection("Configuração de Exportação");
        const expCols = [{ label: "Envio E02 (FOPAG)", w: 52 }, { label: "Código da Verba", w: 65 }, { label: "Formato de Exportação", w: PW - 117 }];
        tableHeader(expCols);
        tableRow(expCols, ["Sim", dsrCfg.codigoVerba || "A definir", dsrCfg.formatoVerba || "N/A"], false);
      }
      if ((dsrCfg.verbas || []).length > 0) {
        spacer(3);
        subSection("Outras Verbas (Folga/Feriado/DSR)");
        const dsrVbCols = [ { label: "Nome", w: 60 }, { label: "Código", w: 30 }, { label: "Percentual", w: PW - 90 } ];
        tableHeader(dsrVbCols);
        dsrCfg.verbas.forEach((v, i) => tableRow(dsrVbCols, [v.nome || "—", v.codigo || "—", v.percentual ? `${v.percentual}%` : "—"], i % 2 !== 0));
      }
      if (dsrCfg.incluirObservacoes && dsrCfg.observacoes) { spacer(2); resetRowCount(); infoRow("Observações", dsrCfg.observacoes); }
    }
    spacer(4);

    // ── SOBREAVISO ──
    if (companyData?.hasOnCallWorkers === true) {
      sectionBanner(`SOBREAVISO - ${name.toUpperCase()}`);
      const sbCfg = sb[name] || {};
      resetRowCount();
      if (sbCfg._inheritingFrom) {
        infoRow("Configuração", `Igual à regra: ${sbCfg._inheritingFrom}`);
      } else {
        infoRow("Tem Funcionários de Sobreaviso", sbCfg.hasSobreaviso === "nao" ? "Não" : (sbCfg.hasSobreaviso === "sim" ? "Sim" : "Não configurado"));
        if (sbCfg.hasSobreaviso === "sim") {
          infoRow("Banco de Horas", sbCfg.bancoHoras === "sim" ? "Sim" : "Não");
          infoRow("Porcentagem de Sobreaviso Trabalhado", sbCfg.porcentagem || "—");
          if (sbCfg.particularidade) infoRow("Particularidade", sbCfg.particularidade);
          if (sbCfg.incluirObservacoes && sbCfg.observacoes) infoRow("Observações", sbCfg.observacoes);
        }
      }
      spacer(4);
    }

    // ── BANCO DE HORAS ──
    if (companyData?.hasTimeBank !== false) {
      sectionBanner(`BANCO DE HORAS - ${name.toUpperCase()}`);
      const bhCfg = bh[name] || {};
      resetRowCount();
      if (bhCfg._inheritingFrom) {
        infoRow("Configuração", `Igual à regra: ${bhCfg._inheritingFrom}`);
      } else {
        const hasBank = !!bhCfg.formato;
        infoRow("Nessa regra, existe banco de horas?", hasBank ? "Sim" : "Não configurado");
        if (hasBank) {
          infoRow("Modelo de Banco de Horas", bhCfg.formato === "compensacao_geral" ? "Compensação Geral" : "Por Janela / Cascata");
          infoRow("Data de início de banco de horas na Pontotel", bhCfg.dataInicio ? fmt(bhCfg.dataInicio) : "Não informado");
          const limitLabel = bhCfg.limiteDias === "custom" ? `${bhCfg.limiteDiasCustom || "—"} DIAS` : bhCfg.limiteDias ? `${bhCfg.limiteDias} DIAS` : "Não informado";
          infoRow("Qual o limite de dias para acúmulo/vencimento do banco de horas?", limitLabel);
          if (bhCfg.criterioAcumulo) infoRow("Qual o critério para o início de acúmulo das horas no banco?", bhCfg.criterioAcumulo === "data_admissao" ? "Data de admissão" : "A partir da data informada acima (fixo)");
        if (bhCfg.formato === "por_janela" && bhCfg.prazoVencimento) {
          const prazoLabel = bhCfg.prazoVencimento === "custom" ? `${bhCfg.prazoVencimentoCustom || "—"} meses` : `${bhCfg.prazoVencimento} meses`;
          infoRow("Prazo de Vencimento", prazoLabel);
        }

          // Fatores de transformação
          if ((bhCfg.fatoresTransformacao || []).some(f => f.ativo)) {
            spacer(3);
            subSection("Acúmulo em Banco de Horas e Fator de Transformação");
            const ftCols = [{ label: "Tipo de Evento", w: 90 }, { label: "Considerar", w: 36 }, { label: "Fator de Transformação", w: PW - 126 }];
            tableHeader(ftCols);
            (bhCfg.fatoresTransformacao || []).filter(f => f.ativo).forEach((f, i) => {
              const FATOR_LABELS = {
                hora_extra: "Hora Extra (jornada com presença obrigatória)",
                hora_extra_extraordinaria: "Hora Extra Extraordinária",
                hora_extra_especial: "Hora Extra Especial",
                atraso: "Atraso",
                saida_antecipada: "Saída Antecipada",
                excesso_pausa: "Excesso de Pausa",
                falta: "Falta",
              };
              const fatorDisplay = f.fator === "OUTRO" ? (f.fatorCustom || "—") : f.fator === "1_para_1" ? "1 para 1" : f.fator === "1_para_2" ? "1 para 2" : f.fator || "—";
              tableRow(ftCols, [FATOR_LABELS[f.key] || f.key, "Sim", fatorDisplay], i % 2 !== 0);
            });
          }

          spacer(3);
          resetRowCount();
          const limiteTipo = bhCfg.limiteAcumuloTipo || "";
          const tiposDisplay = !limiteTipo ? "Não informado"
            : limiteTipo === "sem_acumulo" ? "Sem acúmulo"
            : (() => {
                const label = { diario: "Diário", semanal: "Semanal", mensal: "Mensal", geral: "Geral" }[limiteTipo] || limiteTipo;
                const val = bhCfg.limiteAcumuloValor;
                return val ? `${label} (${val}h)` : label;
              })();
          infoRow("Tipo de Limite de Acúmulo", tiposDisplay);
          infoRow("Entrada Automática no Banco de Horas", bhCfg.saldoAutomatico === "sim" ? "Sim" : bhCfg.saldoAutomatico === "nao" ? "Não" : "Não informado");
          infoRow("Visualizar Histórico Após Baixa",
            bhCfg.mostrarHistorico === "sim"
              ? "Sim, mesmo após a baixa do banco de horas, o sistema continuará mostrando o saldo anterior que já foi pago ao colaborador."
              : bhCfg.mostrarHistorico === "nao"
              ? "Não, após a baixa o saldo é zerado e o histórico de horas já pagas não será exibido."
              : "Não informado"
          );
          if ((bhCfg.verbas || []).length > 0) {
            spacer(3);
            subSection("Outras Verbas (Banco de Horas)");
            const bhVbCols = [ { label: "Apontamento", w: PW - 40 }, { label: "Envio FOPAG", w: 40 } ];
            tableHeader(bhVbCols);
            const APONTAMENTO_LABELS = { baixa_negativa: "Baixa Negativa", baixa_parcial_negativa: "Baixa Parcial Negativa", baixa_parcial_positiva: "Baixa Parcial Positiva", baixa_positiva: "Baixa Positiva", outra_forma: "Outra forma de baixa" };
            bhCfg.verbas.forEach((v, i) => tableRow(bhVbCols, [v.apontamento ? (APONTAMENTO_LABELS[v.apontamento] || v.apontamento) : "—", v.envioE02 ? "Sim" : "Não"], i % 2 !== 0));
          }
          if (bhCfg.incluirObservacoes && bhCfg.observacoes) infoRow("Observações", bhCfg.observacoes);
        }
      }
      spacer(4);
    }
  }

  // ═══ CONFIGURAÇÃO DA FOLHA DE PONTO ══════════════════════════════════════
  const ts = allStepData?.timesheet_config || {};
  if (ts.somatoriaFinal || ts.abreviarLegendas) {
    sectionBanner("CONFIGURAÇÃO DA FOLHA DE PONTO");
    resetRowCount();
    if (ts.somatoriaFinal) infoRow("Somatória final na folha/espelho de ponto", ts.somatoriaFinal === "sim" ? "Sim" : "Não");
    if (ts.abreviarLegendas) infoRow("Abreviar legendas na folha de ponto", ts.abreviarLegendas === "sim" ? "Sim" : "Não");
    spacer(4);
  }

  // ═══ OUTRAS VERBAS ═══════════════════════════════════════════════════════
  if ((ov?.verbas || []).length > 0) {
    sectionBanner("OUTRAS VERBAS");
    const ovCols = [
      { label: "Nome da Verba", w: 60 },
      { label: "Código", w: 30 },
      { label: "Percentual", w: 30 },
      { label: "Descrição", w: PW - 120 },
    ];
    tableHeader(ovCols);
    (ov.verbas || []).forEach((v, i) => tableRow(ovCols, [v.nome || "—", v.codigo || "—", v.percentual ? `${v.percentual}%` : "—", v.descricao || "—"], i % 2 !== 0));
    if (ov.incluirObservacoes && ov.observacoes) { spacer(3); resetRowCount(); infoRow("Observações", ov.observacoes); }
    spacer(4);
  }

  // ── Draw footer on last page ──────────────────────────────────────────────
  drawPageFooter(pageNum);

  return doc.output("arraybuffer");
}