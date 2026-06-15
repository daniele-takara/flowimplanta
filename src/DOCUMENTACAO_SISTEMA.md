# Flowimplanta — Documentação Técnica v5.0
**Última atualização:** 2026-05-02  
**Status:** Validado (Pipedrive como Fonte de Verdade)

---

## 1. ARQUITETURA GERAL

```
Pipedrive CRM ──webhook──► pipedriveWebhook (Deno)
                                  │
Google Sheets ──OAuth──────► savePipedriveRules (Deno)
                                  │
                         PipedriveIntegrationRule (banco)
                                  │
                     ┌────────────┴────────────┐
              applyPipedriveRules         syncScheduleFromPipedrive
              (diagnóstico/dry-run)        (manual via frontend)
                     │                          │
                     └────────────┬─────────────┘
                                  │
                         ScheduleActivity (banco)
                                  │
                           ScheduleTab (React)
                          computeSchedule (motor)
```

**Stack:**
- Frontend: React 18 + Vite + Tailwind + shadcn/ui
- Backend: Base44 BaaS + Deno Deploy
- Banco: Base44 NoSQL (17 entidades)
- Integrações: Pipedrive REST v1, Google Sheets OAuth v4

---

## 2. ENTIDADES (17 total)

### Project (central)
| Campo | Tipo | Uso |
|-------|------|-----|
| `pipedrive_deal_id` | number | Vínculo Pipedrive — chave de matching do webhook |
| `status` | enum | Planejamento → Cancelado |
| `current_phase` | enum | Fase atual do projeto |
| `contracted_modules` | array | Controla visibilidade no Escopo e Cronograma |
| `contracted_services` | array | Serviços adicionais |
| `schedule_anchor_dates` | object | **Datas âncora persistidas no banco** (5 chaves: alinhamento_inicial, go_live_registro_ponto, agenda_fechamento_folha, expansao_registro_ponto_real, agenda_encerramento_projeto) |
| `pontotel_manager_name/contact` | string | Gerente de Projeto |
| `pontotel_analyst_name/contact` | string | Analista de Implantação |
| `sponsor_name/contact` | string | Patrocinador do cliente |
| `project_leader_name/contact` | string | Líder de projeto do cliente |

### SchedulePhase
Fases macro do cronograma. Criadas automaticamente ao criar o projeto.

**Enum phase_name (IDÊNTICO ao PHASE_ORDER do frontend):**
- Abertura de projeto
- Integração
- Cadastros
- Parametrização
- Treinamento e Validações
- Operação Assistida
- Fechamento de Folha
- Expansão
- Encerramento

> ⚠️ CRÍTICO: Os nomes DEVEM ser idênticos entre SchedulePhase.phase_name, PHASE_ORDER (scheduleTasks.js), SCHEDULE_TEMPLATE (mockData.js) e regras PipedriveIntegrationRule.base44_fase

### ScheduleActivity
Atividades detalhadas do cronograma. Matching por `activity_name` ↔ `SCHEDULE_TASKS[].activity`.

| Campo | Tipo | Preenchimento |
|-------|------|---------------|
| `actual_start` | date | Quando stage_id muda no Pipedrive (faz_inicio=true) |
| `actual_end` | date | Quando activity é concluída no Pipedrive (faz_fim=true) |
| `status` | enum | Auto-derivado das datas executadas |

**Pipedrive é a FONTE DE VERDADE para datas de execução.**

| Origem da atualização | Comportamento |
|-----------------------|--------------|
| Integração Pipedrive (webhook, sync, diagnóstico) | **SEMPRE sobrescreve** `actual_start` e `actual_end` |
| Edição manual (usuário via UI) | Preserva valor existente — não sobrescreve |

**Regra de unicidade de projeto:**
- Cada `pipedrive_deal_id` deve estar associado a **no máximo 1 projeto**.
- Se existirem duplicatas, o sistema usa o projeto mais recente (`created_date` mais alto) e loga um alerta `⚠️ DUPLICADO`.
- Duplicatas devem ser resolvidas manualmente — remova projetos obsoletos ou corrija o `pipedrive_deal_id`.

**Definição de "campo vazio" (usada apenas para criação de novas atividades):**
```js
function isDateEmpty(val) {
  if (val == null) return true;          // null / undefined
  const s = String(val).trim();
  return s === "" || s === "—" || s === "–"; // string vazia ou travessão
}
```
`isDateEmpty()` é usada somente ao decidir se uma nova `ScheduleActivity` precisa ser criada. Para atividades existentes, o Pipedrive sempre sobrescreve.

### PipedriveIntegrationRule
Regras importadas da planilha Google Sheets. Dois tipos:
- `dados_iniciais`: mapeamento de campos do deal → Project
- `cronograma`: stage_id ou activity done → ScheduleActivity

**Campos críticos para cronograma:**
| Campo | Descrição |
|-------|-----------|
| `pipedrive_entidade` | "deal" ou "activity" |
| `pipedrive_campo_key` | Para deal: "stage_id"; para activity: "done" |
| `pipedrive_valor_disparo` | stage_id específico ou "TRUE" |
| `pipedrive_campo_identificacao` | Campo de identificação da activity (ex: "subject") |
| `pipedrive_valor_identificacao` | Valor esperado (ex: "(Escopo técnico) Reunião...") |
| `pipedrive_campo_data` | Campo de data do deal/activity a usar (ex: "update_time") |
| `base44_fase` | Nome exato da fase no cronograma |
| `base44_atividade` | Nome da atividade ou "*" (todas da fase) |
| `faz_inicio` | Se preenche actual_start |
| `faz_fim` | Se preenche actual_end + status=Concluído |

### IntegrationLog
Log de TODAS as execuções da integração Pipedrive → Cronograma.

| Campo | Descrição |
|-------|-----------|
| `source` | "webhook", "manual_sync", "diagnostic_test" |
| `status` | "success", "partial_success", "ignored", "error" |
| `event_type` | Chave de idempotência: "change:deal:12960:0:..." |
| `rules_loaded/matched` | Diagnóstico de regras |
| `activities_updated/created` | Resultado da execução |
| `match_errors` | JSON de erros de matching fase/atividade |
| `debug_steps` | JSON com steps detalhados |

### PipedriveWebhookEvent (legado)
Mantida por compatibilidade. **Novos logs vão para IntegrationLog.**

---

## 3. FUNÇÕES BACKEND

### pipedriveWebhook
- **Arquivo:** functions/pipedriveWebhook
- **Chamada:** Webhook externo do Pipedrive (POST público)
- **Auth:** Nenhuma (público), mas verifica idempotência via IntegrationLog
- **Entrada:** Payload Pipedrive `{ event, meta, current, previous }`
- **Lógica:**
  1. Parse evento → extrai deal_id, activity_id
  2. Deduplicação por idempotencyKey em IntegrationLog
  3. Localiza Project por pipedrive_deal_id
  4. Carrega PipedriveIntegrationRule (cronograma) do banco
  5. Busca deal atualizado no Pipedrive API
  6. Aplica regras → atualiza ScheduleActivity
  7. Grava IntegrationLog
- **Regras:** deal.stage_id → actual_start; activity.done → actual_end
- **Saída:** `{ ok, event_type, deal_id, rules_matched, activities_updated }`

### syncScheduleFromPipedrive
- **Arquivo:** functions/syncScheduleFromPipedrive
- **Chamada:** Frontend (ScheduleTab) via base44.functions.invoke
- **Auth:** Usuário logado (base44.auth.me())
- **Entrada:** `{ project_id }`
- **Lógica:** Idêntica ao pipedriveWebhook — busca deal, aplica regras, grava IntegrationLog
- **Saída:** `{ ok, deal_id, deal_stage_id, rules_total, rules_applied, updated, created, match_errors, available_phases }`

### applyPipedriveRules
- **Arquivo:** functions/applyPipedriveRules
- **Chamada:** Monitor de Integrações (DealTestPanel), diagnóstico
- **Auth:** Aceita com ou sem usuário (todas ops via asServiceRole)
- **Entrada:** `{ project_id, deal_id?, source, event_type, dry_run? }`
- **Diferencial:** Suporta `dry_run=true` para simulação sem gravação
- **Saída:** `{ ok, rules_loaded, rules_matched, updated[], created[], match_errors[], rule_debug[], deal_stage_id, available_phases }`

