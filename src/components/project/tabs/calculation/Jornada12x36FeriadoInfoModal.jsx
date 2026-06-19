import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function Jornada12x36FeriadoInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const modelo1Img = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/e4f0fa9eb_imagem7.png",
    alt: "Feriado com folga coincidindo com jornada de trabalho - pagamento normal",
    label: "Feriado com folga coincidindo com jornada de trabalho - pagamento normal"
  };

  const modelo2Img = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/eb2431381_imagem8.png",
    alt: "Feriado com folga coincidindo com jornada de trabalho - Pagamento em horas extras",
    label: "Feriado com folga coincidindo com jornada de trabalho - Pagamento em horas extras"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Feriados em jornadas 12x36</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como funciona o pagamento de feriados para funcionários em jornada 12x36.
            </p>
          </div>

          {/* Modelo 1 – Pagamento normal */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">Modelo 1 – Pagamento normal</h3>
            <div className="bg-purple-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                O dia trabalhado que coincide com feriado é pago como dia útil normal, sem adicional de horas extras.
              </p>
            </div>
            <img
              src={modelo1Img.src}
              alt={modelo1Img.alt}
              onClick={() => setExpandedImg(modelo1Img)}
              className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
              title="Clique para ampliar"
            />
            <p className="text-xs text-slate-400 mt-1.5 text-center">{modelo1Img.label}</p>
          </div>

          {/* Modelo 2 – Pagamento extra */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">Modelo 2 – Pagamento extra</h3>
            <div className="bg-purple-50/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                O dia trabalhado que coincide com feriado é pago como hora extra, com o adicional correspondente.
              </p>
            </div>
            <img
              src={modelo2Img.src}
              alt={modelo2Img.alt}
              onClick={() => setExpandedImg(modelo2Img)}
              className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
              title="Clique para ampliar"
            />
            <p className="text-xs text-slate-400 mt-1.5 text-center">{modelo2Img.label}</p>
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