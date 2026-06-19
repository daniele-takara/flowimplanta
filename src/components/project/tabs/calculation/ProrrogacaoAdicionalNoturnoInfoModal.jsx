import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function ProrrogacaoAdicionalNoturnoInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgProrrogar = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/cd1bdd568_imagem1.png",
    alt: "Modelo 1 — Prorrogar adicional noturno até o fim da jornada",
    label: "Prorrogar adicional noturno"
  };

  const imgNaoProrrogar = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/99545579e_imagem2.png",
    alt: "Modelo 2 — Não prorrogar adicional noturno até o fim da jornada",
    label: "Não prorrogar adicional noturno"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Prorrogação do Adicional Noturno</h2>
          </div>

          {/* Modelo 1: Prorrogar */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 1: Prorrogar adicional noturno</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o funcionário trabalhou das 22:00 às 07:00. O Adicional noturno está sendo prorrogado das 05:00 às 07:00.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed mt-2">
                Levando em consideração a configuração da aplicação da redução noturna, o cálculo está considerando toda a jornada que o funcionário fez no dia.
              </p>
            </div>
            <div>
              <img
                src={imgProrrogar.src}
                alt={imgProrrogar.alt}
                onClick={() => setExpandedImg(imgProrrogar)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgProrrogar.label}</p>
            </div>
          </div>

          {/* Modelo 2: Não prorrogar */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 2: Não prorrogar adicional noturno</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o funcionário trabalhou das 22:00 às 07:00. O Adicional noturno está sendo calculado somente das 22:00 às 05:00, não está sendo estendido até o fim da jornada do funcionário.
              </p>
            </div>
            <div>
              <img
                src={imgNaoProrrogar.src}
                alt={imgNaoProrrogar.alt}
                onClick={() => setExpandedImg(imgNaoProrrogar)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgNaoProrrogar.label}</p>
            </div>
          </div>
        </div>
      </div>

      {expandedImg && (
        <ImageExpandModal
          src={expandedImg.src}
          alt={expandedImg.alt}
          onClose={() => setExpandedImg(null)}
        />
      )}
    </div>
  );
}