### savePipedriveRules
- **Arquivo:** functions/savePipedriveRules
- **Chamada:** TabIntegracaoPipedrive (botão "Recriar todas as regras")
- **Auth:** Usuário logado
- **Entrada:** `{}`
- **Lógica:** Lê planilha Google Sheets (2 abas: dados_iniciais, cronograma) → DELETE ALL PipedriveIntegrationRule → bulkCreate novo conjunto
- ⚠️ **ATENÇÃO:** Operação destrutiva sem rollback. Use apenas quando precisar resetar completamente as regras.

### syncPipedriveData *(atualizado — v6.0)*

**Campos mapeados (Pipedrive → Base44):**

| Campo Pipedrive | Origem | Campo Base44 | Notas |
|---|---|---|---|
| `deal.title` | Deal | `project.name` | — |
| `org.name` | Organização | `project.client_name` | — |
| `deal.add_time` | Deal | `project.start_date` | — |
| `deal.expected_close_date` | Deal | `project.planned_end_date` | — |
| `deal["88d64f..."]` | Deal | `project.aligned_end_date` | Campo customizado |
| `deal.user_id.name` | Deal | `project.pontotel_analyst_name` | Owner do deal |
| `deal["30e71c..."]` | Deal | `project.pontotel_manager_name` | Campo enum → label |
| `org["64fcc8..."]` (Canal) | Organização | `project.origin` | Normalizado via `normalizeOrigin()` |
| `org["a5301f..."]` (Lar21) | Organização | `project.lar21` | — |
| `org["a7cf02..."]` (Módulos) | Organização | `project.contracted_modules` | **Normalizado via `normalizeModule()`** |
| `deal.value` | Deal | `project.mrr` | Valor mensal R$ |
| `org["e7f28a..."]` | Organização | `project.contracted_employees` | Funcionários contratados |

#### Normalização de Módulos — com Validação e Alertas de Divergência

O campo "Módulos" na Organização do Pipedrive é **varchar (texto livre)**, não enum. Os valores variam por cliente. O sistema normaliza automaticamente, mas **sinaliza qualquer divergência** ao invés de mascarar silenciosamente.

##### Módulos Oficiais do Sistema

Estes são os únicos valores aceitos como `contracted_modules` no Base44:

| # | Nome oficial (exato) |
|---|---|
| 1 | `Registro de Ponto` |
| 2 | `Redução de Riscos no Registro` |
| 3 | `Cálculos e Tratamento` |
| 4 | `Gestão de Ponto Participativa` |
| 5 | `Controle de Custos` |
| 6 | `Gestão de Férias e Ausências` |
| 7 | `Timesheet` |

##### Comportamento de Normalização por Caso

| Situação | Comportamento | Alerta gerado |
|---|---|---|
| Nome exato igual ao oficial | Importa normalmente | Nenhum |
| Nome é alias conhecido (ex: "Cálculos e Fechamento") | Normaliza para o oficial + importa | ⚠️ `warning` — cadastro fora do padrão |
| Nome desconhecido (não mapeado) | **NÃO importa** — preserva valor bruto no log | 🔴 `error` — requer revisão manual |

##### Aliases Conhecidos (valores fora do padrão → canônico)

| Valor no Pipedrive (fora do padrão) | Canônico Base44 |
|---|---|
| "Cálculos e Fechamento", "Banco de Horas", "Tratamento de Ponto" | `Cálculos e Tratamento` |
| "Ponto Eletrônico", "Registro Ponto" | `Registro de Ponto` |
| "Redução de Riscos", "Redução Riscos Registro" | `Redução de Riscos no Registro` |
| "Gestão Participativa", "Ponto Participativo" | `Gestão de Ponto Participativa` |
| "Controle Custos", "Custos" | `Controle de Custos` |
| "Gestão de Férias", "Férias e Ausências", "Férias" | `Gestão de Férias e Ausências` |

##### Retorno do `syncPipedriveData` — campos de diagnóstico

```json
{
  "modules_raw": ["Registro de ponto", "Cálculos e Fechamento"],
  "modules_normalized": ["Registro de Ponto", "Cálculos e Tratamento"],
  "module_alerts": [
    {
      "type": "alias",
      "severity": "warning",
      "raw": "Cálculos e Fechamento",
      "canonical": "Cálculos e Tratamento",
      "message": "O módulo \"Cálculos e Fechamento\" não está no padrão oficial. Foi normalizado para \"Cálculos e Tratamento\". Recomendado corrigir o cadastro no Pipedrive."
    }
  ]
}
```

**Campos:**
- `modules_raw` — lista bruta como veio do Pipedrive
- `modules_normalized` — lista final importada (canônicos)
- `module_alerts` — array de alertas, cada um com `type` (alias/unknown), `severity` (warning/error), `raw`, `canonical`, `message`

##### Exibição na UI

O relatório de sincronização no OverviewTab exibe:
- ✅ Confirmação de sucesso (campos atualizados)
- ⚠️ Painel âmbar para cada alias normalizado (warning)
- 🔴 Painel vermelho para módulos não reconhecidos (error) — informando que NÃO foram importados

##### Como corrigir no Pipedrive

1. Acesse o Pipedrive → Organização do cliente
2. Edite o campo **Módulos** (campo `a7cf02...`)
3. Use os nomes exatos da lista oficial acima
4. Re-sincronize via "Atualizar dados do Pipedrive" — os alertas devem desaparecer

> ⚠️ **Causa raiz do bug no deal 10806:** O Pipedrive retornava `"Cálculos e Fechamento"` (alias histórico), mas o sistema normalizou silenciosamente sem alertar. A partir da v6.1, aliases são normalizados mas geram `warning` visível na UI.

#### Normalização de Origem (`normalizeOrigin`)

| Canal no Pipedrive | Origem Base44 |
|---|---|
| "Sankhya" | `Parceiro` |
| "Pontotel" | `Pontotel` |
| "Parceiro" | `Parceiro` |
| "Indicação" | `Indicação` |
| "Inbound" | `Inbound` |
| "Outbound" | `Outbound` |

> Sankhya é um parceiro — mapeado para "Parceiro". A visibilidade do módulo Sankhya no Escopo Técnico é controlada pelo campo `autoShowWhen: { field: "origin", value: "Sankhya" }` no template, que usa o valor bruto do Canal, não do campo `origin` normalizado.

#### Proteção contra sobrescrita de módulos existentes

`contracted_modules` só é enviado no payload se o Pipedrive retornar pelo menos 1 módulo (`contractedModules.length > 0`). Se o campo estiver vazio no Pipedrive, o campo existente no banco é preservado.

#### Correção manual para projetos antigos

Para corrigir módulos de um projeto já existente importado antes da normalização:
1. Acesse o projeto → aba "Dados Iniciais"
2. Clique "Editar" e ajuste os módulos manualmente, **ou**
3. Clique "Atualizar dados do Pipedrive" (re-executa `syncPipedriveData` com a normalização corrigida)

> ⚠️ Esta operação sobrescreve `contracted_modules`. Não afeta respostas do Escopo Técnico (ScopeItems), que são entidades separadas.

Hash `e7f28ae86be385212be4b97a442150ee45ebbb56` = "Funcionários contratados" na entidade Organização do Pipedrive.
`deal.value` = valor mensal do contrato → MRR em R$.

---

### applyStatusReportFromPipedrive *(NOVO — v5.4)*
- **Arquivo:** functions/applyStatusReportFromPipedrive
- **Chamada:** Frontend (OverviewTab via syncPipedriveData) e diagnóstico manual
- **Auth:** Aceita com ou sem usuário (todas ops via asServiceRole)
- **Entrada:** `{ project_id, deal_id?, dry_run? }`
- **Lógica:**
  1. Lê campo customizado `77e52d481be474c3eb61ad1aea1784b9948828f7` do deal Pipedrive
  2. Faz parser do texto estruturado (Próxima Agenda / Pendência cliente / Pendência Pontotel / Riscos)
  3. Normaliza N/A, vazio, ponto-e-vírgula trailing
  4. Preenche os campos **JÁ EXISTENTES** do StatusReport (`next_agenda`, `client_pending`, `internal_pending`)
  5. Cria o StatusReport se não existir; atualiza o existente
  6. **Risco/Riscos → IGNORADO** (não mapeado)
- **Saída:** `{ ok, parsed, patch, fields_updated, report_id, dry_run, duration_ms }`
- **Formato do campo Pipedrive:**
  ```
  Próxima agenda: 24/04 - status report;
  Pendência cliente: Realizar a Expansão;
  Pendência Pontotel: Resolução dos chamados;
  Riscos: <ignorado>
  ```
