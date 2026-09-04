import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Connector ID do "Gmail FlowImplanta" (APP_USER mode) cadastrado no workspace
const GMAIL_CONNECTOR_ID = "6a9acfd915942e418033757b";

// Base64url-encode de uma string UTF-8
function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// RFC 2047 encoded-word para headers com non-ASCII (acentos, emoji)
function encodeHeader(str) {
  if (!str) return "";
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

// Monta mensagem RFC 2822 com headers UTF-8 + corpo HTML
function buildMimeMessage({ to, cc, subject, html, fromName }) {
  const headers = [
    fromName ? `From: ${encodeHeader(fromName)} <${"me"}>` : "From: me",
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${html}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Tenta obter a conexão Gmail do usuário atual (APP_USER)
    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
    } catch (e) {
      return Response.json({ connected: false, error: "Gmail não conectado" }, { status: 200 });
    }

    const accessToken = connection.accessToken;
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Modo check-only: só verifica se está conectado e retorna o e-mail do usuário
    if (body?.checkOnly) {
      try {
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: authHeader });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          return Response.json({ connected: true, email: profile.emailAddress });
        }
      } catch (e) {
        // ignora — retorna conectado sem e-mail
      }
      return Response.json({ connected: true });
    }

    // Envio: valida campos obrigatórios
    if (!body?.to || !body?.subject || !body?.html) {
      return Response.json({ error: "Campos obrigatórios: to, subject, html" }, { status: 400 });
    }

    const mimeMessage = buildMimeMessage({
      to: body.to,
      cc: body.cc || null,
      subject: body.subject,
      html: body.html,
      fromName: body.fromName || null,
    });
    const raw = base64UrlEncode(mimeMessage);

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return Response.json({ error: `Gmail API erro ${sendRes.status}: ${errText}` }, { status: 502 });
    }

    const result = await sendRes.json();
    return Response.json({ success: true, messageId: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}