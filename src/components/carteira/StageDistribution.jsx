import { PHASE_ORDER, STAGE_COLORS } from "@/lib/computeCurrentStage";

export default function StageDistribution({ stageCounts }) {
  const entries = Object.entries(stageCounts).sort((a, b) => {
    // Ordena por ordem canônica; fases desconhecidas vão para o fim
    const ia = PHASE_ORDER.indexOf(a[0]);
    const ib = PHASE_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const maxCount = Math.max(...entries.map(([, c]) => c), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Distribuição por Etapa</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Nenhum projeto para exibir.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([stage, count]) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-48 shrink-0 truncate" title={stage}>{stage}</span>
              <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${STAGE_COLORS[stage] || "bg-slate-400"}`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}