import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Shield, ChevronDown } from "lucide-react";

const ROLES = ["Admin", "Gestor de Projetos", "Implantação", "Viewer"];

const ROLE_COLORS = {
  "Admin": "bg-red-100 text-red-700 border-red-200",
  "Gestor de Projetos": "bg-blue-100 text-blue-700 border-blue-200",
  "Implantação": "bg-green-100 text-green-700 border-green-200",
  "Viewer": "bg-slate-100 text-slate-600 border-slate-200",
};

const ROLE_DESC = {
  "Admin": "Acesso total ao sistema, incluindo Parametrizações",
  "Gestor de Projetos": "Criar/editar projetos, TAP, cronograma, relatórios e termo",
  "Implantação": "Editar escopo, cronograma e status report",
  "Viewer": "Somente leitura em todos os projetos",
};

export default function UsersPermissions() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    base44.entities.User.list().then(u => {
      setUsers(u);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setSaving(userId);
    await base44.entities.User.update(userId, { app_role: newRole });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, app_role: newRole } : u));
    setSaving(null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
          <Shield className="w-4 h-4" />
          <span>Parametrizações</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Usuários e Permissões</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie os perfis de acesso dos usuários do sistema</p>
      </div>

      {/* Legenda de roles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {ROLES.map(role => (
          <div key={role} className="bg-white rounded-lg border border-slate-200 p-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>{role}</span>
            <p className="text-xs text-slate-500 mt-2 leading-snug">{ROLE_DESC[role]}</p>
          </div>
        ))}
      </div>

      {/* Tabela de usuários */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{users.length} usuário(s) cadastrado(s)</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Nome</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">E-mail</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Role sistema</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Perfil de acesso</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{u.full_name || "—"}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-500">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{u.role || "user"}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="relative inline-block">
                      <select
                        value={u.app_role || (u.role === "admin" ? "Admin" : "Viewer")}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={saving === u.id}
                        className={`appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${ROLE_COLORS[u.app_role || (u.role === "admin" ? "Admin" : "Viewer")]}`}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                      {saving === u.id && (
                        <span className="ml-2 text-xs text-slate-400">salvando...</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}