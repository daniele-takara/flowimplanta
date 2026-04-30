// ============================================================
// MOCK DATA — Projetos de Implantação Pontotel
// ============================================================

export const MOCK_PROJECTS = [
  {
    id: "proj-001",
    name: "Implantação Pontotel – Grupo Logística Brasil",
    client_name: "Grupo Logística Brasil",
    origin: "Pontotel",
    mrr: 4800,
    status: "Em andamento",
    current_phase: "Parametrização",
    start_date: "2026-02-10",
    planned_end_date: "2026-06-10",
    aligned_end_date: "2026-06-10",
    implantation_type: "Implantação com integração Sankhya",
    contracted_employees: 850,
    registered_employees: 620,
    recording_employees: 480,
    progress_percent: 42,
    sponsor_name: "Carlos Menezes",
    sponsor_contact: "carlos.menezes@logbrasilgrupo.com.br | (11) 98765-4321",
    project_leader_name: "Ana Paula Rodrigues",
    project_leader_contact: "apaula.rh@logbrasilgrupo.com.br | (11) 91234-5678",
    operation_name: "Ricardo Fonseca",
    operation_contact: "rfonseca@logbrasilgrupo.com.br | (11) 97654-3210",
    ti_client_name: "Fernando Lima",
    ti_client_contact: "flima.ti@logbrasilgrupo.com.br | (11) 93210-9876",
    pontotel_manager_name: "Juliana Carvalho",
    pontotel_manager_contact: "juliana.carvalho@pontotel.com.br | (11) 99870-1234",
    pontotel_analyst_name: "Diego Santos",
    pontotel_analyst_contact: "diego.santos@pontotel.com.br | (11) 99871-5678",
    contracted_modules: ["Ponto Eletrônico", "Banco de Horas", "Escala", "Controle de Custos"],
    contracted_services: ["Integração Sankhya MGE", "Parametrização Cálculos", "Treinamento Usuários"],
    executive_summary: "Projeto em fase de parametrização. Integração Sankhya em validação. Cronograma no prazo.",
    observations: "Cliente com alta dispersão geográfica (12 operações em 3 estados)."
  },
  {
    id: "proj-002",
    name: "Implantação Pontotel – Construtora Alvenaria SA",
    client_name: "Construtora Alvenaria SA",
    origin: "Parceiro",
    mrr: 2200,
    status: "Em risco",
    current_phase: "Homologação",
    start_date: "2026-01-15",
    planned_end_date: "2026-05-15",
    aligned_end_date: "2026-06-01",
    implantation_type: "Implantação Pontotel com parametrizações não finalizadas",
    contracted_employees: 320,
    registered_employees: 290,
    recording_employees: 200,
    progress_percent: 68,
    sponsor_name: "Beatriz Alves",
    sponsor_contact: "beatriz.alves@alvenaria.com.br | (21) 98800-1122",
    project_leader_name: "Marcos Pereira",
    project_leader_contact: "marcos.rh@alvenaria.com.br | (21) 97700-3344",
    operation_name: "Patricia Souza",
    operation_contact: "psouza@alvenaria.com.br | (21) 96600-5566",
    ti_client_name: "Thiago Nunes",
    ti_client_contact: "tnunes.ti@alvenaria.com.br | (21) 95500-7788",
    pontotel_manager_name: "Juliana Carvalho",
    pontotel_manager_contact: "juliana.carvalho@pontotel.com.br | (11) 99870-1234",
    pontotel_analyst_name: "Marina Costa",
    pontotel_analyst_contact: "marina.costa@pontotel.com.br | (11) 99872-9012",
    contracted_modules: ["Ponto Eletrônico", "Banco de Horas"],
    contracted_services: ["Parametrização Cálculos", "Treinamento Usuários"],
    executive_summary: "Projeto com risco de atraso. Parametrizações de cálculo pendentes. Aguardando validação do RH.",
    observations: "RH do cliente com disponibilidade reduzida. Replanejamento em curso."
  },
  {
    id: "proj-003",
    name: "Implantação Pontotel – Rede Supermercados Fresco",
    client_name: "Rede Supermercados Fresco",
    origin: "Inbound",
    mrr: 6500,
    status: "Em andamento",
    current_phase: "Parametrização",
    start_date: "2026-03-01",
    planned_end_date: "2026-07-01",
    aligned_end_date: "2026-07-01",
    implantation_type: "Implantação Pontotel",
    contracted_employees: 1200,
    registered_employees: 900,
    recording_employees: 750,
    progress_percent: 35,
    sponsor_name: "Roberto Maia",
    sponsor_contact: "roberto.maia@fresco.com.br | (41) 98989-7878",
    project_leader_name: "Camila Ferreira",
    project_leader_contact: "camila.rh@fresco.com.br | (41) 97878-6767",
    operation_name: "Paulo Henrique",
    operation_contact: "pah@fresco.com.br | (41) 96767-5656",
    ti_client_name: "Lucas Rocha",
    ti_client_contact: "lrocha.ti@fresco.com.br | (41) 95656-4545",
    pontotel_manager_name: "Rafael Mendes",
    pontotel_manager_contact: "rafael.mendes@pontotel.com.br | (11) 99873-3456",
    pontotel_analyst_name: "Diego Santos",
    pontotel_analyst_contact: "diego.santos@pontotel.com.br | (11) 99871-5678",
    contracted_modules: ["Ponto Eletrônico", "Escala", "App Mobile"],
    contracted_services: ["Parametrização Cálculos", "Treinamento Gestores", "Treinamento Usuários"],
    executive_summary: "Projeto em fase inicial de parametrização. Boa adesão do cliente. No prazo.",
    observations: "Rede com 28 lojas. Rollout escalonado previsto."
  },
  {
    id: "proj-004",
    name: "Implantação Pontotel – Hospital São Rafael",
    client_name: "Hospital São Rafael",
    origin: "Indicação",
    mrr: 3800,
    status: "Atrasado",
    current_phase: "Rollout",
    start_date: "2025-11-01",
    planned_end_date: "2026-03-01",
    aligned_end_date: "2026-05-01",
    implantation_type: "Implantação com integração Sankhya adiada",
    contracted_employees: 500,
    registered_employees: 480,
    recording_employees: 420,
    progress_percent: 82,
    sponsor_name: "Dra. Fernanda Monteiro",
    sponsor_contact: "f.monteiro@hsaorafael.com.br | (71) 99001-2233",
    project_leader_name: "José Eduardo",
    project_leader_contact: "j.eduardo.rh@hsaorafael.com.br | (71) 98002-3344",
    operation_name: "Simone Barros",
    operation_contact: "s.barros@hsaorafael.com.br | (71) 97003-4455",
    ti_client_name: "André Machado",
    ti_client_contact: "a.machado.ti@hsaorafael.com.br | (71) 96004-5566",
    pontotel_manager_name: "Rafael Mendes",
    pontotel_manager_contact: "rafael.mendes@pontotel.com.br | (11) 99873-3456",
    pontotel_analyst_name: "Marina Costa",
    pontotel_analyst_contact: "marina.costa@pontotel.com.br | (11) 99872-9012",
    contracted_modules: ["Ponto Eletrônico", "Banco de Horas", "App Mobile"],
    contracted_services: ["Integração Sankhya MGE", "Parametrização Cálculos"],
    executive_summary: "Projeto em rollout. Integração Sankhya adiada para Q3. Sistema operando sem integração.",
    observations: "Integração Sankhya adiada por decisão do cliente. Meta de go-live sem integração."
  },
  {
    id: "proj-005",
    name: "Implantação Pontotel – Transportadora Veloz",
    client_name: "Transportadora Veloz",
    origin: "Pontotel",
    mrr: 1900,
    status: "Concluído",
    current_phase: "Concluído",
    start_date: "2025-08-01",
    planned_end_date: "2025-12-01",
    aligned_end_date: "2025-12-15",
    implantation_type: "Implantação Pontotel",
    contracted_employees: 180,
    registered_employees: 178,
    recording_employees: 175,
    progress_percent: 100,
    sponsor_name: "Carlos Drummond",
    sponsor_contact: "c.drummond@veloz.com.br | (31) 99555-6677",
    project_leader_name: "Sandra Gomes",
    project_leader_contact: "s.gomes.rh@veloz.com.br | (31) 98444-5566",
    operation_name: "Roberto Dias",
    operation_contact: "r.dias@veloz.com.br | (31) 97333-4455",
    ti_client_name: "Márcio Leal",
    ti_client_contact: "m.leal.ti@veloz.com.br | (31) 96222-3344",
    pontotel_manager_name: "Juliana Carvalho",
    pontotel_manager_contact: "juliana.carvalho@pontotel.com.br | (11) 99870-1234",
    pontotel_analyst_name: "Diego Santos",
    pontotel_analyst_contact: "diego.santos@pontotel.com.br | (11) 99871-5678",
    contracted_modules: ["Ponto Eletrônico", "Banco de Horas"],
    contracted_services: ["Parametrização Cálculos", "Treinamento Usuários"],
    executive_summary: "Projeto concluído com sucesso. Aderência de 97%. Go-live realizado em 10/12/2025.",
    observations: ""
  }
];

