import { useState, useEffect } from "react";
import { X, Copy, CheckCircle2, Mail, Send, Loader2, Link2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

const GMAIL_CONNECTOR_ID = "6a9acfd915942e418033757b";

function buildDefaultTo(project) {
  const emails = [
    project?.sponsor_email,
    project?.project_leader_email,
    project?.operation_email,
  ].filter(Boolean);
  return emails.join(", ");
}

function buildDefaultSubject(project) {
  const today = new Date().toLocaleDateString("pt-BR");
  return `Status Report Pontotel | ${project?.client_name || ""} | ${today}`;
}

export default function EmailPreviewModal({ html, onClose, project }) {
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState(null);
  const [checkingConn, setCheckingConn] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSendForm, setShowSendForm] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");

  // Verifica conexão Gmail ao montar (Rule 2: data fetch = connection check)
  const checkConnection = async () => {
    setCheckingConn(true);
    try {
      const res = await base44.functions.invoke("sendStatusReportGmail", { checkOnly: true });
      if (res.data?.connected) {
        setConnected(true);
        setGmailEmail(res.data.email || null);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
    setCheckingConn(false);
  };

  useEffect(() => {
    setTo(buildDefaultTo(project));
    setSubject(buildDefaultSubject(project));
    checkConnection();
  }, [project]);

  // Rule 3: abre popup OAuth, polla fechamento, re-busca conexão
  const handleConnect = async () => {
    try {
      const res = await base44.connectors.connectAppUser(GMAIL_CONNECTOR_ID);
      const url = typeof res === "string" ? res : res?.url;
      if (!url) return;
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          checkConnection();
        }
      }, 500);
    } catch (e) {
      setSendResult({ success: false, error: "Não foi possível iniciar a conexão com o Gmail." });
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      setSendResult({ success: false, error: "Preencha destinatário e assunto." });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await base44.functions.invoke("sendStatusReportGmail", {
        to: to.trim(),
        subject: subject.trim(),
        html,
      });
      if (res.data?.success) {
        setSendResult({ success: true, msg: "E-mail enviado com sucesso pelo seu Gmail." });
      } else {
        setSendResult({ success: false, error: res.data?.error || "Falha ao enviar e-mail." });
      }
    } catch (e) {
      setSendResult({ success: false, error: "Erro ao chamar a função de envio." });
    }
    setSending(false);
  };

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyRich = async () => {
    const blob = new Blob([html], { type: "text/html" });
    const data = new ClipboardItem({ "text/html": blob });
    await navigator.clipboard.write([data]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800">Versão para E-mail</h2>
            <span className="text-xs text-slate-400">— compatível com Gmail e Outlook</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          <iframe
            srcDoc={html}
            title="Preview e-mail"
            className="w-full rounded-xl border border-slate-200 bg-white"
            style={{ minHeight: 500, height: "100%" }}
          />
        </div>

        {/* Enviar pelo Gmail — seção */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          {checkingConn ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Verificando conexão com o Gmail...
            </div>
          ) : !connected ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>Conecte seu Gmail para enviar o relatório diretamente por e-mail.</span>
              </div>
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Link2 className="w-3.5 h-3.5" />
                Conectar Gmail
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowSendForm(!showSendForm)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Gmail conectado{gmailEmail ? ` — ${gmailEmail}` : ""}
                </span>
                {showSendForm ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showSendForm && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-slate-400">Para (separe por vírgula)</label>
                    <input
                      type="text"
                      value={to}
                      onChange={e => setTo(e.target.value)}
                      placeholder="destinatario@email.com"
                      className="w-full mt-0.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Assunto</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full mt-0.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? "Enviando..." : "Enviar pelo meu Gmail"}
                    </button>
                  </div>
                </div>
              )}
              {sendResult && (
                <div className={`mt-2 p-2 rounded-lg flex items-start gap-2 text-xs ${
                  sendResult.success
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {sendResult.success
                    ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {sendResult.msg}</>
                    : <><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {sendResult.error}</>
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — copiar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl">
          <p className="text-xs text-slate-400">Ou cole manualmente no corpo do e-mail (Gmail, Outlook, Apple Mail)</p>
          <div className="flex gap-2">
            <button
              onClick={handleCopyRich}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-xl transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar para colar no e-mail"}
            </button>
            <button
              onClick={handleCopyHtml}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copiar HTML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}