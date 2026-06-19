import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function BancoHorasAcumuloInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);
  const img = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/ad789680e_acumuloefatrdetransform.png",
    alt: "Exemplo de acúmulo em banco de horas e fator de transformação",
    label: "Exemplo: fator de acúmulo 1 para 2"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acúmulo em banco de horas e fator de transformação</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              O fator de acúmulo refere-se a como a hora extra realizada será somada ao banco de horas.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-6">
            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                No exemplo abaixo, o fator de acúmulo é <strong>1 para 2</strong>. Isso significa que a cada 1 hora extra realizada, 
                2 horas são contabilizadas no banco de horas do funcionário.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                É possível configurar fatores de transformação diferentes para cada tipo de evento 
                (hora extra, atraso, saída antecipada, excesso de pausa, falta), ou optar por não contabilizar 
                determinado evento no banco de horas.
              </p>
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