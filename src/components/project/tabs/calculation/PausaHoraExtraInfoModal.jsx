import { X } from "lucide-react";

export default function PausaHoraExtraInfoModal({ onClose }) {
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Caso o funcionário não cumpra o tempo total de pausa, deve ser calculada hora extra?</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Esta configuração define se o período de intervalo não realizado deve ser considerado como tempo trabalhado para composição da jornada.
            </p>
          </div>

          {/* Sim */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              Sim, considerar como hora extra o tempo remanescente da pausa
            </h3>
            <div className="bg-green-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                O período não usufruído da pausa será somado ao tempo trabalhado do colaborador.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Caso essa soma faça com que a jornada ultrapasse o limite previsto, o excedente poderá gerar horas extras conforme as regras configuradas.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                O apontamento da pausa intrajornada continuará existindo normalmente, pois trata-se de uma obrigação legal independente da apuração de horas extras.
              </p>
              <div className="bg-white border border-green-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-green-700 mb-2">Exemplo:</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  O colaborador possui uma jornada prevista de <strong>8 horas de trabalho</strong> e <strong>1 hora de intervalo</strong>.
                </p>
                <p className="text-sm text-slate-700 leading-relaxed mt-2">Ele registrou:</p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mt-1 pl-2">
                  <li>Entrada: 08:00</li>
                  <li>Saída para intervalo: 12:00</li>
                  <li>Retorno do intervalo: 12:30</li>
                  <li>Saída: 17:00</li>
                </ul>
                <p className="text-sm text-slate-700 leading-relaxed mt-2">Nesse cenário:</p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mt-1 pl-2">
                  <li>Houve apenas <strong>30 minutos de intervalo</strong>, faltando 30 minutos para completar a pausa prevista.</li>
                  <li>Os 30 minutos não usufruídos serão apontados para tratamento da pausa intrajornada.</li>
                  <li>Como o colaborador permaneceu trabalhando durante esses 30 minutos, o sistema os adicionará ao tempo trabalhado.</li>
                  <li>A jornada passará de 8h para <strong>8h30</strong>, gerando <strong>30 minutos de hora extra</strong>.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Não */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-3">
              Não considerar como hora extra
            </h3>
            <div className="bg-red-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                O período não usufruído da pausa será tratado apenas como apontamento de pausa intrajornada.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                O tempo não será somado à jornada trabalhada para fins de apuração de horas extras.
              </p>
              <div className="bg-white border border-red-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-700 mb-2">Exemplo:</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  No mesmo cenário acima:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mt-1 pl-2">
                  <li>Os 30 minutos não usufruídos serão apontados para tratamento da pausa intrajornada.</li>
                  <li>A jornada permanecerá considerada como <strong>8 horas trabalhadas</strong>.</li>
                  <li>Não haverá geração de hora extra em razão da pausa não realizada.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Importante */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Importante:</strong> O apontamento da pausa intrajornada e o cálculo de horas extras são tratamentos distintos. A não realização do intervalo pode gerar a necessidade de pagamento da indenização prevista em lei, independentemente da existência ou não de horas extras na jornada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}