export const MOCK_SCOPE_ITEMS = {
  "proj-001": [
    { id: "s1-1", project_id: "proj-001", section: "Informações Gerais do Projeto", order_number: 1, question: "Número de funcionários contratados", best_practice: "Informação recebida na passagem de bastão. Campo a ser confirmado com o cliente.", answer: "850", observations: "Confirmado pelo RH em 10/02/2026", field_type: "number" },
    { id: "s1-2", project_id: "proj-001", section: "Informações Gerais do Projeto", order_number: 2, question: "Quantas operações existem, considerando municípios e Estados?", best_practice: "Identifica o nível de dispersão da operação e impacta na estratégia de implantação.", answer: "12 operações em 3 estados (SP, MG, PR)", observations: "", field_type: "text" },
    { id: "s1-3", project_id: "proj-001", section: "Informações Gerais do Projeto", order_number: 3, question: "Parametrização do arquivo de exportação de verbas para folha foi contratado?", best_practice: "Caso seja cliente Sankhya, o projeto contempla exportação para Pessoal+/MGE.", answer: "Sim – Integração Sankhya MGE contratada", observations: "", field_type: "text" },
    { id: "s1-4", project_id: "proj-001", section: "Integração Folha Sankhya", order_number: 4, question: "Qual versão do Sankhya está em uso?", best_practice: "Verificar compatibilidade com a versão de integração disponível.", answer: "Sankhya MGE v4.18", observations: "TI confirmou versão em 15/02/2026", field_type: "text" },
    { id: "s1-5", project_id: "proj-001", section: "Integração Folha Sankhya", order_number: 5, question: "Existe ambiente de homologação disponível para testes?", best_practice: "Recomendado ter ambiente separado para validações antes do go-live.", answer: "Sim, ambiente disponível", observations: "", field_type: "boolean" },
    { id: "s1-6", project_id: "proj-001", section: "Parametrização Cálculos e Permissões", order_number: 6, question: "Quais convenções coletivas se aplicam?", best_practice: "Cada convenção pode ter regras distintas de hora extra, interjornada e intrajornada.", answer: "Logística SP – CLT padrão + ACT Transporte", observations: "Verificar adicionais noturnos", field_type: "text" },
    { id: "s1-7", project_id: "proj-001", section: "Parametrização Cálculos e Permissões", order_number: 7, question: "Existem jornadas flexíveis ou banco de horas?", best_practice: "Definir regras de compensação e limites do banco de horas.", answer: "Banco de horas mensal com limite de 40h", observations: "", field_type: "text" },
    { id: "s1-8", project_id: "proj-001", section: "Módulo de Escala", order_number: 8, question: "Como é feita a gestão de escalas atualmente?", best_practice: "Mapear processo atual para migração adequada.", answer: "Planilha Excel gerenciada pelo RH", observations: "Migração de escalas prevista para Fase 2", field_type: "text" }
  ]
};

