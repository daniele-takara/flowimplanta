import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  Loader2, AlertTriangle, MoreHorizontal, EyeOff
} from "lucide-react";
import LocalActivityRow from "./LocalActivityRow.jsx";

const STATUS_COLORS = {
  "Não iniciado": "bg-slate-100 text-slate-600",
  "Em andamento": "bg-blue-100 text-blue-700",
  "Concluído":    "bg-green-100 text-green-700",
  "Atrasado":     "bg-red-100 text-red-700",
  "Bloqueado":    "bg-orange-100 text-orange-700",
  "Cancelado":    "bg-slate-100 text-slate-400",
};

function fmtDate(d) {
  if (!d) return "—";
  try { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; } catch { return d; }
}

export default function LocalPhaseSection({
  phase,
  localActivities,
  onEditPhase,
  onPhaseInactivated,
  onPhaseRemoved,
  onAddActivity,
  onActivityUpdated,
  onActivityRemoved,
  readOnly,
  canEditPhase,
  canExcluirPhase,
  canAddActivity,
  showInactive,
}) {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "inativar" | "excluir"
  const [processing, setProcessing] = useState(false);

  const phaseActivities = (localActivities || []).filter(a => a.phase_name === phase.phase_name);
  const hasHistory = phaseActivities.some(a =>
    a.actual_start || a.actual_end || a.history_observations
  );

  const handleMenuAction = (action) => {
    setMenuOpen(false);
    if (action === "editar") { onEditPhase(phase); return; }
    if (action === "inativar") { setConfirmAction("inativar"); return; }
    if (action === "excluir") {
      // Fase com histórico → só inativar
      if (phaseActivities.length > 0 || hasHistory) {
        setConfirmAction("inativar");
      } else {
        setConfirmAction("excluir");
      }
    }
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      if (confirmAction === "excluir") {
        await base44.entities.LocalSchedulePhase.delete(phase.id);
        onPhaseRemoved(phase.id);
      } else {
        await base44.entities.LocalSchedulePhase.update(phase.id, { is_active: false });
        onPhaseInactivated(phase.id);
      }
    } catch (e) {
      console.error("Erro ao processar fase:", e);
    }
    setProcessing(false);
    setConfirmAction(null);
  };

  return (
    <div className={`mb-2 rounded-xl border overflow-hidden shadow-sm ${phase.is_active === false ? "border-slate-200 opacity-60" : "border-purple-200"}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none ${phase.is_active === false ? "bg-slate-400" : "bg-purple-600"}`}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-white shrink-0" /> : <ChevronRight className="w-4 h-4 text-white shrink-0" />}

        <h3 className="text-sm font-bold text-white flex-1 min-w-0 truncate">{phase.phase_name}</h3>

        {phase.is_active === false && (
          <span className="text-xs bg-slate-500 text-white px-2 py-0.5 rounded-full font-medium shrink-0">Inativo</span>
        )}

        <span className="text-xs bg-purple-500 text-purple-100 px-2 py-0.5 rounded-full font-medium shrink-0">
          Marco local
        </span>

        {phase.planned_start && (
          <span className="text-xs text-purple-200 hidden md:inline shrink-0">
            {fmtDate(phase.planned_start)} → {fmtDate(phase.planned_end)}
          </span>
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[phase.status] || STATUS_COLORS["Não iniciado"]}`}>
          {phase.status || "Não iniciado"}
        </span>

        {/* Ações — stopPropagation para não colapsar */}
        <div className="flex items-center gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
          {!readOnly && canAddActivity && phase.is_active !== false && (
            <button
              onClick={() => onAddActivity(phase.phase_name)}
              className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-2.5 py-1 font-medium"
            >
              <Plus className="w-3 h-3" /> Atividade
            </button>
          )}

          {!readOnly && (canEditPhase || canExcluirPhase) && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(m => !m)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
                title="Ações da fase"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[160px]">
                    {canEditPhase && phase.is_active !== false && (
                      <button
                        onClick={() => handleMenuAction("editar")}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar fase
                      </button>
                    )}
                    {canExcluirPhase && phase.is_active !== false && (
                      <button
                        onClick={() => handleMenuAction("inativar")}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Inativar fase
                      </button>
                    )}
                    {canExcluirPhase && (
                      <button
                        onClick={() => handleMenuAction("excluir")}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir fase
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmação */}
      {confirmAction && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {confirmAction === "excluir"
                  ? "Excluir esta fase definitivamente?"
                  : phaseActivities.length > 0 || hasHistory
                    ? `Esta fase possui ${phaseActivities.length} atividade(s)/histórico. Será inativada (dados preservados).`
                    : "Inativar esta fase? Ela ficará oculta mas pode ser restaurada."}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleConfirm}
                  disabled={processing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${confirmAction === "excluir" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
                >
                  {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmAction === "excluir" ? <Trash2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {confirmAction === "excluir" ? "Excluir" : "Inativar"}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Observações */}
      {open && phase.observations && (
        <div className="px-5 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 italic">
          {phase.observations}
        </div>
      )}

      {/* Tabela de atividades */}
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
                <th className="px-3 py-2.5 w-24 text-xs font-semibold text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {phaseActivities.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-4 text-xs text-slate-400 italic text-center">
                    Nenhuma atividade adicionada.{!readOnly && canAddActivity ? " Use \"+ Atividade\" para incluir." : ""}
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
                  showInactive={showInactive}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}