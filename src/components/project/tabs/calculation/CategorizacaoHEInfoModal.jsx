import { X } from "lucide-react";

export default function CategorizacaoHEInfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-purple-800">Categorização de Hora Extra</h2>
            <p className="text-sm text-slate-400 mt-0.5">Entenda como funciona a categorização de horas extras</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            No exemplo abaixo, o colaborador possui categorização de porcentagens de horas extras, então, as 2 primeiras horas entraram a 70% e o restante a 100%.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Na categorização diária, a partir do momento em que o funcionário atinge o limite de horas extras realizadas, o sistema não calcula mais as horas extras que o funcionário faz, dependendo da quantidade de horas extras estabelecidas na categorização de cada tipo de hora extra.
          </p>

          {/* Imagem de exemplo */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <img
              src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/37621bba2_cathoraextra.png"
              alt="Exemplo de categorização de hora extra"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}