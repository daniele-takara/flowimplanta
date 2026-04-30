# Flowimplanta — Documentação Técnica Oficial
## v3.0 — Abril 2026

---

## 1. VISÃO GERAL

**Flowimplanta** é um sistema web para gerenciar o portfólio de projetos de implantação do Pontotel.  
Cobre o ciclo completo: desde a importação do deal do CRM Pipedrive até o encerramento com assinatura digital, passando por escopo técnico, cronograma automático, status reports, plano de ação e documentos formais (TAP + Termo de Encerramento).

**Stack tecnológico:**
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui + react-router-dom v6
- Backend/BaaS: Base44 (banco NoSQL, autenticação JWT, backend functions Deno Deploy)
- SDK: `@base44/sdk@0.8.25`
- Integrações: Pipedrive CRM REST v1, Google Sheets OAuth, D4Sign (parcial)

---

## 2. ARQUITETURA TÉCNICA

### 2.1 Camadas

```
USUÁRIO (Browser)
  └── React SPA (Vite) — pages, components, lib/
        └── base44Client.js (SDK)
              ├── base44.entities.*     → CRUD banco NoSQL
              ├── base44.functions.*    → Chamadas a backend functions
              ├── base44.auth.*         → Autenticação
              └── base44.connectors.*  → OAuth connectors

BACKEND (Deno Deploy via Base44)
  └── functions/
        ├── pipedriveWebhook          → Receptor webhooks Pipedrive
        ├── syncScheduleFromPipedrive → Sync manual cronograma
        ├── savePipedriveRules        → Importa regras da planilha Google Sheets
        ├── syncPipedriveData         → Importa dados do deal para o projeto
        ├── applyPipedriveRules       → Motor central de aplicação de regras (diagnóstico)
        ├── validatePipedriveSetup    → Checklist automático de configuração
        ├── getPipedriveDeals         → Lista deals abertos do Pipedrive
        ├── getClientUsability        → Busca KPIs de usabilidade na planilha
        ├── deleteProject             → Exclusão segura com verificação de permissão
        ├── testPipedriveDeal         → Diagnóstico de deal (dev)
        ├── readSheetMapping          → Lê mapeamento da planilha (dev)
        └── readSheetReport           → Lê relatório da planilha (dev)

BANCO DE DADOS (Base44 NoSQL)
  └── 17 Entidades (ver seção 3)

APIs EXTERNAS
  ├── Pipedrive CRM REST v1 (API Token: env API_PIpedrive)
  ├── Google Sheets API v4 (OAuth shared connector: googlesheets)
  └── D4Sign (parcialmente implementado)
```

### 2.2 Fluxo principal de dados

```
Pipedrive Deal
  → NewProject (informa deal_id)
  → Project criado + SchedulePhases geradas automaticamente
  → syncPipedriveData: importa nome, cliente, responsáveis, módulos
  → ScopeTab: analista preenche escopo técnico
  → ScheduleTab: motor computeSchedule() calcula datas a partir das âncoras
  → Webhook Pipedrive (mudança de stage) → actual_start preenchido
  → Webhook Pipedrive (activity done) → actual_end preenchido
  → StatusReport gerado
  → TAP gerado
  → TermoEncerramento + assinatura D4Sign
```

---

## 3. ENTIDADES DO BANCO DE DADOS

### 3.1 Project
Entidade central. Todo projeto de implantação.

| Campo | Tipo | Descrição |
|---|---|---|
| name | string | Nome do projeto |
| client_name | string | Nome da empresa cliente |
| empresa_id | string | ID da empresa na planilha de usabilidade |
| origin | enum | Pontotel / Parceiro / Indicação / Inbound / Outbound |
| mrr | number | MRR do contrato (R$) |
| status | enum | Planejamento / Em andamento / Em risco / Atrasado / Concluído / Cancelado |
| current_phase | enum | Abertura de projeto / Parametrização / Homologação / Rollout / Go-live / Concluído |
| start_date | date | Data de início |
| planned_end_date | date | Prazo original |
| aligned_end_date | date | Prazo realinhado com cliente |
| implantation_type | enum | 5 tipos de implantação |
| contracted_employees | number | Funcionários contratados |
| registered_employees | number | Cadastrados no sistema |
| recording_employees | number | Registrando ponto |
| progress_percent | number | 0–100 (atualizado manualmente) |
| contracted_modules | array[string] | Módulos contratados — controlam visibilidade no Escopo e Cronograma |
| contracted_services | array[string] | Serviços adicionais |
| pontotel_manager_name / contact | string | Gerente Pontotel |
| pontotel_analyst_name / contact | string | Analista Pontotel |
| sponsor_name / contact | string | Patrocinador do cliente |
| project_leader_name / contact | string | Líder do projeto (RH cliente) |
| operation_name / contact | string | Responsável de operação |
| ti_client_name / contact | string | TI do cliente |
| executive_summary | string | Resumo executivo |
| observations | string | Observações adicionais |
| lar21 | string | Campo customizado Pipedrive (campo org) |
| pipedrive_deal_id | number | **ID do deal Pipedrive — chave de vínculo** |
| pipedrive_pipeline_name | string | Nome do pipeline de origem |
| **schedule_anchor_dates** | object | **Datas âncora persistidas no banco** — formato: `{ alinhamento_inicial, go_live_registro_ponto, agenda_fechamento_folha, expansao_registro_ponto_real, agenda_encerramento_projeto }` (YYYY-MM-DD) |

