import React from "react";

export default function RevisaoFinal({ companyData, allData, project }) {
  const rules = companyData?.rulesNames || [];
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h4 className="font-semibold text-green-800 mb-2">Dados da Empresa</h4>
        <p className="text-sm text-green-700">{project?.client_name || "—"}</p>
        <p className="text-sm text-green-700">Responsável: {companyData?.responsibleName || "—"}</p>
        <p className="text-sm text-green-700">Regras: {(rules || []).join(", ") || "Nenhuma"}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {companyData?.hasNightShift && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Noturno</span>}
          {companyData?.has12x36Shift && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">12x36</span>}
          {companyData?.hasOnCallWorkers && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sobreaviso</span>}
          {companyData?.hasTimeBank && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Banco de Horas</span>}
        </div>
        {companyData?.incluirObservacoes && companyData?.observacoes && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-xs font-medium text-green-800 mb-1">Observações</p>
            <p className="text-xs text-green-700 whitespace-pre-wrap">{companyData.observacoes}</p>
          </div>
        )}
      </div>

      {rules.map(name => {
        const rc = allData.rule_configurations?.[name] || {};
        const he = allData.overtime_rules?.[name] || {};
        const br = allData.break_time_rules?.[name] || {};
        const an = allData.night_shift_rules?.[name] || {};
        const j12 = allData.shift_12x36_rules?.[name] || {};
        const sb = allData.sobreaviso_rules?.[name] || {};
        const bh = allData.bank_hours_rules?.[name] || {};
        const dsr = allData.dsr_rules?.[name] || {};

        return (
          <div key={name} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-800 mb-3">{name}</h4>
            <div className="text-xs text-slate-500 space-y-1.5">
              {rc.model && (
                <p><span className="font-medium text-slate-600">Modelo:</span> {rc.model}
                  {rc.model === "Fixo" && ` — Atraso Entrada: ${rc.entradaToleranciaAtraso || "—"}min, Antecipação Saída: ${rc.saidaToleranciaAntecipada || "—"}min`}
                  {rc.model === "Flexível" && ` — Janela: ${rc.janelaAntes || "—"}min antes / ${rc.janelaDepois || "—"}min depois`}
                  {rc.model === "Híbrido" && ` — Tolerância: ${rc.toleranciaAtraso || "—"}min / Janela: ${rc.janelaAntes || "—"}min`}
                </p>
              )}
              {rc.incluirObservacoes && rc.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (Regras):</span> {rc.observacoes}</p>
              )}
              {he.percDiasComuns && (
                <p><span className="font-medium text-slate-600">HE:</span> Dias Comuns {he.percDiasComuns}% | Sáb {he.percSabado || "50"}% | Dom {he.percDomingo || "100"}% | Fer {he.percFeriado || "100"}%
                  {(he.additionalRates || []).length > 0 && ` + ${he.additionalRates.length} percentual(is) adicional(is)`}
                </p>
              )}
              {he.incluirObservacoes && he.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (HE):</span> {he.observacoes}</p>
              )}
              {br.toleranciaPausaRefeicao && (
                <p><span className="font-medium text-slate-600">Intervalos:</span> Refeição: entre {br.intervaloMinHoras || "4"}h e {br.intervaloMaxHoras || "6"}h = {br.intervaloMinMinutos || "15"}min / +{br.intervaloMaxHoras || "6"}h = {br.intervaloMaxMinutos || "60"}min | Tolerância Refeição: {br.toleranciaPausaRefeicao || "—"}min | Excesso: {br.toleranciaPausaExcesso || "—"}min</p>
              )}
              {br.incluirObservacoes && br.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (Intervalos):</span> {br.observacoes}</p>
              )}
              {an.percAdicional && <p><span className="font-medium text-slate-600">Noturno:</span> {an.percAdicional}% — {an.horaInicioNoturna || "22:00"} às {an.horaFimNoturna || "05:00"}{an.separarHENoturna === "sim" ? " (HE separada)" : ""}</p>}
              {an.incluirObservacoes && an.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (Noturno):</span> {an.observacoes}</p>
              )}
              {j12.hasJornada12x36 !== "nao" && <p><span className="font-medium text-slate-600">12x36:</span> Feriado: {j12.pagamentoFeriado === "extra" ? "Pagamento extra" : "Pagamento normal"} | Falta: {j12.faltaFeriado === "sim" ? "Sim" : "Não"}</p>}
              {j12.incluirObservacoes && j12.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (12x36):</span> {j12.observacoes}</p>
              )}
              {sb.hasSobreaviso !== "nao" && <p><span className="font-medium text-slate-600">Sobreaviso:</span> {sb.porcentagem || "—"}%{sb.bancoHoras === "sim" ? " (Banco de Horas)" : ""}{sb.envioE02 ? " | Envia FOPAG" : ""}{(sb.verbas || []).length > 0 ? ` | ${sb.verbas.length} verba(s)` : ""}</p>}
              {sb.incluirObservacoes && sb.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (Sobreaviso):</span> {sb.observacoes}</p>
              )}
              {bh.formato && <p><span className="font-medium text-slate-600">Banco de Horas:</span> {bh.formato === "compensacao_geral" ? "Compensação Geral" : "Por Janela"}{bh.dataInicio ? ` | Início: ${bh.dataInicio}` : ""}{bh.limiteDias ? ` | Limite: ${bh.limiteDias} dias` : ""}{bh.prazoVencimento ? ` | Vencimento: ${bh.prazoVencimento} meses` : ""}{bh.criterioAcumulo ? ` | Critério: ${bh.criterioAcumulo}` : ""}</p>}
              {bh.incluirObservacoes && bh.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (Banco de Horas):</span> {bh.observacoes}</p>
              )}
              {dsr.tipoHEFeriado && <p><span className="font-medium text-slate-600">DSR/Feriados:</span> HE Feriado: {dsr.tipoHEFeriado === "extra" ? "Extra" : "Não considerar"} | Pausa Folga: {dsr.pausaFolgaHoraTrabalhada === "considerar" ? "Considerar" : "Não considerar"} | DSR Dobro: {dsr.dsrDobroFalta === "sim" ? "Sim" : "Não"} | Mês Desc: {dsr.mesDescontoDSR === "falta" ? "Na folha da falta" : "Próximo mês"}{dsr.envioE02 ? " | Envia FOPAG" : ""}{(dsr.verbas || []).length > 0 ? ` | ${dsr.verbas.length} verba(s)` : ""}</p>}
              {dsr.incluirObservacoes && dsr.observacoes && (
                <p><span className="font-medium text-slate-600">Obs (DSR/Feriados):</span> {dsr.observacoes}</p>
              )}
            </div>
          </div>
        );
      })}

      {(allData.other_verbs_rules?.verbas?.length > 0 || (allData.other_verbs_rules?.incluirObservacoes && allData.other_verbs_rules?.observacoes)) && (
        <div className="border border-slate-200 rounded-xl p-4">
          <h4 className="font-semibold text-slate-800 mb-2">Outras Verbas</h4>
          {(allData.other_verbs_rules?.verbas || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allData.other_verbs_rules.verbas.map((v, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                  {v.nome} {v.codigo && `(${v.codigo})`} {v.percentual && `${v.percentual}%`}
                </span>
              ))}
            </div>
          )}
          {allData.other_verbs_rules?.incluirObservacoes && allData.other_verbs_rules?.observacoes && (
            <div className={(allData.other_verbs_rules?.verbas || []).length > 0 ? "mt-3 pt-3 border-t border-slate-200" : ""}>
              <p className="text-xs font-medium text-slate-600 mb-1">Observações</p>
              <p className="text-xs text-slate-500 whitespace-pre-wrap">{allData.other_verbs_rules.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}