- **Mapeamento:**

| Label Pipedrive | Campo StatusReport | Tipo |
|---|---|---|
| Próxima Agenda | `next_agenda` | string |
| Pendência cliente | `client_pending` | array `[{item, deadline, responsible}]` |
| Pendência Pontotel | `internal_pending` | array `[{item, deadline, responsible}]` |
| Risco / Riscos | **ignorado** | — |

### mergePipedriveRules *(NOVO — v5.2)*
- **Arquivo:** functions/mergePipedriveRules
- **Chamada:** TabIntegracaoPipedrive (botão "Adicionar novas regras")
- **Auth:** Usuário logado
- **Entrada:** `{}`
- **Lógica:** Lê planilha → compara com banco por chave única → cria apenas as regras novas
- **Chave de deduplicação:** `pipedrive_entidade|pipedrive_campo_key|pipedrive_valor_disparo|base44_fase|base44_atividade`
- **Saída:** `{ total_created, total_before, total_after, cronograma: { created, ignored, created_keys, ignored_keys }, dados_iniciais: { created, ignored } }`
- ✅ **Operação segura:** nunca apaga nem modifica regras existentes. Ideal para atualizações incrementais da planilha.

### syncPipedriveData
- **Arquivo:** functions/syncPipedriveData
- **Chamada:** OverviewTab (botão "Atualizar dados do Pipedrive")
- **Auth:** Usuário logado
- **Entrada:** `{ project_id, deal_id }`
- **Lógica:** GET deal + org do Pipedrive → atualiza campos do Project (nome, cliente, responsáveis, módulos, datas)
- ⚠️ Campos customizados com hashes hardcoded (ex: `30e71cb...` = gerente_projeto)

### validatePipedriveSetup
- **Arquivo:** functions/validatePipedriveSetup
- **Chamada:** ValidationChecklist no Monitor de Integrações
- **Auth:** Usuário logado
- **Entrada:** `{ deal_id? }`
- **Saída:** `{ checks[], summary: { ok, warning, error } }`

### deleteProject
- **Arquivo:** functions/deleteProject
- **Auth:** Admin (role=admin) OU projetos_excluir=true
- ⚠️ NÃO apaga entidades filhas (ScheduleActivity, ScopeItem etc. ficam órfãs)

---

## 4. FLUXO PIPEDRIVE → CRONOGRAMA

### Origem e Leitura dos Eventos

| Campo | Origem | Detalhe |
|-------|--------|---------|
| `stage_id` atual | `body.current.stage_id` | **NUNCA** do deal ao vivo |
| `stage_id` anterior | `body.previous.stage_id` | Para detectar mudança real |
| Data de execução | `body.current.update_time` ou deal ao vivo | Fallback para `new Date()` |
| `activity.done` | `deal/activities` via API Pipedrive | Buscado sempre ao vivo |

### Comparação de Tipos (CRÍTICO)

```js
// ❌ ERRADO — comparação string vs string pode falhar com "142" vs 142
currentStageId === valorDisp

// ✅ CORRETO — comparação numérica explícita
Number(current.stage_id) === Number(regra.pipedrive_valor_disparo)
```

### Detecção de Mudança

```js
const stageChanged = Number(current.stage_id) !== Number(previous.stage_id)
// Só processa regra de deal quando stageChanged === true
```



### Trigger → Condition → Action

| Trigger | Condição | Ação |
|---------|----------|------|
| `change.deal` (webhook) | `previous.stage_id != current.stage_id` **E** `current.stage_id == rule.pipedrive_valor_disparo` | Preenche `actual_start` de todas as atividades da fase (`base44_atividade="*"`) ou atividade específica |
| `change.activity` / `create.activity` | `activity.done == true` **E** `activity[campo_identificacao] == valor_identificacao` (match exato ou normalizado) | Preenche `actual_end` da atividade correspondente na fase |

### Fluxo: Início Executado (actual_start)
```
Pipedrive: stage_id muda → webhook change.deal
    │
    ├─ Extrai current.stage_id do PAYLOAD (não rebusca o deal)
    ├─ Verifica mudança real: previous.stage_id != current.stage_id
    ├─ Localiza Project por pipedrive_deal_id
    ├─ Carrega regras cronograma (entidade=deal, campo_key=stage_id)
    ├─ Compara: current.stage_id == rule.pipedrive_valor_disparo (ex: "16")
    ├─ Se match → busca ScheduleActivity por (project_id, phase_name)
    │   ├─ base44_atividade="*" → aplica em TODAS as atividades da fase
    │   └─ base44_atividade="nome" → aplica apenas na atividade com nome correspondente
    ├─ SEMPRE sobrescreve actual_start = deal[campo_data] ou current.update_time
    │   (Pipedrive é fonte de verdade — valor anterior logado para auditoria)
    └─ status = "Em andamento"
```

### Fluxo: Fim Executado (actual_end)
```
Pipedrive: activity marcada como done → webhook change.activity
    │
    ├─ Verifica activity.done == true
    ├─ Localiza Project por pipedrive_deal_id (usa mais recente se duplicado)
    ├─ Carrega regras cronograma (entidade=activity)
    ├─ Para cada activity done no deal:
    │   ├─ Tenta match exato: activity[campo_ident] == valor_ident
    │   └─ Se falhar, tenta match normalizado (sem acentos/case)
    │   └─ Log de skip se não corresponder
    ├─ Se match → busca ScheduleActivity pelo nome
    ├─ SEMPRE sobrescreve actual_end = activity.marked_as_done_time ou update_time
    │   (Pipedrive é fonte de verdade — valor anterior logado para auditoria)
    └─ status = "Concluído"
```

### Criação Automática
Se a fase existe (SchedulePhase) mas ainda não tem ScheduleActivity e a regra aponta para atividade específica (`base44_atividade != "*"`), a atividade é **criada automaticamente** com as datas executadas.

### Curingas
- `base44_atividade = "*"` → aplica em **todas** as atividades canônicas da fase.
  - **Comportamento de criação automática em massa:** Se a fase tem atividades canônicas definidas em `CANONICAL_ACTIVITIES_BY_PHASE` (espelho do `scheduleTasks.js`) que **ainda não existem como `ScheduleActivity` no banco**, o sistema as **cria automaticamente** antes de aplicar o update. Isso garante que projetos novos (com poucas atividades criadas manualmente) tenham todas as atividades da fase atualizadas corretamente.
  - Após garantir que todas as canônicas existem, aplica `actual_start`/`actual_end` em **todas** elas.
- `base44_atividade = "nome exato"` → aplica apenas na atividade com esse nome (normalizado)

### Idempotência
Chave: `${eventAction}:${eventObject}:${dealId}:${activityId}:${timestamp[:16]}`  
Verificada em IntegrationLog.event_type antes de processar.

### Logs Gerados (pipedriveWebhook)
1. `Recebido: event=X deal_id=Y` — confirmação de recebimento
2. `Projeto: nome | stage_id payload: X | previous: Y` — detecção de mudança de stage
3. `stage_id não mudou, ignorando` — quando não há mudança real
4. `activity skip: campo="valor" ≠ "esperado"` — falha de matching por subject
5. `RESULTADO: rules_matched=X updated=Y created=Z dates_ignored=W` — relatório final

---

## 5. MOTOR DE CRONOGRAMA (Frontend)

### Arquivos
- `lib/scheduleTasks.js` — 76 tasks + PHASE_ORDER + ANCHOR_IDS (NÃO ALTERAR — template global)
- `lib/scheduleEngine.js` — computeSchedule, workday, evaluateCondition
- `lib/scheduleReportEngine.js` — computeMacroSchedule para StatusReport
- **`lib/buildProjectScheduleView.js`** — ⭐ **FONTE ÚNICA** da visão consolidada do cronograma por projeto

### Fonte única: `buildProjectScheduleView`

A partir da v6.2, **TAP e Status Report usam `buildProjectScheduleView` como fonte oficial** do cronograma do projeto. Ela consolida:

| Fonte | Comportamento |
|-------|---------------|
| Fases do template (`scheduleTasks.js`) | Filtradas por visibilidade condicional (módulos, escopo) |
| `SchedulePhaseOverride` | Respeita `is_active=false` (inativa) e `custom_name` (renomeio local) |
| `LocalSchedulePhase` | Fases/marcos criados manualmente no projeto (aparecem após as do template) |
| `ScheduleActivity` | Datas executadas (actual_start/actual_end) de todas as atividades |
| `Project.schedule_anchor_dates` | Âncoras de data persistidas no banco |

