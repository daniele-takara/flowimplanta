import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function HorasExtrasInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);
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

        <div className="p-8 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Horas extras</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como as porcentagens de horas extras são aplicadas.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-6">
            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Funcionamento das Horas Extras</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Entenda como as porcentagens de horas extras são aplicadas
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                As porcentagens de horas extras são utilizadas para que sejam aplicadas a forma de pagamento em dias comuns de trabalho, folgas e feriados.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6">
              {[
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/59fa3a42d_HoraExtra50.png", alt: "Hora extra 50%", label: "Hora extra 50%" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/ece2e6bb4_HoraExtraExtraordinria100.png", alt: "Hora extraordinária 100%", label: "Hora extraordinária 100%" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/b33de4db3_HoraExtraEspecial150.png", alt: "Hora extra especial 150%", label: "Hora extra especial 150%" },
              ].map((img) => (
                <div key={img.src}>
                  <img 
                    src={img.src} 
                    alt={img.alt}
                    onClick={() => setExpandedImg(img)}
                    className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                    title="Clique para ampliar"
                  />
                  <p className="text-xs text-slate-400 mt-1.5 text-center">{img.label}</p>
                </div>
              ))}
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