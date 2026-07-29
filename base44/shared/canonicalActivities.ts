// ============================================================
// CANONICAL_ACTIVITIES_BY_PHASE
// Fonte única do mapa de atividades por fase (espelho do scheduleTasks.js).
// Usado pelo wildcard "*" para criar atividades faltantes no banco.
// Importado por: syncScheduleFromPipedrive, applyPipedriveRules,
// pipedriveWebhook — não duplicar.
// ============================================================

export const CANONICAL_ACTIVITIES_BY_PHASE = {
  "Abertura de projeto": [
    "Alinhamento inicial",
    "Agenda de escopo técnico",
    "Envio de Termo de Abertura do Projeto e cronograma",
    "Agenda de Status report recorrente (1ª Validação de Cronograma e Termo de abertura)",
  ],
  "Integração": [
    "[Sankhya] Envio do formulário de dados para integração",
    "Preenchimento do formulário de integração [para clientes Sankhya]",
    "Inicio da ativação da integração, análise de inconsistências, alinhamento com o cliente para ajustes",
    "[Sankhya] Correção de cadastros Sankhya",
    "Ativação da integração [para clientes Sankhya]",
  ],
  "Cadastros": [
    "Envio da documentação com orientações para o uso do I05",
    "Importação de cadastros pelo I05",
    "Envio da planilha de importação de escalas [para clientes Sankhya]",
  ],
  "Parametrização": [
    "Reunião para parametrização de Regras (Cálculo, banco de horas e arquivo de exportação)",
    "Parametrização de regras",
    "Parametrizar permissões de usuários de acordo com o que foi definido no escopo",
    "Validar parametrização de cadastro de empregados e usuários para o registro de ponto de acordo com o escopo técnico",
  ],
  "Treinamento e Validações": [
    "Assistir ao curso EAD da Universidade",
    "Reunião para validar Regras de cálculo de banco de horas",
    "Reunião para validar Arquivo de exportação",
    "Reunião para explicar o uso e validação do fluxo de gestão",
  ],
  "Operação Assistida": [
    "Agenda de inicio de registro de ponto",
    "Inicio de registro de ponto (Go Live)",
    "Agenda de verificação e gestão de folha de ponto (pré-fechamento de ponto)",
  ],
  "Fechamento de Folha": [
    "Agenda fechamento de folha de ponto",
    "Fechamento de folha",
  ],
  "Expansão": [
    "Expansão de registro de ponto real",
    "Fechamento de folha de ponto real (100% da base)",
  ],
  "Encerramento": [
    "Agenda de encerramento de projeto",
    "Assinatura do termo de encerramento de projeto",
    "Passagem para sucesso do cliente",
  ],
};