**Parâmetros:**
```js
buildProjectScheduleView({
  project,             // Entidade Project
  answersMap,          // { qXXX: resposta }
  savedActivities,     // ScheduleActivity[] do banco
  phaseOverridesMap,   // { phaseName: SchedulePhaseOverride } — pode ser {}
  localPhases,         // LocalSchedulePhase[] — pode ser []
  includeInactive,     // boolean — padrão false
})
// Retorna: Array<{ phase_name, canonical_name, is_local, is_active, planned_start,
//                  planned_end, actual_start, actual_end, status, progress, order }>
```

**Fallback seguro:** Se qualquer dado extra estiver ausente, retorna array com fases do template. Nunca quebra TAP ou Status Report.

### Regras de exibição (respeitadas automaticamente)

| Regra | Comportamento |
|-------|---------------|
| Fase inativa (`is_active=false`) | Oculta em TAP e Status Report (a menos que `includeInactive=true`) |
| Fase local ativa | Aparece em TAP e Status Report com seu próprio nome |
| Nome customizado | Exibido nos três lugares (Cronograma, TAP, Status Report) |
| Ordem das fases | Template segue PHASE_ORDER; fases locais aparecem ao final |
| Fase do template sem conteúdo visível | Omitida automaticamente |

### Tipos de Data
| Tipo | Comportamento |
|------|---------------|
| `anchor` | Editável pelo usuário. Propaga para dependentes. Salvo em `Project.schedule_anchor_dates` |
| `calculated` | Calculado por fórmula (workday, sameDay). Somente leitura |
| `manual_override` | Editável, não propaga |

**Prioridade de fontes para datas planejadas:**
1. Override manual do usuário (salvo em `Project.schedule_anchor_dates` para âncoras)
2. Sincronização Pipedrive (salvo em `schedule_anchor_dates` com `_origin: "pipedrive"`)
3. Calculado automaticamente pelo motor (`scheduleEngine.js`)

### 5 Âncoras (campos de `schedule_anchor_dates`)
| ID | Descrição |
|----|-----------|
| `alinhamento_inicial` | Data do alinhamento inicial — âncora principal |
| `go_live_registro_ponto` | Go Live de registro de ponto |
| `agenda_fechamento_folha` | Fechamento de folha de ponto |
| `expansao_registro_ponto_real` | Expansão real (100% da base) |
| `agenda_encerramento_projeto` | Encerramento formal do projeto |

### Persistência de Âncoras
- **Salvo em:** `Project.schedule_anchor_dates` (banco — multiusuário)
- **Migração:** Se não há dados no banco, tenta migrar do localStorage (uma vez)
- **Acesso:** ScheduleTab, StatusReportTab, TAP, computeMacroSchedule — todos leem do banco

### Fases Locais (`LocalSchedulePhase`)

Fases/marcos criados manualmente em um projeto específico, sem afetar o template global.

| Campo | Descrição |
|-------|-----------|
| `project_id` | Projeto ao qual a fase pertence |
| `phase_name` | Nome da fase local |
| `order` | Ordem de exibição (fases locais aparecem após as do template) |
| `is_local` | Sempre `true` |
| `is_active` | `false` = inativada (dados preservados, fase oculta) |
| `planned_start/end` | Datas planejadas |
| `status` | Status da fase |

**Inativação:** Ao inativar uma fase local, ela é ocultada do Cronograma, TAP e Status Report. Os dados são preservados no banco.

### Overrides Locais de Fase do Template (`SchedulePhaseOverride`)

Permite customizar fases do template global em um projeto específico, sem alterar o template.

| Campo | Descrição |
|-------|-----------|
| `project_id` | Projeto ao qual o override pertence |
| `phase_name` | Nome canônico da fase do template (chave de matching) |
| `is_active` | `false` = fase inativada neste projeto (oculta em Cronograma, TAP e Status Report) |
| `custom_name` | Nome customizado para este projeto |
| `planned_start/end_override` | Datas planejadas sobrescritas localmente |
| `observations` | Observações sobre a inativação/customização |

**Importante:** Overrides são estritamente por projeto. O template global (`scheduleTasks.js`) NUNCA é alterado.

### Atividades Locais (`ScheduleActivity` sem correspondência no template)

Atividades criadas manualmente dentro de uma fase (template ou local). Identificadas por não terem correspondência de nome em `SCHEDULE_TASKS`.

**Inativação:** Status "Cancelado" com observação `[INATIVADO]` = atividade inativada (preservada no banco).

### Fórmulas Suportadas
```
workday(ref.field, N)     → N dias úteis após ref
sameDay(ref)              → mesma data que ref
taskId.plannedStart/End   → referência direta
plannedStart              → self reference
```

---

## 6. RBAC

### Resolução de permissões
1. `AuthContext` carrega `user._resolvedProfile` (PermissionProfile)
2. `usePermissions()` resolve: perfil > role=admin (tudo) > sem perfil (nada)

### Flags de Cronograma (adicionadas na v6.1)

| Flag | Descrição |
|------|-----------|
| `cronograma_ver` | Visualizar cronograma |
| `cronograma_editar` | Editar datas executadas (actual_start/actual_end) |
| `cronograma_editar_planejado` | Editar datas planejadas e âncoras |
| `cronograma_concluir_fase` | Marcar fase como concluída conforme planejado |
| `cronograma_recalcular` | Concluir projeto completo conforme planejado |
| `cronograma_criar_atividade` | Adicionar atividade local a uma fase |
| `cronograma_criar_fase` | Adicionar marco/fase local |
| `cronograma_editar_fase` | Editar marco/fase local OU editar fase do template neste projeto (nome, datas, obs) |
| `cronograma_excluir_fase` | Excluir ou inativar marco/fase local OU inativar fase do template neste projeto |
| `cronograma_editar_atividade` | Editar atividade local |
| `cronograma_excluir_atividade` | Excluir ou inativar atividade local |

### Todas as Flags (26 total)
`projetos_ver/criar/editar/excluir`, `dados_iniciais_ver/editar`, `escopo_ver/editar/atualizar_template`,
`cronograma_ver/editar/editar_planejado/concluir_fase/recalcular/criar_atividade/criar_fase/editar_fase/excluir_fase/editar_atividade/excluir_atividade`,
`tap_ver/editar/gerar_pdf`, `status_report_ver/editar/atualizar/email`,
`termo_ver/editar/pdf`, `integracao_sync_pipedrive_dados/cronograma/status`, `parametrizacoes_acessar/editar`

---

## 6.1 TAP — ARQUITETURA v6.3 (COM DIAGNÓSTICO)

### Seção 5 — Cronograma

A seção de Cronograma da TAP usa `buildProjectScheduleView` como fonte oficial (a partir da v6.2).

**Fluxo completo ao clicar "Atualizar dados automáticos":**

```
handleRefreshAuto()
  ↓
1. onRefresh() — recarrega projeto e escopo do banco
2. buildScheduleSnapshotFromDB(projectId, answersMap, project)
   ↓
   a. Carrega SchedulePhaseOverride do banco
   b. Carrega LocalSchedulePhase do banco
   c. Carrega ScheduleActivity do banco
   d. Chama buildProjectScheduleView({ project, answersMap, savedActivities, phaseOverridesMap, localPhases })
   e. Retorna [{ label, plannedStart, plannedEnd, isLocal }]
3. setScheduleSnapshot(snap) — atualiza estado local
4. saveVersion(form, { scheduleSnapshot: snap }) — persiste no banco
```

**Logs de diagnóstico (abrir console do navegador):**

Ao clicar em "Atualizar dados automáticos", os seguintes logs são emitidos:

```
[TAPTab] handleRefreshAuto — INÍCIO
[TAPTab] handleRefreshAuto — project_id: <id>
[TAPTab] handleRefreshAuto — currentVersion: <n> status: <status>
[TAPTab] handleRefreshAuto — scheduleSnapshot atual: <count> fases: [<lista>]
[TAPTab] handleRefreshAuto — isSent: <true/false>
[TAPTab] handleRefreshAuto — CHAMANDO buildScheduleSnapshotFromDB
[TAPTab] buildScheduleSnapshotFromDB INÍCIO — project_id: <id>
[TAPTab] buildScheduleSnapshotFromDB — Dados carregados: { phaseOverrideList, localPhaseList, savedActivities }
[TAPTab] buildScheduleSnapshotFromDB — phaseOverridesMap: [<chaves>]
[TAPTab] buildScheduleSnapshotFromDB — localPhases: [<nomes>]
[TAPTab] buildScheduleSnapshotFromDB — scheduleView RETORNO: { total, fases }
[TAPTab] buildScheduleSnapshotFromDB — scheduleSnapshot final: { total, fases }
[TAPTab] handleRefreshAuto — snap RETORNADO: <count> fases: [<lista>]
[TAPTab] handleRefreshAuto — SALVANDO versão com scheduleSnapshot
[TAPTab] saveVersion — INÍCIO
[TAPTab] saveVersion — versão ATUALIZADA/CRIADA no banco
[TAPTab] saveVersion — FIM
[TAPTab] handleRefreshAuto — FIM
```

