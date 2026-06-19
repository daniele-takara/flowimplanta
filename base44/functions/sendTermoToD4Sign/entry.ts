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
      clienteSignatario,
    } = body;

    const tokenAPI = Deno.env.get("D4SIGN_TOKEN_API");
    const cryptKey = Deno.env.get("D4SIGN_CRYPT_KEY");

    if (!tokenAPI || !cryptKey) {
      return Response.json({ error: "D4Sign não configurado" }, { status: 500 });
    }

    const authParams = `tokenAPI=${encodeURIComponent(tokenAPI)}&cryptKey=${encodeURIComponent(cryptKey)}`;

    // 1. Cofre "Implantação" — UUID fixo
    const safeUuid = "50caeed5-ab5d-4ddf-9cf1-4d668009d561";

    // 2. Load logo
    let logoDataUrl = null;
    const logoUrl = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/7182abf05_LogoPontotel_AmarelaePreta.png";
    try {
      const logoResp = await fetch(logoUrl);
      if (logoResp.ok) {
        const logoBuf = await logoResp.arrayBuffer();
        logoDataUrl = `data:image/png;base64,${arrayBufferToBase64(logoBuf)}`;
      }
    } catch (_) { /* ignora erro de carregamento do logo */ }

    // 3. Generate PDF
    const clientName = sectionOverrides?.client_name || project?.client_name || "Cliente";
    const today = new Date().toLocaleDateString("pt-BR");
    const pdfBytes = generatePDF({
      project, macroPhases, pendingItems, finalConsiderations,
      selectedAdendo, coordenadora, liderImpl, gerente, clienteSignatario,
      sectionOverrides, usabilitySnap, clientName, today, versionLabel, logoDataUrl
    });

    // 4. Upload PDF to d4sign as base64
    const base64File = arrayBufferToBase64(pdfBytes);
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

    // 5. Buscar signatários existentes do documento (herdados do cofre)
    const listResp = await fetch(
      `${D4SIGN_BASE}/documents/${docUuid}/list?${authParams}`
    );
    const docData = await listResp.json();

    // docData.list pode ser um array ou um objeto (single signer)
    const rawList = docData?.list;
    let existingSigners = [];
    if (Array.isArray(rawList)) {
      existingSigners = rawList;
    } else if (rawList && typeof rawList === "object") {
      existingSigners = [rawList];
    }

    console.log("Existing signers from vault:", JSON.stringify(existingSigners.map(s => ({ email: s.email, act: s.act, key_signer: s.key_signer }))));

    // 6. Construir nossos signatários agrupados por papel (com dedup)
    const seenEmails = new Set();
    const addSigner = (email, name, role, act) => {
      const e = (email || "").trim().toLowerCase();
      if (!e || seenEmails.has(e)) return;
      seenEmails.add(e);
      return { email: e, name: name || "", role, act };
    };

    const ourTestemunha = addSigner(liderImpl?.email, liderImpl?.name, "testemunha", "5");
    const ourCoordenadora = addSigner(coordenadora?.email, coordenadora?.name, "coordenadora", "1");
    const ourGerente = addSigner(gerente?.email, gerente?.name, "gerente", "1");
    const cliEmail = (clienteSignatario?.email || project?.project_leader_email || "").trim().toLowerCase();
    const cliName = clienteSignatario?.name || project?.project_leader_name || "";
    const ourCliente = addSigner(cliEmail, cliName, "cliente", "1");

    const ourRegulares = [ourCoordenadora, ourGerente, ourCliente].filter(Boolean);

    const allOurSigners = [ourTestemunha, ...ourRegulares].filter(Boolean);
    if (allOurSigners.length === 0) {
      return Response.json({ error: "Nenhum signatário definido" }, { status: 400 });
    }

    console.log("Our signers:", JSON.stringify(allOurSigners.map(s => ({ email: s.email, role: s.role }))));

    // 7. Separar posições do cofre por tipo
    const vaultTestemunhas = existingSigners.filter(s => String(s.act) === "5");
    const vaultRegulares = existingSigners.filter(s => String(s.act) !== "5");

    console.log(`Vault: ${vaultTestemunhas.length} testemunhas, ${vaultRegulares.length} regulares`);

    // 8. Helper para trocar email de uma posição do cofre
    const changeSignerEmail = async (vaultPos, ourSigner) => {
      const vaultEmail = (vaultPos.email || "").trim().toLowerCase();
      if (vaultEmail === ourSigner.email) {
        console.log(`  → email já está correto: ${ourSigner.email} (${ourSigner.role})`);
      } else {
        console.log(`  → trocando ${vaultEmail} → ${ourSigner.email} (${ourSigner.role})`);
        const changeResp = await fetch(
          `${D4SIGN_BASE}/documents/${docUuid}/changeemail?${authParams}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "email-before": vaultPos.email,
              "email-after": ourSigner.email,
              "key-signer": vaultPos.key_signer,
            }),
          }
        );
        const changeData = await changeResp.json();
        if (!changeResp.ok) {
          console.error(`changeemail failed for ${ourSigner.role}:`, JSON.stringify(changeData));
        }
      }

      if (ourSigner.name) {
        await fetch(
          `${D4SIGN_BASE}/documents/${docUuid}/addinfo?${authParams}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key_signer: vaultPos.key_signer,
              email: ourSigner.email,
              display_name: ourSigner.name,
            }),
          }
        );
      }
    };

    // 9. Mapear testemunha: se o cofre tem vaga de testemunha E temos líder, mapeia
    const unmappedRegulars = [...ourRegulares];
    if (ourTestemunha && vaultTestemunhas.length > 0) {
      await changeSignerEmail(vaultTestemunhas[0], ourTestemunha);
    } else if (ourTestemunha && vaultTestemunhas.length === 0) {
      // Cofre não tem vaga de testemunha → adicionar via createlist depois
      unmappedRegulars.unshift(ourTestemunha);
    }
    // Se o cofre tem vaga de testemunha mas não temos líder, deixamos a vaga como está

    // 10. Mapear regulares (coordenadora → gerente → cliente) nas vagas restantes do cofre
    let regularIdx = 0;
    for (const vaultPos of vaultRegulares) {
      if (regularIdx < unmappedRegulars.length) {
        await changeSignerEmail(vaultPos, unmappedRegulars[regularIdx]);
        regularIdx++;
      }
      // Se acabaram nossos signatários, as vagas restantes do cofre ficam como estão
    }

    // 11. Signatários que sobraram → adicionar via createlist
    const remaining = unmappedRegulars.slice(regularIdx);
    if (remaining.length > 0) {
      console.log(`Adding ${remaining.length} extra signers via createlist`);

      const extraSigners = remaining.map(s => ({
        email: s.email,
        act: s.act,
        foreign: "0",
        certificadoicpbr: "0",
        assinatura_presencial: "0",
      }));

      const createlistResp = await fetch(
        `${D4SIGN_BASE}/documents/${docUuid}/createlist?${authParams}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signers: extraSigners }),
        }
      );
      const createlistData = await createlistResp.json();
      console.log("createlist response:", JSON.stringify(createlistData));
      if (!createlistResp.ok) {
        console.error("createlist failed:", JSON.stringify(createlistData));
      }

      for (const s of remaining) {
        if (s.name) {
          await fetch(
            `${D4SIGN_BASE}/documents/${docUuid}/addinfo?${authParams}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key_signer: s.email,
                email: s.email,
                display_name: s.name,
              }),
            }
          );
        }
      }
    }

    // 12. Send for signing
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
    console.log("sendtosigner response:", JSON.stringify(sendData));
    if (!sendResp.ok) {
      console.error("sendtosigner failed:", JSON.stringify(sendData));
      return Response.json({ error: "Falha ao enviar para assinatura", details: sendData }, { status: 500 });
    }

    // 11. Update TermoEncerramento with d4sign data
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

