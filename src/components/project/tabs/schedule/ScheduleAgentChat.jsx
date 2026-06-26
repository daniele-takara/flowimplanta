import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Loader2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS } from "@/lib/resolveResponsibleRole.js";

function fmt(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// Constrói o contexto rico do projeto para o agente
function buildProjectContext(project, computedDates, savedActivities, templateConfig) {
  if (!project) return "";

  // Equipe Pontotel e Cliente
  const equipe = [
    project.pontotel_manager_name  ? `- Gerente Pontotel: ${project.pontotel_manager_name}` : null,
    project.pontotel_analyst_name  ? `- Analista Pontotel: ${project.pontotel_analyst_name}` : null,
    project.sponsor_name           ? `- Patrocinador (cliente): ${project.sponsor_name}` : null,
    project.project_leader_name    ? `- Líder do Projeto (cliente): ${project.project_leader_name}` : null,
    project.ti_client_name         ? `- TI (cliente): ${project.ti_client_name}` : null,
    project.operation_name         ? `- Operação (cliente): ${project.operation_name}` : null,
  ].filter(Boolean);

  // Indexar atividades salvas por nome normalizado
  const norm = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
  const actByNorm = {};
  (savedActivities || []).forEach(a => { if (a.activity_name) actByNorm[norm(a.activity_name)] = a; });

  // Montar tabela de atividades com responsável e datas
  const actLines = [];
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    const d = computedDates?.[task.id];
    if (!d?.plannedStart && !d?.plannedEnd) return;

    const saved = actByNorm[norm(task.activity)];
    const status = saved?.status || "Não iniciado";
    const isInactive = status === "Cancelado" && (saved?.history_observations || "").includes("[INATIVADO]");
    if (isInactive) return;

    // Responsável líder: salvo > template config > role padrão da task
    let leaderName = saved?.responsible_leader || "";
    if (!leaderName && templateConfig?.[task.id]?.responsible_role) {
      leaderName = resolveRoleToName(templateConfig[task.id].responsible_role, project)
        || RESPONSIBLE_ROLE_LABELS[templateConfig[task.id].responsible_role] || "";
    }
    if (!leaderName && task.responsibleRole) {
      leaderName = resolveRoleToName(task.responsibleRole, project) || "";
    }
    // Se o líder salvo for uma role key, resolve para nome
    if (leaderName && RESPONSIBLE_ROLE_LABELS[leaderName]) {
      leaderName = resolveRoleToName(leaderName, project) || RESPONSIBLE_ROLE_LABELS[leaderName];
    }

    const respGeral = saved?.responsible_general || task.responsibleGeneral || "Pontotel";

    actLines.push(
      `| ${task.phase} | ${task.activity} | ${fmt(d.plannedStart)} | ${fmt(d.plannedEnd)} | ${respGeral} | ${leaderName || "—"} | ${status} |`
    );
  });

  const lines = [
    `## Contexto do Projeto — ${project.name || project.client_name}`,
    `- **Cliente:** ${project.client_name}`,
    `- **Status do projeto:** ${project.status || "—"}`,
    `- **Fase atual:** ${project.current_phase || "—"}`,
    `- **Início:** ${project.start_date || "—"} | **Fim previsto:** ${project.planned_end_date || "—"}`,
    ``,
    `### Equipe`,
    ...equipe,
    ``,
    `### Cronograma Completo de Atividades`,
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
    }).then(conv => {
      setConversation(conv);
      setMessages(conv.messages || []);
      setLoadingAgent(false);
      // Injeta contexto do projeto como primeira mensagem do usuário (silenciosa)
      const ctx = buildProjectContext(project, computedDates, savedActivities, templateConfig);
      if (ctx) {
        return base44.agents.addMessage(conv, {
          role: "user",
          content: `[CONTEXTO DO PROJETO — não responda esta mensagem, apenas use o contexto para auxiliar nas próximas perguntas]\n\n${ctx}`,
        });
      }
    }).catch(() => setLoadingAgent(false));
  }, [open, agentConfig, conversation, project, computedDates, savedActivities]);

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
            {loadingAgent && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Carregando agente...</span>
                </div>
              </div>
            )}

            {!loadingAgent && visibleMessages.length === 0 && (
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
                    "Quem está sobrecarregado esta semana?",
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

            {!loadingAgent && visibleMessages.map((msg, idx) => (
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
                disabled={sending || loadingAgent || !conversation}
                placeholder="Pergunte sobre datas, dependências, alocação..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || loadingAgent || !conversation}
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