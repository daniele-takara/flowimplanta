import { X } from "lucide-react";

export default function SobreavisoInfoModal({ onClose }) {
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

            <div className="border-t pt-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Sobreaviso cadastrado, porém não trabalhado</h3>
                {/* Imagem: Sobreaviso cadastrado e não trabalhado */}
                <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
                  Imagem: Sobreaviso não trabalhado
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Sobreaviso cadastrado e trabalhado</h3>
                {/* Imagem: Sobreaviso cadastrado e trabalhado */}
                <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
                  Imagem: Sobreaviso cadastrado e trabalhado
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Sobreaviso cadastrado e trabalhado parcialmente</h3>
                {/* Imagem: Sobreaviso cadastrado e trabalhado parcialmente */}
                <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-sm">
                  Imagem: Sobreaviso cadastrado e trabalhado parcialmente
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}