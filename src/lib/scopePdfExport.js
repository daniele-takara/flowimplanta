// ============================================================
// GERADOR DE PDF — ESCOPO TÉCNICO
// Estrutura reutilizável para outros documentos do projeto
// ============================================================

import { SCOPE_MODULES, getModuleQuestions, isModuleVisible } from "@/lib/scopeTemplate";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

function sanitize(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

function buildModuleHTML(mod, questionsData) {
  const allQuestions = getModuleQuestions(mod);
  if (allQuestions.length === 0) return "";

  const renderQuestion = (q) => {
    const data = questionsData[q.id] || {};
    const answer = data.answer || "—";
    const obs = data.observations || "";
    return `
      <div class="question-block">
        <div class="question-number">${q.order}</div>
        <div class="question-content">
          <div class="question-prompt">${sanitize(q.prompt)}</div>
          ${q.description ? `<div class="question-desc">${sanitize(q.description)}</div>` : ""}
          <div class="answer-row">
            <span class="answer-label">Resposta:</span>
            <span class="answer-value ${answer === "—" ? "answer-empty" : ""}">${sanitize(answer)}</span>
          </div>
          ${obs ? `<div class="obs-row"><span class="obs-label">Observações:</span><span class="obs-value">${sanitize(obs)}</span></div>` : ""}
        </div>
      </div>
    `;
  };

  if (mod.subsections) {
    const subsHTML = mod.subsections.map(sub => {
      const qs = sub.questions.map(renderQuestion).join("");
      return `
        <div class="subsection">
          <div class="subsection-label">${sanitize(sub.label)}</div>
          ${qs}
        </div>
      `;
    }).join("");
    return `
      <div class="module-block">
        <div class="module-header">${sanitize(mod.moduleLabel)}</div>
        ${subsHTML}
      </div>
    `;
  }

  return `
    <div class="module-block">
      <div class="module-header">${sanitize(mod.moduleLabel)}</div>
      ${allQuestions.map(renderQuestion).join("")}
    </div>
  `;
}

// effectiveModules: módulos já com overrides aplicados (passados pelo ScopeTab).
// Fallback para SCOPE_MODULES estático caso não seja passado (compatibilidade).
export function generateScopePDF(project, questionsData, contractedModules, origin, manualOverrides = {}, effectiveModules = null) {
  const modulesToUse = effectiveModules || SCOPE_MODULES;
  const visibleModules = modulesToUse.filter(mod =>
    isModuleVisible(mod, contractedModules, origin, manualOverrides)
  );

  const modulesHTML = visibleModules.map(mod => buildModuleHTML(mod, questionsData)).join("");

  const totalQuestions = visibleModules.reduce((acc, mod) => acc + getModuleQuestions(mod).length, 0);
  const answeredQuestions = visibleModules.reduce((acc, mod) => {
    return acc + getModuleQuestions(mod).filter(q => questionsData[q.id]?.answer).length;
  }, 0);
  // (modulesToUse is used above — SCOPE_MODULES import kept as fallback only)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Escopo Técnico – ${project?.name || "Projeto"}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    background: #fff;
    padding: 40px 48px;
    line-height: 1.5;
  }

  /* Header */
  .doc-header {
    border-bottom: 3px solid #2563eb;
    padding-bottom: 20px;
    margin-bottom: 28px;
  }
  .doc-title {
    font-size: 22px;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 4px;
  }
  .doc-subtitle {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 16px;
  }
  .project-meta {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 18px;
  }
  .meta-item { }
  .meta-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
    margin-bottom: 2px;
  }
  .meta-value {
    font-size: 11px;
    font-weight: 600;
    color: #334155;
  }
  .doc-stats {
    margin-top: 12px;
    font-size: 10px;
    color: #64748b;
  }
  .doc-stats strong { color: #2563eb; }

  /* Modules */
  .module-block {
    margin-bottom: 28px;
    page-break-inside: avoid;
  }
  .module-header {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: #2563eb;
    padding: 8px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
    letter-spacing: 0.02em;
  }

  /* Subsections */
  .subsection {
    margin-bottom: 16px;
  }
  .subsection-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
    padding: 5px 10px;
    background: #f1f5f9;
    border-left: 3px solid #93c5fd;
    border-radius: 0 4px 4px 0;
    margin-bottom: 8px;
  }

  /* Questions */
  .question-block {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
    page-break-inside: avoid;
  }
  .question-number {
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    min-width: 22px;
    text-align: right;
    padding-top: 1px;
  }
  .question-content {
    flex: 1;
  }
  .question-prompt {
    font-size: 11px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 6px;
    line-height: 1.4;
  }
  .question-desc {
    font-size: 10px;
    color: #64748b;
    line-height: 1.5;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 8px;
  }
  .answer-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 4px;
  }
  .answer-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    min-width: 60px;
    padding-top: 1px;
  }
  .answer-value {
    font-size: 11px;
    font-weight: 600;
    color: #15803d;
    flex: 1;
  }
  .answer-empty {
    color: #cbd5e1;
    font-weight: 400;
    font-style: italic;
  }
  .obs-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 4px;
  }
  .obs-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    min-width: 60px;
    padding-top: 1px;
  }
  .obs-value {
    font-size: 10px;
    color: #475569;
    flex: 1;
    font-style: italic;
  }

  /* Footer */
  .doc-footer {
    margin-top: 36px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 9px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  @media print {
    body { padding: 20px 28px; }
    .module-block { page-break-inside: avoid; }
    .question-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="doc-header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div class="doc-title">Escopo Técnico do Projeto</div>
      <div class="doc-subtitle">Documento de parametrização e definição técnica — Pontotel</div>
    </div>
    <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/8e48c145a_LogoPontotel_AmarelaePreta.png" style="height:45px" alt="Pontotel" />
  </div>
  <div class="project-meta">
    <div class="meta-item">
      <div class="meta-label">Projeto</div>
      <div class="meta-value">${sanitize(project?.name) || "—"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Cliente</div>
      <div class="meta-value">${sanitize(project?.client_name) || "—"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Data de Geração</div>
      <div class="meta-value">${new Date().toLocaleDateString("pt-BR")}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Data de Início</div>
      <div class="meta-value">${project?.start_date ? new Date(project.start_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Analista Pontotel</div>
      <div class="meta-value">${sanitize(project?.pontotel_analyst_name) || "—"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Gestor Pontotel</div>
      <div class="meta-value">${sanitize(project?.pontotel_manager_name) || "—"}</div>
    </div>
  </div>
  <div class="doc-stats">
    Módulos visíveis: <strong>${visibleModules.length}</strong> &nbsp;|&nbsp;
    Perguntas respondidas: <strong>${answeredQuestions} de ${totalQuestions}</strong>
  </div>
</div>

${modulesHTML}

<div class="doc-footer">
  <span>Escopo Técnico — ${sanitize(project?.name)} | ${sanitize(project?.client_name)}</span>
  <span>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — Pontotel</span>
</div>

</body>
</html>`;

  const fileName = `Escopo_Tecnico_${(project?.name || "Projeto").replace(/\s+/g, "_")}.pdf`;

  const w = window.open("", "_blank");
  if (!w) {
    toast({ title: "Pop-up bloqueado. Permita pop-ups para este site e tente novamente.", variant: "destructive" });
    return;
  }
  w.document.write(html);
  w.document.close();
  w.document.title = fileName;
  w.focus();
  setTimeout(() => {
    w.print();
  }, 600);
}