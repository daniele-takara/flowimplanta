import { FolderKanban, Activity, Pause, CheckCircle } from "lucide-react";

function Card({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function SummaryCards({ projects }) {
  const total = projects.length;
  const active = projects.filter(p => p.status === "Em andamento" || p.status === "Em aberto").length;
  const paused = projects.filter(p => p.status === "Pausado").length;
  const concluded = projects.filter(p => p.status === "Concluído").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Total de projetos" value={total} icon={FolderKanban} color="bg-blue-500" />
      <Card label="Ativos" value={active} icon={Activity} color="bg-indigo-500" />
      <Card label="Pausados" value={paused} icon={Pause} color="bg-amber-500" />
      <Card label="Concluídos" value={concluded} icon={CheckCircle} color="bg-green-500" />
    </div>
  );
}