**Fonte antiga (antes da v6.2):**
- Função `buildScheduleSnapshotFromLocal` (código inline no TAPTab)
- Lia do `localStorage` (não do banco)
- Usava lista fixa hardcoded de 6 fases
- Não conhecia fases locais nem overrides de inativação

**Nova fonte oficial:**
- Função `buildScheduleSnapshotFromDB(projectId, answersMap, project)` (async)
- Carrega do banco: `SchedulePhaseOverride` + `LocalSchedulePhase` + `ScheduleActivity`
- Chama `buildProjectScheduleView` com todos os dados reais
- Retorna array `[{ label, plannedStart, plannedEnd, isLocal }]` (todas fases ativas, com ou sem datas)

**Quando é atualizada:**
- Ao clicar "Atualizar dados automáticos" (botão âmbar na TAP)
- Busca dados mais recentes do banco a cada atualização
- Versões já enviadas ao cliente **não** têm o snapshot atualizado (trava histórica preservada)
- Snapshot salvo em `TAPVersion.schedule_snapshot` (JSON) para garantir histórico imutável da versão

**Fallback seguro:**
- Se `buildProjectScheduleView` retornar array vazio (falha ou projeto sem cronograma), `scheduleSnapshot` fica `[]`
- UI mostra `FASES_MACRO` (lista descritiva hardcoded) apenas quando `scheduleSnapshot.length === 0`
- **Importante:** `FASES_MACRO` NÃO deve aparecer em projetos Pontotel com cronograma real

**Compatibilidade retroativa:**
- Versões antigas com `schedule_snapshot` salvo continuam sendo exibidas corretamente (lidas do banco)
- Apenas novas atualizações passam pela nova função

### Diagnóstico de problemas

**Se a TAP ainda mostra fases antigas (Homologação, Rollout, Go-live, Pós Go-live):**

1. Abrir console do navegador (F12)
2. Clicar em "Atualizar dados automáticos" na TAP
3. Verificar logs:
   - `buildScheduleSnapshotFromDB — scheduleView RETORNO` — quantas fases? quais nomes?
   - `buildScheduleSnapshotFromDB — scheduleSnapshot final` — quantas fases? quais nomes?
   - `saveVersion — versão ATUALIZADA/CRIADA` — salvou no banco?
4. Se `scheduleView` retorna fases corretas mas UI mostra errado:
   - Verificar se `scheduleSnapshot` estado local foi atualizado
   - Verificar se UI está lendo `scheduleSnapshot` correto (linha ~949)
5. Se `scheduleView` retorna vazio:
   - Verificar se `savedActivities` tem dados no banco
   - Verificar se `project.schedule_anchor_dates` tem âncoras definidas
   - Verificar se `answersMap` tem respostas do escopo

---

## 6.2 ESCOPO TÉCNICO — ARQUITETURA v2.1 (COM PROTEÇÃO STALE — 2026-06-15)

### Fluxo de Save (corrigido)

```
Usuário edita resposta/observação no ScopeItemRow
  ↓
handleAnswerChange / handleObsChange
  ↓ setAnswer / setObs (state local)
  ↓ scheduleDebounce (800ms) ou onBlur imediato
  ↓ triggerSave(answer, obs)
  ↓
ScopeTab.handleSave(questionId, { answer, observations })
  ↓
1. pendingKeys.add(questionId) — protege contra overwrite do sync
2. setLocalAnswers() — otimista
3. parseInt(questionId) → orderNum
4. scopeItemsRef.current.find(s => Number(s.order_number) === orderNum)
5. UPDATE ou CREATE no banco
6. scopeItemsRef.current ATUALIZADO IMEDIATAMENTE com dados retornados
7. lastSavedAt.current[questionId] = Date.now() — timestamp
8. pendingKeys.delete(questionId)
9. onScopeSaved() → ProjectDetail.reloadScopeItems()
```

### Proteção Stale (NOVA)

**Problema:** Quando `handleSave` atualiza/cria ScopeItem e dispara `reloadScopeItems`, o banco pode retornar dados stale. O sync useEffect então sobrescrevia o state local otimista com dados vazios.

**Solução:** Três camadas:
1. `scopeItemsRef` atualizado após UPDATE e CREATE
2. `lastSavedAt` timestamp por questionId
3. Janela de 3s: se DB retornar vazio mas local tem valor salvo há <3s, mantém local

### Observações independentes da resposta

Payload sempre inclui `{ answer, observations }` juntos. Resposta vazia não bloqueia save de observação.

### Campos: `ScopeItem.answer` + `ScopeItem.observations`

### Logs de diagnóstico (console F12)

```
[ScopeItemRow] triggerSave — DISPARO
[ScopeTab] handleSave — INÍCIO
[ScopeTab] handleSave — BUSCA (found, existingId, allOrderNumbers)
[ScopeTab] handleSave — UPDATE/CREATE
[ScopeTab] useEffect sync — RESULTADO (syncedCount, skippedStaleProtection)
[ScopeTab] useEffect sync — PROTEÇÃO STALE ativada (se aplicável)
[ProjectDetail] reloadScopeItems — carregados
```

---

## 15. AUDITORIA DE REGRAS DE DATA DO CRONOGRAMA (v5.9 — 2026-05-06)

### Causa raiz dos problemas identificados

`scheduleTasks.js` continha 10 atividades com `plannedEnd: { type: "manual_override" }` indevido.
Consequência em cascata: atividades que dependiam do fim dessas ficavam sem data planejada.

### Atividades corrigidas na v5.9b (2026-05-06)

| ID | Atividade | Correção |
|---|---|---|
| `integracao_sankhya_envio_formulario` | [Sankhya] Envio formulário | plannedEnd: `workday(plannedStart, 1)` |
| `inicio_ativacao_integracao_sankhya` | Início ativação integração | plannedStart: `preenchimento_formulario_integracao_sankhya.plannedEnd` (era manual) |
| `correcao_cadastros_sankhya` | [Sankhya] Correção cadastros | plannedEnd: `workday(plannedStart, 5)` |
| `envio_planilha_importacao_escalas_sankhya` | Envio planilha escalas | plannedEnd: `workday(plannedStart, 1)` |
| `fechamento_folha` | Fechamento de folha | plannedEnd: `workday(plannedStart, 5)` |

### Atividades corrigidas na v5.9a (manual_override → calculated)

| ID | Atividade | Correção aplicada |
|---|---|---|
| `envio_documentacao_i05` | Envio documentação I05 | `workday(plannedStart, 1)` |
| `parametrizacao_regras` | Parametrização de regras | `workday(plannedStart, 10)` |
| `parametrizar_permissoes_usuarios` | Parametrizar permissões usuários | `workday(plannedStart, 3)` |
| `validar_regras_calculo_banco_horas` | Reunião validar regras cálculo BH | `workday(plannedStart, 1)` |
| `validar_arquivo_exportacao` | Reunião validar arquivo exportação | `workday(plannedStart, 1)` |
| `treinamento_gestao_horas_extras` | Treinamento gestão horas extras | `workday(plannedStart, 1)` |
| `treinamento_gestao_ferias` | Treinamento gestão férias | `workday(plannedStart, 1)` |
| `treinamento_sobreaviso` | Treinamento sobreaviso | `workday(plannedStart, 1)` |
| `treinamento_timesheet` | Treinamento timesheet | `workday(plannedStart, 1)` |
| `assinatura_termo_encerramento` | Assinatura termo encerramento | `workday(plannedStart, 2)` |

### Atividades com `manual_override` JUSTIFICADO (mantidas)

Essas atividades têm fim manual por natureza — dependem de decisão ou entrega do cliente:

