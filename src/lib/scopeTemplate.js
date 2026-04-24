// ============================================================
// TEMPLATE OFICIAL DO ESCOPO TÉCNICO — v1.0
// Baseado no JSON schema aprovado (schemaVersion: 1.0.0)
// NÃO alterar textos, ordem ou estrutura sem aprovação
// ============================================================

export const SCOPE_MODULES = [
  {
    moduleOrder: 1,
    moduleKey: "informacoes_gerais_projeto",
    moduleLabel: "INFORMAÇÕES GERAIS DO PROJETO",
    alwaysVisible: true,
    questions: [
      {
        order: 1, id: "q001",
        prompt: "Número de funcionários contratados",
        description: "Informação recebida na passagem de bastão. Campo a ser confirmado com o cliente",
        type: "number", options: [], placeholder: "[descrever - texto livre]", rules: []
      },
      {
        order: 2, id: "q002",
        prompt: "Quantas operações existem, considerando municípios e Estados?",
        description: "Este campo tem como objetivo identificar o nível de dispersão da operação, considerando unidades físicas, filiais ou locais de trabalho ativos. Essa informação impacta diretamente na definição da estratégia de implantação, logística de dispositivos, configuração de regras e expansão do projeto.",
        type: "number", options: [], placeholder: "[xxx]", rules: []
      },
      {
        order: 3, id: "q003",
        prompt: "Parametrização do arquivo de exportação de verbas para folha de pagamentos foi contratado?",
        description: "Obs.: Caso seja um cliente do grupo Sankhya, todo projeto contempla o arquivo de exportação de apontamentos para o Pessoal+/MGE. Se não estiver contratado e não for cliente Sankhya, o cliente deverá utilizar por padrão o R05 para fechamento da folha",
        type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
      }
    ]
  },
  {
    moduleOrder: 2,
    moduleKey: "integracao_folha_sankhya",
    moduleLabel: "PROCESSO: INTEGRAÇÃO FOLHA SANKHYA",
    alwaysVisible: false,
    autoShowWhen: { field: "origin", value: "Sankhya" },
    manualOverrideKey: "sankhya_manual_override",
    questions: [
      {
        order: 4, id: "q004",
        prompt: "A implantação Sankhya foi finalizada? Se não, qual o prazo? ",
        description: "Essa informação é necessária para validar a viabilidade de ativação da integração com a Sankhya, considerando que a integração só pode ser realizada após a finalização da implantação e o go live da folha de pagamento no sistema do cliente.\n\nCaso a implantação não esteja concluída, o prazo informado será utilizado como referência para o planejamento da ativação da integração.",
        type: "single_select", options: ["Sim", "Não"], placeholder: null,
        rules: [{ type: "additional_context_in_observations", when: "always", message: "Se não, informar o prazo em Observações." }]
      },
      {
        order: 5, id: "q005",
        prompt: "Se sim, Pessoal+ ou folha MGE ?",
        description: "",
        type: "long_text", options: [], placeholder: "[descrever - texto livre]",
        rules: [{ type: "conditional_visibility", dependsOn: "q004", condition: { operator: "equals", value: "Sim" } }]
      },
      {
        order: 6, id: "q006",
        prompt: "Se Sim, Foi preenchido o formulário para ativação da integração?",
        description: "O preenchimento do formulário é necessário para a coleta das informações técnicas obrigatórias para a ativação da integração com a Sankhya.",
        type: "single_select", options: ["Sim", "Não"], placeholder: null,
        rules: [{ type: "conditional_visibility", dependsOn: "q004", condition: { operator: "equals", value: "Sim" } }]
      }
    ]
  },
  {
    moduleOrder: 3,
    moduleKey: "registro_ponto",
    moduleLabel: "MÓDULO: REGISTRO DE PONTO",
    alwaysVisible: false,
    showWhenContractedModule: "Registro de Ponto",
    subsections: [
      {
        label: "Processo de registro de ponto",
        questions: [
          {
            order: 7, id: "q007",
            prompt: "Quantos colaboradores utilizarão o ponto para a fase de acompanhamento (primeiro fechamento)?",
            description: "Recomenda-se, sempre que possível, a realização de um go live único. Para isso, é necessário garantir que todas as parametrizações estejam validadas previamente, que os dispositivos estejam disponíveis e que o cliente tenha engajamento e disponibilidade para condução do projeto dentro do cronograma estabelecido.",
            type: "number", options: [], placeholder: "[numerico]", rules: []
          },
          {
            order: 8, id: "q008",
            prompt: "Possuem os dispositivos? ",
            description: "",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 9, id: "q009",
            prompt: "[Se não] Já foi providenciada a compra de dispositivos?",
            description: "",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]",
            rules: [{ type: "conditional_visibility", dependsOn: "q008", condition: { operator: "equals", value: "Não" } }]
          },
          {
            order: 10, id: "q010",
            prompt: "Existe infraestrutura de rede (internet) em todos os locais de trabalho?",
            description: "Essa informação é importante para avaliar a disponibilidade de conectividade nos locais de trabalho e definir a estratégia e frequência de sincronização dos registros de ponto no sistema.\n\nApesar de o registro de ponto funcionar em modo offline, a conexão com a internet é necessária para o envio dos dados ao sistema, garantindo que o cliente consiga realizar o acompanhamento e o tratamento da folha de ponto dentro dos prazos operacionais estabelecidos.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 11, id: "q011",
            prompt: "Existem colaboradores com dispensa de ponto? ",
            description: "Geralmente cargos de confiança e PJ são dispensados de ponto,",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          }
        ]
      },
      {
        label: "Dados adicionais sobre o módulo de registro de ponto",
        questions: [
          {
            order: 12, id: "q012",
            prompt: "Qual o método de registro de ponto era utilizado? (Aplicativo, relógio ou manual)",
            description: "Essa informação é necessária para entender o cenário atual do cliente e avaliar o nível de maturidade do processo de registro de ponto, permitindo identificar possíveis impactos na mudança para o modelo da Pontotel.",
            type: "single_select", options: ["Aplicativo", "Relógio físico", "Manual", "Outro"], placeholder: null,
            rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
          },
          {
            order: 13, id: "q013",
            prompt: "O registro de ponto será individual, coletivo ou misto?\t\t\t",
            description: "Essa informação é necessária para definir o modelo de registro de ponto (individual, coletivo ou misto), impactando diretamente na configuração do sistema, escolha dos dispositivos, logística de implantação e experiência do colaborador.\n\nComo direcionamento:\n\n- Colaboradores administrativos (com acesso a computador): recomendável uso via web;\n- Colaboradores em ambiente operacional (ex: produção): recomendável uso de dispositivo coletivo fixo;\n- Colaboradores externos ou em mobilidade: recomendável uso de dispositivo individual (aplicativo).\nImportante: \n- Como boa prática é importante que a empresa tenha um plano B para registro de ponto em caso de quebra/ perda do dispositivo.\n- Como boa prática, recomenda-se a utilização de dispositivos corporativos para o registro de ponto, garantindo maior controle, padronização do uso e redução de riscos operacionais, como indisponibilidade por problemas em aparelhos pessoais, falta de bateria, bloqueios de acesso ou uso indevido.",
            type: "multi_select", options: ["Individual", "Coletivo", "Misto"], placeholder: null, rules: []
          },
          {
            order: 14, id: "q014",
            prompt: "[Se individual] Vai usar Pontotel Gestão ou Bate Ponto?",
            description: "Essa informação é necessária para definir qual aplicação será utilizada no modelo de registro individual, impactando diretamente na experiência do colaborador e nas funcionalidades disponíveis.\n\nComo boa prática:\n\n- Recomenda-se o uso do App Gestão quando os colaboradores precisarem acessar a folha de ponto, realizar consultas e/ou solicitar correções;\n- Recomenda-se o uso do Bate Ponto quando o objetivo for exclusivamente o registro de ponto, sem necessidade de acompanhamento da folha. Nesse caso, o colaborador poderá consultar apenas os registros realizados nos últimos 30 dias.",
            type: "single_select", options: ["Pontotel Gestão", "Bate Ponto"], placeholder: null,
            rules: [{ type: "conditional_visibility", dependsOn: "q013", condition: { operator: "contains", value: "Individual" } }]
          },
          {
            order: 15, id: "q015",
            prompt: "Confirmação de como será feito o registro de ponto na Pontotel",
            description: "Essa informação é necessária para definir como será realizado o registro de ponto na Pontotel, impactando diretamente na configuração do sistema, experiência do colaborador e estratégia operacional do cliente.\n\nAs opções disponíveis são:\n\n- App Gestão: permite o registro de ponto, acompanhamento da folha, solicitações e interações com o RH;\n- App Bate Ponto: focado exclusivamente no registro de ponto, com consulta limitada aos registros dos últimos 30 dias, sem visualização de cálculos;\n- Bate Ponto Web: registro de ponto realizado via navegador, indicado para colaboradores com acesso a computador;\n- AFD (importação): registro realizado por dispositivos externos, com envio dos dados via arquivo para processamento no sistema;\n- Ponto por exceção: modelo em que o registro ocorre apenas em situações fora do padrão previsto de jornada.",
            type: "multi_select", options: ["App Bateponto", "App Gestão", "Bate ponto web", "AFD importação", "Ponto por exceção"], placeholder: null, rules: []
          },
          {
            order: 16, id: "q016",
            prompt: "Nossa recomendação é que o ponto seja marcado no modelo sequencial. Podemos seguir assim?",
            description: "Essa definição é importante para configurar a forma como os registros de ponto serão realizados no sistema, impactando diretamente na usabilidade e na experiência do colaborador.\n\nNo modelo sequencial, o colaborador realiza apenas os registros de ponto, sem a necessidade de indicar se é entrada, pausa, retorno ou saída. O sistema organiza automaticamente os registros na linha do tempo de acordo com a ordem em que foram realizados.\n\nEsse modelo reduz a quantidade de interações no aplicativo, tornando o processo mais simples e ágil, sendo especialmente recomendado para cenários com registro coletivo.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 17, id: "q017",
            prompt: "Colaborador irá acompanhar o espelho de ponto em tempo real?",
            description: "Essa definição é importante para determinar se os colaboradores terão visibilidade em tempo real do espelho de ponto, impactando diretamente na transparência e na autonomia no acompanhamento da jornada.\n\nPara viabilizar essa funcionalidade, é necessário que o colaborador possua acesso ao sistema, por meio de usuário ativo no Gestão Web ou App Gestão.\n\nNo caso do uso do aplicativo Bate Ponto, o colaborador poderá consultar apenas os registros realizados nos últimos 30 dias, sem visualização dos cálculos da jornada.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 18, id: "q018",
            prompt: "A pausa refeição do funcionário será pré-assinalada?",
            description: "Essa definição é importante para configurar o tratamento da pausa de refeição no sistema, impactando diretamente na rotina de registro e no cálculo da jornada.\n\nRecomenda-se a utilização da pausa pré-assinalada, pois simplifica o processo de registro de ponto, reduzindo a necessidade de marcações adicionais pelo colaborador.\n\nNesse modelo, a pausa é considerada automaticamente de acordo com o cadastrado na jornada, sendo de responsabilidade do colaborador sinalizar exceções, como a não realização ou realização em horário diferente do previsto.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 19, id: "q019",
            prompt: "[Para registro individual] Nossa recomendação é ativar as notificações de aviso para o registro de ponto. Podemos seguir assim?",
            description: "Essa definição é importante para apoiar o colaborador no cumprimento correto da jornada, por meio de lembretes para realização dos registros de ponto.\n\nRecomenda-se a ativação das notificações de aviso, pois auxiliam na redução de esquecimentos e aumentam a aderência ao registro correto da jornada.\n\nAs notificações estão disponíveis apenas para colaboradores que utilizam o registro via Web ou App Gestão.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null,
            rules: [{ type: "conditional_visibility", dependsOn: "q013", condition: { operator: "contains", value: "Individual" } }]
          }
        ]
      }
    ]
  },
  {
    moduleOrder: 4,
    moduleKey: "reducao_risco_registro",
    moduleLabel: "MÓDULO: REDUÇÃO DE RISCO NO REGISTRO",
    alwaysVisible: false,
    showWhenContractedModule: "Redução de Riscos no Registro",
    questions: [
      {
        order: 20, id: "q020",
        prompt: "[aplicativo bate ponto e aplicativo gestão) Cerca virtual da geocalização será utilizada para controle do registro?",
        description: "Essa definição é importante para configurar o controle de geolocalização no registro de ponto, garantindo que as marcações sejam realizadas dentro de uma área previamente definida.\n\nRecomenda-se a utilização da cerca virtual em cenários onde o colaborador atua em um local fixo e utiliza registro individual, permitindo maior controle e aderência ao local de trabalho.",
        type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
      },
      {
        order: 21, id: "q021",
        prompt: "Nossa recomendação é registrar ponto via reconhecimento facial, podemos seguir? ",
        description: "Essa definição é importante para configurar o método de autenticação no registro de ponto, impactando diretamente na segurança, confiabilidade das marcações e experiência do colaborador.\n\nRecomenda-se a utilização do reconhecimento facial, pois oferece maior segurança e reduz riscos de registros indevidos (como marcações por terceiros).\n\nAs opções disponíveis são:\n\n- Reconhecimento facial: método mais seguro, baseado na validação biométrica do colaborador;\n- QR Code: permite registro por leitura de código, geralmente vinculado a um dispositivo ou local;\n- PIN: autenticação por código numérico, podendo ser utilizado como alternativa ou contingência;\n- Outro: deve ser especificado conforme necessidade do cliente.",
        type: "single_select", options: ["Reconhecimento facial", "Qr code", "PIN", "Outro"], placeholder: null,
        rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
      },
      {
        order: 22, id: "q022",
        prompt: "Existe algum impeditivo para o empregado não conseguir registrar com o reconhecimento facial?",
        description: "Essa definição é importante para configurar o uso do PIN como método alternativo de autenticação no registro de ponto, garantindo a continuidade da operação e mitigando riscos de bloqueio no registro.\n\nO PIN será solicitado nos primeiros registros do colaborador no dispositivo (até a sincronização com o sistema) e, após esse processo, será utilizado apenas em situações de exceção, como:\n\n- Falha no reconhecimento facial;\n- Posicionamento inadequado do colaborador frente à câmera;\n- Movimentação do dispositivo durante a tentativa de registro;\n- Baixa iluminação ou condições ambientais que dificultem a leitura facial;\n- Uso de acessórios ou EPIs que impeçam a identificação facial (ex: máscaras, óculos de proteção, capacetes).",
        type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
      }
    ]
  },
  {
    moduleOrder: 5,
    moduleKey: "calculos_tratamento",
    moduleLabel: "MÓDULO: CALCULOS E TRATAMENTO",
    alwaysVisible: false,
    showWhenContractedModule: "Cálculos e Tratamento",
    subsections: [
      {
        label: "Processo de fechamento de ponto",
        questions: [
          {
            order: 23, id: "q023",
            prompt: "Os pontos serão importados manualmente ou por arquivo AFD para validação de cálculos? ",
            description: "Essa definição é importante para estabelecer como será realizada a validação das regras de cálculo durante a fase de implantação.\n\nCaso seja utilizada a importação de arquivo AFD, a validação será feita com base em dados reais de registro de ponto.\n\nCaso não seja utilizada a importação de AFD, a validação será realizada por meio de folhas de ponto pré-preenchidas em colaboradores de teste, seguindo cenários padrão da Pontotel, podendo também contar com o apoio do cliente no preenchimento de casos específicos.",
            type: "single_select", options: ["Manual", "Arquivo AFD"], placeholder: null, rules: []
          },
          {
            order: 24, id: "q024",
            prompt: "Quantos sindicatos cadastrados ",
            description: "Essa informação é necessária para identificar a quantidade de sindicatos envolvidos na operação, impactando diretamente na definição e parametrização das regras de cálculo no sistema.",
            type: "number", options: [], placeholder: "[xxx]", rules: []
          },
          {
            order: 25, id: "q025",
            prompt: "Existe alguma escala 'Diferente' (que não seja: 5x2, 6x1 e 12x36)?",
            description: "Essa informação é necessária para identificar a existência de escalas de trabalho fora dos modelos padrão (5x2, 6x1 e 12x36), que possam exigir parametrizações específicas no sistema.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 251, id: "q251",
            prompt: "Descreva as escalas diferentes utilizadas",
            description: "Informe quais são as escalas fora do padrão (5x2, 6x1, 12x36) utilizadas na empresa.",
            type: "long_text", options: [], placeholder: "[descrever as escalas — texto livre]",
            rules: [{ type: "conditional_visibility", dependsOn: "q025", condition: { operator: "equals", value: "Sim" } }]
          },
          {
            order: 26, id: "q026",
            prompt: "Qual é a maior dor no processo de tratamento de ponto e fechamento de folha atualmente?",
            description: "Essa informação é necessária para identificar os principais desafios enfrentados pelo cliente no processo atual, permitindo direcionar a implantação para mitigar riscos, melhorar eficiência operacional e gerar ganhos perceptíveis no dia a dia.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          },
          {
            order: 27, id: "q027",
            prompt: "O pagamento é feito por contabilidade interna ou externa?",
            description: "Essa informação é importante para entender o fluxo de fechamento da folha e os envolvidos no processo, impactando diretamente nos prazos, integrações e responsabilidades operacionais.",
            type: "single_select", options: ["Interna", "Externa"], placeholder: null, rules: []
          },
          {
            order: 28, id: "q028",
            prompt: "Qual o sistema de folha de pagamento?",
            description: "Essa informação é necessária para identificar o sistema de folha utilizado pelo cliente, possibilitando avaliar integrações, layout de arquivos e requisitos técnicos para envio das informações.",
            type: "short_text", options: [], placeholder: "[anotar nome do provedor]", rules: []
          },
          {
            order: 29, id: "q029",
            prompt: "O periodo de folha de ponto e folha de pagamento é o mesmo?",
            description: "Essa definição é importante para entender se os ciclos de apuração estão alinhados, impactando diretamente na organização do fechamento, envio de informações e possíveis ajustes operacionais.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 30, id: "q030",
            prompt: "Qual o período de apuração do ponto?",
            description: "Essa informação define o período de apuração da folha de ponto, determinando o dia de início e término do ciclo de apuração no sistema (ex: dia 01, 15, 21).\n\nEssa configuração é fundamental para o correto cálculo da jornada, organização do fechamento e alinhamento com o processo de folha de pagamento.",
            type: "date_range_text", options: [], placeholder: "xx/xx/xxxx", rules: []
          },
          {
            order: 31, id: "q031",
            prompt: "Qual o periodo de folha de pagamento? ",
            description: "Essa informação define o intervalo considerado para processamento da folha de pagamento, impactando na integração com o ponto e no envio das verbas para pagamento.",
            type: "date_range_text", options: [], placeholder: "xx/xx/xxxx", rules: []
          },
          {
            order: 32, id: "q032",
            prompt: "Qual o período de fechamento?",
            description: "Essa informação é importante para definir o intervalo destinado ao tratamento e conferência dos dados de ponto antes do envio para a folha de pagamento.",
            type: "date_range_text", options: [], placeholder: "[xx/xx/xxxx]", rules: []
          },
          {
            order: 33, id: "q033",
            prompt: "Qual o prazo para o envio das informações para a contabilidade? ou importação de apontamentos no sistema de folha?",
            description: "Essa informação é necessária para garantir o cumprimento dos prazos operacionais do cliente, impactando diretamente na organização do fechamento e na definição do cronograma do projeto.",
            type: "number", options: [], placeholder: "xx", rules: []
          },
          {
            order: 34, id: "q034",
            prompt: "Data do pagamento para os funcionários?",
            description: "Essa informação é importante para alinhar o cronograma de fechamento da folha de ponto e envio das informações, garantindo que os prazos de pagamento sejam cumpridos.",
            type: "number", options: [], placeholder: "xx", rules: []
          },
          {
            order: 35, id: "q035",
            prompt: "Como boa prática recomendamos olhar o \"Verificar folhas\" diariamente, vocês teriam algum impeditivo para executar esse processo?",
            description: "Essa validação é importante para garantir a aderência a uma rotina de acompanhamento contínuo da folha de ponto, permitindo a identificação e correção de inconsistências de forma antecipada, reduzindo o esforço no fechamento.",
            type: "long_text", options: [], placeholder: "[anotar qual a rotina, se houver]", rules: []
          },
          {
            order: 36, id: "q036",
            prompt: "Quantos dias demoram para realizar a correção de ponto atualmente?",
            description: "Essa informação é necessária para entender o tempo atual de tratamento de inconsistências, permitindo avaliar o ganho de eficiência esperado com a implantação e identificar possíveis gargalos no processo.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          }
        ]
      },
      {
        label: "Dados adicionaris sobre o módulo de calculo de tratamento de ponto",
        questions: [
          {
            order: 37, id: "q037",
            prompt: "Existe acordo coletivo para o controle do banco de horas?",
            description: "Essa informação é necessária para identificar se há regras específicas definidas em acordo coletivo para o controle do banco de horas.\n\nEssas regras impactam diretamente na parametrização do sistema, como prazos de compensação, limites de acúmulo e critérios de pagamento ou expiração das horas.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 38, id: "q038",
            prompt: "Existe regime de sobreaviso aplicado?",
            description: "Essa informação é necessária para identificar a existência de jornadas em regime de sobreaviso, nas quais o colaborador permanece à disposição da empresa fora do horário regular de trabalho.\n\nEsse cenário exige parametrizações específicas no sistema para correto cálculo e tratamento dessas horas.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 39, id: "q039",
            prompt: "A norma regulamentadora NR17 é aplicada na empresa?",
            description: "Essa informação é necessária para identificar a aplicação da Norma Regulamentadora nº 17 (NR-17), que estabelece diretrizes relacionadas à ergonomia, incluindo pausas obrigatórias em determinadas atividades (como teleatendimento).\n\nA aplicação dessa norma impacta diretamente na configuração das jornadas e pausas no sistema, garantindo conformidade com a legislação.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          }
        ]
      }
    ]
  },
  {
    moduleOrder: 6,
    moduleKey: "gestao_ponto_participativa",
    moduleLabel: "MÓDULO: GESTÃO DE PONTO PARTICIPATIVA",
    alwaysVisible: false,
    showWhenContractedModule: "Gestão de Ponto Participativa",
    subsections: [
      {
        label: "Solicitação de correção de ponto e atestado",
        questions: [
          {
            order: 40, id: "q040",
            prompt: "O projeto será centralizado ou descentralizado?",
            description: "Essa definição é importante para estabelecer o modelo de gestão do tratamento de ponto, determinando se as ações serão concentradas em um único time (ex: RH) ou distribuídas entre gestores e/ou colaboradores.",
            type: "single_select", options: ["Centralizada", "Descentralizada"], placeholder: null, rules: []
          },
          {
            order: 41, id: "q041",
            prompt: "Se descentralizada quem irá participar?",
            description: "Essa informação é necessária para identificar quais áreas e perfis participarão da rotina descentralizada de tratamento de ponto, permitindo definir responsabilidades, fluxos de aprovação e configuração de permissões no sistema.\n\nExemplos de participação:\n\n- Gestores/Supervisores: aprovação de solicitações de correção de ponto da equipe;\n- RH Saúde/Medicina do Trabalho: validação e controle de atestados médicos;\n- Colaboradores: solicitação de correções, envio de justificativas e atestados.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]",
            rules: [{ type: "conditional_visibility", dependsOn: "q040", condition: { operator: "equals", value: "Descentralizada" } }]
          },
          {
            order: 42, id: "q042",
            prompt: "Quem irá realizar a solicitação de correção de ponto?",
            description: "Essa informação define quais perfis terão permissão para solicitar ajustes na folha de ponto, impactando diretamente na descentralização do processo e no volume de demandas operacionais.",
            type: "single_select", options: ["Funcionário", "Gestor", "Supervisor", "RH", "Outro"], placeholder: null,
            rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
          },
          {
            order: 43, id: "q043",
            prompt: "Quem irá aprovar solicitação de correção de ponto?",
            description: "Essa informação define os responsáveis pela aprovação das solicitações de correção, sendo fundamental para configuração das alçadas de aprovação e garantia de controle e rastreabilidade do processo.",
            type: "single_select", options: ["Supervisor", "Gestor", "RH", "Outro"], placeholder: null,
            rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
          },
          {
            order: 44, id: "q044",
            prompt: "Quem irá solicitar os atestados na folha de ponto?",
            description: "Essa informação define quais perfis poderão realizar o envio ou lançamento de atestados no sistema, impactando na organização do fluxo e na autonomia dos envolvidos.",
            type: "single_select", options: ["Funcionário", "Gestor", "Supervisor", "RH", "Outro"], placeholder: null,
            rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
          },
          {
            order: 45, id: "q045",
            prompt: "Quem irá aprovar os atestados na folha de ponto?",
            description: "Essa informação define os responsáveis pela validação dos atestados, sendo essencial para garantir conformidade com as políticas internas e requisitos legais.",
            type: "single_select", options: ["RH", "Gestor", "Supervisor", "Outro"], placeholder: null,
            rules: [{ type: "require_observations_when_option_selected", option: "Outro" }]
          },
          {
            order: 46, id: "q046",
            prompt: "Após feita solicitação, pode ja aparecer na folha ou aparece somente após aprovado? ",
            description: "Essa definição impacta diretamente na visualização das informações na folha de ponto, determinando se as solicitações terão efeito imediato ou apenas após validação.\n\nRecomenda-se que as solicitações apareçam na folha imediatamente após o envio, pois isso evita retrabalho e reduz a possibilidade de múltiplas solicitações para o mesmo ajuste, mantendo a rastreabilidade do processo.",
            type: "single_select", options: ["Já aparece", "Somente após aprovado"], placeholder: null, rules: []
          },
          {
            order: 47, id: "q047",
            prompt: "Será definido prazo limite para realizar solicitações após a data do evento?Se sim, qual o prazo?",
            description: "Essa definição permite estabelecer um prazo máximo para que solicitações sejam realizadas após a ocorrência do evento, evitando alterações retroativas fora do controle da empresa.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          },
          {
            order: 48, id: "q048",
            prompt: "Será definido prazo para resposta (aprovação/reprovação) das solicitações? Se sim, qual o prazo?",
            description: "Essa definição estabelece um prazo limite para aprovação ou reprovação das solicitações, garantindo controle e evitando acúmulo de pendências no processo.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          }
        ]
      },
      {
        label: "Assinatura do espelho de ponto",
        questions: [
          {
            order: 49, id: "q049",
            prompt: "Será aplicado o processo de assinatura do espelho de ponto online?",
            description: "Essa definição é importante para estabelecer o processo de validação dos registros de ponto, garantindo que os apontamentos realizados estejam de acordo entre as partes envolvidas.\n\nNesse modelo, o colaborador realiza a conferência e confirmação dos seus registros, e o gestor e/ou RH valida as informações, formalizando o aceite da folha de ponto.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 50, id: "q050",
            prompt: "Se for bilateral quem irá participar do processo?",
            description: "Essa informação define os responsáveis pela confirmação do espelho de ponto no modelo bilateral, sendo fundamental para garantir a rastreabilidade e a validação formal das informações.\n\nGeralmente, participam desse processo:\n\n- Colaborador: responsável por conferir e confirmar seus registros de ponto;\n- Gestor: responsável por validar as informações da equipe;\n- RH (quando aplicável): responsável pela governança e validação final do processo.\n\nComo essa etapa está diretamente relacionada ao travamento da folha, recomenda-se definir em política interna um prazo para realização das confirmações. Caso o prazo não seja cumprido, o RH poderá realizar o travamento da folha de forma unilateral, garantindo o cumprimento do cronograma de fechamento.",
            type: "long_text", options: [], placeholder: null,
            rules: [{ type: "conditional_visibility", dependsOn: "q049", condition: { operator: "equals", value: "Sim" } }]
          }
        ]
      }
    ]
  },
  {
    moduleOrder: 7,
    moduleKey: "controle_custo",
    moduleLabel: "MÓDULO: CONTROLE DE CUSTO",
    alwaysVisible: false,
    showWhenContractedModule: "Controle de Custos",
    subsections: [
      {
        label: "Gestão de horas extras",
        questions: [
          {
            order: 51, id: "q051",
            prompt: "Observação importante:",
            description: "A aprovação ou não das horas extras não determina se elas serão computadas na folha de ponto.\nCaso o colaborador realize horas extras, elas serão consideradas nos apontamentos.\n\nCabe à empresa definir políticas internas e disciplinares para casos de realização de horas extras sem justificativa ou sem aprovação prévia.",
            type: "informativo", options: [], placeholder: null, rules: []
          },
          {
            order: 52, id: "q052",
            prompt: "O funcionário deverá justificar a realização de horas extras? ",
            description: "Essa definição estabelece se o colaborador deverá informar o motivo da realização das horas extras, garantindo maior controle, auditoria e transparência no processo.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 53, id: "q053",
            prompt: "O colaborador poderá solicitar horas extras antecipadamente ou apenas justificar após a realização?",
            description: "Essa informação define o modelo de funcionamento do processo, podendo ser: solicitação antecipada (planejamento) e/ou justificativa posterior (controle corretivo).\n\nEssa definição impacta diretamente na gestão da jornada e no nível de controle operacional sobre horas extras.",
            type: "single_select", options: ["Justificar horas extras", "Solicitar horas extras"], placeholder: null, rules: []
          },
          {
            order: 54, id: "q054",
            prompt: "Quem poderá solicitar horas extras?",
            description: "Essa informação define quais perfis terão permissão para realizar solicitações ou justificativas, impactando diretamente na descentralização do processo.\n\nImportante: apenas colaboradores com usuário ativo no sistema poderão utilizar essa funcionalidade.",
            type: "multi_select", options: ["Funcionário", "Gestor", "RH", "Supervisor"], placeholder: null, rules: []
          },
          {
            order: 55, id: "q055",
            prompt: "Quem será responsável pela aprovação das horas extras?",
            description: "Essa informação define os responsáveis pela validação das horas extras (ex: gestor, RH), sendo fundamental para configuração das alçadas de aprovação e governança do processo.",
            type: "single_select", options: ["Supervisor", "Gestor", "RH"], placeholder: null, rules: []
          },
          {
            order: 56, id: "q056",
            prompt: "Haverá limite diário de horas extras para solicitação antecipada? Se sim, qual será o limite?",
            description: "Essa definição permite configurar um limite máximo de horas extras que podem ser solicitadas por dia, evitando excessos e auxiliando no controle operacional.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          },
          {
            order: 57, id: "q057",
            prompt: "Será configurado prazo para justificativa de horas extras?Se sim, qual o prazo?",
            description: "Essa informação define o prazo limite para que o colaborador justifique horas extras realizadas.\n\nApós esse prazo, a solicitação poderá ser bloqueada e marcada como 'vencida de justificativa', impedindo sua regularização pelo colaborador.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          },
          {
            order: 58, id: "q058",
            prompt: "O prazo de justificativa será contado em dias corridos ou úteis?",
            description: "Essa definição impacta diretamente na contagem do prazo para justificativas, considerando ou não finais de semana e feriados.",
            type: "single_select", options: ["Dias corridos", "Dias úteis"], placeholder: null, rules: []
          },
          {
            order: 59, id: "q059",
            prompt: "Será configurada tolerância para horas extras sem necessidade de justificativa? Se Sim, qual a tolerância?",
            description: "Essa definição permite estabelecer um tempo limite (ex: minutos por dia) em que o colaborador não precisa justificar horas extras, evitando solicitações desnecessárias para pequenas variações de jornada.",
            type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
          },
          {
            order: 60, id: "q060",
            prompt: "Será utilizado controle de limite de horas extras para acompanhamento?",
            description: "Essa definição permite configurar um limite de horas extras visível ao colaborador, auxiliando no controle e gestão da jornada.\n\nQuando habilitado, esse limite é apresentado diretamente na linha da jornada na folha de ponto, permitindo que o colaborador acompanhe seu saldo e evite exceder o limite estabelecido.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          },
          {
            order: 61, id: "q061",
            prompt: "Será utilizado a justificativa por áudio?",
            description: "Nos aplicativos Bateponto e Gestão, a solicitação ou justificativa de horas extras pode ser realizada de forma simplificada por meio da funcionalidade de justificativa por áudio. Essa funcionalidade permite que o usuário registre a justificativa de forma oral, dispensando a necessidade de digitação manual no teclado do dispositivo.",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          }
        ]
      },
      {
        label: "Notificações",
        questions: [
          {
            order: 62, id: "q062",
            prompt: "Haverá envio de notificações relacionadas a horas extras?",
            description: "É recomendado que seja habilitada as notificações. Para que eles recebam, é necessário que dentro da configuração do dispositivo esteja habilitado as notificações para o aplicativo",
            type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
          }
        ]
      }
    ]
  },
  {
    moduleOrder: 8,
    moduleKey: "gestao_ferias",
    moduleLabel: "MÓDULO: GESTÃO DE FÉRIAS",
    alwaysVisible: false,
    showWhenContractedModule: "Gestão de Férias e Ausências",
    questions: [
      {
        order: 63, id: "q063",
        prompt: "O processo de solicitação de férias será realizado pelo colaborador?",
        description: "",
        type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
      },
      {
        order: 64, id: "q064",
        prompt: "Quem poderá agendar férias no sistema? Sem necessidade de aprovação",
        description: "",
        type: "long_text", options: [], placeholder: null, rules: []
      },
      {
        order: 65, id: "q065",
        prompt: "Quem será responsável pela aprovação das férias?",
        description: "",
        type: "long_text", options: [], placeholder: null, rules: []
      },
      {
        order: 66, id: "q066",
        prompt: "Será respeitado prazo mínimo para solicitação de férias?",
        description: "Essa definição permite estabelecer um prazo mínimo entre a solicitação e o início das férias, garantindo conformidade com políticas internas e legislação aplicável. Padrão 30 dias mínimos",
        type: "long_text", options: [], placeholder: "[descrever - texto livre]", rules: []
      },
      {
        order: 67, id: "q067",
        prompt: "O colaborador poderá solicitar antecipação do 13º salário junto às férias?",
        description: "Essa definição estabelece se será permitido ao colaborador solicitar o adiantamento do 13º salário no momento da solicitação de férias, conforme previsto na legislação.",
        type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
      }
    ]
  },
  {
    moduleOrder: 9,
    moduleKey: "timesheet",
    moduleLabel: "MÓDULO: Timesheet",
    alwaysVisible: false,
    showWhenContractedModule: "Timesheet",
    questions: [
      {
        order: 68, id: "q068",
        prompt: "Será parametrizado o módulo de timesheet?",
        description: "Direcionado ao controle de atividades,",
        type: "single_select", options: ["Sim", "Não"], placeholder: null, rules: []
      }
    ]
  }
];

// Nomes dos módulos contratáveis (usados no NewProject e Dados Iniciais)
export const CONTRACTED_MODULES_OPTIONS = [
  "Registro de Ponto",
  "Redução de Riscos no Registro",
  "Cálculos e Tratamento",
  "Gestão de Ponto Participativa",
  "Controle de Custos",
  "Gestão de Férias e Ausências",
  "Timesheet"
];

// Helper: retorna todos os questions flat de um módulo (incluindo subsections)
export function getModuleQuestions(mod) {
  if (mod.questions) return mod.questions;
  if (mod.subsections) return mod.subsections.flatMap(s => s.questions);
  return [];
}

// Helper: verifica se módulo deve ser visível dado os módulos contratados e origem
export function isModuleVisible(mod, contractedModules, origin, manualOverrides = {}) {
  if (mod.alwaysVisible) return true;
  if (mod.autoShowWhen) {
    const autoShow = origin === mod.autoShowWhen.value;
    const manual = manualOverrides[mod.manualOverrideKey] === true;
    return autoShow || manual;
  }
  if (mod.showWhenContractedModule) {
    return (contractedModules || []).includes(mod.showWhenContractedModule);
  }
  return false;
}