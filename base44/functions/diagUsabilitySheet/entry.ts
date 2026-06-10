import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_ID = "1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8";
const SHEET_NAME = "Mais recente";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { lar21, project_id } = body;

    const log = [];

    // ETAPA 1 — Dados do projeto no banco
    let projectData = null;
    if (project_id) {
      const projects = await base44.entities.Project.filter({ id: project_id });
      projectData = projects?.[0] || null;
    }
    log.push({
      etapa: "1 - Projeto no banco",
      project_id: projectData?.id || project_id || "não informado",
      pipedrive_deal_id: projectData?.pipedrive_deal_id || "—",
      lar21_no_banco: projectData?.lar21 || "—",
      lar21_recebido_no_payload: lar21 || "—",
    });

    // ETAPA 2 — Conexão Google Sheets
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
      accessToken = conn.accessToken;
      log.push({ etapa: "2 - Conector GoogleSheets", status: "OK", token_prefix: accessToken?.substring(0, 20) + "..." });
    } catch (e) {
      log.push({ etapa: "2 - Conector GoogleSheets", status: "ERRO", erro: e.message });
      return Response.json({ ok: false, log, erro_critico: "Conector expirado ou inválido" });
    }

    // ETAPA 3 — Buscar aba da planilha
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await dataRes.json();
    const rows = data.values || [];

    log.push({
      etapa: "3 - Planilha lida",
      aba: SHEET_NAME,
      total_linhas: rows.length,
      linhas_de_dados: rows.length > 1 ? rows.length - 1 : 0,
    });

    if (rows.length < 2) {
      return Response.json({ ok: false, log, erro_critico: "Planilha vazia ou sem dados" });
    }

    // ETAPA 4 — Cabeçalhos
    const header = rows[0];
    const headerNorm = header.map((h, i) => ({
      col_index: i,
      original: h,
      normalizado: String(h).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_"),
    }));

    // Identificar colunas chave
    const findCol = (names) => {
      for (const name of names) {
        const found = headerNorm.find(h => h.normalizado === name || h.original?.toLowerCase().includes(name));
        if (found) return found;
      }
      return null;
    };

    const colLar21          = findCol(["lar21"]);
    const colNome           = findCol(["nome", "empresa"]);
    const colCadastrados    = findCol(["numero_empregados", "funcionarios", "cadastrados"]);
    const colBatendoPonto   = findCol(["empregados_batendo_ponto_ultimos_15_dias", "batendo_ponto"]);
    const colAtivos         = findCol(["numero_empregados_ativos", "ativos"]);
    const colUltimoAcesso   = findCol(["data_ultimo_acesso", "ultimo_acesso"]);

    log.push({
      etapa: "4 - Cabeçalhos encontrados",
      todos_cabecalhos: headerNorm.map(h => `[${h.col_index}] "${h.original}"`),
      coluna_lar21:           colLar21    ? `[${colLar21.col_index}] "${colLar21.original}"` : "NÃO ENCONTRADA",
      coluna_nome:            colNome     ? `[${colNome.col_index}] "${colNome.original}"` : "NÃO ENCONTRADA",
      coluna_cadastrados:     colCadastrados  ? `[${colCadastrados.col_index}] "${colCadastrados.original}"` : "NÃO ENCONTRADA",
      coluna_batendo_ponto:   colBatendoPonto ? `[${colBatendoPonto.col_index}] "${colBatendoPonto.original}"` : "NÃO ENCONTRADA",
      coluna_ativos:          colAtivos   ? `[${colAtivos.col_index}] "${colAtivos.original}"` : "NÃO ENCONTRADA",
      coluna_ultimo_acesso:   colUltimoAcesso ? `[${colUltimoAcesso.col_index}] "${colUltimoAcesso.original}"` : "NÃO ENCONTRADA",
    });

    // ETAPA 5 — Buscar Lar21 usando coluna dinâmica
    const lar21Busca = String(lar21 || projectData?.lar21 || "").trim();
    log.push({
      etapa: "5 - Valor sendo buscado",
      lar21_buscado: lar21Busca,
      lar21_length: lar21Busca.length,
      lar21_charCodes: [...lar21Busca].map(c => c.charCodeAt(0)),
      usando_coluna_indice: colLar21 ? colLar21.col_index : "INDICE_B_FALLBACK=1",
    });

    const idxLar21 = colLar21 ? colLar21.col_index : 1; // fallback: coluna B

    // Coletar amostras da coluna Lar21 para comparação
    const amostras = rows.slice(1, 11).map((r, i) => {
      const celula = String(r[idxLar21] || "").trim();
      const match = celula.toLowerCase() === lar21Busca.toLowerCase();
      return {
        linha: i + 2,
        valor_celula: celula,
        celula_length: celula.length,
        match_exato: celula === lar21Busca,
        match_case_insensitive: match,
      };
    });

    // Busca real em todas as linhas
    const lar21Norm = lar21Busca.toLowerCase();
    const matchRows = rows.slice(1).reduce((acc, r, i) => {
      const celula = String(r[idxLar21] || "").trim();
      if (celula.toLowerCase() === lar21Norm) acc.push({ linha: i + 2, valor: celula, row: r });
      return acc;
    }, []);

    log.push({
      etapa: "6 - Resultado da busca",
      lar21_buscado: lar21Busca,
      total_linhas_verificadas: rows.length - 1,
      linhas_encontradas: matchRows.length,
      match_encontrado: matchRows.length > 0,
      matches: matchRows.map(m => ({
        linha: m.linha,
        valor_exato_celula: m.valor,
        nome: colNome ? m.row[colNome.col_index] : "—",
        cadastrados: colCadastrados ? m.row[colCadastrados.col_index] : "—",
        batendo_ponto: colBatendoPonto ? m.row[colBatendoPonto.col_index] : "—",
      })),
      primeiras_10_linhas_coluna_lar21: amostras,
    });

    // ETAPA 6 — Verificar se existe dependência do empresa_id (não deve existir)
    log.push({
      etapa: "7 - Verificação empresa_id",
      empresa_id_no_payload: body.empresa_id || "NÃO PRESENTE",
      empresa_id_no_projeto: projectData?.empresa_id || "NÃO PRESENTE",
      busca_usa_empresa_id: false,
      busca_usa_lar21: true,
      coluna_usada_indice: idxLar21,
      coluna_usada_nome: colLar21?.original || `B (índice ${idxLar21})`,
    });

    // ETAPA 7 — Diagnóstico final
    let causa_raiz = "";
    if (matchRows.length === 0) {
      if (!colLar21) {
        causa_raiz = "COLUNA LAR21 NÃO ENCONTRADA nos cabeçalhos — possível deslocamento ou nome diferente";
      } else {
        causa_raiz = `Lar21 "${lar21Busca}" NÃO existe na coluna "${colLar21.original}" da planilha`;
      }
    } else if (matchRows.length > 1) {
      causa_raiz = `Lar21 duplicado: ${matchRows.length} ocorrências encontradas`;
    } else {
      causa_raiz = "Nenhum problema detectado — dado encontrado com sucesso";
    }

    log.push({
      etapa: "8 - Diagnóstico Final",
      causa_raiz,
      resultado: matchRows.length === 1 ? "ENCONTRADO" : matchRows.length === 0 ? "NÃO ENCONTRADO" : "DUPLICADO",
    });

    return Response.json({ ok: true, log });

  } catch (error) {
    return Response.json({ ok: false, error: error.message, stack: error.stack }, { status: 500 });
  }
});