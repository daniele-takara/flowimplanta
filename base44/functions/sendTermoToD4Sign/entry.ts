import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

const D4SIGN_BASE = "https://secure.d4sign.com.br/api/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      projectId,
      project,
      macroPhases,
      pendingItems,
      finalConsiderations,
      selectedAdendo,
      coordenadora,
      liderImpl,
      gerente,
      sectionOverrides,
      usabilitySnap,
      scopeItems,
      versionLabel,
    } = body;

    const tokenAPI = Deno.env.get("D4SIGN_TOKEN_API");
    const cryptKey = Deno.env.get("D4SIGN_CRYPT_KEY");

    if (!tokenAPI || !cryptKey) {
      return Response.json({ error: "D4Sign não configurado" }, { status: 500 });
    }

    const authParams = `tokenAPI=${encodeURIComponent(tokenAPI)}&cryptKey=${encodeURIComponent(cryptKey)}`;

    // 1. Cofre "Implantação" — UUID fixo
    const safeUuid = "50caeed5-ab5d-4ddf-9cf1-4d668009d561";

    // 2. Generate PDF
    const clientName = sectionOverrides?.client_name || project?.client_name || "Cliente";
    const today = new Date().toLocaleDateString("pt-BR");
    const pdfBytes = generatePDF({
      project, macroPhases, pendingItems, finalConsiderations,
      selectedAdendo, coordenadora, liderImpl, gerente,
      sectionOverrides, usabilitySnap, clientName, today, versionLabel
    });

    // 3. Upload PDF to d4sign as base64
    const base64File = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    const safeFileName = `Termo_Encerramento_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    const uploadResp = await fetch(
      `${D4SIGN_BASE}/documents/${safeUuid}/uploadbinary?${authParams}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64_binary_file: base64File,
          mime_type: "application/pdf",
          name: safeFileName,
        }),
      }
    );
    const uploadData = await uploadResp.json();
    if (!uploadData?.uuid) {
      console.error("D4Sign upload error:", JSON.stringify(uploadData));
      return Response.json({ error: "Falha ao enviar documento para D4Sign", details: uploadData }, { status: 500 });
    }
    const docUuid = uploadData.uuid;

    // 4. Register signers
    const signers = buildSigners(project, coordenadora, liderImpl, gerente);
    if (signers.length === 0) {
      return Response.json({ error: "Nenhum signatário definido" }, { status: 400 });
    }

    const signersResp = await fetch(
      `${D4SIGN_BASE}/documents/${docUuid}/createlist?${authParams}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers }),
      }
    );
    const signersData = await signersResp.json();
    // createlist returns message on success

    // 5. Send for signing
    const sendResp = await fetch(
      `${D4SIGN_BASE}/documents/${docUuid}/sendtosigner?${authParams}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skip_email: "0",
          workflow: "0",
          message: `Termo de Encerramento do Projeto - ${clientName}`,
        }),
      }
    );
    const sendData = await sendResp.json();

    // 6. Update TermoEncerramento with d4sign data
    const termos = await base44.entities.TermoEncerramento.filter({ project_id: projectId, is_current: true });
    if (termos?.length) {
      await base44.entities.TermoEncerramento.update(termos[0].id, {
        status: "Enviado",
        d4sign_doc_uuid: docUuid,
        d4sign_status: "enviado",
        d4sign_sent_at: new Date().toISOString(),
        status_assinatura: "enviado",
        data_envio_assinatura: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      doc_uuid: docUuid,
      message: "Documento enviado para assinatura com sucesso!",
    });
  } catch (error) {
    console.error("sendTermoToD4Sign error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Build signers array ──────────────────────────────────────
// Ordem de assinatura (sequencial):
// 1. Coordenadora → testemunha (act=5)
// 2. Líder de implantação → assinar (act=1)
// 3. Gerente de Operações → assinar (act=1)
// 4. Líder do Projeto (cliente) → assinar (act=1)
function buildSigners(project, coordenadora, liderImpl, gerente) {
  const list = [];

  if (coordenadora?.email) {
    list.push({
      email: coordenadora.email,
      act: "5", // Assinar como testemunha
      foreign: "0",
      certificadoicpbr: "0",
      assinatura_presencial: "0",
    });
  }
  if (liderImpl?.email) {
    list.push({
      email: liderImpl.email,
      act: "1", // Assinar
      foreign: "0",
      certificadoicpbr: "0",
      assinatura_presencial: "0",
    });
  }
  if (gerente?.email) {
    list.push({
      email: gerente.email,
      act: "1", // Assinar
      foreign: "0",
      certificadoicpbr: "0",
      assinatura_presencial: "0",
    });
  }
  if (project?.project_leader_email) {
    list.push({
      email: project.project_leader_email,
      act: "1", // Assinar
      foreign: "0",
      certificadoicpbr: "0",
      assinatura_presencial: "0",
    });
  }

  return list;
}

// ─── PDF Generation ───────────────────────────────────────────
function generatePDF({
  project, macroPhases, pendingItems, finalConsiderations,
  selectedAdendo, coordenadora, liderImpl, gerente,
  sectionOverrides, usabilitySnap, clientName, today, versionLabel
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 190; // page width - margins
  const margin = 10;
  let y = 15;

  function getVal(key, autoRaw) {
    if (sectionOverrides?.[key] !== undefined) return String(sectionOverrides[key]);
    return autoRaw != null ? String(autoRaw) : "";
  }

  function fmtDate(d) {
    if (!d) return "—";
    return d.substring(8, 10) + "/" + d.substring(5, 7) + "/" + d.substring(0, 4);
  }

  function addLine(text, size = 10, bold = false, color = [30, 41, 59]) {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(text, margin, y);
    y += size * 0.45;
  }

  function addSectionTitle(title) {
    y += 4;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), margin, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 62, y - 1, margin + pw, y - 1);
    y += 8;
  }

  // Header
  doc.setFontSize(18);
  doc.setTextColor(124, 58, 237);
  doc.setFont("helvetica", "bold");
  doc.text("Termo de Encerramento do Projeto", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`${clientName} · ${getVal("implantation_type", project?.implantation_type)} · ${today}`, margin, y);
  if (versionLabel) doc.text(versionLabel, margin + pw - 30, y);
  y += 12;

  // 1. Identificação
  addSectionTitle("IDENTIFICAÇÃO DO PROJETO");
  addRow(doc, y, "Cliente", getVal("client_name", project?.client_name)); y += 6;
  addRow(doc, y, "Tipo de Implantação", getVal("implantation_type", project?.implantation_type)); y += 6;
  addRow(doc, y, "Gerente Pontotel", getVal("pontotel_manager_name", project?.pontotel_manager_name)); y += 6;
  addRow(doc, y, "Analista", getVal("pontotel_analyst_name", project?.pontotel_analyst_name)); y += 6;
  addRow(doc, y, "Líder do Projeto (Cliente)", getVal("project_leader_name", project?.project_leader_name)); y += 6;
  addRow(doc, y, "Patrocinador", getVal("sponsor_name", project?.sponsor_name)); y += 6;
  addRow(doc, y, "Data de Início", fmtDate(getVal("start_date", project?.start_date))); y += 6;
  addRow(doc, y, "Data de Encerramento", fmtDate(getVal("end_date", project?.aligned_end_date || project?.planned_end_date))); y += 10;

  // 2. Resumo
  addSectionTitle("RESUMO DO PROJETO");
  const contracted = parseInt(getVal("contracted_employees", project?.contracted_employees) || "0");
  const cadastrados = parseInt(getVal("registered_employees", usabilitySnap?.registered_employees) || "0");
  const aderencia = contracted > 0 ? Math.round((parseInt(getVal("recording_employees", usabilitySnap?.recording_employees) || "0") / contracted) * 100) : 0;
  addRow(doc, y, "Funcionários Contratados", contracted.toLocaleString("pt-BR")); y += 6;
  addRow(doc, y, "Funcionários Cadastrados", cadastrados.toLocaleString("pt-BR")); y += 6;
  if (contracted > 0) { addRow(doc, y, "Aderência ao Registro de Ponto", `${aderencia}%`); y += 6; }
  addRow(doc, y, "Progresso Geral", getVal("progress_percent", project?.progress_percent) + "%"); y += 10;

  // 3. Cronograma
  addSectionTitle("CRONOGRAMA");
  if (macroPhases?.length) {
    const colX = [margin, 55, 80, 105, 130, 155];
    const headerY = y;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Etapa", colX[0], headerY);
    doc.text("Início Plan.", colX[1], headerY);
    doc.text("Fim Plan.", colX[2], headerY);
    doc.text("Início Real.", colX[3], headerY);
    doc.text("Fim Real.", colX[4], headerY);
    doc.text("Status", colX[5], headerY);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const ph of macroPhases) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text((ph.phase || "").substring(0, 28), colX[0], y);
      doc.text(fmtDate(ph.plannedStart), colX[1], y);
      doc.text(fmtDate(ph.plannedEnd), colX[2], y);
      doc.text(fmtDate(ph.actualStart), colX[3], y);
      doc.text(fmtDate(ph.actualEnd), colX[4], y);
      const statusColor = ph.status === "Concluído" ? [22, 101, 52] : ph.status === "Em andamento" ? [109, 40, 217] : ph.status === "Atrasado" ? [153, 27, 27] : [100, 116, 139];
      doc.setTextColor(...statusColor);
      doc.text(ph.status || "—", colX[5], y);
      y += 4.5;
    }
    y += 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma fase calculada", margin, y);
    y += 10;
  }

  // 4. Pendências
  if (pendingItems?.length) {
    addSectionTitle("PENDÊNCIAS");
    for (const p of pendingItems) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.text(`• ${p.item || "—"} — ${p.responsible || "—"} (prazo: ${fmtDate(p.deadline)})`, margin, y, { maxWidth: pw });
      y += 5;
    }
    y += 6;
  }

  // 5. Adendo
  if (selectedAdendo) {
    addSectionTitle("ADENDO");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`${selectedAdendo.title} [${selectedAdendo.type}]`, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const content = (selectedAdendo.content || "").substring(0, 500);
    doc.text(content, margin, y, { maxWidth: pw });
    y += 10;
  }

  // 6. Considerações finais
  if (finalConsiderations) {
    addSectionTitle("CONSIDERAÇÕES FINAIS");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(finalConsiderations, pw);
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 8;
  }

  // 7. Assinaturas
  addSectionTitle("ACEITE E ASSINATURAS");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.text(`Ao assinar este documento, as partes declaram estar de acordo com os termos e condições do encerramento do projeto de implantação da Pontotel para ${clientName}.`, margin, y, { maxWidth: pw });
  y += 12;

  const sigW = (pw - 30) / 4;
  const sigs = [
    { name: coordenadora?.name || "Coordenadora", role: "Coordenadora de implantação (testemunha)" },
    { name: liderImpl?.name || "Líder de Implantação", role: "Líder de implantação" },
    { name: gerente?.name || "Gerente de Operações", role: "Gerente de Operações" },
    { name: project?.project_leader_name || "Líder do Projeto", role: `${clientName} · Líder do Projeto` },
  ];
  sigs.forEach((s, i) => {
    const sx = margin + (i * (sigW + 10));
    doc.setDrawColor(203, 213, 225);
    doc.rect(sx, y, sigW, 30);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(s.name, sx + sigW / 2, y + 16, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(s.role, sx + sigW / 2, y + 22, { align: "center" });
  });

  return doc.output("arraybuffer");
}

function addRow(doc, y, label, value) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(label, 10, y);
  doc.setTextColor(30, 41, 59);
  doc.text(value || "—", 55, y);
}