import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

const img = {
  src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/b782d6319_imagemcalendrio.png",
  alt: "Calendário de exemplo - mês de desconto do DSR",
  label: "Exemplo: funcionário teve falta no dia 30 (quarta-feira), último dia do mês"
};

export default function DSRMesDescontoInfoModal({ onClose }) {
  const [expanded, setExpanded] = useState(false);

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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Mês de Desconto do DSR</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda em qual folha de pagamento o DSR será descontado quando a falta ocorre no final do mês.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-6">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              No exemplo abaixo, o funcionário teve uma falta injustificada no dia <strong>30 (quarta-feira)</strong>, que é o último dia do mês. Se o DSR for considerado no dia da falta, será descontado na folha de <strong>Junho</strong>. Se o DSR não for considerado no dia da falta, será descontado na folha do <strong>próximo mês</strong>.
            </p>
            <div>
              <img
                src={img.src}
                alt={img.alt}
                onClick={() => setExpanded(true)}
                className="w-full max-w-md mx-auto rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">{img.label}</p>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <ImageExpandModal
          src={img.src}
          alt={img.alt}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}