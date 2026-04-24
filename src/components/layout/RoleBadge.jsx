import { usePermissions } from "@/lib/usePermissions";

export default function RoleBadge() {
  const { profileName } = usePermissions();

  const colors = {
    "Admin": "bg-red-900/40 text-red-300 border-red-700",
    "Gestor de Projetos": "bg-blue-900/40 text-blue-300 border-blue-700",
    "Implantação": "bg-amber-900/40 text-amber-300 border-amber-700",
    "Viewer": "bg-slate-700 text-slate-400 border-slate-600",
  };
  const colorClass = colors[profileName] || "bg-slate-700 text-slate-300 border-slate-600";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>
      {profileName}
    </span>
  );
}