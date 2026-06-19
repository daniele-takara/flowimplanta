import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function SobreavisoInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgTrabalhado = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/f79109595_Sobreavisocadastradoetrabalhado.png",
    alt: "Sobreaviso cadastrado e trabalhado",
    label: "Sobreaviso cadastrado e trabalhado — gera H. Trabalhadas + H. Extra Sobreaviso"
  };

  const imgParcial = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/47130e733_Sobreavisocadastradoetrabalhadoparcialmente.png",
    alt: "Sobreaviso cadastrado e trabalhado parcialmente",
    label: "Sobreaviso cadastrado e trabalhado parcialmente — gera H. Trabalhadas + H. Extra Sobreaviso + Duração de Sobreaviso"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Sobreaviso</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como funciona a modalidade de sobreaviso e os diferentes tipos de apontamento gerados pelo sistema.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="bg-amber-50/50 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                O sobreaviso é a modalidade de trabalho em que o colaborador, mesmo em seu período de descanso, fica à disposição do empregador aguardando alguma ordem. Por essa razão, geramos apontamentos distintos, durante o sobreaviso e/ou hora extra de sobreaviso, para que o colaborador receba devidamente.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
                <p className="text-sm text-slate-700">
                  Caso tenha sobreaviso cadastrado na jornada e o colaborador <strong>não registra ponto</strong> durante o período de sobreaviso, irá gerar o apontamento de <strong>"duração de sobreaviso"</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
                <p className="text-sm text-slate-700">
                  Caso tenha sobreaviso cadastrado na jornada e o colaborador <strong>registre ponto</strong> durante o período de sobreaviso, irá gerar o apontamento de <strong>"hora extra sobreaviso"</strong>.
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-6">
              {/* Sobreaviso não trabalhado — textual apenas */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Sobreaviso cadastrado, porém não trabalhado</h3>
                <p className="text-xs text-slate-500">
                  Neste cenário, o colaborador estava de sobreaviso mas não foi acionado. Será gerado apenas o apontamento de <strong>"duração de sobreaviso"</strong>.
                </p>
              </div>

              {/* Sobreaviso trabalhado */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Sobreaviso cadastrado e trabalhado</h3>
                <img
                  src={imgTrabalhado.src}
                  alt={imgTrabalhado.alt}
                  onClick={() => setExpandedImg(imgTrabalhado)}
                  className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                  title="Clique para ampliar"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">{imgTrabalhado.label}</p>
              </div>

              {/* Sobreaviso trabalhado parcialmente */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Sobreaviso cadastrado e trabalhado parcialmente</h3>
                <img
                  src={imgParcial.src}
                  alt={imgParcial.alt}
                  onClick={() => setExpandedImg(imgParcial)}
                  className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                  title="Clique para ampliar"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">{imgParcial.label}</p>
              </div>
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