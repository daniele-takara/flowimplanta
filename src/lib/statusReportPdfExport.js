import { jsPDF } from "jspdf";

// ── Brand colors ──────────────────────────────────────────────────────────
const PURPLE      = [109, 40, 217];   // #6d28d9
const PURPLE_DARK = [76, 29, 149];    // #4c1d95
const PURPLE_LIGHT = [243, 244, 246];
const TEXT_DARK   = [51, 65, 85];     // slate-700
const TEXT_GRAY   = [100, 116, 139];  // slate-500
const TEXT_MUTED  = [148, 163, 184];  // slate-400
const BORDER      = [226, 232, 240];  // slate-200
const ROW_ALT     = [248, 250, 252];  // slate-50
const WHITE       = [255, 255, 255];

const LOGO_URL = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png";

const M  = 14;
const PW = 182;       // usable width (210 - 2*14)
const PAGE_H = 297;
const PAGE_BOTTOM = 285;

function fmtDate(d) {
  if (!d) return "—";
  const s = String(d).substring(0, 10);
  if (!s || s.length < 10) return "—";
  return `${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}`;
}

function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === "string") return val.trim() === "";
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function statusColors(status) {
  switch (status) {
    case "Concluído":    return { bg: [220, 252, 231], text: [22, 101, 52], border: [187, 247, 208] };
    case "Em andamento": return { bg: [237, 233, 254], text: [91, 33, 182], border: [221, 214, 254] };
    case "Atrasado":     return { bg: [254, 226, 226], text: [153, 27, 27], border: [254, 202, 202] };
    default:             return { bg: [241, 245, 249], text: [71, 85, 105], border: [226, 232, 240] };
  }
}

async function loadLogo() {
  try {
    const r = await fetch(LOGO_URL);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let b = "";
    for (let i = 0; i < bytes.length; i += 8192) b += String.fromCharCode(...bytes.slice(i, i + 8192));
    return `data:image/png;base64,${btoa(b)}`;
  } catch { return null; }
}

/**
 * Gera PDF do Status Report espelhando o modelo de e-mail.
 * Inclui: header, KPIs, cronograma macro, próxima agenda, observações executivas,
 * pendências (cliente/Pontotel), integração, riscos e status geral.
 */
