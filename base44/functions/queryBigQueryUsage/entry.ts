import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      return Response.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON não configurado" }, { status: 500 });
    }

    const { comp_man_id, code, empresa_id, limite, client_name } = await req.json().catch(() => ({}));

    const credentials = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(credentials);
    const projectId = credentials.project_id;
    const bqUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

    const runQuery = async (sql, params = []) => {
      const resp = await fetch(bqUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, queryParameters: params, useLegacySql: false, useQueryCache: true }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || "Erro BigQuery");
      return data;
    };

    const formatRows = (bqData) => {
      const columns = (bqData.schema?.fields || []).map(f => f.name);
      return (bqData.rows || []).map(row => {
        const obj = {};
        (row.f || []).forEach((field, i) => {
          const colName = columns[i];
          let val = field.v;
          if (colName === "snapshot_at" && val) {
            try {
              obj["snapshot_at_formatted"] = new Date(parseFloat(val) * 1000).toISOString().split("T")[0];
            } catch (_) {}
          }
          obj[colName] = val;
        });
        return obj;
      });
    };

    // Resolver o comp_man_id: aceita code, comp_man_id direto, ou empresa_id
    let resolvedCompManId = comp_man_id || empresa_id;
    let clientData = null;

    const searchInput = code || resolvedCompManId;

    if (code) {
      // Buscar o comp_man_id via vw_xref_code
      try {
        const xrefData = await runQuery(
          `SELECT comp_man_id FROM \`pontotel-homepage.customer_intelligence.vw_xref_code\` WHERE code = @code LIMIT 1`,
          [{ name: "code", parameterType: { type: "STRING" }, parameterValue: { value: String(code) } }]
        );
        if (parseInt(xrefData.totalRows || "0") > 0) {
          resolvedCompManId = xrefData.rows[0].f[0].v;
        }
      } catch (_) {}
    }

    if (!searchInput && !client_name) {
      return Response.json({ error: "Informe code, comp_man_id, empresa_id ou client_name" }, { status: 400 });
    }

    // Buscar dados do cliente (dim_clientes)
    try {
      let clientQuery, clientParams;
      if (code) {
        clientQuery = `SELECT * FROM \`pontotel-homepage.customer_intelligence.dim_clientes\` WHERE comp_man_code = @id ORDER BY snapshot_at DESC LIMIT 1`;
      } else {
        clientQuery = `SELECT * FROM \`pontotel-homepage.customer_intelligence.dim_clientes\` WHERE comp_man_id = @id ORDER BY snapshot_at DESC LIMIT 1`;
      }
      clientParams = [{ name: "id", parameterType: { type: "STRING" }, parameterValue: { value: String(searchInput) } }];
      const clientResp = await runQuery(clientQuery, clientParams);
      if (parseInt(clientResp.totalRows || "0") > 0) {
        const cols = (clientResp.schema?.fields || []).map(f => f.name);
        const row = clientResp.rows[0];
        clientData = {};
        (row.f || []).forEach((field, i) => {
          clientData[cols[i]] = field.v;
        });
        // Garantir que temos o comp_man_id correto do dim_clientes
        if (clientData.comp_man_id && !resolvedCompManId) {
          resolvedCompManId = clientData.comp_man_id;
        }
      }
    } catch (_) {}

    // Fallback: se não achou por code/comp_man_id, tenta pelo nome do cliente
    if (!clientData && client_name) {
      const nameFields = ["nome", "razao_social", "comp_man_name", "name"];
      for (const field of nameFields) {
        try {
          const nameQuery = `SELECT * FROM \`pontotel-homepage.customer_intelligence.dim_clientes\` WHERE LOWER(\`${field}\`) LIKE @name ORDER BY snapshot_at DESC LIMIT 1`;
          const nameParams = [{ name: "name", parameterType: { type: "STRING" }, parameterValue: { value: `%${String(client_name).toLowerCase()}%` } }];
          const nameResp = await runQuery(nameQuery, nameParams);
          if (parseInt(nameResp.totalRows || "0") > 0) {
            const cols = (nameResp.schema?.fields || []).map(f => f.name);
            const row = nameResp.rows[0];
            clientData = {};
            (row.f || []).forEach((field, i) => {
              clientData[cols[i]] = field.v;
            });
            if (clientData.comp_man_id && !resolvedCompManId) {
              resolvedCompManId = clientData.comp_man_id;
            }
            break;
          }
        } catch (_) {}
      }
    }

    // Buscar dados de uso do produto (fct_uso_produto)
    let usageRows = [];
    let usageColumns = [];
    let totalRows = 0;
    let usedFallbackId = false;

    if (resolvedCompManId) {
      try {
        const usageData = await runQuery(
          `SELECT * FROM \`pontotel-homepage.customer_intelligence.fct_uso_produto\` WHERE comp_man_id = @id ORDER BY snapshot_at DESC LIMIT @limite`,
          [
            { name: "id", parameterType: { type: "STRING" }, parameterValue: { value: String(resolvedCompManId) } },
            { name: "limite", parameterType: { type: "INT64" }, parameterValue: { value: String(limite || 10) } },
          ]
        );
        usageRows = formatRows(usageData);
        usageColumns = (usageData.schema?.fields || []).map(f => f.name);
        totalRows = parseInt(usageData.totalRows || "0");
      } catch (_) {}
    }

    // Fallback: se não achou por comp_man_id, tenta buscar o input como code no dim_clientes
    if (totalRows === 0 && !code && clientData?.comp_man_id) {
      try {
        const usageData = await runQuery(
          `SELECT * FROM \`pontotel-homepage.customer_intelligence.fct_uso_produto\` WHERE comp_man_id = @id ORDER BY snapshot_at DESC LIMIT @limite`,
          [
            { name: "id", parameterType: { type: "STRING" }, parameterValue: { value: String(clientData.comp_man_id) } },
            { name: "limite", parameterType: { type: "INT64" }, parameterValue: { value: String(limite || 10) } },
          ]
        );
        usageRows = formatRows(usageData);
        usageColumns = (usageData.schema?.fields || []).map(f => f.name);
        totalRows = parseInt(usageData.totalRows || "0");
        usedFallbackId = true;
        resolvedCompManId = clientData.comp_man_id;
      } catch (_) {}
    }

    return Response.json({
      success: true,
      searchedAs: code ? "code" : "comp_man_id",
      searchedValue: searchInput,
      resolvedCompManId: resolvedCompManId || null,
      clientData,
      usageData: {
        totalRows,
        rows: usageRows,
        columns: usageColumns,
      },
    });
  } catch (error) {
    console.error("queryBigQueryUsage error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Gera access token OAuth2 a partir da service account (JWT com RSA256)
async function getAccessToken(credentials) {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: credentials.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64Url = (str) => btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headerB64 = base64Url(JSON.stringify(header));
  const claimB64 = base64Url(JSON.stringify(claim));
  const unsigned = `${headerB64}.${claimB64}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let keyContent = credentials.private_key;
  keyContent = keyContent.replace(/\n/g, "").replace(pemHeader, "").replace(pemFooter, "");
  const keyBytes = Uint8Array.from(atob(keyContent), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const sigB64 = base64Url(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${unsigned}.${sigB64}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error(`Falha ao obter access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}