| ID | Motivo |
|---|---|
| `integracao_sankhya_envio_formulario` | Cliente define quando envia |
| `inicio_ativacao_integracao_sankhya` | Depende de liberação Sankhya |
| `correcao_cadastros_sankhya` | Depende do cliente corrigir |
| `envio_planilha_importacao_escalas_sankhya` | Cliente define quando envia |
| `preencher_planilha_enderecos` | Depende do cliente |
| `parametrizar_notificacoes` | Duração variável por complexidade |
| `criar_usuario_api` | Processo interno variável |
| `realizar_configuracao_sftp` | Depende do cliente configurar |
| `adicionar_arquivos_afd_sftp` | Cliente envia quando quiser |
| `fechamento_folha` | Data real depende do processo do cliente |

### Cadeia de dependências corrigidas (impacto em cascata)

```
envio_documentacao_i05 (fim: +1d) → importacao_cadastros_i05 (início/fim calculados) ✓
parametrizacao_regras (fim: +10d) → validar_regras_calculo_banco_horas (início calculado) ✓
parametrizacao_regras (fim: +10d) → validar_arquivo_exportacao (início calculado) ✓
parametrizar_permissoes_usuarios (fim: +3d) → treinamento_sobreaviso (início calculado) ✓
assinatura_termo_encerramento (fim: +2d) → passagem_sucesso_cliente (início/fim calculados) ✓
```

---

## 14. PARAMETRIZAÇÕES — TEMPLATES > CRONOGRAMA (v5.8)

### Fonte oficial do cronograma

A aba **Parametrizações > Templates > Cronograma** é a visualização oficial da estrutura do cronograma.

| Origem | Responsável |
|--------|------------|
| Fases e atividades | `lib/scheduleTasks.js` → `SCHEDULE_TASKS` |
| Regras de data (âncora, cálculo, offset) | `lib/scheduleTasks.js` → campos `plannedStart`/`plannedEnd` de cada task |
| Responsáveis padrão | `ScheduleTemplate.tasks_config` (banco) |
| Motor de cálculo | `lib/scheduleEngine.js` → `computeSchedule()` |
| Macrofases para Status Report | `lib/scheduleReportEngine.js` → `computeMacroSchedule()` |

### Campos exibidos por atividade

| Campo | Origem |
|-------|--------|
| Nome da atividade | `task.activity` |
| Fase | `task.phase` |
| Tipo | `task.plannedStart.type` (anchor / calculated / manual_override) |
| Regra de Início | `task.plannedStart.formula` (parseada para texto legível) |
| Regra de Fim | `task.plannedEnd.formula` (parseada para texto legível) |
| Recalcula dependentes | `task.plannedStart.propagates` |
| Visibilidade condicional | `task.visibleWhen` / `visibleWhenAll` / `visibleWhenAny` |
| Resp. Geral | `ScheduleTemplate.tasks_config[taskId].responsible_general_type` |
| Papel Líder | `ScheduleTemplate.tasks_config[taskId].responsible_role` |

### Tipos de data

| Tipo | Badge | Comportamento |
|------|-------|--------------|
| `anchor` | 🔶 Âncora | Data definida por projeto, editável no cronograma. Propaga para dependentes. |
| `calculated` | ⚡ Calculada | Calculada automaticamente por fórmula (workday, sameDay, ref direta). Somente leitura. |
| `manual_override` | ✏️ Manual | Preenchida manualmente no projeto. Não recalcula automaticamente. |

### 5 Datas Âncora do sistema

| ID | Atividade âncora |
|----|-----------------|
| `alinhamento_inicial` | Alinhamento inicial |
| `go_live_registro_ponto` | Inicio de registro de ponto (Go Live) |
| `agenda_fechamento_folha` | Agenda fechamento de folha de ponto |
| `expansao_registro_ponto_real` | Expansão de registro de ponto real |
| `agenda_encerramento_projeto` | Agenda de encerramento de projeto |

### Configuração de responsáveis

- **Resp. Geral** (`responsible_general_type`): `pontotel` / `cliente` / `compartilhado`
  - Resolvido dinamicamente no projeto via `resolveGeneralResponsible(type, project)`
- **Papel Líder** (`responsible_role`): `gerente_projeto` / `analista_implantacao` / `patrocinador` / `lider_projeto` / `ti` / `operacao`
  - Resolvido dinamicamente no projeto via `resolveRoleToName(role, project)`

Alterações são salvas em `ScheduleTemplate.tasks_config` (JSON) e lidas pelo `ScheduleTab` via `templateConfig[taskId]`.

### Atividades condicionais

Atividades com `visibleWhen ≠ "always"` só aparecem no cronograma do projeto se os módulos/escopo/serviços estiverem ativos. A condição é avaliada por `evaluateCondition()` em `scheduleEngine.js`.

### O que NÃO é configurável aqui

- As fórmulas de data (ex: `workday(alinhamento_inicial.plannedStart, 5)`) estão hardcoded em `scheduleTasks.js`
- Adicionar/remover atividades requer edição de `scheduleTasks.js`
- A ordem das fases é definida por `PHASE_ORDER` em `scheduleTasks.js`

---

## 7. CONSISTÊNCIA DE NOMES DE FASES

**Regra de ouro:** os nomes de fase DEVEM ser idênticos em todos estes lugares:

| Arquivo | Campo |
|---------|-------|
| `entities/SchedulePhase.json` | enum `phase_name` |
| `lib/scheduleTasks.js` | `PHASE_ORDER[]` e `task.phase` |
| `lib/mockData.js` | `SCHEDULE_TEMPLATE[].phase_name` |
| `PipedriveIntegrationRule` | `base44_fase` |
| `ScheduleActivity` | `phase_name` |

**Fases canônicas (v4.0):**
```
Abertura de projeto, Integração, Cadastros, Parametrização,
Treinamento e Validações, Operação Assistida, Fechamento de Folha,
Expansão, Encerramento
```

---

## 8. DIAGNÓSTICO E PENDÊNCIAS TÉCNICAS

### ✅ Resolvido em v5.1
- **Matching de atividades com normalização Unicode**: `activitiesByTask` agora usa comparação NFD normalizada (lowercase, sem acentos, sem espaços duplos) com fallback por `includes`. Corrige inconsistência onde `actual_start`/`actual_end` existiam no banco mas apareciam como "—" na UI por falha de match entre strings com encoding diferente (NFD vs NFC).
- **Causa raiz**: comparação `t.activity === a.activity_name` falhava silenciosamente quando ambas as strings tinham acento codificado diferentemente (ex: `é` NFC vs `é` NFD). O `found` retornava `undefined` e a atividade era excluída do map.
- **Regra de matching** (em ordem de prioridade):
  1. Match exato normalizado: `norm(task.activity) === norm(db.activity_name)`
  2. Fallback includes: um contém o outro após normalização
- Log de diagnóstico: `[ScheduleTab] match: "nome" → task.id="id"` e `[ScheduleTab] SEM MATCH: "nome"` para identificar casos sem correspondência.

### ✅ Resolvido em v5.0
- **Pipedrive definido como fonte de verdade**: actual_start e actual_end sempre sobrescritos via integração
- **Regra de unicidade**: duplicatas de pipedrive_deal_id tratadas — usa o mais recente, loga alerta
- Logs agora mostram valor anterior → valor novo (auditoria completa)

### ✅ Resolvido em v4.0
- Datas âncoras persistidas no banco (era localStorage)
- Nomes de fases corrigidos (SCHEDULE_TEMPLATE alinhado)
- pipedriveWebhook usa IntegrationLog (era PipedriveWebhookEvent)
- Idempotência via IntegrationLog
- StatusReportTab usa banco para âncoras (era localStorage)
- syncScheduleFromPipedrive implementação inline (sem delegar via HTTP)
- applyPipedriveRules aceita chamadas sem usuário autenticado

### ⚠️ Pendências ainda abertas

| # | Criticidade | Descrição | Recomendação |
|---|------------|-----------|--------------|
| 1 | Alta | `deleteProject` não apaga filhas | Implementar cascata no backend |
| 2 | Alta | `savePipedriveRules` destrutiva sem rollback | Criar antes, apagar depois |
| 3 | Alta | Campos customizados Pipedrive com hashes hardcoded | Configuração centralizada |
| 4 | Média | D4Sign sem função backend | Implementar função de envio |
| 5 | Média | `testPipedriveDeal`, `readSheetReport`, `readSheetMapping` sem auth | Adicionar verificação role=admin |
| 6 | Baixa | MOCK_PROJECTS em mockData.js | Remover dados fictícios |

---

