import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Loader2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS } from "@/lib/resolveResponsibleRole.js";

function fmt(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

const norm = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

// Resolve o nome real do responsável líder a partir de múltiplas fontes
function resolveLeader(task, savedAct, templateConfig, project) {
  // 1. Atividade salva no banco (pode ser role key ou nome livre)
  let leader = savedAct?.responsible_leader || "";

  // 2. templateConfig da task
  if (!leader && templateConfig?.[task.id]?.responsible_role) {
    leader = templateConfig[task.id].responsible_role;
  }

  // 3. role embutida na task do SCHEDULE_TASKS
  if (!leader && task.responsibleRole) {
    leader = task.responsibleRole;
  }

  // Resolve role key → nome real
  if (leader && RESPONSIBLE_ROLE_LABELS[leader]) {
    const resolved = resolveRoleToName(leader, project);
    return resolved
      ? `${resolved} (${RESPONSIBLE_ROLE_LABELS[leader]})`
      : RESPONSIBLE_ROLE_LABELS[leader];
  }
  return leader || "—";
}

// Constrói o contexto rico do projeto para o agente
function buildProjectContext(project, computedDates, savedActivities, templateConfig) {
  if (!project) return "";

  // Equipe
  const equipe = [
    project.pontotel_manager_name  && `- Gerente de Projetos Pontotel: **${project.pontotel_manager_name}**`,
    project.pontotel_analyst_name  && `- Analista de Implantação Pontotel: **${project.pontotel_analyst_name}**`,
    project.sponsor_name           && `- Patrocinador (cliente): **${project.sponsor_name}**`,
    project.project_leader_name    && `- Líder do Projeto (cliente): **${project.project_leader_name}**`,
    project.ti_client_name         && `- TI (cliente): **${project.ti_client_name}**`,
    project.operation_name         && `- Operação (cliente): **${project.operation_name}**`,
  ].filter(Boolean);

  // Indexar atividades salvas por nome normalizado
  const actByNorm = {};
  (savedActivities || []).forEach(a => {
    if (a.activity_name) actByNorm[norm(a.activity_name)] = a;
  });

  // Montar tabela: inclui TODAS as tasks do template,
  // usando templateConfig para responsável mesmo sem datas calculadas
  const actLines = [];
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;

    const saved = actByNorm[norm(task.activity)];
    const isInactive = saved?.status === "Cancelado" &&
      (saved?.history_observations || "").includes("[INATIVADO]");
    if (isInactive) return;

    const d = computedDates?.[task.id] || {};
    const startStr = fmt(d.plannedStart);
    const endStr   = fmt(d.plannedEnd);

    const status = saved?.status || "Não iniciado";
    const leaderStr = resolveLeader(task, saved, templateConfig, project);
    const respGeral = saved?.responsible_general
      || (templateConfig?.[task.id]?.responsible_general_type === "pontotel"      ? "Pontotel"
        : templateConfig?.[task.id]?.responsible_general_type === "compartilhado" ? "Pontotel e Cliente"
        : templateConfig?.[task.id]?.responsible_general_type === "cliente"       ? (project.client_name || "Cliente")
        : task.responsibleGeneral || "Pontotel");

    actLines.push(
      `| ${task.phase} | ${task.activity} | ${startStr} | ${endStr} | ${respGeral} | ${leaderStr} | ${status} |`
    );
  });

  const lines = [
    `## Contexto do Projeto — ${project.name || project.client_name}`,
    `- **Cliente:** ${project.client_name}`,
    `- **Status:** ${project.status || "—"} | **Fase atual:** ${project.current_phase || "—"}`,
    `- **Início:** ${project.start_date || "—"} | **Fim previsto:** ${project.planned_end_date || "—"}`,
    ``,
    `### Equipe do Projeto`,
    equipe.length ? equipe.join("\n") : "- (não informada)",
    ``,
    `### Cronograma de Atividades`,
    `*Datas exibidas como DD/MM/AAAA. "—" = sem data âncora definida ainda.*`,
    ``,
    `| Fase | Atividade | Início Plan. | Fim Plan. | Resp. Geral | Resp. Líder | Status |`,
    `|------|-----------|-------------|-----------|-------------|-------------|--------|`,
    ...actLines,
  ];

  return lines.join("\n");
}

