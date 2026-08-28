import { FolderKanban, Activity, Pause, CheckCircle } from "lucide-react";

function Card({ label, value, icon: Icon, color, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 shadow-sm text-left transition-all w-full ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${active ? "ring-2 ring-offset-1 ring-blue-400 border-transparent" : "border-slate-200"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </button>
  );
}

export default function SummaryCards({ projects, onFilter, activeFilter }) {
  const total = projects.length;
  const active = projects.filter(p => p.status === "Em andamento" || p.status === "Em aberto").length;
  const paused = projects.filter(p => p.status === "Pausado").length;
  const concluded = projects.filter(p => p.status === "Concluído").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Total de projetos" value={total} icon={FolderKanban} color="bg-blue-500" onClick={() => onFilter?.("all")} active={activeFilter === "all"} />
      <Card label="Ativos" value={active} icon={Activity} color="bg-indigo-500" onClick={() => onFilter?.("ativos")} active={activeFilter === "ativos"} />
      <Card label="Pausados" value={paused} icon={Pause} color="bg-amber-500" onClick={() => onFilter?.("Pausado")} active={activeFilter === "Pausado"} />
      <Card label="Concluídos" value={concluded} icon={CheckCircle} color="bg-green-500" onClick={() => onFilter?.("Concluído")} active={activeFilter === "Concluído"} />
    </div>
  );
}