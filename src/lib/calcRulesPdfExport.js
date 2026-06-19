import { jsPDF } from "jspdf";

const LOGO_URL = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png";
const M = 10;
const PW = 190;
const PAGE_H = 287;

function fmt(d) {
  if (!d) return "—";
  return d.substring(8, 10) + "/" + d.substring(5, 7) + "/" + d.substring(0, 4);
}

function fmtObs(text) {
  return text || "—";
}

export async function generateCalcRulesPDF({ project, companyData, allStepData }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;

  // Load logo
  let logoDataUrl = null;
  try {
    const logoResp = await fetch(LOGO_URL);
    if (logoResp.ok) {
      const logoBuf = await logoResp.arrayBuffer();
      const bytes = new Uint8Array(logoBuf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.slice(i, i + 8192));
      }
      logoDataUrl = `data:image/png;base64,${btoa(binary)}`;
    }
  } catch (_) {}

  function checkPage(need = 8) {
    if (y + need > PAGE_H) { doc.addPage(); y = 15; }
  }

  function sectionTitle(text) {
    y += 3;
    checkPage(10);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text(text, M, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(M + 55, y + 0.5, M + PW, y + 0.5);
    y += 7;
  }

  function addRow(label, value, fontSize = 9, labelW = 52) {
    checkPage(5);
    doc.setFontSize(fontSize);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(label, M, y);
    doc.setTextColor(30, 41, 59);
    const txt = String(value || "—");
    const maxW = PW - labelW;
    const lines = doc.splitTextToSize(txt, maxW);
    doc.text(lines[0], M + labelW, y);
    for (let i = 1; i < lines.length; i++) {
      y += fontSize * 0.42;
      checkPage(5);
      doc.text(lines[i], M + labelW, y);
    }
    y += fontSize * 0.52;
  }

  function addBlock(text, fontSize = 9, color = [30, 41, 59]) {
    if (!text) { y += 2; return; }
    checkPage(5);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(text), PW);
    for (const ln of lines) {
      checkPage(5);
      doc.text(ln, M, y);
      y += fontSize * 0.45;
    }
    y += 2;
  }

  // ═══ HEADER ═══
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M + PW - 24, y - 6, 24, 8);
  }
  doc.setFontSize(18);
  doc.setTextColor(124, 58, 237);
  doc.setFont("helvetica", "bold");
  doc.text("Configuração das Regras de Cálculo", M, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  const clientName = project?.client_name || "Cliente";
  const today = new Date().toLocaleDateString("pt-BR");
  doc.text(`${clientName} · ${today}`, M, y);
  y += 3;
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + PW, y);
  doc.setLineWidth(0.2);
  y += 6;

  // ═══ 1. DADOS DA EMPRESA ═══
  sectionTitle("1. DADOS DA EMPRESA");
  addRow("Empresa", clientName);
  addRow("Responsável", companyData?.responsibleName || "—");
  const rulesNames = companyData?.rulesNames || [];
  addRow("Regras de Cálculo", rulesNames.length > 0 ? rulesNames.join(", ") : "Nenhuma");
  addRow("Possui Adicional Noturno", companyData?.hasNightShift !== false ? "Sim" : "Não");
  addRow("Possui Jornada 12x36", companyData?.has12x36Shift !== false ? "Sim" : "Não");
  addRow("Possui Sobreaviso", companyData?.hasOnCallWorkers !== false ? "Sim" : "Não");
  addRow("Possui Banco de Horas", companyData?.hasTimeBank !== false ? "Sim" : "Não");
  if (companyData?.incluirObservacoes && companyData?.observacoes) {
    addRow("Observações", companyData.observacoes);
  }
  y += 4;

  // ═══ 2. CONFIGURAÇÃO DAS REGRAS ═══
  const rc = allStepData?.rule_configurations || {};
  sectionTitle("2. CONFIGURAÇÃO DAS REGRAS");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = rc[name] || {};
      if (cfg._inheritingFrom) {
        addRow(name, `Herdando de: ${cfg._inheritingFrom}`);
        continue;
      }
      addRow(name, `Modelo: ${cfg.model || "—"}`);
      if (cfg.model === "Fixo") {
        addRow("  Tolerância Atraso Entrada", `${cfg.entradaToleranciaAtraso || "—"} min`);
        addRow("  Tolerância Antecipação Saída", `${cfg.saidaToleranciaAntecipada || "—"} min`);
        addRow("  Tolerância Extra Entrada", `${cfg.entradaToleranciaExtra || "—"} min`);
        addRow("  Tolerância Extra Saída", `${cfg.saidaToleranciaExtra || "—"} min`);
      } else if (cfg.model === "Flexível") {
        addRow("  Janela Antes", `${cfg.janelaAntes || "—"} min`);
        addRow("  Janela Depois", `${cfg.janelaDepois || "—"} min`);
      } else if (cfg.model === "Híbrido") {
        addRow("  Tolerância de Atraso", `${cfg.toleranciaAtraso || "—"} min`);
        addRow("  Tolerância Extra", `${cfg.toleranciaExtra || "—"} min`);
        addRow("  Janela Antes", `${cfg.janelaAntes || "—"} min`);
        addRow("  Janela Depois", `${cfg.janelaDepois || "—"} min`);
      }
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 3. HORAS EXTRAS ═══
  const he = allStepData?.overtime_rules || {};
  sectionTitle("3. HORAS EXTRAS");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = he[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      addRow(name, `Dias Comuns: ${cfg.percDiasComuns || "50"}% | Sáb: ${cfg.percSabado || "50"}% | Dom: ${cfg.percDomingo || "100"}% | Fer: ${cfg.percFeriado || "100"}%`);
      addRow("  Categorização Diária", cfg.categorizacaoHEDiaria || "Não");
      addRow("  Categorização Mensal", cfg.categorizacaoHEMensal || "Não");
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 4. INTERVALOS ═══
  const br = allStepData?.break_time_rules || {};
  sectionTitle("4. INTERVALOS");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = br[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      addRow(name, `Refeição: entre ${cfg.intervaloMinHoras || "4"}h e ${cfg.intervaloMaxHoras || "6"}h = ${cfg.intervaloMinMinutos || "15"}min / +${cfg.intervaloMaxHoras || "6"}h = ${cfg.intervaloMaxMinutos || "60"}min`);
      addRow("  Tolerância Pausa Refeição", `${cfg.toleranciaPausaRefeicao || "—"} min`);
      addRow("  Tolerância Pausa Excesso", `${cfg.toleranciaPausaExcesso || "—"} min`);
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 5. ADICIONAL NOTURNO ═══
  const an = allStepData?.night_shift_rules || {};
  sectionTitle("5. ADICIONAL NOTURNO");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = an[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      if (cfg.hasJornadaNoturna === "nao") { addRow(name, "Sem jornada noturna"); continue; }
      addRow(name, `Adicional: ${cfg.percAdicional || "20"}% | ${cfg.horaInicioNoturna || "22:00"} às ${cfg.horaFimNoturna || "05:00"}`);
      addRow("  Separar HE Noturna", cfg.separarHENoturna === "sim" ? "Sim" : "Não");
      addRow("  Redução Hora", cfg.reducaoHoraPeriodo === "sim" ? "Sim" : "Não");
      addRow("  Prorrogação Fim Jornada", cfg.adicionalProrrogadoFimJornada === "sim" ? "Sim" : "Não");
      addRow("  Inclui Tempo Pausa", cfg.adicionalIncluiTempoPausa === "sim" ? "Sim" : "Não");
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 6. JORNADA 12X36 ═══
  const j12 = allStepData?.shift_12x36_rules || {};
  sectionTitle("6. JORNADA 12X36");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = j12[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      if (cfg.hasJornada12x36 === "nao") { addRow(name, "Sem jornada 12x36"); continue; }
      addRow(name, `Feriado: ${cfg.pagamentoFeriado === "extra" ? "Hora Extra" : "Pagamento Normal"} | Falta: ${cfg.faltaFeriado === "sim" ? "Sim" : "Não"}`);
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 7. SOBREAVISO ═══
  const sb = allStepData?.sobreaviso_rules || {};
  sectionTitle("7. SOBREAVISO");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = sb[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      if (cfg.hasSobreaviso === "nao") { addRow(name, "Sem sobreaviso"); continue; }
      addRow(name, `Porcentagem: ${cfg.porcentagem || "—"}% | Banco de Horas: ${cfg.bancoHoras === "sim" ? "Sim" : "Não"} | Envia FOPAG: ${cfg.envioE02 ? "Sim" : "Não"}`);
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 8. DSR / FERIADOS ═══
  const dsr = allStepData?.dsr_rules || {};
  sectionTitle("8. DSR / FERIADOS");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = dsr[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      addRow(name, `HE Feriado: ${cfg.tipoHEFeriado === "extra" ? "Extra" : "Não considerar"} | Pausa Folga: ${cfg.pausaFolgaHoraTrabalhada === "considerar" ? "Considerar" : "Não"} | DSR Dobro: ${cfg.dsrDobroFalta === "sim" ? "Sim" : "Não"} | Envia FOPAG: ${cfg.envioE02 ? "Sim" : "Não"}`);
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 9. BANCO DE HORAS ═══
  const bh = allStepData?.bank_hours_rules || {};
  sectionTitle("9. BANCO DE HORAS");
  if (rulesNames.length === 0) {
    addRow("Status", "Nenhuma regra configurada");
  } else {
    for (const name of rulesNames) {
      const cfg = bh[name] || {};
      if (cfg._inheritingFrom) { addRow(name, `Herdando de: ${cfg._inheritingFrom}`); continue; }
      addRow(name, `Formato: ${cfg.formato === "compensacao_geral" ? "Compensação Geral" : cfg.formato === "por_janela" ? "Por Janela" : "—"}`);
      if (cfg.dataInicio) addRow("  Início", fmt(cfg.dataInicio));
      if (cfg.limiteDias) addRow("  Limite Dias", cfg.limiteDias === "custom" ? cfg.limiteDiasCustom : cfg.limiteDias);
      if (cfg.incluirObservacoes && cfg.observacoes) {
        addRow("  Observações", cfg.observacoes);
      }
    }
  }
  y += 4;

  // ═══ 10. OUTRAS VERBAS ═══
  const ov = allStepData?.other_verbs_rules || {};
  sectionTitle("10. OUTRAS VERBAS");
  if ((ov?.verbas || []).length === 0) {
    addRow("Status", "Nenhuma verba adicional");
  } else {
    for (const v of ov.verbas) {
      addRow(v.nome || "Verba", `Cód: ${v.codigo || "—"} | %: ${v.percentual || "—"}${v.descricao ? ` | ${v.descricao}` : ""}`);
    }
  }
  if (ov?.incluirObservacoes && ov?.observacoes) {
    addRow("Observações", ov.observacoes);
  }

  return doc.output("arraybuffer");
}