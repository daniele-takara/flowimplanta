# Sistema de Gestão de Implantações Pontotel
## Documentação Técnica Completa — v1.0 (Abril 2026)

---

## 1. VISÃO GERAL

Sistema web para gerenciar o portfólio de projetos de implantação do Pontotel. Permite acompanhar projetos desde o planejamento até o encerramento, com controle de escopo, cronograma, plano de ação, status reports e documentos formais (TAP e Termo de Encerramento).

**Stack tecnológica:**
- Frontend: React 18 + Tailwind CSS + shadcn/ui
- Backend/BaaS: Base44 (banco de dados, autenticação, backend functions)
- Integração externa: Google Sheets (via OAuth connector compartilhado)

---

## 2. ESTRUTURA DE ROTAS

```
/               → Dashboard (portfólio geral)
/projects       → Lista de projetos
/projects/new   → Formulário de criação (wizard 4 etapas)
/projects/:id   → Detalhes do projeto (abas)
```

Roteamento gerenciado por `react-router-dom` no `App.jsx`. Layout com sidebar persistente via `AppLayout` que usa `<Outlet>`.

---

## 3. ENTIDADES DO BANCO DE DADOS

### 3.1 Project
Entidade central. Cada registro representa um projeto de implantação.

**Campos principais:**
| Campo | Tipo | Descrição |
|---|---|---|
| name | string | Nome do projeto |
| client_name | string | Nome da empresa cliente |
| origin | enum | Pontotel / Parceiro / Indicação / Inbound / Outbound |
| mrr | number | MRR do contrato (R$) |
| status | enum | Planejamento / Em andamento / Em risco / Atrasado / Concluído / Cancelado |
| current_phase | enum | Abertura de projeto / Parametrização / Homologação / Rollout / Go-live / Concluído |
| start_date | date | Data de início |
| planned_end_date | date | Prazo original |
| aligned_end_date | date | Prazo realinhado com cliente |
| implantation_type | enum | Tipo da implantação (5 variações) |
| contracted_employees | number | Funcionários contratados |
| registered_employees | number | Cadastrados no sistema |
| recording_employees | number | Registrando ponto |
| progress_percent | number | 0–100 (atualizado manualmente) |
| contracted_modules | array[string] | Ex: ["Ponto Eletrônico", "Banco de Horas"] |
| contracted_services | array[string] | Ex: ["Integração Sankhya MGE"] |
| pontotel_manager_name / contact | string | Gerente Pontotel |
| pontotel_analyst_name / contact | string | Analista Pontotel |
| sponsor_name / contact | string | Patrocinador do cliente |
| project_leader_name / contact | string | Líder do projeto (RH cliente) |
| operation_name / contact | string | Responsável de operação |
| ti_client_name / contact | string | TI do cliente |
| executive_summary | string | Resumo executivo livre |
| observations | string | Observações adicionais |

---

### 3.2 ScopeItem
Perguntas e respostas do levantamento de escopo técnico, organizadas por seção.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| section | enum | 10 categorias (ex: "Integração Folha Sankhya") |
| order_number | number | Ordem dentro da seção |
| question | string | Pergunta do escopo |
| best_practice | string | Orientação/boa prática |
| answer | string | Resposta preenchida pelo analista |
| observations | string | Observações adicionais |
| field_type | enum | text / select / boolean / number / date |
| is_required | boolean | Campo obrigatório |

**Seções disponíveis:**
1. Informações Gerais do Projeto
2. Integração Folha Sankhya
3. Parametrização Cálculos e Permissões
4. Controle de Custos
5. Módulo de Escala
6. Módulo Banco de Horas
7. Módulo App
8. Dispositivos de Ponto
9. Integrações Externas
10. Outros

---