**Nota sobre schedule_anchor_dates:**  
Antes de v3.0, as datas âncora eram salvas apenas em localStorage (perdidas ao trocar de sessão/máquina).  
A partir de v3.0, são persistidas em `Project.schedule_anchor_dates` e carregadas ao abrir o projeto.  
A ScheduleTab faz migração automática única do localStorage para o banco na primeira abertura.

---

### 3.2 SchedulePhase
Fases macro do cronograma. Criadas automaticamente ao criar o projeto.

| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| phase_name | enum | Planejamento / Abertura de projeto / Parametrização / Homologação / Rollout / Go-live / Pós Go-live |
| planned_start / planned_end | date | Datas planejadas |
| actual_start / actual_end | date | Datas reais |
| progress_percent | number | 0–100 |
| status | enum | Não iniciado / Em andamento / Concluído / Atrasado / Bloqueado |
| order | number | Ordenação visual |

---

### 3.3 ScheduleActivity
Atividades detalhadas do cronograma. Criadas via UI ou automaticamente pela integração Pipedrive.

| Campo | Tipo | Descrição |
|---|---|---|
| project_id | string | FK para Project |
| phase_name | string | Nome da fase — **deve bater com SchedulePhase.phase_name e SCHEDULE_TASKS[].phase** |
| activity_name | string | Nome da atividade — **deve bater com SCHEDULE_TASKS[].activity** |
| planned_start / planned_end | date | Datas planejadas |
| actual_start | date | **Início executado** — preenchido por mudança de stage no Pipedrive (faz_inicio=true) |
| actual_end | date | **Fim executado** — preenchido por conclusão de activity no Pipedrive (faz_fim=true) |
| responsible_general | string | Equipes responsáveis |
| responsible_leader | string | Responsável principal |
| status | enum | Não iniciado / Em andamento / Concluído / Atrasado / Bloqueado / Cancelado |
| history_observations | string | Histórico de observações |
| order | number | Ordem dentro da fase |
| template_id | string | ID do ScheduleTemplate de origem |
| responsible_role | enum | gerente_projeto / analista_implantacao / patrocinador / lider_projeto / ti / operacao |
| responsible_general_type | enum | pontotel / cliente / compartilhado |

**Regra crítica:** `actual_start` e `actual_end` **nunca são sobrescritos** se já estiverem preenchidos.

---

### 3.4 PipedriveIntegrationRule
Regras de integração Pipedrive → cronograma. Sincronizadas da planilha Google Sheets via `savePipedriveRules`.

| Campo | Tipo | Descrição |
|---|---|---|
| rule_type | enum | **dados_iniciais** (mapeamento de campos) ou **cronograma** (atualização de datas) |
| sheet_tab | string | Nome da aba da planilha |
| order | number | Ordem de execução |
| raw_data | string | JSON bruto da linha da planilha |
| pipedrive_entidade | string | **deal** ou **activity** |
| pipedrive_campo_key | string | Campo que dispara a regra (ex: `stage_id`, `done`) |
| pipedrive_valor_disparo | string | Valor que deve bater (ex: `"142"`, `"TRUE"`) |
| pipedrive_campo_identificacao | string | Campo identificador da activity (ex: `subject`) |
| pipedrive_valor_identificacao | string | Valor identificador (ex: `"(Escopo técnico) Reunião #Aut"`) |
| pipedrive_campo_data | string | Campo de onde extrair a data (ex: `update_time`, `marked_as_done_time`) |
| base44_fase | string | **Fase alvo no cronograma Base44** — deve bater com SchedulePhase.phase_name |
| base44_atividade | string | **Atividade alvo** — deve bater com ScheduleActivity.activity_name. Use `*` para todas |
| faz_inicio | boolean | Se true: preenche `actual_start` |
| faz_fim | boolean | Se true: preenche `actual_end` e muda status para "Concluído" |
| synced_at | string | ISO datetime da última sincronização |

---

### 3.5 IntegrationLog
Log estruturado de todas as execuções da integração Pipedrive → cronograma.

