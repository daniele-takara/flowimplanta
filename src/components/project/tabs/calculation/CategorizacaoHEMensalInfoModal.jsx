import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function CategorizacaoHEMensalInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);
  const img = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/d75f5e459_cathoramensal.png",
    alt: "Exemplo de categorização de hora extra mensal",
    label: "Exemplo de categorização de hora extra mensal"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Categorização de Hora Extra Mensal</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como funciona a categorização mensal de horas extras.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-6">
            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o colaborador possui categorização mensal, então é atribuído um limite para alterar a porcentagem de pagamento de hora extra, podendo ser:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 pl-2">
                <li><strong>0h - 25h = 50%</strong></li>
                <li><strong>25h - 60h = 80%</strong></li>
                <li><strong>Acima de 60h = 100%</strong></li>
              </ul>
            </div>

            <div className="mt-4">
              <img
                src={img.src}
                alt={img.alt}
                onClick={() => setExpandedImg(img)}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{img.label}</p>
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