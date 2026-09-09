import { BookOpen, KeyRound, AlertCircle, Server } from "lucide-react";
import { endpoints, METHOD_COLORS } from "@/lib/apiDocsConfig";

const SECTIONS = [
  { id: "overview", label: "Visão geral", icon: BookOpen },
  { id: "auth", label: "Autenticação", icon: KeyRound },
  { id: "endpoints", label: "Endpoints", icon: Server },
  { id: "errors", label: "Códigos de erro", icon: AlertCircle },
];

export default function DocsSidebar({ activeId, onSelect }) {
  return (
    <nav className="space-y-1">
      {SECTIONS.map(sec => {
        const Icon = sec.icon;
        const isActive = activeId === sec.id;
        return (
          <div key={sec.id}>
            <button
              onClick={() => onSelect(sec.id)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sec.label}
            </button>

            {sec.id === "endpoints" && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
                {endpoints.map(ep => {
                  const colors = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => onSelect(`ep-${ep.id}`)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                        activeId === `ep-${ep.id}` ? "bg-purple-50 text-purple-700 font-semibold" : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {ep.method}
                      </span>
                      <span className="truncate">{ep.summary}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}