| Campo | Tipo | Descrição |
|---|---|---|
| integration_type | enum | pipedrive_cronograma |
| source | enum | webhook / manual_sync / diagnostic_test |
| action | string | Ação executada: apply_rules, validate, test |
| status | enum | success / partial_success / ignored / error |
| deal_id | number | ID do deal no Pipedrive |
| activity_id | number | ID da activity no Pipedrive |
| project_id | string | ID do projeto Base44 encontrado |
| project_name | string | Nome do projeto |
| event_type | string | change.deal / change.activity / create.activity / manual_sync |
| rules_loaded | number | Regras carregadas |
| rules_matched | number | Regras que deram match |
| phases_found | number | Fases encontradas no projeto |
| activities_found | number | Atividades no cronograma |
| activities_created | number | Atividades criadas automaticamente |
| activities_updated | number | Atividades atualizadas |
| dates_filled | number | Datas preenchidas |
| dates_ignored | number | Datas ignoradas (já existiam) |
| match_errors | string | JSON array de erros de match fase/atividade |
| errors | string | JSON array de erros gerais |
| request_payload | string | JSON do payload recebido (truncado) |
| response_payload | string | JSON do resultado |
| debug_steps | string | JSON com debug detalhado por regra |
| duration_ms | number | Duração em ms |

---

### 3.6 PipedriveWebhookEvent
Registro de cada evento recebido pelo webhook do Pipedrive. Serve para rastreabilidade e detecção de duplicatas.

| Campo | Tipo | Descrição |
|---|---|---|
| event_id | string | Chave de idempotência |
| event_action | string | change / create / delete |
| event_object | string | deal / activity |
| event_type | string | change.deal / change.activity / create.activity |
| deal_id | number | ID do deal |
| activity_id | number | ID da activity |
| project_id | string | Projeto encontrado |
| project_name | string | Nome do projeto |
| payload_snapshot | string | JSON resumido do payload |
| processed | boolean | Se foi processado com sucesso |
| processed_at | string | ISO datetime do processamento |
| rules_loaded / rules_matched | number | Métricas de regras |
| activities_updated / created | number | Métricas de atividades |
| dates_ignored | number | Datas protegidas |
| result | string | JSON resultado detalhado |
| error | string | Mensagem de erro |
| match_errors | string | Inconsistências de match |
| source | enum | webhook / manual_test |
| duplicate_of | string | ID do evento original (se duplicata) |

---

### 3.7 Demais entidades

| Entidade | Uso |
|---|---|
| ScopeItem | Perguntas e respostas do escopo técnico. `order_number` gera chave `qXXX` no motor. |
| StatusReport | Snapshot periódico do projeto. `macro_schedule` = JSON das fases macro calculadas. |
| ActionPlan | Issues, pendências e melhorias por projeto. |
| Meeting | Reuniões realizadas. |
| TAPVersion | Versões do TAP com snapshots automáticos. |
| TermoEncerramento | Termo de Encerramento com adendos e assinatura D4Sign. |
| ProjectDocument | Documentos legado (TAP/Termo simples). |
| ClientUsability | KPIs de adoção da plataforma, sincronizados da planilha de usabilidade. |
| Adendo | Cláusulas reutilizáveis (Jurídico/Técnico/Comercial) para o Termo. |
| Assinatura | Signatários internos da Pontotel (Coordenadora/Líder de implantação). |
| ScheduleTemplate | Template de configuração de responsáveis por task. |
| PermissionProfile | Perfis RBAC com 18 flags de permissão. |

---

## 4. FLUXO PIPEDRIVE → CRONOGRAMA

### 4.1 Diferença fundamental

| | Início Executado (actual_start) | Fim Executado (actual_end) |
|---|---|---|
| **Origem** | Mudança de etapa no Kanban Pipedrive | Conclusão de activity no Pipedrive |
| **Evento** | `change.deal` com mudança de `stage_id` | `change.activity` com `done=true` |
| **Regra** | `pipedrive_entidade=deal`, `faz_inicio=true` | `pipedrive_entidade=activity`, `faz_fim=true` |
| **Status resultante** | "Em andamento" | "Concluído" |

**Regra de proteção:** Se o campo já estiver preenchido, NUNCA é sobrescrito.

---

### 4.2 Como funciona o webhook

**Endpoint:** `POST /functions/pipedriveWebhook`  
**Origem:** Pipedrive envia automaticamente ao URL configurado