// ─── PDF Generation ───────────────────────────────────────────
function generatePDF({
  project, macroPhases, pendingItems, finalConsiderations,
  selectedAdendo, coordenadora, liderImpl, gerente, clienteSignatario,
  sectionOverrides, usabilitySnap, clientName, today, versionLabel, logoDataUrl
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 10;
  const PW = 190;
  const PAGE_H = 287;
  let y = 15;

  function getVal(key, autoRaw) {
    if (sectionOverrides?.[key] !== undefined) return String(sectionOverrides[key]);
    return autoRaw != null ? String(autoRaw) : "";
  }

  function fmt(d) { if (!d) return "—"; return d.substring(8, 10) + "/" + d.substring(5, 7) + "/" + d.substring(0, 4); }

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

  function addBlock(text, fontSize = 9, color = [30, 41, 59], indent = 0) {
    if (!text) return;
    checkPage(5);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(text), PW - indent);
    for (const ln of lines) {
      checkPage(5);
      doc.text(ln, M + indent, y);
      y += fontSize * 0.45;
    }
    y += 2;
  }

  // HEADER
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", M + PW - 38, y - 2, 38, 14);
  }

  doc.setFontSize(18);
  doc.setTextColor(124, 58, 237);
  doc.setFont("helvetica", "bold");
  doc.text("Termo de Encerramento do Projeto", M, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  const headerMeta = `${clientName} · ${getVal("implantation_type", project?.implantation_type)} · ${today}`;
  doc.text(headerMeta, M, y);
  if (versionLabel) doc.text(versionLabel, M + PW - 25, y);
  y += 3;
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + PW, y);
  doc.setLineWidth(0.2);
  y += 6;

  // 1. IDENTIFICAÇÃO
  sectionTitle("IDENTIFICAÇÃO DO PROJETO");
  addRow("Cliente", getVal("client_name", project?.client_name));
  addRow("Tipo de Implantação", getVal("implantation_type", project?.implantation_type));
  addRow("Gerente Pontotel", getVal("pontotel_manager_name", project?.pontotel_manager_name));
  addRow("Analista", getVal("pontotel_analyst_name", project?.pontotel_analyst_name));
  addRow("Líder do Projeto (Cliente)", getVal("project_leader_name", project?.project_leader_name));
  addRow("Patrocinador", getVal("sponsor_name", project?.sponsor_name));
  addRow("Data de Início", fmt(getVal("start_date", project?.start_date)));
  addRow("Data de Encerramento", fmt(getVal("end_date", project?.aligned_end_date || project?.planned_end_date)));
  y += 4;

  // 2. RESUMO
  sectionTitle("RESUMO DO PROJETO");
  const contracted = parseInt(getVal("contracted_employees", project?.contracted_employees) || "0");
  const cadastrados = parseInt(getVal("registered_employees", usabilitySnap?.registered_employees) || "0");
  const aderencia = contracted > 0 ? Math.round((parseInt(getVal("recording_employees", usabilitySnap?.recording_employees) || "0") / contracted) * 100) : 0;
  addRow("Funcionários Contratados", contracted.toLocaleString("pt-BR"));
  addRow("Funcionários Cadastrados", cadastrados.toLocaleString("pt-BR"));
  if (contracted > 0) addRow("Aderência ao Registro de Ponto", `${aderencia}%`);
  addRow("Progresso Geral do Projeto", getVal("progress_percent", project?.progress_percent) + "%");
  y += 4;

  // 3. CRONOGRAMA
  sectionTitle("CRONOGRAMA PLANEJADO VS REALIZADO");
  if (macroPhases?.length) {
    const cols = [M, 53, 77, 101, 125, 149];
    checkPage(6);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Etapa", cols[0], y);
    doc.text("Início Plan.", cols[1], y);
    doc.text("Fim Plan.", cols[2], y);
    doc.text("Início Real.", cols[3], y);
    doc.text("Fim Real.", cols[4], y);
    doc.text("Status", cols[5], y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    for (const ph of macroPhases) {
      checkPage(4.5);
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text((ph.phase || "").substring(0, 27), cols[0], y);
      doc.text(fmt(ph.plannedStart), cols[1], y);
      doc.text(fmt(ph.plannedEnd), cols[2], y);
      doc.text(fmt(ph.actualStart), cols[3], y);
      doc.text(fmt(ph.actualEnd), cols[4], y);
      const sc = ph.status === "Concluído" ? [22, 101, 52] : ph.status === "Em andamento" ? [109, 40, 217] : ph.status === "Atrasado" ? [153, 27, 27] : [100, 116, 139];
      doc.setTextColor(...sc);
      doc.text(ph.status || "—", cols[5], y);
      y += 4.5;
    }
    y += 4;
  } else {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma fase calculada", M, y);
    y += 8;
  }

  // 4. PENDÊNCIAS
  if (pendingItems?.length) {
    sectionTitle("PENDÊNCIAS");
    const pCols = [M, 100, 140];
    checkPage(5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Pendência", pCols[0], y);
    doc.text("Responsável", pCols[1], y);
    doc.text("Prazo", pCols[2], y);
    y += 4;
    doc.setFont("helvetica", "normal");
    for (const p of pendingItems) {
      checkPage(4);
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text((p.item || "—").substring(0, 38), pCols[0], y);
      doc.text((p.responsible || "—").substring(0, 20), pCols[1], y);
      doc.text(fmt(p.deadline), pCols[2], y);
      y += 4;
    }
    y += 4;
  }

  // 5. ADENDO
  if (selectedAdendo) {
    sectionTitle("ADENDO");
    checkPage(6);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`${selectedAdendo.title}  [${selectedAdendo.type}]`, M, y);
    y += 5;
    addBlock(selectedAdendo.content, 8, [30, 41, 59]);
    y += 2;
  }

  // 6. CONSIDERAÇÕES FINAIS
  if (finalConsiderations) {
    sectionTitle("CONSIDERAÇÕES FINAIS");
    addBlock(finalConsiderations, 9, [30, 41, 59]);
    y += 2;
  }

  // 7. ASSINATURAS
  sectionTitle("ACEITE E ASSINATURAS");
  addBlock(`Ao assinar este documento, as partes declaram estar de acordo com os termos e condições do encerramento do projeto de implantação da Pontotel para ${clientName}, confirmando que todas as atividades previstas foram concluídas conforme acordado.`, 9, [51, 65, 85]);
  y += 2;

  const clienteNome = clienteSignatario?.name || project?.project_leader_name || "Líder do Projeto";
  const sigBoxes = [
    { name: liderImpl?.name || "Líder de Implantação", role: "Pontotel · Testemunha", email: liderImpl?.email || "" },
  ];
  if (coordenadora?.email) sigBoxes.push({ name: coordenadora.name || "Coordenadora de Implantação", role: "Pontotel · Coordenadora de implantação", email: coordenadora.email });
  if (gerente?.email) sigBoxes.push({ name: gerente.name || "Gerente de Operações", role: "Pontotel · Gerente de Operações", email: gerente.email });
  sigBoxes.push({ name: clienteNome, role: `${clientName} · Líder do Projeto`, email: clienteSignatario?.email || project?.project_leader_contact || "" });

  const sigCount = sigBoxes.length;
  const gap = 6;
  const sigW = (PW - ((sigCount - 1) * gap)) / sigCount;
  const sigH = 30;
  checkPage(sigH + 5);
  const sigY = y;
  sigBoxes.forEach((s, i) => {
    const sx = M + (i * (sigW + gap));
    const cx = sx + sigW / 2;
    doc.setDrawColor(203, 213, 225);
    doc.rect(sx, sigY, sigW, sigH);
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    const nameLn = doc.splitTextToSize(s.name || "—", sigW - 4);
    nameLn.slice(0, 2).forEach((ln, li) => doc.text(ln, cx, sigY + 14 + li * 3.5, { align: "center" }));
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    const roleLn = doc.splitTextToSize(s.role || "", sigW - 4);
    roleLn.slice(0, 2).forEach((ln, li) => doc.text(ln, cx, sigY + 22 + li * 3, { align: "center" }));
  });
  y = sigY + sigH + 5;

  return doc.output("arraybuffer");
}

// ─── Helper: arrayBuffer → base64 (chunked, avoids stack overflow) ───
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}