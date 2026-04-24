import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, Pencil, ChevronDown, CheckCircle, XCircle, X } from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function InviteModal({ profiles, onClose, onDone }) {
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isAdmin = profiles.find(p => p.id === profileId)?.name === "Admin";
      await base44.users.inviteUser(email.trim(), isAdmin ? "admin" : "user");
      // Após convite, aguarda o usuário existir para setar o perfil (limitação: email base)
      onDone();
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao enviar convite.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Convidar Usuário</h2>
            <p className="text-xs text-slate-400 mt-0.5">Envie um convite por e-mail. O perfil pode ser atribuído após o aceite.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleInvite} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail *</label>
            <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required placeholder="usuario@empresa.com.br" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Perfil de Permissão *</label>
            {profiles.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nenhum perfil cadastrado. Crie um perfil em "Perfis de Permissão" antes de convidar.
              </p>
            ) : (
              <select className={inputClass} value={profileId} onChange={e => setProfileId(e.target.value)} required>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            O usuário receberá um e-mail de convite. Após aceitar, você pode atribuir ou alterar o perfil nesta tela.
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving || profiles.length === 0} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TabUsuarios() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, p] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.PermissionProfile.list("name"),
    ]);
    setUsers(u);
    setProfiles(p);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleProfileChange = async (userId, profileId) => {
    setSaving(userId);
    await base44.entities.User.update(userId, { permission_profile_id: profileId });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permission_profile_id: profileId } : u));
    setSaving(null);
  };

  const handleToggleActive = async (user) => {
    setSaving(user.id);
    await base44.entities.User.update(user.id, { is_active: !user.is_active });
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
    setSaving(null);
  };

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">
          Usuários recebem permissões exclusivamente através do <strong>Perfil de Permissão</strong> atribuído.
        </p>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
          <UserPlus className="w-4 h-4" /> Convidar Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{users.length} usuário(s)</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Nenhum usuário cadastrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Usuário</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Perfil de Permissão</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Role sistema</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const linkedProfile = profileMap[u.permission_profile_id];
                const isActive = u.is_active !== false;
                return (
                  <tr key={u.id} className={`border-b border-slate-50 last:border-0 transition-colors ${isActive ? "hover:bg-slate-50" : "opacity-50 bg-slate-50"}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                          {(u.full_name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{u.full_name || "—"}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {profiles.length === 0 ? (
                        <span className="text-xs text-amber-600 italic">Nenhum perfil cadastrado</span>
                      ) : (
                        <div className="relative inline-flex items-center gap-1">
                          <select
                            value={u.permission_profile_id || ""}
                            onChange={e => handleProfileChange(u.id, e.target.value)}
                            disabled={saving === u.id}
                            className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700"
                          >
                            <option value="">— Selecionar perfil —</option>
                            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-slate-400" />
                        </div>
                      )}
                      {!u.permission_profile_id && (
                        <p className="text-xs text-amber-600 mt-1">Sem perfil → acesso mínimo</p>
                      )}
                      {saving === u.id && <span className="text-xs text-slate-400 ml-2">salvando...</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{u.role || "user"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={saving === u.id}
                        title={isActive ? "Desativar" : "Ativar"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border"
                        style={isActive
                          ? { background: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }
                          : { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }}
                      >
                        {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {isActive ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && <InviteModal profiles={profiles} onClose={() => setShowInvite(false)} onDone={load} />}
    </div>
  );
}