**Fluxo:**
1. Recebe payload `{ event, meta, current, previous }`
2. Extrai `event_action` e `event_object` do payload
3. Gera chave de idempotência — evita reprocessamento duplicado
4. Verifica duplicata no `PipedriveWebhookEvent`
5. Cria registro inicial no `PipedriveWebhookEvent`
6. Carrega regras do banco (`PipedriveIntegrationRule`) — **usa banco, não lê planilha**
7. Localiza projeto pelo `pipedrive_deal_id`
8. Executa `applyRulesToSchedule()` — lógica idêntica ao sync manual
9. Atualiza `PipedriveWebhookEvent` com resultado
10. Retorna `{ ok, updated, created, match_errors }`

**3 webhooks devem ser configurados no Pipedrive:**
- `change.deal` → mudanças de stage_id, campos customizados
- `change.activity` → activity concluída
- `create.activity` → nova activity

---

### 4.3 Como funciona o sync manual (syncScheduleFromPipedrive)

**Invocação:** `base44.functions.invoke("syncScheduleFromPipedrive", { project_id })`

**Fluxo:**
1. Autentica usuário
2. Busca projeto pelo `project_id`
3. Carrega regras `cronograma` do banco
4. Busca deal atual no Pipedrive (`/v1/deals/:id`)
5. Busca TODAS as activities do deal, paginado (`/v1/deals/:id/activities`)
6. Carrega `ScheduleActivity` e `SchedulePhase` do projeto
7. Executa a mesma lógica de aplicação de regras
8. Grava `IntegrationLog`
9. Retorna resultado detalhado

---

### 4.4 Lógica de aplicação de regras

Para cada regra de cronograma:

**Regra tipo DEAL:**
```
if rule.pipedrive_entidade == "deal" && rule.pipedrive_campo_key == "stage_id":
  if String(deal.stage_id) == String(rule.pipedrive_valor_disparo):
    data = deal[rule.pipedrive_campo_data] || deal.update_time
    for each activity in phase:
      if faz_inicio and !actual_start: set actual_start = data
      if faz_fim and !actual_end: set actual_end = data, status = "Concluído"
```

**Regra tipo ACTIVITY:**
```
if rule.pipedrive_entidade == "activity":
  for each done_activity in deal_activities:
    if activity.done == true:
      if campo_identificacao set: skip if activity[campo] != valor_identificacao
      data = marked_as_done_time || update_time || due_date || today
      for each schedule_activity in phase:
        if faz_fim and !actual_end: set actual_end = data, status = "Concluído"
        if faz_inicio and !actual_start: set actual_start = data
```

**Criação automática:**  
Se a fase existe (`SchedulePhase`) mas não há `ScheduleActivity` correspondente e a regra aponta para atividade específica (`base44_atividade != "*"`), a atividade é criada automaticamente.

**Normalização de match:**
- `trim()` + `toLowerCase()` + `normalize("NFD")` + remoção de diacríticos
- `stage_id` sempre comparado como string

---

## 5. DATAS ÂNCORA

### 5.1 O que são
5 datas que o usuário define manualmente. A partir delas, o motor `computeSchedule()` calcula automaticamente todas as outras ~76 datas do cronograma.

| ID da âncora | Descrição |
|---|---|
| `alinhamento_inicial` | Data do kick-off — âncora principal |
| `go_live_registro_ponto` | Go-live operacional de registro de ponto |
| `agenda_fechamento_folha` | Início do ciclo de fechamento de folha |
| `expansao_registro_ponto_real` | Expansão para 100% da base |
| `agenda_encerramento_projeto` | Encerramento formal do projeto |

### 5.2 Persistência (v3.0+)
**Campo:** `Project.schedule_anchor_dates` — objeto `{ anchorId: "YYYY-MM-DD" }`

**Fluxo ao editar âncora:**
1. Usuário altera data no painel de âncoras da ScheduleTab
2. `handleSaveOverride(taskId, { plannedStart: date })` é chamado
3. Estado local `manualOverrides` é atualizado imediatamente (UI reage)
4. `base44.entities.Project.update(projectId, { schedule_anchor_dates })` persiste no banco

**Fluxo ao abrir o projeto:**
1. `ScheduleTab` recebe `project` via props
2. Se `project.schedule_anchor_dates` tem dados → carrega direto do banco
3. Se banco vazio e localStorage tem dados → migra localStorage → banco (uma única vez) e remove localStorage
4. Motor `computeSchedule()` recalcula com as datas carregadas

**Garantia:** qualquer usuário que abrir o mesmo projeto verá as mesmas datas.

---

## 6. MOTOR DE CRONOGRAMA

### 6.1 computeSchedule (lib/scheduleEngine.js)
Recebe: `tasks, anchors, answersMap, project`  
Retorna: `{ dates: { taskId: { plannedStart, plannedEnd } }, visible: Set<taskId> }`

**Tipos de data:**
- `anchor` — editável pelo usuário, propaga para dependentes
- `calculated` — calculada por fórmula (workday, sameDay) — somente leitura
- `manual_override` — editável, não propaga