### 3.3 SchedulePhase
Fases do cronograma de um projeto.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| phase_name | enum | 7 fases (Planejamento → Pós Go-live) |
| planned_start / planned_end | date | Datas planejadas |
| actual_start / actual_end | date | Datas reais |
| progress_percent | number | 0–100 |
| status | enum | Não iniciado / Em andamento / Concluído / Atrasado / Bloqueado |
| order | number | Ordenação visual |

---

### 3.4 ScheduleActivity
Atividades dentro de cada fase do cronograma.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| phase_id | string | FK para SchedulePhase |
| phase_name | string | Nome da fase (redundante para facilitar queries) |
| activity_name | string | Nome da atividade |
| planned_start / planned_end | date | Datas planejadas |
| actual_start / actual_end | date | Datas reais |
| responsible_general | string | Equipes responsáveis |
| responsible_leader | string | Responsável principal |
| status | enum | Não iniciado / Em andamento / Concluído / Atrasado / Bloqueado / Cancelado |
| history_observations | string | Histórico de observações |
| order | number | Ordem dentro da fase |

---

### 3.5 StatusReport
Snapshots periódicos do status do projeto (gerados em reuniões de status report).

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| report_date | date | Data do report |
| overall_progress | number | % de progresso geral |
| executive_summary | string | Texto livre do status |
| general_status | enum | No prazo / Em risco / Atrasado / Concluído |
| registered_employees | number | Cadastrados na data |
| recording_employees | number | Registrando ponto na data |
| adherence_percent | number | % aderência (calculado automaticamente) |
| risks | array[{description, impact, mitigation}] | Lista de riscos |
| client_pending | array[{item, deadline, responsible}] | Pendências do cliente |
| internal_pending | array[{item, deadline, responsible}] | Pendências internas Pontotel |
| next_agenda | string | Assunto da próxima reunião |
| next_agenda_date | date | Data da próxima reunião |

---

### 3.6 ActionPlan
Issues, pendências, erros e melhorias identificados durante o projeto.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| ticket_code | string | Código do ticket (ex: "Ticket#88421") |
| technical_call_code | string | Código da chamada técnica |
| theme | string | Tema/categoria |
| issue | string | Título da issue |
| issue_description | string | Descrição detalhada |
| type | enum | Erro / Melhoria / Dúvida / Pendência / Risco |
| impact | enum | Alto / Médio / Baixo |
| responsible_pontotel | string | Responsável interno |
| responsible_client | string | Responsável do cliente |
| status_pontotel | enum | Aberto / Em andamento / Validação / Concluído / Cancelado |
| status_client | enum | Aberto / Em validação / Validado / Cancelado |
| request_date | date | Data de abertura |
| deadline_date | date | Prazo de resolução |
| solution_date | date | Data da solução |
| new_solution_date | date | Nova data se houver replanejamento |
| rollout_start / rollout_end | date | Janela de rollout |
| history | string | Histórico cronológico de atualizações |

---

### 3.7 Meeting
Reuniões realizadas no projeto. (Entidade criada mas sem tab dedicada na UI ainda)

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| meeting_number | number | Número sequencial |
| date | date | Data da reunião |
| subject | string | Assunto |
| duration | string | Duração (ex: "1h") |
| participants | string | Participantes |
| leader | string | Condutor |
| meeting_type | enum | Status Report / Escopo Técnico / Outros... |
| notes | string | Anotações |

---

### 3.8 ProjectDocument
Documentos formais do projeto: TAP e Termo de Encerramento.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| doc_type | enum | TAP / Termo de Encerramento |
| objective | string | Objetivo do projeto |
| scope_description | string | Descrição do escopo |
| out_of_scope | string | Fora do escopo |
| deliverables | array[string] | Lista de entregáveis |
| assumptions | string | Premissas |
| restrictions | string | Restrições |
| risks_summary | string | Resumo de riscos |
| success_criteria | string | Critérios de sucesso |
| sign_date | date | Data de assinatura |
| signed_by_client | string | Signatário do cliente |
| signed_by_pontotel | string | Signatário Pontotel |
| additional_notes | string | Notas adicionais |
| closure_summary | string | Resumo de encerramento (Termo) |
| lessons_learned | string | Lições aprendidas (Termo) |
| final_status | enum | Concluído com sucesso / Parcialmente / Cancelado (Termo) |

