// ─── Configuração centralizada da documentação da API de Parceiros ───────────
// Para adicionar um novo endpoint no futuro, basta adicionar uma entrada no
// array `endpoints` abaixo. A página pública /docs/api renderiza tudo a partir
// deste arquivo — sem precisar mexer no layout.

export const API_BASE_URL = "https://gestao-projetos-pontotel.base44.app/functions";
export const DOCS_PUBLIC_URL = "https://gestao-projetos-pontotel.base44.app/docs/api";

export const METHOD_COLORS = {
  GET:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  POST:   { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  PUT:    { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  DELETE: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500" },
  PATCH:  { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200",  dot: "bg-purple-500" },
};

export const ERROR_CODES = [
  { code: 401, title: "Não autorizado", description: "Header x-api-key ausente, chave inválida ou desativada." },
  { code: 404, title: "Não encontrado", description: "Projeto não encontrado para o id ou cnpj informado." },
  { code: 500, title: "Erro interno", description: "Falha inesperada no servidor. Tente novamente mais tarde." },
];

export const endpoints = [
  {
    id: "partnerApiProjects",
    section: "Projetos",
    method: "GET",
    path: "/functions/partnerApiProjects",
    summary: "Consultar projetos de implantação",
    description:
      "Retorna os projetos de implantação cuja origem não seja \"Pontotel\" (parceiros, indicações, inbound, outbound). " +
      "Sem parâmetros retorna um array com todos os projetos acessíveis. Com ?id ou ?cnpj retorna um objeto único.",
    requiresAuth: true,
    parameters: [
      {
        name: "id",
        in: "query",
        required: false,
        type: "string",
        description: "ID do projeto Base44. Retorna um objeto único quando informado.",
        example: "abc123def456",
      },
      {
        name: "cnpj",
        in: "query",
        required: false,
        type: "string",
        description: "CNPJ do cliente (com ou sem formatação). Retorna um objeto único quando informado.",
        example: "00.000.000/0000-00",
      },
    ],
    headers: [
      {
        name: "x-api-key",
        required: true,
        type: "string",
        description: "Chave de API do parceiro (formato ptl_...). Gerada pelo admin na aba API Parceiros.",
      },
    ],
    responseSchema: [
      { field: "id", type: "string", description: "Identificador único do projeto" },
      { field: "cnpj", type: "string | null", description: "CNPJ do cliente formatado" },
      { field: "nome_cliente", type: "string | null", description: "Nome do cliente/empresa" },
      { field: "origem", type: "string | null", description: "Origem do cliente (Parceiro, Indicação, Inbound, Outbound)" },
      { field: "status", type: "string | null", description: "Status do projeto (Em aberto, Em andamento, Concluído, etc.)" },
      { field: "data_prevista_encerramento", type: "string | null", description: "Data alinhada ou planejada de encerramento (ISO)" },
      { field: "gerente_projeto", type: "object | null", description: "{ nome, email } do gerente Pontotel" },
    ],
    exampleResponse: `[
  {
    "id": "abc123def456",
    "cnpj": "00.000.000/0000-00",
    "nome_cliente": "Empresa XYZ",
    "origem": "Parceiro",
    "status": "Em andamento",
    "data_prevista_encerramento": "2026-12-31",
    "gerente_projeto": {
      "nome": "João Barbosa",
      "email": "joao@pontotel.com.br"
    }
  }
]`,
  },
];