**Fórmulas suportadas:**
- `workday(ref.field, N)` — N dias úteis após a data de referência
- `sameDay(ref)` — mesma data
- `taskId.plannedStart` / `taskId.plannedEnd` — referência direta

**Feriados:** BR 2024–2026 (hardcoded em `BR_HOLIDAYS_2024_2026`)

### 6.2 evaluateCondition
Filtra quais tasks são visíveis com base no escopo técnico (`answersMap`) e nos módulos contratados (`project.contracted_modules`).

### 6.3 scheduleTasks.js
Define as 76 tasks organizadas em 9 fases. Exporta:
- `SCHEDULE_TASKS` — array de tasks
- `PHASE_ORDER` — ordem das fases
- `ANCHOR_IDS` — IDs das 5 âncoras

---

## 7. RBAC (Controle de Acesso)

### 7.1 Fluxo
1. `AuthContext` carrega `base44.auth.me()`
2. Se `user.permission_profile_id` → busca `PermissionProfile` e injeta em `user._resolvedProfile`
3. `usePermissions()` resolve: perfil vinculado > role=admin (tudo true) > sem perfil (acesso zero)

### 7.2 18 flags de permissão
`projetos_ver`, `projetos_criar`, `projetos_editar`, `projetos_excluir`, `dados_iniciais_ver`, `dados_iniciais_editar`, `escopo_ver`, `escopo_editar`, `cronograma_ver`, `cronograma_editar`, `tap_ver`, `tap_editar`, `status_report_ver`, `status_report_editar`, `termo_ver`, `termo_pdf`, `parametrizacoes_acessar`, `parametrizacoes_editar`

### 7.3 Perfis padrão
| Perfil | Descrição |
|---|---|
| Admin | Acesso total (equivale a role=admin) |
| Gestor de Projetos | Cria e gerencia projetos, TAP, Status Report |
| Implantação | Escopo, cronograma, status report — sem criar projetos |
| Viewer | Somente leitura |

---

## 8. FUNÇÕES BACKEND

### 8.1 pipedriveWebhook
- **Arquivo:** `functions/pipedriveWebhook.js`
- **Objetivo:** Receber eventos do Pipedrive e atualizar o cronograma em tempo real
- **Parâmetros:** Body = payload Pipedrive `{ event, meta, current, previous }`
- **Entidades usadas:** PipedriveWebhookEvent, PipedriveIntegrationRule, Project, ScheduleActivity, SchedulePhase
- **Retorno:** `{ ok, event_type, deal_id, project_id, activities_updated, activities_created, match_errors }`
- **Logs gerados:** Console logs com prefixo `[pipedriveWebhook]`
- **Erros tratados:** Payload inválido (400), payload muito grande (400), duplicatas (200 com flag), sem deal_id (200 com aviso), sem regras (200 com aviso), project não encontrado (200 com aviso), rate limit Pipedrive (500)
- **Quem chama:** Pipedrive (webhook externo)
- **Fonte de regras:** PipedriveIntegrationRule (banco) — **nunca lê Google Sheets**

### 8.2 syncScheduleFromPipedrive
- **Arquivo:** `functions/syncScheduleFromPipedrive.js`
- **Objetivo:** Sync manual do cronograma — mesma lógica do webhook
- **Parâmetros:** `{ project_id }`
- **Entidades usadas:** Project, PipedriveIntegrationRule, ScheduleActivity, SchedulePhase, IntegrationLog
- **Retorno:** `{ ok, deal_id, updated, created, activities[], activities_created[], match_errors[], available_phases[] }`
- **Logs gerados:** Console logs com prefixo `[syncSchedule]`
- **Erros tratados:** project não encontrado (404), sem deal_id (400), sem regras (400), rate limit 429
- **Quem chama:** ScheduleTab (botão "Atualizar Cronograma"), TabIntegracaoPipedrive (teste E2E), MonitorIntegracoes

### 8.3 savePipedriveRules
- **Arquivo:** `functions/savePipedriveRules.js`
- **Objetivo:** Importar/atualizar regras da planilha Google Sheets para o banco
- **Parâmetros:** `{}`
- **Entidades usadas:** PipedriveIntegrationRule
- **Retorno:** `{ ok, dados_iniciais.count, cronograma.count, deleted }`
- **Logs gerados:** Nenhum (exceto erros)
- **Erros tratados:** Google Sheets offline → exceção propagada
- **Quem chama:** TabIntegracaoPipedrive (botão "Atualizar regras da planilha")
- **Atenção:** **Operação DESTRUTIVA** — apaga TODAS as regras e recria do zero. Sem rollback.