export default function ScheduleAgentChat({ project, computedDates, savedActivities, templateConfig }) {
  const [open, setOpen] = useState(false);
  const [agentConfig, setAgentConfig] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [contextSent, setContextSent] = useState(false);
  const bottomRef = useRef(null);

  // Carrega config do agente ao abrir
  useEffect(() => {
    if (!open || agentConfig !== null) return;
    base44.entities.ScheduleAgentConfig.list()
      .then(list => setAgentConfig(list[0] || {}))
      .catch(() => setAgentConfig({}));
  }, [open, agentConfig]);

  // Inicia conversa ao abrir (se não existir)
  useEffect(() => {
    if (!open || agentConfig === null || conversation) return;
    setLoadingAgent(true);
    base44.agents.createConversation({
      agent_name: "cronograma_agente",
      metadata: {
        name: `Cronograma — ${project?.client_name || project?.name || "Projeto"}`,
        description: `Assistente de cronograma para ${project?.client_name || ""}`,
      },
    }).then(async conv => {
      setConversation(conv);
      setMessages(conv.messages || []);
      setLoadingAgent(false);
    }).catch(() => setLoadingAgent(false));
  }, [open, agentConfig, conversation]);

  // Injeta contexto assim que a conversa existe E o templateConfig está disponível
  // Reenvia se templateConfig mudar (carregamento assíncrono)
  useEffect(() => {
    if (!conversation || contextSent) return;
    // Aguarda templateConfig ter ao menos 1 entrada (carregado do banco)
    if (!templateConfig || Object.keys(templateConfig).length === 0) return;

    const ctx = buildProjectContext(project, computedDates, savedActivities, templateConfig);
    if (!ctx) return;

    setContextSent(true);
    base44.agents.addMessage(conversation, {
      role: "user",
      content: `[CONTEXTO DO PROJETO — não responda esta mensagem, apenas use as informações para auxiliar nas próximas perguntas do usuário]\n\n${ctx}`,
    }).catch(() => setContextSent(false)); // retry se falhar
  }, [conversation, templateConfig, contextSent, project, computedDates, savedActivities]);

  // Reset ao fechar/reabrir com projeto diferente
  useEffect(() => {
    if (!open) {
      setConversation(null);
      setMessages([]);
      setContextSent(false);
    }
  }, [open]);

  // Scroll automático
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Subscribe a updates em tempo real
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!input.trim() || !conversation || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await base44.agents.addMessage(conversation, { role: "user", content: text });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Filtra mensagens de contexto (não exibe para o usuário)
  const visibleMessages = messages.filter(m =>
    !(m.role === "user" && m.content?.startsWith("[CONTEXTO DO PROJETO"))
  );

  // O agente está pronto quando: conversa existe + (contexto enviado OU templateConfig vazio)
  const agentReady = !!conversation && (contextSent || !templateConfig || Object.keys(templateConfig || {}).length === 0);

  const content = (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg transition-all font-medium text-sm"
        >
          <Bot className="w-4 h-4" />
          Agente de Cronograma
        </button>
      )}

      {/* Painel do chat */}
      {open && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }} className="flex flex-col w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white shrink-0">
            <Bot className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Agente de Cronograma</p>
              <p className="text-xs text-blue-200 truncate">{project?.client_name || project?.name}</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-700 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {(loadingAgent || !agentReady) && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Carregando contexto do projeto...</span>
                </div>
              </div>
            )}

            {agentReady && visibleMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <MessageSquare className="w-8 h-8 text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-500">Olá! Sou seu assistente de cronograma.</p>
                  <p className="text-xs mt-1">Pergunte sobre datas, impactos, dependências ou alocação de recursos.</p>
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {[
                    "Quais atividades estão atrasadas?",
                    "Se eu mover a parametrização para semana que vem, o que muda?",
                    "Quem é o responsável líder de cada fase?",
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-600"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {agentReady && visibleMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role !== "user" && (
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.role === "user"
                    ? <p>{msg.content}</p>
                    : <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">{msg.content || "…"}</ReactMarkdown>
                  }
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mr-2">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !agentReady}
                placeholder="Pergunte sobre datas, dependências, alocação..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !agentReady}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}