import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

const models = [
  {
    title: "Modelo 1: Hora extra (porcentagem em dias com jornada de trabalho prevista)",
    img: {
      src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/10c86526b_imagem9.png",
      alt: "Modelo 1 - Hora extra",
      label: "Modelo 1: Pausa refeição calculada como hora extra simples"
    },
    text: "No exemplo abaixo, o funcionário trabalhou 09:00 em um feriado onde deveria estar de folga e não realizou a pausa. O sistema calculou 01:00 de pausa refeição como hora extra simples e esse comportamento se aplicará para feriados e folgas que não há jornada de trabalho esperada."
  },
  {
    title: "Modelo 2: Não considerar a pausa",
    img: {
      src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/c4420edcc_imagem10.png",
      alt: "Modelo 2 - Não considerar",
      label: "Modelo 2: Pausa refeição não calculada"
    },
    text: "No exemplo abaixo, o funcionário trabalhou 09:00 em um feriado onde deveria estar de folga e não realizou a pausa. Caso essa opção seja selecionada, o sistema não irá calcular pausa refeição em dias de feriados e folgas que não há jornada de trabalho esperada."
  }
];

export default function DSRFeriasHEInfoModal({ onClose }) {
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

        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Tipo de Hora Extra em Feriados/Folgas</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como o sistema trata a pausa refeição quando o funcionário trabalha em dias de feriado ou folga.
            </p>
          </div>

          {models.map((model, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-3">{model.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{model.text}</p>
              <div>
                <img
                  src={model.img.src}
                  alt={model.img.alt}
                  onClick={() => setExpandedImg(model.img)}
                  className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                  title="Clique para ampliar"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">{model.img.label}</p>
              </div>
            </div>
          ))}
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