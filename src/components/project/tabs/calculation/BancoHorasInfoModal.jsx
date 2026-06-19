import { useState } from "react";
import { X } from "lucide-react";
import ImageExpandModal from "@/components/project/tabs/ImageExpandModal";

export default function BancoHorasInfoModal({ onClose }) {
  const [expandedImg, setExpandedImg] = useState(null);

  const imgCompensacaoGeral = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/fea60e828_VisualizaodoBancodeHorasdeCompensaoGeral.png",
    alt: "Visualização do Banco de Horas de Compensação Geral",
    label: "Visualização do Banco de Horas — Compensação Geral"
  };

  const imgPorJanela = {
    src: "https://media.base44.com/images/public/69e295c073bbccc7f63f6156/d2d3d5d69_VisualizaodoBancodeHorasdeporJanela.png",
    alt: "Visualização do Banco de Horas de Por Janela",
    label: "Visualização do Banco de Horas — Por Janela"
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
            <h2 className="text-xl font-bold text-slate-800 mb-2">Modelos de Banco de Horas</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Possuímos 2 modelos de banco de horas. Entenda as diferenças entre eles.
            </p>
          </div>

          {/* Modelo 1: Compensação Geral */}
          <div className="border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">1</span>
                <h3 className="text-base font-bold text-slate-800">Compensação Geral</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Indicaremos um início e término. Neste período, o colaborador poderá realizar as devidas compensações automaticamente. Nesse modelo, só há quitação quando houver uma baixa realizada manualmente pela equipe de recursos humanos.
              </p>
            </div>
            <img
              src={imgCompensacaoGeral.src}
              alt={imgCompensacaoGeral.alt}
              onClick={() => setExpandedImg(imgCompensacaoGeral)}
              className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
              title="Clique para ampliar"
            />
            <p className="text-xs text-slate-400 text-center">{imgCompensacaoGeral.label}</p>
          </div>

          {/* Modelo 2: Por Janela */}
          <div className="border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="text-base font-bold text-slate-800">Por Janela</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Geralmente, uma janela de 6 meses, então todas as horas de janeiro poderão ser compensadas até junho. Caso não seja realizado, irá automaticamente para pagamento. Nesse modelo de banco de horas, há a quitação mensalmente, conforme os meses e janelas de vencimentos.
              </p>
            </div>
            <img
              src={imgPorJanela.src}
              alt={imgPorJanela.alt}
              onClick={() => setExpandedImg(imgPorJanela)}
              className="w-full rounded-lg border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all shadow-sm"
              title="Clique para ampliar"
            />
            <p className="text-xs text-slate-400 text-center">{imgPorJanela.label}</p>
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