import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function AdicionalIncluiPausaInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgNaoConsiderar = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/cf949b052_imagem5.png",
    alt: "Modelo 1 — Não considerar o tempo de pausa no adicional noturno",
    label: "Não considerar o tempo de pausa"
  };

  const imgConsiderar = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/0c86e4463_imagem6.png",
    alt: "Modelo 2 — Considerar o tempo de pausa no adicional noturno",
    label: "Considerar o tempo de pausa"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Adicional Noturno — Tempo de Pausa</h2>
          </div>

          {/* Modelo 1: Não considerar */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 1: Não considerar o tempo de pausa</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o funcionário realizou pausa das 22:00 às 23:00 e estão sendo consideradas 06:51 de adicional noturno (06:00 trabalhadas com a red. noturna), ou seja, não está sendo incluso o tempo em que o funcionário estava em pausa.
              </p>
            </div>
            <div>
              <img
                src={imgNaoConsiderar.src}
                alt={imgNaoConsiderar.alt}
                onClick={() => setExpandedImg(imgNaoConsiderar)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgNaoConsiderar.label}</p>
            </div>
          </div>

          {/* Modelo 2: Considerar */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 2: Considerar o tempo de pausa</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o funcionário realizou pausa das 22:00 às 23:00 e estão sendo consideradas 08:00 de adicional noturno (06:00 trabalhadas + 1 hora de pausa com a red. noturna), ou seja, está sendo incluso o tempo em que o funcionário estava em pausa.
              </p>
            </div>
            <div>
              <img
                src={imgConsiderar.src}
                alt={imgConsiderar.alt}
                onClick={() => setExpandedImg(imgConsiderar)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgConsiderar.label}</p>
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