### 8.4 syncPipedriveData
- **Arquivo:** `functions/syncPipedriveData.js`
- **Objetivo:** Importar dados do deal Pipedrive para o projeto Base44
- **Parâmetros:** `{ project_id, deal_id }`
- **Entidades usadas:** Project
- **Retorno:** `{ success, updated_fields[], project }`
- **Erros tratados:** Rate limit 429 (retry 3x), 401/403 Pipedrive, project não encontrado
- **Quem chama:** OverviewTab (botão "Atualizar dados do Pipedrive")
- **Atenção:** Campos customizados com chaves hash fixas hardcoded

### 8.5 applyPipedriveRules
- **Arquivo:** `functions/applyPipedriveRules.js`
- **Objetivo:** Motor central de diagnóstico — aplica regras com debug completo por regra e suporte a dry_run
- **Parâmetros:** `{ project_id, source?, dry_run?, event_type?, deal_id?, activity_id? }`
- **Entidades usadas:** Project, PipedriveIntegrationRule, ScheduleActivity, SchedulePhase, IntegrationLog
- **Retorno:** `{ ok, rules_loaded, rules_matched, activities_updated, activities_created, rule_debug[], ignored_dates[], match_errors[], errors[] }`
- **Quem chama:** MonitorIntegracoes (painel DealTestPanel), WeebhookConfig (teste manual)

### 8.6 validatePipedriveSetup
- **Arquivo:** `functions/validatePipedriveSetup.js`
- **Objetivo:** Checklist automático de configuração da integração
- **Parâmetros:** `{ deal_id? }`
- **Retorno:** `{ checks[], summary: { total, ok, warning, error }, webhook_url }`
- **Quem chama:** MonitorIntegracoes (painel ValidationChecklist)

### 8.7 getPipedriveDeals
- **Arquivo:** `functions/getPipedriveDeals.js`
- **Objetivo:** Listar deals abertos dos pipelines 16 e 10
- **Parâmetros:** `{}`
- **Retorno:** `{ deals[], total }`
- **Quem chama:** PipedriveModal em ProjectList

### 8.8 deleteProject
- **Arquivo:** `functions/deleteProject.js`
- **Objetivo:** Exclusão segura com verificação de permissão no backend
- **Parâmetros:** `{ project_id }`
- **Retorno:** `{ success, deleted_project_id }`
- **Verificação:** role=admin OR projetos_excluir=true no perfil
- **Atenção:** NÃO exclui entidades filhas (ScheduleActivity, ScopeItem, etc. ficam órfãs)

### 8.9 getClientUsability
- **Arquivo:** `functions/getClientUsability.js`
- **Objetivo:** Buscar KPIs de adoção na planilha Google Sheets de usabilidade
- **Parâmetros:** `{ project_id, client_name }`
- **Entidades usadas:** ClientUsability
- **Retorno:** `{ data: UsabilityData }`
- **Planilha:** `1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8`

### 8.10 testPipedriveDeal / readSheetMapping / readSheetReport
- **Objetivo:** Diagnóstico e debug — sem controle de acesso
- **Atenção:** Qualquer usuário autenticado pode chamar. Recomendado: adicionar `user.role === 'admin'`

---

## 9. MONITOR DE INTEGRAÇÕES

**Rota:** `/monitor-integracoes`  
**Componente:** `pages/MonitorIntegracoes`

**Funcionalidades:**
- Cards de resumo: total, sucesso, erro, parcial, ignorados
- Tabela de `IntegrationLog` com filtros por status, source, event_type, deal_id
- Detalhe por log: debug por regra, comparações, payloads, botão reprocessar
- **Aba Validação:** Checklist automático (`validatePipedriveSetup`)
- **Aba Testar por Deal:** Aplica regras com dry_run ou execução real (`applyPipedriveRules`)
- **Aba Simular Webhook:** Simula payload manual
- Sem paginação — exibe todos os logs

**Acesso:** Sidebar → "Monitor Integrações" | WebhookConfig → link | TabIntegracaoPipedrive → botão

---

## 10. PÁGINAS E COMPONENTES

### 10.1 Rotas
| Rota | Componente | Proteção |
|---|---|---|
| `/` | Dashboard | Autenticado |
| `/projects` | ProjectList | Autenticado |
| `/projects/new` | NewProject | projetos_criar |
| `/projects/:id` | ProjectDetail | Autenticado |
| `/parametrizacoes` | Parametrizacoes | parametrizacoes_acessar |
| `/users-permissions` | UsersPermissions | parametrizacoes_acessar |
| `/webhook-config` | WebhookConfig | Autenticado |
| `/monitor-integracoes` | MonitorIntegracoes | Autenticado |
| `/diagnostico-pipedrive` | DiagnosticoPipedrive | Autenticado |
| `/documentacao` | Documentacao | Autenticado |
| `/fluxo` | FluxoProjeto | canAccessFluxo |
| `/rbac-report` | RBACReport | parametrizacoes_acessar |

