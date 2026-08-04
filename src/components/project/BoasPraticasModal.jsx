import { useState } from "react";
import { X, FileDown, Loader2, Download } from "lucide-react";
import { TABS_META, downloadBoasPraticasPDF, downloadAllBoasPraticasPDFs } from "@/lib/boasPraticasPdfExport";
import { toast } from "@/components/ui/use-toast";

export default function BoasPraticasModal({ onClose }) {
  const [generating, setGenerating] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownload = async (tabKey) => {
    setGenerating(tabKey);
    try {
      await downloadBoasPraticasPDF(tabKey);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (e) {
      toast({ title: "Erro ao gerar PDF. Tente novamente.", variant: "destructive" });
    }
    setGenerating(null);
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      await downloadAllBoasPraticasPDFs();
      toast({ title: "Todos os PDFs foram gerados!" });
    } catch (e) {
      toast({ title: "Erro ao gerar PDFs. Tente novamente.", variant: "destructive" });
    }
    setDownloadingAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-800">Templates de Boas Práticas</h3>
            <p className="text-xs text-slate-400 mt-0.5">Gere um PDF de referência para cada aba do projeto</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <button
            onClick={handleDownloadAll}
            disabled={downloadingAll || generating !== null}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloadingAll ? "Gerando todos os PDFs..." : "Baixar todos os 9 PDFs"}
          </button>

          <div className="space-y-2">
            {TABS_META.map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => handleDownload(tab.key)}
                disabled={generating !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-slate-400">{String(idx + 1).padStart(2, "0")}</span>
                  {tab.label}
                </span>
                {generating === tab.key ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                ) : (
                  <FileDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}