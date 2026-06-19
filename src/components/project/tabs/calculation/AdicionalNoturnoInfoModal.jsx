import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function AdicionalNoturnoInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgSemReducao = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/227d388f8_Semreduonoturna.png",
    alt: "Exemplo sem redução noturna — H. Trabalhadas 08:00, Adic. Noturno 07:00",
    label: "Sem redução noturna"
  };

  const imgComReducao = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/88446d976_Reduonoturnacomhoranoturnareduzida52minutose30segundos.png",
    alt: "Exemplo com redução noturna — H. Trabalhadas 08:00, Adic. Noturno 08:00",
    label: "Com redução noturna"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Adicional Noturno e Redução Noturna</h2>
          </div>

          {/* 1. Adicional Noturno */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">1. Adicional Noturno</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">O que é?</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  É um adicional (acréscimo) no valor da hora trabalhada no período noturno, para compensar o desgaste maior do trabalhador em função do horário.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Percentual:</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  A CLT estabelece um adicional de 20% sobre o valor da hora diurna para o trabalho urbano noturno. O percentual pode ser maior se houver previsão em convenção coletiva ou acordo específico.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Cálculo:</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Exemplo: Se a hora normal do trabalhador é R$ 10, no período noturno será R$ 12 (10 + 20%).
                </p>
              </div>
            </div>
          </div>

          {/* 2. Redução Noturna */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">2. Redução Noturna</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">O que é?</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Trata-se de uma redução na duração da hora de trabalho no período noturno, que passa a ter <strong>52 minutos e 30 segundos</strong> ao invés de 60 minutos. Isso significa que o trabalhador realiza menos tempo efetivo de trabalho, mas cada hora noturna continua sendo contabilizada como se tivesse 60 minutos.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Finalidade:</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Beneficiar o trabalhador devido ao desgaste maior das atividades realizadas no horário noturno.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Período Noturno:</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  O mesmo do adicional noturno (22h às 5h).
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Cálculo:</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Para cada hora de trabalho, a empresa deve considerar 52 minutos e 30 segundos. Assim, em 7 horas de trabalho noturno (22h às 5h), o trabalhador efetivamente cumpre cerca de 6 horas e 10 minutos de trabalho.
                </p>
              </div>
            </div>
          </div>

          {/* Diferença na prática */}
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-800 mb-3">Diferença na prática</h3>
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong>Adicional Noturno:</strong> É um pagamento extra, proporcional à remuneração normal, aplicado às horas trabalhadas no período noturno.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong>Redução Noturna:</strong> É uma redução no tempo efetivo de trabalho, sem alterar o pagamento total das horas noturnas, já que cada hora equivale a menos tempo trabalhado.
                </p>
              </div>
            </div>
          </div>

          {/* Exemplos visuais */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Exemplos visuais</h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <img
                  src={imgSemReducao.src}
                  alt={imgSemReducao.alt}
                  onClick={() => setExpandedImg(imgSemReducao)}
                  className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                  title="Clique para ampliar"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">{imgSemReducao.label}</p>
              </div>
              <div>
                <img
                  src={imgComReducao.src}
                  alt={imgComReducao.alt}
                  onClick={() => setExpandedImg(imgComReducao)}
                  className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
                  title="Clique para ampliar"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">{imgComReducao.label}</p>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Esses direitos são cumulativos:</strong> o trabalhador noturno recebe tanto a redução quanto o adicional no cálculo de sua remuneração. Por padrão a maioria de nossos clientes pagam o adicional noturno já considerando a redução noturna no apontamento.
            </p>
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