export const MOCK_SCHEDULE_PHASES = {
  "proj-001": [
    { id: "ph1-1", project_id: "proj-001", phase_name: "Abertura de projeto", planned_start: "2026-02-10", planned_end: "2026-03-05", actual_start: "2026-02-10", actual_end: "2026-03-05", progress_percent: 100, status: "Concluído", order: 1 },
    { id: "ph1-2", project_id: "proj-001", phase_name: "Parametrização", planned_start: "2026-03-06", planned_end: "2026-04-30", actual_start: "2026-03-06", actual_end: null, progress_percent: 60, status: "Em andamento", order: 2 },
    { id: "ph1-3", project_id: "proj-001", phase_name: "Homologação", planned_start: "2026-05-01", planned_end: "2026-05-20", actual_start: null, actual_end: null, progress_percent: 0, status: "Não iniciado", order: 3 },
    { id: "ph1-4", project_id: "proj-001", phase_name: "Rollout", planned_start: "2026-05-21", planned_end: "2026-06-05", actual_start: null, actual_end: null, progress_percent: 0, status: "Não iniciado", order: 4 },
    { id: "ph1-5", project_id: "proj-001", phase_name: "Go-live", planned_start: "2026-06-06", planned_end: "2026-06-10", actual_start: null, actual_end: null, progress_percent: 0, status: "Não iniciado", order: 5 }
  ]
};