## 9. REGRAS DE INTEGRAÇÃO — PLANILHA COMO FONTE OFICIAL

A planilha Google Sheets (GID `1377224895`, aba "Cronograma - Integração") é a **fonte oficial** das regras de integração Pipedrive → Cronograma. As regras são importadas e armazenadas na entidade `PipedriveIntegrationRule`.

### Três abas suportadas (v5.4)

| Aba | GID | Tipo de regra | Descrição |
|-----|-----|---------------|-----------|
| Dados iniciais - integração | `432071218` | `dados_iniciais` | Mapeamento de campos do deal → Project |
| Cronograma - Integração | `1377224895` | `cronograma` | stage_id / activity done → ScheduleActivity |
| Status Report | `1556112644` | `status_report` | Campo customizado texto → campos existentes do StatusReport |

### Dois modos de sincronização

| Modo | Função | Quando usar |
|------|---------|-------------|
| **Incremental** (padrão) | `mergePipedriveRules` | Novas linhas foram adicionadas à planilha — preserva tudo existente |
| **Recriação total** | `savePipedriveRules` | Reset completo — apaga todas as regras e recria do zero |

### Aba Status Report — Estrutura da Planilha

Colunas esperadas:
- `tipo_integracao` — tipo da regra
- `origem_pipe` / `campo_pipe_key` — identificador do campo Pipedrive
- `label_pipe` — label do bloco no texto estruturado (ex: "Próxima Agenda")
- `destino_base44` — campo Base44 destino (ex: `next_agenda`)
- `tipo_campo` — tipo do campo
- `observacao` — observação livre

### Fluxo Status Report: Pipedrive → StatusReport

```
OverviewTab "Atualizar dados do Pipedrive"
    │
    ├─ syncPipedriveData (Project fields)
    │       └─ invoca applyStatusReportFromPipedrive
    │
    └─ applyStatusReportFromPipedrive
           ├─ GET deal[77e52d...828f7] → texto estruturado
           ├─ parseTextBlock() → { proxima_agenda, pendencia_cliente, pendencia_pontotel }
           ├─ normalizeText() → remove N/A, trailing ';', espaços
           ├─ textToPendingArray() → converte em [{item, deadline, responsible}]
           └─ StatusReport.update() → next_agenda, client_pending, internal_pending
```

**Chave única de deduplicação (modo incremental):**
```
pipedrive_entidade|pipedrive_campo_key|pipedrive_valor_disparo|base44_fase|base44_atividade
```
Se a chave já existe no banco → regra ignorada. Se não existe → regra criada.

### Regras vigentes (sincronizadas da planilha)

#### Regra 1 — Início Executado (deal.updated / stage_id)

| Campo | Valor |
|-------|-------|
| `pipedrive_entidade` | `deal` |
| `pipedrive_evento` | `deal.updated` |
| `pipedrive_campo_key` | `stage_id` |
| `pipedrive_valor_disparo` | `142` |
| `base44_fase` | `Abertura de projeto` |
| `base44_atividade` | `*` (todas as atividades da fase) |
| `faz_inicio` | `true` |
| `faz_fim` | `false` |
| `pipedrive_campo_data` | `update_time` |

**Comportamento:** Quando o deal muda para stage_id=142, **todas** as atividades da fase "Abertura de projeto" recebem `actual_start = deal.update_time` (início_executado). Não altera início_planejado.

#### Regra 2 — Fim Executado (activity.updated / done)

| Campo | Valor |
|-------|-------|
| `pipedrive_entidade` | `activity` |
| `pipedrive_evento` | `activity.updated` |
| `pipedrive_campo_key` | `done` |
| `pipedrive_valor_disparo` | `true` |
| `pipedrive_campo_identificacao` | `subject` |
| `pipedrive_valor_identificacao` | `(Escopo técnico) Reunião de escopo técnico #Aut` |
| `base44_fase` | `Abertura de projeto` |
| `base44_atividade` | `Agenda de escopo técnico` |
| `faz_inicio` | `false` |
| `faz_fim` | `true` |
| `pipedrive_campo_data` | `marked_as_done_time` |

**Comportamento:** Quando a atividade com o subject especificado é marcada como done, a atividade "Agenda de escopo técnico" recebe `actual_end = activity.marked_as_done_time` (fim_executado) e `status = "Concluído"`. Não altera fim_planejado.

### Campos de data: distinção obrigatória

| Campo DB | Nome na UI | Origem |
|----------|-----------|--------|
| `actual_start` | Início Executado | **Flow histórico do deal** (`GET /v1/deals/{id}/flow`) — data real de entrada na etapa |
| `actual_end` | Fim Executado | Deal ao vivo ou `activity.marked_as_done_time` |
| `planned_start` | Início Planejado | Motor de cronograma (calculado) |
| `planned_end` | Fim Planejado | Motor de cronograma (calculado) |

### Origem correta de actual_start: Deal Flow vs. Estado Atual

**Problema resolvido em v5.3:** antes, `actual_start` usava `deal.update_time` ou `deal[campoData]` — ambos refletem o **estado atual** do deal, não o momento histórico em que ele entrou naquela etapa. Isso causava todas as fases receberem a mesma data (a da última sincronização).

**Solução: `GET /v1/deals/{id}/flow`**

O endpoint `/flow` retorna o log completo de eventos do deal. A função `fetchStageEntryDates` constrói um `Map<stageId, dateStr>` com a **data mais antiga de entrada** em cada etapa (flow vem decrescente — sobrescrever sempre mantém a mais antiga).

**Estrutura real confirmada por diagnóstico (2026-05-06):**

```json
{
  "object": "dealChange",
  "timestamp": "2026-04-28 14:30:00",
  "data": {
    "field_key": "stage_id",
    "old_value": "141",
    "new_value": "142",
    "log_time": "2026-04-28 14:30:00",
    "additional_data": {
      "old_value_formatted": "Abertura",
      "new_value_formatted": "Parametrização"
    }
  }
}
```

**Parser correto:**
```js
// Filtrar apenas eventos de mudança de deal com campo stage_id
if (item.object !== 'dealChange') continue;
const d = item.data || {};
if (d.field_key !== 'stage_id') continue;
const newStage = Number(d.new_value);  // new_value é STRING — converter para Number
const logTime  = item.timestamp || d.log_time;  // timestamp no nível raiz do item
```

**❌ Parser anterior (incorreto):**
```js
// d.stage_id_new NÃO EXISTE no payload real
const newStage = d.stage_id_new != null ? Number(d.stage_id_new) : null;
// item.log_time NÃO EXISTE no nível raiz — fica em item.timestamp
const logTime = item.log_time || d.log_time;
```

**Tipos de objeto retornados pelo flow:**
| `object` | Descrição |
|----------|-----------|
| `dealChange` | Mudança de campo do deal (inclui stage_id, expected_close_date, etc.) |
| `activity` | Atividade criada/atualizada no deal |
| `note` | Nota adicionada ao deal |

**Regra de aplicação por tipo de data:**

| Tipo de data | Fonte |
|---|---|
| `actual_start` (faz_inicio=true) | `stageEntryDates.get(stageId)` — data histórica do flow |
| `actual_end` (faz_fim=true) | `deal[campoData]` ou `deal.update_time` — estado atual |
| `actual_end` via activity | `activity.marked_as_done_time` — inalterado |

**Condição de match para faz_inicio:**
- Antes: `currentStageId === valorDisparo` (só etapa atual)
- Agora: `stageEntryDates.has(ruleStageNum)` (qualquer etapa já visitada no histórico)

Isso garante que uma sync manual em qualquer momento sempre recupera as datas históricas corretas de cada etapa, mesmo que o deal já tenha avançado para etapas posteriores.

### Resultado E2E validado (2026-05-02)

```
Projeto: Teste Dani (id=69f541bd21439fae5bc7b8b8)
Deal Pipedrive: #12960 | stage_id=142

Regras carregadas: 2
Regras aplicadas: 2
Atividades atualizadas: 2
Erros: 0

Atividade "Agenda de escopo técnico":
  actual_start: "2026-05-01" ✓ (início_executado)
  actual_end:   "2026-05-01" ✓ (fim_executado)
  status:       "Concluído"  ✓
  UI:           exibe "01/05/2026" ✓ (fix normalização Unicode v5.1)
```

## 13. CRONOGRAMA — MOTOR DE CÁLCULO v5.7

### Problema corrigido: datas planejadas não calculavam

