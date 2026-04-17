import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FolderKanban, label: "Projetos", path: "/projects" }
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Pontotel</p>
            <p className="text-slate-400 text-xs">Gestão de Implantação</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <Link
          to="/projects/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto
        </Link>
      </div>
    </aside>
  );
}