import { Trash2 } from "lucide-react";
import { inputClass, labelClass, selectClass } from "@/lib/calcRulesShared";
import CopyFromRule from "@/components/project/tabs/calculation/CopyFromRule";

export default function SobreavisoForm({ companyData, data, onChange }) {
  const rules = companyData?.rulesNames || [];
  const d = data || {};

  if (rules.length === 0) return <p className="text-slate-400 text-sm">Adicione regras de cálculo no passo 1 primeiro.</p>;

  const selected = (name) => d[name] || {
    hasSobreaviso: "sim",
    bancoHoras: "",
    porcentagem: "",
    envioE02: false,
    verbasE02: {
      horaExtra: { codigo: "", formato: "" },
      duracaoNaoTrabalhada: { codigo: "", formato: "" },
      adicionalNoturno: { codigo: "", formato: "" }
    },
    particularidade: "",
    verbas: []
  };

  const updateRule = (name, field, value) => {
    const val = selected(name);
    onChange({ ...d, [name]: { ...val, [field]: value } });
  };

  const updateVerbaE02 = (name, verbaKey, field, value) => {
    const val = selected(name);
    const verbasE02 = { ...(val.verbasE02 || {}) };
    verbasE02[verbaKey] = { ...verbasE02[verbaKey], [field]: value };
    onChange({ ...d, [name]: { ...val, verbasE02 } });
  };

  const addVerba = (name) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas.push({ nome: "", codigo: "", percentual: "" });
    onChange({ ...d, [name]: { ...val, verbas } });
  };

  const removeVerba = (name, idx) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas.splice(idx, 1);
    onChange({ ...d, [name]: { ...val, verbas } });
  };

  const updateVerba = (name, idx, field, value) => {
    const val = selected(name);
    const verbas = [...(val.verbas || [])];
    verbas[idx] = { ...verbas[idx], [field]: value };
    onChange({ ...d, [name]: { ...val, verbas } });
  };

  return (
    <div className="space-y-6">
      {rules.map((name) => {
        const val = selected(name);
        const inhr = (d || {})[name] || {};
        const inhFrom = inhr._inheritingFrom || "";
        const inhLocked = ("_inheritingFrom" in inhr) && !!inhFrom;
        const inhActive = "_inheritingFrom" in inhr;
        return (
          <div key={name} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-800 mb-3">{name}</h4>

            <CopyFromRule rules={rules} currentRule={name} data={d} onChange={onChange} isInheriting={inhActive} inheritingFrom={inhFrom} />
            {inhLocked ? null : (
            <>
            <div className="mb-4">
              <label className={labelClass}>Nessa regra, existem funcionários com jornadas de sobreaviso?</label>
              <select value={val.hasSobreaviso || "sim"} onChange={e => updateRule(name, "hasSobreaviso", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            {val.hasSobreaviso !== "nao" && (
            <>
            <div className="mb-4">
              <label className={labelClass}>A hora de sobreaviso deverá entrar para banco de horas?</label>
              <select value={val.bancoHoras || ""} onChange={e => updateRule(name, "bancoHoras", e.target.value)} className={`${selectClass} max-w-xs`}>
                <option value="">Selecione uma opção</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>

            <div className="mb-4">
              <label className={labelClass}>Qual a porcentagem de sobreaviso trabalhado?</label>
              <input value={val.porcentagem || ""} onChange={e => updateRule(name, "porcentagem", e.target.value)} className={`${inputClass} max-w-xs`} placeholder="Ex: 100%" />
            </div>

            <div className="border-t pt-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-3">
                <input type="checkbox" checked={!!val.envioE02} onChange={e => updateRule(name, "envioE02", e.target.checked)} className="w-4 h-4 accent-purple-600 rounded" />
                Enviar para arquivo de exportação para FOPAG (E02)?
              </label>
              {val.envioE02 && (
                <div className="space-y-4 pl-6">
                  {[
                    { key: "horaExtra", label: "Hora extra de sobreaviso", desc: "Quando o empregado trabalha durante o período de sobreaviso" },
                    { key: "duracaoNaoTrabalhada", label: "Duração de sobreaviso não trabalhada", desc: "Quando o empregado estava de sobreaviso mas não foi acionado e não trabalhou" },
                    { key: "adicionalNoturno", label: "Adicional noturno de sobreaviso", desc: "Quando o empregado trabalhou durante o sobreaviso em horário noturno" },
                  ].map(verba => (
                    <div key={verba.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-2">{verba.label}</p>
                      <p className="text-xs text-slate-400 mb-2">{verba.desc}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={(val.verbasE02?.[verba.key]?.codigo) || ""} onChange={e => updateVerbaE02(name, verba.key, "codigo", e.target.value)} className={inputClass} placeholder="Código da verba" />
                        <select value={(val.verbasE02?.[verba.key]?.formato) || ""} onChange={e => updateVerbaE02(name, verba.key, "formato", e.target.value)} className={selectClass}>
                          <option value="">Selecione o formato</option>
                          <option value="Dia">Dia</option>
                          <option value="HH:MM">HH:MM</option>
                          <option value="Centesimal">Centesimal</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4 mb-4">
              <label className={labelClass}>Possui alguma particularidade?</label>
              <p className="text-xs text-slate-400 mb-2">Deixe explícito o funcionamento do sobreaviso (trabalhado e não trabalhado).</p>
              <textarea value={val.particularidade || ""} onChange={e => updateRule(name, "particularidade", e.target.value)} className={`${inputClass} h-24`} placeholder="Descreva as particularidades do sobreaviso..." />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Outras Verbas (Sobreaviso)</p>
                <button onClick={() => addVerba(name)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">+ Adicionar Verba</button>
              </div>
              {(val.verbas || []).length === 0 && <p className="text-xs text-slate-400 italic">Nenhuma verba adicional.</p>}
              {(val.verbas || []).map((v, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Verba #{i + 1}</span>
                    <button onClick={() => removeVerba(name, i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={v.nome || ""} onChange={e => updateVerba(name, i, "nome", e.target.value)} className={inputClass} placeholder="Nome da verba" />
                    <input value={v.codigo || ""} onChange={e => updateVerba(name, i, "codigo", e.target.value)} className={inputClass} placeholder="Código" />
                    <input value={v.percentual || ""} onChange={e => updateVerba(name, i, "percentual", e.target.value)} className={inputClass} placeholder="%" />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={!!val.incluirObservacoes} onChange={e => updateRule(name, "incluirObservacoes", e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
                Incluir observações
              </label>
              {val.incluirObservacoes && (
                <textarea value={val.observacoes || ""} onChange={e => updateRule(name, "observacoes", e.target.value)} className={`${inputClass} h-24 mt-2`} placeholder="Descreva as observações..." />
              )}
            </div>
            </>
            )}
            </>
            )}
          </div>
        );
      })}
    </div>
  );
}