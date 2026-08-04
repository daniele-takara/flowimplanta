import { jsPDF } from "jspdf";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate";

// ── Brand colors ──────────────────────────────────────────────────────────
const PURPLE      = [121, 40, 135];
const PURPLE_DARK = [76, 29, 149];
const TEXT_DARK   = [40, 20, 50];
const TEXT_GRAY   = [100, 100, 110];
const TEXT_MUTED  = [150, 150, 160];
const BORDER      = [200, 200, 210];
const ROW_ALT     = [245, 240, 247];
const WHITE       = [255, 255, 255];

const LOGO_URL = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png";

const M  = 14;
const PW = 182;
const PAGE_BOTTOM = 285;

const TYPE_LABELS = {
  number: "Numérico",
  short_text: "Texto curto",
  long_text: "Texto longo",
  single_select: "Seleção única",
  multi_select: "Seleção múltipla",
  date_range_text: "Intervalo de datas",
  informativo: "Informativo",
};

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

function splitText(doc, text, maxWidth, fontSize) {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text || "", maxWidth);
}

/**
 * Gera PDF do Escopo Técnico em branco (modelo/template) com TODAS as perguntas possíveis.
 */
export async function generateScopeTemplatePDF() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  let y = 14;

  function ensureSpace(needed) {
    if (y + needed > PAGE_BOTTOM) { doc.addPage(); y = 14; }
  }

  function setFont(style, size, color = TEXT_DARK) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  // ── Cover header ─────────────────────────────────────────────────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, 210, 40, "F");
  if (logo) { try { doc.addImage(logo, "PNG", M, 8, 30, 10); } catch {} }
  setFont("bold", 20, WHITE);
  doc.text("Escopo Técnico — Modelo", M, 28);
  setFont("normal", 10, [221, 214, 254]);
  doc.text("Template em branco com todas as perguntas possíveis", M, 35);
  y = 50;

  setFont("normal", 8, TEXT_MUTED);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, M, y);
  y += 8;

  // ── Module rendering ────────────────────────────────────────────────────
  SCOPE_MODULES.forEach((mod, modIdx) => {
    // Module banner
    ensureSpace(20);
    if (y > 58) y += 4;
    doc.setFillColor(...PURPLE);
    doc.roundedRect(M, y, PW, 9, 1.5, 1.5, "F");
    setFont("bold", 10, WHITE);
    doc.text(`${modIdx + 1}. ${mod.moduleLabel}`, M + 4, y + 6);
    y += 12;

    // Visibility note
    let visNote = "";
    if (mod.alwaysVisible) visNote = "Sempre visível";
    else if (mod.autoShowWhen) visNote = `Visível quando origem = ${mod.autoShowWhen.value} (ou inclusão manual)`;
    else if (mod.showWhenContractedModule) visNote = `Visível quando módulo contratado: ${mod.showWhenContractedModule}`;
    if (visNote) {
      setFont("italic", 7.5, TEXT_MUTED);
      doc.text(visNote, M + 2, y);
      y += 5;
    }

    // Subsections or direct questions
    if (mod.subsections) {
      mod.subsections.forEach(sub => {
        ensureSpace(8);
        y += 2;
        setFont("bold", 9, PURPLE_DARK);
        doc.text(sub.label, M + 2, y);
        y += 5;
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.2);
        doc.line(M + 2, y, M + PW - 2, y);
        y += 4;
        sub.questions.forEach(q => renderQuestion(q));
      });
    } else if (mod.questions) {
      mod.questions.forEach(q => renderQuestion(q));
    }
    y += 4;
  });

  function renderQuestion(q) {
    const isInfo = q.type === "informativo";
    // Question number + prompt
    const promptLines = splitText(doc, `${q.order}. ${q.prompt}`, PW - 12, 9.5);
    const promptH = promptLines.length * 4.2 + 2;
    ensureSpace(promptH + 4);
    setFont("bold", 9.5, isInfo ? PURPLE_DARK : TEXT_DARK);
    doc.text(promptLines, M + 4, y + 4);
    y += promptH;

    // Description
    if (q.description) {
      const descLines = splitText(doc, q.description, PW - 12, 8);
      const descH = descLines.length * 3.6 + 1;
      ensureSpace(descH);
      setFont("normal", 8, TEXT_GRAY);
      doc.text(descLines, M + 4, y + 3);
      y += descH;
    }

    // Type + options
    const typeLabel = TYPE_LABELS[q.type] || q.type;
    setFont("italic", 7.5, TEXT_MUTED);
    doc.text(`Tipo: ${typeLabel}`, M + 4, y + 2);
    y += 4;

    if (q.options && q.options.length > 0) {
      setFont("normal", 8, TEXT_DARK);
      doc.text(`Opções: ${q.options.join("  |  ")}`, M + 4, y + 2);
      y += 4;
    }

    // Rules (conditional visibility, etc.)
    if (q.rules && q.rules.length > 0) {
      q.rules.forEach(r => {
        let ruleText = "";
        if (r.type === "conditional_visibility") {
          ruleText = `Condicional: exibe quando ${r.dependsOn} ${r.condition.operator} "${r.condition.value}"`;
        } else if (r.type === "require_observations_when_option_selected") {
          ruleText = `Exige observações quando opção = "${r.option}"`;
        } else if (r.type === "additional_context_in_observations") {
          ruleText = `Sempre: ${r.message}`;
        }
        if (ruleText) {
          const ruleLines = splitText(doc, `⚠ ${ruleText}`, PW - 12, 7.5);
          ensureSpace(ruleLines.length * 3.4);
          setFont("italic", 7.5, [180, 100, 30]);
          doc.text(ruleLines, M + 4, y + 2);
          y += ruleLines.length * 3.4 + 1;
        }
      });
    }

    // Answer line (blank)
    if (!isInfo) {
      ensureSpace(8);
      y += 2;
      doc.setDrawColor(...[200, 200, 210]);
      doc.setLineWidth(0.3);
      doc.line(M + 4, y + 5, M + PW - 4, y + 5);
      setFont("normal", 7, TEXT_MUTED);
      doc.text("Resposta:", M + 4, y + 3);
      y += 8;

      // Observations line
      ensureSpace(6);
      doc.setDrawColor(...[200, 200, 210]);
      doc.line(M + 4, y + 4, M + PW - 4, y + 4);
      setFont("normal", 7, TEXT_MUTED);
      doc.text("Observações:", M + 4, y + 2.5);
      y += 6;
    }

    // Separator
    y += 2;
    doc.setDrawColor(...[235, 230, 240]);
    doc.setLineWidth(0.2);
    doc.line(M + 4, y, M + PW - 4, y);
    y += 4;
  }

  // ── Footer on all pages ─────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_BOTTOM, M + PW, PAGE_BOTTOM);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Modelo de referência — Escopo Técnico Pontotel", M, PAGE_BOTTOM + 5);
    doc.text(`Página ${i} de ${pages}`, M + PW, PAGE_BOTTOM + 5, { align: "right" });
  }

  return doc;
}

export async function downloadScopeTemplatePDF() {
  const doc = await generateScopeTemplatePDF();
  const fileName = "Modelo_Escopo_Tecnico.pdf";
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