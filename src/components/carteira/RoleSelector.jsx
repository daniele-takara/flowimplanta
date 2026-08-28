import { AlertTriangle, UserCircle } from "lucide-react";

export default function RoleSelector({
  role, setRole,
  people, unassignedCount, unassignedWithNameCount,
  selectedPerson, onSelectPerson,
}) {
  return (
    <div>
      {/* Toggle de papel */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setRole("manager"); onSelectPerson(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            role === "manager"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
          }`}
        >
          Gerente de Projetos
        </button>
        <button
          onClick={() => { setRole("analyst"); onSelectPerson(null); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            role === "analyst"
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
          }`}
        >
          Analista de Implantação
        </button>
      </div>

      {/* Chips de pessoas */}
      <div className="flex flex-wrap gap-2">
        {people.map(p => (
          <button
            key={p.id}
            onClick={() => onSelectPerson(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
              selectedPerson === p.id
                ? role === "manager"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <UserCircle className="w-3.5 h-3.5" />
            {p.full_name}
            <span className={`ml-0.5 text-xs ${selectedPerson === p.id ? "text-blue-100" : "text-slate-400"}`}>
              ({p.count})
            </span>
          </button>
        ))}

        {/* Chip "Sem responsável vinculado" */}
        <button
          onClick={() => onSelectPerson("unassigned")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
            selectedPerson === "unassigned"
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"
          }`}
        >
          {unassignedWithNameCount > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
          Sem responsável vinculado
          <span className={`text-xs ${selectedPerson === "unassigned" ? "text-slate-200" : "text-slate-400"}`}>
            ({unassignedCount})
          </span>
        </button>
      </div>
    </div>
  );
}