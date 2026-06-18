import { useState } from "react";
import { X, Info } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function CalculationModelsInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="relative bg-white rounded-2xl max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl"
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
              {[
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/2ddf4e4d1_Atrasoehoraextraalmdatolernciade10minutos.png", alt: "Atraso e hora extra além da tolerância de 10 minutos", label: "Atraso e hora extra na mesma jornada" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/64ed06747_Atrasoalmdatolernciade10minutos.png", alt: "Atraso além da tolerância de 10 minutos", label: "Atraso além da tolerância de 10 minutos" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/8786a7dbb_Sadaantecipadaalmdatolernciade10minutos.png", alt: "Saída antecipada além da tolerância de 10 minutos", label: "Saída antecipada além da tolerância de 10 minutos" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/0ff8e3334_Horaextraalmdatolernciade10minutos.png", alt: "Hora extra além da tolerância de 10 minutos", label: "Hora extra além da tolerância de 10 minutos" },
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

            {/* Example */}
            <div className="mt-4">
              <img 
                src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/c0e2c3271_Exemplodejornadaflexvelcomcompensao.png" 
                alt="Exemplo de jornada flexível com compensação"
                onClick={() => setExpandedImg({ src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/c0e2c3271_Exemplodejornadaflexvelcomcompensao.png", alt: "Exemplo de jornada flexível com compensação" })}
                className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                title="Clique para ampliar"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">Exemplo de jornada flexível com compensação</p>
            </div>
          </div>

          {/* Modelo 3: Híbrido */}
          <div className="border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                3
              </div>
              <h3 className="text-lg font-semibold text-purple-800">Modelo Híbrido: Por duração da jornada com janela de tolerância</h3>
            </div>

            <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Nesse tipo de regra também é feita a <strong>compensação automática</strong>. 
                Caso haja atraso e hora extra na mesma jornada, uma compensará a outra, porém o funcionário terá uma janela de tolerância para que o sistema entenda se o dia será calculado como fixo ou flexível.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Neste tipo de cálculo, está sendo levado em consideração tanto o cálculo fixo como o cálculo flexível.
              </p>
              <p className="text-sm text-slate-500 italic">
                No exemplo abaixo, utilizamos uma janela de 60 minutos de tolerância para trás e para frente para calcular os atrasos e horas extras geradas.
              </p>
            </div>

            {/* Examples */}
            <div className="mt-4 grid grid-cols-1 gap-6">
              {[
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/851546ecf_Clculohbridocomjanelade60minutosforadajanelacomportando-secomoclculofixo.png", alt: "Cálculo híbrido fora da janela — comporta-se como fixo", label: "Fora da janela de 60 min — comporta-se como cálculo fixo" },
                { src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/47a58bc76_Clculohbridocomjanelade60minutosdentrodajanelacomportando-secomoclculoflexvel.png", alt: "Cálculo híbrido dentro da janela — comporta-se como flexível", label: "Dentro da janela de 60 min — comporta-se como cálculo flexível" },
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

        {/* Horas Extras */}
        <div className="border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 bg-purple-700 rounded-full flex items-center justify-center text-white shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-purple-800">Horas extras</h3>
          </div>

          <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">Funcionamento das Horas Extras</h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              Entenda como as porcentagens de horas extras são aplicadas
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              As porcentagens de horas extras são utilizadas para que sejam aplicadas a forma de pagamento em dias comuns de trabalho, folgas e feriados.
            </p>
          </div>

          {/* Examples */}
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