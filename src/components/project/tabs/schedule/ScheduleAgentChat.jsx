import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { Bot, X, Send, Loader2, MessageSquare, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SCHEDULE_TASKS } from "@/lib/scheduleTasks.js";
import { resolveRoleToName, RESPONSIBLE_ROLE_LABELS } from "@/lib/resolveResponsibleRole.js";

const norm = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

function fmt(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

function resolveLeader(task, savedAct, templateConfig, project) {
  let leader = savedAct?.responsible_leader || "";
  if (!leader && templateConfig?.[task.id]?.responsible_role) leader = templateConfig[task.id].responsible_role;
  if (!leader && task.responsibleRole) leader = task.responsibleRole;
  if (leader && RESPONSIBLE_ROLE_LABELS[leader]) {
    const resolved = resolveRoleToName(leader, project);
    return resolved ? `${resolved} (${RESPONSIBLE_ROLE_LABELS[leader]})` : RESPONSIBLE_ROLE_LABELS[leader];
  }
  return leader || "—";
}

function buildProjectContext(project, computedDates, savedActivities, templateConfig) {
  if (!project) return "";

  const equipe = [
    project.pontotel_manager_name  && `- Gerente de Projetos Pontotel: **${project.pontotel_manager_name}**`,
    project.pontotel_analyst_name  && `- Analista de Implantação Pontotel: **${project.pontotel_analyst_name}**`,
    project.sponsor_name           && `- Patrocinador (cliente): **${project.sponsor_name}**`,
    project.project_leader_name    && `- Líder do Projeto (cliente): **${project.project_leader_name}**`,
    project.ti_client_name         && `- TI (cliente): **${project.ti_client_name}**`,
    project.operation_name         && `- Operação (cliente): **${project.operation_name}**`,
  ].filter(Boolean);

  const actByNorm = {};
  (savedActivities || []).forEach(a => { if (a.activity_name) actByNorm[norm(a.activity_name)] = a; });

  const actLines = [];
  SCHEDULE_TASKS.forEach(task => {
    if (task.type !== "task") return;
    const saved = actByNorm[norm(task.activity)];
    if (saved?.status === "Cancelado" && (saved?.history_observations || "").includes("[INATIVADO]")) return;

    const d = computedDates?.[task.id] || {};
    const leaderStr = resolveLeader(task, saved, templateConfig, project);
    const respGeral = saved?.responsible_general
      || (templateConfig?.[task.id]?.responsible_general_type === "pontotel"      ? "Pontotel"
        : templateConfig?.[task.id]?.responsible_general_type === "compartilhado" ? "Pontotel e Cliente"
        : templateConfig?.[task.id]?.responsible_general_type === "cliente"       ? (project.client_name || "Cliente")
        : task.responsibleGeneral || "Pontotel");

    actLines.push(`| ${task.id} | ${task.phase} | ${task.activity} | ${fmt(d.plannedStart)} | ${fmt(d.plannedEnd)} | ${respGeral} | ${leaderStr} | ${saved?.status || "Não iniciado"} |`);
  });

  return [
    `## Contexto do Projeto — ${project.name || project.client_name}`,
    `- **Cliente:** ${project.client_name}`,
    `- **Status:** ${project.status || "—"} | **Fase atual:** ${project.current_phase || "—"}`,
    `- **Início:** ${project.start_date || "—"} | **Fim previsto:** ${project.planned_end_date || "—"}`,
    ``,
    `### Equipe do Projeto`,
    equipe.length ? equipe.join("\n") : "- (não informada)",
    ``,
    `### Cronograma de Atividades (ID | Fase | Atividade | Início Plan. | Fim Plan. | Resp. Geral | Resp. Líder | Status)`,
    `*Use o ID da coluna 1 no campo overrides do JSON de sugestão.*`,
    ``,
    `| ID | Fase | Atividade | Início Plan. | Fim Plan. | Resp. Geral | Resp. Líder | Status |`,
    `|----|------|-----------|-------------|-----------|-------------|-------------|--------|`,
    ...actLines,
  ].join("\n");
}

// Extrai bloco JSON __apply_suggestion__ do conteúdo de uma mensagem do agente
function extractSuggestion(content) {
  if (!content) return null;
  try {
    // Procura por blocos ```json ... ``` ou JSON puro
    const patterns = [
      /```json\s*(\{[\s\S]*?"__apply_suggestion__"[\s\S]*?\})\s*```/,
      /(\{"__apply_suggestion__"[\s\S]*?\})/,
    ];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (parsed.__apply_suggestion__ && parsed.overrides) return parsed;
      }
    }
  } catch {}
  return null;
}

// Remove o bloco JSON da exibição para não poluir o chat
function stripSuggestionJson(content) {
  if (!content) return content;
  return content
    .replace(/```json\s*\{[\s\S]*?"__apply_suggestion__"[\s\S]*?\}\s*```/g, "")
    .trim();
}

