import { useState } from "react";
import { X, Copy, CheckCircle2, Mail } from "lucide-react";

export default function EmailPreviewModal({ html, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Copia conteúdo rico (HTML formatado) para área de transferência — funciona no Gmail
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl">
          <p className="text-xs text-slate-400">Cole diretamente no corpo do e-mail (Gmail, Outlook, Apple Mail)</p>
          <div className="flex gap-2">
            <button
              onClick={handleCopyRich}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
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