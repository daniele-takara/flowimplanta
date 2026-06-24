import { X } from "lucide-react";

export default function PeriodoApuracaoInfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl max-w-2xl w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Período de Apuração</h2>
          </div>

          <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">
              Caso você coloque <strong>1 a 30</strong>, o espelho de ponto gerado no sistema Pontotel irá aparecer como a imagem abaixo:
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Iniciando no dia 1 e finalizando no dia 30, 31 ou 28 dependendo do mês em questão.
            </p>
          </div>

          <div>
            <img
              src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/6f48f5c86_image.png"
              alt="Exemplo de espelho de ponto — período 01/04 até 30/04"
              className="w-full rounded-lg border border-slate-200 shadow-sm"
            />
            <p className="text-xs text-slate-400 mt-1.5 text-center">Exemplo: Período de 01/04 até 30/04</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">
              Caso o período de apuração seja de <strong>15 a 14</strong>, irá iniciar no dia 15 do mês e finalizar no dia 14 do mês subsequente.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Caso seja de <strong>21 a 20</strong> ou qualquer outro período, seguirá a mesma lógica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}