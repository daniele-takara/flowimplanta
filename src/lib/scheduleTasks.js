// ============================================================
// TASKS DO CRONOGRAMA — fiel ao JSON da especificação
// NÃO alterar IDs, ordem ou estrutura
// ============================================================

export const SCHEDULE_TASKS = [
  {
    id: "grupo_abertura_projeto", row: 7, type: "group",
    phase: "Abertura de projeto", activity: "Abertura de projeto",
    visibleWhen: "always"
  },
  {
    id: "alinhamento_inicial", row: 8, type: "task",
    phase: "Abertura de projeto", activity: "Alinhamento inicial",
    plannedStart: { type: "anchor", editable: true, propagates: true },
    plannedEnd: { type: "calculated", formula: "sameDay(plannedStart)" },
    responsibleGeneral: "Pontotel + Cliente",
    responsibleLeader: "",
    visibleWhen: "always"
  },
  {
    id: "agenda_escopo_tecnico", row: 9, type: "task",
    phase: "Abertura de projeto", activity: "Agenda de escopo técnico",
    plannedStart: { type: "calculated", formula: "workday(alinhamento_inicial.plannedStart, 1)" },
    plannedEnd: { type: "calculated", formula: "workday(alinhamento_inicial.plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "envio_tap_cronograma", row: 10, type: "task",
    phase: "Abertura de projeto", activity: "Envio de Termo de Abertura do Projeto e cronograma",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: "always"
  },
  {
    id: "agenda_status_report_inicial", row: 11, type: "task",
    phase: "Abertura de projeto", activity: "Agenda de Status report recorrente (1ª Validação de Cronograma e Termo de abertura)",
    plannedStart: { type: "calculated", formula: "workday(envio_tap_cronograma.plannedEnd, 1)" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },

  // ── INTEGRAÇÃO SANKHYA ──────────────────────────────────────
  {
    id: "grupo_integracao", row: 13, type: "group",
    phase: "Integração", activity: "Integração",
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "integracao_sankhya_envio_formulario", row: 14, type: "task",
    phase: "Integração", activity: "[Sankhya] Envio do formulário de dados para integração",
    plannedStart: { type: "calculated", formula: "alinhamento_inicial.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "preenchimento_formulario_integracao_sankhya", row: 15, type: "task",
    phase: "Integração", activity: "Preenchimento do formulário de integração [para clientes Sankhya]",
    plannedStart: { type: "calculated", formula: "integracao_sankhya_envio_formulario.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "inicio_ativacao_integracao_sankhya", row: 16, type: "task",
    phase: "Integração", activity: "Inicio da ativação da integração, análise de inconsistências, alinhamento com o cliente para ajustes",
    plannedStart: { type: "manual_override", propagates: false },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "correcao_cadastros_sankhya", row: 17, type: "task",
    phase: "Integração", activity: "[Sankhya] Correção de cadastros Sankhya",
    plannedStart: { type: "calculated", formula: "inicio_ativacao_integracao_sankhya.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "ativacao_integracao_sankhya", row: 18, type: "task",
    phase: "Integração", activity: "Ativação da integração [para clientes Sankhya]",
    plannedStart: { type: "calculated", formula: "correcao_cadastros_sankhya.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },
  {
    id: "envio_planilha_importacao_escalas_sankhya", row: 19, type: "task",
    phase: "Cadastros", activity: "Envio da planilha de importação de escalas [para clientes Sankhya]",
    plannedStart: { type: "calculated", formula: "integracao_sankhya_envio_formulario.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "escopo.q006", equals: "Sim" }
  },

  // ── CADASTROS ───────────────────────────────────────────────
  {
    id: "grupo_cadastros", row: 20, type: "group",
    phase: "Cadastros", activity: "Cadastros",
    visibleWhen: "always"
  },
  {
    id: "envio_documentacao_i05", row: 21, type: "task",
    phase: "Cadastros", activity: "Envio da documentação com orientações para o uso do I05",
    plannedStart: { type: "calculated", formula: "alinhamento_inicial.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "escopo.q006", equals: "Não" }
  },
  {
    id: "importacao_cadastros_i05", row: 22, type: "task",
    phase: "Cadastros", activity: "Importação de cadastros pelo I05",
    plannedStart: { type: "calculated", formula: "envio_documentacao_i05.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "escopo.q006", equals: "Não" }
  },
  {
    id: "preencher_planilha_enderecos", row: 23, type: "task",
    phase: "Cadastros", activity: "Preencher planilha com o endereço dos locais de trabalho e enviar para o time de implantação da Pontotel importar",
    plannedStart: { type: "calculated", formula: "importacao_cadastros_i05.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "escopo.q020", equals: "Sim" }
  },
  {
    id: "importar_enderecos_ativar_cerca", row: 24, type: "task",
    phase: "Cadastros", activity: "Importar planilha de endereços de locais de trabalho e ativar cerca no perfil de coletor",
    plannedStart: { type: "calculated", formula: "preencher_planilha_enderecos.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 2)" },
    visibleWhen: { source: "escopo.q020", equals: "Sim" }
  },

  // ── PARAMETRIZAÇÃO CÁLCULOS ────────────────────────────────
  {
    id: "grupo_parametrizacao_calculos_permissoes", row: 25, type: "group",
    phase: "Parametrização", activity: "Parametrização Cálculos e permissões",
    visibleWhen: "always"
  },
  {
    id: "reuniao_parametrizacao_regras", row: 26, type: "task",
    phase: "Parametrização", activity: "Reunião para parametrização de Regras (Cálculo, banco de horas e arquivo de exportação)",
    plannedStart: { type: "calculated", formula: "alinhamento_inicial.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Cálculos e Tratamento" }
  },
  {
    id: "envio_layout_arquivo_exportacao", row: 27, type: "task",
    phase: "Parametrização", activity: "Envio do layout do arquivo de exportação",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", containsAny: ["Arquivo txt de exportação para FOPAG", "Integração Sankhya"] }
  },
  {
    id: "parametrizacao_regras", row: 28, type: "task",
    phase: "Parametrização", activity: "Parametrização de regras",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 10)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Cálculos e Tratamento" }
  },
  {
    id: "parametrizar_permissoes_usuarios", row: 29, type: "task",
    phase: "Parametrização", activity: "Parametrizar permissões de usuários de acordo com o que foi definido no escopo",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd", fallback: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: "always"
  },
  {
    id: "validar_cadastros_empregados_usuarios", row: 30, type: "task",
    phase: "Parametrização", activity: "Validar parametrização de cadastro de empregados e usuários para o registro de ponto de acordo com o escopo técnico",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd", fallback: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "parametrizar_nr17", row: 31, type: "task",
    phase: "Parametrização", activity: "Parametrizar regras e jornadas/escalas NR17",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "escopo.q039", equals: "Sim" }
  },
  {
    id: "parametrizar_notificacoes", row: 32, type: "task",
    phase: "Parametrização", activity: "Parametrizar regra e permissões das notificações",
    plannedStart: { type: "calculated", formula: "reuniao_parametrizacao_regras.plannedEnd" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhenAny: [
      { source: "escopo.q019", equals: "Sim" },
      { source: "escopo.q062", equals: "Sim" }
    ]
  },

  // ── CONTROLE DE CUSTOS ─────────────────────────────────────
  {
    id: "grupo_controle_custos", row: 33, type: "group",
    phase: "Parametrização", activity: "Parametrização do módulo Controle de custos",
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Controle de Custos" }
  },
  {
    id: "parametrizacao_controle_custos", row: 34, type: "task",
    phase: "Parametrização", activity: "Parametrização das regras e permissões referente ao Controle de custos (de acordo com o que foi respondido no escopo)",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Controle de Custos" }
  },

  // ── GESTÃO PARTICIPATIVA ───────────────────────────────────
  {
    id: "grupo_gestao_participativa", row: 35, type: "group",
    phase: "Parametrização", activity: "Parametrização do módulo Gestão participativa",
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Ponto Participativa" }
  },
  {
    id: "parametrizacao_gestao_participativa", row: 36, type: "task",
    phase: "Parametrização", activity: "Parametrização das regras e permissões referente ao Solicitações (de acordo com o que foi respondido no escopo)",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Ponto Participativa" }
  },

  // ── GESTÃO DE FÉRIAS ────────────────────────────────────────
  {
    id: "grupo_gestao_ferias", row: 37, type: "group",
    phase: "Parametrização", activity: "Parametrização do módulo Gestão de férias",
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Férias e Ausências" }
  },
  {
    id: "parametrizacao_gestao_ferias", row: 38, type: "task",
    phase: "Parametrização", activity: "Parametrização das regras e permissões referente ao Gestão de férias (de acordo com o que foi respondido no escopo)",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Férias e Ausências" }
  },

  // ── API ─────────────────────────────────────────────────────
  {
    id: "grupo_api", row: 39, type: "group",
    phase: "Parametrização", activity: "Disponibilização do acesso para API",
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Integrações (disponibilização de API)" }
  },
  {
    id: "coletar_info_api", row: 40, type: "task",
    phase: "Parametrização", activity: "Coletar informações para criação do Usuário de API",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Integrações (disponibilização de API)" }
  },
  {
    id: "criar_usuario_api", row: 41, type: "task",
    phase: "Parametrização", activity: "Criar usuário de API + enviar documentação",
    plannedStart: { type: "calculated", formula: "coletar_info_api.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Integrações (disponibilização de API)" }
  },

  // ── TIMESHEET ───────────────────────────────────────────────
  {
    id: "grupo_timesheet", row: 42, type: "group",
    phase: "Parametrização", activity: "Parametrização do módulo Timesheet",
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Timesheet" }
  },
  {
    id: "setup_timesheet", row: 43, type: "task",
    phase: "Parametrização", activity: "Parametrizar Setup inicial (integração com Pontotel ou Importação de cadastros) Timesheet",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Timesheet" }
  },
  {
    id: "validar_cadastros_timesheet", row: 44, type: "task",
    phase: "Parametrização", activity: "Validar Cadastros Timesheet",
    plannedStart: { type: "calculated", formula: "setup_timesheet.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Timesheet" }
  },

  // ── sFTP ─────────────────────────────────────────────────────
  {
    id: "grupo_sftp", row: 45, type: "group",
    phase: "Parametrização", activity: "Parametrização integração via pasta sFTP/FTP",
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Importação de arquivo AFD em nuvem" }
  },
  {
    id: "disponibilizar_credenciais_sftp", row: 46, type: "task",
    phase: "Parametrização", activity: "Disponibilizar as credenciais da pasta, Informar os REPs para cadastros",
    plannedStart: { type: "calculated", formula: "agenda_escopo_tecnico.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Importação de arquivo AFD em nuvem" }
  },
  {
    id: "realizar_configuracao_sftp", row: 47, type: "task",
    phase: "Parametrização", activity: "Realiza a configuração",
    plannedStart: { type: "calculated", formula: "disponibilizar_credenciais_sftp.plannedEnd" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Importação de arquivo AFD em nuvem" }
  },
  {
    id: "adicionar_arquivos_afd_sftp", row: 48, type: "task",
    phase: "Parametrização", activity: "Adiciona os arquivos AFDs com pontos a serem integrados na pasta indicada",
    plannedStart: { type: "manual_override", propagates: false },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: { source: "dados_iniciais.servicos_contratados", contains: "Importação de arquivo AFD em nuvem" }
  },

  // ── TREINAMENTO E VALIDAÇÕES ────────────────────────────────
  {
    id: "grupo_treinamento_validacoes", row: 49, type: "group",
    phase: "Treinamento e Validações", activity: "Treinamento e validações",
    visibleWhen: "always"
  },
  {
    id: "curso_ead_universidade", row: 51, type: "task",
    phase: "Treinamento e Validações", activity: "Assistir ao curso EAD da Universidade",
    plannedStart: { type: "calculated", formula: "alinhamento_inicial.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "validar_regras_calculo_banco_horas", row: 52, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião para validar Regras de cálculo de banco de horas",
    plannedStart: { type: "calculated", formula: "parametrizacao_regras.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Cálculos e Tratamento" }
  },
  {
    id: "validar_arquivo_exportacao", row: 53, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião para validar Arquivo de exportação",
    plannedStart: { type: "calculated", formula: "validar_regras_calculo_banco_horas.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Cálculos e Tratamento" }
  },
  {
    id: "treinamento_solicitacoes", row: 54, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião sobre o uso e validação do fluxo de Solicitações",
    plannedStart: { type: "calculated", formula: "parametrizacao_gestao_participativa.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Ponto Participativa" }
  },
  {
    id: "treinamento_gestao_horas_extras", row: 55, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião sobre o uso e validação do fluxo de Gestão de horas extras",
    plannedStart: { type: "calculated", formula: "parametrizacao_controle_custos.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Controle de Custos" }
  },
  {
    id: "treinamento_gestao_ferias", row: 56, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião sobre o uso e validação do fluxo de gestão de férias",
    plannedStart: { type: "calculated", formula: "parametrizacao_gestao_ferias.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Gestão de Férias e Ausências" }
  },
  {
    id: "treinamento_sobreaviso", row: 57, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião para explicar o uso e validação do fluxo de Sobreaviso",
    plannedStart: { type: "calculated", formula: "parametrizar_permissoes_usuarios.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "escopo.q038", equals: "Sim" }
  },
  {
    id: "treinamento_timesheet", row: 58, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião para explicar o uso e validação do fluxo de Timesheet",
    plannedStart: { type: "calculated", formula: "validar_cadastros_timesheet.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 1)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Timesheet" }
  },
  {
    id: "treinamento_fluxo_gestao", row: 59, type: "task",
    phase: "Treinamento e Validações", activity: "Reunião para explicar o uso e validação do fluxo de gestão",
    plannedStart: { type: "calculated", formula: "curso_ead_universidade.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 7)" },
    visibleWhen: "always"
  },
  {
    id: "material_importacao_afd", row: 60, type: "task",
    phase: "Treinamento e Validações", activity: "Enviar material orientando em como fazer a importação do arquivo AFD",
    plannedStart: { type: "calculated", formula: "validar_cadastros_empregados_usuarios.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhenAll: [
      { source: "dados_iniciais.modulos_contratados", notContains: "Registro de Ponto" },
      { source: "dados_iniciais.servicos_contratados", notContains: "Importação de arquivo AFD em nuvem" }
    ]
  },
  {
    id: "validacao_importacao_afd", row: 61, type: "task",
    phase: "Treinamento e Validações", activity: "Validação do fluxo de importação de AFD",
    plannedStart: { type: "calculated", formula: "material_importacao_afd.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhenAll: [
      { source: "dados_iniciais.modulos_contratados", notContains: "Registro de Ponto" },
      { source: "dados_iniciais.servicos_contratados", notContains: "Importação de arquivo AFD em nuvem" }
    ]
  },

  // ── OPERAÇÃO ASSISTIDA ─────────────────────────────────────
  {
    id: "grupo_inicio_registro_ponto", row: 63, type: "group",
    phase: "Operação Assistida", activity: "Inicio de registro de ponto",
    visibleWhen: "always"
  },
  {
    id: "agenda_inicio_registro_ponto", row: 64, type: "task",
    phase: "Operação Assistida", activity: "Agenda de inicio de registro de ponto",
    plannedStart: { type: "calculated", formula: "workday(go_live_registro_ponto.plannedStart, -10)" },
    plannedEnd: { type: "calculated", formula: "workday(go_live_registro_ponto.plannedStart, -5)" },
    visibleWhen: "always"
  },
  {
    id: "go_live_registro_ponto", row: 65, type: "task",
    phase: "Operação Assistida", activity: "Inicio de registro de ponto (Go Live)",
    plannedStart: { type: "anchor", editable: true, propagates: true },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "inicio_registro_timesheet", row: 66, type: "task",
    phase: "Operação Assistida", activity: "Início do registro no timesheet",
    plannedStart: { type: "calculated", formula: "go_live_registro_ponto.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 10)" },
    visibleWhen: { source: "dados_iniciais.modulos_contratados", contains: "Timesheet" }
  },
  {
    id: "agenda_verificacao_pre_fechamento", row: 67, type: "task",
    phase: "Operação Assistida", activity: "Agenda de verificação e gestão de folha de ponto (pré-fechamento de ponto)",
    plannedStart: { type: "calculated", formula: "workday(go_live_registro_ponto.plannedEnd, 5)" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 3)" },
    visibleWhen: "always"
  },

  // ── FECHAMENTO DE FOLHA ─────────────────────────────────────
  {
    id: "grupo_fechamento_folha", row: 68, type: "group",
    phase: "Fechamento de Folha", activity: "Fechamento de folha de ponto",
    visibleWhen: "always"
  },
  {
    id: "agenda_fechamento_folha", row: 69, type: "task",
    phase: "Fechamento de Folha", activity: "Agenda fechamento de folha de ponto",
    plannedStart: { type: "anchor", editable: true, propagates: true },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "fechamento_folha", row: 70, type: "task",
    phase: "Fechamento de Folha", activity: "Fechamento de folha",
    plannedStart: { type: "calculated", formula: "agenda_fechamento_folha.plannedStart" },
    plannedEnd: { type: "manual_override", propagates: false },
    visibleWhen: "always"
  },

  // ── EXPANSÃO ────────────────────────────────────────────────
  {
    id: "grupo_expansao", row: 71, type: "group",
    phase: "Expansão", activity: "Expansão",
    visibleWhen: "always"
  },
  {
    id: "expansao_registro_ponto_real", row: 72, type: "task",
    phase: "Expansão", activity: "Expansão de registro de ponto real",
    plannedStart: { type: "anchor", editable: true, propagates: true },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },
  {
    id: "fechamento_folha_real", row: 73, type: "task",
    phase: "Expansão", activity: "Fechamento de folha de ponto real (100% da base)",
    plannedStart: { type: "calculated", formula: "workday(expansao_registro_ponto_real.plannedStart, 20)" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 5)" },
    visibleWhen: "always"
  },

  // ── ENCERRAMENTO ─────────────────────────────────────────────
  {
    id: "grupo_encerramento", row: 75, type: "group",
    phase: "Encerramento", activity: "Encerramento de projeto",
    visibleWhen: "always"
  },
  {
    id: "agenda_encerramento_projeto", row: 76, type: "task",
    phase: "Encerramento", activity: "Agenda de encerramento de projeto",
    plannedStart: { type: "anchor", editable: true, propagates: true },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 2)" },
    visibleWhen: "always"
  },
  {
    id: "assinatura_termo_encerramento", row: 77, type: "task",
    phase: "Encerramento", activity: "Assinatura do termo de encerramento de projeto",
    plannedStart: { type: "calculated", formula: "agenda_encerramento_projeto.plannedStart" },
    plannedEnd: { type: "calculated", formula: "workday(plannedStart, 2)" },
    visibleWhen: "always"
  },
  {
    id: "passagem_sucesso_cliente", row: 78, type: "task",
    phase: "Encerramento", activity: "Passagem para sucesso do cliente",
    plannedStart: { type: "calculated", formula: "assinatura_termo_encerramento.plannedEnd" },
    plannedEnd: { type: "calculated", formula: "sameDay(plannedStart)" },
    visibleWhen: "always"
  },
];

// Ordem das fases para agrupamento na tabela
export const PHASE_ORDER = [
  "Abertura de projeto",
  "Integração",
  "Cadastros",
  "Parametrização",
  "Treinamento e Validações",
  "Operação Assistida",
  "Fechamento de Folha",
  "Expansão",
  "Encerramento",
];

// IDs das âncoras
export const ANCHOR_IDS = [
  "alinhamento_inicial",
  "go_live_registro_ponto",
  "agenda_fechamento_folha",
  "expansao_registro_ponto_real",
  "agenda_encerramento_projeto",
];