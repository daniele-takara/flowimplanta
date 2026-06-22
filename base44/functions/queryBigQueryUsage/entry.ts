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

    const { comp_man_id, empresa_id, limite, debug } = await req.json().catch(() => ({}));

    // Gerar token JWT para autenticação via service account
    const credentials = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(credentials);

    // Construir query
    const searchId = comp_man_id || empresa_id;
    let query;
    const params = [];
    
    if (debug && searchId) {
      // Modo debug: busca global pelo ID em TODAS as colunas de texto
      const schemaUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${credentials.project_id}/datasets/customer_intelligence/tables/fct_uso_produto`;
      const schemaResp = await fetch(schemaUrl, { headers: { "Authorization": `Bearer ${accessToken}` } });
      const schemaData = await schemaResp.json();
      const stringColumns = (schemaData.schema?.fields || []).filter(f => f.type === "STRING").map(f => f.name);
      
      // Buscar o ID em cada coluna de texto
      const results = {};
      for (const col of stringColumns) {
        const q = `SELECT \`${col}\`, snapshot_at FROM \`pontotel-homepage.customer_intelligence.fct_uso_produto\` WHERE \`${col}\` = @searchId ORDER BY snapshot_at DESC LIMIT 3`;
        const r = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${credentials.project_id}/queries`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, queryParameters: [{ name: "searchId", parameterType: { type: "STRING" }, parameterValue: { value: String(searchId) } }], useLegacySql: false, useQueryCache: false }),
        });
        const d = await r.json();
        if (parseInt(d.totalRows || "0") > 0) {
          results[col] = parseInt(d.totalRows);
        }
      }
      return Response.json({ success: true, debug: true, searchedId: searchId, stringColumns, matches: results, totalDistinctComps: null });
    } else if (searchId) {
      query = `SELECT * FROM \`pontotel-homepage.customer_intelligence.fct_uso_produto\` WHERE comp_man_id = @comp_man_id ORDER BY snapshot_at DESC LIMIT @limite`;
      params.push({ name: "comp_man_id", parameterType: { type: "STRING" }, parameterValue: { value: String(searchId) } });
      params.push({ name: "limite", parameterType: { type: "INT64" }, parameterValue: { value: String(limite || 10) } });
    } else {
      query = `SELECT * FROM \`pontotel-homepage.customer_intelligence.fct_uso_produto\` ORDER BY snapshot_at DESC LIMIT @limite`;
      params.push({ name: "limite", parameterType: { type: "INT64" }, parameterValue: { value: String(limite || 10) } });
    }

    // Chamar BigQuery API REST
    const projectId = credentials.project_id;
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

    const bqResp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        queryParameters: params,
        useLegacySql: false,
        useQueryCache: true,
      }),
    });

    const bqData = await bqResp.json();

    if (!bqResp.ok) {
      console.error("BigQuery error:", JSON.stringify(bqData));
      return Response.json({ error: "Erro na consulta ao BigQuery", details: bqData?.error?.message || bqData }, { status: 500 });
    }

    // Formatar resultado
    const columns = (bqData.schema?.fields || []).map(f => f.name);
    const rows = (bqData.rows || []).map(row => {
      const obj = {};
      (row.f || []).forEach((field, i) => {
        const colName = columns[i];
        let val = field.v;
        // Formatar snapshot_at (epoch seconds → ISO date)
        if (colName === "snapshot_at" && val) {
          try {
            const epoch = parseFloat(val);
            obj["snapshot_at_formatted"] = new Date(epoch * 1000).toISOString().split("T")[0];
          } catch (_) {}
        }
        obj[colName] = val;
      });
      return obj;
    });

    return Response.json({
      success: true,
      totalRows: parseInt(bqData.totalRows || "0"),
      rows,
      columns,
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

  // Importar a chave privada
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

  // Trocar JWT por access token
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