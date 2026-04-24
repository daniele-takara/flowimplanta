import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, Settings, GitBranch, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/usePermissions";
import RoleBadge from "@/components/layout/RoleBadge";

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { canAccessParametrizacoes, canAccessFluxo, canCreateProject } = usePermissions();

  const mainItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: FolderKanban, label: "Projetos", path: "/projects" },
  ];

  const configItems = [
    canAccessParametrizacoes && { icon: Settings, label: "Parametrizações", path: "/parametrizacoes" },
    canAccessParametrizacoes && { icon: Users, label: "Usuários e Permissões", path: "/users-permissions" },
    canAccessFluxo && { icon: GitBranch, label: "Fluxo do Projeto", path: "/fluxo" },
  ].filter(Boolean);

  const renderLink = ({ icon: Icon, label, path }) => {
    const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
    return (
      <Link
        key={path}
        to={path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col">
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-4">
        {/* Main */}
        <div className="space-y-1">
          {mainItems.map(renderLink)}
        </div>

        {/* Configurações */}
        {configItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-1.5">
              Configurações
            </p>
            <div className="space-y-1">
              {configItems.map(renderLink)}
            </div>
          </div>
        )}
      </nav>

      {/* Novo Projeto (só quem pode criar) */}
      {canCreateProject && (
        <div className="px-4 pb-3">
          <Link
            to="/projects/new"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        </div>
      )}

      {/* User info + role badge */}
      <div className="p-4 border-t border-slate-700 space-y-2">
        {user && (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <RoleBadge />
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );
}