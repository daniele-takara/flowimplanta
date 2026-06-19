import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function ReducaoHoraNoturnaInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgModelo1 = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/4b8f07f34_imagem4.png",
    alt: "Modelo 1 — Considerar redução apenas no adicional noturno",
    label: "Considerar apenas no adicional noturno"
  };

  const imgModelo2 = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/49f7feb45_imagem3.png",
    alt: "Modelo 2 — Considerar redução no adicional noturno e nas horas trabalhadas",
    label: "Considerar no adicional noturno e nas horas trabalhadas"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Redução de Hora Noturna</h2>
          </div>

          {/* Modelo 1 */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 1: Considerar apenas no adicional noturno</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                A hora trabalhada será contabilizada com 60min seguindo a duração de jornada esperada e o adicional noturno será contabilizado com a redução de hora noturna, considerando 52min 30 seg.
              </p>
            </div>
            <div>
              <img
                src={imgModelo1.src}
                alt={imgModelo1.alt}
                onClick={() => setExpandedImg(imgModelo1)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgModelo1.label}</p>
            </div>
          </div>

          {/* Modelo 2 */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Modelo 2: Considerar redução de hora no adicional noturno e nas horas trabalhadas</h3>
            <div className="bg-indigo-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                A hora trabalhada seguindo a duração de jornada esperada e o adicional noturno serão contabilizados com a redução de hora noturna.
              </p>
            </div>
            <div>
              <img
                src={imgModelo2.src}
                alt={imgModelo2.alt}
                onClick={() => setExpandedImg(imgModelo2)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{imgModelo2.label}</p>
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