**Causa raiz:** O loop `if (!d.plannedStart || pass === 0)` da v5.x resetava a condição no passe 0, forçando re-tentativa mesmo em datas já calculadas. Mais crítico: o número de passes (4) era insuficiente para cadeias longas de dependência (ex: `expansao_registro_ponto_real` → `fechamento_folha_real` → que dependia de outra) e a ordem de declaração das tasks não é topológica — uma task B pode aparecer antes da task A que ela depende.

**Correção:** Aumentado para **8 passes**. Lógica de resolução separada por tipo:
- `anchor` / `manual_override`: aplica o override do banco **sempre** (idempotente)
- `calculated` plannedStart: só calcula se ainda `null` (não re-calcula)
- `calculated` plannedEnd: re-calcula em todo passe (permite que corrija quando dependência acabou de resolver)

**Cobertura garantida:**
| Cadeia | Profundidade | Passes necessários |
|---|---|---|
| alinhamento_inicial → agenda_escopo_tecnico → envio_tap → agenda_status_report | 4 | ≤ 4 |
| go_live → agenda_verificacao_pre_fechamento → ... | 3 | ≤ 3 |
| agenda_encerramento → assinatura_termo → passagem_sucesso | 3 | ≤ 3 |
| expansao → fechamento_folha_real | 2 | ≤ 2 |
| Pior caso total | ~7 | ≤ 8 ✓ |

### Regras de resolução

```
anchor:          d.plannedStart = anchors[taskId].plannedStart  (sempre)
manual_override: d.plannedStart = anchors[taskId].plannedStart  (se existir)
calculated:      if (!d.plannedStart) d.plannedStart = resolve(formula)  (plannedStart)
                 d.plannedEnd = resolve(formula)  (plannedEnd — sempre re-tenta)
```

---

## 12. STATUS REPORT — ARQUITETURA v6.2

### Source único de dados

| Dado | Source | Função backend |
|---|---|---|
| `registered_employees` | Aba "Mais recente" da planilha | `updateReportFromSheet` |
| `recording_employees` | Aba "Mais recente" da planilha | `updateReportFromSheet` |
| `adherence_percent` | Calculado: `recording / contracted * 100` | StatusReportTab |
| `contracted_employees` | Pipedrive → Project | `syncPipedriveData` |
| `macroPhases` / cronograma | `buildProjectScheduleView` via `computeMacroSchedule` | Motor frontend |
| Pendências / next_agenda | Pipedrive campo customizado | `applyStatusReportFromPipedrive` |

### Sincronização do cronograma com o Cronograma real

O bloco "Cronograma do Projeto" no Status Report usa `buildProjectScheduleView` como fonte oficial. Ao clicar "Atualizar Status Report", o sistema:

1. Carrega `SchedulePhaseOverride` do projeto (fases inativadas/customizadas)
2. Carrega `LocalSchedulePhase` do projeto (fases locais ativas)
3. Chama `computeMacroSchedule(overrides, answersMap, project, savedActivities, phaseOverridesMap, localPhases)`
4. O motor usa `buildProjectScheduleView` internamente para montar a visão consolidada

**Resultado:**
- Fases inativadas (template ou local) **não aparecem** no Status Report
- Fases locais ativas **aparecem** no Status Report com seu nome
- Nomes customizados de fases **são usados** na exibição

### Botão único "Atualizar Status Report"

O único botão de atualização executa esta sequência em ordem:
1. `updateReportFromSheet` → registered/recording employees da aba "Mais recente"
2. Calcular aderência = `recording / contracted * 100`
3. Carregar `SchedulePhaseOverride` + `LocalSchedulePhase` do projeto
4. `computeMacroSchedule(...)` via `buildProjectScheduleView` → cronograma macro real
5. `applyStatusReportFromPipedrive` → pendências e next_agenda (se deal_id vinculado)
6. `StatusReport.update()` → persiste tudo
7. `Project.update({ progress_percent })` → atualiza projeto
8. `setKpiData()` → atualiza KPIs na UI

### KPI na UI e no e-mail — source único

`kpiData` é o estado central de KPIs no `StatusReportTab`:
- Inicializado a partir do `report` persistido no banco
- Atualizado após cada execução do botão
- Passado ao `StatusReportDashboard` via prop `kpiData`
- Passado ao `generateStatusReportEmail` via `usabilityData` (mesmo objeto)
- **UI e e-mail SEMPRE usam o mesmo `kpiData`**

### Por que havia divergência antes

| Problema | Causa | Correção |
|---|---|---|
| Aderência sumia na UI | `usabilityData` era `null` na renderização inicial | KPIs agora vêm do `report` persistido via `computeKpiFromReport` |
| Empregados incorretos | `getUsabilityData` usava aba "Dados" em vez de "Mais recente" | Botão usa apenas `updateReportFromSheet` (aba "Mais recente") |
| Dois botões | "Atualizar Report" (verde) e "Atualizar Status Report" (roxo) separados | Unificados em um único botão roxo |
| E-mail com dados diferentes | `usabilityData` passado ao template não era o mesmo da UI | Agora `handleGenerateEmail` monta `usabilityForEmail` a partir de `kpiData` |

---

## 11. AUDITORIA DE PERSISTÊNCIA — v5.5

### Problemas corrigidos

| # | Problema | Causa Raiz | Correção |
|---|---|---|---|
| 1 | `contracted_employees` sempre null | `syncPipedriveData` não mapeava o campo. Hash da org nunca lido | Adicionado mapeamento `org["e7f28ae..."] → contracted_employees` |
| 2 | `mrr` sempre null | `syncPipedriveData` não mapeava `deal.value` | Adicionado `deal.value → mrr` |
| 3 | Datas âncora sumindo | Race condition em `handleSaveOverride`: `savingAnchorRef` bloqueava saves concorrentes sem enfileirar | Substituído por `setManualOverrides(prev => ...)` com save inline do estado mais recente |
| 4 | E-mail com dados zerados | `generateStatusReportEmail` recebia `usabilityData=null` e não tinha fallback para `report` | Adicionado parâmetro `report` com fallback `?? report?.registered_employees` |
| 5 | Aderência ausente | Campo removido junto com bloco separado | Reintegrado como sub-texto do KPI "Empregados no Ponto/mês" |
| 6 | `project` desatualizado em outros tabs após sync | `onProjectUpdated` fazia merge parcial sem recarregar do banco | Adicionado refetch completo do projeto após merge parcial |

### Regras de persistência

**Âncoras do cronograma:**
- Salvas em `Project.schedule_anchor_dates` (banco)
- Nunca mais no localStorage (apenas migração única)
- Save usa `setManualOverrides(prev => ...)` para evitar race condition

**Funcionários contratados / MRR:**
- Originam do Pipedrive via `syncPipedriveData`
- Editáveis manualmente pelo modal "Editar Dados Iniciais"
- `syncPipedriveData` sobrescreve se houver valor no Pipedrive

**Status Report — dados de usabilidade:**
- Persistidos em `StatusReport.registered_employees` / `recording_employees` / `adherence_percent`
- Template de e-mail usa `usabilityData` quando disponível, senão fallback para `report` persistido
- Aderência = `batendoPonto / contracted_employees * 100` — calculada dinamicamente, persistida em `adherence_percent`

---

## 10. PAYLOADS PIPEDRIVE ESPERADOS

### change.deal
```json
{
  "event": "change.deal",
  "meta": { "action": "change", "object": "deal", "v_ts": "20260430120000" },
  "current": { "id": 12960, "stage_id": 142, "update_time": "2026-04-30" },
  "previous": { "stage_id": 141 }
}
```

### change.activity (done)
```json
{
  "event": "change.activity",
  "meta": { "action": "change", "object": "activity" },
  "current": {
    "id": 456, "deal_id": 12960,
    "done": true, "subject": "(Escopo técnico) Reunião...",
    "marked_as_done_time": "2026-04-30 10:00:00"
  }
}
```

---

## 10. MONITOR DE INTEGRAÇÕES

**Rota:** `/monitor-integracoes`  
**Componentes:** MonitorIntegracoes, IntegrationLogRow, ValidationChecklist, DealTestPanel, WebhookSimulatePanel

### Funcionalidades
- Lista todos IntegrationLog com filtros (status, source, event_type, deal_id)
- Detalhe completo: regras avaliadas, atividades atualizadas, payloads, debug steps
- Validação Pipedrive (validatePipedriveSetup)
- Teste por project_id com dry_run (applyPipedriveRules)
- Simulação de webhook (pipedriveWebhook)
- Reprocessamento de logs com erro