import { Link2 } from "lucide-react";

export default function DependencyBadge({ count, predecessorNames, onClick, readOnly }) {
  if (readOnly && count === 0) return null;

  return (
    <button
      onClick={onClick}
      disabled={readOnly}
      className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium transition-colors whitespace-nowrap ${
        count > 0
          ? "bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200"
          : "bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100"
      }`}
      title={count > 0 ? `Depende de: ${predecessorNames.join(", ")}` : "Definir dependências"}
    >
      <Link2 className="w-3 h-3" />
      {count > 0 ? `${count} dep.` : "Dep."}
    </button>
  );
}