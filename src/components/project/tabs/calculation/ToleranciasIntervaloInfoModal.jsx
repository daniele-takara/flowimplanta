import { X } from "lucide-react";

export default function ToleranciasIntervaloInfoModal({ onClose }) {
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Tolerâncias de Intervalo</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Entenda como configurar as tolerâncias para duração da pausa de refeição e descanso.
            </p>
          </div>

          {/* Tolerância para duração da pausa refeição realizada */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">
              Tolerância para duração da pausa refeição realizada
            </h3>
            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Informe quantos minutos de diferença serão aceitos entre o tempo de intervalo previsto e o tempo efetivamente realizado pelo colaborador.
              </p>
              <div className="bg-white border border-purple-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-purple-700 mb-2">Exemplo:</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Se a jornada prevê <strong>1 hora de intervalo</strong> e a tolerância configurada for de <strong>10 minutos</strong>:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mt-2 pl-2">
                  <li>Um intervalo de <strong>50 minutos</strong> ou <strong>1h10</strong> será considerado dentro da tolerância.</li>
                  <li>Um intervalo inferior a <strong>50 minutos</strong> ou superior a <strong>1h10</strong> irá calcular apontamento de pagamento de pausa refeição não realizada (podendo ser uma verba específica ou adicionada à verba de hora extra no arquivo de exportação — no sistema apresentará separado).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tolerância para duração de pausa em excesso */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">
              Tolerância para duração de pausa em excesso
            </h3>
            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Informe quantos minutos de extrapolação do intervalo serão aceitos antes que o sistema gere um apontamento de excesso de pausa.
              </p>
              <div className="bg-white border border-purple-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-purple-700 mb-2">Exemplo:</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Se a jornada prevê <strong>1 hora de intervalo</strong> e a tolerância configurada for de <strong>10 minutos</strong>:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mt-2 pl-2">
                  <li>Até <strong>1h10</strong> de intervalo será considerado dentro da tolerância.</li>
                  <li>Acima de <strong>1h10</strong> o sistema apontará excesso de intervalo (podendo ser uma verba específica ou adicionada à verba de atraso).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Importante */}
          <div className="border border-amber-200 rounded-xl p-6 bg-amber-50/50">
            <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Intervalo de refeição não realizado ou realizado parcialmente
            </h3>
            <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
              <p>
                O intervalo intrajornada (refeição e descanso) é um direito garantido pela legislação trabalhista. Quando o colaborador não usufrui integralmente desse período, a empresa deve remunerar o tempo não concedido com o adicional previsto em lei.
              </p>
              <p>
                Esse pagamento possui <strong>natureza indenizatória</strong>, ou seja, serve para compensar o colaborador pela não fruição do descanso obrigatório.
              </p>
              <p className="font-medium text-amber-800">Por esse motivo:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>O período não usufruído do intervalo <strong>não pode ser compensado</strong> posteriormente na jornada;</li>
                <li>O período não usufruído <strong>não deve gerar crédito ou débito</strong> em banco de horas;</li>
                <li>A situação deve ser tratada por meio do <strong>pagamento da indenização</strong> prevista na legislação.</li>
              </ul>
              <div className="bg-white border border-amber-100 rounded-lg p-4 mt-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Exemplo:</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Se o colaborador deveria realizar <strong>1 hora de intervalo</strong>, mas realizou apenas <strong>40 minutos</strong>, os <strong>20 minutos</strong> não usufruídos deverão ser tratados conforme a regra legal aplicável para indenização do intervalo, <strong>não como compensação de jornada ou banco de horas</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Observação:</strong> As tolerâncias configuradas neste cadastro servem apenas para definir quando o sistema deverá considerar ou desconsiderar pequenas variações no tempo de intervalo realizado. Elas não alteram as obrigações legais relacionadas ao intervalo intrajornada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}