export const MOCK_ACTIVITIES = {
  "proj-001": [
    { id: "a1-1", project_id: "proj-001", phase_id: "ph1-1", phase_name: "Abertura de projeto", activity_name: "Alinhamento inicial", planned_start: "2026-02-10", planned_end: "2026-02-10", actual_start: "2026-02-10", actual_end: "2026-02-10", responsible_general: "Pontotel + Grupo Logística Brasil", responsible_leader: "Juliana Carvalho", status: "Concluído", history_observations: "Reunião realizada. Todos os participantes presentes.", order: 1 },
    { id: "a1-2", project_id: "proj-001", phase_id: "ph1-1", phase_name: "Abertura de projeto", activity_name: "Agenda de escopo técnico", planned_start: "2026-02-11", planned_end: "2026-02-18", actual_start: "2026-02-12", actual_end: "2026-02-19", responsible_general: "Pontotel + Grupo Logística Brasil", responsible_leader: "Diego Santos", status: "Concluído", history_observations: "Escopo técnico levantado e documentado.", order: 2 },
    { id: "a1-3", project_id: "proj-001", phase_id: "ph1-1", phase_name: "Abertura de projeto", activity_name: "Envio de Termo de Abertura do Projeto e cronograma", planned_start: "2026-02-19", planned_end: "2026-02-22", actual_start: "2026-02-20", actual_end: "2026-02-23", responsible_general: "Pontotel", responsible_leader: "Juliana Carvalho", status: "Concluído", history_observations: "Termo assinado em 23/02/2026.", order: 3 },
    { id: "a1-4", project_id: "proj-001", phase_id: "ph1-1", phase_name: "Abertura de projeto", activity_name: "Agenda de Status Report recorrente", planned_start: "2026-02-24", planned_end: "2026-03-05", actual_start: "2026-02-25", actual_end: "2026-03-05", responsible_general: "Pontotel + Grupo Logística Brasil", responsible_leader: "Juliana Carvalho", status: "Concluído", history_observations: "Reuniões quinzenais às sextas-feiras.", order: 4 },
    { id: "a1-5", project_id: "proj-001", phase_id: "ph1-2", phase_name: "Parametrização", activity_name: "Integração Sankhya – Configuração", planned_start: "2026-03-06", planned_end: "2026-03-25", actual_start: "2026-03-06", actual_end: null, responsible_general: "Pontotel", responsible_leader: "Diego Santos", status: "Em andamento", history_observations: "Mapeamento de campos concluído. Aguardando acesso ao ambiente Sankhya.", order: 5 },
    { id: "a1-6", project_id: "proj-001", phase_id: "ph1-2", phase_name: "Parametrização", activity_name: "Cadastro de funcionários", planned_start: "2026-03-06", planned_end: "2026-03-20", actual_start: "2026-03-06", actual_end: "2026-03-22", responsible_general: "Grupo Logística Brasil", responsible_leader: "Ana Paula Rodrigues", status: "Concluído", history_observations: "620 funcionários cadastrados. 230 pendentes.", order: 6 },
    { id: "a1-7", project_id: "proj-001", phase_id: "ph1-2", phase_name: "Parametrização", activity_name: "Parametrização de cálculos e permissões", planned_start: "2026-03-15", planned_end: "2026-04-15", actual_start: "2026-03-18", actual_end: null, responsible_general: "Pontotel", responsible_leader: "Diego Santos", status: "Em andamento", history_observations: "Regras de hora extra parametrizadas. ACT em análise.", order: 7 },
    { id: "a1-8", project_id: "proj-001", phase_id: "ph1-2", phase_name: "Parametrização", activity_name: "Parametrização módulo Controle de Custos", planned_start: "2026-04-01", planned_end: "2026-04-30", actual_start: null, actual_end: null, responsible_general: "Pontotel", responsible_leader: "Diego Santos", status: "Não iniciado", history_observations: "", order: 8 }
  ]
};

