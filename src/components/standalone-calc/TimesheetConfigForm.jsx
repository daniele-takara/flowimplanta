import { useState } from "react";

const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

export default function TimesheetConfigForm({ data, onChange }) {
  const d = data || {};

  const update = (field, value) => {
    onChange({ ...d, [field]: value });
  };

  const CardOption = ({ selected, onClick, children, label }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className={`w-full max-w-[280px] rounded-xl border-2 overflow-hidden transition-all ${
          selected ? "border-amber-500 shadow-md" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {children}
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
            label="Sim"
          >
            <div className="bg-white p-3">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-1">Data</th>
                    <th className="text-left py-1 px-1">Entrada</th>
                    <th className="text-left py-1 px-1">Saída</th>
                    <th className="text-left py-1 px-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["01/07", "08:00", "18:00", "09:00"],
                    ["02/07", "08:05", "18:00", "08:55"],
                    ["03/07", "08:00", "17:45", "08:45"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 px-1 text-slate-600">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50">
                    <td colSpan={3} className="py-1 px-1 font-semibold text-right">Total:</td>
                    <td className="py-1 px-1 font-bold text-blue-700">26:40</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardOption>
          <CardOption
            selected={d.somatoriaFinal === "nao"}
            onClick={() => update("somatoriaFinal", "nao")}
            label="Não"
          >
            <div className="bg-white p-3">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-1">Data</th>
                    <th className="text-left py-1 px-1">Entrada</th>
                    <th className="text-left py-1 px-1">Saída</th>
                    <th className="text-left py-1 px-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["01/07", "08:00", "18:00", "09:00"],
                    ["02/07", "08:05", "18:00", "08:55"],
                    ["03/07", "08:00", "17:45", "08:45"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 px-1 text-slate-600">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardOption>
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
            label="Com abreviação"
          >
            <div className="bg-white p-3">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-1 px-1">Data</th>
                    <th className="text-left py-1 px-1">Ent.</th>
                    <th className="text-left py-1 px-1">Sd.</th>
                    <th className="text-left py-1 px-1">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["01/07", "08:00", "18:00", "HE 50%"],
                    ["02/07", "08:00", "18:00", "ATR"],
                    ["03/07", "08:00", "18:00", "—"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 px-1 text-slate-600">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardOption>
          <CardOption
            selected={d.abreviarLegendas === "nao"}
            onClick={() => update("abreviarLegendas", "nao")}
            label="Sem abreviação"
          >
            <div className="bg-white p-3">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-1 px-1">Data</th>
                    <th className="text-left py-1 px-1">Entrada</th>
                    <th className="text-left py-1 px-1">Saída</th>
                    <th className="text-left py-1 px-1">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["01/07", "08:00", "18:00", "Hora Extra 50%"],
                    ["02/07", "08:00", "18:00", "Atraso"],
                    ["03/07", "08:00", "18:00", "—"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 px-1 text-slate-600">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardOption>
        </div>
      </div>
    </div>
  );
}