---

### 3.9 ClientUsability
Dados de usabilidade/adoção do cliente, sincronizados a partir de planilha Google Sheets.

**Campos:**
| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| empresa_id | string | ID da empresa no sistema Pontotel |
| nome | string | Nome da empresa |
| data_criacao | string | Data de criação da base |
| numero_funcionarios | number | Total de funcionários |
| numero_funcionarios_ativos | number | Ativos no sistema |
| numero_regras_de_calculo | number | Regras parametrizadas |
| email_ultimo_acesso | string | Email do último acesso |
| data_ultimo_acesso | string | Data do último acesso |
| empregados_batendo_ponto_ultimos_15_dias | number | Registros nos últimos 15 dias |
| data_exportacao | string | Data da exportação da planilha |
| last_synced_at | string | Timestamp da última sincronização |

---

## 4. PÁGINAS E COMPONENTES

### 4.1 Dashboard (`pages/Dashboard`)
**Função:** Visão consolidada do portfólio completo.

**O que exibe:**
- 4 StatsCards: Total de projetos, Em andamento, Concluídos, Atrasados/Em risco
- Painel de funcionários: 3 projetos ativos com maior headcount
- Painel de progresso médio: barra de progresso por projeto
- Tabela filtráveis de projetos com: status, fase, progresso, prazo, gerente, MRR

**Filtros disponíveis:**
- Status (Todos / Em andamento / Em risco / Atrasado / Concluído / Planejamento)
- Gerente de projeto (dinâmico, lido dos dados)

**Como funciona:**
1. `useEffect` carrega `base44.entities.Project.list("-created_date")` na montagem
2. Calcula métricas localmente com `.filter()` e `.reduce()`
3. Filtra a lista de projetos localmente com base nos selects

---

### 4.2 ProjectList (`pages/ProjectList`)
**Função:** Lista de todos os projetos com busca e filtro de status.

**Funcionalidades:**
- Busca por texto (nome do projeto ou cliente)
- Filtro por status
- Alternância entre visualização em cards (`ProjectCard`) e tabela
- Link direto para detalhe do projeto

---

### 4.3 NewProject (`pages/NewProject`)
**Função:** Wizard de 4 etapas para criar um novo projeto.

**Etapas:**
1. **Dados Gerais:** nome, cliente, origem, MRR, tipo de implantação, datas, observações
2. **Participantes:** todos os contatos (cliente: patrocinador, líder, operação, TI; Pontotel: gerente, analista)
3. **Módulos e Serviços:** checkboxes de módulos e serviços contratados
4. **Cronograma (preview):** exibe o template de fases que será criado

**O que acontece ao salvar (`handleSave`):**
1. Cria o `Project` via `base44.entities.Project.create()`
2. Cria todos os `ScopeItem` via `base44.entities.ScopeItem.bulkCreate()` — a partir do `SCOPE_TEMPLATE`
3. Cria todas as `SchedulePhase` via `base44.entities.SchedulePhase.bulkCreate()` — a partir do `SCHEDULE_TEMPLATE`
4. Redireciona para `/projects/:id`

**Nota:** As atividades do cronograma **NÃO são criadas** no wizard — precisam ser adicionadas manualmente depois na aba de Cronograma.

---

### 4.4 ProjectDetail (`pages/ProjectDetail`)
**Função:** Página principal de um projeto com 7 abas.

**Carregamento de dados:**
```js
const [proj, ph, ac, sc, rp, ap, docs] = await Promise.all([
  Project.filter({ id }),         // projeto
  SchedulePhase.filter(...),      // fases
  ScheduleActivity.filter(...),   // atividades
  ScopeItem.filter(...),          // itens de escopo
  StatusReport.filter(...),       // reports
  ActionPlan.filter(...),         // plano de ação
  ProjectDocument.filter(...)     // TAP e Termo
]);
```

