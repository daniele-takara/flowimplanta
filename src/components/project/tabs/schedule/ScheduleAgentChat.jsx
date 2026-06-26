import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Loader2, MessageSquare, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

// Busca a config do agente e constrói as instruções dinâmicas
function buildSystemPrompt(config) {
  const toneMap = {
    formal: "Use linguagem formal e técnica.",
    direto: "Seja direto e objetivo. Evite explicações longas.",
    didatico: "Explique o raciocínio passo a passo para cada cálculo ou sugestão.",
  };
  const c = config || {};
  return `Você é o Especialista em Cronograma da FlowImplanta (Pontotel).
Tom: ${toneMap[c.agent_tone] || toneMap.direto}

## Regras Operacionais
- Máximo de ${c.max_activities_per_day || 3} atividade(s) por recurso por dia.
- Dependências obrigatórias: ${c.enforce_dependencies !== false ? "SIM — nunca quebre a cadeia de predecessoras." : "NÃO — datas podem ser ajustadas livremente."}
- Horário de trabalho: ${c.work_hours_start || "09:00"} às ${c.work_hours_end || "18:00"}.
- Reportar impacto ao sugerir mudanças: ${c.report_impact !== false ? "SIM" : "NÃO"}.
- Confirmação antes de aplicar: ${c.confirm_before_apply !== false ? "SIM — sempre aguarde ok do usuário." : "NÃO — pode aplicar diretamente."}

## Feriados (Brasil 2024-2026)
Ignorar: fins de semana, 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12 e Sexta-feira Santa.

## Formato de Resposta
- Datas sempre em DD/MM/AAAA.
- Ao mover uma tarefa, liste TODAS as tarefas impactadas com novas datas.
- Nunca "alucine" datas — se faltar contexto, peça ao usuário.
${c.extra_instructions ? `\n## Instruções Adicionais\n${c.extra_instructions}` : ""}`.trim();
}

// Constrói o contexto do projeto para injetar como primeira mensagem de sistema
function buildProjectContext(project, computedDates, savedActivities) {
  if (!project) return "";

  const lines = [
    `## Contexto do Projeto Atual`,
    `**Projeto:** ${project.name || project.client_name}`,
    `**Cliente:** ${project.client_name}`,
    `**Status:** ${project.status || "—"}`,
    `**Fase atual:** ${project.current_phase || "—"}`,
    `**Início:** ${project.start_date || "—"}`,
    `**Fim previsto:** ${project.planned_end_date || "—"}`,
    ``,
    `### Datas Calculadas (resumo das principais atividades)`,
  ];

  // Adiciona até 15 datas calculadas para contexto
  const entries = Object.entries(computedDates || {}).slice(0, 15);
  entries.forEach(([id, d]) => {
    if (d.plannedStart || d.plannedEnd) {
      lines.push(`- **${id}**: ${d.plannedStart || "?"} → ${d.plannedEnd || "?"}`);
    }
  });

  if (savedActivities?.length) {
    lines.push(``, `### Atividades com Status Registrado`);
    savedActivities.slice(0, 10).forEach(a => {
      if (a.status && a.status !== "Não iniciado") {
        lines.push(`- **${a.activity_name}** (${a.phase_name}): ${a.status}`);
      }
    });
  }

  return lines.join("\n");
}

export default function ScheduleAgentChat({ project, computedDates, savedActivities }) {
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
      const ctx = buildProjectContext(project, computedDates, savedActivities);
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

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg transition-all font-medium text-sm"
        >
          <Bot className="w-4 h-4" />
          Agente de Cronograma
        </button>
      )}

      {/* Painel do chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
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
}