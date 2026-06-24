const BASE = "https://media.base44.com/images/public/69e295c073bbccc7f63f6156";

const IMAGES = {
  somatoriaSim: `${BASE}/735ea52bd_sim.png`,
  somatoriaNao: `${BASE}/171f9e890_no.png`,
  abreviacaoSim: `${BASE}/15c1e6160_Comabreviao.png`,
  abreviacaoNao: `${BASE}/da6b73a7c_Semabreviao.png`,
};

export default function TimesheetConfigForm({ data, onChange }) {
  const d = data || {};

  const update = (field, value) => {
    onChange({ ...d, [field]: value });
  };

  const CardOption = ({ selected, onClick, imgSrc, imgAlt, label }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className={`w-full max-w-[320px] rounded-xl border-2 overflow-hidden transition-all bg-white ${
          selected ? "border-amber-500 shadow-md" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <img src={imgSrc} alt={imgAlt} className="w-full h-auto" />
      </button>
      <label className="flex items-center gap-2 cursor-pointer" onClick={onClick}>
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? "border-amber-600" : "border-slate-300"}`}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </label>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-amber-400 rounded-lg px-6 py-3 -mx-2">
        <h3 className="text-lg font-bold text-black">Configuração Folha de Ponto</h3>
      </div>

      {/* Pergunta 1: Somatória final */}
      <div>
        <label className="text-base font-semibold text-slate-800 block mb-4">
          A folha/espelho de ponto dos funcionários, deve ser gerada com os apontamentos na somatória final?
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="flex flex-wrap gap-6">
          <CardOption
            selected={d.somatoriaFinal === "sim"}
            onClick={() => update("somatoriaFinal", "sim")}
            imgSrc={IMAGES.somatoriaSim}
            imgAlt="Folha de ponto com somatória final"
            label="Sim"
          />
          <CardOption
            selected={d.somatoriaFinal === "nao"}
            onClick={() => update("somatoriaFinal", "nao")}
            imgSrc={IMAGES.somatoriaNao}
            imgAlt="Folha de ponto sem somatória final"
            label="Não"
          />
        </div>
      </div>

      {/* Pergunta 2: Abreviação de legendas */}
      <div className="border-t pt-8">
        <label className="text-base font-semibold text-slate-800 block mb-4">
          Devemos abreviar as legendas na folha de ponto dos funcionários?
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="flex flex-wrap gap-6">
          <CardOption
            selected={d.abreviarLegendas === "sim"}
            onClick={() => update("abreviarLegendas", "sim")}
            imgSrc={IMAGES.abreviacaoSim}
            imgAlt="Folha de ponto com legendas abreviadas"
            label="Com abreviação"
          />
          <CardOption
            selected={d.abreviarLegendas === "nao"}
            onClick={() => update("abreviarLegendas", "nao")}
            imgSrc={IMAGES.abreviacaoNao}
            imgAlt="Folha de ponto sem abreviação de legendas"
            label="Sem abreviação"
          />
        </div>
      </div>
    </div>
  );
}