Suporta dados mock (IDs que começam com `"proj-"`) para demonstração sem banco.

**7 Abas:**
| Aba | Componente | Função |
|---|---|---|
| Resumo | OverviewTab | Dados gerais, fases, equipe |
| Escopo Técnico | ScopeTab | Perguntas/respostas do levantamento |
| TAP | TAPTab | Termo de Abertura (leitura/edição/PDF) |
| Cronograma | ScheduleTab | Fases e atividades com edição inline |
| Status Report | StatusReportTab | Histórico de reports + criação |
| Plano de Ação | ActionPlanTab | Issues e pendências |
| Encerramento | ClosureTab | Termo de Encerramento (leitura/edição/PDF) |

---

## 5. COMPONENTES DE PROJETO (ABAS)

### 5.1 OverviewTab
- **Exibe:** Dados do projeto, progresso por fase (SchedulePhase), módulos/serviços contratados, equipe Pontotel e Cliente
- **Subcomponentes:** `InfoRow` (linha chave-valor), `ParticipantCard` (card de contato)
- **Dados recebidos via props:** `project`, `phases`

---

### 5.2 ScopeTab
- **Exibe:** Itens de escopo agrupados por seção, com barra de progresso global
- **Funcionalidade:** Clique em qualquer item expande formulário para preencher resposta + observação
- **Salva via:** `base44.entities.ScopeItem.update(item.id, { answer, observations })`
- **Indicadores:** Badge verde "Respondido" / cinza "Pendente" por item; badge X/Y por seção
- **Dados recebidos:** `scopeItems`, `projectId`, `onRefresh`

---

### 5.3 TAPTab (Termo de Abertura do Projeto)
- **Modo view:** Exibe todos os campos do TAP formatados
- **Modo edit:** Formulários editáveis para todos os campos de texto
- **Entregáveis:** Auto-gerados com `deriveDeliverables(project)` com base nos módulos contratados
- **Export PDF:** Abre nova aba com HTML formatado e aciona `window.print()`
- **Salva via:** `ProjectDocument.create()` ou `.update()` com `doc_type: "TAP"`
- **Dados recebidos:** `project`, `scopeItems`, `documents`, `projectId`, `onRefresh`

---

### 5.4 ScheduleTab
- **Exibe:** Fases colapsáveis com tabela de atividades dentro de cada uma
- **Funcionalidade inline:** Edição de datas (início/fim planejado e real) e status por atividade
- **Agrupa:** Atividades por `phase_name`
- **Salva via:** `base44.entities.ScheduleActivity.update(id, data)`
- **Dados recebidos:** `phases`, `activities`, `projectId`, `onRefresh`

---

### 5.5 StatusReportTab
- **Exibe:** `ScheduleSummary` (resumo do cronograma) + lista de reports históricos
- **Criação:** Formulário `NewReportForm` com campos: data, status, progresso, resumo, funcionários, riscos, pendências cliente, pendências internas, próxima agenda
- **Cálculo automático:** `adherence_percent = recording / registered * 100`
- **Salva via:** `base44.entities.StatusReport.create()`
- **Dados recebidos:** `reports`, `projectId`, `projectClientName`, `activities`, `onRefresh`

**Subcomponente `ReportCard`:** Renderiza um report individual com métricas de funcionários, riscos, pendências e próxima agenda.

---

### 5.6 ActionPlanTab
- **Exibe:** Issues separadas em "Em Aberto" e "Encerradas"
- **Criação:** Formulário inline para nova issue (tema, issue, descrição, tipo, impacto, responsável, prazo)
- **Edição inline:** Cada `ActionRow` tem modo de edição com campos de status Pontotel, status cliente, prazos e histórico
- **Indicador de impacto:** cores diferenciadas (vermelho=Alto, laranja=Médio, verde=Baixo)
- **Dados recebidos:** `actions`, `projectId`, `onRefresh`