### 10.2 Abas do ProjectDetail
| Aba | Componente | Dados usados |
|---|---|---|
| Resumo | OverviewTab | Project, SchedulePhase |
| Escopo Técnico | ScopeTab | ScopeItem |
| TAP | TAPTab | TAPVersion, Project, ScopeItem |
| Cronograma | **ScheduleTab** | ScheduleActivity, Project (schedule_anchor_dates) |
| Status Report | StatusReportTab | StatusReport |
| Plano de Ação | ActionPlanTab | ActionPlan |
| Encerramento | TermoEncerramentoTab / ClosureTab | TermoEncerramento, Adendo, Assinatura |

---

## 11. CONSISTÊNCIA DE NOMES (REGRA CRÍTICA)

Para que o sistema funcione corretamente, os nomes devem ser **idênticos** entre:

| Origem | Campo | Destino |
|---|---|---|
| `SCHEDULE_TASKS[].phase` | = | `ScheduleActivity.phase_name` |
| `SCHEDULE_TASKS[].phase` | = | `SchedulePhase.phase_name` |
| `SCHEDULE_TASKS[].phase` | = | `PipedriveIntegrationRule.base44_fase` |
| `SCHEDULE_TASKS[].activity` | = | `ScheduleActivity.activity_name` |
| `SCHEDULE_TASKS[].activity` | = | `PipedriveIntegrationRule.base44_atividade` |

**Normalização aplicada:** trim + lowercase + sem acentos + sem espaços duplicados

---

## 12. INTEGRAÇÕES EXTERNAS

### 12.1 Pipedrive CRM (REST API v1)
- **Auth:** API Token via env `API_PIpedrive`
- **Endpoints usados:** `GET /v1/deals/:id`, `GET /v1/deals/:id/activities`, `GET /v1/organizations/:id`, `GET /v1/dealFields`, `GET /v1/pipelines/:id/deals`
- **Campos customizados hardcoded:** `30e71cb...` (gerente), `88d64f...` (aligned_end_date), `64fcc8...` (canal/org), `a5301f...` (lar21), `a7cf02...` (módulos)
- **Pipelines alvo:** IDs 16 e 10

### 12.2 Google Sheets (OAuth Shared Connector)
- **Auth:** `base44.asServiceRole.connectors.getConnection('googlesheets')` → `{ accessToken }`
- **Planilha de regras:** `1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4` (2 abas: Dados Iniciais + Cronograma)
- **Planilha de usabilidade:** `1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8`

### 12.3 D4Sign (Assinatura Digital)
- **Status:** Parcialmente implementado — campos existem em `TermoEncerramento` mas sem função backend

---

## 13. TESTES REALIZADOS (Abril 2026)

| # | Teste | Resultado |
|---|---|---|
| 1 | `validatePipedriveSetup` | ✅ OK — retornou 5 checks OK, 1 warning (sem logs de webhook ainda) |
| 2 | `applyPipedriveRules` com ID inválido | ✅ Retornou 500 com mensagem clara |
| 3 | `applyPipedriveRules` dry_run com projeto real | ✅ Regra 1 (activity): deu match, data ignorada pois já existia. Regra 2 (deal stage=16): sem match pois stage atual é 142 |
| 4 | `validatePipedriveSetup` com deal_id=12960 | ✅ Identificou que stage_id 142 não tem regra configurada |
| 5 | Persistência de âncoras | ✅ Corrigido — agora salvo em `Project.schedule_anchor_dates` |
| 6 | Webhook vs sync manual | ✅ Ambos usam banco (não planilha) |

---

## 14. PENDÊNCIAS TÉCNICAS

### Críticas
1. **deleteProject não exclui entidades filhas** — ScheduleActivity, ScopeItem, StatusReport etc. ficam órfãs. Implementar exclusão em cascata.
2. **savePipedriveRules é destrutiva sem rollback** — se Google Sheets cair durante criação, banco fica sem regras. Solução: criar novas primeiro, depois apagar antigas.
3. **Campos customizados Pipedrive hardcoded** — se campos forem recriados no Pipedrive, sync quebra silenciosamente. Solução: criar entidade de configuração.

### Médias
4. **D4Sign sem função backend** — campos de assinatura existem mas sem integração real.
5. **Rate limit Pipedrive sem controle global** — múltiplas chamadas simultâneas podem atingir limite.
6. **Match Google Sheets por nome fuzzy** — pode falhar com homônimos. Preferível usar empresa_id.

