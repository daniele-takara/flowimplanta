import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronDown, ChevronRight, Database, Shield, Server,
  Layers, FileText, Calendar, Link2,
  AlertTriangle, CheckCircle2, BookOpen, GitBranch, Users, Info
} from "lucide-react";

// ── Utility Components ───────────────────────────────────────────────────────

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-semibold text-slate-800 text-sm">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function Badge({ label, color = "slate" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color] || colors.slate}`}>{label}</span>;
}

function CritBadge({ c }) {
  return c === "Alta" ? <Badge label="Alta" color="red" />
    : c === "Média" ? <Badge label="Média" color="orange" />
    : <Badge label="Baixa" color="slate" />;
}

function FieldTable({ fields }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Campo</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">Tipo</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-3 py-1.5 font-mono text-blue-700 whitespace-nowrap">{f.name}</td>
              <td className="px-3 py-1.5 whitespace-nowrap"><Badge label={f.type || "—"} /></td>
              <td className="px-3 py-1.5 text-slate-600">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section: Visão Geral ─────────────────────────────────────────────────────

function VisaoGeral() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2">Flowimplanta</h2>
        <p className="text-blue-100 text-sm mb-4">Sistema de Gestão de Implantação Pontotel — Documentação Técnica Oficial v2.0 · 2026-04-29</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[["16", "Entidades"], ["9", "Funções Backend"], ["10", "Páginas"], ["4", "Integrações"]].map(([v, l]) => (
            <div key={l} className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{v}</div>
              <div className="text-blue-200 text-xs mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" />Problema Resolvido</h3>
          <p className="text-sm text-slate-600">Gerenciar o ciclo completo de implantação do sistema de ponto Pontotel em clientes empresariais — desde a criação do projeto via CRM Pipedrive até o encerramento com assinatura digital, passando por escopo técnico, cronograma automático, status reports, plano de ação e documentação (TAP + Termo de Encerramento).</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-green-500" />Perfis de Usuário</h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <p><strong>Gerentes de Projeto:</strong> criam projetos, TAP e Status Report</p>
            <p><strong>Analistas de Implantação:</strong> escopo técnico, cronograma, plano de ação</p>
            <p><strong>Administradores:</strong> perfis RBAC, templates, adendos, integrações</p>
            <p><strong>Viewers:</strong> acesso somente leitura</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-800 mb-4">Stack Tecnológico</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { cat: "Frontend", items: ["React 18 + Vite", "Tailwind CSS", "shadcn/ui", "react-router-dom v6", "@tanstack/react-query", "framer-motion", "recharts"] },
            { cat: "Backend", items: ["Base44 BaaS", "Deno Deploy (funções)", "@base44/sdk@0.8.25", "Deno.serve()"] },
            { cat: "Banco de Dados", items: ["Base44 NoSQL gerenciado", "16 entidades", "RBAC via PermissionProfile"] },
            { cat: "Integrações", items: ["Pipedrive CRM API v1", "Google Sheets OAuth", "D4Sign (parcial)", "Base44 Auth"] },
          ].map(s => (
            <div key={s.cat} className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-2">{s.cat}</p>
              {s.items.map(i => <p key={i} className="text-xs text-slate-500 py-0.5">• {i}</p>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section: Arquitetura ─────────────────────────────────────────────────────

function Arquitetura() {
  const layers = [
    { label: "USUÁRIO (Browser)", color: "bg-purple-50 border-purple-200", items: ["React SPA (Vite)", "10 páginas ~30 componentes", "AuthContext + RBAC hooks", "localStorage (schedule overrides)"] },
    { label: "FRONTEND — PÁGINAS", color: "bg-blue-50 border-blue-200", items: ["Dashboard", "ProjectList", "ProjectDetail", "Parametrizacoes", "FluxoProjeto", "DiagnosticoPipedrive", "UsersPermissions", "NewProject", "RBACReport", "Documentacao"] },
    { label: "FRONTEND — COMPONENTES", color: "bg-cyan-50 border-cyan-200", items: ["OverviewTab", "ScheduleTab", "ScopeTab", "TAPTab", "StatusReportTab", "ActionPlanTab", "ClosureTab", "TermoEncerramentoTab", "TabIntegracaoPipedrive", "AppLayout", "Sidebar", "ProtectedRoute"] },
    { label: "LIBS / MOTORES (client-side)", color: "bg-green-50 border-green-200", items: ["scheduleEngine.js — computeSchedule, workday, evaluateCondition", "scheduleTasks.js — 76 tasks, PHASE_ORDER, ANCHOR_IDS", "scheduleReportEngine.js — computeMacroSchedule", "tapTemplate.js — buildEntregas, buildModulosStatus", "scopeTemplate.js — 9 módulos, ~68 questões", "resolveResponsibleRole.js, permissions.js, usePermissions.js"] },
    { label: "BACKEND — FUNÇÕES DENO", color: "bg-orange-50 border-orange-200", items: ["syncPipedriveData", "syncScheduleFromPipedrive", "savePipedriveRules", "pipedriveWebhook", "getPipedriveDeals", "getClientUsability", "deleteProject", "testPipedriveDeal", "readSheetMapping / readSheetReport"] },
    { label: "BASE44 BaaS", color: "bg-slate-100 border-slate-300", items: ["Autenticação JWT", "16 Entidades NoSQL", "SDK @base44/sdk@0.8.25", "Shared Connectors (googlesheets)"] },
    { label: "APIs EXTERNAS", color: "bg-red-50 border-red-200", items: ["Pipedrive CRM REST v1 (API Token)", "Google Sheets API v4 (OAuth Bearer)", "D4Sign (parcialmente implementado)"] },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Arquitetura em camadas. Dados fluem: Pipedrive → Backend → Banco → Frontend.</p>
      {layers.map((l, i) => (
        <div key={i} className={`border rounded-xl p-4 ${l.color}`}>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">{l.label}</p>
          <div className="flex flex-wrap gap-2">
            {l.items.map(item => <span key={item} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-700">{item}</span>)}
          </div>
        </div>
      ))}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-800 mb-3">Fluxo de Dados Principal</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {["Pipedrive Deal", "→", "NewProject", "→", "Project (Base44)", "→", "syncPipedriveData", "→", "Project (completo)", "→", "SchedulePhase (auto)", "→", "ScheduleTab", "→", "syncScheduleFromPipedrive", "→", "ScheduleActivity"].map((s, i) => (
            <span key={i} className={s === "→" ? "text-slate-400" : "bg-slate-100 px-2 py-1 rounded font-medium text-slate-700"}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section: Entidades ───────────────────────────────────────────────────────

function Entidades() {
  const entities = [
    {
      name: "Project", critical: true,
      desc: "Entidade central. Representa um projeto de implantação. Vinculada ao deal Pipedrive via pipedrive_deal_id.",
      fields: [
        { name: "pipedrive_deal_id", type: "number", desc: "ID do deal — chave de vínculo CRM" },
        { name: "status", type: "enum", desc: "Planejamento | Em andamento | Em risco | Atrasado | Concluído | Cancelado" },
        { name: "current_phase", type: "enum", desc: "Abertura de projeto → Concluído" },
        { name: "contracted_modules", type: "array", desc: "Módulos contratados — guiam Escopo e Cronograma" },
        { name: "contracted_services", type: "array", desc: "Serviços adicionais" },
        { name: "progress_percent", type: "number", desc: "Progresso geral 0-100%" },
        { name: "pontotel_manager_name / analyst_name", type: "string", desc: "Equipe Pontotel" },
        { name: "sponsor / project_leader / operation / ti_client", type: "string", desc: "Equipe do cliente" },
        { name: "lar21", type: "string", desc: "Campo customizado Pipedrive/Org" },
      ],
    },
    {
      name: "ScheduleActivity", critical: true,
      desc: "Atividade detalhada do cronograma. Criada via UI ou automaticamente pelo sync Pipedrive.",
      fields: [
        { name: "project_id", type: "string", desc: "FK para Project" },
        { name: "phase_name", type: "string", desc: "Match com SchedulePhase.phase_name" },
        { name: "activity_name", type: "string", desc: "Match com SCHEDULE_TASKS[].activity" },
        { name: "actual_start / actual_end", type: "date", desc: "Datas executadas — nunca sobrescritas automaticamente se já preenchidas" },
        { name: "status", type: "enum", desc: "Não iniciado | Em andamento | Concluído | Atrasado | Bloqueado | Cancelado" },
        { name: "responsible_role", type: "enum", desc: "gerente_projeto | analista_implantacao | patrocinador | lider_projeto | ti | operacao" },
      ],
    },
    {
      name: "PipedriveIntegrationRule", critical: true,
      desc: "Regras de integração Pipedrive→Base44, sincronizadas da planilha Google Sheets. Duas abas: dados_iniciais e cronograma.",
      fields: [
        { name: "rule_type", type: "enum", desc: "dados_iniciais | cronograma" },
        { name: "pipedrive_entidade", type: "string", desc: "deal | activity" },
        { name: "pipedrive_campo_key / valor_disparo", type: "string", desc: "Campo e valor que disparam a regra (ex: stage_id=142)" },
        { name: "base44_fase / base44_atividade", type: "string", desc: "Destino no cronograma Base44" },
        { name: "faz_inicio / faz_fim", type: "boolean", desc: "Se preenche início/fim executado" },
      ],
    },
    {
      name: "SchedulePhase",
      desc: "Fase macro do cronograma. Criada automaticamente ao criar o projeto.",
      fields: [
        { name: "phase_name", type: "enum", desc: "Abertura de projeto | Parametrização | Homologação | Rollout | Go-live | Pós Go-live" },
        { name: "planned_start/end / actual_start/end", type: "date", desc: "Datas planejadas e executadas da fase" },
        { name: "progress_percent", type: "number", desc: "Progresso 0-100%" },
      ],
    },
    {
      name: "PermissionProfile", critical: true,
      desc: "Perfil de permissões RBAC customizável. Vinculado ao usuário via permission_profile_id.",
      fields: [
        { name: "name", type: "string", desc: "Admin | Gestor de Projetos | Implantação | Viewer" },
        { name: "permissions{}", type: "object", desc: "18 flags booleanas: projetos_ver, escopo_editar, cronograma_editar, tap_editar, termo_pdf, parametrizacoes_acessar..." },
        { name: "is_default", type: "boolean", desc: "Perfil padrão para novos usuários" },
      ],
    },
    {
      name: "ScopeItem",
      desc: "Item do Escopo Técnico. A chave qXXX (order_number) controla visibilidade de tasks no cronograma.",
      fields: [
        { name: "order_number", type: "number", desc: "Número da questão → gera chave qXXX no motor de cronograma" },
        { name: "answer", type: "string", desc: "Resposta preenchida pelo analista" },
        { name: "field_type", type: "enum", desc: "text | select | boolean | number | date" },
      ],
    },
    {
      name: "TAPVersion / TermoEncerramento",
      desc: "Documentos do projeto com versões. TermoEncerramento suporta assinatura digital D4Sign.",
      fields: [
        { name: "version_number / is_current", type: "number/bool", desc: "Controle de versão" },
        { name: "auto_data_snapshot / schedule_snapshot", type: "JSON", desc: "Snapshots automáticos dos dados" },
        { name: "d4sign_document_id / status_assinatura", type: "string/enum", desc: "Integração D4Sign no TermoEncerramento" },
        { name: "selected_adendos", type: "array", desc: "IDs de Adendos incluídos no Termo" },
      ],
    },
    {
      name: "StatusReport / ActionPlan / Meeting",
      desc: "Entidades de acompanhamento do projeto.",
      fields: [
        { name: "StatusReport.macro_schedule", type: "JSON", desc: "Snapshot das fases macro calculadas por computeMacroSchedule" },
        { name: "StatusReport.general_status", type: "enum", desc: "No prazo | Em risco | Atrasado | Concluído" },
        { name: "ActionPlan.type", type: "enum", desc: "Erro | Melhoria | Dúvida | Pendência | Risco" },
        { name: "ActionPlan.status_pontotel / status_client", type: "enum", desc: "Status independente por parte" },
      ],
    },
    {
      name: "ClientUsability / Adendo / Assinatura / ScheduleTemplate",
      desc: "Entidades de configuração e dados de usabilidade.",
      fields: [
        { name: "ClientUsability.empregados_batendo_ponto_ultimos_15_dias", type: "number", desc: "KPI de adesão ao sistema" },
        { name: "Adendo.type", type: "enum", desc: "Jurídico | Técnico | Comercial — cláusulas reutilizáveis no Termo" },
        { name: "Assinatura.role", type: "enum", desc: "Coordenadora de implantação | Líder de implantação" },
        { name: "ScheduleTemplate.tasks_config", type: "JSON", desc: "Overrides de responsible_role por task do cronograma" },
      ],
    },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">16 entidades. Todos os registros têm built-in: <code className="bg-slate-100 px-1 rounded">id, created_date, updated_date, created_by</code>.</p>
      {entities.map(e => (
        <Collapsible key={e.name} title={<span className="flex items-center gap-2"><span className="font-mono text-blue-700">{e.name}</span>{e.critical && <Badge label="Crítica" color="red" />}</span>} defaultOpen={!!e.critical}>
          <p className="text-sm text-slate-600 mb-3">{e.desc}</p>
          <FieldTable fields={e.fields} />
        </Collapsible>
      ))}
    </div>
  );
}

// ── Section: Funções Backend ─────────────────────────────────────────────────

function Funcoes() {
  const funcs = [
    {
      name: "syncPipedriveData", crit: "Alta",
      desc: "Sincroniza deal Pipedrive → Project Base44. Atualiza nome, cliente, datas, analista, gerente, origem, lar21, módulos.",
      params: "{ project_id, deal_id }",
      returns: "{ success, updated_fields[], project }",
      calledFrom: "OverviewTab — botão 'Atualizar dados do Pipedrive'",
      risk: "Campos customizados com chaves hash fixas. Se o Pipedrive recriar o campo, quebra silenciosamente.",
    },
    {
      name: "syncScheduleFromPipedrive", crit: "Alta",
      desc: "Aplica regras PipedriveIntegrationRule ao cronograma. Compara stage_id e activities concluídas. Preenche actual_start/end. Se fase existe sem atividades, CRIA a atividade automaticamente.",
      params: "{ project_id }",
      returns: "{ ok, updated, created, activities[], activities_created[], match_errors[], available_phases[] }",
      calledFrom: "ScheduleTab — botão 'Atualizar Cronograma (Pipedrive)'",
      risk: "Rate limit 429. Normalização de fases pode falhar se grafia variar.",
    },
    {
      name: "savePipedriveRules", crit: "Alta",
      desc: "Lê planilha Google Sheets (2 abas). APAGA TODAS as PipedriveIntegrationRule e recria do zero.",
      params: "{}",
      returns: "{ ok, dados_iniciais.count, cronograma.count, deleted }",
      calledFrom: "TabIntegracaoPipedrive — botão 'Atualizar regras da planilha'",
      risk: "Operação DESTRUTIVA sem rollback. Se Sheets offline durante criação, banco fica sem regras.",
    },
    {
      name: "pipedriveWebhook", crit: "Alta",
      desc: "Receptor de webhooks Pipedrive (updated.deal e updated.activity). Carrega regras da planilha em TEMPO REAL (diferente do sync que usa banco).",
      params: "Payload webhook: { event, current{}, previous{}, meta{} }",
      returns: "{ ok, event, deal_id, updated, activities[] }",
      calledFrom: "Webhook externo → URL pública da função",
      risk: "Lê planilha em tempo real (lento, diferente do syncSchedule que usa cache banco). Inconsistência potencial.",
    },
    {
      name: "getPipedriveDeals", crit: "Média",
      desc: "Busca deals abertos dos pipelines 16 e 10, enriquece com org e campos customizados.",
      params: "{}",
      returns: "{ deals[], total }",
      calledFrom: "PipedriveModal em ProjectList",
      risk: "Pipelines alvo hardcoded (IDs 16 e 10). Rate limit com muitos deals.",
    },
    {
      name: "getClientUsability", crit: "Média",
      desc: "Busca KPIs do cliente na planilha de usabilidade. Match fuzzy por client_name. Cria/atualiza ClientUsability.",
      params: "{ project_id, client_name }",
      returns: "{ data: UsabilityData }",
      calledFrom: "UsabilitySection no ProjectDetail",
      risk: "Match fuzzy pode retornar dado errado com homônimos.",
    },
    {
      name: "deleteProject", crit: "Alta",
      desc: "Exclusão segura com verificação backend: admin ou projetos_excluir=true. NÃO afeta Pipedrive.",
      params: "{ project_id }",
      returns: "{ success, deleted_project_id }",
      calledFrom: "DeleteProjectDialog em ProjectList",
      risk: "NÃO exclui entidades filhas — ScheduleActivity, ScopeItem, etc. ficam órfãs.",
    },
    {
      name: "testPipedriveDeal / readSheetMapping / readSheetReport", crit: "Baixa",
      desc: "Funções de diagnóstico e debug para Pipedrive e Google Sheets.",
      params: "Variados",
      returns: "Dados de diagnóstico",
      calledFrom: "DiagnosticoPipedrive page / desenvolvimento",
      risk: "Sem controle de acesso — qualquer usuário autenticado pode chamar.",
    },
  ];

  return (
    <div className="space-y-3">
      {funcs.map(f => (
        <Collapsible key={f.name} title={<span className="flex items-center gap-2"><span className="font-mono text-orange-700 text-sm">{f.name}</span><CritBadge c={f.crit} /></span>} defaultOpen={f.crit === "Alta"}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">{f.desc}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div><span className="font-semibold text-slate-500 uppercase">Parâmetros: </span><code className="text-slate-700">{f.params}</code></div>
              <div><span className="font-semibold text-slate-500 uppercase">Retorno: </span><code className="text-slate-700">{f.returns}</code></div>
              <div><span className="font-semibold text-slate-500 uppercase">Chamado de: </span><span className="text-slate-600">{f.calledFrom}</span></div>
            </div>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
              <strong>⚠ Risco: </strong>{f.risk}
            </div>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}

// ── Section: Motor Cronograma ────────────────────────────────────────────────

function CronogramaMotor() {
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-800 mb-2">Motor de Cronograma (scheduleEngine.js)</h3>
        <p className="text-sm text-amber-700">Sistema de cálculo automático de datas baseado em 76 tasks (scheduleTasks.js). Executa no frontend via useMemo. Suporta dias úteis com feriados nacionais 2024-2026.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="font-bold text-slate-700 text-sm mb-3">Tipos de Data por Task</h4>
          <div className="space-y-2 text-sm">
            {[
              ["amber", "anchor", "Editável pelo usuário. Propaga para dependentes. Salvo em localStorage."],
              ["blue", "calculated", "Calculada por fórmula (workday, sameDay). Somente leitura."],
              ["green", "manual_override", "Editável mas não propaga para outros tasks."],
            ].map(([c, label, desc]) => (
              <div key={label} className="flex items-start gap-2">
                <span className={`w-3 h-3 rounded-full bg-${c}-400 mt-1 shrink-0`} />
                <div><strong>{label}:</strong> {desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="font-bold text-slate-700 text-sm mb-3">Fórmulas Suportadas</h4>
          <div className="space-y-1.5">
            {[
              "workday(ref.field, N) — adiciona N dias úteis",
              "sameDay(ref) — mesma data que referência",
              "taskId.plannedStart — referência direta",
            ].map(f => <p key={f} className="text-xs font-mono bg-slate-50 p-2 rounded text-slate-700">{f}</p>)}
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="font-bold text-slate-700 text-sm mb-3">5 Âncoras (Datas de Entrada Obrigatórias)</h4>
        <div className="space-y-2">
          {[
            ["alinhamento_inicial", "Alinhamento Inicial — âncora principal do projeto"],
            ["go_live_registro_ponto", "Go Live Registro de Ponto — go-live operacional"],
            ["agenda_fechamento_folha", "Fechamento de Folha — início do ciclo de fechamento"],
            ["expansao_registro_ponto_real", "Expansão Real — expansão para 100% da base"],
            ["agenda_encerramento_projeto", "Encerramento — encerramento formal do projeto"],
          ].map(([id, desc]) => (
            <div key={id} className="flex items-start gap-3 p-2 bg-amber-50 rounded-lg">
              <span className="text-xs font-mono text-amber-700 shrink-0 mt-0.5">{id}</span>
              <p className="text-xs text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="font-bold text-slate-700 text-sm mb-3">9 Fases do Cronograma (76 tasks total)</h4>
        <div className="flex flex-wrap gap-2">
          {["Abertura de projeto", "Integração (Sankhya)", "Cadastros", "Parametrização", "Treinamento e Validações", "Operação Assistida", "Fechamento de Folha", "Expansão", "Encerramento"].map(p => (
            <Badge key={p} label={p} color="blue" />
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="font-bold text-slate-700 text-sm mb-2">Visibilidade Condicional (evaluateCondition)</h4>
        <p className="text-xs text-slate-500 mb-3">Tasks filtradas por escopo técnico (answersMap qXXX) e módulos contratados do projeto.</p>
        <div className="space-y-1 text-xs font-mono">
          {[
            `visibleWhen: "always" — sempre visível`,
            `visibleWhen: {source: 'escopo.q006', equals: 'Sim'}`,
            `visibleWhen: {source: 'dados_iniciais.modulos_contratados', contains: 'Timesheet'}`,
            `visibleWhenAny: [...] — OR lógico`,
            `visibleWhenAll: [...] — AND lógico`,
          ].map(f => <p key={f} className="bg-slate-50 p-2 rounded text-slate-700">{f}</p>)}
        </div>
      </div>
    </div>
  );
}

// ── Section: Integrações ─────────────────────────────────────────────────────

function Integracoes() {
  return (
    <div className="space-y-4">
      <Collapsible title="Pipedrive CRM (REST API v1)" defaultOpen>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 mb-2"><Badge label="Externa REST" color="orange" /><Badge label="API Token — env: API_PIpedrive" color="slate" /></div>
          <p className="text-slate-600"><strong>Finalidade:</strong> Importação de dados de deals, enriquecimento com organizações e sincronização de datas no cronograma.</p>
          <div>
            <p className="font-semibold text-slate-500 text-xs uppercase mb-1">Endpoints Utilizados:</p>
            {["GET /v1/deals/:id", "GET /v1/deals/:id/activities (paginado)", "GET /v1/organizations/:id", "GET /v1/dealFields (mapeamento ENUMs)", "GET /v1/pipelines/:id/deals (lista por pipeline)"].map(e => <p key={e} className="text-xs font-mono bg-slate-50 p-1.5 rounded mb-1 text-slate-700">{e}</p>)}
          </div>
          <p className="text-xs"><strong>Webhook:</strong> <code className="bg-slate-100 px-1 rounded">POST /functions/pipedriveWebhook</code> — eventos updated.deal e updated.activity</p>
          <p className="text-xs bg-amber-50 p-2 rounded text-amber-700">⚠ Campos customizados com chaves hash fixas hardcoded: 30e71cb... (gerente), 88d64f... (aligned_end_date), 64fcc8... (canal/org), a5301f... (lar21), a7cf02... (módulos). Pipelines alvo: IDs 16 e 10.</p>
        </div>
      </Collapsible>

      <Collapsible title="Google Sheets (OAuth Shared Connector)" defaultOpen>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 mb-2"><Badge label="Shared Connector OAuth" color="green" /></div>
          <p className="text-slate-600"><strong>Auth:</strong> <code className="bg-slate-100 px-1 rounded text-xs">base44.asServiceRole.connectors.getConnection('googlesheets')</code></p>
          <div>
            <p className="font-semibold text-slate-500 text-xs uppercase mb-1">Planilhas:</p>
            <p className="text-xs bg-slate-50 p-2 rounded mb-1 text-slate-600"><strong>Integração:</strong> 1_NAnD5FYHpnkLkIRIf6YYsOor0jBJzgKrCnxZZoIKm4 — regras Pipedrive (2 abas)</p>
            <p className="text-xs bg-slate-50 p-2 rounded text-slate-600"><strong>Usabilidade:</strong> 1wZ4iu-h61qJgiYkHy8vTbCO3kBPAoNeJlSpsvtOw_u8 — KPIs de clientes</p>
          </div>
          <p className="text-xs bg-red-50 p-2 rounded text-red-700">⚠ Sem retry. Falha na leitura → exceção propagada. Se sheets offline durante savePipedriveRules → banco fica sem regras.</p>
        </div>
      </Collapsible>

      <Collapsible title="D4Sign (Assinatura Digital)">
        <div className="text-sm space-y-2">
          <Badge label="Parcialmente implementado — GAP" color="red" />
          <p className="text-slate-600">As entidades TermoEncerramento têm campos d4sign_document_id, status_assinatura, link_assinatura. Porém nenhuma função backend de integração com a API D4Sign foi encontrada no código.</p>
          <p className="text-xs bg-amber-50 p-2 rounded text-amber-700">⚠ GAP: implementar função backend para criar documento D4Sign, adicionar signatários e obter link de assinatura.</p>
        </div>
      </Collapsible>
    </div>
  );
}

// ── Section: Regras de Negócio ───────────────────────────────────────────────

function RegrasNegocio() {
  const rules = [
    { id: "R01", name: "Projeto criado pelo ID deal", cond: "Usuário informa pipedrive_deal_id", action: "Cria Project básico + SchedulePhases (SCHEDULE_TEMPLATE)" },
    { id: "R02", name: "Datas executadas nunca auto-preenchidas", cond: "Sempre", action: "actual_start/end só preenchidos por ação explícita do usuário ou sync Pipedrive" },
    { id: "R03", name: "Datas existentes nunca sobrescritas (Pipedrive)", cond: "actual_start ou actual_end já preenchido", action: "Ignora — não sobrescreve data já existente" },
    { id: "R04", name: "Fase não encontrada → match_error", cond: "Regra aponta para fase inexistente no projeto", action: "Adiciona à lista match_errors, não interrompe loop" },
    { id: "R05", name: "Fase sem atividades → cria automaticamente", cond: "SchedulePhase existe, ScheduleActivity vazia, regra com atividade específica e data disponível", action: "Cria ScheduleActivity automaticamente com dados do Pipedrive" },
    { id: "R06", name: "Rate limit 429 → erro explícito", cond: "HTTP 429 recebido do Pipedrive", action: "Lança erro 'Rate limit. Aguarde alguns minutos.' (syncPipedriveData tem retry 3x)" },
    { id: "R07", name: "Exclusão requer permissão backend", cond: "Usuário aciona delete", action: "Verifica role=admin ou projetos_excluir=true no perfil. 403 se não" },
    { id: "R08", name: "Motor cronograma é síncrono no frontend", cond: "scopeItems ou manualOverrides mudam", action: "computeSchedule recalcula tudo via useMemo. Overrides em localStorage por projectId" },
    { id: "R09", name: "Módulos contratados controlam escopo e cronograma", cond: "contractedModules[] do projeto", action: "Filtra módulos do Escopo Técnico e tasks do Cronograma Detalhado" },
    { id: "R10", name: "RBAC: perfil > role de sistema", cond: "Usuário tem permission_profile_id", action: "Usa permissões do perfil. Sem perfil + role=admin → acesso total. Sem perfil + outros → acesso zero" },
    { id: "R11", name: "pipedriveWebhook lê planilha em tempo real", cond: "Webhook recebido", action: "Lê Google Sheets a cada chamada — diferente do sync que usa cache (PipedriveIntegrationRule)" },
    { id: "R12", name: "savePipedriveRules: apagar e recriar tudo", cond: "Admin clica 'Atualizar regras'", action: "Deleta TODAS as PipedriveIntegrationRule e bulkCreate novo conjunto" },
    { id: "R13", name: "stage_id tratado como string", cond: "Sempre na comparação", action: "String(deal.stage_id) para evitar comparação int vs string" },
    { id: "R14", name: "Cronograma macro = média das fases micro", cond: "Para StatusReport e TAP", action: "overallProgress = média aritmética dos progressos das fases macro (computeMacroSchedule)" },
    { id: "R15", name: "Normalização de strings nas comparações", cond: "Fase/atividade matching", action: "trim + lowercase + remove acentos via normalize('NFD')" },
  ];
  return (
    <div className="space-y-2">
      {rules.map(r => (
        <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded shrink-0 mt-0.5">{r.id}</span>
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-1">{r.name}</p>
              <p className="text-xs text-slate-500 mb-0.5"><strong>Condição:</strong> {r.cond}</p>
              <p className="text-xs text-slate-600"><strong>Ação:</strong> {r.action}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: RBAC ────────────────────────────────────────────────────────────

function RBAC() {
  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-800 mb-3">Fluxo de Resolução de Permissões</h3>
        <div className="space-y-2 text-sm">
          {[
            "AuthContext carrega usuário via base44.auth.me()",
            "Se user.permission_profile_id → busca PermissionProfile e injeta em user._resolvedProfile",
            "usePermissions() chama resolvePermissions(user, profile)",
            "Prioridade: perfil vinculado > role=admin (tudo true) > nada (Viewer)",
            "Permissões expostas via canCreateProject, canEditSchedule, canAccessParametrizacoes...",
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
              <span className="text-slate-600">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {[
          { name: "Admin", desc: "Acesso total. Equivalente a role=admin.", perms: "Todas as 18 flags true" },
          { name: "Gestor de Projetos", desc: "Cria e gerencia projetos, TAP, Status Report. Sem Parametrizações.", perms: "projetos CRUD (sem excluir), dados_iniciais rw, escopo rw, cronograma rw, tap rw, status_report rw, termo (ver+pdf)" },
          { name: "Implantação", desc: "Edita execução: escopo, cronograma, status report. Sem criar projetos.", perms: "projetos_ver, escopo rw, cronograma rw, status_report rw, tap_ver" },
          { name: "Viewer", desc: "Somente leitura.", perms: "projetos_ver, dados_iniciais_ver, escopo_ver, cronograma_ver, tap_ver, status_report_ver, termo_ver" },
        ].map(p => (
          <Collapsible key={p.name} title={p.name}>
            <p className="text-sm text-slate-600 mb-2">{p.desc}</p>
            <p className="text-xs bg-slate-50 p-2 rounded text-slate-700 font-mono">{p.perms}</p>
          </Collapsible>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-800 mb-3 text-sm">18 Flags de Permissão</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {["projetos_ver", "projetos_criar", "projetos_editar", "projetos_excluir", "dados_iniciais_ver", "dados_iniciais_editar", "escopo_ver", "escopo_editar", "cronograma_ver", "cronograma_editar", "tap_ver", "tap_editar", "status_report_ver", "status_report_editar", "termo_ver", "termo_pdf", "parametrizacoes_acessar", "parametrizacoes_editar"].map(p => (
            <span key={p} className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section: Fluxo Operacional ───────────────────────────────────────────────

function Fluxo() {
  const steps = [
    { n: 1, label: "Deal no Pipedrive", desc: "Deal aberto nos pipelines 16 (Impl M, G e GG) ou 10 (Acomp - Morfeu).", actor: "Comercial" },
    { n: 2, label: "Criação do Projeto", desc: "Usuário informa o pipedrive_deal_id. Sistema cria Project básico + SchedulePhases automaticamente.", actor: "Gestor" },
    { n: 3, label: "Sync Dados Iniciais", desc: "'Atualizar dados do Pipedrive': syncPipedriveData busca deal, org, campos customizados e atualiza o projeto.", actor: "Gestor / Sistema" },
    { n: 4, label: "Escopo Técnico", desc: "Analista preenche questionário (9 módulos, ~68 questões). Respostas controlam cronograma e entregas da TAP.", actor: "Analista" },
    { n: 5, label: "Cronograma Detalhado", desc: "Motor computeSchedule() calcula datas a partir das âncoras. Analista define âncoras e o sistema propaga.", actor: "Analista / Motor" },
    { n: 6, label: "TAP", desc: "Gestor gera Termo de Abertura com dados automáticos do escopo. Múltiplas versões.", actor: "Gestor" },
    { n: 7, label: "Execução + Sync Automático", desc: "Atividades concluídas no Pipedrive → webhook dispara → cronograma atualizado automaticamente.", actor: "Analista / Webhook" },
    { n: 8, label: "Status Report", desc: "Relatório com progresso calculado pelo motor macro, riscos, pendências e agenda.", actor: "Analista / Gestor" },
    { n: 9, label: "Plano de Ação", desc: "Issues, erros e pendências registrados com status por parte (Pontotel/Cliente).", actor: "Analista" },
    { n: 10, label: "Encerramento", desc: "Termo de Encerramento com adendos → assinatura digital D4Sign → projeto Concluído.", actor: "Gestor / D4Sign" },
  ];
  return (
    <div className="relative space-y-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex gap-4 mb-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">{s.n}</div>
            {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 my-1 min-h-4" />}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-sm">{s.label}</span>
              <Badge label={s.actor} color="blue" />
            </div>
            <p className="text-sm text-slate-600">{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Diagnóstico ─────────────────────────────────────────────────────

function Diagnostico() {
  const issues = [
    { crit: "Alta", tipo: "Bug Latente", titulo: "pipedriveWebhook usa planilha em tempo real; syncSchedule usa cache banco", desc: "Duas funções com lógica similar mas fontes diferentes. Podem gerar comportamentos inconsistentes.", rec: "Unificar: pipedriveWebhook também deve usar PipedriveIntegrationRule (cache banco) para consistência." },
    { crit: "Alta", tipo: "Risco Operacional", titulo: "Campos customizados Pipedrive hardcoded por chave hash", desc: "gerente_projeto usa chave '30e71cb...'. Se o campo for recriado no Pipedrive, a sync quebra silenciosamente.", rec: "Criar configuração centralizada ou entidade para mapear chaves de campos." },
    { crit: "Alta", tipo: "Gap de Segurança", titulo: "deleteProject não exclui entidades filhas", desc: "Remove apenas o Project. ScheduleActivity, ScopeItem, StatusReport etc. ficam órfãs com project_id inválido.", rec: "Implementar exclusão em cascata no backend." },
    { crit: "Alta", tipo: "Risco Operacional", titulo: "savePipedriveRules é destrutiva sem rollback", desc: "Apaga tudo e recria. Se Google Sheets indisponível durante criação, banco fica sem regras.", rec: "Criar primeiro, apagar as antigas somente após sucesso total." },
    { crit: "Média", tipo: "Débito Técnico", titulo: "manualOverrides do cronograma em localStorage", desc: "Datas âncora/manuais ficam no localStorage. Se o usuário trocar de máquina, perde os overrides.", rec: "Migrar para banco (nova entidade ou campo no projeto)." },
    { crit: "Média", tipo: "Gap de Implementação", titulo: "D4Sign sem função backend", desc: "Campos D4Sign existem nas entidades mas nenhuma função backend de integração foi implementada.", rec: "Implementar função backend para criar documento, adicionar signatários e obter link." },
    { crit: "Média", tipo: "Débito Técnico", titulo: "ScheduleTab com 776 linhas — arquivo monolito", desc: "Contém 5+ componentes internos. Difícil de manter e testar.", rec: "Separar em: TaskRow.jsx, PhaseSection.jsx, SyncPipedriveButton.jsx." },
    { crit: "Média", tipo: "Risco Operacional", titulo: "Rate limit Pipedrive sem controle global", desc: "Múltiplas chamadas simultâneas podem atingir rate limit rapidamente.", rec: "Implementar throttle global ou aviso na UI sobre intervalo mínimo." },
    { crit: "Baixa", tipo: "Débito Técnico", titulo: "MOCK_PROJECTS em mockData.js não removidos", desc: "Dados fictícios ainda no código (proj-001 a proj-005). Causam confusão em debug.", rec: "Remover ou mover para pasta de fixtures de teste." },
    { crit: "Baixa", tipo: "Melhoria", titulo: "Funções de debug expostas sem controle de acesso", desc: "readSheetReport, readSheetMapping e testPipedriveDeal sem verificação de role.", rec: "Adicionar verificação user.role === 'admin'." },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[["Alta", "red", issues.filter(i => i.crit === "Alta").length], ["Média", "orange", issues.filter(i => i.crit === "Média").length], ["Baixa", "slate", issues.filter(i => i.crit === "Baixa").length]].map(([label, color, count]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold text-${color}-600`}>{count}</div>
            <div className="text-xs text-slate-500 mt-1">Criticidade {label}</div>
          </div>
        ))}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />O que está bem estruturado</h3>
        <div className="text-sm text-green-700 space-y-1">
          {[
            "Motor de cronograma puro e testável (sem side effects, useMemo)",
            "RBAC robusto com perfis customizáveis e fallback por role de sistema",
            "Proteção de datas existentes (nunca sobrescreve)",
            "Regras Pipedrive em banco (cache) com sync controlado",
            "Tratamento explícito de rate limit 429 com mensagem clara",
            "deleteProject com verificação de permissão no backend",
            "Normalização de strings com trim + lowercase + sem acentos",
            "Criação automática de ScheduleActivity quando fase existe sem atividades",
          ].map(s => <p key={s}>✓ {s}</p>)}
        </div>
      </div>

      {["Alta", "Média", "Baixa"].map(nivel => (
        <div key={nivel}>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><CritBadge c={nivel} /> Criticidade {nivel}</h3>
          <div className="space-y-3">
            {issues.filter(i => i.crit === nivel).map((issue, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${nivel === "Alta" ? "text-red-500" : nivel === "Média" ? "text-orange-500" : "text-slate-400"}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{issue.titulo}</span>
                      <Badge label={issue.tipo} />
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{issue.desc}</p>
                    <div className="bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-700">
                      <strong>Recomendação: </strong>{issue.rec}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "visao_geral", label: "Visão Geral", icon: BookOpen, component: VisaoGeral },
  { id: "arquitetura", label: "Arquitetura Técnica", icon: Layers, component: Arquitetura },
  { id: "entidades", label: "Entidades / Banco", icon: Database, component: Entidades },
  { id: "funcoes", label: "Funções Backend", icon: Server, component: Funcoes },
  { id: "cronograma", label: "Motor de Cronograma", icon: Calendar, component: CronogramaMotor },
  { id: "integracoes", label: "Integrações", icon: Link2, component: Integracoes },
  { id: "regras", label: "Regras de Negócio", icon: FileText, component: RegrasNegocio },
  { id: "rbac", label: "Segurança / RBAC", icon: Shield, component: RBAC },
  { id: "fluxo", label: "Fluxo Operacional", icon: GitBranch, component: Fluxo },
  { id: "diagnostico", label: "Diagnóstico Técnico", icon: AlertTriangle, component: Diagnostico },
];

export default function Documentacao() {
  const [activeSection, setActiveSection] = useState("visao_geral");

  const current = SECTIONS.find(s => s.id === activeSection);
  const SectionComponent = current?.component;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <Link to="/parametrizacoes" className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-xs mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Flowimplanta</p>
              <p className="text-xs text-slate-400">Documentação Técnica</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${activeSection === s.id ? "bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 text-xs text-slate-400 text-center">
          v2.0 · 2026-04-29
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 z-10 px-8 py-4">
          <div className="flex items-center gap-3">
            {current && <current.icon className="w-5 h-5 text-blue-600" />}
            <h1 className="text-lg font-bold text-slate-800">{current?.label}</h1>
          </div>
        </div>
        <div className="p-8 max-w-5xl">
          {SectionComponent && <SectionComponent />}
        </div>
      </div>
    </div>
  );
}