---

### 5.7 ClosureTab (Termo de Encerramento)
- **Modo view / edit:** Igual ao TAPTab
- **Métricas do cronograma:** Calcula taxa de conclusão das atividades a partir das props
- **Export PDF:** HTML formatado com `buildPDFContent()`
- **Salva via:** `ProjectDocument.create()` ou `.update()` com `doc_type: "Termo de Encerramento"`
- **Campos:** status final, resumo de encerramento, critérios de sucesso atingidos, lições aprendidas, assinaturas
- **Dados recebidos:** `project`, `documents`, `activities`, `projectId`, `onRefresh`

---

## 6. COMPONENTES UTILITÁRIOS

### 6.1 ProjectHeader (`components/project/ProjectHeader`)
Cabeçalho fixo do detalhe do projeto. Exibe:
- Breadcrumb (← Projetos / Nome do projeto)
- Nome, cliente, status badge, fase atual badge
- Progresso geral com `ProgressBar`
- Métricas rápidas: tipo implantação, MRR, funcionários, datas com dias restantes/atrasados

### 6.2 StatusBadge (`components/ui/StatusBadge`)
Badge colorido de status. Usa `statusColor()` de `lib/utils.js` para mapear status → classes Tailwind.

### 6.3 ProgressBar (`components/ui/ProgressBar`)
Barra de progresso com cores automáticas:
- `>= 100%` → verde
- `>= 70%` → azul
- `>= 40%` → amarelo
- `< 40%` → cinza

Suporta props: `value`, `size` (sm/md/lg), `showLabel`, `className`.

### 6.4 StatsCard (`components/dashboard/StatsCard`)
Card do dashboard com: título, valor, subtítulo, ícone e cor temática.

### 6.5 ProjectCard (`components/dashboard/ProjectCard`)
Card de projeto na lista. Link para `/projects/:id`. Exibe: cliente, status, progresso, MRR, funcionários, dias restantes.

### 6.6 AppLayout (`components/layout/AppLayout`)
Wrapper de layout com sidebar fixa à esquerda e `<Outlet>` para conteúdo.

### 6.7 Sidebar (`components/layout/Sidebar`)
Navegação lateral com:
- Logo Pontotel
- Links: Dashboard (`/`), Projetos (`/projects`)
- Botão "+ Novo Projeto" → `/projects/new`
- Destaque de link ativo via `useLocation()`

---

## 7. FUNÇÕES UTILITÁRIAS (`lib/utils.js`)

| Função | Descrição |
|---|---|
| `cn(...inputs)` | Merge de classes Tailwind (clsx + tailwind-merge) |
| `formatDate(dateStr)` | "2026-04-23" → "23/04/2026" |
| `formatCurrency(value)` | Formata em R$ (Intl.NumberFormat pt-BR) |
| `calcDaysLeft(endDate)` | Dias restantes até a data (negativo = atrasado) |
| `statusColor(status)` | Retorna classes Tailwind para cor do badge de status |
| `phaseColor(phase)` | Retorna classes Tailwind para cor da fase |
| `impactColor(impact)` | Retorna classes Tailwind para cor de impacto (Alto/Médio/Baixo) |

---

## 8. DADOS MOCK (`lib/mockData.js`)

Dados de demonstração para 5 projetos fictícios. Ativado quando `id.startsWith("proj-")`.

**Exports:**
- `MOCK_PROJECTS` — 5 projetos com dados realistas
- `MOCK_SCOPE_ITEMS` — Itens de escopo do proj-001
- `MOCK_SCHEDULE_PHASES` — Fases do proj-001
- `MOCK_ACTIVITIES` — Atividades do proj-001
- `MOCK_STATUS_REPORTS` — 1 report do proj-001
- `MOCK_ACTION_PLANS` — 2 issues do proj-001
- `MOCK_MEETINGS` — 6 reuniões do proj-001
- `SCHEDULE_TEMPLATE` — Template de fases/atividades usado na criação de projetos
- `SCOPE_TEMPLATE` — Template de seções/perguntas usado na criação de projetos