export const MOCK_STATUS_REPORTS = {
  "proj-001": [
    {
      id: "sr1-1",
      project_id: "proj-001",
      report_date: "2026-04-17",
      overall_progress: 42,
      executive_summary: "Projeto em fase de parametrização. Integração Sankhya em andamento com acesso ao ambiente obtido. Cadastros em 73% de conclusão. Cronograma no prazo.",
      registered_employees: 620,
      recording_employees: 480,
      adherence_percent: 77.4,
      general_status: "No prazo",
      risks: [
        { description: "Acesso ao ambiente Sankhya ainda restrito em algumas filiais", impact: "Médio", mitigation: "Solicitação formal ao TI do cliente com prazo até 22/04" },
        { description: "230 funcionários ainda não cadastrados", impact: "Alto", mitigation: "Mutirão de cadastro agendado para semana de 20/04" }
      ],
      client_pending: [
        { item: "Completar cadastro dos 230 funcionários restantes", deadline: "2026-04-25", responsible: "Ana Paula Rodrigues" },
        { item: "Validar regras de ACT Transporte", deadline: "2026-04-22", responsible: "Marcos RH" }
      ],
      internal_pending: [
        { item: "Finalizar parametrização integração Sankhya", deadline: "2026-04-25", responsible: "Diego Santos" },
        { item: "Preparar ambiente de homologação", deadline: "2026-04-30", responsible: "Diego Santos" }
      ],
      next_agenda: "Status Report #5 – Revisão da Parametrização e validação ACT",
      next_agenda_date: "2026-04-24"
    }
  ]
};

export const MOCK_ACTION_PLANS = {
  "proj-001": [
    {
      id: "ap1-1",
      project_id: "proj-001",
      ticket_code: "Ticket#88421",
      technical_call_code: "#4421",
      theme: "Integração Sankhya",
      issue: "Mapeamento de verbas inconsistente",
      issue_description: "Verbas de hora extra não chegando corretamente no layout de exportação para o Sankhya MGE.",
      type: "Erro",
      impact: "Alto",
      responsible_pontotel: "Diego Santos",
      status_pontotel: "Em andamento",
      status_client: "Em validação",
      responsible_client: "Fernando Lima",
      request_date: "2026-04-05",
      deadline_date: "2026-04-20",
      solution_date: null,
      history: "05/04 - Identificado erro no layout de exportação. Diego iniciou investigação.\n10/04 - Problema isolado no mapeamento de verbas 025 e 030. Correção em desenvolvimento.\n15/04 - Correção testada em ambiente de dev. Aguardando validação em homologação."
    },
    {
      id: "ap1-2",
      project_id: "proj-001",
      ticket_code: "Ticket#88450",
      technical_call_code: "#4422",
      theme: "Cadastros",
      issue: "Importação em lote com erros",
      issue_description: "Arquivo de importação em lote de funcionários retornando erro 422 para 15 registros com campos CPF.",
      type: "Erro",
      impact: "Médio",
      responsible_pontotel: "Diego Santos",
      status_pontotel: "Concluído",
      status_client: "Validado",
      responsible_client: "Ana Paula Rodrigues",
      request_date: "2026-03-20",
      deadline_date: "2026-03-25",
      solution_date: "2026-03-24",
      history: "20/03 - Erro identificado durante importação em lote.\n22/03 - Causa raiz: CPFs sem formatação no arquivo Excel.\n24/03 - Template corrigido e importação refeita com sucesso."
    }
  ]
};

export const MOCK_MEETINGS = {
  "proj-001": [
    { id: "m1-1", project_id: "proj-001", meeting_number: 1, date: "2026-02-10", subject: "Alinhamento inicial – Kick-off", duration: "1h", participants: "Pontotel + Grupo Logística Brasil (todos os participantes)", leader: "Juliana Carvalho", meeting_type: "Status Report", notes: "Apresentação do time. Validação do escopo e cronograma." },
    { id: "m1-2", project_id: "proj-001", meeting_number: 2, date: "2026-02-17", subject: "Escopo Técnico – Sessão 1", duration: "2h", participants: "Diego Santos + Fernando Lima + Ana Paula", leader: "Diego Santos", meeting_type: "Escopo Técnico", notes: "Levantamento de informações gerais e integrações." },
    { id: "m1-3", project_id: "proj-001", meeting_number: 3, date: "2026-03-06", subject: "Status Report #1", duration: "1h", participants: "Pontotel + Grupo Logística Brasil", leader: "Juliana Carvalho", meeting_type: "Status Report", notes: "Abertura concluída. Início da parametrização." },
    { id: "m1-4", project_id: "proj-001", meeting_number: 4, date: "2026-03-20", subject: "Status Report #2", duration: "1h", participants: "Pontotel + Grupo Logística Brasil", leader: "Juliana Carvalho", meeting_type: "Status Report", notes: "Cadastros em 50%. Integração Sankhya em progresso." },
    { id: "m1-5", project_id: "proj-001", meeting_number: 5, date: "2026-04-03", subject: "Status Report #3", duration: "1h", participants: "Pontotel + Grupo Logística Brasil", leader: "Juliana Carvalho", meeting_type: "Status Report", notes: "Cadastros em 73%. Erro de importação resolvido." },
    { id: "m1-6", project_id: "proj-001", meeting_number: 6, date: "2026-04-17", subject: "Status Report #4", duration: "1h", participants: "Pontotel + Grupo Logística Brasil", leader: "Juliana Carvalho", meeting_type: "Status Report", notes: "Em andamento: parametrização Sankhya e ACT." }
  ]
};

