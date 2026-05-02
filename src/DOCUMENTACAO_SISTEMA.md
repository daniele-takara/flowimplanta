# Flowimplanta — Documentação Técnica v4.0
**Última atualização:** 2026-04-30  
**Status:** Validado e corrigido (Staff Engineer Review)

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

**Regra imutável:** Datas existentes NUNCA são sobrescritas automaticamente.

**Definição de "campo vazio" (aplicada em actual_start e actual_end):**
```js
function isDateEmpty(val) {
  if (val == null) return true;          // null / undefined
  const s = String(val).trim();
  return s === "" || s === "—" || s === "–"; // string vazia ou travessão
}
```
Campos que retornam `true` em `isDateEmpty()` são tratados como sem valor e **podem ser preenchidos** pela integração. Apenas valores com data real (`"YYYY-MM-DD"`) bloqueiam a sobrescrita.

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
- **Chamada:** TabIntegracaoPipedrive
- **Auth:** Usuário logado
- **Entrada:** `{}`
- **Lógica:** Lê planilha Google Sheets (2 abas: dados_iniciais, cronograma) → DELETE ALL PipedriveIntegrationRule → bulkCreate novo conjunto
- ⚠️ **ATENÇÃO:** Operação destrutiva sem rollback. Criar antes de apagar é melhoria futura.

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
    ├─ Se actual_start já preenchido → IGNORA (nunca sobrescreve)
    └─ Se vazio → actual_start = deal[campo_data] ou current.update_time
                   status = "Em andamento"
```

### Fluxo: Fim Executado (actual_end)
```
Pipedrive: activity marcada como done → webhook change.activity
    │
    ├─ Verifica activity.done == true
    ├─ Localiza Project por pipedrive_deal_id
    ├─ Carrega regras cronograma (entidade=activity)
    ├─ Para cada activity done no deal:
    │   ├─ Tenta match exato: activity[campo_ident] == valor_ident
    │   └─ Se falhar, tenta match normalizado (sem acentos/case)
    │   └─ Log de skip se não corresponder
    ├─ Se match → busca ScheduleActivity pelo nome
    ├─ Se actual_end já preenchido → IGNORA
    └─ Se vazio → actual_end = activity.marked_as_done_time ou update_time
                   status = "Concluído"
```

### Criação Automática
Se a fase existe (SchedulePhase) mas ainda não tem ScheduleActivity e a regra aponta para atividade específica (`base44_atividade != "*"`), a atividade é **criada automaticamente** com as datas executadas.

### Curingas
- `base44_atividade = "*"` → aplica em **todas** as atividades da fase
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
- `lib/scheduleTasks.js` — 76 tasks + PHASE_ORDER + ANCHOR_IDS
- `lib/scheduleEngine.js` — computeSchedule, workday, evaluateCondition
- `lib/scheduleReportEngine.js` — computeMacroSchedule para StatusReport

### Tipos de Data
| Tipo | Comportamento |
|------|---------------|
| `anchor` | Editável pelo usuário. Propaga para dependentes. Salvo em `Project.schedule_anchor_dates` |
| `calculated` | Calculado por fórmula (workday, sameDay). Somente leitura |
| `manual_override` | Editável, não propaga |

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
- **Acesso:** ScheduleTab, StatusReportTab, computeMacroSchedule — todos leem do banco

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

### 18 Flags
`projetos_ver/criar/editar/excluir`, `dados_iniciais_ver/editar`, `escopo_ver/editar`, `cronograma_ver/editar`, `tap_ver/editar`, `status_report_ver/editar`, `termo_ver/pdf`, `parametrizacoes_acessar/editar`

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

## 9. PAYLOADS PIPEDRIVE ESPERADOS

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