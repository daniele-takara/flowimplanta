import { X } from "lucide-react";

export default function CalculationModelsInfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="relative bg-white rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Entenda os Modelos de Cálculo de Jornada</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Antes de configurar suas regras, é importante compreender os três tipos de modelo de cálculo disponíveis. 
              Cada modelo possui características específicas para diferentes necessidades de gestão de jornada.
            </p>
          </div>

          {/* Modelo 1: Fixo */}
          <div className="border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                1
              </div>
              <h3 className="text-lg font-semibold text-purple-800">Modelo Fixo: Por Entrada e Saída</h3>
            </div>

            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Nesse tipo de regra, <strong>não existe compensação automática</strong>. 
                Caso o funcionário tenha atraso e hora extra na mesma jornada, serão gerados os dois tipos de apontamentos em folha.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                O cálculo fixo é utilizado quando é indispensável que o funcionário siga os horários conforme a sua jornada de trabalho. 
                Caso não siga, gerará apontamentos de atraso ou hora extra.
              </p>
              <p className="text-sm text-slate-500 italic">
                O exemplo abaixo traz a tolerância de 10 minutos para atrasos, saída antecipada e hora extra (entrada e saída).
              </p>
            </div>

            {/* Examples */}
            <div className="mt-4 grid grid-cols-1 gap-6">
              <div>
                <img 
                  src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/2ddf4e4d1_Atrasoehoraextraalmdatolernciade10minutos.png" 
                  alt="Atraso e hora extra além da tolerância de 10 minutos"
                  className="w-full rounded-lg border border-slate-200"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">Atraso e hora extra na mesma jornada</p>
              </div>
              <div>
                <img 
                  src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/64ed06747_Atrasoalmdatolernciade10minutos.png" 
                  alt="Atraso além da tolerância de 10 minutos"
                  className="w-full rounded-lg border border-slate-200"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">Atraso além da tolerância de 10 minutos</p>
              </div>
              <div>
                <img 
                  src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/8786a7dbb_Sadaantecipadaalmdatolernciade10minutos.png" 
                  alt="Saída antecipada além da tolerância de 10 minutos"
                  className="w-full rounded-lg border border-slate-200"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">Saída antecipada além da tolerância de 10 minutos</p>
              </div>
            </div>
          </div>

          {/* Modelo 2: Flexível */}
          <div className="border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                2
              </div>
              <h3 className="text-lg font-semibold text-purple-800">Modelo Flexível: Por Período</h3>
            </div>

            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Neste modelo, <strong>existe compensação automática</strong> dentro das janelas definidas. 
                Se o funcionário atrasar na entrada mas compensar na saída, os apontamentos se anulam dentro dos limites de tolerância.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                O sistema calcula o saldo de horas do período, compensando automaticamente atrasos com horas extras realizadas no mesmo dia, 
                respeitando as janelas de compensação configuradas.
              </p>
              <p className="text-sm text-slate-500 italic">
                Exemplo: com janela de 30 minutos antes e depois, atrasos de até 30 minutos são compensados automaticamente.
              </p>
            </div>
          </div>

          {/* Modelo 3: Híbrido */}
          <div className="border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                3
              </div>
              <h3 className="text-lg font-semibold text-purple-800">Modelo Híbrido</h3>
            </div>

            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                O modelo híbrido <strong>combina características dos modelos Fixo e Flexível</strong>. 
                Funciona com tolerâncias definidas e compensação automática dentro dos limites configurados.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Atrasos dentro da tolerância são compensados automaticamente. O que ultrapassar a tolerância gera apontamento de atraso. 
                Horas extras que excederem a janela de compensação geram apontamento de hora extra.
              </p>
              <p className="text-sm text-slate-500 italic">
                Ideal para empresas que precisam de um equilíbrio entre controle rígido e flexibilidade operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}