---

## 9. INTEGRAÇÃO GOOGLE SHEETS (Usabilidade)

### 9.1 Backend Function: `getClientUsability`
**Arquivo:** `functions/getClientUsability.js`

**O que faz:** Lê uma planilha Google Sheets com dados de usabilidade dos clientes e sincroniza com a entidade `ClientUsability`.

**Configuração:**
- `SPREADSHEET_ID`: `1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8`
- `SHEET_RANGE`: `dados!A1:M1851`
- Conector OAuth: `googlesheets` (compartilhado — conta do builder)
- Permissão: `spreadsheets.readonly`

**Fluxo:**
1. Autentica o usuário
2. Obtém `accessToken` via `base44.asServiceRole.connectors.getConnection('googlesheets')`
3. Busca os valores da planilha via Google Sheets API v4
4. Normaliza os headers (lowercase, sem acentos, underscores)
5. Faz match fuzzy por `client_name` — compara o nome do cliente do projeto com a coluna `nome/empresa` da planilha
6. Se não encontrar, usa a primeira linha como fallback
7. Normaliza os campos para o schema da entidade `ClientUsability`
8. Faz upsert: atualiza se já existe registro para o `project_id`, cria se não existe
9. Retorna `{ data: usabilityData }`

**Como invocar (frontend):**
```js
const res = await base44.functions.invoke("getClientUsability", {
  project_id: projectId,
  client_name: clientName
});
```

### 9.2 Componente: `UsabilitySection`
**Arquivo:** `components/project/UsabilitySection.jsx`

**Status atual:** Componente implementado mas **não integrado** ao `StatusReportTab` (foi removido temporariamente por conflitos de build). Pode ser reintegrado quando necessário.

**O que exibe:**
- 4 MetricCards: Total funcionários, Ativos, Batendo ponto (15d), Último acesso
- Alertas automáticos: último acesso > 7 dias → alerta laranja; adoção < 60% → alerta laranja
- Barras de percentual: Ativos/Total e Batendo Ponto/Ativos
- Detalhes da base: data de criação, regras de cálculo
- Botão "Sincronizar Planilha" → chama `getClientUsability`

**Lógica de carregamento:**
1. Ao montar, tenta carregar dados cached de `ClientUsability.filter({ project_id })`
2. Botão sync chama a function e atualiza o estado

---

## 10. TEMPLATES DE CRIAÇÃO

### 10.1 SCOPE_TEMPLATE
Perguntas padrão criadas automaticamente em todo novo projeto. Cobre 6 seções com 16 perguntas base:
- Informações Gerais (3 perguntas)
- Integração Folha Sankhya (3)
- Parametrização Cálculos e Permissões (4)
- Módulo de Escala (2)
- Módulo Banco de Horas (2)
- Dispositivos de Ponto (2)

### 10.2 SCHEDULE_TEMPLATE
5 fases com atividades padrão:
1. **Abertura de projeto** (4 atividades): alinhamento inicial, escopo técnico, envio TAP, agenda SR
2. **Parametrização** (7 atividades): integração, cadastros, cálculos, custos, escala, BH, dispositivos
3. **Homologação** (4 atividades): validação regras, integração, cliente, ajustes
4. **Rollout** (4 atividades): treinamentos, go-live piloto, expansão
5. **Go-live** (3 atividades): go-live completo, suporte inicial, entrega formal

---

## 11. AUTENTICAÇÃO E ACESSO

- Autenticação gerenciada pela plataforma Base44
- `AuthProvider` e `useAuth()` em `lib/AuthContext.jsx`
- Usuários não registrados → tela `UserNotRegisteredError`
- Roles disponíveis: `admin`, `user` (padrão Base44)
- Acesso a todas as páginas requer autenticação

