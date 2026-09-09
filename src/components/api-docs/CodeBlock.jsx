import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CodeBlock({ code, language = "bash", dark = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={`relative rounded-xl border overflow-hidden ${dark ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-inherit">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-400"}`}>
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 text-xs font-medium transition-colors ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className={`px-4 py-3 overflow-x-auto text-xs font-mono leading-relaxed ${dark ? "text-slate-100" : "text-slate-700"}`}>
        {code}
      </pre>
    </div>
  );
}