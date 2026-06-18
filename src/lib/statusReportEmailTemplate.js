/**
 * Gera HTML inline-styled compatível com Gmail/Outlook para o Status Report.
 * Seções com valores vazios/null/N/A são automaticamente ocultadas.
 */

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.substring(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === "string") return val.trim() === "" || /^n\/?a$/i.test(val.trim());
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function statusColor(status) {
  switch (status) {
    case "Concluído":   return { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" };
    case "Em andamento": return { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" };
    case "Atrasado":   return { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" };
    default:           return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
  }
}

function badge(status) {
  const c = statusColor(status);
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border}">${status || "—"}</span>`;
}

function progressBar(pct, status) {
  const color = status === "Atrasado" ? "#ef4444" : "#22c55e";
  const barPx = Math.round((pct || 0) * 0.8);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:8px;">
          <table width="80" cellpadding="0" cellspacing="0" border="0" style="border-radius:4px;overflow:hidden;background:#e2e8f0;height:6px;">
            <tr>
              <td width="${barPx}" style="background:${color};height:6px;"></td>
              <td></td>
            </tr>
          </table>
        </td>
        <td style="font-size:12px;font-weight:700;color:#475569;white-space:nowrap;">${pct}%</td>
      </tr>
    </table>`;
}

export function generateStatusReportEmail({ project, form, macroPhases, overallProgress, usabilityData, report }) {
  const today = new Date().toLocaleDateString("pt-BR");
  const contracted = project?.contracted_employees || 0;
  // Source único: usabilityData (passado pelo StatusReportTab com kpiData exibido na UI)
  // Fallback para report persistido apenas se usabilityData não tiver sido passado
  const cadastrados = usabilityData?.numero_funcionarios ?? report?.registered_employees ?? 0;
  const batendoPonto = usabilityData?.empregados_batendo_ponto_ultimos_15_dias ?? report?.recording_employees ?? 0;
  const aderencia = contracted > 0 ? Math.round((batendoPonto / contracted) * 100) : (report?.adherence_percent ?? 0);
  const periodStart = fmtDate(project?.start_date);
  const periodEnd = fmtDate(project?.aligned_end_date || project?.planned_end_date);

  // ── Seções condicionais ────────────────────────────────────────────────────
  const hasAgenda   = !isEmpty(form?.next_agenda);
  const hasSummary  = !isEmpty(form?.executive_summary);
  const hasClient   = !isEmpty(form?.client_pending);
  const hasInternal = !isEmpty(form?.internal_pending);
  const hasInteg    = !isEmpty(form?.integration_items);
  const hasRisks    = !isEmpty(form?.risks);
  const hasMacro    = Array.isArray(macroPhases) && macroPhases.length > 0;

  // ── Cronograma macro ───────────────────────────────────────────────────────
  const macroRows = hasMacro ? macroPhases.map(ph => {
    const c = statusColor(ph.status);
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#334155;">${ph.phase}</td>
        <td style="padding:10px 12px;font-size:12px;color:#64748b;">${fmtDate(ph.plannedStart) || "—"}</td>
        <td style="padding:10px 12px;font-size:12px;color:#64748b;">${fmtDate(ph.plannedEnd) || "—"}</td>
        <td style="padding:10px 12px;">${progressBar(ph.progress || 0, ph.status)}</td>
        <td style="padding:10px 12px;">${badge(ph.status)}</td>
      </tr>`;
  }).join("") : "";

  // ── Pendências helper ──────────────────────────────────────────────────────
  function pendingRows(items) {
    return (items || []).map(it => `
      <tr style="border-bottom:1px solid #f8fafc;">
        <td style="padding:8px 12px;font-size:13px;color:#334155;">${it.item || ""}</td>
        <td style="padding:8px 12px;font-size:12px;color:#64748b;white-space:nowrap;">${it.deadline ? fmtDate(it.deadline) : "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:#64748b;">${it.responsible || "—"}</td>
      </tr>`).join("");
  }

  function pendingTable(title, items, accentColor) {
    if (isEmpty(items)) return "";
    return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#f8fafc;">
        <td colspan="3" style="padding:12px 16px;font-size:12px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1px;">${title}</td>
      </tr>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Item</th>
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Prazo</th>
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Responsável</th>
      </tr>
      ${pendingRows(items)}
    </table>`;
  }

  // ── Riscos ─────────────────────────────────────────────────────────────────
  function riskRows(items) {
    return (items || []).map(it => `
      <tr style="border-bottom:1px solid #f8fafc;">
        <td style="padding:8px 12px;font-size:13px;color:#334155;">${it.description || ""}</td>
        <td style="padding:8px 12px;">${badge(it.impact)}</td>
        <td style="padding:8px 12px;font-size:12px;color:#64748b;">${it.mitigation || "—"}</td>
      </tr>`).join("");
  }

  // ── KPI Card helper ────────────────────────────────────────────────────────
  function kpiCard(label, value, sub, bgColor, textColor) {
    return `
      <td width="25%" style="padding:0 6px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bgColor};border-radius:12px;padding:16px;">
          <tr><td style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${label}</td></tr>
          <tr><td style="font-size:26px;font-weight:900;color:${textColor};padding:6px 0 2px;">${value}</td></tr>
          ${sub ? `<tr><td style="font-size:11px;color:#94a3b8;">${sub}</td></tr>` : ""}
        </table>
      </td>`;
  }

  const aderenciaColor = aderencia >= 80 ? "#166534" : aderencia >= 50 ? "#9a3412" : "#991b1b";
  const aderenciaBg    = aderencia >= 80 ? "#dcfce7" : aderencia >= 50 ? "#ffedd5" : "#fee2e2";

  // ── HTML final ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:24px 16px;">
<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#6d28d9,#4c1d95);border-radius:16px;padding:28px 32px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:2px;"><img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1ea94c9b2_LogoPontotel_AmarelaeBranca.png" style="height:18px;vertical-align:middle;border:0" alt="Pontotel" /> · Implantação</p>
            <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#ffffff;">Status do Projeto</h1>
            <p style="margin:0;font-size:14px;color:#ddd6fe;">${project?.client_name || ""}</p>
          </td>
          <td align="right" style="vertical-align:top;">
            <p style="margin:0 0 2px;font-size:11px;color:#c4b5fd;">Data do relatório</p>
            <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${today}</p>
            ${(periodStart || periodEnd) ? `<p style="margin:4px 0 0;font-size:11px;color:#c4b5fd;">${periodStart || ""} → ${periodEnd || ""}</p>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- KPIs -->
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr style="margin:-6px;">
          ${kpiCard("Empregados Cadastrados", cadastrados.toLocaleString("pt-BR"), `de ${contracted.toLocaleString("pt-BR")} contratados`, "#f5f3ff", "#5b21b6")}
          ${kpiCard("No Ponto / mês", batendoPonto.toLocaleString("pt-BR"), "últimos 15 dias", "#eff6ff", "#1d4ed8")}
          ${kpiCard("Aderência ao Ponto", `${aderencia}%`, "do contratado", aderenciaBg, aderenciaColor)}
          ${kpiCard("Progresso do Projeto", `${overallProgress || 0}%`, "média das fases", "#f5f3ff", "#5b21b6")}
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="height:20px;"></td></tr>

  ${hasMacro ? `
  <!-- CRONOGRAMA MACRO -->
  <tr>
    <td style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr style="background:#f8fafc;">
          <td colspan="5" style="padding:14px 16px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Cronograma do Projeto</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Etapa</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Início Plan.</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Fim Plan.</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Progresso</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Status</th>
        </tr>
        ${macroRows}
      </table>
    </td>
  </tr>
  <tr><td style="height:20px;"></td></tr>
  ` : ""}

  ${hasAgenda ? `
  <!-- PRÓXIMA AGENDA -->
  <tr>
    <td style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">📅 Próxima Agenda</p>
      <p style="margin:0;font-size:14px;color:#334155;">${form.next_agenda}</p>
      ${!isEmpty(form?.next_agenda_date) ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${fmtDate(form.next_agenda_date)}</p>` : ""}
    </td>
  </tr>
  <tr><td style="height:12px;"></td></tr>
  ` : ""}

  ${hasSummary ? `
  <!-- OBSERVAÇÕES EXECUTIVAS -->
  <tr>
    <td style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Observações Executivas</p>
      <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.6;">${form.executive_summary}</p>
    </td>
  </tr>
  <tr><td style="height:16px;"></td></tr>
  ` : ""}

  ${hasClient ? `<tr><td>${pendingTable("Pendências do Cliente", form.client_pending, "#ea580c")}</td></tr>` : ""}
  ${hasInternal ? `<tr><td>${pendingTable("Pendências Pontotel", form.internal_pending, "#2563eb")}</td></tr>` : ""}

  ${hasInteg ? `
  <!-- INTEGRAÇÃO -->
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr style="background:#f8fafc;">
          <td colspan="2" style="padding:12px 16px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;">Integração</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Item</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Status</th>
        </tr>
        ${(form.integration_items || []).map(it => `
        <tr style="border-bottom:1px solid #f8fafc;">
          <td style="padding:8px 12px;font-size:13px;color:#334155;">${it.item || ""}</td>
          <td style="padding:8px 12px;font-size:12px;color:#64748b;">${it.status || "—"}</td>
        </tr>`).join("")}
      </table>
    </td>
  </tr>
  ` : ""}

  ${hasRisks ? `
  <!-- RISCOS -->
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr style="background:#f8fafc;">
          <td colspan="3" style="padding:12px 16px;font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;">⚠ Riscos</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Descrição</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Impacto</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#94a3b8;text-align:left;">Mitigação</th>
        </tr>
        ${riskRows(form.risks)}
      </table>
    </td>
  </tr>
  ` : ""}

  <!-- FOOTER -->
  <tr>
    <td style="padding:16px 0;text-align:center;font-size:11px;color:#94a3b8;">
      Gerado automaticamente pelo Flowimplanta · <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1ea94c9b2_LogoPontotel_AmarelaeBranca.png" style="height:14px;vertical-align:middle;border:0" alt="Pontotel" />
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}