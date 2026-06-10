import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  Loader2, CheckCircle, AlertTriangle
} from "lucide-react";
import LocalActivityRow from "./LocalActivityRow.jsx";

const STATUS_COLORS = {
  "Não iniciado": "bg-slate-100 text-slate-500",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Concluído": "bg-green-100 text-green-700",
  "Atrasado": "bg-red-100 text-red-700",
  "Bloqueado": "bg-orange-100 text-orange-700",
  "Cancelado": "bg-slate-100 text-slate-400 line-through",
};

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

export default function LocalPhaseSection({
  phase,
  localActivities,
  onEditPhase,
  onPhaseRemoved,
  onAddActivity,
  onActivityUpdated,
  onActivityRemoved,
  readOnly,
  canEditPhase,
  canExcluirPhase,
  canAddActivity,
}) {
  const [open, setOpen] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const phaseActivities = localActivities.filter(a => a.phase_name === phase.phase_name);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      if (phaseActivities.length === 0) {
        // Sem atividades → excluir definitivamente
        await base44.entities.LocalSchedulePhase.delete(phase.id);
        onPhaseRemoved(phase.id);
      } else {
        // Com atividades → inativar
        await base44.entities.LocalSchedulePhase.update(phase.id, { is_active: false });
        onPhaseRemoved(phase.id); // remove da lista ativa (pai recarrega)
      }
    } catch (e) {
      console.error("Erro ao remover fase:", e);
    }
    setRemoving(false);
    setConfirmRemove(false);
  };

  return (
    <div className="mb-2 rounded-xl border border-purple-200 overflow-hidden shadow-sm">
      {/* Header da fase local */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 bg-purple-600 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}

        <h3 className="text-sm font-bold text-white flex-1">{phase.phase_name}</h3>

        <span className="text-xs bg-purple-500 text-purple-100 px-2 py-0.5 rounded-full font-medium">
          Marco local
        </span>

        {phase.planned_start && (
          <span className="text-xs text-purple-200 hidden md:inline">
            {fmtDate(phase.planned_start)} → {fmtDate(phase.planned_end)}
          </span>
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[phase.status] || STATUS_COLORS["Não iniciado"]}`}>
          {phase.status || "Não iniciado"}
        </span>

        {/* Ações (não propagam o clique para o toggle) */}
        <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
          {!readOnly && canAddActivity && (
            <button
              onClick={() => onAddActivity(phase.phase_name)}
              className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              <Plus className="w-3 h-3" /> Atividade
            </button>
          )}
          {!readOnly && canEditPhase && (
            <button
              onClick={() => onEditPhase(phase)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg"
              title="Editar fase"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {!readOnly && canExcluirPhase && (
            <button
              onClick={() => setConfirmRemove(true)}
              className="p-1.5 text-white/70 hover:text-red-300 hover:bg-white/20 rounded-lg"
              title={phaseActivities.length === 0 ? "Excluir fase" : "Inativar fase"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmação de remoção */}
      {confirmRemove && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {phaseActivities.length === 0
                ? "Excluir esta fase definitivamente?"
                : `Esta fase possui ${phaseActivities.length} atividade(s). Ela será inativada (histórico preservado).`}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {phaseActivities.length === 0 ? "Excluir" : "Inativar"}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Observações da fase */}
      {open && phase.observations && (
        <div className="px-5 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 italic">
          {phase.observations}
        </div>
      )}

      {/* Atividades da fase */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 min-w-[250px]">Atividade</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Início Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Fim Plan.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Início Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5 whitespace-nowrap">Fim Exec.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Resp. Geral</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Resp. Líder</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2.5">Obs.</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {phaseActivities.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-4 text-xs text-slate-400 italic text-center">
                    Nenhuma atividade adicionada. Use "+ Atividade" para incluir.
                  </td>
                </tr>
              )}
              {phaseActivities.map(act => (
                <LocalActivityRow
                  key={act.id}
                  activity={act}
                  onUpdated={onActivityUpdated}
                  onRemoved={onActivityRemoved}
                  readOnly={readOnly}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}