### Baixas
7. **MOCK_PROJECTS em mockData.js** — dados fictícios ainda no código (proj-001 a proj-005). Remover ou mover para fixtures.
8. **testPipedriveDeal / readSheetReport sem controle de acesso** — qualquer usuário autenticado pode chamar.
9. **Reuniões (Meeting)** — entidade existe mas sem aba/UI dedicada.
10. **ScheduleTab 800+ linhas** — candidato a refatoração em subcomponentes.

---

## 15. ESTRUTURA DE ARQUIVOS

```
src/
├── App.jsx                                   # Router principal + AuthProvider
├── index.css                                 # Tokens de design (CSS variables)
├── tailwind.config.js                        # Config Tailwind
├── main.jsx                                  # Entry point React
│
├── pages/
│   ├── Dashboard.jsx
│   ├── ProjectList.jsx
│   ├── ProjectDetail.jsx
│   ├── NewProject.jsx
│   ├── Parametrizacoes.jsx
│   ├── WebhookConfig.jsx                     # Config webhook + logs PipedriveWebhookEvent
│   ├── MonitorIntegracoes.jsx                # Monitor IntegrationLog (NOVO v3.0)
│   ├── DiagnosticoPipedrive.jsx
│   ├── Documentacao.jsx
│   ├── FluxoProjeto.jsx
│   ├── UsersPermissions.jsx
│   └── RBACReport.jsx
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx
│   │   ├── Sidebar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── project/
│   │   ├── ProjectHeader.jsx
│   │   ├── UsabilitySection.jsx
│   │   ├── DeleteProjectDialog.jsx
│   │   ├── EditProjectModal.jsx
│   │   ├── PipedriveModal.jsx
│   │   └── tabs/
│   │       ├── OverviewTab.jsx
│   │       ├── ScopeTab.jsx
│   │       ├── TAPTab.jsx
│   │       ├── ScheduleTab.jsx               # Motor cronograma + persistência âncoras (v3.0)
│   │       ├── StatusReportTab.jsx
│   │       ├── ActionPlanTab.jsx
│   │       ├── ClosureTab.jsx
│   │       └── TermoEncerramentoTab.jsx
│   ├── monitor/
│   │   ├── IntegrationLogRow.jsx
│   │   ├── DealTestPanel.jsx
│   │   ├── ValidationChecklist.jsx
│   │   └── WebhookSimulatePanel.jsx
│   ├── parametrizacoes/
│   │   ├── TabIntegracaoPipedrive.jsx
│   │   ├── TabPerfis.jsx
│   │   ├── TabUsuarios.jsx
│   │   └── TabCronogramaTemplate.jsx
│   └── ui/ (shadcn components)
│
├── functions/
│   ├── pipedriveWebhook.js
│   ├── syncScheduleFromPipedrive.js
│   ├── savePipedriveRules.js
│   ├── syncPipedriveData.js
│   ├── applyPipedriveRules.js
│   ├── validatePipedriveSetup.js
│   ├── getPipedriveDeals.js
│   ├── getClientUsability.js
│   ├── deleteProject.js
│   ├── testPipedriveDeal.js
│   ├── readSheetMapping.js
│   └── readSheetReport.js
│
├── entities/
│   ├── Project.json                          # schedule_anchor_dates adicionado (v3.0)
│   ├── SchedulePhase.json
│   ├── ScheduleActivity.json
│   ├── PipedriveIntegrationRule.json
│   ├── IntegrationLog.json
│   ├── PipedriveWebhookEvent.json
│   ├── ScopeItem.json
│   ├── StatusReport.json
│   ├── ActionPlan.json
│   ├── Meeting.json
│   ├── TAPVersion.json
│   ├── TermoEncerramento.json
│   ├── ProjectDocument.json
│   ├── ClientUsability.json
│   ├── Adendo.json
│   ├── Assinatura.json
│   ├── ScheduleTemplate.json
│   └── PermissionProfile.json
│
├── lib/
│   ├── scheduleEngine.js                     # Motor de datas (workday, computeSchedule)
│   ├── scheduleTasks.js                      # 76 tasks, PHASE_ORDER, ANCHOR_IDS
│   ├── scheduleReportEngine.js               # computeMacroSchedule para StatusReport/TAP
│   ├── scopeTemplate.js                      # Template de questões do escopo
│   ├── tapTemplate.js                        # buildEntregas, buildModulosStatus para TAP
│   ├── resolveResponsibleRole.js             # Resolve papel → nome via dados do projeto
│   ├── permissions.js                        # resolvePermissions()
│   ├── usePermissions.js                     # Hook de permissões
│   ├── AuthContext.jsx
│   ├── mockData.js                           # Dados de demonstração (proj-001 a 005)
│   ├── utils.js
│   ├── query-client.js
│   └── PageNotFound.jsx
│
└── api/
    └── base44Client.js                       # SDK Base44 pré-inicializado
```

---

*Documentação atualizada em 30/04/2026 — v3.0*