---

## 12. PONTOS DE ATENÇÃO / PENDÊNCIAS CONHECIDAS

### ✅ Funcionando
- CRUD completo de projetos
- Wizard de criação com templates automáticos
- Todas as 7 abas do projeto
- TAP com export PDF
- Termo de Encerramento com export PDF
- Status Report com criação e histórico
- Plano de Ação com edição inline e histórico
- Cronograma por fases com edição inline de atividades
- Escopo técnico com respostas e boas práticas
- Dashboard com filtros e métricas
- Sincronização de usabilidade via Google Sheets
- Componente `UsabilitySection` implementado

### ⚠️ Pendências / Melhorias a Implementar
1. **UsabilitySection não está visível na UI** — foi desacoplado do `StatusReportTab` por conflito de build. Precisa ser reintegrado (sugestão: como seção dentro do OverviewTab ou StatusReportTab)
2. **Criação de atividades** — o template de fases é criado no wizard, mas as atividades de cada fase não são populadas automaticamente (apenas fases sem atividades)
3. **Tab de Reuniões** — entidade `Meeting` existe mas não tem aba/UI dedicada
4. **Edição de fases** — não é possível editar dados da `SchedulePhase` pela UI (apenas atividades)
5. **Progresso automático** — `progress_percent` do projeto e das fases é editado manualmente, não calculado automaticamente a partir das atividades
6. **Export real para PDF** — atualmente usa `window.print()` que abre diálogo do sistema; poderia usar jsPDF para gerar PDF real
7. **Match Google Sheets** — o fuzzy matching por nome pode falhar se os nomes divergirem muito entre o sistema e a planilha; poderia usar empresa_id como chave primária
8. **Atividades sem ID real** — a verificação `id.startsWith("a")` na `ScheduleTab` é frágil e pode impedir salvar atividades reais

---

## 13. ESTRUTURA DE ARQUIVOS

```
src/
├── App.jsx                          # Router principal
├── index.css                        # Tokens de design (CSS vars)
├── tailwind.config.js               # Config Tailwind
│
├── pages/
│   ├── Dashboard.jsx
│   ├── ProjectList.jsx
│   ├── NewProject.jsx
│   └── ProjectDetail.js
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx
│   │   └── Sidebar.jsx
│   ├── dashboard/
│   │   ├── StatsCard.jsx
│   │   └── ProjectCard.jsx
│   ├── project/
│   │   ├── ProjectHeader.jsx
│   │   ├── UsabilitySection.jsx     # Standalone, não integrado
│   │   └── tabs/
│   │       ├── OverviewTab.jsx
│   │       ├── ScopeTab.jsx
│   │       ├── TAPTab.jsx
│   │       ├── ScheduleTab.jsx
│   │       ├── StatusReportTab.jsx
│   │       ├── ActionPlanTab.jsx
│   │       └── ClosureTab.jsx
│   ├── ui/
│   │   ├── StatusBadge.jsx
│   │   ├── ProgressBar.jsx
│   │   └── [shadcn components]
│   └── UserNotRegisteredError.jsx
│
├── functions/
│   └── getClientUsability.js        # Backend function: sync Google Sheets
│
├── entities/
│   ├── Project.json
│   ├── ScopeItem.json
│   ├── SchedulePhase.json
│   ├── ScheduleActivity.json
│   ├── StatusReport.json
│   ├── ActionPlan.json
│   ├── Meeting.json
│   ├── ProjectDocument.json
│   └── ClientUsability.json
│
├── lib/
│   ├── utils.js                     # Funções utilitárias
│   ├── mockData.js                  # Dados de demonstração + templates
│   ├── AuthContext.jsx
│   ├── query-client.js
│   └── PageNotFound.jsx
│
└── api/
    └── base44Client.js              # SDK Base44 pré-configurado
```

---

*Documento gerado em 23/04/2026*