export async function generateStatusReportPDF({ project, form, macroPhases, overallProgress, usabilityData, report }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();

  const today = new Date().toLocaleDateString("pt-BR");
  const contracted = project?.contracted_employees || 0;
  const cadastrados = usabilityData?.numero_funcionarios ?? report?.registered_employees ?? 0;
  const batendoPonto = usabilityData?.empregados_batendo_ponto_ultimos_15_dias ?? report?.recording_employees ?? 0;
  const aderencia = contracted > 0 ? Math.round((batendoPonto / contracted) * 100) : (report?.adherence_percent ?? 0);
  const periodStart = fmtDate(project?.start_date);
  const periodEnd = fmtDate(project?.aligned_end_date || project?.planned_end_date);
  const generalStatus = report?.general_status || "";

  let y = 0;
  let totalPages = 1;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function ensureSpace(needed) {
    if (y + needed > PAGE_BOTTOM) { doc.addPage(); y = 14; }
  }

  function setFont(style, size, color = TEXT_DARK) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  function drawRoundedRect(x, y2, w, h, r, fill) {
    doc.setFillColor(...fill);
    doc.setDrawColor(...fill);
    doc.roundedRect(x, y2, w, h, r, r, "F");
  }

  function drawHeader() {
    // Purple gradient bar (simulated with solid purple)
    drawRoundedRect(M, 14, PW, 38, 3, PURPLE);
    // Logo
    if (logo) { try { doc.addImage(logo, "PNG", M + 6, 18, 24, 8); } catch {} }
    // Title
    setFont("bold", 18, WHITE);
    doc.text("Status do Projeto", M + 6, 36);
    // Client name
    setFont("normal", 12, [221, 214, 254]);
    doc.text(project?.client_name || "", M + 6, 45);
    // Date (right aligned)
    setFont("normal", 9, [196, 181, 253]);
    doc.text("Data do relatório", M + PW - 6, 22, { align: "right" });
    setFont("bold", 11, WHITE);
    doc.text(today, M + PW - 6, 27, { align: "right" });
    if (periodStart !== "—" || periodEnd !== "—") {
      setFont("normal", 8, [196, 181, 253]);
      doc.text(`${periodStart} → ${periodEnd}`, M + PW - 6, 32, { align: "right" });
    }
    y = 58;
  }

  function drawKpiCards() {
    const cards = [
      { label: "Empregados Cadastrados", value: cadastrados.toLocaleString("pt-BR"), sub: `de ${contracted.toLocaleString("pt-BR")} contratados`, bg: [245, 243, 255], color: PURPLE },
      { label: "No Ponto / mês", value: batendoPonto.toLocaleString("pt-BR"), sub: "últimos 15 dias", bg: [239, 246, 255], color: [29, 78, 216] },
      { label: "Aderência ao Ponto", value: `${aderencia}%`, sub: "do contratado", bg: aderencia >= 80 ? [220, 252, 231] : aderencia >= 50 ? [255, 237, 213] : [254, 226, 226], color: aderencia >= 80 ? [22, 101, 52] : aderencia >= 50 ? [154, 52, 18] : [153, 27, 27] },
      { label: "Progresso do Projeto", value: `${overallProgress || 0}%`, sub: "média das fases", bg: [245, 243, 255], color: PURPLE },
    ];
    const cardW = (PW - 12) / 4;
    cards.forEach((c, i) => {
      const x = M + i * (cardW + 4);
      drawRoundedRect(x, y, cardW, 26, 2, c.bg);
      setFont("bold", 7, TEXT_GRAY);
      doc.text(c.label.toUpperCase(), x + 4, y + 6);
      setFont("bold", 16, c.color);
      doc.text(String(c.value), x + 4, y + 14);
      setFont("normal", 7, TEXT_MUTED);
      doc.text(c.sub, x + 4, y + 20);
    });
    y += 32;
  }

  function sectionTitle(title, color = PURPLE) {
    ensureSpace(10);
    setFont("bold", 9, color);
    doc.text(title.toUpperCase(), M, y + 4);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y + 6, M + PW, y + 6);
    y += 10;
  }

  function drawTable(headers, rows, colWidths) {
    // header row
    ensureSpace(8);
    const rowH = 7;
    doc.setFillColor(...ROW_ALT);
    doc.rect(M, y, PW, rowH, "F");
    let x = M + 3;
    headers.forEach((h, i) => {
      setFont("bold", 7.5, TEXT_MUTED);
      doc.text(h, x, y + 4.5);
      x += colWidths[i];
    });
    y += rowH;
    // data rows
    rows.forEach((row, ri) => {
      const maxLines = Math.max(...row.map((cell, ci) => {
        const w = colWidths[ci] - 6;
        const lines = doc.splitTextToSize(String(cell ?? "—"), w);
        return lines.length;
      }));
      const h = Math.max(rowH, maxLines * 4 + 2);
      ensureSpace(h);
      if (ri % 2 === 1) { doc.setFillColor(...ROW_ALT); doc.rect(M, y, PW, h, "F"); }
      x = M + 3;
      row.forEach((cell, ci) => {
        const w = colWidths[ci] - 6;
        const lines = doc.splitTextToSize(String(cell ?? "—"), w);
        setFont("normal", 8, TEXT_DARK);
        doc.text(lines, x, y + 4.5);
        x += colWidths[ci];
      });
      y += h;
    });
    y += 4;
  }

  function drawMacroSchedule() {
    if (!macroPhases || macroPhases.length === 0) return;
    sectionTitle("Cronograma do Projeto");
    const rows = macroPhases.map(ph => {
      const c = statusColors(ph.status);
      return [
        ph.phase || "—",
        fmtDate(ph.plannedStart),
        fmtDate(ph.plannedEnd),
        `${ph.progress || 0}%`,
        ph.status || "—",
      ];
    });
    drawTable(["Etapa", "Início Plan.", "Fim Plan.", "Progresso", "Status"], rows, [60, 30, 30, 25, 37]);
  }

  function drawNextAgenda() {
    if (isEmpty(form?.next_agenda)) return;
    sectionTitle("Próxima Agenda");
    ensureSpace(12);
    setFont("normal", 10, TEXT_DARK);
    const lines = doc.splitTextToSize(form.next_agenda, PW - 6);
    doc.text(lines, M + 2, y + 4);
    y += lines.length * 4.5 + 2;
    if (!isEmpty(form?.next_agenda_date)) {
      setFont("normal", 8, TEXT_MUTED);
      doc.text(fmtDate(form.next_agenda_date), M + 2, y + 3);
      y += 5;
    }
    y += 4;
  }

  function drawExecutiveSummary() {
    if (isEmpty(form?.executive_summary)) return;
    sectionTitle("Observações Executivas");
    ensureSpace(12);
    setFont("normal", 9.5, TEXT_DARK);
    const lines = doc.splitTextToSize(form.executive_summary, PW - 6);
    doc.text(lines, M + 2, y + 4);
    y += lines.length * 4.5 + 4;
  }

  function drawPendingTable(title, items, accentColor) {
    if (isEmpty(items)) return;
    sectionTitle(title, accentColor);
    const rows = items.map(it => [it.item || "—", it.deadline ? fmtDate(it.deadline) : "—", it.responsible || "—"]);
    drawTable(["Item", "Prazo", "Responsável"], rows, [90, 35, 57]);
  }

  function drawIntegration() {
    if (isEmpty(form?.integration_items)) return;
    sectionTitle("Integração");
    const rows = (form.integration_items || []).map(it => [it.item || "—", it.status || "—"]);
    drawTable(["Item", "Status"], rows, [120, 62]);
  }

  function drawRisks() {
    if (isEmpty(form?.risks)) return;
    sectionTitle("Riscos", [220, 38, 38]);
    const rows = (form.risks || []).map(it => [it.description || "—", it.impact || "—", it.mitigation || "—"]);
    drawTable(["Descrição", "Impacto", "Mitigação"], rows, [80, 30, 72]);
  }

  function drawGeneralStatus() {
    if (isEmpty(generalStatus)) return;
    sectionTitle("Status Geral");
    ensureSpace(10);
    const c = statusColors(generalStatus);
    drawRoundedRect(M, y, PW, 10, 2, c.bg);
    setFont("bold", 10, c.text);
    doc.text(generalStatus, M + 4, y + 6);
    y += 16;
  }

  function drawFooter() {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(M, PAGE_BOTTOM, M + PW, PAGE_BOTTOM);
      setFont("normal", 7.5, TEXT_MUTED);
      doc.text("Gerado automaticamente pelo FlowImplanta", M, PAGE_BOTTOM + 5);
      doc.text(`Página ${i} de ${pages}`, M + PW, PAGE_BOTTOM + 5, { align: "right" });
    }
  }

  // ── Build document ──────────────────────────────────────────────────────
  drawHeader();
  drawKpiCards();
  drawMacroSchedule();
  drawNextAgenda();
  drawExecutiveSummary();
  drawPendingTable("Pendências do Cliente", form?.client_pending, [234, 88, 12]);
  drawPendingTable("Pendências Pontotel", form?.internal_pending, [37, 99, 235]);
  drawIntegration();
  drawRisks();
  drawGeneralStatus();
  drawFooter();

  return doc;
}

export async function downloadStatusReportPDF({ project, form, macroPhases, overallProgress, usabilityData, report }) {
  const doc = await generateStatusReportPDF({ project, form, macroPhases, overallProgress, usabilityData, report });
  const fileName = `Status_Report_${(project?.client_name || "projeto").replace(/\s+/g, "_")}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}