// Fases usadas ao criar um projeto — DEVEM ser idênticas ao PHASE_ORDER em scheduleTasks.js
export const SCHEDULE_TEMPLATE = [
  { phase_name: "Abertura de projeto" },
  { phase_name: "Integração" },
  { phase_name: "Cadastros" },
  { phase_name: "Parametrização" },
  { phase_name: "Treinamento e Validações" },
  { phase_name: "Operação Assistida" },
  { phase_name: "Fechamento de Folha" },
  { phase_name: "Expansão" },
  { phase_name: "Encerramento" },
];

export const SCOPE_TEMPLATE = [
  {
    section: "Informações Gerais do Projeto",
    items: [
      { question: "Número de funcionários contratados", best_practice: "Informação recebida na passagem de bastão. Campo a ser confirmado com o cliente.", order_number: 1 },
      { question: "Quantas operações existem, considerando municípios e Estados?", best_practice: "Este campo identifica o nível de dispersão da operação e impacta na estratégia de implantação.", order_number: 2 },
      { question: "Parametrização do arquivo de exportação de verbas para folha foi contratado?", best_practice: "Caso seja cliente Sankhya, o projeto contempla exportação para Pessoal+/MGE.", order_number: 3 }
    ]
  },
  {
    section: "Integração Folha Sankhya",
    items: [
      { question: "Qual versão do Sankhya está em uso?", best_practice: "Verificar compatibilidade com a versão de integração disponível.", order_number: 4 },
      { question: "Existe ambiente de homologação disponível para testes?", best_practice: "Recomendado ter ambiente separado para validações antes do go-live.", order_number: 5 },
      { question: "Quais são as verbas utilizadas na folha de pagamento?", best_practice: "Mapeamento das verbas é crítico para configuração da exportação.", order_number: 6 }
    ]
  },
  {
    section: "Parametrização Cálculos e Permissões",
    items: [
      { question: "Quais convenções coletivas se aplicam?", best_practice: "Cada convenção pode ter regras distintas de hora extra, interjornada e intrajornada.", order_number: 7 },
      { question: "Existem jornadas flexíveis ou banco de horas?", best_practice: "Definir regras de compensação e limites do banco de horas.", order_number: 8 },
      { question: "Como é tratado o adicional noturno?", best_practice: "Verificar percentuais e horários de incidência por CCT.", order_number: 9 },
      { question: "Existem cargos com jornadas diferenciadas (gerentes, turno, etc.)?", best_practice: "Cargos com jornadas especiais requerem configurações específicas.", order_number: 10 }
    ]
  },
  {
    section: "Módulo de Escala",
    items: [
      { question: "Como é feita a gestão de escalas atualmente?", best_practice: "Mapear processo atual para migração adequada.", order_number: 11 },
      { question: "Existem escalas 5x2, 6x1, 12x36 ou outras?", best_practice: "Cada tipo de escala tem parametrização específica.", order_number: 12 }
    ]
  },
  {
    section: "Módulo Banco de Horas",
    items: [
      { question: "Qual o limite máximo do banco de horas?", best_practice: "Definir por CCT ou acordo interno.", order_number: 13 },
      { question: "Periodicidade de compensação do banco?", best_practice: "Mensal, trimestral ou anual conforme CCT.", order_number: 14 }
    ]
  },
  {
    section: "Dispositivos de Ponto",
    items: [
      { question: "Quais dispositivos de ponto serão utilizados?", best_practice: "REP-C, REP-A, Biometria facial, App mobile.", order_number: 15 },
      { question: "Existe necessidade de integração com catracas ou controle de acesso?", best_practice: "Verificar compatibilidade dos equipamentos.", order_number: 16 }
    ]
  }
];