// Botão de aplicação de sugestão
function ApplySuggestionButton({ suggestion, projectId, onApplied }) {
  const [state, setState] = useState("idle"); // idle | applying | success | error
  const [result, setResult] = useState(null);

  const handleApply = async () => {
    setState("applying");
    try {
      const res = await base44.functions.invoke("applyAgentScheduleSuggestion", {
        project_id: projectId,
        overrides: suggestion.overrides,
      });
      setResult(res.data);
      setState(res.data?.success ? "success" : "error");
      if (res.data?.success && onApplied) onApplied();
    } catch (e) {
      setResult({ error: e.message });
      setState("error");
    }
  };

  const conflictCount = result?.allocation_conflicts?.length || 0;

  if (state === "idle") {
    const taskCount = Object.keys(suggestion.overrides || {}).length;
    return (
      <div className="mt-2 border border-blue-200 rounded-xl bg-blue-50 p-3">
        <p className="text-xs text-blue-700 font-medium mb-2">
          📅 Sugestão pronta — {taskCount} data(s) âncora a aplicar
        </p>
        <button
          onClick={handleApply}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Aplicar datas no cronograma
        </button>
      </div>
    );
  }

  if (state === "applying") {
    return (
      <div className="mt-2 border border-slate-200 rounded-xl bg-slate-50 p-3 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Aplicando datas e verificando alocação...
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="mt-2 border border-green-200 rounded-xl bg-green-50 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {result?.applied} data(s) aplicada(s) com sucesso!
        </div>
        {conflictCount > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <div className="flex items-center gap-1 font-semibold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {conflictCount} conflito(s) de alocação detectado(s):
            </div>
            {result.allocation_conflicts.slice(0, 3).map((c, i) => (
              <div key={i} className="text-[11px] text-amber-800">
                • {c.conflicting_project}: {c.conflicting_activity} ({c.conflicting_dates})
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-xs text-green-600 hover:underline"
        >
          <RefreshCw className="w-3 h-3" /> Recarregar cronograma
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 border border-red-200 rounded-xl bg-red-50 p-3 text-xs text-red-700">
      Erro ao aplicar: {result?.error || "Tente novamente"}
      <button onClick={() => setState("idle")} className="ml-2 underline">Tentar novamente</button>
    </div>
  );
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

  useEffect(() => {
    if (!open || agentConfig !== null) return;
    base44.entities.ScheduleAgentConfig.list()
      .then(list => setAgentConfig(list[0] || {}))
      .catch(() => setAgentConfig({}));
  }, [open, agentConfig]);

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
    }).catch(() => setLoadingAgent(false));
  }, [open, agentConfig, conversation]);

  useEffect(() => {
    if (!conversation || contextSent) return;
    if (!templateConfig || Object.keys(templateConfig).length === 0) return;
    const ctx = buildProjectContext(project, computedDates, savedActivities, templateConfig);
    if (!ctx) return;
    setContextSent(true);
    base44.agents.addMessage(conversation, {
      role: "user",
      content: `[CONTEXTO DO PROJETO — não responda esta mensagem, apenas use as informações para auxiliar nas próximas perguntas]\n\n${ctx}`,
    }).catch(() => setContextSent(false));
  }, [conversation, templateConfig, contextSent, project, computedDates, savedActivities]);

  useEffect(() => {
    if (!open) { setConversation(null); setMessages([]); setContextSent(false); }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, data => setMessages(data.messages || []));
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

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const visibleMessages = messages.filter(m =>
    !(m.role === "user" && m.content?.startsWith("[CONTEXTO DO PROJETO"))
  );

  const agentReady = !!conversation && (contextSent || !templateConfig || Object.keys(templateConfig || {}).length === 0);

  const content = (
    <>
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

      {open && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }} className="flex flex-col w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white shrink-0">
            <Bot className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Agente de Cronograma</p>
              <p className="text-xs text-blue-200 truncate">{project?.client_name || project?.name}</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-blue-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

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
                  <p className="text-xs mt-1">Posso sugerir e aplicar datas considerando alocação e dependências.</p>
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  {[
                    "Quais atividades estão atrasadas?",
                    "Sugira datas para o alinhamento inicial em 07/07/2026",
                    "Quem é o responsável líder de cada fase?",
                  ].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-left text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-600">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {agentReady && visibleMessages.map((msg, idx) => {
              const suggestion = msg.role === "assistant" ? extractSuggestion(msg.content) : null;
              const displayContent = suggestion ? stripSuggestionJson(msg.content) : msg.content;

              return (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role !== "user" && (
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                  )}
                  <div className={`max-w-[88%] ${msg.role === "user" ? "" : ""}`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                    }`}>
                      {msg.role === "user"
                        ? <p>{msg.content}</p>
                        : <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">{displayContent || "…"}</ReactMarkdown>
                      }
                    </div>
                    {suggestion && (
                      <ApplySuggestionButton
                        suggestion={suggestion}
                        projectId={project?.id}
                        onApplied={() => {}}
                      />
                    )}
                  </div>
                </div>
              );
            })}

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

          <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !agentReady}
                placeholder="Pergunte ou peça sugestão de datas..."
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